"""
main.py - FastAPI server with lap-by-lap position simulation.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from backend.parser import load_race, list_available_races
from backend.ml.degradation import load_model
from backend.ml.simulator import (
    simulate_counterfactual,
    CounterfactualRequest,
    PitStop,
)
from backend.ml.race_simulator import compute_race_position

app = FastAPI(title="PitStrat AI")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

print("Loading ML model...")
_model, _encoder = load_model()
print("Model ready.")

_sessions: dict[str, list[dict]] = {}


@app.get("/races")
def get_races():
    return {"races": list_available_races()}


@app.get("/race/{year}/{round_number}")
def get_race(year: int, round_number: int):
    try:
        session = load_race(year, round_number)
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))

    finish_positions = {}
    for d in session.drivers:
        laps = session.laps_for_driver(d)
        for lap in reversed(laps):
            if lap.position is not None:
                finish_positions[d] = lap.position
                break

    drivers_data = []
    for d in session.drivers:
        stints = session.stints_for_driver(d)
        pits = session.pit_stops_for_driver(d)
        laps = session.laps_for_driver(d)
        fastest = min((l.lap_time_seconds for l in laps if l.lap_time_seconds), default=None)

        # Derive pit stops from stint transitions
        # Each pit stop is the transition from one stint to the next
        stint_based_pits = []
        for i in range(len(stints) - 1):
            stint_based_pits.append({
                "lap": stints[i].lap_end,
                "from": stints[i].compound.value,
                "to": stints[i + 1].compound.value,
            })

        drivers_data.append({
            "driver": d,
            "finish_position": finish_positions.get(d, 99),
            "fastest_lap": round(fastest, 3) if fastest else None,
            "stints": [
                {
                    "stint": s.stint_number,
                    "compound": s.compound.value,
                    "laps": f"{s.lap_start}–{s.lap_end}",
                    "lap_start": s.lap_start,
                    "lap_end": s.lap_end,
                    "total_laps": s.total_laps,
                    "avg_lap_time": s.avg_lap_time,
                    "degradation_rate_per_lap": s.degradation_rate,
                }
                for s in stints
            ],
            "pit_stops": stint_based_pits,
            "start_compound": stints[0].compound.value if stints else "MEDIUM",
        })

    drivers_data.sort(key=lambda x: x["finish_position"])

    # Build SC and VSC lap sets (union across all drivers, since these affect the whole field)
    sc_laps = set()
    vsc_laps = set()
    for d in session.drivers:
        for lap in session.laps_for_driver(d):
            if lap.is_safety_car:
                sc_laps.add(lap.lap_number)
            elif lap.is_vsc:
                vsc_laps.add(lap.lap_number)

    def _to_ranges(laps: set[int]) -> list[dict]:
        """Convert a set of lap numbers into contiguous ranges for cleaner UI rendering."""
        if not laps:
            return []
        sorted_laps = sorted(laps)
        ranges = []
        start = prev = sorted_laps[0]
        for lap in sorted_laps[1:]:
            if lap == prev + 1:
                prev = lap
            else:
                ranges.append({"start": start, "end": prev})
                start = prev = lap
        ranges.append({"start": start, "end": prev})
        return ranges

    return {
        "race": session.race_name,
        "year": session.year,
        "round_number": session.round_number,
        "total_laps": session.total_laps,
        "drivers": drivers_data,
        "safety_car_ranges": _to_ranges(sc_laps),
        "vsc_ranges": _to_ranges(vsc_laps),
    }


@app.get("/compare/{year}/{round_number}/{driver_a}/{driver_b}")
def compare_drivers(year: int, round_number: int, driver_a: str, driver_b: str):
    """
    Head-to-head lap-by-lap comparison between two drivers in the same race.
    Returns cumulative time delta at each lap (positive = driver_a is behind).
    """
    session = load_race(year, round_number)
    da = driver_a.upper()
    db = driver_b.upper()

    laps_a = session.laps_for_driver(da)
    laps_b = session.laps_for_driver(db)
    if not laps_a or not laps_b:
        raise HTTPException(404, f"Driver data not found for {da} or {db}")

    # Build per-lap data
    by_lap_a = {l.lap_number: l for l in laps_a}
    by_lap_b = {l.lap_number: l for l in laps_b}

    cum_a, cum_b = 0.0, 0.0
    lap_comparison = []
    max_lap = max(max(by_lap_a.keys()), max(by_lap_b.keys()))

    for lap in range(1, max_lap + 1):
        la = by_lap_a.get(lap)
        lb = by_lap_b.get(lap)
        ta = la.lap_time_seconds if la and la.lap_time_seconds else None
        tb = lb.lap_time_seconds if lb and lb.lap_time_seconds else None
        if ta:
            cum_a += ta
        if tb:
            cum_b += tb
        lap_comparison.append({
            "lap": lap,
            "lap_time_a": round(ta, 3) if ta else None,
            "lap_time_b": round(tb, 3) if tb else None,
            "delta_lap": round((ta - tb), 3) if (ta and tb) else None,
            "cum_delta": round(cum_a - cum_b, 2) if (ta and tb) else None,
            "compound_a": la.compound.value if la else None,
            "compound_b": lb.compound.value if lb else None,
        })

    # Final positions and total times
    def driver_summary(d, laps):
        valid = [l for l in laps if l.lap_time_seconds]
        total = sum(l.lap_time_seconds for l in valid)
        final_pos = None
        for lap in reversed(laps):
            if lap.position:
                final_pos = lap.position
                break
        stints = session.stints_for_driver(d)
        strategy = " → ".join(f"{s.compound.value[0]}({s.lap_start}-{s.lap_end})" for s in stints)
        return {
            "driver": d,
            "total_time": round(total, 2),
            "final_position": final_pos,
            "strategy": strategy,
            "pit_count": max(0, len(stints) - 1),
        }

    summary_a = driver_summary(da, laps_a)
    summary_b = driver_summary(db, laps_b)
    final_gap = round(summary_a["total_time"] - summary_b["total_time"], 2)

    # Key moments: biggest single-lap deltas
    valid_laps = [l for l in lap_comparison if l.get("delta_lap") is not None]
    key_moments = sorted(valid_laps, key=lambda x: abs(x["delta_lap"]), reverse=True)[:5]

    return {
        "race": session.race_name,
        "year": session.year,
        "round_number": session.round_number,
        "total_laps": session.total_laps,
        "driver_a": summary_a,
        "driver_b": summary_b,
        "final_gap": final_gap,
        "lap_comparison": lap_comparison,
        "key_moments": key_moments,
    }


class PitStopRequest(BaseModel):
    lap: int
    compound: str


class SimRequest(BaseModel):
    year: int
    round_number: int
    driver: str
    start_compound: str
    pit_stops: list[PitStopRequest]


@app.post("/simulate")
def simulate(req: SimRequest):
    try:
        session = load_race(req.year, req.round_number)
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))

    try:
        cf = CounterfactualRequest(
            year=req.year,
            round_number=req.round_number,
            driver=req.driver.upper(),
            start_compound=req.start_compound.upper(),
            pit_stops=[
                PitStop(lap=p.lap, compound=p.compound.upper())
                for p in req.pit_stops
            ],
        )
        result = simulate_counterfactual(cf, _model, _encoder)
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(400, str(e))

    # Use the new lap-by-lap position simulator
    actual_pos = result.actual_finish_position or 99
    race_pos = compute_race_position(
        session, req.driver.upper(), result.lap_comparisons, session.total_laps,
        total_delta=result.total_delta,
    )

    return {
        "driver": result.driver,
        "race": result.race_name,
        "year": result.year,
        "actual_strategy": result.actual_strategy,
        "simulated_strategy": result.simulated_strategy,
        "actual_pit_stops": result.actual_pit_stops,
        "actual_start_compound": result.actual_start_compound,
        "total_delta_seconds": result.total_delta,
        "direction": "faster" if result.total_delta < 0 else "slower" if result.total_delta > 0 else "identical",
        "actual_position": actual_pos,
        "simulated_position": race_pos.final_position,
        "position_change": race_pos.message,
        "gap_to_leader": race_pos.final_gap_to_leader,
        "drivers_ahead": [{"driver": d, "gap": g} for d, g in race_pos.drivers_ahead],
        "drivers_behind": [{"driver": d, "gap": g} for d, g in race_pos.drivers_behind],
        "standings": race_pos.standings,
        "summary": result.summary,
        "tyre_warnings": [
            {
                "stint": w.stint_number,
                "compound": w.compound,
                "actual_laps": w.actual_laps,
                "recommended_min": w.recommended_min,
                "recommended_max": w.recommended_max,
                "severity": w.severity,
                "message": w.message,
            }
            for w in result.tyre_warnings
        ],
        "key_laps": [
            {
                "lap": l.lap_number,
                "actual": l.actual_time,
                "simulated": l.simulated_time,
                "delta": l.delta,
            }
            for l in sorted(result.lap_comparisons, key=lambda x: abs(x.delta), reverse=True)[:5]
            if abs(l.delta) > 0.05
        ],
    }


class ChatRequest(BaseModel):
    session_id: str
    message: str


@app.post("/chat")
async def chat(req: ChatRequest):
    from backend.mcp.granite import chat as granite_chat
    history = _sessions.get(req.session_id, [])
    try:
        response, updated = await granite_chat(req.message, history)
        _sessions[req.session_id] = updated[-20:]
        return {"response": response, "session_id": req.session_id}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(500, str(e))


@app.get("/health")
def health():
    return {"status": "ok", "model": "loaded"}


class MultiSimRequest(BaseModel):
    year: int
    round_number: int
    drivers: list[SimRequest]


@app.post("/simulate_multi")
def simulate_multi(req: MultiSimRequest):
    """
    Run multiple counterfactual simulations in parallel for different drivers.
    Returns a list of results — useful for comparing strategies side-by-side.
    """
    try:
        session = load_race(req.year, req.round_number)
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))

    results = []
    for sim_req in req.drivers:
        try:
            cf = CounterfactualRequest(
                year=sim_req.year,
                round_number=sim_req.round_number,
                driver=sim_req.driver.upper(),
                start_compound=sim_req.start_compound.upper(),
                pit_stops=[
                    PitStop(lap=p.lap, compound=p.compound.upper())
                    for p in sim_req.pit_stops
                ],
            )
            result = simulate_counterfactual(cf, _model, _encoder)
            race_pos = compute_race_position(
                session, sim_req.driver.upper(), result.lap_comparisons,
                session.total_laps, total_delta=result.total_delta,
            )

            results.append({
                "driver": result.driver,
                "actual_strategy": result.actual_strategy,
                "simulated_strategy": result.simulated_strategy,
                "total_delta_seconds": result.total_delta,
                "actual_position": result.actual_finish_position or 99,
                "simulated_position": race_pos.final_position,
                "position_change": race_pos.message,
                "actual_total_time": result.actual_total_time,
                "simulated_total_time": result.simulated_total_time,
                "summary": result.summary,
            })
        except Exception as e:
            results.append({
                "driver": sim_req.driver,
                "error": str(e),
            })

    return {
        "race": session.race_name,
        "year": session.year,
        "round_number": session.round_number,
        "results": results,
    }


@app.get("/model_metrics")
def model_metrics():
    """Return saved model evaluation metrics."""
    import json
    from pathlib import Path
    from backend.ml.features import MODEL_DIR

    metrics_path = MODEL_DIR / "model_metrics.json"
    if not metrics_path.exists():
        raise HTTPException(
            404,
            "Model metrics not computed yet. Run: python -m backend.ml.evaluate"
        )

    with open(metrics_path) as f:
        return json.load(f)
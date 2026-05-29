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
            "pit_stops": [
                {"lap": p.lap_number, "from": p.compound_out.value, "to": p.compound_in.value}
                for p in pits
                if p.compound_out.value != p.compound_in.value  # skip phantom pits (same compound)
            ],
            "start_compound": stints[0].compound.value if stints else "MEDIUM",
        })

    drivers_data.sort(key=lambda x: x["finish_position"])
    return {
        "race": session.race_name,
        "year": session.year,
        "round_number": session.round_number,
        "total_laps": session.total_laps,
        "drivers": drivers_data,
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
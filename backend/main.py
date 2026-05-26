"""
main.py - FastAPI server connecting React frontend to ML engine and Granite.
Run with: uvicorn backend.main:app --reload --port 8000
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from backend.parser import load_race, list_available_races
from backend.ml.degradation import load_model
from backend.ml.simulator import simulate_counterfactual, CounterfactualRequest

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
            ],
        })

    drivers_data.sort(key=lambda x: x["finish_position"])
    return {
        "race": session.race_name,
        "year": session.year,
        "round_number": session.round_number,
        "total_laps": session.total_laps,
        "drivers": drivers_data,
    }


class SimRequest(BaseModel):
    year: int
    round_number: int
    driver: str
    alt_pit_lap: int
    alt_compound: str
    modify_stint: int = 2


def _estimate_position_impact(
    session,
    driver: str,
    total_delta: float,
    actual_position: int,
) -> tuple[int, str]:
    """
    Estimate simulated position using actual race gaps.
    Uses the gap between drivers at the end of the race.
    A delta of -X means the driver was X seconds faster.
    We check if that's enough to beat the car ahead or get beaten by car behind.
    """
    if total_delta == 0:
        return actual_position, f"Stays P{actual_position} — identical strategy"

    # Build finish time map using cumulative lap times for comparison
    driver_totals = {}
    for d in session.drivers:
        laps = session.laps_for_driver(d)
        total = sum(
            l.lap_time_seconds for l in laps
            if l.lap_time_seconds and not l.is_pit_in_lap and not l.is_pit_out_lap
        )
        if total > 0:
            driver_totals[d] = total

    if driver not in driver_totals:
        return actual_position, f"Stays P{actual_position} — insufficient data"

    driver_time = driver_totals[driver]
    sim_time = driver_time + total_delta

    # Build position → driver → time map
    finish_positions = {}
    for d in session.drivers:
        laps = session.laps_for_driver(d)
        for lap in reversed(laps):
            if lap.position is not None:
                finish_positions[d] = lap.position
                break

    # Find gaps to cars immediately ahead and behind
    cars_ahead = {
        d: driver_totals[d]
        for d, p in finish_positions.items()
        if p is not None and p < actual_position and d in driver_totals
    }
    cars_behind = {
        d: driver_totals[d]
        for d, p in finish_positions.items()
        if p is not None and p > actual_position and d in driver_totals
    }

    sim_pos = actual_position

    if total_delta < 0:
        # Driver got faster — can overtake cars ahead
        for d, t in sorted(cars_ahead.items(), key=lambda x: x[1], reverse=True):
            gap = t - driver_time  # positive = car ahead is faster by this much
            if gap > 0 and abs(total_delta) > gap:
                # Sim time is now faster than this car
                sim_pos = finish_positions[d]
                break
        # Clamp
        sim_pos = max(1, sim_pos)

    else:
        # Driver got slower — can be overtaken by cars behind
        for d, t in sorted(cars_behind.items(), key=lambda x: x[1]):
            gap = driver_time - t  # positive = car behind is slower by this much
            if gap > 0 and total_delta > gap:
                # Sim time is now slower than this car
                sim_pos = finish_positions[d]
                break
        sim_pos = min(20, sim_pos)

    # Build message
    if sim_pos < actual_position:
        positions_gained = actual_position - sim_pos
        # Find who was overtaken
        overtaken = [
            d for d, p in finish_positions.items()
            if p is not None and sim_pos <= p < actual_position
        ]
        overtaken_str = f" (overtook {', '.join(overtaken[:2])})" if overtaken else ""
        message = f"P{actual_position} → P{sim_pos} ✅ Gained {positions_gained} position(s){overtaken_str}"

    elif sim_pos > actual_position:
        positions_lost = sim_pos - actual_position
        # Find who overtook
        lost_to = [
            d for d, p in finish_positions.items()
            if p is not None and actual_position < p <= sim_pos
        ]
        lost_str = f" (lost to {', '.join(lost_to[:2])})" if lost_to else ""
        message = f"P{actual_position} → P{sim_pos} ❌ Lost {positions_lost} position(s){lost_str}"

    else:
        # No position change — show gap context
        if total_delta < 0 and cars_ahead:
            closest_ahead = min(cars_ahead.items(), key=lambda x: x[1] - driver_time)
            gap_to_ahead = closest_ahead[1] - driver_time
            message = (
                f"Stays P{actual_position} — saved {abs(total_delta):.1f}s but "
                f"{gap_to_ahead:.1f}s gap to P{actual_position-1} {closest_ahead[0]}"
            )
        elif total_delta > 0 and cars_behind:
            closest_behind = max(cars_behind.items(), key=lambda x: x[1])
            gap_to_behind = driver_time - closest_behind[1]
            message = (
                f"Stays P{actual_position} — lost {abs(total_delta):.1f}s but "
                f"{gap_to_behind:.1f}s buffer to P{actual_position+1} {closest_behind[0]}"
            )
        else:
            message = f"Stays P{actual_position}"

    return sim_pos, message


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
            alt_pit_lap=req.alt_pit_lap,
            alt_compound=req.alt_compound.upper(),
            modify_stint=req.modify_stint,
        )
        result = simulate_counterfactual(cf, _model, _encoder)
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(400, str(e))

    actual_pos = result.actual_finish_position or 99
    sim_pos, position_change = _estimate_position_impact(
        session, req.driver.upper(), result.total_delta, actual_pos
    )

    return {
        "driver": result.driver,
        "race": result.race_name,
        "year": result.year,
        "actual_strategy": result.actual_strategy,
        "simulated_strategy": result.simulated_strategy,
        "total_delta_seconds": result.total_delta,
        "direction": "faster" if result.total_delta < 0 else "slower",
        "actual_position": actual_pos,
        "simulated_position": sim_pos,
        "position_change": position_change,
        "summary": result.summary,
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
"""
server.py
FastMCP server exposing 4 PitStrat AI tools.
Context Forge registers this server and proxies Granite's tool calls to it.

Run standalone for testing:
    python -m backend.mcp.server

Or via Context Forge gateway (see README).
"""

import json
from mcp.server.fastmcp import FastMCP
from backend.ml.degradation import load_model, predict_stint_curve, degradation_rate
from backend.ml.optimizer import optimize_pit_window, multi_car_strategy_impact, DriverState
from backend.ml.simulator import simulate_counterfactual, CounterfactualRequest, PitStop
from backend.parser import load_race, list_available_races

# ── Load ML model once at startup ────────────────────────────────────
print("Loading ML model...")
_model, _encoder = load_model()
print("Model ready.")

mcp = FastMCP("pitstrat-ai", port=8001)


# ════════════════════════════════════════════════════════════════════
# TOOL 1 — get_race_data
# ════════════════════════════════════════════════════════════════════
@mcp.tool()
async def get_race_data(
    year: int,
    round_number: int,
    driver: str | None = None,
) -> str:
    """
    Get lap times, tire stints, pit stops and positions for a race.
    Use this when a fan asks: 'What happened in X race?',
    'When did VER pit?', 'What tires did LEC use?'

    Args:
        year: Season year (2022-2025)
        round_number: Round number in the season
        driver: 3-letter driver code (e.g. VER, LEC, HAM). If None, returns all drivers.
    """
    try:
        session = load_race(year, round_number)
    except FileNotFoundError as e:
        return json.dumps({"error": str(e)})

    if driver:
        driver = driver.upper()
        stints = session.stints_for_driver(driver)
        pits = session.pit_stops_for_driver(driver)
        laps = session.laps_for_driver(driver)

        if not laps:
            return json.dumps({"error": f"No data for driver {driver} in {session.race_name} {year}"})

        return json.dumps({
            "race": session.race_name,
            "year": year,
            "driver": driver,
            "total_laps": session.total_laps,
            "stints": [
                {
                    "stint": s.stint_number,
                    "compound": s.compound.value,
                    "laps": f"{s.lap_start}–{s.lap_end}",
                    "total_laps": s.total_laps,
                    "avg_lap_time": s.avg_lap_time,
                    "degradation_rate_per_lap": s.degradation_rate,
                }
                for s in stints
            ],
            "pit_stops": [
                {
                    "lap": p.lap_number,
                    "from": p.compound_out.value,
                    "to": p.compound_in.value,
                    "duration_seconds": p.pit_duration_seconds,
                }
                for p in pits
            ],
            "fastest_lap": min(
                (l.lap_time_seconds for l in laps if l.lap_time_seconds),
                default=None
            ),
            "finish_position": laps[-1].position if laps else None,
        })

    else:
        # Return summary for all drivers
        summary = []
        for d in session.drivers:
            stints = session.stints_for_driver(d)
            pits = session.pit_stops_for_driver(d)
            strategy = " → ".join(
                f"{s.compound.value[0]}({s.lap_start}–{s.lap_end})"
                for s in stints
            )
            summary.append({
                "driver": d,
                "strategy": strategy,
                "pit_count": len(pits),
            })

        return json.dumps({
            "race": session.race_name,
            "year": year,
            "total_laps": session.total_laps,
            "drivers": summary,
        })


# ════════════════════════════════════════════════════════════════════
# TOOL 2 — simulate_strategy
# ════════════════════════════════════════════════════════════════════
@mcp.tool()
async def simulate_strategy(
    year: int,
    round_number: int,
    driver: str,
    alt_pit_lap: int,
    alt_compound: str,
    modify_stint: int = 2,
) -> str:
    """
    Simulate a counterfactual pit strategy and compare to what actually happened.
    Use this when a fan asks: 'What if VER pitted earlier?',
    'Would LEC have won if he stayed out longer?',
    'What if they put on softs instead of mediums?'

    Args:
        year: Season year
        round_number: Round number
        driver: 3-letter driver code (e.g. VER)
        alt_pit_lap: The lap to pit in the simulation (replaces one of the actual pits)
        alt_compound: Tyre compound to fit (SOFT, MEDIUM, HARD)
        modify_stint: Which pit stop to change (default 2 = second stint, i.e. the pit
                      between stint 2 and stint 3 → modify_stint - 1 = 1 = first pit)
    """
    from backend.parser import load_race

    try:
        # Load the driver's actual strategy so we can replicate it then modify one pit
        session = load_race(year, round_number)
        actual_stints = session.stints_for_driver(driver.upper())
        if not actual_stints:
            return json.dumps({"error": f"No stint data for {driver} in {year} R{round_number}"})

        # Reconstruct actual pit stops from stints
        actual_pits = []
        for i in range(len(actual_stints) - 1):
            actual_pits.append(PitStop(
                lap=actual_stints[i].lap_end,
                compound=actual_stints[i + 1].compound.value,
            ))

        # Replace the target pit stop (modify_stint - 1 = which pit to change, 0-indexed)
        pit_idx = max(0, modify_stint - 1)
        if pit_idx < len(actual_pits):
            actual_pits[pit_idx] = PitStop(lap=alt_pit_lap, compound=alt_compound.upper())
        else:
            # If asked to modify a pit that doesn't exist, add it
            actual_pits.append(PitStop(lap=alt_pit_lap, compound=alt_compound.upper()))

        req = CounterfactualRequest(
            year=year,
            round_number=round_number,
            driver=driver.upper(),
            start_compound=actual_stints[0].compound.value,
            pit_stops=actual_pits,
        )
        result = simulate_counterfactual(req, _model, _encoder)
    except Exception as e:
        return json.dumps({"error": str(e)})

    return json.dumps({
        "race": result.race_name,
        "year": result.year,
        "driver": result.driver,
        "actual_strategy": result.actual_strategy,
        "simulated_strategy": result.simulated_strategy,
        "total_delta_seconds": result.total_delta,
        "direction": "faster" if result.total_delta < 0 else "slower",
        "finish_position": result.actual_finish_position,
        "summary": result.summary,
        "key_laps": [
            {
                "lap": l.lap_number,
                "actual": l.actual_time,
                "simulated": l.simulated_time,
                "delta": l.delta,
            }
            for l in sorted(result.lap_comparisons, key=lambda x: abs(x.delta), reverse=True)[:5]
        ],
    })


# ════════════════════════════════════════════════════════════════════
# TOOL 3 — predict_degradation
# ════════════════════════════════════════════════════════════════════
@mcp.tool()
async def predict_degradation(
    compound: str,
    circuit: str,
    year: int,
    stint_length: int = 20,
    stint_number: int = 2,
) -> str:
    """
    Predict lap-by-lap tire degradation for a compound on a circuit.
    Use this when asked: 'How fast do soft tyres degrade at Bahrain?',
    'How many laps can a medium last at Silverstone?',
    'Which tyre is better for a long stint?'

    Args:
        compound: SOFT, MEDIUM, or HARD
        circuit: Full race name (e.g. 'Bahrain Grand Prix')
        year: Season year for regulations context
        stint_length: How many laps to simulate (default 20)
        stint_number: Stint position in race (1=first, 2=second etc)
    """
    try:
        curve = predict_stint_curve(
            compound.upper(), 15, stint_length, stint_number,
            circuit, year, _model, _encoder
        )
        deg = degradation_rate(
            compound.upper(), stint_number, circuit, year, _model, _encoder
        )
    except Exception as e:
        return json.dumps({"error": str(e)})

    return json.dumps({
        "compound": compound.upper(),
        "circuit": circuit,
        "year": year,
        "degradation_rate_per_lap": deg,
        "cliff_lap": next(
            (r["tire_age_laps"] for r in curve if r["predicted_lap_time"] > curve[0]["predicted_lap_time"] + 1.5),
            None
        ),
        "stint_curve": curve,
        "summary": (
            f"{compound.upper()} tyres at {circuit} degrade at "
            f"{deg:+.3f}s per lap. "
            f"Over {stint_length} laps the total time loss is "
            f"{deg * stint_length:.1f}s compared to lap 1 pace."
        ),
    })


# ════════════════════════════════════════════════════════════════════
# TOOL 4 — get_strategy_impact
# ════════════════════════════════════════════════════════════════════
@mcp.tool()
async def get_strategy_impact(
    year: int,
    round_number: int,
    drivers: list[str],
) -> str:
    """
    Compute optimal pit windows for multiple drivers and show how their
    strategies interact — undercut/overcut conflicts, ripple effects.
    Use this when asked: 'Who should pit first, VER or NOR?',
    'Could LEC have undercut SAI?', 'What was the strategic battle between X and Y?'

    Args:
        year: Season year
        round_number: Round number
        drivers: List of 3-letter driver codes to analyse (e.g. ['VER', 'NOR', 'LEC'])
    """
    try:
        session = load_race(year, round_number)
    except FileNotFoundError as e:
        return json.dumps({"error": str(e)})

    states = []
    for d in drivers:
        d = d.upper()
        laps = session.laps_for_driver(d)
        stints = session.stints_for_driver(d)
        if not laps or not stints:
            continue

        # Use midrace snapshot (lap ~25 or current midpoint)
        mid_lap = session.total_laps // 2
        current_stint = next(
            (s for s in stints if s.lap_start <= mid_lap <= s.lap_end),
            stints[-1]
        )
        lap_data = next(
            (l for l in laps if l.lap_number == mid_lap), laps[-1]
        )

        states.append(DriverState(
            driver=d,
            current_lap=mid_lap,
            total_race_laps=session.total_laps,
            current_compound=current_stint.compound.value,
            tire_age_laps=mid_lap - current_stint.lap_start,
            current_stint=current_stint.stint_number,
            position=lap_data.position or 99,
            gap_ahead_seconds=0.0,
            gap_behind_seconds=3.0,
            circuit=session.race_name,
            year=year,
        ))

    if not states:
        return json.dumps({"error": "No valid driver data found"})

    try:
        impacts = multi_car_strategy_impact(states, _model, _encoder)
    except Exception as e:
        return json.dumps({"error": str(e)})

    return json.dumps({
        "race": session.race_name,
        "year": year,
        "analysis_lap": session.total_laps // 2,
        "strategies": impacts,
        "summary": (
            f"Strategic analysis for {', '.join(d.upper() for d in drivers)} "
            f"at {session.race_name} {year}: "
            + " | ".join(
                f"{i['driver']} optimal pit lap {i['optimal_pit_lap']} "
                f"({i['optimal_compound']})"
                for i in impacts
            )
        ),
    })


# ════════════════════════════════════════════════════════════════════
# TOOL 5 — list_races  (utility, Granite uses this to know what's available)
# ════════════════════════════════════════════════════════════════════
@mcp.tool()
async def list_races(year: int | None = None) -> str:
    """
    List all available races in the dataset.
    Use this to answer: 'What races do you have data for?',
    or to find the right round_number before calling other tools.

    Args:
        year: Filter by season year. If None, returns all years.
    """
    races = list_available_races()
    if year:
        races = [r for r in races if r["year"] == year]
    return json.dumps({"races": races, "total": len(races)})


if __name__ == "__main__":
    mcp.run(transport="streamable-http")
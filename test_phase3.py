"""
test_phase3.py
Tests MCP tools directly (no Granite credentials needed).
Run the MCP server first:
    python -m backend.mcp.server &
Then:
    python test_phase3.py
"""

import asyncio
import json
from backend.mcp.server import (
    get_race_data,
    simulate_strategy,
    predict_degradation,
    get_strategy_impact,
    list_races,
)


async def test_list_races():
    print("\n[1] list_races")
    result = await list_races(year=2023)
    data = json.loads(result)
    print(f"    2023 races available: {data['total']}")
    assert data["total"] > 0
    print("    PASSED")


async def test_get_race_data():
    print("\n[2] get_race_data — VER Bahrain 2023")
    result = await get_race_data(year=2023, round_number=1, driver="VER")
    data = json.loads(result)
    print(f"    Race: {data['race']} {data['year']}")
    print(f"    Stints: {len(data['stints'])}")
    print(f"    Pit stops: {len(data['pit_stops'])}")
    for s in data["stints"]:
        print(f"      Stint {s['stint']}: {s['compound']} laps {s['laps']}")
    assert len(data["stints"]) > 0
    print("    PASSED")


async def test_simulate_strategy():
    print("\n[3] simulate_strategy — VER what if pit lap 20 HARD")
    result = await simulate_strategy(
        year=2023, round_number=1,
        driver="VER", alt_pit_lap=20,
        alt_compound="HARD", modify_stint=2,
    )
    data = json.loads(result)
    print(f"    Actual:    {data['actual_strategy']}")
    print(f"    Simulated: {data['simulated_strategy']}")
    print(f"    Delta: {data['total_delta_seconds']:+.1f}s ({data['direction']})")
    print(f"    Summary: {data['summary'][:120]}...")
    assert "actual_strategy" in data
    assert abs(data["total_delta_seconds"]) < 120  # sanity: <2 min difference
    print("    PASSED")


async def test_predict_degradation():
    print("\n[4] predict_degradation — SOFT Bahrain 2024")
    result = await predict_degradation(
        compound="SOFT",
        circuit="Bahrain Grand Prix",
        year=2024,
        stint_length=15,
    )
    data = json.loads(result)
    print(f"    Compound: {data['compound']}")
    print(f"    Deg rate: {data['degradation_rate_per_lap']:+.4f}s/lap")
    print(f"    Cliff lap: {data['cliff_lap']}")
    print(f"    Summary: {data['summary']}")
    assert data["degradation_rate_per_lap"] > 0
    print("    PASSED")


async def test_strategy_impact():
    print("\n[5] get_strategy_impact — VER vs NOR vs LEC Bahrain 2024")
    result = await get_strategy_impact(
        year=2024, round_number=1,
        drivers=["VER", "NOR", "LEC"],
    )
    data = json.loads(result)
    print(f"    Race: {data['race']} {data['year']}")
    for s in data["strategies"]:
        print(f"    {s['driver']}: pit lap {s['optimal_pit_lap']} "
              f"on {s['optimal_compound']} | "
              f"interactions: {len(s['interactions'])}")
    assert len(data["strategies"]) > 0
    print("    PASSED")


async def main():
    print("=" * 60)
    print("PitStrat AI — Phase 3 Tests (MCP tools direct)")
    print("=" * 60)

    await test_list_races()
    await test_get_race_data()
    await test_simulate_strategy()
    await test_predict_degradation()
    await test_strategy_impact()

    print("\n" + "=" * 60)
    print("Phase 3 ALL PASSED")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
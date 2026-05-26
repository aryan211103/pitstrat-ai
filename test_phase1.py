"""
test_phase1.py
Run this after ingesting at least one session to verify Phase 1 is working.
Usage:
    python test_phase1.py
"""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backend.ingestion import ingest
from backend.parser import load_race, list_available_races
from backend.validate import validate_session


def test_ingest_and_parse():
    print("\n--- Phase 1 test ---")

    # 1. Ingest Bahrain 2023 (round 1, good clean data)
    print("Ingesting Bahrain 2023...")
    laps, pits, stints = ingest(year=2023, round_number=1)
    print(f"  Laps:      {len(laps)} records")
    print(f"  Pit stops: {len(pits)} records")
    print(f"  Stints:    {len(stints)} records")
    assert len(laps) > 0, "No laps returned"
    assert len(pits) > 0, "No pit stops returned"
    assert len(stints) > 0, "No stints returned"

    # 2. Parse back from disk
    print("Parsing from disk...")
    session = load_race(year=2023, round_number=1)
    print(f"  Race:     {session.race_name} {session.year}")
    print(f"  Drivers:  {session.drivers}")
    print(f"  Total laps: {session.total_laps}")
    assert session.race_name != ""
    assert len(session.drivers) >= 15

    # 3. Test driver-level queries (the MCP tools will use these)
    ver_laps = session.laps_for_driver("VER")
    print(f"\n  VER laps: {len(ver_laps)}")
    ver_stints = session.stints_for_driver("VER")
    print(f"  VER stints:")
    for s in ver_stints:
        print(f"    Stint {s.stint_number}: {s.compound.value} | "
              f"laps {s.lap_start}–{s.lap_end} | "
              f"deg rate: {s.degradation_rate}")

    ver_pits = session.pit_stops_for_driver("VER")
    print(f"  VER pit stops:")
    for p in ver_pits:
        print(f"    Lap {p.lap_number}: {p.compound_out.value} → {p.compound_in.value}")

    # 4. Validate
    print("\nRunning validation...")
    warnings = validate_session(session)
    if warnings:
        print(f"  Warnings ({len(warnings)}):")
        for w in warnings:
            print(f"    - {w}")
    else:
        print("  All checks passed.")

    # 5. List available races
    races = list_available_races()
    print(f"\nAvailable races on disk: {len(races)}")
    for r in races:
        print(f"  {r['year']} R{r['round_number']:02d}: {r['race_name']}")

    print("\nPhase 1 PASSED\n")


if __name__ == "__main__":
    test_ingest_and_parse()

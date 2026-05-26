"""
test_phase2.py
Verify the ML engine works end-to-end.
Run after: python -m backend.ml.train
"""

from backend.ml.degradation import load_model, predict_lap_time, predict_stint_curve
from backend.ml.optimizer import optimize_pit_window, multi_car_strategy_impact, DriverState
from backend.ml.simulator import simulate_counterfactual, CounterfactualRequest


def test_degradation_model():
    print("\n[1] Degradation model predictions")
    model, encoder = load_model()

    # Predict single lap
    t = predict_lap_time("SOFT", 5, 1, 10, "Bahrain Grand Prix", 2024, model, encoder)
    print(f"    SOFT lap 10, age 5 → {t:.3f}s")
    assert 85 < t < 120, f"Unrealistic lap time: {t}"

    # Stint curve — should show degradation over laps
    curve = predict_stint_curve("MEDIUM", 15, 20, 2, "Bahrain Grand Prix", 2024, model, encoder)
    print(f"    MEDIUM stint curve (first 5 laps):")
    for row in curve[:5]:
        print(f"      Lap {row['lap_number']} age {row['tire_age_laps']} → {row['predicted_lap_time']}s")

    times = [r["predicted_lap_time"] for r in curve]
    print(f"    Lap 1 vs Lap 20: {times[0]:.3f}s vs {times[-1]:.3f}s")
    print("    PASSED")


def test_optimizer():
    print("\n[2] Pit window optimizer")
    model, encoder = load_model()

    state = DriverState(
        driver="VER",
        current_lap=25,
        total_race_laps=57,
        current_compound="MEDIUM",
        tire_age_laps=15,
        current_stint=2,
        position=1,
        gap_ahead_seconds=0.0,
        gap_behind_seconds=3.2,
        circuit="Bahrain Grand Prix",
        year=2024,
    )

    rec = optimize_pit_window(state, model, encoder)
    print(f"    Driver: {rec.driver}")
    print(f"    Recommended pit lap: {rec.recommended_pit_lap}")
    print(f"    Recommended compound: {rec.recommended_compound}")
    print(f"    Time saved vs staying: {rec.time_saved_vs_staying:.2f}s")
    print(f"    Confidence: {rec.confidence}")
    print(f"    Reasoning: {rec.reasoning}")
    assert rec.recommended_pit_lap > 25
    assert rec.recommended_compound in ["SOFT", "MEDIUM", "HARD"]
    print("    PASSED")


def test_multi_car():
    print("\n[3] Multi-car strategy impact")
    model, encoder = load_model()

    states = [
        DriverState("VER", 25, 57, "MEDIUM", 15, 2, 1, 0.0, 1.2, "Bahrain Grand Prix", 2024),
        DriverState("NOR", 25, 57, "MEDIUM", 16, 2, 2, 1.2, 4.5, "Bahrain Grand Prix", 2024),
        DriverState("LEC", 25, 57, "HARD",   10, 2, 3, 4.5, 8.0, "Bahrain Grand Prix", 2024),
    ]

    impacts = multi_car_strategy_impact(states, model, encoder)
    for impact in impacts:
        print(f"    {impact['driver']}: pit lap {impact['optimal_pit_lap']} "
              f"on {impact['optimal_compound']} | "
              f"interactions: {len(impact['interactions'])}")
    print("    PASSED")


def test_simulator():
    print("\n[4] Counterfactual simulator")
    model, encoder = load_model()

    req = CounterfactualRequest(
        year=2023,
        round_number=1,
        driver="VER",
        alt_pit_lap=20,       # VER actually pitted lap 14 — what if he stayed out to lap 20?
        alt_compound="HARD",  # on hards instead of softs
        modify_stint=2,
    )

    result = simulate_counterfactual(req, model, encoder)
    print(f"    Race: {result.race_name} {result.year}")
    print(f"    Actual strategy:    {result.actual_strategy}")
    print(f"    Simulated strategy: {result.simulated_strategy}")
    print(f"    Total delta: {result.total_delta:+.1f}s "
          f"({'faster' if result.total_delta < 0 else 'slower'} in simulation)")
    print(f"    Summary: {result.summary}")
    print("    PASSED")


if __name__ == "__main__":
    print("=" * 60)
    print("PitStrat AI — Phase 2 Tests")
    print("=" * 60)

    test_degradation_model()
    test_optimizer()
    test_multi_car()
    test_simulator()

    print("\n" + "=" * 60)
    print("Phase 2 ALL PASSED")
    print("=" * 60)
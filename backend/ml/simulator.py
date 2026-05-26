"""
simulator.py
Counterfactual engine — compares two strategies using the same ML model
for both actual and simulated paths, so the delta is pure strategy effect.
"""

from dataclasses import dataclass
from xgboost import XGBRegressor
from sklearn.preprocessing import LabelEncoder

from backend.ml.degradation import predict_lap_time
from backend.parser import load_race

PIT_STOP_LOSS = 22.0


@dataclass
class ActualStint:
    compound: str
    lap_start: int
    lap_end: int


@dataclass
class CounterfactualRequest:
    year: int
    round_number: int
    driver: str
    alt_pit_lap: int
    alt_compound: str
    modify_stint: int = 2


@dataclass
class LapComparison:
    lap_number: int
    actual_time: float | None
    predicted_actual: float
    simulated_time: float
    delta: float  # simulated - predicted_actual


@dataclass
class SimulationResult:
    driver: str
    race_name: str
    year: int
    actual_finish_position: int | None
    actual_total_time: float
    simulated_total_time: float
    total_delta: float
    lap_comparisons: list[LapComparison]
    actual_strategy: str
    simulated_strategy: str
    summary: str


def _format_strategy(stints: list[ActualStint]) -> str:
    return " → ".join(f"{s.compound[0]}({s.lap_start}–{s.lap_end})" for s in stints)


def _find_actual_pit_lap(actual_stints: list[ActualStint], modify_stint: int) -> int | None:
    """
    The actual pit lap is the last lap of the stint being modified.
    e.g. if stint 2 runs laps 15-36, the pit happened at lap 36.
    """
    idx = modify_stint - 1
    if idx < len(actual_stints):
        return actual_stints[idx].lap_end
    return None


def simulate_counterfactual(
    request: CounterfactualRequest,
    model: XGBRegressor,
    encoder: LabelEncoder,
) -> SimulationResult:
    session = load_race(request.year, request.round_number)
    circuit = session.race_name
    total_laps = session.total_laps

    driver_laps = session.laps_for_driver(request.driver)
    driver_stints = session.stints_for_driver(request.driver)

    if not driver_laps:
        raise ValueError(f"No lap data for driver {request.driver}")

    actual_stints = [
        ActualStint(s.compound.value, s.lap_start, s.lap_end)
        for s in driver_stints
    ]

    actual_times = {
        l.lap_number: l.lap_time_seconds
        for l in driver_laps
        if l.lap_time_seconds is not None
        and not l.is_pit_in_lap
        and not l.is_pit_out_lap
    }

    modified_idx = request.modify_stint - 1

    # Guard: if alt_pit_lap is same as actual pit lap AND compound is same → return zero delta
    actual_pit_lap = _find_actual_pit_lap(actual_stints, request.modify_stint)
    actual_next_compound = actual_stints[modified_idx + 1].compound if modified_idx + 1 < len(actual_stints) else None

    is_same_strategy = (
        actual_pit_lap is not None and
        request.alt_pit_lap == actual_pit_lap and
        request.alt_compound == actual_next_compound
    )

    # ── Build simulated stints ────────────────────────────────────
    sim_stints: list[ActualStint] = []
    for i, stint in enumerate(actual_stints):
        if i < modified_idx:
            sim_stints.append(stint)
        elif i == modified_idx:
            new_end = min(request.alt_pit_lap - 1, stint.lap_end)
            if new_end >= stint.lap_start:
                sim_stints.append(ActualStint(stint.compound, stint.lap_start, new_end))
            sim_stints.append(ActualStint(request.alt_compound, request.alt_pit_lap, total_laps))
            break

    actual_str = _format_strategy(actual_stints)
    sim_str = _format_strategy(sim_stints)

    # ── If same strategy, return near-zero result ─────────────────
    if is_same_strategy:
        lap_comparisons = [
            LapComparison(
                lap_number=l,
                actual_time=actual_times.get(l),
                predicted_actual=actual_times.get(l) or 95.0,
                simulated_time=actual_times.get(l) or 95.0,
                delta=0.0,
            )
            for l in range(1, total_laps + 1)
        ]
        total_time = sum(t for t in actual_times.values())
        return SimulationResult(
            driver=request.driver,
            race_name=session.race_name,
            year=request.year,
            actual_finish_position=driver_laps[-1].position,
            actual_total_time=round(total_time, 3),
            simulated_total_time=round(total_time, 3),
            total_delta=0.0,
            lap_comparisons=lap_comparisons,
            actual_strategy=actual_str,
            simulated_strategy=sim_str,
            summary=f"This is identical to {request.driver}'s actual strategy — no change in outcome.",
        )

    # ── Compare ML predictions for BOTH strategies ────────────────
    lap_comparisons = []
    actual_ml_total = 0.0
    sim_ml_total = 0.0

    # Laps before the change point: same for both → delta = 0
    change_lap = request.alt_pit_lap

    for lap in range(1, change_lap):
        actual_time = actual_times.get(lap)
        stint_info = next((s for s in actual_stints if s.lap_start <= lap <= s.lap_end), None)
        if not stint_info:
            continue
        stint_num = actual_stints.index(stint_info) + 1
        tire_age = lap - stint_info.lap_start + 1
        pred = predict_lap_time(
            stint_info.compound, tire_age, stint_num,
            lap, circuit, request.year, model, encoder
        )
        actual_ml_total += pred
        sim_ml_total += pred
        lap_comparisons.append(LapComparison(
            lap_number=lap,
            actual_time=actual_time,
            predicted_actual=round(pred, 3),
            simulated_time=round(pred, 3),
            delta=0.0,
        ))

    # Add pit stop loss at the simulated pit lap
    sim_ml_total += PIT_STOP_LOSS

    # Add actual pit stop loss at the actual pit lap (only for laps after change_lap)
    actual_pit_laps_after = [
        s.lap_start for s in actual_stints
        if s.lap_start >= change_lap and actual_stints.index(s) > 0
    ]

    new_stint_num = modified_idx + 2  # 1-indexed

    for lap in range(change_lap, total_laps + 1):
        actual_time = actual_times.get(lap)

        # Actual strategy prediction
        actual_stint = next(
            (s for s in actual_stints if s.lap_start <= lap <= s.lap_end), None
        )
        if actual_stint:
            actual_stint_num = actual_stints.index(actual_stint) + 1
            actual_tire_age = lap - actual_stint.lap_start + 1
            actual_pred = predict_lap_time(
                actual_stint.compound, actual_tire_age, actual_stint_num,
                lap, circuit, request.year, model, encoder
            )
        else:
            actual_pred = actual_time or 95.0

        # Add actual pit stop cost at actual pit laps
        if lap in actual_pit_laps_after:
            actual_ml_total += PIT_STOP_LOSS

        actual_ml_total += actual_pred

        # Simulated strategy prediction
        sim_tire_age = lap - request.alt_pit_lap + 1
        sim_pred = predict_lap_time(
            request.alt_compound, sim_tire_age, new_stint_num,
            lap, circuit, request.year, model, encoder
        )
        sim_ml_total += sim_pred

        delta = round(sim_pred - actual_pred, 3)

        lap_comparisons.append(LapComparison(
            lap_number=lap,
            actual_time=actual_time,
            predicted_actual=round(actual_pred, 3),
            simulated_time=round(sim_pred, 3),
            delta=delta,
        ))

    total_delta = round(sim_ml_total - actual_ml_total, 3)

    finish_position = driver_laps[-1].position

    direction = "faster" if total_delta < 0 else "slower"
    abs_delta = abs(total_delta)

    changed_laps = [l for l in lap_comparisons if abs(l.delta) > 0.1]
    biggest = sorted(changed_laps, key=lambda l: abs(l.delta), reverse=True)[:3]
    biggest_str = ", ".join(f"lap {l.lap_number} ({l.delta:+.1f}s)" for l in biggest) if biggest else "minimal differences"

    summary = (
        f"If {request.driver} had pitted on lap {request.alt_pit_lap} "
        f"with {request.alt_compound} tyres instead of their actual strategy, "
        f"they would have been {abs_delta:.1f}s {direction} from lap {request.alt_pit_lap} onwards. "
        f"Actual: {actual_str} · Simulated: {sim_str}. "
        f"Key laps: {biggest_str}."
    )

    return SimulationResult(
        driver=request.driver,
        race_name=session.race_name,
        year=request.year,
        actual_finish_position=finish_position,
        actual_total_time=round(actual_ml_total, 3),
        simulated_total_time=round(sim_ml_total, 3),
        total_delta=total_delta,
        lap_comparisons=lap_comparisons,
        actual_strategy=actual_str,
        simulated_strategy=sim_str,
        summary=summary,
    )
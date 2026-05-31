"""
simulator.py
Multi-stop counterfactual simulator.
Accepts an arbitrary list of pit stops and simulates the resulting race.
"""

from dataclasses import dataclass, field
from xgboost import XGBRegressor
from sklearn.preprocessing import LabelEncoder

from backend.ml.degradation import predict_lap_time
from backend.parser import load_race

PIT_STOP_LOSS = 22.0
# Pitting under a safety car loses much less time because the field is also slow
# Real-world estimate: ~10s under SC vs ~22s under green
PIT_STOP_LOSS_SC = 10.0
# Pitting under VSC is in between (field maintains a delta, less benefit than SC)
PIT_STOP_LOSS_VSC = 14.0

# Real-world tyre life ranges (laps)
TYRE_LIFE = {
    "SOFT": (15, 25),
    "MEDIUM": (25, 40),
    "HARD": (40, 65),
    "INTERMEDIATE": (10, 30),
    "WET": (10, 30),
}


@dataclass
class PitStop:
    """A single pit stop: pit on this lap, fit this compound."""
    lap: int
    compound: str


@dataclass
class Stint:
    compound: str
    lap_start: int
    lap_end: int

    @property
    def total_laps(self) -> int:
        return self.lap_end - self.lap_start + 1


@dataclass
class CounterfactualRequest:
    year: int
    round_number: int
    driver: str
    # Starting compound (first stint)
    start_compound: str
    # List of pit stops in order
    pit_stops: list[PitStop]


@dataclass
class LapComparison:
    lap_number: int
    actual_time: float | None
    predicted_actual: float
    simulated_time: float
    delta: float


@dataclass
class TyreWarning:
    stint_number: int
    compound: str
    actual_laps: int
    recommended_min: int
    recommended_max: int
    severity: str  # "ok" | "stretched" | "extreme"
    message: str


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
    actual_pit_stops: list[dict]  # the real pit stops from the race
    actual_start_compound: str
    tyre_warnings: list[TyreWarning]
    summary: str


def _format_strategy(stints: list[Stint]) -> str:
    return " → ".join(f"{s.compound[0]}({s.lap_start}–{s.lap_end})" for s in stints)


def _build_stints_from_pits(
    start_compound: str,
    pit_stops: list[PitStop],
    total_laps: int,
) -> list[Stint]:
    """Convert start compound + list of pit stops into a list of stints."""
    stints = []
    current_compound = start_compound
    current_start = 1

    # Sort pit stops by lap
    sorted_pits = sorted(pit_stops, key=lambda p: p.lap)

    for pit in sorted_pits:
        if pit.lap <= current_start or pit.lap > total_laps:
            continue
        stints.append(Stint(
            compound=current_compound,
            lap_start=current_start,
            lap_end=pit.lap - 1,
        ))
        current_compound = pit.compound
        current_start = pit.lap

    # Final stint
    stints.append(Stint(
        compound=current_compound,
        lap_start=current_start,
        lap_end=total_laps,
    ))

    return stints


def _check_tyre_warnings(stints: list[Stint]) -> list[TyreWarning]:
    """Check each stint against real-world tyre life ranges."""
    warnings = []
    for i, stint in enumerate(stints):
        compound = stint.compound
        if compound not in TYRE_LIFE:
            continue

        min_laps, max_laps = TYRE_LIFE[compound]
        actual = stint.total_laps

        if actual <= max_laps:
            severity = "ok"
            message = f"Within normal {compound} range ({min_laps}–{max_laps} laps)"
        elif actual <= max_laps + 5:
            severity = "stretched"
            message = f"Stretched: {compound} typically lasts {min_laps}–{max_laps} laps"
        else:
            severity = "extreme"
            message = f"Unrealistic: {compound} rarely survives {actual} laps (typical: {min_laps}–{max_laps})"

        if severity != "ok":
            warnings.append(TyreWarning(
                stint_number=i + 1,
                compound=compound,
                actual_laps=actual,
                recommended_min=min_laps,
                recommended_max=max_laps,
                severity=severity,
                message=message,
            ))

    return warnings


def _get_actual_strategy(driver_stints, driver_pits) -> tuple[str, list[dict]]:
    """Extract actual start compound and pit stops from race data."""
    if not driver_stints:
        return "MEDIUM", []

    start_compound = driver_stints[0].compound.value
    pits = [
        {"lap": p.lap_number, "compound": p.compound_in.value}
        for p in sorted(driver_pits, key=lambda x: x.lap_number)
    ]
    return start_compound, pits


def simulate_counterfactual(
    request: CounterfactualRequest,
    model: XGBRegressor,
    encoder: LabelEncoder,
) -> SimulationResult:
    session = load_race(request.year, request.round_number)
    circuit = session.race_name
    total_laps = session.total_laps

    # Build set of SC/VSC laps from any driver's lap data (SC affects the whole field)
    sc_laps = set()
    vsc_laps = set()
    for d in session.drivers:
        for lap in session.laps_for_driver(d):
            if lap.is_safety_car:
                sc_laps.add(lap.lap_number)
            elif lap.is_vsc:
                vsc_laps.add(lap.lap_number)

    def _pit_loss_for_lap(lap_num: int) -> float:
        """Return pit loss for a given lap (reduced if SC/VSC active)."""
        if lap_num in sc_laps:
            return PIT_STOP_LOSS_SC
        if lap_num in vsc_laps:
            return PIT_STOP_LOSS_VSC
        return PIT_STOP_LOSS

    driver_laps = session.laps_for_driver(request.driver)
    driver_stints_real = session.stints_for_driver(request.driver)
    driver_pits_real = session.pit_stops_for_driver(request.driver)

    if not driver_laps:
        raise ValueError(f"No lap data for driver {request.driver}")

    # Build actual strategy from real data
    actual_stints = [
        Stint(s.compound.value, s.lap_start, s.lap_end)
        for s in driver_stints_real
    ]
    actual_start_compound, actual_pits_list = _get_actual_strategy(
        driver_stints_real, driver_pits_real
    )

    # Build simulated stints from request
    sim_stints = _build_stints_from_pits(
        request.start_compound,
        request.pit_stops,
        total_laps,
    )

    actual_str = _format_strategy(actual_stints)
    sim_str = _format_strategy(sim_stints)

    # Tyre warnings on simulated strategy
    tyre_warnings = _check_tyre_warnings(sim_stints)

    # Actual lap times for reference
    actual_times = {
        l.lap_number: l.lap_time_seconds
        for l in driver_laps
        if l.lap_time_seconds is not None
        and not l.is_pit_in_lap
        and not l.is_pit_out_lap
    }

    # ── Predict each lap for BOTH strategies using ML model ──
    lap_comparisons = []
    actual_ml_total = 0.0
    sim_ml_total = 0.0

    # Number of pit stops in each strategy
    actual_pit_laps = [s.lap_start for s in actual_stints[1:]]
    sim_pit_laps = [s.lap_start for s in sim_stints[1:]]

    for lap in range(1, total_laps + 1):
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
            actual_pred = 95.0

        # Add actual pit stop loss (reduced if SC/VSC active on this lap)
        if lap in actual_pit_laps:
            actual_ml_total += _pit_loss_for_lap(lap)

        actual_ml_total += actual_pred

        # Simulated strategy prediction
        sim_stint = next(
            (s for s in sim_stints if s.lap_start <= lap <= s.lap_end), None
        )
        if sim_stint:
            sim_stint_num = sim_stints.index(sim_stint) + 1
            sim_tire_age = lap - sim_stint.lap_start + 1
            sim_pred = predict_lap_time(
                sim_stint.compound, sim_tire_age, sim_stint_num,
                lap, circuit, request.year, model, encoder
            )
        else:
            sim_pred = 95.0

        # Add simulated pit stop loss (reduced if SC/VSC active on this lap)
        if lap in sim_pit_laps:
            sim_ml_total += _pit_loss_for_lap(lap)

        sim_ml_total += sim_pred

        delta = round(sim_pred - actual_pred, 3)
        lap_comparisons.append(LapComparison(
            lap_number=lap,
            actual_time=actual_times.get(lap),
            predicted_actual=round(actual_pred, 3),
            simulated_time=round(sim_pred, 3),
            delta=delta,
        ))

    total_delta = round(sim_ml_total - actual_ml_total, 3)

    # Detect if simulated = actual (or very close)
    is_same = (
        len(sim_stints) == len(actual_stints) and
        all(
            s.compound == a.compound and abs(s.lap_start - a.lap_start) <= 1
            for s, a in zip(sim_stints, actual_stints)
        )
    )
    if is_same:
        total_delta = 0.0
        for lc in lap_comparisons:
            lc.delta = 0.0

    finish_position = driver_laps[-1].position

    direction = "faster" if total_delta < 0 else "slower" if total_delta > 0 else "identical"
    abs_delta = abs(total_delta)

    if is_same:
        summary = f"This is identical to {request.driver}'s actual strategy."
    else:
        changed_laps = [l for l in lap_comparisons if abs(l.delta) > 0.1]
        biggest = sorted(changed_laps, key=lambda l: abs(l.delta), reverse=True)[:3]
        biggest_str = ", ".join(f"lap {l.lap_number} ({l.delta:+.1f}s)" for l in biggest) if biggest else "minimal differences"

        summary = (
            f"With this {len(sim_stints) - 1}-stop strategy ({sim_str}), "
            f"{request.driver} would have been {abs_delta:.1f}s {direction} overall. "
            f"Actual: {actual_str}. Key laps: {biggest_str}."
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
        actual_pit_stops=actual_pits_list,
        actual_start_compound=actual_start_compound,
        tyre_warnings=tyre_warnings,
        summary=summary,
    )
"""
optimizer.py
Given a driver's current race state, finds the optimal pit lap
that minimizes total predicted race time for the remaining laps.

Also computes multi-car strategy impact — how one car's pit
decision shifts the optimal window for cars around it.
"""

import numpy as np
from dataclasses import dataclass
from xgboost import XGBRegressor
from sklearn.preprocessing import LabelEncoder

from backend.ml.degradation import predict_lap_time, predict_stint_curve

PIT_STOP_LOSS = 22.0  # seconds lost in a standard pit stop


@dataclass
class DriverState:
    driver: str
    current_lap: int
    total_race_laps: int
    current_compound: str
    tire_age_laps: int
    current_stint: int
    position: int
    gap_ahead_seconds: float   # gap to car in front
    gap_behind_seconds: float  # gap to car behind
    circuit: str
    year: int


@dataclass
class PitRecommendation:
    driver: str
    recommended_pit_lap: int
    recommended_compound: str
    confidence: float           # 0–1
    time_saved_vs_staying: float  # seconds saved vs not pitting
    earliest_pit_lap: int
    latest_pit_lap: int
    reasoning: str


def _total_time_if_pit_on_lap(
    pit_lap: int,
    state: DriverState,
    new_compound: str,
    model: XGBRegressor,
    encoder: LabelEncoder,
) -> float:
    """
    Estimate total remaining race time if driver pits on pit_lap
    with new_compound.
    """
    total = 0.0
    laps_remaining_before_pit = pit_lap - state.current_lap

    # Current stint: laps remaining before pit
    for i in range(laps_remaining_before_pit):
        age = state.tire_age_laps + i
        lap = state.current_lap + i
        total += predict_lap_time(
            state.current_compound, age, state.current_stint,
            lap, state.circuit, state.year, model, encoder
        )

    # Add pit stop time loss
    total += PIT_STOP_LOSS

    # New stint: laps from pit to end of race
    laps_after_pit = state.total_race_laps - pit_lap
    for i in range(laps_after_pit):
        total += predict_lap_time(
            new_compound, i + 1, state.current_stint + 1,
            pit_lap + i, state.circuit, state.year, model, encoder
        )

    return total


def optimize_pit_window(
    state: DriverState,
    model: XGBRegressor,
    encoder: LabelEncoder,
    candidate_compounds: list[str] | None = None,
) -> PitRecommendation:
    """
    Brute-force search over pit laps and compounds to find minimum
    total remaining race time.
    """
    if candidate_compounds is None:
        # Default: try medium and hard (most common second stint choices)
        candidate_compounds = ["MEDIUM", "HARD"]
        if state.current_compound in ["MEDIUM", "HARD"]:
            candidate_compounds = ["SOFT", "MEDIUM", "HARD"]

    # Window: can pit between now+2 and 10 laps before end
    earliest = state.current_lap + 2
    latest = state.total_race_laps - 10
    if earliest >= latest:
        latest = state.total_race_laps - 3

    best_lap = earliest
    best_compound = candidate_compounds[0]
    best_time = float("inf")

    results = {}
    for compound in candidate_compounds:
        for pit_lap in range(earliest, latest + 1):
            t = _total_time_if_pit_on_lap(pit_lap, state, compound, model, encoder)
            results[(pit_lap, compound)] = t
            if t < best_time:
                best_time = t
                best_lap = pit_lap
                best_compound = compound

    # Time if staying out (no pit) — for comparison
    stay_time = sum(
        predict_lap_time(
            state.current_compound,
            state.tire_age_laps + i,
            state.current_stint,
            state.current_lap + i,
            state.circuit, state.year, model, encoder
        )
        for i in range(state.total_race_laps - state.current_lap)
    )

    time_saved = stay_time - best_time

    # Confidence: how much better is best vs 2nd best window
    sorted_times = sorted(results.values())
    margin = sorted_times[1] - sorted_times[0] if len(sorted_times) > 1 else 0
    confidence = min(1.0, round(margin / 2.0, 2))  # 2s margin = full confidence

    reasoning = (
        f"Pitting lap {best_lap} on {best_compound} saves ~{time_saved:.1f}s "
        f"vs staying out. Window: laps {earliest}–{latest}. "
        f"Current tires ({state.current_compound}) degrade "
        f"{'quickly' if time_saved > 5 else 'moderately'} at this stage."
    )

    return PitRecommendation(
        driver=state.driver,
        recommended_pit_lap=best_lap,
        recommended_compound=best_compound,
        confidence=confidence,
        time_saved_vs_staying=round(time_saved, 2),
        earliest_pit_lap=earliest,
        latest_pit_lap=latest,
        reasoning=reasoning,
    )


def multi_car_strategy_impact(
    states: list[DriverState],
    model: XGBRegressor,
    encoder: LabelEncoder,
) -> list[dict]:
    """
    For each driver, compute their optimal pit window independently,
    then show how each driver's pit decision shifts the others.

    Returns a list of impact dicts — the unique multi-car angle.
    """
    recommendations = {
        s.driver: optimize_pit_window(s, model, encoder)
        for s in states
    }

    impacts = []
    for state in states:
        rec = recommendations[state.driver]
        affected = []

        for other in states:
            if other.driver == state.driver:
                continue

            other_rec = recommendations[other.driver]

            # If this driver pits, does it undercut/overcut the other?
            lap_diff = rec.recommended_pit_lap - other_rec.recommended_pit_lap
            if abs(lap_diff) <= 3:
                interaction = "potential undercut conflict" if lap_diff < 0 else "overcut opportunity"
                affected.append({
                    "driver": other.driver,
                    "interaction": interaction,
                    "lap_difference": lap_diff,
                })

        impacts.append({
            "driver": state.driver,
            "optimal_pit_lap": rec.recommended_pit_lap,
            "optimal_compound": rec.recommended_compound,
            "time_saved": rec.time_saved_vs_staying,
            "confidence": rec.confidence,
            "interactions": affected,
            "reasoning": rec.reasoning,
        })

    return impacts
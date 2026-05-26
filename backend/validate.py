"""
validate.py
Run after ingestion to catch data quality issues before they
silently corrupt ML training or MCP tool responses.
"""

import logging
from backend.models import RaceSession

log = logging.getLogger(__name__)


class ValidationError(Exception):
    pass


def validate_session(session: RaceSession, strict: bool = False) -> list[str]:
    """
    Check a RaceSession for data quality issues.
    Returns a list of warning strings.
    Raises ValidationError if strict=True and any critical issue is found.
    """
    warnings = []

    # 1. Must have laps
    if not session.laps:
        _issue(warnings, "No lap records found", strict)

    # 2. Must have at least 10 drivers
    if len(session.drivers) < 10:
        _issue(warnings, f"Only {len(session.drivers)} drivers — expected 20", strict)

    # 3. Lap time sanity: no lap under 60s or over 200s
    bad_times = [
        l for l in session.laps
        if l.lap_time_seconds is not None
        and (l.lap_time_seconds < 60 or l.lap_time_seconds > 200)
        and not l.is_pit_out_lap
        and not l.is_pit_in_lap
    ]
    if bad_times:
        warnings.append(
            f"{len(bad_times)} laps with suspicious times "
            f"(e.g. {bad_times[0].driver} lap {bad_times[0].lap_number}: "
            f"{bad_times[0].lap_time_seconds:.1f}s)"
        )

    # 4. All drivers should have at least one stint
    drivers_with_stints = set(s.driver for s in session.stints)
    missing_stints = set(session.drivers) - drivers_with_stints
    if missing_stints:
        warnings.append(f"Drivers with no stints: {missing_stints}")

    # 5. All pit stops should reference a valid driver
    pit_drivers = set(p.driver for p in session.pit_stops)
    unknown_pit_drivers = pit_drivers - set(session.drivers)
    if unknown_pit_drivers:
        warnings.append(f"Pit stops reference unknown drivers: {unknown_pit_drivers}")

    # 6. Stint lap counts should be positive
    bad_stints = [s for s in session.stints if s.total_laps <= 0]
    if bad_stints:
        warnings.append(f"{len(bad_stints)} stints with zero or negative laps")

    # 7. Should have pit stop data for most drivers (DNFs may not pit)
    drivers_with_pits = set(p.driver for p in session.pit_stops)
    no_pit_count = len(set(session.drivers) - drivers_with_pits)
    if no_pit_count > 5:
        warnings.append(
            f"{no_pit_count} drivers have no pit stop recorded — "
            "pit data may be incomplete"
        )

    # 8. Check total lap count is reasonable
    if session.total_laps < 30 or session.total_laps > 80:
        warnings.append(f"Unusual total lap count: {session.total_laps}")

    # Log all warnings
    if warnings:
        for w in warnings:
            log.warning(f"[{session.race_name} {session.year}] {w}")
    else:
        log.info(f"[{session.race_name} {session.year}] Validation passed — no issues found")

    return warnings


def _issue(warnings: list, message: str, strict: bool):
    warnings.append(message)
    if strict:
        raise ValidationError(message)

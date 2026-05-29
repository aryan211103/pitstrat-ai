"""
race_simulator.py

Honest race position estimator:
1. Filter out drivers who did NOT complete the full race
   (DNFs, lapped cars by 2+ laps)
2. Among finishers, rank by total race time
3. Apply simulated delta to chosen driver
4. Recompute ranking
"""

from dataclasses import dataclass


@dataclass
class RacePosition:
    final_position: int
    final_gap_to_leader: float
    drivers_ahead: list[tuple[str, float]]
    drivers_behind: list[tuple[str, float]]
    overtaken: list[str]
    lost_to: list[str]
    message: str
    standings: list[dict]
    excluded_drivers: list[str]


def _build_finisher_data(session, total_laps: int) -> dict:
    """
    Return dict[driver] = {position, total_time, laps_completed}
    A driver is considered a finisher if they completed close to the full race distance.
    Some valid laps may have missing lap_time data (formation, SC, red flag restarts),
    so we check total laps completed, not just timed laps.
    """
    data = {}
    excluded = []
    min_total_laps = total_laps - 1  # must have entered last lap (allow being lapped once)
    min_timed_fraction = 0.85  # at least 85% of laps must have valid timing

    for d in session.drivers:
        laps = session.laps_for_driver(d)
        if not laps:
            excluded.append(d)
            continue

        # Must have entered the final lap
        if len(laps) < min_total_laps:
            excluded.append(d)
            continue

        valid_laps = [l for l in laps if l.lap_time_seconds is not None]

        # Most laps should be timed (avoid drivers with mostly missing data)
        if len(valid_laps) < int(total_laps * min_timed_fraction):
            excluded.append(d)
            continue

        # Get final position
        position = None
        for lap in reversed(laps):
            if lap.position is not None:
                position = lap.position
                break

        if not position:
            excluded.append(d)
            continue

        total = sum(l.lap_time_seconds for l in valid_laps)
        if total > 0:
            data[d] = {
                "position": position,
                "total_time": total,
                "laps_completed": len(valid_laps),
            }
        else:
            excluded.append(d)

    return data, excluded


def compute_race_position(session, driver: str, lap_comparisons, total_laps: int, total_delta: float = None) -> RacePosition:
    finish_data, excluded = _build_finisher_data(session, total_laps)

    if driver not in finish_data:
        return RacePosition(
            99, 0, [], [], [], [],
            f"{driver} did not complete the full race",
            [], excluded,
        )

    actual_position = finish_data[driver]["position"]
    actual_time = finish_data[driver]["total_time"]
    # Use provided total_delta if given (includes pit loss difference);
    # otherwise fall back to summing lap deltas
    if total_delta is None:
        total_delta = sum(lc.delta for lc in lap_comparisons)
    sim_time = actual_time + total_delta

    # IMPORTANT: cumulative lap times don't perfectly match race finish order
    # (formation laps, missing data, lapped cars affect this). We anchor to
    # actual race positions and only flip neighbors based on the delta.
    #
    # Strategy:
    # 1. Sort drivers by their ACTUAL finish position
    # 2. Compute gaps between consecutive drivers using their cumulative times
    #    (this gives us approximate intervals between cars on track)
    # 3. Apply the delta to the simulated driver only
    # 4. Re-rank based on whether the delta crosses neighbor gaps

    # Sort by actual finish position
    sorted_by_pos = sorted(finish_data.items(), key=lambda x: x[1]["position"])

    # Build a position-anchored time grid where each driver's "race time" is
    # consistent with their actual position
    # Use the position-ordered drivers' total times to derive race intervals
    # If cumulative time order conflicts with actual position, trust position
    pos_to_time = {}
    base_time = None
    for d, info in sorted_by_pos:
        t = info["total_time"]
        if base_time is None:
            base_time = t
            pos_to_time[d] = t
        else:
            # Keep monotonically increasing — if a later-finishing driver has
            # smaller cumulative time, bump them by 0.1s above the previous
            prev_max = max(pos_to_time.values())
            pos_to_time[d] = max(t, prev_max + 0.1)

    # Now apply delta to simulated driver
    sim_time = pos_to_time[driver] + total_delta

    # Build standings
    standings_raw = []
    for d, info in finish_data.items():
        t = sim_time if d == driver else pos_to_time[d]
        standings_raw.append((d, t, d == driver))

    # Sort by time
    standings_raw.sort(key=lambda x: x[1])

    # Renumber positions among finishers only (1, 2, 3...)
    leader_time = standings_raw[0][1]
    standings = [
        {
            "position": i,
            "driver": d,
            "total_time": round(t, 2),
            "gap_to_leader": round(t - leader_time, 2),
            "is_simulated": is_sim,
        }
        for i, (d, t, is_sim) in enumerate(standings_raw, 1)
    ]

    sim_position = next(s["position"] for s in standings if s["is_simulated"])
    gap_to_leader = sim_time - leader_time

    # Detect overtakes by comparing actual and simulated positions
    overtaken = []
    lost_to = []
    for s in standings:
        d = s["driver"]
        if d == driver:
            continue
        actual_pos_other = finish_data[d]["position"]
        sim_pos_other = s["position"]

        # Did simulated driver gain ground on this car?
        if actual_pos_other < actual_position and sim_pos_other > sim_position:
            overtaken.append(d)
        elif actual_pos_other > actual_position and sim_pos_other < sim_position:
            lost_to.append(d)

    # Drivers immediately ahead and behind in simulated standings
    drivers_ahead = []
    drivers_behind = []
    for s in standings:
        if s["driver"] == driver:
            continue
        gap = s["total_time"] - sim_time
        if s["position"] < sim_position and s["position"] >= sim_position - 3:
            drivers_ahead.append((s["driver"], round(abs(gap), 2)))
        elif s["position"] > sim_position and s["position"] <= sim_position + 3:
            drivers_behind.append((s["driver"], round(gap, 2)))

    # Build message
    if sim_position < actual_position:
        gained = actual_position - sim_position
        ot_str = f" (overtook {', '.join(overtaken[:3])})" if overtaken else ""
        message = f"P{actual_position} → P{sim_position} ✅ Gained {gained} position(s){ot_str}"
    elif sim_position > actual_position:
        lost = sim_position - actual_position
        lt_str = f" (passed by {', '.join(lost_to[:3])})" if lost_to else ""
        message = f"P{actual_position} → P{sim_position} ❌ Lost {lost} position(s){lt_str}"
    else:
        if drivers_ahead:
            d_a, gap = drivers_ahead[-1]
            message = f"Stays P{sim_position} — {gap:.1f}s behind P{sim_position-1} {d_a}"
        elif drivers_behind:
            d_b, gap = drivers_behind[0]
            message = f"Stays P{sim_position} — {gap:.1f}s ahead of P{sim_position+1} {d_b}"
        else:
            message = f"Stays P{sim_position}"

    return RacePosition(
        final_position=sim_position,
        final_gap_to_leader=round(gap_to_leader, 2),
        drivers_ahead=drivers_ahead,
        drivers_behind=drivers_behind,
        overtaken=overtaken,
        lost_to=lost_to,
        message=message,
        standings=standings,
        excluded_drivers=excluded,
    )
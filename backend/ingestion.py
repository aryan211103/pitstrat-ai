"""
ingestion.py
Loads F1 race sessions via FastF1 and saves cleaned parquet files to data/processed/.
Usage:
    python -m backend.ingestion --year 2023 --round 1
    python -m backend.ingestion --year 2023  # loads all rounds for a year
"""

import fastf1
import pandas as pd
import numpy as np
import os
import argparse
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(levelname)s  %(message)s")
log = logging.getLogger(__name__)

CACHE_DIR = Path("data/cache")
PROCESSED_DIR = Path("data/processed")
CACHE_DIR.mkdir(parents=True, exist_ok=True)
PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

fastf1.Cache.enable_cache(str(CACHE_DIR))


def load_session(year: int, round_number: int) -> fastf1.core.Session:
    """Load a race session from FastF1 (cached after first fetch)."""
    log.info(f"Loading session: {year} round {round_number}")
    session = fastf1.get_session(year, round_number, "R")
    session.load(telemetry=False, weather=True, messages=False)
    log.info(f"Loaded: {session.event['EventName']} — {len(session.laps)} laps total")
    return session


def extract_laps(session: fastf1.core.Session) -> pd.DataFrame:
    """Extract per-lap data with tire and position info."""
    laps = session.laps.copy()

    # Rename for consistency
    laps = laps.rename(columns={
        "Driver": "driver",
        "DriverNumber": "driver_number",
        "LapNumber": "lap_number",
        "LapTime": "lap_time",
        "IsPersonalBest": "is_personal_best",
        "Compound": "compound",
        "TyreLife": "tire_age_laps",
        "Stint": "stint_number",
        "Position": "position",
        "Sector1Time": "sector1",
        "Sector2Time": "sector2",
        "Sector3Time": "sector3",
        "PitOutTime": "pit_out_time",
        "PitInTime": "pit_in_time",
    })

    # Convert timedelta lap times to float seconds
    laps["lap_time_seconds"] = laps["lap_time"].dt.total_seconds()
    laps["sector1"] = laps["sector1"].dt.total_seconds()
    laps["sector2"] = laps["sector2"].dt.total_seconds()
    laps["sector3"] = laps["sector3"].dt.total_seconds()

    # Flag pit laps
    laps["is_pit_out_lap"] = laps["pit_out_time"].notna()
    laps["is_pit_in_lap"] = laps["pit_in_time"].notna()

    # Compute gap to leader
    leader_times = (
        laps[laps["position"] == 1][["lap_number", "lap_time_seconds"]]
        .rename(columns={"lap_time_seconds": "leader_time"})
    )
    laps = laps.merge(leader_times, on="lap_number", how="left")
    laps["gap_to_leader_seconds"] = laps.groupby("driver")["lap_time_seconds"].cumsum() \
        - laps.groupby("driver")["leader_time"].cumsum()

    # Normalise compound
    laps["compound"] = laps["compound"].fillna("UNKNOWN").str.upper()
    valid = {"SOFT", "MEDIUM", "HARD", "INTERMEDIATE", "WET"}
    laps["compound"] = laps["compound"].apply(lambda c: c if c in valid else "UNKNOWN")

    keep = [
        "driver", "driver_number", "lap_number", "lap_time_seconds",
        "is_personal_best", "compound", "tire_age_laps", "stint_number",
        "position", "gap_to_leader_seconds",
        "sector1", "sector2", "sector3",
        "is_pit_out_lap", "is_pit_in_lap",
    ]
    return laps[keep].reset_index(drop=True)


def extract_pit_stops(session: fastf1.core.Session, laps_df: pd.DataFrame) -> pd.DataFrame:
    """Extract pit stop events with compound in/out."""
    pit_laps = laps_df[laps_df["is_pit_in_lap"]].copy()

    pit_stops = []
    for _, row in pit_laps.iterrows():
        driver = row["driver"]
        lap = row["lap_number"]

        # compound being removed = current compound on that lap
        compound_out = row["compound"]

        # compound fitted = compound on the next lap for this driver
        next_lap = laps_df[
            (laps_df["driver"] == driver) & (laps_df["lap_number"] == lap + 1)
        ]
        compound_in = next_lap["compound"].values[0] if len(next_lap) else "UNKNOWN"

        pit_stops.append({
            "driver": driver,
            "driver_number": row["driver_number"],
            "lap_number": int(lap),
            "compound_out": compound_out,
            "compound_in": compound_in,
            "stint_number_after": int(row["stint_number"]) + 1,
        })

    # Try to get pit duration from session.laps if available
    try:
        raw = session.laps[["Driver", "LapNumber", "PitInTime", "PitOutTime"]].copy()
        raw = raw.dropna(subset=["PitInTime", "PitOutTime"])
        raw["pit_duration_seconds"] = (raw["PitOutTime"] - raw["PitInTime"]).dt.total_seconds().abs()
        raw = raw.rename(columns={"Driver": "driver", "LapNumber": "lap_number"})
        duration_map = {(r["driver"], r["lap_number"]): r["pit_duration_seconds"] for _, r in raw.iterrows()}
        for ps in pit_stops:
            ps["pit_duration_seconds"] = duration_map.get((ps["driver"], ps["lap_number"]))
    except Exception:
        for ps in pit_stops:
            ps["pit_duration_seconds"] = None

    return pd.DataFrame(pit_stops)


def extract_stints(laps_df: pd.DataFrame) -> pd.DataFrame:
    """Aggregate laps into stints and compute basic degradation rate."""
    stints = []
    for driver, group in laps_df.groupby("driver"):
        for stint_num, stint_laps in group.groupby("stint_number"):
            # Filter out pit laps for clean lap time stats
            clean = stint_laps[
                ~stint_laps["is_pit_out_lap"] &
                ~stint_laps["is_pit_in_lap"] &
                stint_laps["lap_time_seconds"].notna()
            ]
            if len(clean) == 0:
                continue

            avg_time = clean["lap_time_seconds"].mean()

            # Simple degradation: linear slope of lap time over stint laps
            if len(clean) >= 3:
                x = clean["tire_age_laps"].values.astype(float)
                y = clean["lap_time_seconds"].values
                deg_rate = float(np.polyfit(x, y, 1)[0])  # seconds per lap
            else:
                deg_rate = None

            stints.append({
                "driver": driver,
                "driver_number": stint_laps["driver_number"].iloc[0],
                "stint_number": int(stint_num),
                "compound": stint_laps["compound"].iloc[0],
                "lap_start": int(stint_laps["lap_number"].min()),
                "lap_end": int(stint_laps["lap_number"].max()),
                "total_laps": int(len(stint_laps)),
                "avg_lap_time": round(avg_time, 3),
                "degradation_rate": round(deg_rate, 4) if deg_rate is not None else None,
            })

    return pd.DataFrame(stints)


def save_session(year: int, round_number: int, race_name: str,
                 laps: pd.DataFrame, pits: pd.DataFrame, stints: pd.DataFrame):
    """Save processed dataframes as parquet."""
    slug = f"{year}_r{round_number:02d}"
    out = PROCESSED_DIR / slug
    out.mkdir(exist_ok=True)

    laps.to_parquet(out / "laps.parquet", index=False)
    pits.to_parquet(out / "pit_stops.parquet", index=False)
    stints.to_parquet(out / "stints.parquet", index=False)

    # Save metadata
    meta = pd.DataFrame([{
        "year": year,
        "round_number": round_number,
        "race_name": race_name,
        "total_laps": int(laps["lap_number"].max()),
        "drivers": ",".join(sorted(laps["driver"].unique())),
    }])
    meta.to_parquet(out / "meta.parquet", index=False)
    log.info(f"Saved to {out}/")


def ingest(year: int, round_number: int):
    """Full ingestion pipeline for one race session."""
    session = load_session(year, round_number)
    race_name = session.event["EventName"]

    laps = extract_laps(session)
    pits = extract_pit_stops(session, laps)
    stints = extract_stints(laps)

    save_session(year, round_number, race_name, laps, pits, stints)

    log.info(
        f"Done: {race_name} | "
        f"{len(laps)} lap records | "
        f"{len(pits)} pit stops | "
        f"{len(stints)} stints"
    )
    return laps, pits, stints


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--year", type=int, required=True)
    parser.add_argument("--round", type=int, default=None, dest="round_number")
    args = parser.parse_args()

    if args.round_number:
        ingest(args.year, args.round_number)
    else:
        # Ingest all rounds for the year
        schedule = fastf1.get_event_schedule(args.year)
        races = schedule[schedule["EventFormat"] == "conventional"]
        for _, event in races.iterrows():
            try:
                ingest(args.year, int(event["RoundNumber"]))
            except Exception as e:
                log.warning(f"Skipping round {event['RoundNumber']}: {e}")

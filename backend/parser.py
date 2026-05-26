"""
parser.py
Loads processed parquet files from data/processed/ and
returns typed RaceSession objects for use by the ML engine and MCP tools.
"""

import pandas as pd
from pathlib import Path
from backend.models import (
    RaceSession, LapRecord, PitStop, Stint, TireCompound
)

PROCESSED_DIR = Path("data/processed")


def _to_compound(val: str) -> TireCompound:
    try:
        return TireCompound(val.upper())
    except ValueError:
        return TireCompound.UNKNOWN


def _load_laps(path: Path) -> list[LapRecord]:
    df = pd.read_parquet(path)
    records = []
    for _, row in df.iterrows():
        records.append(LapRecord(
            driver=row["driver"],
            driver_number=int(row["driver_number"]),
            lap_number=int(row["lap_number"]),
            lap_time_seconds=row["lap_time_seconds"] if pd.notna(row["lap_time_seconds"]) else None,
            is_personal_best=bool(row["is_personal_best"]),
            compound=_to_compound(row["compound"]),
            tire_age_laps=int(row["tire_age_laps"]) if pd.notna(row["tire_age_laps"]) else 0,
            stint_number=int(row["stint_number"]) if pd.notna(row["stint_number"]) else 1,
            position=int(row["position"]) if pd.notna(row["position"]) else None,
            gap_to_leader_seconds=row["gap_to_leader_seconds"] if pd.notna(row["gap_to_leader_seconds"]) else None,
            sector1=row["sector1"] if pd.notna(row["sector1"]) else None,
            sector2=row["sector2"] if pd.notna(row["sector2"]) else None,
            sector3=row["sector3"] if pd.notna(row["sector3"]) else None,
            is_pit_out_lap=bool(row["is_pit_out_lap"]),
            is_pit_in_lap=bool(row["is_pit_in_lap"]),
        ))
    return records


def _load_pits(path: Path) -> list[PitStop]:
    df = pd.read_parquet(path)
    records = []
    for _, row in df.iterrows():
        records.append(PitStop(
            driver=row["driver"],
            driver_number=int(row["driver_number"]),
            lap_number=int(row["lap_number"]),
            pit_duration_seconds=row["pit_duration_seconds"] if pd.notna(row.get("pit_duration_seconds")) else None,
            compound_in=_to_compound(row["compound_in"]),
            compound_out=_to_compound(row["compound_out"]),
            stint_number_after=int(row["stint_number_after"]),
        ))
    return records


def _load_stints(path: Path) -> list[Stint]:
    df = pd.read_parquet(path)
    records = []
    for _, row in df.iterrows():
        records.append(Stint(
            driver=row["driver"],
            driver_number=int(row["driver_number"]),
            stint_number=int(row["stint_number"]),
            compound=_to_compound(row["compound"]),
            lap_start=int(row["lap_start"]),
            lap_end=int(row["lap_end"]),
            total_laps=int(row["total_laps"]),
            avg_lap_time=row["avg_lap_time"] if pd.notna(row["avg_lap_time"]) else None,
            degradation_rate=row["degradation_rate"] if pd.notna(row["degradation_rate"]) else None,
        ))
    return records


def load_race(year: int, round_number: int) -> RaceSession:
    """Load a fully parsed RaceSession from disk."""
    slug = f"{year}_r{round_number:02d}"
    base = PROCESSED_DIR / slug

    if not base.exists():
        raise FileNotFoundError(
            f"No processed data for {year} round {round_number}. "
            f"Run: python -m backend.ingestion --year {year} --round {round_number}"
        )

    meta = pd.read_parquet(base / "meta.parquet").iloc[0]

    return RaceSession(
        year=int(meta["year"]),
        round_number=int(meta["round_number"]),
        race_name=str(meta["race_name"]),
        circuit=str(meta["race_name"]),
        total_laps=int(meta["total_laps"]),
        laps=_load_laps(base / "laps.parquet"),
        pit_stops=_load_pits(base / "pit_stops.parquet"),
        stints=_load_stints(base / "stints.parquet"),
    )


def list_available_races() -> list[dict]:
    """Return all races available on disk."""
    races = []
    for path in sorted(PROCESSED_DIR.iterdir()):
        if not path.is_dir():
            continue
        try:
            meta = pd.read_parquet(path / "meta.parquet").iloc[0]
            races.append({
                "year": int(meta["year"]),
                "round_number": int(meta["round_number"]),
                "race_name": str(meta["race_name"]),
                "slug": path.name,
            })
        except Exception:
            continue
    return races

"""
features.py
Builds the training dataframe from processed parquet files.

Each row = one lap within a stint, with features the model uses to
predict lap_time_seconds.

Features:
    - compound_enc       : SOFT=0, MEDIUM=1, HARD=2, INTER=3, WET=4
    - tire_age_laps      : how many laps on this set
    - tire_age_sq        : squared (captures non-linear deg curve)
    - stint_number       : 1st stint vs 2nd vs 3rd (fuel load proxy)
    - lap_number         : absolute lap in race (fuel burn)
    - is_first_stint     : boolean
    - circuit_enc        : label-encoded circuit name
    - year               : season (car/tyre spec changes)

Target:
    - lap_time_seconds
"""

import pandas as pd
import numpy as np
from pathlib import Path
from sklearn.preprocessing import LabelEncoder
import pickle

PROCESSED_DIR = Path("data/processed")
MODEL_DIR = Path("data/models")
MODEL_DIR.mkdir(exist_ok=True)

COMPOUND_MAP = {
    "SOFT": 0,
    "MEDIUM": 1,
    "HARD": 2,
    "INTERMEDIATE": 3,
    "WET": 4,
    "UNKNOWN": 1,  # treat unknown as medium
}

FEATURE_COLS = [
    "compound_enc",
    "tire_age_laps",
    "tire_age_sq",
    "stint_number",
    "lap_number",
    "is_first_stint",
    "circuit_enc",
    "year",
]

TARGET_COL = "lap_time_seconds"


def build_training_data() -> tuple[pd.DataFrame, LabelEncoder]:
    """
    Load all processed races and build one flat training dataframe.
    Returns (df, circuit_encoder).
    """
    all_frames = []

    for path in sorted(PROCESSED_DIR.iterdir()):
        if not path.is_dir():
            continue
        try:
            laps = pd.read_parquet(path / "laps.parquet")
            meta = pd.read_parquet(path / "meta.parquet").iloc[0]
        except Exception:
            continue

        year = int(meta["year"])
        circuit = str(meta["race_name"])

        # Drop outlap, inlap, missing lap times, safety car laps
        clean = laps[
            ~laps["is_pit_out_lap"] &
            ~laps["is_pit_in_lap"] &
            laps["lap_time_seconds"].notna() &
            (laps["lap_time_seconds"] > 60) &
            (laps["lap_time_seconds"] < 200)
        ].copy()

        if len(clean) == 0:
            continue

        clean["circuit"] = circuit
        clean["year"] = year
        clean["compound_enc"] = clean["compound"].map(COMPOUND_MAP).fillna(1).astype(int)
        clean["tire_age_sq"] = clean["tire_age_laps"] ** 2
        clean["is_first_stint"] = (clean["stint_number"] == 1).astype(int)

        all_frames.append(clean[[
            "compound_enc", "tire_age_laps", "tire_age_sq",
            "stint_number", "lap_number", "is_first_stint",
            "circuit", "year", "lap_time_seconds"
        ]])

    if not all_frames:
        raise ValueError("No training data found — run ingestion first")

    df = pd.concat(all_frames, ignore_index=True)

    # Encode circuit
    le = LabelEncoder()
    df["circuit_enc"] = le.fit_transform(df["circuit"])

    # Save encoder for inference
    with open(MODEL_DIR / "circuit_encoder.pkl", "wb") as f:
        pickle.dump(le, f)

    print(f"Training data: {len(df):,} rows | {df['circuit'].nunique()} circuits | {df['year'].nunique()} seasons")
    return df, le


def prepare_inference_row(
    compound: str,
    tire_age_laps: int,
    stint_number: int,
    lap_number: int,
    circuit: str,
    year: int,
    circuit_encoder: LabelEncoder,
) -> pd.DataFrame:
    """Build a single-row dataframe for model.predict()."""
    try:
        circuit_enc = circuit_encoder.transform([circuit])[0]
    except ValueError:
        # Unknown circuit — use median encoding
        circuit_enc = len(circuit_encoder.classes_) // 2

    return pd.DataFrame([{
        "compound_enc": COMPOUND_MAP.get(compound.upper(), 1),
        "tire_age_laps": tire_age_laps,
        "tire_age_sq": tire_age_laps ** 2,
        "stint_number": stint_number,
        "lap_number": lap_number,
        "is_first_stint": int(stint_number == 1),
        "circuit_enc": circuit_enc,
        "year": year,
    }])
"""
degradation.py
XGBoost model that predicts lap time given tire state and context.
Used by the optimizer and simulator to project future lap times.
"""

import numpy as np
import pandas as pd
import pickle
from pathlib import Path
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error
from xgboost import XGBRegressor
from sklearn.preprocessing import LabelEncoder

from backend.ml.features import FEATURE_COLS, TARGET_COL, MODEL_DIR, prepare_inference_row

MODEL_PATH = MODEL_DIR / "degradation_model.pkl"
ENCODER_PATH = MODEL_DIR / "circuit_encoder.pkl"


def train(df: pd.DataFrame) -> XGBRegressor:
    """Train XGBoost degradation model and save to disk."""
    X = df[FEATURE_COLS]
    y = df[TARGET_COL]

    X_train, X_val, y_train, y_val = train_test_split(
        X, y, test_size=0.15, random_state=42
    )

    model = XGBRegressor(
        n_estimators=400,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        min_child_weight=5,
        reg_alpha=0.1,
        reg_lambda=1.0,
        random_state=42,
        n_jobs=-1,
        early_stopping_rounds=30,
        eval_metric="mae",
    )

    model.fit(
        X_train, y_train,
        eval_set=[(X_val, y_val)],
        verbose=50,
    )

    val_preds = model.predict(X_val)
    mae = mean_absolute_error(y_val, val_preds)
    print(f"\nValidation MAE: {mae:.3f}s ({mae*1000:.0f}ms per lap)")

    # Feature importance
    importance = dict(zip(FEATURE_COLS, model.feature_importances_))
    print("\nFeature importances:")
    for feat, imp in sorted(importance.items(), key=lambda x: -x[1]):
        print(f"  {feat:<20} {imp:.4f}")

    with open(MODEL_PATH, "wb") as f:
        pickle.dump(model, f)
    print(f"\nModel saved to {MODEL_PATH}")

    return model


def load_model() -> tuple[XGBRegressor, LabelEncoder]:
    """Load trained model and circuit encoder from disk."""
    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            "No trained model found. Run: python -m backend.ml.train"
        )
    with open(MODEL_PATH, "rb") as f:
        model = pickle.load(f)
    with open(ENCODER_PATH, "rb") as f:
        encoder = pickle.load(f)
    return model, encoder


def predict_lap_time(
    compound: str,
    tire_age_laps: int,
    stint_number: int,
    lap_number: int,
    circuit: str,
    year: int,
    model: XGBRegressor,
    encoder: LabelEncoder,
) -> float:
    """Predict a single lap time in seconds."""
    row = prepare_inference_row(
        compound, tire_age_laps, stint_number, lap_number, circuit, year, encoder
    )
    return float(model.predict(row)[0])


def predict_stint_curve(
    compound: str,
    stint_start_lap: int,
    stint_length: int,
    stint_number: int,
    circuit: str,
    year: int,
    model: XGBRegressor,
    encoder: LabelEncoder,
) -> list[dict]:
    """
    Predict full lap-by-lap times for an entire stint.
    Returns list of {lap_number, tire_age, predicted_time}.
    """
    results = []
    for i in range(stint_length):
        lap_number = stint_start_lap + i
        tire_age = i + 1
        predicted = predict_lap_time(
            compound, tire_age, stint_number, lap_number, circuit, year, model, encoder
        )
        results.append({
            "lap_number": lap_number,
            "tire_age_laps": tire_age,
            "predicted_lap_time": round(predicted, 3),
        })
    return results


def degradation_rate(
    compound: str,
    stint_number: int,
    circuit: str,
    year: int,
    model: XGBRegressor,
    encoder: LabelEncoder,
    window: int = 10,
) -> float:
    """
    Estimate seconds lost per lap for a compound on a circuit.
    Computed as average slope over laps 3–(window+3) of a stint.
    """
    times = [
        predict_lap_time(compound, age, stint_number, 20 + age, circuit, year, model, encoder)
        for age in range(3, window + 3)
    ]
    slopes = [times[i+1] - times[i] for i in range(len(times)-1)]
    return round(float(np.mean(slopes)), 4)
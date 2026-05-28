"""
evaluate.py
Evaluate the trained XGBoost model and save metrics to JSON.
Run with: python -m backend.ml.evaluate
"""

import json
import numpy as np
from pathlib import Path
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

from backend.ml.features import build_training_data, FEATURE_COLS, TARGET_COL, MODEL_DIR
from backend.ml.degradation import load_model

METRICS_PATH = MODEL_DIR / "model_metrics.json"


def evaluate():
    print("=" * 60)
    print("PitStrat AI — Model Evaluation")
    print("=" * 60)

    print("\n[1/4] Loading model and rebuilding dataset...")
    model, encoder = load_model()
    df, _ = build_training_data()

    X = df[FEATURE_COLS]
    y = df[TARGET_COL]

    # Same split used in training (random_state=42, test_size=0.15)
    X_train, X_val, y_train, y_val = train_test_split(
        X, y, test_size=0.15, random_state=42
    )
    print(f"      Total samples: {len(df)}")
    print(f"      Train: {len(X_train)} | Validation: {len(X_val)}")

    print("\n[2/4] Computing metrics...")
    val_preds = model.predict(X_val)
    train_preds = model.predict(X_train)

    val_mae = float(mean_absolute_error(y_val, val_preds))
    val_rmse = float(np.sqrt(mean_squared_error(y_val, val_preds)))
    val_r2 = float(r2_score(y_val, val_preds))

    train_mae = float(mean_absolute_error(y_train, train_preds))
    train_rmse = float(np.sqrt(mean_squared_error(y_train, train_preds)))
    train_r2 = float(r2_score(y_train, train_preds))

    print(f"      Validation MAE:  {val_mae:.3f}s")
    print(f"      Validation RMSE: {val_rmse:.3f}s")
    print(f"      Validation R²:   {val_r2:.4f}")

    print("\n[3/4] Feature importance...")
    importance_pairs = sorted(
        zip(FEATURE_COLS, model.feature_importances_),
        key=lambda x: -x[1]
    )
    feature_importance = [
        {"feature": str(feat), "importance": float(imp)}
        for feat, imp in importance_pairs
    ]
    for f in feature_importance:
        print(f"      {f['feature']:<25} {f['importance']:.4f}")

    print("\n[4/4] Building scatter and residual samples...")
    # Sample 500 random points for scatter plot
    rng = np.random.RandomState(42)
    sample_idx = rng.choice(len(y_val), size=min(500, len(y_val)), replace=False)
    scatter = [
        {"actual": float(y_val.iloc[i]), "predicted": float(val_preds[i])}
        for i in sample_idx
    ]

    # Residual distribution — bin residuals into histogram
    residuals = val_preds - y_val.values
    hist_counts, hist_edges = np.histogram(residuals, bins=30, range=(-15, 15))
    residual_histogram = [
        {
            "bin_start": float(hist_edges[i]),
            "bin_end": float(hist_edges[i + 1]),
            "count": int(hist_counts[i]),
        }
        for i in range(len(hist_counts))
    ]

    # Lap time prediction error stats by compound
    df_val = df.loc[X_val.index].copy()
    df_val["pred"] = val_preds
    df_val["abs_err"] = (df_val["pred"] - df_val[TARGET_COL]).abs()
    compound_map_reverse = {0: "SOFT", 1: "MEDIUM", 2: "HARD", 3: "INTERMEDIATE", 4: "WET", 5: "UNKNOWN"}
    by_compound = []
    for c_enc in sorted(df_val["compound_enc"].unique()):
        subset = df_val[df_val["compound_enc"] == c_enc]
        by_compound.append({
            "compound": compound_map_reverse.get(int(c_enc), f"COMPOUND_{c_enc}"),
            "samples": int(len(subset)),
            "mae": float(subset["abs_err"].mean()),
        })

    metrics = {
        "model_type": "XGBoost Regressor",
        "n_estimators": 400,
        "max_depth": 6,
        "learning_rate": 0.05,
        "training": {
            "total_samples": int(len(df)),
            "train_samples": int(len(X_train)),
            "val_samples": int(len(X_val)),
            "features": FEATURE_COLS,
        },
        "validation_metrics": {
            "mae": round(val_mae, 4),
            "rmse": round(val_rmse, 4),
            "r2": round(val_r2, 4),
        },
        "training_metrics": {
            "mae": round(train_mae, 4),
            "rmse": round(train_rmse, 4),
            "r2": round(train_r2, 4),
        },
        "feature_importance": feature_importance,
        "scatter_sample": scatter,
        "residual_histogram": residual_histogram,
        "by_compound": by_compound,
    }

    with open(METRICS_PATH, "w") as f:
        json.dump(metrics, f, indent=2)

    print(f"\nMetrics saved to {METRICS_PATH}")
    print("=" * 60)
    return metrics


if __name__ == "__main__":
    evaluate()
"""
train.py
One-shot training script. Run this to build the degradation model.
Usage:
    python -m backend.ml.train
"""

import time
from backend.ml.features import build_training_data, FEATURE_COLS, TARGET_COL
from backend.ml.degradation import train, load_model, degradation_rate


def main():
    print("=" * 60)
    print("PitStrat AI — Phase 2 ML Training")
    print("=" * 60)

    # 1. Build training data
    print("\n[1/3] Building training dataset...")
    t0 = time.time()
    df, encoder = build_training_data()
    print(f"      Done in {time.time() - t0:.1f}s")
    print(f"      Shape: {df.shape}")
    print(f"      Compounds: {df['compound_enc'].value_counts().to_dict()}")

    # 2. Train model
    print("\n[2/3] Training XGBoost degradation model...")
    t0 = time.time()
    model = train(df)
    print(f"      Done in {time.time() - t0:.1f}s")

    # 3. Sanity check predictions
    print("\n[3/3] Sanity check — degradation rates by compound (Bahrain):")
    model, encoder = load_model()
    for compound in ["SOFT", "MEDIUM", "HARD"]:
        rate = degradation_rate(compound, 2, "Bahrain Grand Prix", 2024, model, encoder)
        print(f"      {compound:<10}: {rate:+.4f}s per lap")

    print("\n" + "=" * 60)
    print("Training complete. Model saved to data/models/")
    print("Run test_phase2.py to verify.")
    print("=" * 60)


if __name__ == "__main__":
    main()
"""CLI: confidence-calibration harness (doc 12 §B.5).

Feeds a held-out label file (CSV: `reported_confidence,correct`) through the
decile calibration bucket and reports per-decile accuracy vs. reported
confidence, flagging buckets that overstate by >15pp.

Usage (from backend/):
    python -m scripts.calibrate --csv path/to/labels.csv

The CSV must be clinician-labeled for the output to mean anything clinical —
this tool measures calibration, it does not create the test set (doc 13 §5).
"""
import argparse
import csv
import json
import sys

sys.path.insert(0, __import__("os").path.dirname(__import__("os").path.dirname(__import__("os").path.abspath(__file__))))

from app.services.calibration import bucket_calibration


def main() -> None:
    parser = argparse.ArgumentParser(description="Confidence calibration harness")
    parser.add_argument("--csv", required=True)
    args = parser.parse_args()

    predictions: list[tuple[float, bool]] = []
    with open(args.csv, newline="", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            predictions.append(
                (float(row["reported_confidence"]), row["correct"].strip().lower() in {"1", "true", "yes"})
            )

    report = bucket_calibration(predictions)
    print(json.dumps({"deciles": report.deciles, "overstating_buckets": report.overstating_buckets}, indent=2))


if __name__ == "__main__":
    main()
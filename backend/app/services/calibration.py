"""Confidence calibration harness (doc 12 §B.5 / doc 09 §4).

Bucket predictions by reported-confidence decile and compare each bucket's
mean reported confidence to its *actual* accuracy, flagging any bucket where
the model overstates accuracy by more than 15 percentage points.

This measures calibration; it does NOT fabricate a clinician test set. Real
calibration of the cascade requires a clinician-labeled held-out set (doc 13
§5 explains the ~550-case-per-subgroup math) — this harness is the tool that
ingests that set when it exists, plus the flagging logic already specified.
"""
from __future__ import annotations

from dataclasses import dataclass

_OVERSTATEMENT_THRESHOLD = 0.15


@dataclass(frozen=True)
class CalibrationReport:
    deciles: dict[int, dict]
    overstating_buckets: list[dict]


def _decile(confidence: float) -> int:
    """Map 0..1 confidence to a decile bucket 0..9 (1.0 goes in bucket 9)."""
    c = max(0.0, min(1.0, float(confidence)))
    return min(9, int(c * 10))


def bucket_calibration(
    predictions: list[tuple[float, bool]],
    *,
    threshold: float = _OVERSTATEMENT_THRESHOLD,
) -> CalibrationReport:
    """`predictions` is a list of `(reported_confidence, was_correct)`."""
    buckets: dict[int, list[tuple[float, bool]]] = {}
    for confidence, correct in predictions:
        buckets.setdefault(_decile(confidence), []).append((confidence, bool(correct)))

    deciles: dict[int, dict] = {}
    overstating: list[dict] = []
    for decile in range(10):
        rows = buckets.get(decile, [])
        if not rows:
            continue
        reported = sum(c for c, _ in rows) / len(rows)
        actual = sum(1 for _, ok in rows if ok) / len(rows)
        entry = {
            "decile": decile,
            "n": len(rows),
            "reported_confidence": round(reported, 4),
            "actual_accuracy": round(actual, 4),
            "overstatement": round(reported - actual, 4),
        }
        deciles[decile] = entry
        if reported - actual > threshold:
            overstating.append(entry)

    return CalibrationReport(deciles=deciles, overstating_buckets=overstating)


__all__ = ["CalibrationReport", "bucket_calibration"]
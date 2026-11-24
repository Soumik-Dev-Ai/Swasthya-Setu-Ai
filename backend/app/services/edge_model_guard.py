"""Environment-aware edge-model guard (doc 24).

The fine-tuned edge model (ONNX bundle from doc 23) may load ONLY on a
developer's local machine (`DEPLOYMENT_TARGET=local_dev`) or on-device in
the mobile app. It must NEVER load in the cloud backend — by architecture
the cloud deployment's only triage-refinement path is the online Reasoning
Engine cascade (`reasoning_engine.py`).

This module is the single choke point: any future code that wants to touch
an edge-model weight file goes through `ensure_edge_model_allowed()` first.
"""
from __future__ import annotations

from pathlib import Path

from app.core.config import settings

_ERROR_MSG = (
    "fine-tuned model loading is disabled in cloud_production by design, "
    "see docs/24_ENVIRONMENT_AWARE_MODEL_INTEGRATION.md"
)

# Weight-file extensions that must never be present in a cloud deployment.
_MODEL_SUFFIXES = {".onnx", ".safetensors", ".pt", ".pth", ".bin", ".gguf", ".tflite"}


def ensure_edge_model_allowed() -> None:
    """Raise RuntimeError unless running in local_dev.

    Call this before any ONNX-runtime init, model-file read, or
    offline-backend code path. Raises — never silently falls back.
    """
    if settings.DEPLOYMENT_TARGET != "local_dev":
        raise RuntimeError(_ERROR_MSG)


# Vendored/dependency trees that can never hold *our* shipped weights.
# Pruning them keeps the startup scan sub-second — an unpruned walk over
# .venv/node_modules measured 172s on this repo (and produced only
# false-positive library assets, never real weights).
_SKIP_DIRS = {
    "node_modules", ".venv", "venv", "env", ".git", "dist", "__pycache__",
    ".ipynb_checkpoints", "site-packages", ".npm", ".cache",
}


def find_model_weight_files(root: Path) -> list[str]:
    """Return any model weight files present under `root` (repo scan).

    Used by the startup check so a weight file sneaking into the deployed
    artifact is *detected loudly* rather than silently shipped. Dependency
    trees (.venv/node_modules/site-packages/...) are pruned: their
    .bin/.pth assets are library files, not model weights.
    """
    import os

    if not root.exists():
        return []
    hits: list[str] = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in _SKIP_DIRS]
        for name in filenames:
            if Path(name).suffix.lower() in _MODEL_SUFFIXES:
                hits.append(os.path.join(dirpath, name))
    return hits


def startup_check(logger, repo_root: Path) -> None:
    """Doc 24 §3 startup guard. Called from the app lifespan.

    - cloud_production: log that the edge path is disabled, and WARN loudly
      if any weight files are present at all (they should never ship).
    - local_dev: log that the edge path is enabled (dev only).
    """
    weights = find_model_weight_files(repo_root)
    if settings.DEPLOYMENT_TARGET == "cloud_production":
        logger.info(
            "[Doc24] DEPLOYMENT_TARGET=cloud_production — edge-model loading disabled "
            "(online Reasoning Engine cascade is the only refinement path)."
        )
        if weights:
            logger.warning(
                "[Doc24] WARNING: %d model weight file(s) present in the deployment: %s. "
                "These must not ship to Render — add them to .renderignore.",
                len(weights), weights,
            )
    else:
        logger.info(
            "[Doc24] DEPLOYMENT_TARGET=local_dev — edge-model loading permitted for local testing."
        )

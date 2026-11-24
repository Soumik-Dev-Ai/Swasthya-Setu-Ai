"""Test doc 24 edge model guard behaviour."""
import pytest
from app.services.edge_model_guard import ensure_edge_model_allowed
from app.core.config import settings


def test_edge_guard_rejects_in_cloud_production(monkeypatch):
    monkeypatch.setattr(settings, "DEPLOYMENT_TARGET", "cloud_production")
    with pytest.raises(RuntimeError, match="fine-tuned model loading is disabled in cloud_production"):
        ensure_edge_model_allowed()


def test_edge_guard_permits_in_local_dev(monkeypatch):
    monkeypatch.setattr(settings, "DEPLOYMENT_TARGET", "local_dev")
    # Must not raise
    ensure_edge_model_allowed()

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.config import settings

client = TestClient(app)


def test_cors_allowed_origins_configuration():
    """Verify settings.cors_origins includes production Vercel and local origins."""
    origins = settings.cors_origins
    assert "https://leak-lens-roan.vercel.app" in origins
    assert "http://localhost:3000" in origins
    assert "http://127.0.0.1:3000" in origins


def test_health_endpoints_and_cors_get():
    """Verify /api/health and /health return 200 with proper CORS headers for Vercel origin."""
    prod_origin = "https://leak-lens-roan.vercel.app"
    
    # 1. /api/health
    res1 = client.get("/api/health", headers={"Origin": prod_origin})
    assert res1.status_code == 200
    assert res1.json()["status"] == "ok"
    assert res1.headers.get("access-control-allow-origin") == prod_origin
    assert res1.headers.get("access-control-allow-credentials") == "true"

    # 2. /health (root alias)
    res2 = client.get("/health", headers={"Origin": prod_origin})
    assert res2.status_code == 200
    assert res2.json()["status"] == "ok"
    assert res2.headers.get("access-control-allow-origin") == prod_origin


def test_cors_preflight_options_request():
    """Verify OPTIONS preflight requests succeed with CORS headers for production Vercel origin."""
    prod_origin = "https://leak-lens-roan.vercel.app"
    
    endpoints = [
        "/api/health",
        "/api/datasets",
        "/api/generator/generate",
        "/api/reconciliation/run",
        "/api/action-center/test-dataset/summary",
    ]

    for ep in endpoints:
        res = client.options(
            ep,
            headers={
                "Origin": prod_origin,
                "Access-Control-Request-Method": "POST" if "generate" in ep or "run" in ep else "GET",
                "Access-Control-Request-Headers": "content-type",
            }
        )
        assert res.status_code == 200, f"OPTIONS failed on {ep}"
        assert res.headers.get("access-control-allow-origin") == prod_origin
        assert "content-type" in res.headers.get("access-control-allow-headers", "").lower()


def test_cors_vercel_preview_origin_regex():
    """Verify preview deployment origins on Vercel are allowed via regex."""
    preview_origin = "https://leak-lens-preview-abc123.vercel.app"
    res = client.options(
        "/api/health",
        headers={
            "Origin": preview_origin,
            "Access-Control-Request-Method": "GET",
        }
    )
    assert res.status_code == 200
    assert res.headers.get("access-control-allow-origin") == preview_origin


def test_cors_untrusted_origin_rejected():
    """Verify untrusted origins do not receive access-control-allow-origin headers."""
    untrusted_origin = "https://evil-attacker-site.com"
    res = client.options(
        "/api/health",
        headers={
            "Origin": untrusted_origin,
            "Access-Control-Request-Method": "GET",
        }
    )
    # CORSMiddleware does not include Access-Control-Allow-Origin for disallowed origins
    assert "access-control-allow-origin" not in res.headers


def test_datasets_endpoint_cors_and_structure():
    """Verify /api/datasets works with CORS and returns valid structure."""
    prod_origin = "https://leak-lens-roan.vercel.app"
    res = client.get("/api/datasets", headers={"Origin": prod_origin})
    assert res.status_code == 200
    assert res.headers.get("access-control-allow-origin") == prod_origin
    data = res.json()
    assert "datasets" in data
    assert isinstance(data["datasets"], list)


@pytest.mark.asyncio
async def test_demo_generator_flow_with_cors():
    """Verify generating benchmark dataset with Vercel origin headers."""
    prod_origin = "https://leak-lens-roan.vercel.app"
    payload = {
        "transaction_count": 100,
        "anomaly_rate": 0.05,
        "seed": 42,
        "merchant_id": "M001",
        "anomalies": {
            "missing_settlement": True,
            "duplicate_settlement": True,
            "amount_mismatch": True,
            "refund_mismatch": True,
            "fee_anomaly": True,
            "delayed_settlement": True,
            "orphan_settlement": True,
        }
    }
    
    res = client.post(
        "/api/generator/generate",
        json=payload,
        headers={"Origin": prod_origin, "Content-Type": "application/json"}
    )
    assert res.status_code == 200
    assert res.headers.get("access-control-allow-origin") == prod_origin
    data = res.json()
    assert data["success"] is True
    assert "dataset_id" in data
    
    # Verify dataset now appears in /api/datasets
    ds_res = client.get("/api/datasets", headers={"Origin": prod_origin})
    assert ds_res.status_code == 200
    ds_list = ds_res.json()["datasets"]
    assert any(d["dataset_id"] == data["dataset_id"] for d in ds_list)

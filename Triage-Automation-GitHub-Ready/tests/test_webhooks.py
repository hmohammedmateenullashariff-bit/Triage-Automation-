"""Comprehensive tests for Webhook Triggers and Management Endpoints."""

import hashlib
import hmac
import json
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from app import create_app
from app.crypto import encrypt_value
from app.security.rate_limiter import global_rate_limiter


@pytest.fixture(autouse=True)
def reset_limiter():
    global_rate_limiter.reset()
    yield
    global_rate_limiter.reset()


@pytest.fixture
def app():
    app = create_app(testing=True)
    return app


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def auth_headers():
    return {"X-API-Key": "test-api-key"}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _sample_webhook_workflow(
    workflow_id: str | None = None,
    webhook_token: str = "valid-hook-token-123",
    encrypted_secret: str | None = None,
) -> dict:
    w_id = workflow_id or str(uuid4())
    return {
        "workflow_id": w_id,
        "name": "Inbound Webhook Workflow",
        "version": 1,
        "trigger": {
            "type": "webhook",
            "config": {
                "webhook_token": webhook_token,
                "has_secret": bool(encrypted_secret),
            },
        },
        "nodes": [
            {
                "node_id": "step1",
                "type": "code",
                "name": "Process Webhook Payload",
                "config": {
                    "code": "result = {'received_id': input_data['trigger'].get('event_id', 'none')}",
                    "timeout_seconds": 5,
                },
                "on_error": "fail",
                "retry_count": 0,
            }
        ],
        "edges": [],
        "webhook_token": webhook_token,
        "encrypted_webhook_secret": encrypted_secret,
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
    }


# ===========================================================================
# Public Webhook Trigger Tests (POST /webhooks/<token>)
# ===========================================================================


def test_webhook_happy_path_executes_and_returns_202(client):
    token = "test-token-happy-123"
    workflow = _sample_webhook_workflow(webhook_token=token)

    with patch("app.routes.webhooks.workflow_repo.get_workflow_by_webhook_token", return_value=workflow), \
         patch("app.routes.webhooks.workflow_repo.create_run") as mock_create_run, \
         patch("app.routes.webhooks.workflow_repo.update_run") as mock_update_run, \
         patch("app.routes.webhooks.workflow_repo.create_node_logs") as mock_create_logs:
        response = client.post(
            f"/webhooks/{token}",
            json={"event_id": "evt_999", "action": "created"},
        )

    assert response.status_code == 202
    data = response.get_json()
    assert "run_id" in data
    assert data["workflow_id"] == workflow["workflow_id"]
    assert data["status"] == "running"

    mock_create_run.assert_called_once()
    mock_update_run.assert_called_once()
    mock_create_logs.assert_called_once()


def test_webhook_with_secret_valid_signature(client):
    token = "test-token-auth-456"
    raw_secret = "super-secret-webhook-key-99"
    with patch.dict("os.environ", {"CREDENTIAL_ENCRYPTION_KEY": "cM_pCqppXQFCIZyCX01Avj0hK7fG9ObKaKWbZzbRISM="}):
        enc_secret = encrypt_value(raw_secret)

    workflow = _sample_webhook_workflow(webhook_token=token, encrypted_secret=enc_secret)
    payload_dict = {"event": "payment_received", "amount": 5000}
    payload_bytes = json.dumps(payload_dict).encode("utf-8")

    # Compute valid HMAC-SHA256 signature
    signature = hmac.new(raw_secret.encode("utf-8"), payload_bytes, hashlib.sha256).hexdigest()

    with patch.dict("os.environ", {"CREDENTIAL_ENCRYPTION_KEY": "cM_pCqppXQFCIZyCX01Avj0hK7fG9ObKaKWbZzbRISM="}), \
         patch("app.routes.webhooks.workflow_repo.get_workflow_by_webhook_token", return_value=workflow), \
         patch("app.routes.webhooks.workflow_repo.create_run"), \
         patch("app.routes.webhooks.workflow_repo.update_run"), \
         patch("app.routes.webhooks.workflow_repo.create_node_logs"):
        response = client.post(
            f"/webhooks/{token}",
            data=payload_bytes,
            content_type="application/json",
            headers={"X-Webhook-Signature": f"sha256={signature}"},
        )

    assert response.status_code == 202
    assert response.get_json()["status"] == "running"


def test_webhook_with_secret_missing_signature_returns_401(client):
    token = "test-token-missing-sig"
    with patch.dict("os.environ", {"CREDENTIAL_ENCRYPTION_KEY": "cM_pCqppXQFCIZyCX01Avj0hK7fG9ObKaKWbZzbRISM="}):
        enc_secret = encrypt_value("some-secret")

    workflow = _sample_webhook_workflow(webhook_token=token, encrypted_secret=enc_secret)

    with patch.dict("os.environ", {"CREDENTIAL_ENCRYPTION_KEY": "cM_pCqppXQFCIZyCX01Avj0hK7fG9ObKaKWbZzbRISM="}), \
         patch("app.routes.webhooks.workflow_repo.get_workflow_by_webhook_token", return_value=workflow), \
         patch("app.routes.webhooks.workflow_repo.create_run") as mock_create_run:
        response = client.post(
            f"/webhooks/{token}",
            json={"data": "test"},
        )

    assert response.status_code == 401
    assert "Missing webhook signature" in response.get_json()["error"]
    # Ensure no execution run was started
    mock_create_run.assert_not_called()


def test_webhook_with_secret_invalid_signature_returns_401(client):
    token = "test-token-bad-sig"
    with patch.dict("os.environ", {"CREDENTIAL_ENCRYPTION_KEY": "cM_pCqppXQFCIZyCX01Avj0hK7fG9ObKaKWbZzbRISM="}):
        enc_secret = encrypt_value("my-secret")

    workflow = _sample_webhook_workflow(webhook_token=token, encrypted_secret=enc_secret)

    with patch.dict("os.environ", {"CREDENTIAL_ENCRYPTION_KEY": "cM_pCqppXQFCIZyCX01Avj0hK7fG9ObKaKWbZzbRISM="}), \
         patch("app.routes.webhooks.workflow_repo.get_workflow_by_webhook_token", return_value=workflow), \
         patch("app.routes.webhooks.workflow_repo.create_run") as mock_create_run:
        response = client.post(
            f"/webhooks/{token}",
            json={"data": "test"},
            headers={"X-Webhook-Signature": "invalid_signature_hex_value"},
        )

    assert response.status_code == 401
    assert "Invalid webhook signature" in response.get_json()["error"]
    mock_create_run.assert_not_called()


def test_webhook_unknown_token_returns_404(client):
    with patch("app.routes.webhooks.workflow_repo.get_workflow_by_webhook_token", return_value=None):
        response = client.post("/webhooks/nonexistent-token-xyz", json={})

    assert response.status_code == 404
    assert "not found" in response.get_json()["error"].lower()


def test_webhook_oversized_payload_rejected(client):
    token = "test-token-size-limit"
    # Create 1.1MB body
    huge_body = "x" * (1024 * 1024 + 100)

    response = client.post(
        f"/webhooks/{token}",
        data=huge_body,
        content_type="application/json",
    )

    assert response.status_code == 413
    assert "1MB" in response.get_json()["error"]


def test_webhook_unauthenticated_path_has_secret_false(client):
    token = "test-token-unauthenticated"
    workflow = _sample_webhook_workflow(webhook_token=token, encrypted_secret=None)

    with patch("app.routes.webhooks.workflow_repo.get_workflow_by_webhook_token", return_value=workflow), \
         patch("app.routes.webhooks.workflow_repo.create_run"), \
         patch("app.routes.webhooks.workflow_repo.update_run"), \
         patch("app.routes.webhooks.workflow_repo.create_node_logs"):
        response = client.post(f"/webhooks/{token}", json={"msg": "open trigger"})

    assert response.status_code == 202
    assert workflow["trigger"]["config"]["has_secret"] is False


def test_webhook_rate_limiting(client):
    token = "test-rate-limit-token"
    workflow = _sample_webhook_workflow(webhook_token=token)

    # Exceed limit using custom low threshold for testing
    for _ in range(60):
        global_rate_limiter.is_rate_limited(token, limit=60)

    with patch("app.routes.webhooks.workflow_repo.get_workflow_by_webhook_token", return_value=workflow):
        response = client.post(f"/webhooks/{token}", json={})

    assert response.status_code == 429
    assert "Rate limit exceeded" in response.get_json()["error"]


def test_webhook_secret_never_leaked(client, auth_headers):
    secret = "sk-super-secret-do-not-leak"
    w_id = str(uuid4())

    with patch.dict("os.environ", {"CREDENTIAL_ENCRYPTION_KEY": "cM_pCqppXQFCIZyCX01Avj0hK7fG9ObKaKWbZzbRISM="}):
        enc_secret = encrypt_value(secret)

    stored_row = _sample_webhook_workflow(workflow_id=w_id, encrypted_secret=enc_secret)

    with patch("app.routes.workflows.workflow_repo.get_workflow", return_value=stored_row):
        response = client.get(f"/workflows/{w_id}", headers=auth_headers)

    assert response.status_code == 200
    data = response.get_json()
    assert data["has_secret"] is True
    assert "webhook_url" in data
    # Assert secret never appears in payload or text
    raw_text = response.get_data(as_text=True)
    assert secret not in raw_text
    assert enc_secret not in raw_text
    assert "encrypted_webhook_secret" not in data


# ===========================================================================
# Webhook Management API Tests (POST/DELETE /workflows/<id>/webhook)
# ===========================================================================


def test_create_webhook_for_workflow(client, auth_headers):
    w_id = str(uuid4())
    stored_workflow = {
        "workflow_id": w_id,
        "name": "Manual Workflow",
        "version": 1,
        "trigger": {"type": "manual", "config": {}},
        "nodes": [],
        "edges": [],
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
    }

    with patch.dict("os.environ", {"CREDENTIAL_ENCRYPTION_KEY": "cM_pCqppXQFCIZyCX01Avj0hK7fG9ObKaKWbZzbRISM="}), \
         patch("app.routes.workflows.workflow_repo.get_workflow", return_value=stored_workflow), \
         patch("app.routes.workflows.workflow_repo.update_workflow_webhook") as mock_update_hook:
        mock_update_hook.return_value = {}
        response = client.post(
            f"/workflows/{w_id}/webhook",
            json={"secret": "my-custom-webhook-secret"},
            headers=auth_headers,
        )

    assert response.status_code == 200
    data = response.get_json()
    assert data["workflow_id"] == w_id
    assert data["trigger_type"] == "webhook"
    assert "webhook_token" in data
    assert data["webhook_url"] == f"/webhooks/{data['webhook_token']}"
    assert data["has_secret"] is True
    assert data["secret"] == "my-custom-webhook-secret"


def test_revoke_webhook_for_workflow(client, auth_headers):
    w_id = str(uuid4())
    stored_workflow = _sample_webhook_workflow(workflow_id=w_id)

    with patch("app.routes.workflows.workflow_repo.get_workflow", return_value=stored_workflow), \
         patch("app.routes.workflows.workflow_repo.update_workflow_webhook") as mock_update_hook:
        mock_update_hook.return_value = {}
        response = client.delete(f"/workflows/{w_id}/webhook", headers=auth_headers)

    assert response.status_code == 200
    data = response.get_json()
    assert data["trigger_type"] == "manual"
    mock_update_hook.assert_called_once_with(
        workflow_id=w_id,
        webhook_token=None,
        encrypted_webhook_secret=None,
        trigger={"type": "manual", "config": {}},
    )

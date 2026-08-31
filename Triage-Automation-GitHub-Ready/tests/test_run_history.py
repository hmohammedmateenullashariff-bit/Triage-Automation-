"""Tests for Execution Run History endpoint (GET /workflows/<id>/runs)."""

from datetime import datetime, timezone
from unittest.mock import patch
from uuid import uuid4

import pytest

from app import create_app


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


def test_list_workflow_runs_success(client, auth_headers):
    w_id = str(uuid4())
    stored_workflow = {"workflow_id": w_id, "name": "Run History Flow"}

    mock_runs = [
        {
            "run_id": str(uuid4()),
            "workflow_id": w_id,
            "status": "success",
            "started_at": "2026-01-01T00:00:00Z",
            "finished_at": "2026-01-01T00:00:02.500000Z",
            "duration_seconds": 2.5,
            "trigger_type": "manual",
            "node_counts": {"success": 3, "failed": 0, "skipped": 1, "total": 4},
        },
        {
            "run_id": str(uuid4()),
            "workflow_id": w_id,
            "status": "failed",
            "started_at": "2026-01-01T01:00:00Z",
            "finished_at": "2026-01-01T01:00:01.200000Z",
            "duration_seconds": 1.2,
            "trigger_type": "webhook",
            "node_counts": {"success": 1, "failed": 1, "skipped": 0, "total": 2},
        },
    ]

    with patch("app.routes.workflows.workflow_repo.get_workflow", return_value=stored_workflow), \
         patch("app.routes.workflows.workflow_repo.list_runs_for_workflow", return_value=mock_runs) as mock_list:
        response = client.get(f"/workflows/{w_id}/runs?limit=10&offset=0", headers=auth_headers)

    assert response.status_code == 200
    data = response.get_json()
    assert data["workflow_id"] == w_id
    assert len(data["runs"]) == 2
    assert data["runs"][0]["status"] == "success"
    assert data["runs"][0]["duration_seconds"] == 2.5
    assert data["runs"][0]["node_counts"]["success"] == 3
    assert data["runs"][1]["trigger_type"] == "webhook"
    assert data["limit"] == 10
    assert data["offset"] == 0
    mock_list.assert_called_once_with(w_id, limit=10, offset=0)


def test_list_workflow_runs_empty(client, auth_headers):
    w_id = str(uuid4())
    stored_workflow = {"workflow_id": w_id, "name": "Empty Flow"}

    with patch("app.routes.workflows.workflow_repo.get_workflow", return_value=stored_workflow), \
         patch("app.routes.workflows.workflow_repo.list_runs_for_workflow", return_value=[]):
        response = client.get(f"/workflows/{w_id}/runs", headers=auth_headers)

    assert response.status_code == 200
    data = response.get_json()
    assert data["workflow_id"] == w_id
    assert data["runs"] == []


def test_list_workflow_runs_workflow_not_found(client, auth_headers):
    w_id = str(uuid4())
    with patch("app.routes.workflows.workflow_repo.get_workflow", return_value=None):
        response = client.get(f"/workflows/{w_id}/runs", headers=auth_headers)

    assert response.status_code == 404
    assert "Workflow not found" in response.get_json()["error"]


def test_list_workflow_runs_invalid_pagination(client, auth_headers):
    w_id = str(uuid4())
    stored_workflow = {"workflow_id": w_id, "name": "Test Flow"}
    with patch("app.routes.workflows.workflow_repo.get_workflow", return_value=stored_workflow):
        response = client.get(f"/workflows/{w_id}/runs?limit=invalid", headers=auth_headers)

    assert response.status_code == 400
    assert "limit and offset must be integers" in response.get_json()["error"]


def test_list_workflow_runs_requires_auth(client):
    w_id = str(uuid4())
    response = client.get(f"/workflows/{w_id}/runs")
    assert response.status_code == 401


def test_run_history_zero_secret_leakage(client, auth_headers):
    w_id = str(uuid4())
    secret = "sk-super-secret-key-1234"
    stored_workflow = {"workflow_id": w_id, "name": "Secret Flow"}

    # Mock runs with redacted data
    mock_runs = [
        {
            "run_id": str(uuid4()),
            "workflow_id": w_id,
            "status": "success",
            "started_at": _now_iso(),
            "finished_at": _now_iso(),
            "duration_seconds": 0.5,
            "trigger_type": "manual",
            "node_counts": {"success": 1, "failed": 0, "skipped": 0, "total": 1},
        }
    ]

    with patch("app.routes.workflows.workflow_repo.get_workflow", return_value=stored_workflow), \
         patch("app.routes.workflows.workflow_repo.list_runs_for_workflow", return_value=mock_runs):
        response = client.get(f"/workflows/{w_id}/runs", headers=auth_headers)

    assert response.status_code == 200
    raw_text = response.get_data(as_text=True)
    assert secret not in raw_text

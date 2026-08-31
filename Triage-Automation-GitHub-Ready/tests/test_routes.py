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


def _sample_workflow_payload():
    return {
        "name": "Test Webhook Workflow",
        "version": 1,
        "trigger": {
            "type": "webhook",
            "config": {"webhook_path": "/test-hook"},
        },
        "nodes": [
            {
                "node_id": "node_1",
                "type": "delay",
                "name": "Delay Node",
                "config": {"duration_seconds": 0},
            }
        ],
        "edges": [],
    }


# ===========================================================================
# Auth Tests
# ===========================================================================


def test_auth_missing_header_returns_401(client):
    response = client.get("/workflows")
    assert response.status_code == 401
    assert "Missing X-API-Key" in response.get_json()["error"]


def test_auth_invalid_header_returns_401(client):
    response = client.get("/workflows", headers={"X-API-Key": "invalid-key"})
    assert response.status_code == 401
    assert "Invalid API key" in response.get_json()["error"]


# ===========================================================================
# POST /workflows
# ===========================================================================


def test_create_workflow_success(client, auth_headers):
    payload = _sample_workflow_payload()
    workflow_id = str(uuid4())

    with patch("app.routes.workflows.workflow_repo.create_workflow") as mock_create:
        mock_create.return_value = {
            "workflow_id": workflow_id,
            "name": payload["name"],
        }
        response = client.post("/workflows", json=payload, headers=auth_headers)

    assert response.status_code == 201
    data = response.get_json()
    assert data["workflow_id"] == workflow_id
    mock_create.assert_called_once()


def test_create_workflow_invalid_body_not_json(client, auth_headers):
    response = client.post(
        "/workflows",
        data="invalid-raw-string",
        content_type="text/plain",
        headers=auth_headers,
    )
    assert response.status_code == 400
    assert "Request body must be valid JSON" in response.get_json()["error"]


def test_create_workflow_invalid_schema_missing_fields(client, auth_headers):
    # Missing required trigger and nodes
    payload = {"name": "Incomplete Workflow"}
    response = client.post("/workflows", json=payload, headers=auth_headers)
    assert response.status_code == 400
    data = response.get_json()
    assert data["error"] == "Invalid workflow schema"
    assert "details" in data


def test_create_workflow_invalid_graph_cycle(client, auth_headers):
    payload = {
        "name": "Cyclic Workflow",
        "trigger": {"type": "manual", "config": {}},
        "nodes": [
            {"node_id": "a", "type": "delay", "name": "A", "config": {"duration_seconds": 0}},
            {"node_id": "b", "type": "delay", "name": "B", "config": {"duration_seconds": 0}},
        ],
        "edges": [
            {"from_node": "a", "to_node": "b"},
            {"from_node": "b", "to_node": "a"},
        ],
    }
    response = client.post("/workflows", json=payload, headers=auth_headers)
    assert response.status_code == 400
    data = response.get_json()
    assert data["error"] == "Invalid workflow graph"
    assert any("cycle" in d.lower() for d in data["details"])


# ===========================================================================
# GET /workflows & GET /workflows/<id>
# ===========================================================================


def test_list_workflows(client, auth_headers):
    mock_rows = [
        {"workflow_id": str(uuid4()), "name": "Workflow 1"},
        {"workflow_id": str(uuid4()), "name": "Workflow 2"},
    ]
    with patch("app.routes.workflows.workflow_repo.list_workflows", return_value=mock_rows) as mock_list:
        response = client.get("/workflows?limit=10&offset=0", headers=auth_headers)

    assert response.status_code == 200
    data = response.get_json()
    assert data["workflows"] == mock_rows
    assert data["limit"] == 10
    assert data["offset"] == 0
    mock_list.assert_called_once_with(limit=10, offset=0)


def test_list_workflows_invalid_pagination(client, auth_headers):
    response = client.get("/workflows?limit=abc", headers=auth_headers)
    assert response.status_code == 400
    assert "limit and offset must be integers" in response.get_json()["error"]


def test_get_workflow_found(client, auth_headers):
    w_id = str(uuid4())
    mock_row = {"workflow_id": w_id, "name": "Found Workflow"}
    with patch("app.routes.workflows.workflow_repo.get_workflow", return_value=mock_row):
        response = client.get(f"/workflows/{w_id}", headers=auth_headers)

    assert response.status_code == 200
    assert response.get_json()["workflow_id"] == w_id


def test_get_workflow_not_found(client, auth_headers):
    w_id = str(uuid4())
    with patch("app.routes.workflows.workflow_repo.get_workflow", return_value=None):
        response = client.get(f"/workflows/{w_id}", headers=auth_headers)

    assert response.status_code == 404
    assert "Workflow not found" in response.get_json()["error"]


# ===========================================================================
# POST /workflows/<id>/execute
# ===========================================================================


def test_execute_workflow_success(client, auth_headers):
    w_id = str(uuid4())
    stored_workflow = {
        "workflow_id": w_id,
        "name": "Executable Flow",
        "version": 1,
        "trigger": {"type": "manual", "config": {}},
        "nodes": [
            {
                "node_id": "n1",
                "type": "delay",
                "name": "Delay Node",
                "config": {"duration_seconds": 0},
                "on_error": "fail",
                "retry_count": 0,
            }
        ],
        "edges": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    with patch("app.routes.workflows.workflow_repo.get_workflow", return_value=stored_workflow), \
         patch("app.routes.workflows.workflow_repo.create_run") as mock_create_run, \
         patch("app.routes.workflows.workflow_repo.update_run") as mock_update_run, \
         patch("app.routes.workflows.workflow_repo.create_node_logs") as mock_create_logs:
        response = client.post(
            f"/workflows/{w_id}/execute",
            json={"trigger_payload": {"test": 123}},
            headers=auth_headers,
        )

    assert response.status_code == 200
    data = response.get_json()
    assert data["workflow_id"] == w_id
    assert data["status"] == "success"
    assert "run_id" in data
    mock_create_run.assert_called_once()
    mock_update_run.assert_called_once()
    mock_create_logs.assert_called_once()


def test_execute_workflow_not_found(client, auth_headers):
    w_id = str(uuid4())
    with patch("app.routes.workflows.workflow_repo.get_workflow", return_value=None):
        response = client.post(f"/workflows/{w_id}/execute", headers=auth_headers)

    assert response.status_code == 404
    assert "Workflow not found" in response.get_json()["error"]


def test_execute_workflow_node_failure_captured_in_run(client, auth_headers):
    w_id = str(uuid4())
    stored_workflow = {
        "workflow_id": w_id,
        "name": "Failing Flow",
        "version": 1,
        "trigger": {"type": "manual", "config": {}},
        "nodes": [
            {
                "node_id": "fail_node",
                "type": "code",
                "name": "Bad Code",
                "config": {"code": "raise ValueError('boom')", "timeout_seconds": 5},
                "on_error": "fail",
                "retry_count": 0,
            }
        ],
        "edges": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    with patch("app.routes.workflows.workflow_repo.get_workflow", return_value=stored_workflow), \
         patch("app.routes.workflows.workflow_repo.create_run"), \
         patch("app.routes.workflows.workflow_repo.update_run") as mock_update_run, \
         patch("app.routes.workflows.workflow_repo.create_node_logs"):
        response = client.post(f"/workflows/{w_id}/execute", headers=auth_headers)

    assert response.status_code == 200
    data = response.get_json()
    assert data["status"] == "failed"
    assert "error" in data
    # Verify update_run was called with status=failed
    _, update_kwargs = mock_update_run.call_args
    call_args_pos = mock_update_run.call_args[0]
    assert call_args_pos[1]["status"] == "failed"


# ===========================================================================
# GET /runs/<id>
# ===========================================================================


def test_get_run_found(client, auth_headers):
    run_id = str(uuid4())
    mock_run = {
        "run_id": run_id,
        "workflow_id": str(uuid4()),
        "status": "success",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "finished_at": datetime.now(timezone.utc).isoformat(),
        "trigger_payload": {},
        "node_logs": [
            {
                "node_id": "node_1",
                "status": "success",
                "output": {"slept_seconds": 0},
                "error": None,
            }
        ],
    }
    with patch("app.routes.runs.workflow_repo.get_run_with_logs", return_value=mock_run):
        response = client.get(f"/runs/{run_id}", headers=auth_headers)

    assert response.status_code == 200
    data = response.get_json()
    assert data["run_id"] == run_id
    assert len(data["node_logs"]) == 1


def test_get_run_not_found(client, auth_headers):
    run_id = str(uuid4())
    with patch("app.routes.runs.workflow_repo.get_run_with_logs", return_value=None):
        response = client.get(f"/runs/{run_id}", headers=auth_headers)

    assert response.status_code == 404
    assert "Run not found" in response.get_json()["error"]

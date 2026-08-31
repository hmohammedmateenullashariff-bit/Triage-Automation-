"""Workflow API endpoints.

Blueprint: ``/workflows``
"""

from __future__ import annotations

import secrets
from datetime import datetime, timezone
from uuid import uuid4

from flask import Blueprint, jsonify, request
from pydantic import ValidationError

from app.crypto import encrypt_value
from app.db import workflow_repo
from app.engine.executor import execute_workflow
from app.models.node import NodeDefinition
from app.models.workflow import (
    EdgeDefinition,
    TriggerConfig,
    WorkflowDefinition,
    validate_workflow_graph,
)
from app.routes.auth import require_api_key

workflows_bp = Blueprint("workflows", __name__, url_prefix="/workflows")
workflows_bp.before_request(require_api_key)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _format_workflow_response(row: dict) -> dict:
    """Format workflow record for API responses, redacting internal secrets."""
    formatted = dict(row)
    encrypted_secret = formatted.pop("encrypted_webhook_secret", None)
    trigger = formatted.get("trigger")
    webhook_token = formatted.get("webhook_token")

    if trigger:
        trigger_type = trigger.get("type", "manual")
        if trigger_type == "webhook" and webhook_token:
            formatted["webhook_url"] = f"/webhooks/{webhook_token}"
            formatted["has_secret"] = bool(encrypted_secret)
        elif trigger_type == "webhook":
            formatted["has_secret"] = bool(encrypted_secret)
        else:
            formatted["has_secret"] = False
    elif encrypted_secret is not None:
        formatted["has_secret"] = bool(encrypted_secret)

    return formatted


# ---------------------------------------------------------------------------
# POST /workflows  — create a new workflow
# ---------------------------------------------------------------------------


@workflows_bp.route("", methods=["POST"])
def create_workflow():
    body = request.get_json(silent=True)
    if not body:
        return jsonify({"error": "Request body must be valid JSON"}), 400

    # Inject defaults for optional fields so Pydantic can validate
    if "workflow_id" not in body:
        body["workflow_id"] = str(uuid4())
    now = _utcnow().isoformat()
    body.setdefault("created_at", now)
    body.setdefault("updated_at", now)

    # Pydantic validation
    try:
        workflow = WorkflowDefinition(**body)
    except ValidationError as exc:
        return jsonify({"error": "Invalid workflow schema", "details": exc.errors()}), 400

    # DAG validation
    graph_errors = validate_workflow_graph(workflow)
    hard_errors = [e for e in graph_errors if not e.startswith("WARNING:")]
    if hard_errors:
        return jsonify({"error": "Invalid workflow graph", "details": hard_errors}), 400

    # Persist
    try:
        row = workflow_repo.create_workflow(
            {
                "workflow_id": str(workflow.workflow_id),
                "name": workflow.name,
                "version": workflow.version,
                "trigger": workflow.trigger.model_dump(),
                "nodes": [n.model_dump() for n in workflow.nodes],
                "edges": [e.model_dump() for e in workflow.edges],
                "created_at": workflow.created_at.isoformat(),
                "updated_at": workflow.updated_at.isoformat(),
            }
        )
    except Exception as exc:
        return jsonify({"error": f"Failed to persist workflow: {exc}"}), 500

    warnings = [e for e in graph_errors if e.startswith("WARNING:")]
    response = {"workflow_id": row["workflow_id"]}
    if warnings:
        response["warnings"] = warnings
    return jsonify(response), 201


# ---------------------------------------------------------------------------
# GET /workflows  — list workflows (paginated)
# ---------------------------------------------------------------------------


@workflows_bp.route("", methods=["GET"])
def list_workflows():
    try:
        limit = int(request.args.get("limit", 20))
        offset = int(request.args.get("offset", 0))
    except (ValueError, TypeError):
        return jsonify({"error": "limit and offset must be integers"}), 400

    limit = max(1, min(limit, 100))  # clamp
    offset = max(0, offset)

    try:
        rows = workflow_repo.list_workflows(limit=limit, offset=offset)
        formatted_rows = [_format_workflow_response(r) for r in rows]
    except Exception as exc:
        return jsonify({"error": f"Failed to list workflows: {exc}"}), 500

    return jsonify({"workflows": formatted_rows, "limit": limit, "offset": offset}), 200


# ---------------------------------------------------------------------------
# GET /workflows/<id>  — fetch a single workflow
# ---------------------------------------------------------------------------


@workflows_bp.route("/<workflow_id>", methods=["GET"])
def get_workflow(workflow_id: str):
    try:
        row = workflow_repo.get_workflow(workflow_id)
    except Exception as exc:
        return jsonify({"error": f"Failed to fetch workflow: {exc}"}), 500

    if row is None:
        return jsonify({"error": f"Workflow not found: {workflow_id}"}), 404

    return jsonify(_format_workflow_response(row)), 200


# ---------------------------------------------------------------------------
# POST /workflows/<id>/execute  — run a workflow (manual trigger)
# ---------------------------------------------------------------------------


@workflows_bp.route("/<workflow_id>/execute", methods=["POST"])
def execute(workflow_id: str):
    # Load workflow from Supabase
    try:
        row = workflow_repo.get_workflow(workflow_id)
    except Exception as exc:
        return jsonify({"error": f"Failed to fetch workflow: {exc}"}), 500

    if row is None:
        return jsonify({"error": f"Workflow not found: {workflow_id}"}), 404

    # Rebuild WorkflowDefinition from the stored row
    try:
        workflow = WorkflowDefinition(
            workflow_id=row["workflow_id"],
            name=row["name"],
            version=row.get("version", 1),
            trigger=TriggerConfig(**row["trigger"]),
            nodes=[NodeDefinition(**n) for n in row["nodes"]],
            edges=[EdgeDefinition(**e) for e in row["edges"]],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )
    except Exception as exc:
        return jsonify({"error": f"Failed to parse stored workflow: {exc}"}), 500

    # Optional trigger payload from request body
    body = request.get_json(silent=True) or {}
    trigger_payload = body.get("trigger_payload", {})

    # Create a pending run record
    run_id = str(uuid4())
    started_at = _utcnow()
    try:
        workflow_repo.create_run(
            {
                "run_id": run_id,
                "workflow_id": str(workflow.workflow_id),
                "status": "running",
                "started_at": started_at.isoformat(),
                "trigger_payload": trigger_payload,
            }
        )
    except Exception as exc:
        return jsonify({"error": f"Failed to create run record: {exc}"}), 500

    # Execute the workflow
    try:
        result = execute_workflow(workflow, trigger_payload)
    except Exception as exc:
        # Infrastructure-level failure — mark run as failed
        finished_at = _utcnow()
        try:
            workflow_repo.update_run(
                run_id, {"status": "failed", "finished_at": finished_at.isoformat()}
            )
        except Exception:
            pass  # best-effort update
        return jsonify({"error": f"Execution engine error: {exc}"}), 500

    # Persist results
    finished_at = _utcnow()
    try:
        workflow_repo.update_run(
            run_id,
            {"status": result.status, "finished_at": finished_at.isoformat()},
        )
        workflow_repo.create_node_logs(
            [
                {
                    "run_id": run_id,
                    "node_id": log.node_id,
                    "status": log.status,
                    "output": log.output,
                    "error": log.error,
                    "started_at": log.started_at.isoformat(),
                    "finished_at": log.finished_at.isoformat() if log.finished_at else None,
                }
                for log in result.node_logs
            ]
        )
    except Exception as exc:
        return jsonify({"error": f"Failed to persist execution results: {exc}"}), 500

    response = {
        "run_id": run_id,
        "workflow_id": str(workflow.workflow_id),
        "status": result.status,
    }
    if result.error:
        response["error"] = result.error

    return jsonify(response), 200


# ---------------------------------------------------------------------------
# POST /workflows/<id>/webhook  — generate / configure webhook trigger
# ---------------------------------------------------------------------------


@workflows_bp.route("/<workflow_id>/webhook", methods=["POST"])
def configure_webhook(workflow_id: str):
    try:
        row = workflow_repo.get_workflow(workflow_id)
    except Exception as exc:
        return jsonify({"error": f"Failed to fetch workflow: {exc}"}), 500

    if row is None:
        return jsonify({"error": f"Workflow not found: {workflow_id}"}), 404

    body = request.get_json(silent=True) or {}
    secret_input = body.get("secret")
    generate_secret = body.get("generate_secret", False)

    plaintext_secret = None
    encrypted_secret = None

    if secret_input and isinstance(secret_input, str) and secret_input.strip():
        plaintext_secret = secret_input.strip()
    elif generate_secret:
        plaintext_secret = secrets.token_hex(20)

    if plaintext_secret:
        try:
            encrypted_secret = encrypt_value(plaintext_secret)
        except Exception as exc:
            return jsonify({"error": f"Failed to encrypt webhook secret: {exc}"}), 500

    webhook_token = secrets.token_urlsafe(24)
    trigger_config = {
        "type": "webhook",
        "config": {
            "webhook_token": webhook_token,
            "has_secret": bool(plaintext_secret),
        },
    }

    try:
        workflow_repo.update_workflow_webhook(
            workflow_id=workflow_id,
            webhook_token=webhook_token,
            encrypted_webhook_secret=encrypted_secret,
            trigger=trigger_config,
        )
    except Exception as exc:
        return jsonify({"error": f"Failed to configure webhook: {exc}"}), 500

    response = {
        "workflow_id": workflow_id,
        "trigger_type": "webhook",
        "webhook_token": webhook_token,
        "webhook_url": f"/webhooks/{webhook_token}",
        "has_secret": bool(plaintext_secret),
    }
    if plaintext_secret:
        response["secret"] = plaintext_secret

    return jsonify(response), 200


# ---------------------------------------------------------------------------
# DELETE /workflows/<id>/webhook  — revoke webhook trigger (reverts to manual)
# ---------------------------------------------------------------------------


@workflows_bp.route("/<workflow_id>/webhook", methods=["DELETE"])
def revoke_webhook(workflow_id: str):
    try:
        row = workflow_repo.get_workflow(workflow_id)
    except Exception as exc:
        return jsonify({"error": f"Failed to fetch workflow: {exc}"}), 500

    if row is None:
        return jsonify({"error": f"Workflow not found: {workflow_id}"}), 404

    trigger_config = {"type": "manual", "config": {}}
    try:
        workflow_repo.update_workflow_webhook(
            workflow_id=workflow_id,
            webhook_token=None,
            encrypted_webhook_secret=None,
            trigger=trigger_config,
        )
    except Exception as exc:
        return jsonify({"error": f"Failed to revoke webhook: {exc}"}), 500

    return jsonify({"message": "Webhook revoked successfully", "trigger_type": "manual"}), 200


# ---------------------------------------------------------------------------
# GET /workflows/<id>/runs  — list execution runs for a workflow (paginated)
# ---------------------------------------------------------------------------


@workflows_bp.route("/<workflow_id>/runs", methods=["GET"])
def list_workflow_runs(workflow_id: str):
    try:
        row = workflow_repo.get_workflow(workflow_id)
    except Exception as exc:
        return jsonify({"error": f"Failed to fetch workflow: {exc}"}), 500

    if row is None:
        return jsonify({"error": f"Workflow not found: {workflow_id}"}), 404

    try:
        limit = int(request.args.get("limit", 20))
        offset = int(request.args.get("offset", 0))
    except (ValueError, TypeError):
        return jsonify({"error": "limit and offset must be integers"}), 400

    limit = max(1, min(limit, 100))
    offset = max(0, offset)

    try:
        runs = workflow_repo.list_runs_for_workflow(workflow_id, limit=limit, offset=offset)
    except Exception as exc:
        return jsonify({"error": f"Failed to list workflow runs: {exc}"}), 500

    return jsonify({
        "workflow_id": workflow_id,
        "runs": runs,
        "limit": limit,
        "offset": offset,
    }), 200


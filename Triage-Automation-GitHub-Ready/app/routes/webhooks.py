"""Public Webhook Ingestion API endpoints.

Blueprint: ``/webhooks``
Authentication: Public / HMAC-SHA256 signature verification (when secret configured)
"""

from __future__ import annotations

import hashlib
import hmac
import threading
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from flask import Blueprint, current_app, jsonify, request

from app.crypto import decrypt_value
from app.db import workflow_repo
from app.engine.executor import execute_workflow
from app.models.node import NodeDefinition
from app.models.workflow import EdgeDefinition, TriggerConfig, WorkflowDefinition
from app.security.rate_limiter import global_rate_limiter

MAX_PAYLOAD_SIZE_BYTES = 1024 * 1024  # 1MB max body limit

webhooks_bp = Blueprint("webhooks", __name__, url_prefix="/webhooks")


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _run_workflow_in_background(
    app: Any,
    workflow: WorkflowDefinition,
    run_id: str,
    trigger_payload: dict,
) -> None:
    """Worker function executed in a background thread."""
    with app.app_context():
        try:
            result = execute_workflow(workflow, trigger_payload)
            finished_at = _utcnow_iso()
            workflow_repo.update_run(
                run_id,
                {"status": result.status, "finished_at": finished_at},
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
        except Exception:
            finished_at = _utcnow_iso()
            try:
                workflow_repo.update_run(
                    run_id,
                    {"status": "failed", "finished_at": finished_at},
                )
            except Exception:
                pass


@webhooks_bp.route("/<webhook_token>", methods=["POST"])
def trigger_webhook(webhook_token: str):
    # 1. Payload size check (before parsing body into memory)
    content_length = request.content_length
    if content_length and content_length > MAX_PAYLOAD_SIZE_BYTES:
        return jsonify({"error": "Payload exceeds 1MB limit"}), 413

    raw_body = request.get_data()
    if len(raw_body) > MAX_PAYLOAD_SIZE_BYTES:
        return jsonify({"error": "Payload exceeds 1MB limit"}), 413

    # 2. Rate limiting check
    if global_rate_limiter.is_rate_limited(webhook_token):
        return jsonify({"error": "Too many requests. Rate limit exceeded."}), 429

    # 3. Lookup workflow by webhook_token (fail fast with generic 404)
    try:
        row = workflow_repo.get_workflow_by_webhook_token(webhook_token)
    except Exception as exc:
        return jsonify({"error": f"Database error: {exc}"}), 500

    if not row:
        return jsonify({"error": "Webhook not found"}), 404

    # Ensure trigger is active webhook
    trigger_type = row.get("trigger", {}).get("type")
    if trigger_type != "webhook":
        return jsonify({"error": "Webhook not found"}), 404

    # 4. Signature verification (if webhook_secret configured)
    encrypted_secret = row.get("encrypted_webhook_secret")
    if encrypted_secret:
        try:
            secret = decrypt_value(encrypted_secret)
        except Exception:
            return jsonify({"error": "Failed to verify webhook secret"}), 500

        sig_header = (
            request.headers.get("X-Webhook-Signature")
            or request.headers.get("X-Hub-Signature-256")
            or request.headers.get("X-Signature-256")
        )
        if not sig_header:
            return jsonify({"error": "Missing webhook signature header"}), 401

        provided_sig = sig_header.strip()
        if provided_sig.startswith("sha256="):
            provided_sig = provided_sig[7:]

        expected_sig = hmac.new(
            secret.encode("utf-8"),
            raw_body,
            hashlib.sha256,
        ).hexdigest()

        if not hmac.compare_digest(provided_sig, expected_sig):
            return jsonify({"error": "Invalid webhook signature"}), 401

    # 5. Parse JSON payload
    if raw_body:
        trigger_payload = request.get_json(silent=True)
        if trigger_payload is None:
            return jsonify({"error": "Invalid JSON payload"}), 400
    else:
        trigger_payload = {}

    # 6. Rebuild WorkflowDefinition
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

    # 7. Create execution run record
    run_id = str(uuid4())
    started_at = _utcnow_iso()
    stored_payload = dict(trigger_payload)
    stored_payload["__trigger_type__"] = "webhook"
    try:
        workflow_repo.create_run(
            {
                "run_id": run_id,
                "workflow_id": str(workflow.workflow_id),
                "status": "running",
                "started_at": started_at,
                "trigger_payload": stored_payload,
            }
        )
    except Exception as exc:
        return jsonify({"error": f"Failed to create run record: {exc}"}), 500

    # 8. Asynchronous / Non-blocking execution
    # In testing mode or when SYNCHRONOUS_EXECUTION config is True, run directly for test assertions
    if current_app.config.get("TESTING_SYNC_EXECUTION"):
        _run_workflow_in_background(
            current_app._get_current_object(), workflow, run_id, trigger_payload
        )
    else:
        worker_thread = threading.Thread(
            target=_run_workflow_in_background,
            args=(current_app._get_current_object(), workflow, run_id, trigger_payload),
            daemon=True,
        )
        worker_thread.start()

    # 9. Return 202 Accepted immediately
    return (
        jsonify(
            {
                "run_id": run_id,
                "workflow_id": str(workflow.workflow_id),
                "status": "running",
            }
        ),
        202,
    )

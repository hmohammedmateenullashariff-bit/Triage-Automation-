"""Repository layer for Supabase CRUD operations.

All Supabase table interactions are isolated here so that routes stay clean
and tests can mock at the function boundary without a live database.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from app.db.supabase_client import get_supabase_client


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Workflows
# ---------------------------------------------------------------------------


def create_workflow(data: dict[str, Any]) -> dict[str, Any]:
    """Insert a workflow row and return the persisted record."""
    client = get_supabase_client()
    row = {
        "workflow_id": str(data["workflow_id"]),
        "name": data["name"],
        "version": data.get("version", 1),
        "trigger": data["trigger"],
        "nodes": data["nodes"],
        "edges": data["edges"],
        "webhook_token": data.get("webhook_token"),
        "encrypted_webhook_secret": data.get("encrypted_webhook_secret"),
        "created_at": data.get("created_at", _utcnow_iso()),
        "updated_at": data.get("updated_at", _utcnow_iso()),
    }
    result = client.table("workflows").insert(row).execute()
    return result.data[0]


def update_workflow(workflow_id: str | UUID, data: dict[str, Any]) -> dict[str, Any]:
    """Update fields on an existing workflow."""
    client = get_supabase_client()
    payload = dict(data)
    payload["updated_at"] = payload.get("updated_at", _utcnow_iso())
    result = (
        client.table("workflows")
        .update(payload)
        .eq("workflow_id", str(workflow_id))
        .execute()
    )
    return result.data[0] if result.data else {}


def get_workflow(workflow_id: str | UUID) -> dict[str, Any] | None:
    """Fetch a single workflow by ID.  Returns ``None`` if not found."""
    client = get_supabase_client()
    result = (
        client.table("workflows")
        .select("*")
        .eq("workflow_id", str(workflow_id))
        .execute()
    )
    if result.data:
        return result.data[0]
    return None


def get_workflow_by_webhook_token(webhook_token: str) -> dict[str, Any] | None:
    """Fetch a single workflow by its public webhook token."""
    if not webhook_token:
        return None
    client = get_supabase_client()
    result = (
        client.table("workflows")
        .select("*")
        .eq("webhook_token", str(webhook_token))
        .execute()
    )
    if result.data:
        return result.data[0]
    return None


def update_workflow_webhook(
    workflow_id: str | UUID,
    webhook_token: str | None,
    encrypted_webhook_secret: str | None,
    trigger: dict[str, Any],
) -> dict[str, Any]:
    """Update or revoke webhook configuration for a workflow."""
    client = get_supabase_client()
    row = {
        "webhook_token": webhook_token,
        "encrypted_webhook_secret": encrypted_webhook_secret,
        "trigger": trigger,
        "updated_at": _utcnow_iso(),
    }
    result = (
        client.table("workflows")
        .update(row)
        .eq("workflow_id", str(workflow_id))
        .execute()
    )
    return result.data[0] if result.data else {}


def list_workflows(limit: int = 20, offset: int = 0) -> list[dict[str, Any]]:
    """Return a paginated list of workflows, newest first."""
    client = get_supabase_client()
    result = (
        client.table("workflows")
        .select("*")
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    return result.data


# ---------------------------------------------------------------------------
# Execution Runs
# ---------------------------------------------------------------------------


def create_run(run_data: dict[str, Any]) -> dict[str, Any]:
    """Insert an execution run record."""
    client = get_supabase_client()
    row = {
        "run_id": str(run_data["run_id"]),
        "workflow_id": str(run_data["workflow_id"]),
        "status": run_data["status"],
        "started_at": run_data.get("started_at", _utcnow_iso()),
        "finished_at": run_data.get("finished_at"),
        "trigger_payload": run_data.get("trigger_payload", {}),
    }
    result = client.table("execution_runs").insert(row).execute()
    return result.data[0]


def update_run(run_id: str | UUID, data: dict[str, Any]) -> dict[str, Any]:
    """Update fields on an existing run (e.g. status, finished_at, error)."""
    client = get_supabase_client()
    result = (
        client.table("execution_runs")
        .update(data)
        .eq("run_id", str(run_id))
        .execute()
    )
    return result.data[0]


def get_run(run_id: str | UUID) -> dict[str, Any] | None:
    """Fetch a run by ID.  Returns ``None`` if not found."""
    client = get_supabase_client()
    result = (
        client.table("execution_runs")
        .select("*")
        .eq("run_id", str(run_id))
        .execute()
    )
    if not result.data:
        return None
    return result.data[0]


def get_run_with_logs(run_id: str | UUID) -> dict[str, Any] | None:
    """Fetch a run and its node execution logs.  Returns ``None`` if not found."""
    run = get_run(run_id)
    if run is None:
        return None

    client = get_supabase_client()
    logs_result = (
        client.table("node_execution_logs")
        .select("*")
        .eq("run_id", str(run_id))
        .order("started_at", desc=False)
        .execute()
    )
    run["node_logs"] = logs_result.data
    return run


def list_runs_for_workflow(
    workflow_id: str | UUID,
    limit: int = 20,
    offset: int = 0,
) -> list[dict[str, Any]]:
    """Return a paginated list of execution runs for a workflow, newest first.

    Calculates duration and aggregates pass/fail/skip node counts.
    """
    client = get_supabase_client()
    runs_result = (
        client.table("execution_runs")
        .select("*")
        .eq("workflow_id", str(workflow_id))
        .order("started_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    runs = runs_result.data or []
    if not runs:
        return []

    run_ids = [r["run_id"] for r in runs]
    logs_result = (
        client.table("node_execution_logs")
        .select("run_id, status")
        .in_("run_id", run_ids)
        .execute()
    )
    logs_by_run: dict[str, list[str]] = {}
    for log in logs_result.data or []:
        logs_by_run.setdefault(log["run_id"], []).append(log["status"])

    formatted_runs = []
    for r in runs:
        started = r.get("started_at")
        finished = r.get("finished_at")
        duration = None
        if started and finished:
            try:
                start_dt = datetime.fromisoformat(started)
                end_dt = datetime.fromisoformat(finished)
                duration = round((end_dt - start_dt).total_seconds(), 3)
            except Exception:
                duration = None

        node_statuses = logs_by_run.get(r["run_id"], [])
        success_count = sum(1 for s in node_statuses if s == "success")
        failed_count = sum(1 for s in node_statuses if s == "failed")
        skipped_count = sum(1 for s in node_statuses if s == "skipped")

        trigger_payload = r.get("trigger_payload") or {}
        trigger_type = trigger_payload.get("__trigger_type__", "manual")

        formatted_runs.append({
            "run_id": r["run_id"],
            "workflow_id": r["workflow_id"],
            "status": r["status"],
            "started_at": started,
            "finished_at": finished,
            "duration_seconds": duration,
            "trigger_type": trigger_type,
            "node_counts": {
                "success": success_count,
                "failed": failed_count,
                "skipped": skipped_count,
                "total": len(node_statuses),
            },
        })

    return formatted_runs


# ---------------------------------------------------------------------------
# Node Execution Logs
# ---------------------------------------------------------------------------


def create_node_logs(logs: list[dict[str, Any]]) -> None:
    """Batch insert node execution log records."""
    if not logs:
        return
    client = get_supabase_client()
    rows = [
        {
            "run_id": str(log["run_id"]),
            "node_id": log["node_id"],
            "status": log["status"],
            "output": log.get("output"),
            "error": log.get("error"),
            "started_at": log.get("started_at", _utcnow_iso()),
            "finished_at": log.get("finished_at"),
        }
        for log in logs
    ]
    client.table("node_execution_logs").insert(rows).execute()


# ---------------------------------------------------------------------------
# Credentials
# ---------------------------------------------------------------------------


def create_credential(data: dict[str, Any]) -> dict[str, Any]:
    """Insert a credential row.  ``encrypted_value`` must already be encrypted."""
    client = get_supabase_client()
    row = {
        "credential_id": str(data["credential_id"]),
        "name": data["name"],
        "type": data["type"],
        "encrypted_value": data["encrypted_value"],
        "created_at": data.get("created_at", _utcnow_iso()),
        "updated_at": data.get("updated_at", _utcnow_iso()),
    }
    result = client.table("credentials").insert(row).execute()
    return result.data[0]


def list_credentials() -> list[dict[str, Any]]:
    """Return all credentials — metadata only, never encrypted_value."""
    client = get_supabase_client()
    result = (
        client.table("credentials")
        .select("credential_id, name, type, created_at, updated_at")
        .order("created_at", desc=True)
        .execute()
    )
    return result.data


def delete_credential(credential_id: str | UUID) -> bool:
    """Delete a credential by ID.  Returns True if a row was deleted."""
    client = get_supabase_client()
    result = (
        client.table("credentials")
        .delete()
        .eq("credential_id", str(credential_id))
        .execute()
    )
    return len(result.data) > 0


def get_credential_encrypted(credential_id: str | UUID) -> dict[str, Any] | None:
    """Fetch a credential including encrypted_value.

    This is an INTERNAL function used only by node execution logic to
    decrypt the value at runtime.  It must NEVER be exposed via API routes.
    """
    client = get_supabase_client()
    result = (
        client.table("credentials")
        .select("*")
        .eq("credential_id", str(credential_id))
        .execute()
    )
    if result.data:
        return result.data[0]
    return None


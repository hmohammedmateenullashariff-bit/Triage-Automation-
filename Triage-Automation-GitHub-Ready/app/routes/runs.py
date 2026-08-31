"""Execution run API endpoints.

Blueprint: ``/runs``
"""

from __future__ import annotations

from flask import Blueprint, jsonify

from app.db import workflow_repo
from app.routes.auth import require_api_key

runs_bp = Blueprint("runs", __name__, url_prefix="/runs")
runs_bp.before_request(require_api_key)


# ---------------------------------------------------------------------------
# GET /runs/<id>  — fetch run status and per-node logs
# ---------------------------------------------------------------------------


@runs_bp.route("/<run_id>", methods=["GET"])
def get_run(run_id: str):
    try:
        run = workflow_repo.get_run_with_logs(run_id)
    except Exception as exc:
        return jsonify({"error": f"Failed to fetch run: {exc}"}), 500

    if run is None:
        return jsonify({"error": f"Run not found: {run_id}"}), 404

    return jsonify(run), 200

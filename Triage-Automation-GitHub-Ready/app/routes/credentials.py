"""Credential API endpoints.

Blueprint: ``/credentials``
"""

from __future__ import annotations

from uuid import uuid4

from flask import Blueprint, jsonify, request

from app.crypto import encrypt_value
from app.db import workflow_repo
from app.routes.auth import require_api_key

VALID_CREDENTIAL_TYPES = {"api_key", "bearer_token", "basic_auth", "custom_header"}

credentials_bp = Blueprint("credentials", __name__, url_prefix="/credentials")
credentials_bp.before_request(require_api_key)


# ---------------------------------------------------------------------------
# POST /credentials  — create a new credential (encrypt before storage)
# ---------------------------------------------------------------------------


@credentials_bp.route("", methods=["POST"])
def create_credential():
    body = request.get_json(silent=True)
    if not body:
        return jsonify({"error": "Request body must be valid JSON"}), 400

    name = body.get("name")
    cred_type = body.get("type")
    value = body.get("value")

    # Validation
    errors = []
    if not name or not isinstance(name, str):
        errors.append("name is required and must be a string")
    if cred_type not in VALID_CREDENTIAL_TYPES:
        errors.append(f"type must be one of: {sorted(VALID_CREDENTIAL_TYPES)}")
    if not value or not isinstance(value, str):
        errors.append("value is required and must be a string")
    if errors:
        return jsonify({"error": "Invalid credential", "details": errors}), 400

    # Encrypt the secret value
    try:
        encrypted = encrypt_value(value)
    except Exception as exc:
        return jsonify({"error": f"Encryption failed: {exc}"}), 500

    credential_id = str(uuid4())
    try:
        row = workflow_repo.create_credential(
            {
                "credential_id": credential_id,
                "name": name,
                "type": cred_type,
                "encrypted_value": encrypted,
            }
        )
    except Exception as exc:
        return jsonify({"error": f"Failed to persist credential: {exc}"}), 500

    # Return metadata ONLY — never the value or encrypted_value
    return (
        jsonify(
            {
                "credential_id": row["credential_id"],
                "name": row["name"],
                "type": row["type"],
                "created_at": row.get("created_at"),
                "updated_at": row.get("updated_at"),
            }
        ),
        201,
    )


# ---------------------------------------------------------------------------
# GET /credentials  — list all credentials (metadata only)
# ---------------------------------------------------------------------------


@credentials_bp.route("", methods=["GET"])
def list_credentials():
    try:
        rows = workflow_repo.list_credentials()
    except Exception as exc:
        return jsonify({"error": f"Failed to list credentials: {exc}"}), 500

    return jsonify({"credentials": rows}), 200


# ---------------------------------------------------------------------------
# DELETE /credentials/<id>  — delete a credential
# ---------------------------------------------------------------------------


@credentials_bp.route("/<credential_id>", methods=["DELETE"])
def delete_credential(credential_id: str):
    try:
        deleted = workflow_repo.delete_credential(credential_id)
    except Exception as exc:
        return jsonify({"error": f"Failed to delete credential: {exc}"}), 500

    if not deleted:
        return jsonify({"error": f"Credential not found: {credential_id}"}), 404

    return "", 204

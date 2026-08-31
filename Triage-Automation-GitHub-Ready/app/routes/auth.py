"""API-key authentication middleware for Flask.

Checks the ``X-API-Key`` header against the configured key using
timing-safe comparison to prevent timing attacks.
"""

from __future__ import annotations

import hmac

from flask import current_app, jsonify, request


def require_api_key() -> tuple | None:
    """Flask ``before_request`` handler.

    Returns a 401 JSON response if the API key is missing or invalid.
    Returns ``None`` (allowing the request to proceed) if authentication passes.
    """
    api_key = request.headers.get("X-API-Key")
    expected = current_app.config.get("API_KEY", "")

    if not api_key:
        return jsonify({"error": "Missing X-API-Key header"}), 401

    if not hmac.compare_digest(api_key, expected):
        return jsonify({"error": "Invalid API key"}), 401

    return None

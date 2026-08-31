"""Tests for credential CRUD API and encryption round-trip."""

from unittest.mock import patch
from uuid import uuid4

import pytest

from app import create_app
from app.crypto import encrypt_value, decrypt_value


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


# ===========================================================================
# Encryption round-trip
# ===========================================================================


def test_encryption_round_trip():
    """Encrypt → decrypt → original value matches."""
    original = "sk-super-secret-api-key-12345"
    with patch.dict("os.environ", {"CREDENTIAL_ENCRYPTION_KEY": "cM_pCqppXQFCIZyCX01Avj0hK7fG9ObKaKWbZzbRISM="}):
        encrypted = encrypt_value(original)
        # Ciphertext must not equal plaintext
        assert encrypted != original
        # Decrypt must return the original
        decrypted = decrypt_value(encrypted)
        assert decrypted == original


def test_encryption_ciphertext_is_not_plaintext():
    """The encrypted value must never contain the original plaintext."""
    secret = "my-password-123"
    with patch.dict("os.environ", {"CREDENTIAL_ENCRYPTION_KEY": "cM_pCqppXQFCIZyCX01Avj0hK7fG9ObKaKWbZzbRISM="}):
        encrypted = encrypt_value(secret)
        assert secret not in encrypted


# ===========================================================================
# POST /credentials
# ===========================================================================


def test_create_credential_success(client, auth_headers):
    payload = {"name": "My API Key", "type": "api_key", "value": "sk-secret-value-999"}
    cred_id = str(uuid4())

    with patch("app.routes.credentials.encrypt_value", return_value="encrypted-blob") as mock_enc, \
         patch("app.routes.credentials.workflow_repo.create_credential") as mock_create:
        mock_create.return_value = {
            "credential_id": cred_id,
            "name": "My API Key",
            "type": "api_key",
            "created_at": "2026-01-01T00:00:00Z",
            "updated_at": "2026-01-01T00:00:00Z",
        }
        response = client.post("/credentials", json=payload, headers=auth_headers)

    assert response.status_code == 201
    data = response.get_json()
    assert data["credential_id"] == cred_id
    assert data["name"] == "My API Key"
    assert data["type"] == "api_key"
    # CRITICAL: value must NEVER appear in response
    assert "value" not in data
    assert "encrypted_value" not in data
    assert "sk-secret-value-999" not in response.get_data(as_text=True)
    mock_enc.assert_called_once_with("sk-secret-value-999")


def test_create_credential_response_never_contains_value(client, auth_headers):
    """The raw secret must not appear anywhere in the HTTP response."""
    secret = "super-secret-password-xyz"
    payload = {"name": "Test Cred", "type": "bearer_token", "value": secret}

    with patch("app.routes.credentials.encrypt_value", return_value="enc-ciphertext"), \
         patch("app.routes.credentials.workflow_repo.create_credential") as mock_create:
        mock_create.return_value = {
            "credential_id": str(uuid4()),
            "name": "Test Cred",
            "type": "bearer_token",
            "created_at": "2026-01-01T00:00:00Z",
            "updated_at": "2026-01-01T00:00:00Z",
        }
        response = client.post("/credentials", json=payload, headers=auth_headers)

    raw_response = response.get_data(as_text=True)
    assert secret not in raw_response
    assert "enc-ciphertext" not in raw_response


def test_create_credential_invalid_body(client, auth_headers):
    # Empty body — missing all required fields
    payload = {"name": ""}  # name empty, type and value missing
    response = client.post("/credentials", json=payload, headers=auth_headers)
    assert response.status_code == 400
    data = response.get_json()
    assert "error" in data


def test_create_credential_invalid_type(client, auth_headers):
    payload = {"name": "Test", "type": "invalid_type", "value": "secret"}
    response = client.post("/credentials", json=payload, headers=auth_headers)
    assert response.status_code == 400


# ===========================================================================
# GET /credentials
# ===========================================================================


def test_list_credentials_returns_metadata_only(client, auth_headers):
    mock_rows = [
        {"credential_id": str(uuid4()), "name": "Key 1", "type": "api_key",
         "created_at": "2026-01-01T00:00:00Z", "updated_at": "2026-01-01T00:00:00Z"},
        {"credential_id": str(uuid4()), "name": "Key 2", "type": "bearer_token",
         "created_at": "2026-01-01T00:00:00Z", "updated_at": "2026-01-01T00:00:00Z"},
    ]
    with patch("app.routes.credentials.workflow_repo.list_credentials", return_value=mock_rows):
        response = client.get("/credentials", headers=auth_headers)

    assert response.status_code == 200
    data = response.get_json()
    assert len(data["credentials"]) == 2
    # No encrypted_value or value in any row
    raw_text = response.get_data(as_text=True)
    assert "encrypted_value" not in raw_text
    assert "value" not in raw_text or '"value"' not in raw_text


# ===========================================================================
# DELETE /credentials/<id>
# ===========================================================================


def test_delete_credential_success(client, auth_headers):
    cred_id = str(uuid4())
    with patch("app.routes.credentials.workflow_repo.delete_credential", return_value=True):
        response = client.delete(f"/credentials/{cred_id}", headers=auth_headers)
    assert response.status_code == 204


def test_delete_credential_not_found(client, auth_headers):
    cred_id = str(uuid4())
    with patch("app.routes.credentials.workflow_repo.delete_credential", return_value=False):
        response = client.delete(f"/credentials/{cred_id}", headers=auth_headers)
    assert response.status_code == 404
    assert "not found" in response.get_json()["error"].lower()


# ===========================================================================
# Auth required
# ===========================================================================


def test_credentials_require_auth(client):
    response = client.get("/credentials")
    assert response.status_code == 401

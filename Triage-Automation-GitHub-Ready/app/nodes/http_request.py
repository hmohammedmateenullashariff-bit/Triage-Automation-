import json

import requests

from app.crypto import decrypt_value
from app.db import workflow_repo
from app.nodes.base import BaseNode, ExecutionContext, NodeOutput
from app.nodes.registry import register_node

VALID_METHODS = {"GET", "POST", "PUT", "DELETE", "PATCH"}

# Sentinel used to track which header keys were injected from credentials
_CREDENTIAL_REDACTION_MARKER = "[REDACTED]"


def _resolve_credential(credential_id: str) -> tuple[str, str]:
    """Fetch and decrypt a credential by ID.

    Returns (credential_type, decrypted_value).
    Raises RuntimeError if the credential is not found or decryption fails.
    """
    row = workflow_repo.get_credential_encrypted(credential_id)
    if row is None:
        raise RuntimeError(f"Credential not found: {credential_id}")

    try:
        plaintext = decrypt_value(row["encrypted_value"])
    except Exception:
        raise RuntimeError(f"Failed to decrypt credential: {credential_id}")

    return row["type"], plaintext


def _inject_credential_header(
    headers: dict[str, str],
    cred_type: str,
    cred_value: str,
) -> set[str]:
    """Inject a credential into the headers dict based on type.

    Returns the set of header keys that were injected (for redaction).
    """
    injected_keys: set[str] = set()

    if cred_type == "bearer_token":
        headers["Authorization"] = f"Bearer {cred_value}"
        injected_keys.add("Authorization")
    elif cred_type == "api_key":
        headers["Authorization"] = f"ApiKey {cred_value}"
        injected_keys.add("Authorization")
    elif cred_type == "basic_auth":
        headers["Authorization"] = f"Basic {cred_value}"
        injected_keys.add("Authorization")
    elif cred_type == "custom_header":
        # For custom_header, the value format is "Header-Name: value"
        if ":" in cred_value:
            header_name, header_val = cred_value.split(":", 1)
            headers[header_name.strip()] = header_val.strip()
            injected_keys.add(header_name.strip())
        else:
            headers["X-Custom-Auth"] = cred_value
            injected_keys.add("X-Custom-Auth")

    return injected_keys


def _redact_headers(headers: dict[str, str], keys_to_redact: set[str]) -> dict[str, str]:
    """Return a copy of headers with credential-injected values redacted."""
    redacted = dict(headers)
    for key in keys_to_redact:
        if key in redacted:
            redacted[key] = _CREDENTIAL_REDACTION_MARKER
    return redacted


@register_node("http_request")
class HttpRequestNode(BaseNode):
    def validate(self, config: dict) -> list[str]:
        errors: list[str] = []
        if not config.get("url"):
            errors.append("url is required")
        method = config.get("method", "GET")
        if method not in VALID_METHODS:
            errors.append(f"method must be one of {sorted(VALID_METHODS)}")
        timeout = config.get("timeout_seconds", 30)
        if not isinstance(timeout, (int, float)) or timeout <= 0:
            errors.append("timeout_seconds must be a positive number")
        return errors

    def execute(self, config: dict, context: ExecutionContext) -> NodeOutput:
        try:
            resolved = context.resolve_template(config)
            url = resolved["url"]
            method = resolved.get("method", "GET")
            headers = dict(resolved.get("headers") or {})
            body = resolved.get("body")
            timeout = resolved.get("timeout_seconds", 30)
            credential_id = resolved.get("credential_id")

            # Credential injection
            redacted_keys: set[str] = set()
            if credential_id:
                try:
                    cred_type, cred_value = _resolve_credential(credential_id)
                    redacted_keys = _inject_credential_header(headers, cred_type, cred_value)
                except RuntimeError as cred_err:
                    return NodeOutput(success=False, error=str(cred_err))

            request_kwargs: dict = {"method": method, "url": url, "headers": headers, "timeout": timeout}
            if body is not None and method in {"POST", "PUT", "PATCH", "DELETE"}:
                request_kwargs["json"] = body

            response = requests.request(**request_kwargs)
            try:
                response_body = response.json()
            except ValueError:
                response_body = response.text

            # Redact credential-injected headers in output to prevent leakage
            safe_request_headers = _redact_headers(headers, redacted_keys)
            safe_response_headers = dict(response.headers)

            return NodeOutput(
                success=True,
                data={
                    "status_code": response.status_code,
                    "body": response_body,
                    "headers": safe_response_headers,
                    "request_headers": safe_request_headers,
                },
            )
        except requests.exceptions.Timeout as exc:
            return NodeOutput(success=False, error=f"Request timed out: {exc}")
        except requests.exceptions.RequestException as exc:
            return NodeOutput(success=False, error=f"Request failed: {exc}")
        except Exception as exc:
            return NodeOutput(success=False, error=str(exc))

    def get_schema(self) -> dict:
        return {
            "type": "object",
            "required": ["url"],
            "properties": {
                "url": {"type": "string", "description": "Request URL (template-resolvable)"},
                "method": {
                    "type": "string",
                    "enum": sorted(VALID_METHODS),
                    "default": "GET",
                },
                "headers": {"type": "object", "additionalProperties": {"type": "string"}},
                "body": {"type": "object"},
                "timeout_seconds": {"type": "number", "default": 30, "minimum": 1},
                "credential_id": {
                    "type": "string",
                    "description": "UUID of a stored credential to inject into request headers",
                },
            },
        }

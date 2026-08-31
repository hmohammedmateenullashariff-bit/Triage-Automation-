from datetime import datetime, timezone
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
import requests

from app.models.node import NodeDefinition
from app.models.workflow import EdgeDefinition, TriggerConfig, WorkflowDefinition
from app.nodes.base import ExecutionContext, TemplateResolutionError
from app.nodes.conditional import ConditionalNode, evaluate_condition
from app.nodes.http_request import HttpRequestNode
from app.nodes.registry import get_node_class
from app.nodes.delay import DelayNode
from app.nodes.code import CodeNode
from app.nodes.llm import LlmNode

import app.nodes  # noqa: F401


def _now() -> datetime:
    return datetime.now(timezone.utc)


class TestResolveTemplate:
    def setup_method(self) -> None:
        self.context = ExecutionContext(
            trigger={"event": "signup"},
            node_outputs={
                "n1": {"score": 85, "user": {"email": "a@example.com"}},
                "n2": {"items": [{"id": 1}, {"id": 2}]},
            },
        )

    def test_simple_substitution(self):
        assert self.context.resolve_template("{{n1.output.score}}") == 85

    def test_nested_field_access(self):
        assert self.context.resolve_template("{{n1.output.user.email}}") == "a@example.com"

    def test_templates_inside_lists(self):
        result = self.context.resolve_template(["{{n1.output.score}}", "static"])
        assert result == [85, "static"]

    def test_templates_inside_nested_dicts(self):
        result = self.context.resolve_template({"meta": {"email": "{{n1.output.user.email}}"}})
        assert result == {"meta": {"email": "a@example.com"}}

    def test_missing_reference_raises_clear_error(self):
        with pytest.raises(TemplateResolutionError, match="Unknown node reference"):
            self.context.resolve_template("{{missing.output.field}}")

        with pytest.raises(TemplateResolutionError, match="Missing field"):
            self.context.resolve_template("{{n1.output.user.phone}}")

    def test_trigger_payload_access(self):
        assert self.context.resolve_template("{{trigger.event}}") == "signup"


class TestHttpRequestNode:
    def test_success(self):
        node = HttpRequestNode()
        context = ExecutionContext(trigger={})
        config = {"url": "https://example.com", "method": "GET"}

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"ok": True}
        mock_response.headers = {"Content-Type": "application/json"}

        with patch("app.nodes.http_request.requests.request", return_value=mock_response) as mock_req:
            output = node.execute(config, context)

        assert output.success is True
        assert output.data["status_code"] == 200
        assert output.data["body"] == {"ok": True}
        mock_req.assert_called_once()

    def test_connection_error(self):
        node = HttpRequestNode()
        context = ExecutionContext(trigger={})
        config = {"url": "https://example.com", "method": "GET"}

        with patch(
            "app.nodes.http_request.requests.request",
            side_effect=requests.exceptions.ConnectionError("connection refused"),
        ):
            output = node.execute(config, context)

        assert output.success is False
        assert "connection refused" in (output.error or "")


class TestConditionalNode:
    def test_success_true_branch(self):
        node = ConditionalNode()
        context = ExecutionContext(trigger={}, node_outputs={"n1": {"score": 85}})
        output = node.execute({"condition": "{{n1.output.score}} > 70"}, context)
        assert output.success is True
        assert output.data["branch"] == "true"

    def test_invalid_condition(self):
        node = ConditionalNode()
        context = ExecutionContext(trigger={})
        output = node.execute({"condition": "not a comparison"}, context)
        assert output.success is False


class TestCodeNode:
    def test_success(self):
        node = CodeNode()
        context = ExecutionContext(trigger={"x": 21}, node_outputs={})
        code = "result = {'doubled': input_data['trigger']['x'] * 2}"
        output = node.execute({"code": code, "timeout_seconds": 10}, context)
        assert output.success is True
        assert output.data == {"doubled": 42}

    def test_syntax_error(self):
        node = CodeNode()
        context = ExecutionContext(trigger={})
        output = node.execute({"code": "def broken(", "timeout_seconds": 5}, context)
        assert output.success is False
        assert output.error


class TestDelayNode:
    def test_success(self):
        node = DelayNode()
        context = ExecutionContext(trigger={})
        output = node.execute({"duration_seconds": 0}, context)
        assert output.success is True
        assert output.data["slept_seconds"] == 0

    def test_validation_error(self):
        node = DelayNode()
        assert "duration_seconds is required" in node.validate({})


class TestLlmNode:
    def test_success(self):
        node = LlmNode()
        mock_message = MagicMock()
        mock_message.content = [MagicMock(text="Hello from LLM")]

        with patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key"}):
            assert node.validate({"prompt": "Hi"}) == []
            with patch("anthropic.Anthropic") as mock_client_cls:
                mock_client_cls.return_value.messages.create.return_value = mock_message
                output = node.execute({"prompt": "Hi"}, ExecutionContext(trigger={}))

        assert output.success is True
        assert output.data["response"] == "Hello from LLM"

    def test_missing_api_key_validate(self):
        node = LlmNode()
        with patch.dict("os.environ", {}, clear=True):
            errors = node.validate({"prompt": "Hi"})
        assert any("ANTHROPIC_API_KEY" in err for err in errors)


class TestNodeRegistry:
    def test_known_types_registered(self):
        for type_name in ("http_request", "conditional", "code", "delay", "llm"):
            assert get_node_class(type_name) is not None

    def test_unknown_type_raises(self):
        with pytest.raises(ValueError, match="Unknown node type"):
            get_node_class("does_not_exist")


class TestEvaluateCondition:
    def test_numeric_comparison(self):
        assert evaluate_condition("85 > 70") is True
        assert evaluate_condition("10 == 10") is True
        assert evaluate_condition("5 != 5") is False


class TestHttpRequestNodeCredential:
    """Tests for HttpRequestNode credential_id resolution and redaction."""

    def test_credential_injected_into_headers_and_redacted_in_output(self):
        node = HttpRequestNode()
        context = ExecutionContext(trigger={})
        config = {
            "url": "https://example.com",
            "method": "GET",
            "credential_id": "cred-uuid-123",
        }

        mock_cred_row = {
            "credential_id": "cred-uuid-123",
            "type": "bearer_token",
            "encrypted_value": "encrypted-blob",
        }
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"ok": True}
        mock_response.headers = {"Content-Type": "application/json"}

        with patch("app.nodes.http_request.workflow_repo.get_credential_encrypted", return_value=mock_cred_row), \
             patch("app.nodes.http_request.decrypt_value", return_value="sk-my-real-secret-key"), \
             patch("app.nodes.http_request.requests.request", return_value=mock_response) as mock_req:
            output = node.execute(config, context)

        assert output.success is True
        # Verify the real secret was sent in the actual request
        call_kwargs = mock_req.call_args
        actual_headers = call_kwargs.kwargs.get("headers") or call_kwargs[1].get("headers", {})
        assert actual_headers["Authorization"] == "Bearer sk-my-real-secret-key"

        # CRITICAL: output must have the header REDACTED
        assert output.data["request_headers"]["Authorization"] == "[REDACTED]"
        # The secret must not appear anywhere in the output data
        output_str = str(output.data)
        assert "sk-my-real-secret-key" not in output_str

    def test_credential_not_found_returns_error(self):
        node = HttpRequestNode()
        context = ExecutionContext(trigger={})
        config = {
            "url": "https://example.com",
            "method": "GET",
            "credential_id": "nonexistent-uuid",
        }
        with patch("app.nodes.http_request.workflow_repo.get_credential_encrypted", return_value=None):
            output = node.execute(config, context)
        assert output.success is False
        assert "not found" in (output.error or "").lower()


class TestLlmNodeCredential:
    """Tests for LlmNode credential_id resolution."""

    def test_credential_used_as_api_key(self):
        node = LlmNode()
        mock_cred_row = {
            "credential_id": "llm-cred-uuid",
            "type": "api_key",
            "encrypted_value": "encrypted-anthropic-key",
        }
        mock_message = MagicMock()
        mock_message.content = [MagicMock(text="Hello from credential LLM")]

        with patch("app.nodes.llm.workflow_repo.get_credential_encrypted", return_value=mock_cred_row), \
             patch("app.nodes.llm.decrypt_value", return_value="sk-ant-real-key"), \
             patch("anthropic.Anthropic") as mock_client_cls:
            mock_client_cls.return_value.messages.create.return_value = mock_message
            output = node.execute(
                {"prompt": "Hi", "credential_id": "llm-cred-uuid"},
                ExecutionContext(trigger={}),
            )

        assert output.success is True
        assert output.data["response"] == "Hello from credential LLM"
        # Verify the client was constructed with the decrypted key
        mock_client_cls.assert_called_once_with(api_key="sk-ant-real-key")
        # The secret must not appear in the output
        assert "sk-ant-real-key" not in str(output.data)

    def test_credential_not_found_returns_error(self):
        node = LlmNode()
        with patch("app.nodes.llm.workflow_repo.get_credential_encrypted", return_value=None):
            output = node.execute(
                {"prompt": "Hi", "credential_id": "bad-uuid"},
                ExecutionContext(trigger={}),
            )
        assert output.success is False
        assert "not available" in (output.error or "").lower()


class TestCredentialLeakPrevention:
    """Ensure decrypted credential values never appear in error logs/output."""

    def test_http_failure_does_not_leak_credential_in_error(self):
        node = HttpRequestNode()
        context = ExecutionContext(trigger={})
        secret = "sk-super-secret-do-not-leak"
        config = {
            "url": "https://example.com",
            "method": "GET",
            "credential_id": "cred-uuid",
        }
        mock_cred_row = {
            "credential_id": "cred-uuid",
            "type": "bearer_token",
            "encrypted_value": "blob",
        }

        with patch("app.nodes.http_request.workflow_repo.get_credential_encrypted", return_value=mock_cred_row), \
             patch("app.nodes.http_request.decrypt_value", return_value=secret), \
             patch("app.nodes.http_request.requests.request",
                   side_effect=requests.exceptions.ConnectionError("connection refused")):
            output = node.execute(config, context)

        assert output.success is False
        # The secret must NEVER appear in the error message
        assert secret not in (output.error or "")
        # Nor in the output data
        assert secret not in str(output.data)

    def test_llm_failure_does_not_leak_credential_in_error(self):
        node = LlmNode()
        secret = "sk-ant-secret-never-leak"
        mock_cred_row = {
            "credential_id": "llm-cred",
            "type": "api_key",
            "encrypted_value": "enc",
        }

        with patch("app.nodes.llm.workflow_repo.get_credential_encrypted", return_value=mock_cred_row), \
             patch("app.nodes.llm.decrypt_value", return_value=secret), \
             patch("anthropic.Anthropic") as mock_client_cls:
            # Simulate an error that might include the key in the message
            mock_client_cls.return_value.messages.create.side_effect = Exception(
                f"Auth failed with key {secret}"
            )
            output = node.execute(
                {"prompt": "Hi", "credential_id": "llm-cred"},
                ExecutionContext(trigger={}),
            )

        assert output.success is False
        # The secret must be redacted from the error message
        assert secret not in (output.error or "")


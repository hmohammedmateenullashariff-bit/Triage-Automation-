import os

from app.crypto import decrypt_value
from app.db import workflow_repo
from app.nodes.base import BaseNode, ExecutionContext, NodeOutput
from app.nodes.registry import register_node

DEFAULT_MODEL = "claude-3-5-haiku-20241022"


def _resolve_llm_api_key(credential_id: str | None) -> str | None:
    """Resolve the API key for the LLM node.

    Priority:
    1. If ``credential_id`` is provided, fetch and decrypt from credential store.
    2. Fall back to ``ANTHROPIC_API_KEY`` environment variable.

    Returns the plaintext API key, or None if neither source is available.
    """
    if credential_id:
        row = workflow_repo.get_credential_encrypted(credential_id)
        if row is None:
            return None

        try:
            return decrypt_value(row["encrypted_value"])
        except Exception:
            return None

    return os.getenv("ANTHROPIC_API_KEY")


@register_node("llm")
class LlmNode(BaseNode):
    def validate(self, config: dict) -> list[str]:
        errors: list[str] = []
        if not config.get("prompt"):
            errors.append("prompt is required")
        # Accept credential_id as an alternative to env var
        if not config.get("credential_id") and not os.getenv("ANTHROPIC_API_KEY"):
            errors.append("ANTHROPIC_API_KEY environment variable or credential_id is required")
        max_tokens = config.get("max_tokens", 1024)
        if not isinstance(max_tokens, int) or max_tokens <= 0:
            errors.append("max_tokens must be a positive integer")
        return errors

    def execute(self, config: dict, context: ExecutionContext) -> NodeOutput:
        try:
            import anthropic
            from anthropic import APIError, RateLimitError

            resolved = context.resolve_template(config)
            prompt = resolved["prompt"]
            system_prompt = resolved.get("system_prompt")
            model = resolved.get("model", DEFAULT_MODEL)
            max_tokens = resolved.get("max_tokens", 1024)
            credential_id = resolved.get("credential_id")

            api_key = _resolve_llm_api_key(credential_id)
            if not api_key:
                source = f"credential {credential_id}" if credential_id else "ANTHROPIC_API_KEY env var"
                return NodeOutput(
                    success=False,
                    error=f"API key not available from {source}",
                )

            client = anthropic.Anthropic(api_key=api_key)
            messages = [{"role": "user", "content": prompt}]
            kwargs = {"model": model, "max_tokens": max_tokens, "messages": messages}
            if system_prompt:
                kwargs["system"] = system_prompt

            response = client.messages.create(**kwargs)
            text = response.content[0].text if response.content else ""

            # Never include the api_key in output
            return NodeOutput(success=True, data={"response": text, "model": model})
        except RateLimitError as exc:
            return NodeOutput(success=False, error=f"Rate limit exceeded: {exc}")
        except APIError as exc:
            return NodeOutput(success=False, error=f"Anthropic API error: {exc}")
        except Exception as exc:
            # Sanitize: ensure the API key never leaks in error messages
            error_msg = str(exc)
            if api_key and api_key in error_msg:
                error_msg = error_msg.replace(api_key, "[REDACTED]")
            return NodeOutput(success=False, error=error_msg)

    def get_schema(self) -> dict:
        return {
            "type": "object",
            "required": ["prompt"],
            "properties": {
                "prompt": {"type": "string", "description": "User prompt (template-resolvable)"},
                "system_prompt": {"type": "string"},
                "model": {"type": "string", "default": DEFAULT_MODEL},
                "max_tokens": {"type": "integer", "default": 1024, "minimum": 1},
                "credential_id": {
                    "type": "string",
                    "description": "UUID of a stored credential containing the Anthropic API key",
                },
            },
        }

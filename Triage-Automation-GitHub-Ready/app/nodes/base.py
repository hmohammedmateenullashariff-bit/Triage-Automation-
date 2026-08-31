from abc import ABC, abstractmethod
from dataclasses import dataclass, field
import re
from typing import Any


class TemplateResolutionError(Exception):
    """Raised when a template reference cannot be resolved."""


_TEMPLATE_PATTERN = re.compile(r"\{\{([^}]+)\}\}")


@dataclass
class NodeOutput:
    success: bool
    data: dict = field(default_factory=dict)
    error: str | None = None


@dataclass
class ExecutionContext:
    """Holds trigger payload and accumulated node outputs for template resolution."""

    trigger: dict
    node_outputs: dict[str, dict] = field(default_factory=dict)

    def resolve_template(self, value: Any) -> Any:
        """Resolve ``{{node_id.output.field}}`` templates recursively in strings, dicts, and lists."""
        if isinstance(value, str):
            return self._resolve_string(value)
        if isinstance(value, dict):
            return {key: self.resolve_template(item) for key, item in value.items()}
        if isinstance(value, list):
            return [self.resolve_template(item) for item in value]
        return value

    def _resolve_string(self, value: str) -> Any:
        if "{{" not in value:
            return value

        matches = list(_TEMPLATE_PATTERN.finditer(value))
        if not matches:
            return value

        if len(matches) == 1 and matches[0].group(0) == value:
            return self._resolve_path(matches[0].group(1).strip())

        resolved = value
        for match in reversed(matches):
            path = match.group(1).strip()
            replacement = self._resolve_path(path)
            resolved = resolved[: match.start()] + str(replacement) + resolved[match.end() :]
        return resolved

    def _resolve_path(self, path: str) -> Any:
        parts = path.split(".")
        if not parts:
            raise TemplateResolutionError(f"Invalid template path '{path}'")

        if parts[0] == "trigger":
            current: Any = self.trigger
            for segment in parts[1:]:
                if isinstance(current, dict):
                    if segment not in current:
                        raise TemplateResolutionError(
                            f"Missing field '{segment}' in trigger payload (path: {path})"
                        )
                    current = current[segment]
                else:
                    raise TemplateResolutionError(
                        f"Cannot access '{segment}' on non-dict trigger value in path '{path}'"
                    )
            return current

        if len(parts) < 2:
            raise TemplateResolutionError(
                f"Invalid template path '{path}': expected '{{{{node_id.output.field}}}}' format"
            )

        node_id = parts[0]
        if node_id not in self.node_outputs:
            raise TemplateResolutionError(f"Unknown node reference in template: '{node_id}'")

        if parts[1] != "output":
            raise TemplateResolutionError(
                f"Invalid template path '{path}': second segment must be 'output'"
            )

        current = self.node_outputs[node_id]
        for segment in parts[2:]:
            if isinstance(current, dict):
                if segment not in current:
                    raise TemplateResolutionError(
                        f"Missing field '{segment}' in output of node '{node_id}' (path: {path})"
                    )
                current = current[segment]
            else:
                raise TemplateResolutionError(
                    f"Cannot access '{segment}' on non-dict value in path '{path}'"
                )
        return current


class BaseNode(ABC):
    @abstractmethod
    def validate(self, config: dict) -> list[str]:
        """Return list of validation error strings, empty if valid."""

    @abstractmethod
    def execute(self, config: dict, context: ExecutionContext) -> NodeOutput:
        """Run the node. Resolve config templates via context.resolve_template() before use."""

    @abstractmethod
    def get_schema(self) -> dict:
        """JSON schema describing this node's config shape, for frontend rendering."""

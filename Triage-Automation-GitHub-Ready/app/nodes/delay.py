import time

from app.nodes.base import BaseNode, ExecutionContext, NodeOutput
from app.nodes.registry import register_node


@register_node("delay")
class DelayNode(BaseNode):
    def validate(self, config: dict) -> list[str]:
        errors: list[str] = []
        duration = config.get("duration_seconds")
        if duration is None:
            errors.append("duration_seconds is required")
        elif not isinstance(duration, int) or duration < 0:
            errors.append("duration_seconds must be a non-negative integer")
        return errors

    def execute(self, config: dict, context: ExecutionContext) -> NodeOutput:
        # MVP: blocking sleep. Production would schedule a resume instead of holding a worker.
        try:
            resolved = context.resolve_template(config)
            duration = resolved["duration_seconds"]
            time.sleep(duration)
            return NodeOutput(success=True, data={"slept_seconds": duration})
        except Exception as exc:
            return NodeOutput(success=False, error=str(exc))

    def get_schema(self) -> dict:
        return {
            "type": "object",
            "required": ["duration_seconds"],
            "properties": {
                "duration_seconds": {
                    "type": "integer",
                    "minimum": 0,
                    "description": "Seconds to wait before continuing",
                },
            },
        }

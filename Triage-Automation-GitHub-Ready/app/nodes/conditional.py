import re

from app.nodes.base import BaseNode, ExecutionContext, NodeOutput
from app.nodes.registry import register_node

_OPERATORS = [">=", "<=", "!=", "==", ">", "<"]
_OPERATOR_PATTERN = re.compile(r"(>=|<=|!=|==|>|<)")


def _parse_literal(value: str):
    value = value.strip()
    if (value.startswith('"') and value.endswith('"')) or (
        value.startswith("'") and value.endswith("'")
    ):
        return value[1:-1]
    try:
        if "." in value:
            return float(value)
        return int(value)
    except ValueError:
        return value


def _compare(left, operator: str, right) -> bool:
    if operator == ">":
        return left > right
    if operator == "<":
        return left < right
    if operator == ">=":
        return left >= right
    if operator == "<=":
        return left <= right
    if operator == "==":
        return left == right
    if operator == "!=":
        return left != right
    raise ValueError(f"Unsupported operator: {operator}")


def evaluate_condition(condition: str) -> bool:
    """Safely evaluate a comparison expression without using eval()."""
    match = _OPERATOR_PATTERN.search(condition)
    if not match:
        raise ValueError(f"Condition must contain a comparison operator: {condition}")

    operator = match.group(1)
    left = _parse_literal(condition[: match.start()])
    right = _parse_literal(condition[match.end() :])
    return _compare(left, operator, right)


@register_node("conditional")
class ConditionalNode(BaseNode):
    def validate(self, config: dict) -> list[str]:
        errors: list[str] = []
        if not config.get("condition"):
            errors.append("condition is required")
        return errors

    def execute(self, config: dict, context: ExecutionContext) -> NodeOutput:
        try:
            resolved = context.resolve_template(config)
            condition = resolved["condition"]
            if not isinstance(condition, str):
                return NodeOutput(success=False, error="condition must resolve to a string")

            result = evaluate_condition(condition)
            branch = "true" if result else "false"
            return NodeOutput(success=True, data={"branch": branch})
        except Exception as exc:
            return NodeOutput(success=False, error=str(exc))

    def get_schema(self) -> dict:
        return {
            "type": "object",
            "required": ["condition"],
            "properties": {
                "condition": {
                    "type": "string",
                    "description": 'Comparison expression, e.g. "{{n1.output.score}} > 70"',
                },
            },
        }

import json
import subprocess
import sys
import textwrap
import tempfile
from pathlib import Path

from app.nodes.base import BaseNode, ExecutionContext, NodeOutput
from app.nodes.registry import register_node

# Code node runs user Python in a subprocess with a timeout.
#
# Known limitation (MVP): On Windows, full OS-level sandboxing (network/filesystem
# isolation) is not implemented. Timeout + subprocess isolation is the baseline.
# Do not execute untrusted code in production without additional hardening.


_RUNNER_SCRIPT = textwrap.dedent(
    """
    import json
    import sys

    input_data = json.load(sys.stdin)
    user_code = sys.argv[1]
    namespace = {"input_data": input_data, "result": None}
    exec(compile(user_code, "<workflow_code>", "exec"), {"__builtins__": __builtins__}, namespace)
    json.dump(namespace.get("result"), sys.stdout)
    """
)


@register_node("code")
class CodeNode(BaseNode):
    def validate(self, config: dict) -> list[str]:
        errors: list[str] = []
        if not config.get("code"):
            errors.append("code is required")
        timeout = config.get("timeout_seconds", 10)
        if not isinstance(timeout, (int, float)) or timeout <= 0:
            errors.append("timeout_seconds must be a positive number")
        return errors

    def execute(self, config: dict, context: ExecutionContext) -> NodeOutput:
        timeout = config.get("timeout_seconds", 10)
        try:
            resolved = context.resolve_template(config)
            code = resolved["code"]
            timeout = resolved.get("timeout_seconds", 10)
            input_data = {
                "trigger": context.trigger,
                "node_outputs": context.node_outputs,
            }

            with tempfile.TemporaryDirectory() as tmpdir:
                runner_path = Path(tmpdir) / "runner.py"
                runner_path.write_text(_RUNNER_SCRIPT, encoding="utf-8")

                proc = subprocess.run(
                    [sys.executable, str(runner_path), code],
                    input=json.dumps(input_data),
                    capture_output=True,
                    text=True,
                    timeout=timeout,
                )

            if proc.returncode != 0:
                stderr = proc.stderr.strip() or "Code execution failed"
                return NodeOutput(success=False, error=stderr)

            stdout = proc.stdout.strip()
            if not stdout:
                return NodeOutput(success=False, error="Code node produced no JSON output on stdout")

            result = json.loads(stdout)
            if not isinstance(result, dict):
                return NodeOutput(success=False, error="Code node result must be a JSON object (dict)")

            return NodeOutput(success=True, data=result)
        except subprocess.TimeoutExpired:
            return NodeOutput(success=False, error=f"Code execution exceeded timeout of {timeout}s")
        except json.JSONDecodeError as exc:
            return NodeOutput(success=False, error=f"Invalid JSON output from code node: {exc}")
        except Exception as exc:
            return NodeOutput(success=False, error=str(exc))

    def get_schema(self) -> dict:
        return {
            "type": "object",
            "required": ["code"],
            "properties": {
                "code": {
                    "type": "string",
                    "description": "Python code with access to input_data; set result dict",
                },
                "timeout_seconds": {"type": "number", "default": 10, "minimum": 1},
            },
        }

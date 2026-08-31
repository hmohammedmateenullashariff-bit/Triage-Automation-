from datetime import datetime, timezone
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from app.engine.executor import CyclicGraphError, execute_workflow, topological_sort
from app.models.node import NodeDefinition
from app.models.workflow import EdgeDefinition, TriggerConfig, WorkflowDefinition

import app.nodes  # noqa: F401


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _workflow(
    nodes: list[NodeDefinition],
    edges: list[EdgeDefinition],
) -> WorkflowDefinition:
    return WorkflowDefinition(
        workflow_id=uuid4(),
        name="Test",
        trigger=TriggerConfig(type="manual", config={}),
        nodes=nodes,
        edges=edges,
        created_at=_now(),
        updated_at=_now(),
    )


def _delay_node(node_id: str, seconds: int = 0, on_error: str = "fail", retry_count: int = 0) -> NodeDefinition:
    return NodeDefinition(
        node_id=node_id,
        type="delay",
        name=node_id,
        config={"duration_seconds": seconds},
        on_error=on_error,
        retry_count=retry_count,
    )


class TestTopologicalSort:
    def test_linear_order(self):
        workflow = _workflow(
            nodes=[_delay_node("a"), _delay_node("b"), _delay_node("c")],
            edges=[
                EdgeDefinition(from_node="a", to_node="b"),
                EdgeDefinition(from_node="b", to_node="c"),
            ],
        )
        assert topological_sort(workflow) == ["a", "b", "c"]

    def test_cycle_raises(self):
        workflow = _workflow(
            nodes=[_delay_node("a"), _delay_node("b")],
            edges=[
                EdgeDefinition(from_node="a", to_node="b"),
                EdgeDefinition(from_node="b", to_node="a"),
            ],
        )
        with pytest.raises(CyclicGraphError):
            topological_sort(workflow)


class TestExecuteWorkflow:
    def test_linear_workflow_runs_in_order(self):
        workflow = _workflow(
            nodes=[_delay_node("a"), _delay_node("b"), _delay_node("c")],
            edges=[
                EdgeDefinition(from_node="a", to_node="b"),
                EdgeDefinition(from_node="b", to_node="c"),
            ],
        )
        result = execute_workflow(workflow, {"source": "test"})
        assert result.status == "success"
        assert [log.node_id for log in result.node_logs] == ["a", "b", "c"]
        assert all(log.status == "success" for log in result.node_logs)

    def test_branching_workflow_skips_untaken_branch(self):
        workflow = _workflow(
            nodes=[
                NodeDefinition(
                    node_id="cond",
                    type="conditional",
                    name="cond",
                    config={"condition": "{{trigger.score}} > 70"},
                ),
                _delay_node("true_branch"),
                _delay_node("false_branch"),
                _delay_node("after_true"),
                _delay_node("after_false"),
            ],
            edges=[
                EdgeDefinition(from_node="cond", to_node="true_branch", branch="true"),
                EdgeDefinition(from_node="cond", to_node="false_branch", branch="false"),
                EdgeDefinition(from_node="true_branch", to_node="after_true"),
                EdgeDefinition(from_node="false_branch", to_node="after_false"),
            ],
        )

        context_patch = patch(
            "app.nodes.conditional.ConditionalNode.execute",
            return_value=MagicMock(success=True, data={"branch": "true"}, error=None),
        )
        with context_patch:
            result = execute_workflow(workflow, {"score": 85})

        statuses = {log.node_id: log.status for log in result.node_logs}
        assert statuses["cond"] == "success"
        assert statuses["true_branch"] == "success"
        assert statuses["false_branch"] == "skipped"
        assert statuses["after_true"] == "success"
        assert statuses["after_false"] == "skipped"

    def test_on_error_fail_stops_workflow(self):
        workflow = _workflow(
            nodes=[
                NodeDefinition(
                    node_id="http",
                    type="http_request",
                    name="http",
                    config={"url": "https://example.com"},
                    on_error="fail",
                ),
                _delay_node("later"),
            ],
            edges=[EdgeDefinition(from_node="http", to_node="later")],
        )

        fail_output = MagicMock(success=False, data={}, error="boom")
        with patch("app.nodes.http_request.HttpRequestNode.execute", return_value=fail_output):
            result = execute_workflow(workflow, {})

        assert result.status == "failed"
        assert len(result.node_logs) == 1
        assert result.node_logs[0].node_id == "http"
        assert result.node_logs[0].status == "failed"

    def test_on_error_continue_finishes_workflow(self):
        workflow = _workflow(
            nodes=[
                NodeDefinition(
                    node_id="http",
                    type="http_request",
                    name="http",
                    config={"url": "https://example.com"},
                    on_error="continue",
                ),
                _delay_node("later"),
            ],
            edges=[EdgeDefinition(from_node="http", to_node="later")],
        )

        fail_output = MagicMock(success=False, data={}, error="boom")
        with patch("app.nodes.http_request.HttpRequestNode.execute", return_value=fail_output):
            result = execute_workflow(workflow, {})

        assert result.status == "success"
        assert result.node_logs[0].status == "failed"
        assert result.node_logs[1].status == "success"

    def test_on_error_retry_retries_before_failure(self):
        workflow = _workflow(
            nodes=[
                NodeDefinition(
                    node_id="http",
                    type="http_request",
                    name="http",
                    config={"url": "https://example.com"},
                    on_error="retry",
                    retry_count=2,
                ),
            ],
            edges=[],
        )

        fail_output = MagicMock(success=False, data={}, error="transient")
        with patch("app.nodes.http_request.HttpRequestNode.execute", return_value=fail_output) as mock_exec:
            result = execute_workflow(workflow, {})

        assert mock_exec.call_count == 3
        assert result.status == "failed"
        assert result.node_logs[0].status == "failed"

    def test_conditional_uses_trigger_payload_via_template(self):
        workflow = _workflow(
            nodes=[
                NodeDefinition(
                    node_id="cond",
                    type="conditional",
                    name="cond",
                    config={"condition": "{{trigger.value}} == 1"},
                ),
                _delay_node("next"),
            ],
            edges=[EdgeDefinition(from_node="cond", to_node="next")],
        )

        result = execute_workflow(workflow, {"value": 1})
        assert result.status == "success"
        assert result.node_logs[0].output["branch"] == "true"
        assert result.node_logs[1].status == "success"

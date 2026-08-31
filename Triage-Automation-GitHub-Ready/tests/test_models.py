from datetime import datetime, timezone
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.models.node import NodeDefinition
from app.models.workflow import (
    EdgeDefinition,
    TriggerConfig,
    WorkflowDefinition,
    validate_workflow_graph,
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _sample_node(node_id: str = "node_a") -> NodeDefinition:
    return NodeDefinition(node_id=node_id, type="http", name="Fetch", config={})


def _sample_workflow(
    nodes: list[NodeDefinition] | None = None,
    edges: list[EdgeDefinition] | None = None,
) -> WorkflowDefinition:
    return WorkflowDefinition(
        workflow_id=uuid4(),
        name="Test Workflow",
        trigger=TriggerConfig(type="manual", config={}),
        nodes=nodes or [_sample_node("node_a"), _sample_node("node_b")],
        edges=edges or [EdgeDefinition(from_node="node_a", to_node="node_b")],
        created_at=_now(),
        updated_at=_now(),
    )


def test_valid_workflow_passes_graph_validation():
    workflow = _sample_workflow()
    errors = validate_workflow_graph(workflow)
    assert errors == []


def test_cyclic_graph_is_rejected():
    nodes = [
        _sample_node("a"),
        _sample_node("b"),
        _sample_node("c"),
    ]
    edges = [
        EdgeDefinition(from_node="a", to_node="b"),
        EdgeDefinition(from_node="b", to_node="c"),
        EdgeDefinition(from_node="c", to_node="a"),
    ]
    workflow = _sample_workflow(nodes=nodes, edges=edges)
    errors = validate_workflow_graph(workflow)
    assert any("cycle" in err.lower() for err in errors)


def test_edge_referencing_nonexistent_node_is_rejected():
    workflow = _sample_workflow(
        nodes=[_sample_node("node_a")],
        edges=[EdgeDefinition(from_node="node_a", to_node="missing")],
    )
    errors = validate_workflow_graph(workflow)
    assert any("missing" in err for err in errors)


def test_retry_on_error_requires_positive_retry_count():
    with pytest.raises(ValidationError) as exc_info:
        NodeDefinition(
            node_id="retry_node",
            type="http",
            name="Retry Node",
            config={},
            on_error="retry",
            retry_count=0,
        )
    assert "retry_count" in str(exc_info.value).lower()


def test_cron_trigger_requires_cron_expr():
    with pytest.raises(ValidationError) as exc_info:
        TriggerConfig(type="cron", config={})
    assert "cron_expr" in str(exc_info.value)


def test_webhook_trigger_requires_webhook_path():
    with pytest.raises(ValidationError) as exc_info:
        TriggerConfig(type="webhook", config={})
    assert "webhook_path" in str(exc_info.value)


def test_orphan_node_produces_warning_not_hard_error():
    nodes = [
        _sample_node("entry"),
        _sample_node("connected"),
        _sample_node("orphan"),
    ]
    edges = [EdgeDefinition(from_node="entry", to_node="connected")]
    workflow = _sample_workflow(nodes=nodes, edges=edges)
    errors = validate_workflow_graph(workflow)
    assert any("WARNING" in err and "orphan" in err.lower() for err in errors)
    assert not any("cycle" in err.lower() for err in errors)
    assert not any("unknown" in err.lower() for err in errors)


def test_workflow_definition_accepts_valid_trigger_configs():
    workflow = WorkflowDefinition(
        workflow_id=uuid4(),
        name="Webhook Flow",
        trigger=TriggerConfig(type="webhook", config={"webhook_path": "/hooks/inbound"}),
        nodes=[_sample_node()],
        edges=[],
        created_at=_now(),
        updated_at=_now(),
    )
    assert workflow.trigger.type == "webhook"

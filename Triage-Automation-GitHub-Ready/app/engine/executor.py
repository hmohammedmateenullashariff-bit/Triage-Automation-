from __future__ import annotations

import time
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Literal
from uuid import UUID, uuid4

from app.models.execution import NodeExecutionLog
from app.models.node import NodeDefinition
from app.models.workflow import EdgeDefinition, WorkflowDefinition
from app.nodes.base import ExecutionContext, NodeOutput
from app.nodes.registry import get_node_class

import app.nodes  # noqa: F401 — ensure node types are registered


class CyclicGraphError(Exception):
    """Raised when a workflow graph contains a cycle."""


@dataclass
class ExecutionResult:
    status: Literal["success", "failed"]
    run_id: UUID
    node_logs: list[NodeExecutionLog] = field(default_factory=list)
    outputs: dict[str, dict] = field(default_factory=dict)
    error: str | None = None


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def topological_sort(workflow: WorkflowDefinition) -> list[str]:
    """Kahn's algorithm. Returns ordered list of node_ids."""
    node_ids = {node.node_id for node in workflow.nodes}
    incoming_count = {node_id: 0 for node_id in node_ids}
    adjacency: dict[str, list[str]] = {node_id: [] for node_id in node_ids}

    for edge in workflow.edges:
        adjacency[edge.from_node].append(edge.to_node)
        incoming_count[edge.to_node] += 1

    queue = deque(node_id for node_id, count in incoming_count.items() if count == 0)
    order: list[str] = []

    while queue:
        node_id = queue.popleft()
        order.append(node_id)
        for neighbor in adjacency[node_id]:
            incoming_count[neighbor] -= 1
            if incoming_count[neighbor] == 0:
                queue.append(neighbor)

    if len(order) != len(node_ids):
        raise CyclicGraphError("Workflow graph contains a cycle")

    return order


def _build_incoming_edges(edges: list[EdgeDefinition]) -> dict[str, list[tuple[str, str | None]]]:
    incoming: dict[str, list[tuple[str, str | None]]] = {}
    for edge in edges:
        incoming.setdefault(edge.to_node, []).append((edge.from_node, edge.branch))
    return incoming


def _should_execute_node(
    node_id: str,
    incoming_edges: dict[str, list[tuple[str, str | None]]],
    node_status: dict[str, str],
    node_map: dict[str, NodeDefinition],
    node_outputs: dict[str, dict],
) -> bool:
    predecessors = incoming_edges.get(node_id, [])
    if not predecessors:
        return True

    for from_node, branch in predecessors:
        status = node_status.get(from_node)
        if status == "skipped":
            continue
        if status not in {"success", "failed"}:
            continue

        from_def = node_map[from_node]
        if status == "failed" and from_def.on_error != "continue":
            continue

        if branch is not None and from_def.type == "conditional":
            taken_branch = node_outputs.get(from_node, {}).get("branch")
            if taken_branch != branch:
                continue

        return True

    return False


def _execute_node_with_policy(
    node_def: NodeDefinition,
    context: ExecutionContext,
) -> NodeOutput:
    node_cls = get_node_class(node_def.type)
    node = node_cls()
    config_errors = node.validate(node_def.config)
    if config_errors:
        return NodeOutput(success=False, error="; ".join(config_errors))

    if node_def.on_error != "retry":
        return node.execute(node_def.config, context)

    max_attempts = 1 + node_def.retry_count
    last_output: NodeOutput | None = None
    for attempt in range(max_attempts):
        last_output = node.execute(node_def.config, context)
        if last_output.success:
            return last_output
        if attempt < max_attempts - 1:
            time.sleep(0.1 * (attempt + 1))

    return last_output or NodeOutput(success=False, error="Retry attempts exhausted")


def execute_workflow(workflow: WorkflowDefinition, trigger_payload: dict) -> ExecutionResult:
    run_id = uuid4()
    order = topological_sort(workflow)
    node_map = {node.node_id: node for node in workflow.nodes}
    incoming_edges = _build_incoming_edges(workflow.edges)

    context = ExecutionContext(trigger=trigger_payload, node_outputs={})
    node_status: dict[str, str] = {}
    logs: list[NodeExecutionLog] = []
    workflow_failed = False
    workflow_error: str | None = None

    for node_id in order:
        if workflow_failed:
            break

        node_def = node_map[node_id]

        if not _should_execute_node(node_id, incoming_edges, node_status, node_map, context.node_outputs):
            node_status[node_id] = "skipped"
            logs.append(
                NodeExecutionLog(
                    run_id=run_id,
                    node_id=node_id,
                    status="skipped",
                    output=None,
                    error=None,
                    started_at=_utcnow(),
                    finished_at=_utcnow(),
                )
            )
            continue

        started_at = _utcnow()
        output = _execute_node_with_policy(node_def, context)
        finished_at = _utcnow()

        if output.success:
            context.node_outputs[node_id] = output.data
            node_status[node_id] = "success"
            logs.append(
                NodeExecutionLog(
                    run_id=run_id,
                    node_id=node_id,
                    status="success",
                    output=output.data,
                    error=None,
                    started_at=started_at,
                    finished_at=finished_at,
                )
            )
        else:
            node_status[node_id] = "failed"
            logs.append(
                NodeExecutionLog(
                    run_id=run_id,
                    node_id=node_id,
                    status="failed",
                    output=output.data or None,
                    error=output.error,
                    started_at=started_at,
                    finished_at=finished_at,
                )
            )
            if node_def.on_error == "fail":
                workflow_failed = True
                workflow_error = output.error or f"Node '{node_id}' failed"
            elif node_def.on_error == "retry":
                workflow_failed = True
                workflow_error = output.error or f"Node '{node_id}' failed after retries"

    status: Literal["success", "failed"] = "failed" if workflow_failed else "success"
    return ExecutionResult(
        status=status,
        run_id=run_id,
        node_logs=logs,
        outputs=dict(context.node_outputs),
        error=workflow_error,
    )

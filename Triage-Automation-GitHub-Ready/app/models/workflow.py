from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

from app.models.node import NodeDefinition


class TriggerConfig(BaseModel):
    type: Literal["manual", "webhook", "cron"]
    config: dict = Field(default_factory=dict)

    @model_validator(mode="after")
    def validate_type_config(self) -> "TriggerConfig":
        if self.type == "cron" and "cron_expr" not in self.config:
            raise ValueError("cron trigger requires 'cron_expr' in config")
        if self.type == "webhook" and not (self.config.get("webhook_path") or self.config.get("webhook_token")):
            raise ValueError("webhook trigger requires 'webhook_path' or 'webhook_token' in config")
        return self


class EdgeDefinition(BaseModel):
    from_node: str
    to_node: str
    branch: Optional[str] = None


class WorkflowDefinition(BaseModel):
    workflow_id: UUID
    name: str
    version: int = 1
    trigger: TriggerConfig
    nodes: list[NodeDefinition]
    edges: list[EdgeDefinition]
    created_at: datetime
    updated_at: datetime


def validate_workflow_graph(workflow: WorkflowDefinition) -> list[str]:
    """Validate workflow graph structure.

    Returns a list of error/warning strings. Hard errors (invalid edges, cycles)
    cause validation failure. Orphan-node issues are returned as warnings prefixed
    with ``WARNING:`` and do not invalidate the workflow on their own.
    """
    errors: list[str] = []
    node_ids = {node.node_id for node in workflow.nodes}

    for edge in workflow.edges:
        if edge.from_node not in node_ids:
            errors.append(f"Edge references unknown from_node: {edge.from_node}")
        if edge.to_node not in node_ids:
            errors.append(f"Edge references unknown to_node: {edge.to_node}")

    if errors:
        return errors

    adjacency: dict[str, list[str]] = {node_id: [] for node_id in node_ids}
    for edge in workflow.edges:
        adjacency[edge.from_node].append(edge.to_node)

    visiting: set[str] = set()
    visited: set[str] = set()

    def has_cycle(node: str) -> bool:
        if node in visiting:
            return True
        if node in visited:
            return False
        visiting.add(node)
        for neighbor in adjacency[node]:
            if has_cycle(neighbor):
                return True
        visiting.remove(node)
        visited.add(node)
        return False

    for node_id in node_ids:
        if node_id not in visited and has_cycle(node_id):
            errors.append("Workflow graph contains a cycle")
            break

    if errors:
        return errors

    incoming: dict[str, int] = {node_id: 0 for node_id in node_ids}
    for edge in workflow.edges:
        incoming[edge.to_node] += 1

    entry_points = [node_id for node_id, count in incoming.items() if count == 0]
    if not entry_points:
        return errors

    def reachable_from(start: str) -> set[str]:
        seen: set[str] = set()
        stack = [start]
        while stack:
            current = stack.pop()
            if current in seen:
                continue
            seen.add(current)
            stack.extend(adjacency[current])
        return seen

    main_start = max(entry_points, key=lambda node_id: len(reachable_from(node_id)))
    reachable = reachable_from(main_start)

    for node_id in node_ids - reachable:
        errors.append(f"WARNING: Orphan node unreachable from entry points: {node_id}")

    return errors

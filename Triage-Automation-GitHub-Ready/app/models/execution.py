from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class ExecutionRun(BaseModel):
    run_id: UUID
    workflow_id: UUID
    status: Literal["pending", "running", "success", "failed"]
    started_at: datetime
    finished_at: Optional[datetime] = None
    trigger_payload: dict = Field(default_factory=dict)


class NodeExecutionLog(BaseModel):
    run_id: UUID
    node_id: str
    status: Literal["pending", "running", "success", "failed", "skipped"]
    output: Optional[dict] = None
    error: Optional[str] = None
    started_at: datetime
    finished_at: Optional[datetime] = None

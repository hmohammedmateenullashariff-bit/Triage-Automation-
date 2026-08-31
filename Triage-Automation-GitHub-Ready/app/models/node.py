from typing import Literal

from pydantic import BaseModel, Field, model_validator


class NodeDefinition(BaseModel):
    node_id: str
    type: str
    name: str
    config: dict = Field(default_factory=dict)
    on_error: Literal["fail", "continue", "retry"] = "fail"
    retry_count: int = 0

    @model_validator(mode="after")
    def validate_retry_count(self) -> "NodeDefinition":
        if self.on_error == "retry" and self.retry_count <= 0:
            raise ValueError("retry_count must be greater than 0 when on_error is 'retry'")
        return self

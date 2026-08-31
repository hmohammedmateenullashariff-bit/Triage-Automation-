"""Credential metadata model — used for API responses.

The secret value is NEVER included in this model.  It is stored encrypted
in the database and only decrypted at execution time inside node logic.
"""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel


class Credential(BaseModel):
    credential_id: UUID
    name: str
    type: Literal["api_key", "bearer_token", "basic_auth", "custom_header"]
    created_at: datetime
    updated_at: datetime

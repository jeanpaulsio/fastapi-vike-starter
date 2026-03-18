import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.item import ItemStatus


class ItemRead(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None
    status: ItemStatus
    owner_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ItemCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=2000)


class ItemUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    status: ItemStatus | None = None

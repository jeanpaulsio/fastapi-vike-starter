"""Item repository — example CRUD resource using BaseRepository."""

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.item import Item
from app.schemas.item import ItemCreate, ItemUpdate
from app.services.base_service import BaseRepository
from app.utils.pagination import PaginatedResponse, PaginationParams


class ItemRepository(BaseRepository[Item, ItemCreate, ItemUpdate]):
    def __init__(self, db: AsyncSession):
        super().__init__(Item, db)

    async def create(self, data: ItemCreate, **extra: Any) -> Item:  # type: ignore[override]
        return await super().create(data, **extra)

    async def list_by_owner(
        self, owner_id: uuid.UUID, pagination: PaginationParams
    ) -> PaginatedResponse:
        query = select(Item).where(Item.owner_id == owner_id).order_by(Item.created_at.desc())
        return await self.list(pagination, base_query=query)

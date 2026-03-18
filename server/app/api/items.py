"""Items API — example CRUD resource.

Demonstrates the full pattern: thin controller delegating to BaseRepository,
with pagination, ownership scoping, and role-based access.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.item import Item
from app.models.user import User
from app.schemas.item import ItemCreate, ItemRead, ItemUpdate
from app.services.item_service import ItemRepository
from app.utils.pagination import PaginatedResponse, PaginationParams

router = APIRouter(prefix="/items", tags=["items"])


def _check_owner(item: Item, user: User) -> None:
    if item.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")


@router.get("", response_model=PaginatedResponse[ItemRead])
async def list_items(
    pagination: PaginationParams = Depends(),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PaginatedResponse:
    repo = ItemRepository(db)
    return await repo.list_by_owner(user.id, pagination)


@router.post("", response_model=ItemRead, status_code=status.HTTP_201_CREATED)
async def create_item(
    body: ItemCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Item:
    repo = ItemRepository(db)
    item = await repo.create(body, owner_id=user.id)
    await db.commit()
    return item


@router.get("/{item_id}", response_model=ItemRead)
async def get_item(
    item_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Item:
    repo = ItemRepository(db)
    item = await repo.get_by_id_or_raise(item_id)
    _check_owner(item, user)
    return item


@router.patch("/{item_id}", response_model=ItemRead)
async def update_item(
    item_id: uuid.UUID,
    body: ItemUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Item:
    repo = ItemRepository(db)
    item = await repo.get_by_id_or_raise(item_id)
    _check_owner(item, user)
    updated = await repo.update(item_id, body)
    await db.commit()
    return updated


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_item(
    item_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    repo = ItemRepository(db)
    item = await repo.get_by_id_or_raise(item_id)
    _check_owner(item, user)
    await repo.delete(item_id)
    await db.commit()

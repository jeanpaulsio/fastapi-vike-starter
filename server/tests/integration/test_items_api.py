"""Integration tests for the Items CRUD API."""

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.item import Item, ItemStatus


@pytest.fixture
async def sample_item(db: AsyncSession, test_user) -> Item:
    item = Item(
        id=uuid.uuid4(),
        title="Test Item",
        description="A test item",
        status=ItemStatus.ACTIVE,
        owner_id=test_user.id,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


class TestListItems:
    async def test_list_empty(self, client: AsyncClient, auth_headers: dict) -> None:
        resp = await client.get("/api/items", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["items"] == []
        assert data["total"] == 0

    async def test_list_with_items(
        self, client: AsyncClient, auth_headers: dict, sample_item: Item
    ) -> None:
        resp = await client.get("/api/items", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["items"]) == 1
        assert data["items"][0]["title"] == "Test Item"

    async def test_list_requires_auth(self, client: AsyncClient) -> None:
        resp = await client.get("/api/items")
        assert resp.status_code == 403


class TestCreateItem:
    async def test_create(self, client: AsyncClient, auth_headers: dict) -> None:
        resp = await client.post(
            "/api/items",
            json={"title": "New Item", "description": "Details"},
            headers=auth_headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["title"] == "New Item"
        assert data["description"] == "Details"
        assert data["status"] == "active"

    async def test_create_minimal(self, client: AsyncClient, auth_headers: dict) -> None:
        resp = await client.post(
            "/api/items",
            json={"title": "Minimal"},
            headers=auth_headers,
        )
        assert resp.status_code == 201
        assert resp.json()["description"] is None

    async def test_create_empty_title(self, client: AsyncClient, auth_headers: dict) -> None:
        resp = await client.post(
            "/api/items",
            json={"title": ""},
            headers=auth_headers,
        )
        assert resp.status_code == 422


class TestGetItem:
    async def test_get(
        self, client: AsyncClient, auth_headers: dict, sample_item: Item
    ) -> None:
        resp = await client.get(f"/api/items/{sample_item.id}", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["title"] == "Test Item"

    async def test_get_not_found(self, client: AsyncClient, auth_headers: dict) -> None:
        resp = await client.get(f"/api/items/{uuid.uuid4()}", headers=auth_headers)
        assert resp.status_code == 404

    async def test_get_other_users_item(
        self, client: AsyncClient, admin_headers: dict, sample_item: Item
    ) -> None:
        resp = await client.get(f"/api/items/{sample_item.id}", headers=admin_headers)
        assert resp.status_code == 404


class TestUpdateItem:
    async def test_update(
        self, client: AsyncClient, auth_headers: dict, sample_item: Item
    ) -> None:
        resp = await client.patch(
            f"/api/items/{sample_item.id}",
            json={"title": "Updated"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["title"] == "Updated"

    async def test_archive(
        self, client: AsyncClient, auth_headers: dict, sample_item: Item
    ) -> None:
        resp = await client.patch(
            f"/api/items/{sample_item.id}",
            json={"status": "archived"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "archived"


class TestDeleteItem:
    async def test_delete(
        self, client: AsyncClient, auth_headers: dict, sample_item: Item
    ) -> None:
        resp = await client.delete(f"/api/items/{sample_item.id}", headers=auth_headers)
        assert resp.status_code == 204

        # Verify it's gone
        resp = await client.get(f"/api/items/{sample_item.id}", headers=auth_headers)
        assert resp.status_code == 404

    async def test_delete_other_users_item(
        self, client: AsyncClient, admin_headers: dict, sample_item: Item
    ) -> None:
        resp = await client.delete(f"/api/items/{sample_item.id}", headers=admin_headers)
        assert resp.status_code == 404

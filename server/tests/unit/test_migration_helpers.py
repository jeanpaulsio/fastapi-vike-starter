"""Unit tests for the Alembic enum helpers.

These run without a live database — they monkeypatch ``op.execute`` to capture
the SQL that would be sent. Real migrations are already exercised by the
``conftest.create_all`` fixtures, which run ``upgrade()`` against a fresh test
database on every session.
"""

from collections.abc import Generator

import pytest

from app.db import migration_helpers


@pytest.fixture
def captured_sql(monkeypatch: pytest.MonkeyPatch) -> Generator[list[str], None, None]:
    calls: list[str] = []

    def fake_execute(sql: str) -> None:
        calls.append(sql.strip())

    monkeypatch.setattr(migration_helpers.op, "execute", fake_execute)
    yield calls


class TestEnsureEnumExists:
    def test_emits_idempotent_create_type(self, captured_sql: list[str]) -> None:
        migration_helpers.ensure_enum_exists("user_role", ["admin", "user"])

        assert len(captured_sql) == 1
        sql = captured_sql[0]
        assert "DO $$" in sql
        assert "IF NOT EXISTS" in sql
        assert "pg_type" in sql
        assert "typname = 'user_role'" in sql
        assert "CREATE TYPE user_role AS ENUM ('admin', 'user')" in sql

    def test_quotes_each_value(self, captured_sql: list[str]) -> None:
        migration_helpers.ensure_enum_exists("token_type", ["email_verification", "password_reset"])

        sql = captured_sql[0]
        assert "'email_verification', 'password_reset'" in sql


class TestDropEnum:
    def test_emits_idempotent_drop(self, captured_sql: list[str]) -> None:
        migration_helpers.drop_enum("user_role")

        assert captured_sql == ["DROP TYPE IF EXISTS user_role"]


class TestAddEnumValue:
    def test_emits_alter_type_add_value(self, captured_sql: list[str]) -> None:
        migration_helpers.add_enum_value("item_status", "pending")

        assert len(captured_sql) == 1
        assert "ALTER TYPE item_status" in captured_sql[0]
        assert "ADD VALUE IF NOT EXISTS 'pending'" in captured_sql[0]

    def test_supports_insert_before(self, captured_sql: list[str]) -> None:
        migration_helpers.add_enum_value("item_status", "draft", before="active")

        sql = captured_sql[0]
        assert "ADD VALUE IF NOT EXISTS 'draft' BEFORE 'active'" in sql

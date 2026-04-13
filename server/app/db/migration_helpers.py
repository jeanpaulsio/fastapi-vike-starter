"""Helpers to keep Alembic migrations safe + idempotent.

Why this file exists
--------------------
SQLAlchemy's ``sa.Enum(..., name="foo")`` auto-creates a Postgres ``TYPE`` the
first time a column referencing it is emitted. That's fine for a fresh database,
but it breaks in three common scenarios:

1. Re-running an upgrade against a partially-migrated database: the ``TYPE``
   already exists and Postgres raises ``duplicate_object``.
2. Two tables in the same (or separate) migrations referencing the same enum:
   the second one explodes because the type was already created by the first.
3. Downgrade / re-upgrade in dev: the type persists after a table drops, so the
   next upgrade fails before it even reaches the column.

The fix is to always create/drop the ``TYPE`` explicitly with an idempotent
``DO $$`` block, and tell SQLAlchemy not to manage it with ``create_type=False``
on the column declaration.

Usage in a migration
--------------------
.. code-block:: python

    from app.db.migration_helpers import ensure_enum_exists, drop_enum

    def upgrade() -> None:
        ensure_enum_exists("user_role", ["admin", "user"])
        op.create_table(
            "users",
            sa.Column(
                "role",
                sa.Enum("admin", "user", name="user_role", create_type=False),
                nullable=False,
            ),
            # ...
        )

    def downgrade() -> None:
        op.drop_table("users")
        drop_enum("user_role")
"""
# ruff: noqa: S608
#
# S608 (Bandit "possible SQL injection") fires on every f-string that builds
# DDL here. These inputs come from migration source files, not user requests,
# so there is no injection surface. Suppressing at the module level keeps the
# intent explicit without papering each call with a per-line ignore.

from alembic import op


def ensure_enum_exists(name: str, values: list[str]) -> None:
    """Create a Postgres enum type if it doesn't already exist.

    Safe to call from multiple migrations against the same type.
    """
    quoted = ", ".join(f"'{v}'" for v in values)
    op.execute(
        f"""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '{name}') THEN
                CREATE TYPE {name} AS ENUM ({quoted});
            END IF;
        END
        $$;
        """
    )


def drop_enum(name: str) -> None:
    """Drop a Postgres enum type if it exists.

    Use in downgrade blocks AFTER the tables that reference it have been
    dropped (Postgres will refuse to drop a type that's still in use).
    """
    op.execute(f"DROP TYPE IF EXISTS {name}")


def add_enum_value(enum_name: str, new_value: str, *, before: str | None = None) -> None:
    """Append (or insert) a value to an existing Postgres enum.

    Postgres supports ``ALTER TYPE ... ADD VALUE`` since 9.1, and ``IF NOT EXISTS``
    since 9.6, so this is safe to re-run. Note: ``ALTER TYPE ... ADD VALUE``
    cannot run inside a transaction block in older Postgres versions; Alembic
    handles this by default when ``transactional_ddl`` is enabled, but if you
    hit "ALTER TYPE ... ADD cannot run inside a transaction block", set
    ``transaction_per_migration = False`` in ``alembic.ini`` or wrap the call
    in ``op.execute("COMMIT")`` beforehand.
    """
    position = f"BEFORE '{before}'" if before else ""
    op.execute(f"ALTER TYPE {enum_name} ADD VALUE IF NOT EXISTS '{new_value}' {position}".strip())

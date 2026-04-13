"""Initial schema — users and verification_tokens.

Revision ID: 0001
Revises:
Create Date: 2025-01-01 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op
from app.db.migration_helpers import drop_enum, ensure_enum_exists

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Enums — created explicitly so re-runs and downgrade/upgrade cycles are safe.
    ensure_enum_exists("user_role", ["admin", "user"])
    ensure_enum_exists("token_type", ["email_verification", "password_reset"])

    # Users table
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("first_name", sa.String(255), nullable=False),
        sa.Column("last_name", sa.String(255), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column(
            "role",
            sa.Enum("admin", "user", name="user_role", create_type=False),
            nullable=False,
        ),
        sa.Column("email_verified", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    # Verification tokens table
    op.create_table(
        "verification_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("token", sa.String(255), nullable=False),
        sa.Column(
            "type",
            sa.Enum("email_verification", "password_reset", name="token_type", create_type=False),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_verification_tokens_token", "verification_tokens", ["token"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_verification_tokens_token", table_name="verification_tokens")
    op.drop_table("verification_tokens")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
    drop_enum("token_type")
    drop_enum("user_role")

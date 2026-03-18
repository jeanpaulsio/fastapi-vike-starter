import enum
import uuid

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, pg_enum


class ItemStatus(enum.StrEnum):
    ACTIVE = "active"
    ARCHIVED = "archived"


class Item(TimestampMixin, Base):
    __tablename__ = "items"

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[ItemStatus] = mapped_column(
        pg_enum(ItemStatus, "item_status"),
        nullable=False,
        default=ItemStatus.ACTIVE,
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

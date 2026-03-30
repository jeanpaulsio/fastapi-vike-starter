"""Query helpers for SQLAlchemy."""

from enum import Enum

from fastapi import HTTPException, status


def escape_like(value: str) -> str:
    """Escape LIKE/ILIKE special characters: \\, %, _."""
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def parse_enum_filter(raw: str | None, enum_cls: type[Enum]) -> list[Enum] | None:
    """Parse a comma-separated query param into a list of enum values.

    Raises HTTP 422 for invalid values.
    """
    if not raw:
        return None
    valid = {v.value for v in enum_cls}
    parts = [v.strip() for v in raw.split(",") if v.strip()]
    bad = [v for v in parts if v not in valid]
    if bad:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid value(s): {bad}",
        )
    return [enum_cls(v) for v in parts]

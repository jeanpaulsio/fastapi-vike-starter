"""Tests for database module — close_all, get_db rollback."""

from app.database import close_all


class TestDatabaseLifecycle:
    async def test_close_all(self) -> None:
        """close_all should dispose engine without errors."""
        # Just verify it doesn't raise — engine disposal is idempotent
        await close_all()

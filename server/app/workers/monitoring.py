"""Built-in monitoring / housekeeping jobs.

Every arq job is an ``async def`` whose first argument is ``ctx``, a dict
populated by the worker's ``on_startup`` hook. Use ``ctx["session_factory"]``
to open a short-lived database session per job.
"""

from typing import Any

import structlog

from app.services.token_service import delete_expired_tokens

logger = structlog.get_logger()


async def health_check(ctx: dict[str, Any]) -> dict[str, str]:
    """Trivial job to verify the worker is running."""
    return {"status": "ok", "worker": "arq"}


async def cleanup_expired_tokens(ctx: dict[str, Any]) -> dict[str, int | str]:
    """Delete verification/reset tokens that have passed their TTL."""
    async with ctx["session_factory"]() as db:
        count = await delete_expired_tokens(db)
        await db.commit()
    logger.info("expired_tokens_cleaned", count=count)
    return {"status": "ok", "deleted": count}

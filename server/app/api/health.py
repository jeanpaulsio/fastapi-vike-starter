from typing import Any

import structlog
from fastapi import APIRouter, Request
from sqlalchemy import text

from app.config import settings
from app.database import async_session_factory

logger = structlog.get_logger()

router = APIRouter()


@router.get("/health")
async def health_check(request: Request) -> dict[str, Any]:
    """Health check — verifies Postgres and Redis connectivity.

    Returns only status indicators, no internal error details.
    """
    postgres_ok = False
    redis_ok = False

    try:
        async with async_session_factory() as session:
            await session.execute(text("SELECT 1"))
        postgres_ok = True
    except Exception as exc:
        logger.error("health_postgres_error", exc=str(exc))

    try:
        redis_client = getattr(request.app.state, "redis", None)
        if redis_client is not None:
            await redis_client.ping()
            redis_ok = True
        else:
            logger.warning("health_redis_not_initialized")
    except Exception as exc:
        logger.error("health_redis_error", exc=str(exc))

    all_ok = postgres_ok and redis_ok
    return {
        "status": "ok" if all_ok else "degraded",
        "service": settings.app_name,
        "postgres": "ok" if postgres_ok else "error",
        "redis": "ok" if redis_ok else "error",
    }

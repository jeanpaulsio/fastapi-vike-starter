from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

import redis.asyncio as aioredis
import sentry_sdk
import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.api.router import api_router, root_router
from app.config import settings
from app.database import close_all
from app.limiter import limiter
from app.middleware.errors import register_error_handlers
from app.middleware.logging import register_logging

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Manage connection lifecycle — startup and shutdown."""
    logger.info("app_starting", pool_size=settings.db_pool_size)
    try:
        app.state.redis = aioredis.from_url(
            settings.redis_url,
            decode_responses=True,
            max_connections=20,
        )
        logger.info("redis_connected")
    except Exception as exc:
        logger.warning("redis_connection_failed", exc=str(exc))
        app.state.redis = None

    yield

    logger.info("app_shutting_down")
    if getattr(app.state, "redis", None) is not None:
        await app.state.redis.aclose()
    await close_all()
    logger.info("connections_closed")


def create_app() -> FastAPI:
    if settings.sentry_dsn:
        sentry_sdk.init(
            dsn=settings.sentry_dsn,
            traces_sample_rate=0.1,
            profiles_sample_rate=0.1,
            environment="production" if not settings.debug else "development",
        )

    app = FastAPI(
        title=settings.app_name,
        lifespan=lifespan,
        docs_url="/api/docs" if settings.debug else None,
        openapi_url="/api/openapi.json" if settings.debug else None,
    )

    register_logging(app, debug=settings.debug)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Rate limiting (decorator-based via slowapi — use @limiter.limit() on routes)
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)  # type: ignore[arg-type]

    register_error_handlers(app)

    app.include_router(root_router)
    app.include_router(api_router)

    return app


app = create_app()

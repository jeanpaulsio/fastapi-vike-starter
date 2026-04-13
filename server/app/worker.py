"""arq worker entry point.

Run with:
    arq app.worker.WorkerSettings

Two kinds of jobs live here:

1. Functions — enqueued from web requests via ``ctx["arq_redis"].enqueue_job``.
2. Cron jobs — fired on a schedule by the worker itself. No separate scheduler
   process is needed (this is the big difference from Celery + Beat).

To add a new background task:
    - Write an ``async def`` in ``app/workers/<module>.py`` that takes ``ctx``
      as its first argument.
    - Append it to ``WorkerSettings.functions``.
    - If it should fire on a schedule, wrap it in ``cron(...)`` and append to
      ``WorkerSettings.cron_jobs`` instead (it can live in both lists if it
      also needs to be callable on demand).
"""

from typing import Any, ClassVar

from arq.connections import RedisSettings
from arq.cron import CronJob, cron

from app.config import settings
from app.database import async_session_factory
from app.workers.monitoring import cleanup_expired_tokens, health_check


async def startup(ctx: dict[str, Any]) -> None:
    """Stash a single async session factory on the arq context.

    Jobs should open a short-lived session per invocation:
        async with ctx["session_factory"]() as db:
            ...
    """
    ctx["session_factory"] = async_session_factory


async def shutdown(ctx: dict[str, Any]) -> None:
    # async_session_factory holds a shared engine that the main app also uses;
    # no disposal needed here.
    pass


class WorkerSettings:
    functions: ClassVar[list[Any]] = [health_check, cleanup_expired_tokens]
    cron_jobs: ClassVar[list[CronJob]] = [
        cron(cleanup_expired_tokens, hour=3, minute=0, run_at_startup=False),
    ]
    on_startup = startup
    on_shutdown = shutdown
    redis_settings = RedisSettings.from_dsn(settings.redis_url)
    max_jobs = 10
    job_timeout = 300

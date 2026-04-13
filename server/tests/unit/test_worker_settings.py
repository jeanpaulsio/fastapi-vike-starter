"""Contract tests for the arq worker configuration.

We don't spin up a real arq worker here — we just assert that ``WorkerSettings``
wires up the right functions and cron schedule. If someone renames a job or
drops a cron without updating this file, the test will catch it.
"""

from app.worker import WorkerSettings
from app.workers.monitoring import cleanup_expired_tokens, health_check


class TestWorkerSettings:
    def test_registered_functions_cover_known_jobs(self) -> None:
        assert health_check in WorkerSettings.functions
        assert cleanup_expired_tokens in WorkerSettings.functions

    def test_cleanup_cron_scheduled_at_3am_utc(self) -> None:
        jobs = [cj for cj in WorkerSettings.cron_jobs if cj.name == "cron:cleanup_expired_tokens"]
        assert len(jobs) == 1, "cleanup_expired_tokens cron should be registered exactly once"
        job = jobs[0]
        assert job.hour == 3
        assert job.minute == 0

    def test_cron_jobs_are_async_callables(self) -> None:
        import inspect

        for job in WorkerSettings.cron_jobs:
            assert inspect.iscoroutinefunction(job.coroutine)

import logging

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_WEAK_SECRET = "local-dev-key-do-not-use-in-production"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=("../.env", ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # App
    app_name: str = "{{APP_DISPLAY_NAME}}"
    debug: bool = False
    cors_origins: str = "http://localhost:3000"

    # Database — required in production, defaults for local dev
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/{{APP_SLUG}}"
    database_url_sync: str = "postgresql://postgres:postgres@localhost:5432/{{APP_SLUG}}"

    # Auth — secret_key MUST be set via env var in production
    secret_key: str = Field(default=_WEAK_SECRET)
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    algorithm: str = "HS256"

    # Database pool
    db_pool_size: int = 10
    db_max_overflow: int = 20
    db_pool_timeout: int = 30
    db_pool_recycle: int = 1800  # 30 minutes

    # Redis / Celery
    redis_url: str = "redis://localhost:6379/0"

    # Email
    email_backend: str = "console"  # "console", "resend", or "smtp"
    resend_api_key: str = ""
    email_from: str = "{{APP_DISPLAY_NAME}} <noreply@example.com>"
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_use_tls: bool = True

    # Auth — registration & verification
    require_email_verification: bool = True
    frontend_url: str = "http://localhost:3000"
    verification_token_expire_hours: int = 24
    password_reset_token_expire_hours: int = 1

    # Sentry
    sentry_dsn: str = ""

    # Rate Limiting
    rate_limit_per_minute: int = 100

    @model_validator(mode="after")
    def enforce_production_settings(self) -> "Settings":
        if not self.debug and self.secret_key == _WEAK_SECRET:
            raise ValueError(
                "SECRET_KEY must be set to a strong random value in production (debug=False)"
            )
        # Render provides postgresql:// — rewrite to asyncpg driver for the async engine
        if self.database_url.startswith("postgresql://"):
            self.database_url = self.database_url.replace(
                "postgresql://", "postgresql+asyncpg://", 1
            )
        # Ensure sync URL never uses asyncpg
        if self.database_url_sync.startswith("postgresql+asyncpg://"):
            self.database_url_sync = self.database_url_sync.replace(
                "postgresql+asyncpg://", "postgresql://", 1
            )
        return self

    @property
    def cors_origin_list(self) -> list[str]:
        origins = [origin.strip() for origin in self.cors_origins.split(",")]
        if "*" in origins and len(origins) > 1:
            logging.warning("CORS wildcard '*' mixed with specific origins — using wildcard only")
        if "*" in origins:
            return ["*"]
        return origins


settings = Settings()

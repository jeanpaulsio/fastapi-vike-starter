"""Consistent API error envelope and global exception handlers."""

from collections.abc import Sequence
from typing import Any

import structlog
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.utils.exceptions import AppError

logger = structlog.get_logger()

# Field name fragments that should NEVER have their failing input echoed back
# in a 422 response. Matching is substring + case-insensitive on the last
# element of the Pydantic ``loc`` tuple.
SENSITIVE_FIELD_FRAGMENTS: tuple[str, ...] = (
    "password",
    "token",
    "secret",
    "authorization",
    "api_key",
    "apikey",
)

_REDACTED = "[redacted]"


class ErrorDetail(BaseModel):
    code: str
    message: str
    detail: Any | None = None


class ErrorResponse(BaseModel):
    error: ErrorDetail


def error_response(
    code: str,
    message: str,
    status_code: int = 500,
    detail: Any | None = None,
) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content=ErrorResponse(
            error=ErrorDetail(code=code, message=message, detail=detail)
        ).model_dump(),
    )


def _is_sensitive_loc(loc: tuple[Any, ...]) -> bool:
    """Return True if the last segment of a Pydantic ``loc`` looks sensitive."""
    if not loc:
        return False
    last = str(loc[-1]).lower()
    return any(fragment in last for fragment in SENSITIVE_FIELD_FRAGMENTS)


def sanitize_validation_errors(errors: Sequence[Any]) -> list[dict[str, Any]]:
    """Scrub a Pydantic validation error list before putting it on the wire.

    Accepts whatever shape ``RequestValidationError.errors()`` returns (typed
    as ``Sequence[Any]`` in Pydantic v2). Each entry is expected to be dict-like.

    Two things happen here:

    1. ``input`` is redacted whenever the field path looks sensitive, so we
       never echo a plaintext password or token back to the client. A successful
       422 on a ``password`` field should never reveal what the user typed.
    2. ``ctx`` is dropped entirely. It's useful for server-side debugging but
       it can leak regex patterns, expected values, and other validation
       internals that make attacking the API easier. Pydantic v2 also puts
       non-JSON-serializable objects there (e.g. ``ValueError`` instances),
       which would otherwise need per-type coercion.
    """
    clean: list[dict[str, Any]] = []
    for err in errors:
        safe: dict[str, Any] = {k: v for k, v in dict(err).items() if k != "ctx"}
        if "input" in safe and _is_sensitive_loc(tuple(safe.get("loc", ()))):
            safe["input"] = _REDACTED
        clean.append(safe)
    return clean


def register_error_handlers(app: FastAPI) -> None:
    """Register global exception handlers on the FastAPI app."""

    @app.exception_handler(AppError)
    async def app_error_handler(_request: Request, exc: AppError) -> JSONResponse:
        return error_response(
            code=type(exc).__name__,
            message=exc.message,
            status_code=exc.status_code,
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(
        _request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        return error_response(
            code="ValidationError",
            message="Request validation failed",
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=sanitize_validation_errors(exc.errors()),
        )

    @app.exception_handler(Exception)
    async def unhandled_error_handler(_request: Request, exc: Exception) -> JSONResponse:
        logger.error("unhandled_exception", exc_type=type(exc).__name__, exc_msg=str(exc))

        return error_response(
            code="InternalServerError",
            message="An unexpected error occurred",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

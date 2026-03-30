"""Consistent API error envelope and global exception handlers."""

from typing import Any

import structlog
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.utils.exceptions import AppError

logger = structlog.get_logger()


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
        # exc.errors() can contain non-serializable objects (e.g. ValueError
        # instances in the 'ctx' field). Stringify the ctx to ensure the
        # response is always JSON-serializable.
        safe_errors = []
        for err in exc.errors():
            clean = {**err}
            if "ctx" in clean:
                clean["ctx"] = {
                    k: str(v) if not isinstance(v, (str, int, float, bool, type(None))) else v
                    for k, v in clean["ctx"].items()
                }
            safe_errors.append(clean)

        return error_response(
            code="ValidationError",
            message="Request validation failed",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=safe_errors,
        )

    @app.exception_handler(Exception)
    async def unhandled_error_handler(_request: Request, exc: Exception) -> JSONResponse:
        logger.error("unhandled_exception", exc_type=type(exc).__name__, exc_msg=str(exc))

        return error_response(
            code="InternalServerError",
            message="An unexpected error occurred",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

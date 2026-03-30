import uuid
from pathlib import Path

import structlog
from fastapi import APIRouter, Depends, HTTPException, Request, status
from jinja2 import Environment, FileSystemLoader, select_autoescape
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.limiter import limiter
from app.models.user import User, UserRole
from app.models.verification_token import TokenType
from app.schemas.auth import (
    ForgotPasswordRequest,
    LoginRequest,
    MessageResponse,
    RefreshRequest,
    RegisterRequest,
    RegisterResponse,
    ResetPasswordRequest,
    TokenResponse,
    VerifyEmailRequest,
)
from app.services.auth_service import (
    authenticate_user,
    create_access_token,
    create_refresh_token,
    decode_token,
    get_user_by_id,
    hash_password,
)
from app.services.email_service import EmailMessage, send_email
from app.services.token_service import consume_token, create_token

logger = structlog.get_logger()

router = APIRouter(prefix="/auth", tags=["auth"])

TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates"

_jinja = Environment(
    loader=FileSystemLoader(str(TEMPLATES_DIR)),
    autoescape=select_autoescape(["html"]),
)


def _render_template(name: str, **kwargs: str) -> str:
    return _jinja.get_template(name).render(**kwargs)  # type: ignore[no-any-return]


@router.post("/register", response_model=RegisterResponse)
@limiter.limit("5/minute")
async def register(
    request: Request, body: RegisterRequest, db: AsyncSession = Depends(get_db)
) -> RegisterResponse:
    result = await db.execute(select(User).where(User.email == body.email))
    if result.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    verified = not settings.require_email_verification
    user = User(
        email=body.email,
        first_name=body.first_name,
        last_name=body.last_name,
        password_hash=hash_password(body.password),
        role=UserRole.USER,
        email_verified=verified,
    )
    db.add(user)
    await db.flush()

    if settings.require_email_verification:
        token = await create_token(db, user.id, TokenType.EMAIL_VERIFICATION)
        verify_url = f"{settings.frontend_url}/verify-email?token={token}"
        html = _render_template(
            "verify_email.html",
            app_name=settings.app_name,
            verify_url=verify_url,
            expire_hours=str(settings.verification_token_expire_hours),
        )
        await send_email(
            EmailMessage(
                to=user.email,
                subject=f"Verify your email — {settings.app_name}",
                html=html,
            )
        )

    await db.commit()
    return RegisterResponse(
        message="Check your email to verify your account" if not verified else "Account created",
        requires_verification=not verified,
    )


@router.post("/verify-email", response_model=MessageResponse)
async def verify_email(
    body: VerifyEmailRequest, db: AsyncSession = Depends(get_db)
) -> MessageResponse:
    token = await consume_token(db, body.token, TokenType.EMAIL_VERIFICATION)
    if token is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification link",
        )

    result = await db.execute(select(User).where(User.id == token.user_id))
    user = result.scalar_one_or_none()
    if user is None:
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification link",
        )

    user.email_verified = True
    await db.commit()
    return MessageResponse(message="Email verified successfully")


@router.post("/forgot-password", response_model=MessageResponse)
@limiter.limit("3/minute")
async def forgot_password(
    request: Request, body: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)
) -> MessageResponse:
    # Always return the same response to prevent email enumeration
    result = await db.execute(
        select(User).where(User.email == body.email, User.is_active.is_(True))
    )
    user = result.scalar_one_or_none()

    if user is not None:
        token = await create_token(db, user.id, TokenType.PASSWORD_RESET)
        reset_url = f"{settings.frontend_url}/reset-password?token={token}"
        html = _render_template(
            "reset_password.html",
            app_name=settings.app_name,
            reset_url=reset_url,
            expire_hours=str(settings.password_reset_token_expire_hours),
        )
        await send_email(
            EmailMessage(
                to=user.email,
                subject=f"Reset your password — {settings.app_name}",
                html=html,
            )
        )
        await db.commit()

    return MessageResponse(message="If an account exists with that email, we sent a reset link")


@router.post("/reset-password", response_model=MessageResponse)
@limiter.limit("5/minute")
async def reset_password(
    request: Request, body: ResetPasswordRequest, db: AsyncSession = Depends(get_db)
) -> MessageResponse:
    token = await consume_token(db, body.token, TokenType.PASSWORD_RESET)
    if token is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset link",
        )

    result = await db.execute(select(User).where(User.id == token.user_id))
    user = result.scalar_one_or_none()
    if user is None:
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset link",
        )

    user.password_hash = hash_password(body.password)
    await db.commit()
    return MessageResponse(message="Password reset successfully")


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(
    request: Request, body: LoginRequest, db: AsyncSession = Depends(get_db)
) -> TokenResponse:
    user = await authenticate_user(db, body.email, body.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if settings.require_email_verification and not user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email before logging in",
        )

    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(body: RefreshRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    try:
        payload = decode_token(body.refresh_token)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        ) from e

    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
        )

    try:
        user_id = uuid.UUID(payload["sub"])
    except (KeyError, ValueError) as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        ) from e
    user = await get_user_by_id(db, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or deactivated",
        )

    return TokenResponse(
        access_token=create_access_token(user_id),
        refresh_token=create_refresh_token(user_id),
    )

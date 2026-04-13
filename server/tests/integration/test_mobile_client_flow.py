"""Locks in the contract that the backend works for non-cookie clients.

Mobile clients (React Native, native iOS/Android) store tokens in SecureStore /
Keychain and attach them via an Authorization header. The backend must not
require cookies anywhere in the auth flow — login returns tokens in the body,
refresh reads the refresh token from the request body, and no response sets an
auth cookie. If any of that regresses, this test breaks.
"""

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.verification_token import TokenType, VerificationToken


async def test_full_mobile_client_flow_uses_only_bearer_tokens(
    client: AsyncClient, db: AsyncSession
) -> None:
    # 1. Register — no cookies involved on the client side.
    register = await client.post(
        "/api/auth/register",
        json={
            "email": "mobile@example.com",
            "password": "mobilepass123",
            "first_name": "Mobile",
            "last_name": "Client",
        },
    )
    assert register.status_code == 200
    assert "set-cookie" not in {k.lower() for k in register.headers}

    # 2. Verify email — grab the token the service created instead of parsing email.
    token_row = (
        await db.execute(
            select(VerificationToken).where(VerificationToken.type == TokenType.EMAIL_VERIFICATION)
        )
    ).scalar_one()
    verify = await client.post("/api/auth/verify-email", json={"token": token_row.token})
    assert verify.status_code == 200

    # 3. Login — tokens must come back in the body, not as Set-Cookie headers.
    login = await client.post(
        "/api/auth/login",
        json={"email": "mobile@example.com", "password": "mobilepass123"},
    )
    assert login.status_code == 200
    assert "set-cookie" not in {k.lower() for k in login.headers}
    tokens = login.json()
    access_token = tokens["access_token"]
    refresh_token = tokens["refresh_token"]
    assert tokens["token_type"] == "bearer"

    # 4. Hit a protected endpoint with only the Authorization header.
    me = await client.get("/api/users/me", headers={"Authorization": f"Bearer {access_token}"})
    assert me.status_code == 200
    assert me.json()["email"] == "mobile@example.com"

    # 5. Refresh — refresh token goes in the request body, new tokens come back in the body.
    refreshed = await client.post("/api/auth/refresh", json={"refresh_token": refresh_token})
    assert refreshed.status_code == 200
    assert "set-cookie" not in {k.lower() for k in refreshed.headers}
    new_access = refreshed.json()["access_token"]
    assert new_access

    # 6. Protected endpoint still works with the rotated access token.
    me_again = await client.get("/api/users/me", headers={"Authorization": f"Bearer {new_access}"})
    assert me_again.status_code == 200


async def test_protected_endpoint_rejects_cookie_only_auth(
    client: AsyncClient, test_user: User
) -> None:
    """Sanity check: passing the access token as a cookie instead of a header fails.

    This proves the backend genuinely reads the Authorization header and doesn't have
    a hidden cookie fallback — a mobile client that only uses headers gets the same
    behavior as a browser client would.
    """
    from app.services.auth_service import create_access_token

    token = create_access_token(test_user.id)
    response = await client.get("/api/users/me", cookies={"access_token": token})
    assert response.status_code == 401

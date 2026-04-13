"""Integration tests for validation error sanitization.

These cover the full FastAPI pipeline end to end, so a regression anywhere
between ``RequestValidationError`` and the JSON response will fail here.
"""

from httpx import AsyncClient


async def test_password_validation_error_does_not_echo_plaintext(
    client: AsyncClient,
) -> None:
    """A 422 on the ``password`` field must NOT return the plaintext value.

    This is the worst-case leak: the user typed a real password and got a
    short-password validation error. If the body contains the plaintext it
    will show up in access logs, Sentry, and client error trackers.
    """
    # A plaintext short enough to trip min_length, but distinctive enough
    # that we can grep for it in the response body.
    plaintext_password = "hunt3r"

    response = await client.post(
        "/api/auth/register",
        json={
            "email": "leak@example.com",
            "first_name": "Leaky",
            "last_name": "User",
            "password": plaintext_password,
        },
    )

    assert response.status_code == 422
    body = response.text
    # The exact plaintext we just sent must not reappear anywhere in the payload.
    assert plaintext_password not in body, (
        f"plaintext password leaked back in response body: {body}"
    )
    # The sanitizer should have replaced ``input`` on the password entry.
    detail = response.json()["error"]["detail"]
    password_error = next(err for err in detail if err.get("loc", [None])[-1] == "password")
    assert password_error.get("input") == "[redacted]"


async def test_validation_error_drops_ctx_field(client: AsyncClient) -> None:
    """``ctx`` must be stripped entirely — it can leak regex/validation internals."""
    response = await client.post(
        "/api/auth/register",
        json={
            "email": "not-an-email",
            "first_name": "Bad",
            "last_name": "Email",
            "password": "password123",
        },
    )

    assert response.status_code == 422
    detail = response.json()["error"]["detail"]
    assert len(detail) >= 1
    for err in detail:
        assert "ctx" not in err, f"ctx leaked in {err}"


async def test_non_sensitive_field_input_is_preserved(client: AsyncClient) -> None:
    """Non-sensitive fields should still echo ``input`` so clients can display
    the bad value back to the user. Redaction should be targeted, not global."""
    response = await client.post(
        "/api/auth/register",
        json={
            "email": "ok@example.com",
            "first_name": "",  # too short, non-sensitive
            "last_name": "User",
            "password": "password123",
        },
    )

    assert response.status_code == 422
    detail = response.json()["error"]["detail"]
    first_name_err = next(
        (err for err in detail if err.get("loc", [None])[-1] == "first_name"),
        None,
    )
    assert first_name_err is not None, f"expected a validation error on first_name, got: {detail}"
    # Whatever Pydantic gives back for input, it should not be the redaction sentinel.
    assert first_name_err.get("input") != "[redacted]"
    # The original empty string should still be echoed back so the client
    # can show the user what they typed.
    assert first_name_err.get("input") == ""

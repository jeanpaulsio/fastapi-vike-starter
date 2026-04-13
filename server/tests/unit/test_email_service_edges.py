"""Coverage for the Resend + SMTP backends and the `get_email_backend` factory.

The template advertises production email. If a consumer relies on that
promise and prod is broken because we only ever covered the console
backend, that's on us. These tests mock the network boundary (the
`resend` SDK and `aiosmtplib.send`) so they run fast, hermetic, and
prove the *parameter shapes* the backends put on the wire.
"""

from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

import app.services.email_service as email_service
from app.config import settings
from app.services.email_service import (
    ConsoleBackend,
    EmailMessage,
    ResendBackend,
    SmtpBackend,
    get_email_backend,
    send_email,
)


@pytest.fixture(autouse=True)
def _reset_backend_singleton() -> Any:
    """Every test starts with a cold `_backend`."""
    original = email_service._backend
    email_service._backend = None
    try:
        yield
    finally:
        email_service._backend = original


class TestSendEmail:
    async def test_send_email_uses_console_backend(self) -> None:
        result = await send_email(
            EmailMessage(to="test@example.com", subject="Test", html="<p>Hi</p>")
        )
        assert result["status"] == "sent"


class TestResendBackend:
    """ResendBackend wraps the Resend Python SDK, which is synchronous.

    The backend runs `Emails.send` in an executor so it doesn't block the
    event loop. These tests mock the SDK at the module level so no network
    call is made and we can inspect the exact params passed through.
    """

    def _install_fake_resend(self, send_return: Any) -> MagicMock:
        fake = MagicMock()
        fake.Emails.send.return_value = send_return
        # __init__ does `import resend`, which reads from sys.modules first.
        patch.dict("sys.modules", {"resend": fake}).start()
        return fake

    async def test_init_sets_api_key_on_sdk(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setattr(settings, "resend_api_key", "re_test_key")
        fake = self._install_fake_resend({"id": "re_1"})
        try:
            ResendBackend()
            assert fake.api_key == "re_test_key"
        finally:
            patch.stopall()

    async def test_send_passes_required_params(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setattr(settings, "email_from", "noreply@example.com")
        fake = self._install_fake_resend({"id": "re_1", "status": "sent"})
        try:
            backend = ResendBackend()
            result = await backend.send(
                EmailMessage(
                    to="user@example.com",
                    subject="Welcome",
                    html="<p>Hi</p>",
                )
            )
            fake.Emails.send.assert_called_once()
            params = fake.Emails.send.call_args[0][0]
            assert params["from"] == "noreply@example.com"
            assert params["to"] == ["user@example.com"]  # string → singleton list
            assert params["subject"] == "Welcome"
            assert params["html"] == "<p>Hi</p>"
            assert "reply_to" not in params  # not set on the message
            assert result == {"id": "re_1", "status": "sent"}
        finally:
            patch.stopall()

    async def test_send_forwards_reply_to_and_list_recipients(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr(settings, "email_from", "default@example.com")
        fake = self._install_fake_resend({"id": "re_2"})
        try:
            backend = ResendBackend()
            await backend.send(
                EmailMessage(
                    to=["a@example.com", "b@example.com"],
                    subject="Batch",
                    html="<p>Hello</p>",
                    from_email="custom@example.com",
                    reply_to="ops@example.com",
                )
            )
            params = fake.Emails.send.call_args[0][0]
            assert params["from"] == "custom@example.com"  # explicit override
            assert params["to"] == ["a@example.com", "b@example.com"]
            assert params["reply_to"] == "ops@example.com"
        finally:
            patch.stopall()

    async def test_send_coerces_non_dict_result_to_dict(self) -> None:
        # Older Resend SDK versions returned something dict-compatible but
        # not an actual dict. The backend coerces with `dict(result)`.
        dict_like = [("id", "re_3"), ("status", "queued")]
        self._install_fake_resend(dict_like)
        try:
            backend = ResendBackend()
            result = await backend.send(
                EmailMessage(to="x@example.com", subject="s", html="<p>h</p>")
            )
            assert result == {"id": "re_3", "status": "queued"}
        finally:
            patch.stopall()


class TestSmtpBackend:
    """SmtpBackend builds a MIMEMultipart and hands it to `aiosmtplib.send`.

    We patch `aiosmtplib.send` as an AsyncMock and assert on the message
    shape and the connection params. This proves that a user who sets
    `EMAIL_BACKEND=smtp` in production gets a message that actually goes
    out with their subject, HTML body, and credentials.
    """

    async def test_send_calls_aiosmtplib_with_configured_params(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr(settings, "email_from", "noreply@example.com")
        monkeypatch.setattr(settings, "smtp_host", "smtp.example.com")
        monkeypatch.setattr(settings, "smtp_port", 2525)
        monkeypatch.setattr(settings, "smtp_username", "user")
        monkeypatch.setattr(settings, "smtp_password", "pw")
        monkeypatch.setattr(settings, "smtp_use_tls", True)

        with patch("aiosmtplib.send", new_callable=AsyncMock) as mock_send:
            backend = SmtpBackend()
            result = await backend.send(
                EmailMessage(
                    to="user@example.com",
                    subject="Welcome",
                    html="<p>Hi</p>",
                    reply_to="ops@example.com",
                )
            )

            mock_send.assert_called_once()
            msg = mock_send.call_args[0][0]
            assert msg["From"] == "noreply@example.com"
            assert msg["To"] == "user@example.com"
            assert msg["Subject"] == "Welcome"
            assert msg["Reply-To"] == "ops@example.com"
            # The HTML body is attached as a MIMEText part.
            html_parts = [
                part.get_payload(decode=True).decode()
                for part in msg.walk()
                if part.get_content_type() == "text/html"
            ]
            assert "<p>Hi</p>" in html_parts[0]

            kwargs = mock_send.call_args.kwargs
            assert kwargs["hostname"] == "smtp.example.com"
            assert kwargs["port"] == 2525
            assert kwargs["username"] == "user"
            assert kwargs["password"] == "pw"
            assert kwargs["start_tls"] is True

            assert result == {"id": "smtp", "status": "sent"}

    async def test_send_joins_list_recipients(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setattr(settings, "email_from", "noreply@example.com")
        monkeypatch.setattr(settings, "smtp_host", "smtp.example.com")
        monkeypatch.setattr(settings, "smtp_port", 587)

        with patch("aiosmtplib.send", new_callable=AsyncMock) as mock_send:
            backend = SmtpBackend()
            await backend.send(
                EmailMessage(
                    to=["a@example.com", "b@example.com"],
                    subject="Batch",
                    html="<p>Hi</p>",
                )
            )
            msg = mock_send.call_args[0][0]
            assert msg["To"] == "a@example.com, b@example.com"
            # No reply_to set on the message → no Reply-To header.
            assert msg["Reply-To"] is None

    async def test_send_passes_none_for_empty_credentials(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Empty string creds get coerced to None so aiosmtplib skips auth."""
        monkeypatch.setattr(settings, "smtp_host", "smtp.example.com")
        monkeypatch.setattr(settings, "smtp_port", 25)
        monkeypatch.setattr(settings, "smtp_username", "")
        monkeypatch.setattr(settings, "smtp_password", "")
        monkeypatch.setattr(settings, "smtp_use_tls", False)

        with patch("aiosmtplib.send", new_callable=AsyncMock) as mock_send:
            backend = SmtpBackend()
            await backend.send(EmailMessage(to="x@example.com", subject="s", html="<p>h</p>"))
            kwargs = mock_send.call_args.kwargs
            assert kwargs["username"] is None
            assert kwargs["password"] is None
            assert kwargs["start_tls"] is False


class TestGetEmailBackendFactory:
    def test_default_is_console(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setattr(settings, "email_backend", "console")
        assert isinstance(get_email_backend(), ConsoleBackend)

    def test_resend_branch(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setattr(settings, "email_backend", "resend")
        monkeypatch.setattr(settings, "resend_api_key", "re_test")
        fake = MagicMock()
        patch.dict("sys.modules", {"resend": fake}).start()
        try:
            backend = get_email_backend()
            assert isinstance(backend, ResendBackend)
        finally:
            patch.stopall()

    def test_smtp_branch(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setattr(settings, "email_backend", "smtp")
        assert isinstance(get_email_backend(), SmtpBackend)

    def test_unknown_backend_falls_through_to_console(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr(settings, "email_backend", "not-a-real-backend")
        assert isinstance(get_email_backend(), ConsoleBackend)

    def test_singleton_caching(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setattr(settings, "email_backend", "console")
        b1 = get_email_backend()
        b2 = get_email_backend()
        assert b1 is b2

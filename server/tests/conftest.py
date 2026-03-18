import os
import uuid
from collections.abc import AsyncGenerator

# Must be set before app.config is imported
os.environ.setdefault("DEBUG", "true")

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.database import get_db
from app.main import app
from app.models import Base
from app.models.user import User, UserRole
from app.services.auth_service import create_access_token, hash_password

# Use a dedicated test database — same engine as dev/prod (Postgres)
# NullPool ensures each request gets a fresh connection (no pooling conflicts)
TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost:5432/{{APP_SLUG_UNDERSCORE}}_test",
)

engine = create_async_engine(TEST_DATABASE_URL, echo=False, poolclass=NullPool)
test_session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

_tables_created = False


@pytest.fixture(autouse=True)
async def setup_db() -> AsyncGenerator[None, None]:
    """Create tables once, clean up after each test."""
    global _tables_created
    if not _tables_created:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)
        _tables_created = True
    yield
    async with engine.begin() as conn:
        await conn.execute(text("DELETE FROM items"))
        await conn.execute(text("DELETE FROM verification_tokens"))
        await conn.execute(text("DELETE FROM users"))


async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
    async with test_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture
async def db() -> AsyncGenerator[AsyncSession, None]:
    async with test_session_factory() as session:
        yield session


@pytest.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
async def test_user(db: AsyncSession) -> User:
    user = User(
        id=uuid.uuid4(),
        email="test@example.com",
        first_name="Test",
        last_name="User",
        password_hash=hash_password("testpass123"),
        role=UserRole.USER,
        email_verified=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@pytest.fixture
async def admin_user(db: AsyncSession) -> User:
    user = User(
        id=uuid.uuid4(),
        email="admin@example.com",
        first_name="Admin",
        last_name="User",
        password_hash=hash_password("adminpass123"),
        role=UserRole.ADMIN,
        email_verified=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@pytest.fixture
def auth_headers(test_user: User) -> dict[str, str]:
    token = create_access_token(test_user.id)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def admin_headers(admin_user: User) -> dict[str, str]:
    token = create_access_token(admin_user.id)
    return {"Authorization": f"Bearer {token}"}

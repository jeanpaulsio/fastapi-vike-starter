"""Seed script: runs migrations and creates an admin user for local development.

Usage:
    cd server && python scripts/seed.py
"""

import asyncio
import subprocess
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.config import settings
from app.database import engine
from app.models.user import User, UserRole
from app.services.auth_service import hash_password


async def seed() -> None:
    print(f"Connecting to: {settings.database_url}")

    # Run migrations instead of create_all to keep alembic_version in sync
    subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"], check=True)
    print("Migrations applied")

    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with session_factory() as session:
        result = await session.execute(select(User).where(User.email == "admin@example.com"))
        existing = result.scalar_one_or_none()

        if existing:
            print(f"Admin user already exists: {existing.email}")
            return

        admin = User(
            id=uuid.uuid4(),
            email="admin@example.com",
            first_name="Admin",
            last_name="User",
            password_hash=hash_password("admin123"),
            role=UserRole.ADMIN,
            email_verified=True,
        )
        session.add(admin)
        await session.commit()
        print("Created admin user: admin@example.com / admin123")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())

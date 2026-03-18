# Alembic Migrations — Best Practices for This Project

Hard-won lessons from deploying schema changes to Render with async SQLAlchemy + Postgres.

---

## 1. Golden Rules

**NEVER use `Base.metadata.create_all()` outside of tests.** This creates tables without Alembic knowing, which causes `DuplicateObject` errors on the next migration. The seed script uses `alembic upgrade head` instead.

**NEVER edit a migration that has been applied.** Once a migration has run (locally, in CI, or in prod), it is immutable. If you need to fix something, write a new migration on top. Editing an applied migration causes schema drift — your DB ran the old version, the file now says something different, and `alembic upgrade head` is a no-op because it thinks the migration already ran.

**NEVER use `Enum()` directly.** Always use `pg_enum()` from `app.models.base`:
```python
from app.models.base import pg_enum

role: Mapped[UserRole] = mapped_column(
    pg_enum(UserRole, "user_role"),  # lowercase values for Postgres
    nullable=False,
)
```
Without `pg_enum()`, SQLAlchemy sends uppercase enum names (`USER`) but Postgres stores lowercase values (`user`). Tests against Postgres catch this; SQLite does not.

**ALWAYS test against Postgres, never SQLite.** The test database is `myapp_test` on localhost. SQLite silently ignores enum types, locking, and type mismatches.

---

## 2. Creating a New Migration

### Step 1: Change the model
```python
# app/models/whatever.py
class MyModel(TimestampMixin, Base):
    __tablename__ = "my_models"
    new_field: Mapped[str] = mapped_column(String(255), nullable=False)
```

### Step 2: Write the migration manually
Do NOT rely on `--autogenerate` — it often misses data migrations and enum changes. Write it by hand:

```bash
# Create an empty migration file
alembic revision -m "add new_field to my_models"
```

Then fill in `upgrade()` and `downgrade()`:
```python
def upgrade() -> None:
    # For new columns on existing tables: add as nullable first, backfill, then make NOT NULL
    op.add_column("my_models", sa.Column("new_field", sa.String(255), nullable=True))
    op.execute("UPDATE my_models SET new_field = 'default_value'")
    op.alter_column("my_models", "new_field", nullable=False)

def downgrade() -> None:
    op.drop_column("my_models", "new_field")
```

### Step 3: Run and verify locally
```bash
cd server && source .venv/bin/activate
alembic upgrade head    # apply
alembic downgrade -1    # test rollback
alembic upgrade head    # re-apply
pytest tests/ -v        # verify tests pass against the new schema
```

### Step 4: Register new models
If you created a new model file, import it in `app/models/__init__.py`:
```python
from app.models.my_model import MyModel
__all__ = [..., "MyModel"]
```

### Step 5: Update the TRUNCATE list in test conftest
If you added a new table, add it to the cleanup in `tests/conftest.py`:
```python
await conn.execute(text("DELETE FROM my_models"))
await conn.execute(text("DELETE FROM verification_tokens"))
await conn.execute(text("DELETE FROM users"))
```
Order matters — delete from child tables before parent tables (foreign keys).

---

## 3. Adding a New Enum

```python
# In the model file
import enum

class Status(enum.StrEnum):
    DRAFT = "draft"
    PUBLISHED = "published"
```

In the migration:
```python
def upgrade() -> None:
    # Create the enum type explicitly
    status_enum = sa.Enum("draft", "published", name="status_type")
    status_enum.create(op.get_bind())
    op.add_column("posts", sa.Column("status", status_enum, nullable=False, server_default="draft"))

def downgrade() -> None:
    op.drop_column("posts", "status")
    op.execute("DROP TYPE IF EXISTS status_type")
```

In the model, always use `pg_enum()`:
```python
status: Mapped[Status] = mapped_column(
    pg_enum(Status, "status_type"),
    nullable=False,
    default=Status.DRAFT,
)
```

---

## 4. Adding Values to an Existing Enum

Postgres enums can add values but CANNOT remove them. This is a one-way operation:

```python
def upgrade() -> None:
    op.execute("ALTER TYPE status_type ADD VALUE IF NOT EXISTS 'archived'")

def downgrade() -> None:
    # Cannot remove enum values in Postgres — document this
    pass
```

---

## 5. Renaming or Splitting Columns

Always do a 3-step migration (add → backfill → drop):

```python
def upgrade() -> None:
    # 1. Add new columns as nullable
    op.add_column("users", sa.Column("first_name", sa.String(255), nullable=True))
    op.add_column("users", sa.Column("last_name", sa.String(255), nullable=True))

    # 2. Backfill from old column
    op.execute("""
        UPDATE users SET
            first_name = split_part(name, ' ', 1),
            last_name = COALESCE(NULLIF(substring(name from position(' ' in name) + 1), ''), '')
    """)

    # 3. Make NOT NULL and drop old column
    op.alter_column("users", "first_name", nullable=False)
    op.alter_column("users", "last_name", nullable=False)
    op.drop_column("users", "name")
```

---

## 6. Deployment Flow

The pre-deploy command on Render is:
```
cd server && alembic upgrade head
```
- `alembic upgrade head` runs any pending migrations.

**When deploying schema changes:**
1. Merge the PR with the migration
2. Render auto-deploys and runs the pre-deploy command
3. The migration runs before the new code starts serving traffic
4. No manual intervention needed

---

## 7. Common Mistakes

### "type already exists" on deploy
The database was created with `create_all()` instead of migrations. Fix: stamp the current schema revision with `alembic stamp <revision>`, then deploy.

### "column does not exist" locally
You forgot to run `alembic upgrade head` after pulling new code:
```bash
cd server && alembic upgrade head
```

### Editing an already-applied migration
Applied migrations are immutable. If a migration has run anywhere (locally, CI, prod), do NOT edit it. The revision is already recorded in `alembic_version` — Alembic will skip it on `upgrade head`, so your edits never execute. Write a new migration on top instead. This is the #1 cause of "it works on my machine" schema drift.

### Enum case mismatch ("invalid input value for enum")
You used `Enum()` instead of `pg_enum()`. The fix: add `values_callable=lambda e: [x.value for x in e]` or switch to `pg_enum()`.

### Migration works locally but fails in CI/prod
Your local DB has state from manual changes. Drop and recreate your test DB:
```bash
dropdb myapp_test && createdb myapp_test
```

### "relation already exists" in tests
The test conftest creates tables once per session. If you changed the schema, restart the test runner or drop the test DB.

---

## 8. Checking Migration State

```bash
# What's the current revision?
alembic current

# What migrations are pending?
alembic history --verbose

# Show the SQL a migration would generate (dry run)
alembic upgrade head --sql
```

---

## 9. Pre-Commit Checklist for Schema Changes

- [ ] Model updated in `app/models/`
- [ ] New model imported in `app/models/__init__.py`
- [ ] Migration written (not autogenerated) with proper `upgrade()` and `downgrade()`
- [ ] Enums use `pg_enum()` helper
- [ ] New tables added to test conftest DELETE cleanup
- [ ] `alembic upgrade head` runs locally
- [ ] `alembic downgrade -1` then `upgrade head` works (round-trip)
- [ ] All tests pass against Postgres (`pytest tests/ -v`)
- [ ] Schemas (`app/schemas/`) updated to match model changes
- [ ] Frontend types updated if API response shape changed

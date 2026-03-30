# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## CRITICAL: Git Workflow

**NEVER push directly to `main`.** Always:
1. Create a branch (`git checkout -b fix/...` or `feat/...`)
2. Commit to the branch
3. Open a PR

No exceptions — not for one-line fixes, not for typos, not for anything.

## Product: {{APP_DISPLAY_NAME}}

A full-stack web application built with FastAPI (Python) + Vike/React (TypeScript). Features complete authentication, SSR, background workers, and Render deployment.

## Architecture

```
Frontend (Vike SSR + React)
        ↓
API Layer (FastAPI — Auth, RBAC, Routing)
        ↓
Database (PostgreSQL)  |  Job Queue (Celery + Redis)
```

## Tech Stack

- **Backend**: Python 3.13, FastAPI, SQLAlchemy 2.0 (async), Alembic, Celery + Redis
- **Frontend**: Vike (SSR framework on Vite), React 19, TypeScript, Tailwind CSS v4, shadcn/ui
- **Database**: PostgreSQL (asyncpg driver)
- **Deployment**: Render (web service + workers + managed Postgres + Redis)

## Development Commands

### Backend (from `server/`)
```bash
# Setup
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"

# Run dev server
uvicorn app.main:app --reload --port 8000

# Run tests
pytest tests/ -v

# Run single test file
pytest tests/unit/test_auth_service.py -v

# Lint
ruff check app/ tests/
ruff format app/ tests/

# Type check
mypy app/ --ignore-missing-imports

# Database migrations
python -m alembic revision --autogenerate -m "description"
python -m alembic upgrade head

# Celery worker (requires Redis running)
python -m celery -A app.workers.celery_app worker --loglevel=info
python -m celery -A app.workers.celery_app beat --loglevel=info

# Seed admin user (requires Postgres running)
python scripts/seed.py
```

### Frontend (from `web/`)
```bash
npm install
npm run dev          # Dev server at localhost:3000 (proxies /api to :8000)
npm run build        # Production build
npm run lint         # ESLint
npm run typecheck    # TypeScript check
npm test             # Vitest
npm run test:coverage # Vitest with coverage report
```

## Pre-Commit Checklist (CRITICAL)

**ALL checks must pass before committing. CI runs all of these — commit should never break CI.**

### Backend (from `server/`)
```bash
ruff check app/ tests/              # lint rules
ruff format --check app/ tests/     # formatting (separate from lint!)
mypy app/ --ignore-missing-imports  # type check
pytest tests/ -v                    # tests (90% coverage enforced)
```

### Frontend (from `web/`)
```bash
npm run lint        # ESLint + Prettier
npm run typecheck   # tsc --noEmit
npm test            # Vitest (80% coverage target)
```

`ruff format --check` is a **separate CI step** from `ruff check`. Code can pass `ruff check` but fail `ruff format --check`. Always run both.

## Monorepo Conventions

| Question | Answer |
|---|---|
| New DB table? | `server/app/models/new_table.py` → import in `models/__init__.py` |
| New API endpoint? | `server/app/api/new_resource.py` → register in `api/router.py` |
| Business logic? | `server/app/services/` — never in routes, never in models |
| New frontend page? | `web/pages/app/<name>/+Page.tsx` (Vike file-based routing) |
| New background job? | `server/app/workers/` as a Celery task |
| New cron job? | Decorate with `@cron("name", hour=2)` in worker module — auto-registered |
| New migration? | `cd server && alembic revision --autogenerate -m "description"` |
| New CRUD resource? | Extend `BaseRepository` in `services/` (see `item_service.py` as example) |

## Backend Patterns

### API Error Envelope
All errors return: `{ "error": { "code": "...", "message": "...", "detail": ... } }`
Raise `AppError` subclasses from `app.utils.exceptions` for business errors.

### Pagination
Use `PaginationParams` as a FastAPI dependency, return `PaginatedResponse.create(...)`.
All list endpoints should be paginated.

### Base Repository
`BaseRepository[ModelT, CreateSchemaT, UpdateSchemaT]` provides:
`get_by_id`, `get_by_id_or_raise`, `list` (paginated), `create`, `update`, `delete`, `soft_delete`.
Override `create` when you need to transform fields (e.g., hashing passwords).

### Cron Jobs
Use the `@cron` decorator from `app.workers.registry`:
```python
@celery.task(name="app.workers.my_worker.my_task")
@cron("my-job", hour=2, minute=0)
def my_task():
    ...
```

### Email
Use `send_email(EmailMessage(...))` from `app.services.email_service`.
Defaults to console backend in dev. Set `EMAIL_BACKEND=resend` or `EMAIL_BACKEND=smtp` in production.

### Observability
- **Structured logging**: structlog with request IDs (X-Request-ID header)
- **Error tracking**: Sentry (configure SENTRY_DSN env var)
- **Code coverage**: Codecov with separate `backend` (90% target) and `frontend` (80% target) flags — see `codecov.yml`
- **Rate limiting**: slowapi (decorator-based) — use `@limiter.limit("10/minute")` on sensitive routes

## Auth System

### Endpoints
- `POST /api/auth/register` — create account, send verification email
- `POST /api/auth/verify-email` — verify email with token
- `POST /api/auth/login` — returns access + refresh tokens (cookies)
- `POST /api/auth/refresh` — refresh access token
- `POST /api/auth/forgot-password` — send password reset email
- `POST /api/auth/reset-password` — reset password with token

### Key Design Decisions
- **Cookies, not localStorage** — required for SSR
- **Guards are `+guard.ts`, not `+guard.client.ts`** — enforced on server-side render
- **Isomorphic cookie helpers** — `getCookie(name, cookieStr?)` works server + client
- **React Query for user state** — `useCurrentUser()` hook, no Zustand for server state
- RBAC: `UserRole.ADMIN` and `UserRole.USER`

## Data Model (Core Tables)

`users`, `verification_tokens`, `items`

All models extend `Base` with UUID primary key and `TimestampMixin` (created_at, updated_at).

## Design Principles

- **Service layer for business logic.** Routes are thin controllers. Models are data definitions. Logic lives in `services/`.
- **Async by default.** All database operations use async SQLAlchemy. Email sending runs in an executor.
- **Async task execution.** Long-running tasks go through Celery. Never block a request handler.
- **Immutable data patterns.** Create new objects rather than mutating. Return new instances from service methods.
- **Validate at boundaries.** Pydantic schemas validate all API input. Never trust external data.

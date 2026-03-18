# FastAPI + Vike Starter

A production-ready monorepo template for full-stack applications with **FastAPI** (Python) + **Vike/React** (TypeScript), featuring complete authentication, SSR, background workers, and one-click Render deployment.

## What's Included

| Layer | Technology |
|---|---|
| Backend | Python 3.13, FastAPI, SQLAlchemy 2.0 (async), Alembic, Celery + Redis |
| Frontend | Vike (SSR on Vite), React 19, TypeScript, Tailwind CSS v4, shadcn/ui |
| Database | PostgreSQL (asyncpg driver) |
| Cache/Queue | Redis (Celery broker + rate limiting) |
| Deployment | Render Blueprint (API + SSR + Worker + Beat + Postgres + Redis) |
| CI | GitHub Actions (lint + format + type check + test + build) |

### Auth System (ready to use)

- User registration with email verification
- Login with JWT (access + refresh tokens in cookies for SSR)
- Forgot password / reset password with email links
- Role-based access control (ADMIN, USER)
- Route guards (server-side + client-side)
- Seed script with default admin user

### Backend Features

- `BaseRepository` generic CRUD (get, list, create, update, delete, soft_delete)
- Consistent error envelope (`{ "error": { "code", "message", "detail" } }`)
- Pagination (`PaginationParams` dependency + `PaginatedResponse`)
- Cron job decorator (`@cron("name", hour=2)` — auto-registered)
- Pluggable email (console for dev, Resend or SMTP for prod)
- Structured logging (structlog with request IDs)
- Redis-backed rate limiting
- Sentry integration
- 90% test coverage enforced

### Frontend Features

- File-based routing with Vike
- SSR with Express production server
- Zustand auth store
- Axios client with token refresh interceptor
- Isomorphic cookie helpers (works in SSR + browser)
- Dark-themed dashboard layout with sidebar
- 80% test coverage target

## Quick Start

### 1. Create your project

```bash
git clone https://github.com/laxcoders/fastapi-vike-starter.git myapp
cd myapp
rm -rf .git && git init

# Run setup — replaces all template placeholders
./setup.sh myapp "My App"
```

### 2. Create databases

```bash
createdb myapp
createdb myapp_test
```

### 3. Backend setup

```bash
cd server
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
python -m alembic upgrade head
python scripts/seed.py    # creates admin@example.com / admin123
```

### 4. Frontend setup

```bash
cd web
npm install
```

### 5. Start dev servers

```bash
# Terminal 1 — API
cd server && source .venv/bin/activate
uvicorn app.main:app --reload --port 8000

# Terminal 2 — Frontend
cd web && npm run dev
```

Open http://localhost:3000. Login with `admin@example.com` / `admin123`.

API docs (Swagger): http://localhost:8000/api/docs (only when `DEBUG=true`).

### 6. Workers (optional — needed for background tasks)

```bash
# Start Redis first
brew services start redis  # or: docker run -d -p 6379:6379 redis

# Terminal 3 — Celery worker
cd server && source .venv/bin/activate
python -m celery -A app.workers.celery_app worker --loglevel=info

# Terminal 4 — Celery Beat (cron scheduler)
python -m celery -A app.workers.celery_app beat --loglevel=info
```

## Project Structure

```
├── server/                  # Python backend
│   ├── app/
│   │   ├── api/             # Route handlers (thin controllers)
│   │   ├── models/          # SQLAlchemy ORM models
│   │   ├── schemas/         # Pydantic request/response schemas
│   │   ├── services/        # Business logic + BaseRepository
│   │   ├── middleware/      # Logging, rate limiting, errors
│   │   ├── workers/         # Celery tasks + cron registry
│   │   ├── templates/       # Email templates (Jinja2)
│   │   └── utils/           # Exceptions, pagination
│   ├── tests/               # pytest (unit + integration)
│   ├── alembic/             # Database migrations
│   └── scripts/             # seed.py
│
├── web/                     # Vike frontend
│   ├── pages/               # File-based routing (+Page, +Layout, +guard)
│   ├── components/          # Shared UI components (shadcn/ui)
│   ├── services/            # Axios client + API service functions
│   ├── stores/              # Zustand state management
│   ├── lib/                 # App config, types, utilities
│   └── tests/               # Vitest + React Testing Library
│
├── .github/workflows/       # CI pipeline
├── render.yaml              # Render deployment Blueprint
├── setup.sh                 # Project initialization script
└── CLAUDE.md                # AI assistant context
```

## Auth System

### Registration Flow

1. `POST /api/auth/register` — creates user, sends verification email
2. User clicks email link → `GET /verify-email?token=...`
3. `POST /api/auth/verify-email` — marks user as verified
4. User can now log in

### Login Flow

1. `POST /api/auth/login` — returns access + refresh tokens (set as cookies)
2. Route guards (`+guard.ts`) check cookies on every page load (SSR + client)
3. `POST /api/auth/refresh` — refreshes expired access tokens automatically

### Password Reset

1. `POST /api/auth/forgot-password` — sends reset email
2. User clicks link → `GET /reset-password?token=...`
3. `POST /api/auth/reset-password` — updates password

### Key Design Decisions

- **Cookies, not localStorage** — required for SSR to work
- **Guards are `+guard.ts`, not `+guard.client.ts`** — enforced on server render
- **Isomorphic cookie helpers** — `getCookie(name, cookieStr?)` works server + client

## Email Configuration

| Mode | When | Config |
|------|------|--------|
| Console | Local dev (default) | `EMAIL_BACKEND=console` — prints to stdout |
| Resend | Production | `EMAIL_BACKEND=resend`, set `RESEND_API_KEY` |
| SMTP | Self-hosted | `EMAIL_BACKEND=smtp`, set `SMTP_HOST`, `SMTP_PORT`, etc. |

## Running Tests

### Backend (requires PostgreSQL)

```bash
cd server && source .venv/bin/activate

# Create test database (once)
createdb {{APP_SLUG_UNDERSCORE}}_test

# Run all tests
pytest tests/ -v

# Single file
pytest tests/unit/test_auth_service.py -v

# By name pattern
pytest tests/ -k "test_login"
```

Coverage enforced at 90% minimum.

### Frontend

```bash
cd web
npm test                  # run once
npm run test:watch        # watch mode
npm run test:coverage     # with coverage report
```

## Adding New Models / Migrations

1. Create model in `server/app/models/new_table.py`
2. Import it in `server/app/models/__init__.py`
3. Generate migration: `cd server && alembic revision --autogenerate -m "add new_table"`
4. Review the generated migration in `alembic/versions/`
5. Apply: `python -m alembic upgrade head`
6. Test rollback: `alembic downgrade -1` then `python -m alembic upgrade head`


## Deployment to Render

### First Deploy

1. Push to GitHub
2. In Render Dashboard → **New** → **Blueprint** → connect repo
3. Render reads `render.yaml` and creates all services automatically
4. Set additional env vars in Render Dashboard:
   - `EMAIL_BACKEND` = `resend`
   - `RESEND_API_KEY` = your key
   - `FRONTEND_URL` = `https://{{APP_SLUG}}-web.onrender.com`
   - `EMAIL_FROM` = `{{APP_DISPLAY_NAME}} <noreply@yourdomain.com>`
   - `SENTRY_DSN` = your DSN (optional)

### Verify First Deploy

1. Check health: `curl https://{{APP_SLUG}}-api.onrender.com/health`
   — should return `{"status": "healthy", "postgres": "connected", "redis": "connected"}`
2. Open `https://{{APP_SLUG}}-web.onrender.com`
3. Run seed script via Render Shell: `cd server && python scripts/seed.py`
4. Login with `admin@example.com` / `admin123`

### Pre-Deploy Command

The API service runs `python -m alembic upgrade head` before each deploy. This ensures migrations run automatically.

## CI Pipeline

GitHub Actions runs on every push/PR to `main`:

**Backend job:**
1. `ruff check app/ tests/` — lint
2. `ruff format --check app/ tests/` — format verification
3. `mypy app/ --ignore-missing-imports` — type check
4. `pytest tests/ -v` — tests (90% coverage enforced)

**Frontend job:**
1. `npm run lint` — ESLint
2. `npm run typecheck` — tsc
3. `npm test -- --coverage` — Vitest
4. `npm run build` — production build

## Pre-Commit Checklist

Run all checks before committing:

```bash
# Backend (from server/)
ruff check app/ tests/
ruff format --check app/ tests/
mypy app/ --ignore-missing-imports
pytest tests/ -v

# Frontend (from web/)
npm run lint
npm run typecheck
npm test
```

## Prerequisites

- Python 3.11+
- Node.js 22+
- PostgreSQL 15+
- Redis 7+ (for workers and rate limiting)

## License

MIT

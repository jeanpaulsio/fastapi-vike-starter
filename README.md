# FastAPI + Vike Starter

A production-ready monorepo template for full-stack applications with **FastAPI** (Python) + **Vike/React** (TypeScript), featuring complete authentication, SSR, background workers, and one-click Render deployment.

## What's Included

| Layer | Technology |
|---|---|
| Backend | Python 3.13, FastAPI, SQLAlchemy 2.0 (async), Alembic, arq + Redis |
| Frontend | Vike (SSR on Vite), React 19, TypeScript, Tailwind CSS v4, shadcn/ui |
| Database | PostgreSQL (asyncpg driver) |
| Cache/Queue | Redis (arq broker + rate limiting) |
| Deployment | Render Blueprint (API + SSR + Worker + Postgres + Redis) |
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
- React Query for auth state (`useCurrentUser()` hook)
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

### 6. Worker (optional — needed for background tasks and cron)

```bash
# Start Redis first
brew services start redis  # or: docker run -d -p 6379:6379 redis

# Terminal 3 — arq worker (runs on-demand jobs AND cron schedules)
cd server && source .venv/bin/activate
arq app.worker.WorkerSettings
```

One process runs both queue jobs and cron. No separate Beat scheduler.

## Project Structure

```
├── server/                  # Python backend
│   ├── app/
│   │   ├── api/             # Route handlers (thin controllers)
│   │   ├── models/          # SQLAlchemy ORM models
│   │   ├── schemas/         # Pydantic request/response schemas
│   │   ├── services/        # Business logic + BaseRepository
│   │   ├── middleware/      # Logging, rate limiting, errors
│   │   ├── worker.py        # arq WorkerSettings (jobs + cron schedule)
│   │   ├── workers/         # Job implementations (monitoring, etc.)
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
│   ├── hooks/               # React hooks (useCurrentUser, useLogout)
│   ├── lib/                 # App config, types, cookie helpers, utilities
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

1. `POST /api/auth/login` — returns `{ access_token, refresh_token }` in the response body
2. Web client stores them in cookies so Vike `+guard.ts` files can read them during SSR
3. `POST /api/auth/refresh` — accepts `{ refresh_token }` in the body, returns new tokens

### Backend is client-agnostic (web + mobile)

The backend never sets or reads auth cookies. `get_current_user` uses FastAPI's `HTTPBearer`, login returns tokens in the body, and refresh reads the token from the request body. The same API supports:

- **Web (the Vike frontend in this repo)** — Axios interceptor stores tokens in cookies so SSR guards can read them from request headers.
- **Mobile (React Native, native iOS/Android — lives in its own repo)** — client stores tokens in SecureStore / Keychain and attaches `Authorization: Bearer <token>` on every request. No cookies involved.

`server/tests/integration/test_mobile_client_flow.py` locks this contract in — it runs the full register → verify → login → protected call → refresh → protected call flow using only `Authorization` headers and asserts no `Set-Cookie` headers ever appear. If anyone adds a cookie-only code path, CI fails.

### Password Reset

1. `POST /api/auth/forgot-password` — sends reset email
2. User clicks link → `GET /reset-password?token=...`
3. `POST /api/auth/reset-password` — updates password

### Web Frontend Design Decisions

- **Cookies, not localStorage (web only)** — required for Vike SSR guards to read tokens from request headers
- **Guards are `+guard.ts`, not `+guard.client.ts`** — enforced on server render
- **Isomorphic cookie helpers** — `getCookie(name, cookieStr?)` works server + client
- **React Query for auth state** — `useCurrentUser()` hook, no Zustand

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
4. Set additional env vars in Render Dashboard (on the API service):
   - `EMAIL_BACKEND` = `resend`
   - `RESEND_API_KEY` = your key
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

### Troubleshooting Render Deploys

**CORS errors / API calls failing**: Verify these env vars match your actual Render service URLs:
- `VITE_API_URL` (on the web service) — must be `https://<slug>-api.onrender.com`
- `CORS_ORIGINS` (on the API service) — must be `https://<slug>-web.onrender.com`
- `FRONTEND_URL` (on the API service) — must be `https://<slug>-web.onrender.com`

If you used underscores in your app slug (e.g. `starter_app` instead of `starter-app`), the Render URLs will be wrong. The slug must use **hyphens** — `setup.sh` enforces this.

**Email verification/password reset links point to localhost**: Set `FRONTEND_URL` on the API service to your web service URL.

**Login works but page shows "Loading..."**: The frontend can't reach the API. Check `VITE_API_URL` on the web service and `CORS_ORIGINS` on the API service.

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

- Python 3.13 and Node.js 22 (pinned in `.tool-versions` — install with [asdf](https://asdf-vm.com/))
- PostgreSQL 15+
- Redis 7+ (for workers and rate limiting)

## License

MIT

#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# FastAPI + Vike Starter — Setup Script
#
# Usage:
#   ./setup.sh <app-slug> "<Display Name>"
#
# Example:
#   ./setup.sh myapp "My App"
#   ./setup.sh acme-dashboard "Acme Dashboard"
#
# The slug is used for: database names, Render service names, pyproject name
# The display name is used for: UI branding, page titles, emails
# =============================================================================

if [ $# -lt 2 ]; then
  echo "Usage: ./setup.sh <app-slug> \"<Display Name>\""
  echo ""
  echo "  app-slug:     lowercase, hyphen-separated (e.g., myapp, acme-dashboard)"
  echo "  Display Name: human-readable name (e.g., \"My App\", \"Acme Dashboard\")"
  exit 1
fi

APP_SLUG="$1"
APP_DISPLAY_NAME="$2"

# Derive underscore variant for database names (myapp -> myapp, acme-dashboard -> acme_dashboard)
APP_SLUG_UNDERSCORE="${APP_SLUG//-/_}"

echo "Setting up project:"
echo "  Slug:           $APP_SLUG"
echo "  Display Name:   $APP_DISPLAY_NAME"
echo "  DB Name:        $APP_SLUG_UNDERSCORE"
echo "  Test DB:        ${APP_SLUG_UNDERSCORE}_test"
echo ""

# --- Helper: portable sed -i (macOS vs Linux) ---
sedi() {
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "$@"
  else
    sed -i "$@"
  fi
}

# --- Replace template placeholders ---
echo "Replacing template placeholders..."

# Files that contain {{APP_DISPLAY_NAME}}
for file in \
  web/lib/app-config.ts \
  web/pages/+config.ts \
  web/server.js \
  server/app/config.py \
  server/pyproject.toml \
  .env.example \
  render.yaml \
  CLAUDE.md \
  README.md; do
  if [ -f "$file" ]; then
    sedi "s/{{APP_DISPLAY_NAME}}/$APP_DISPLAY_NAME/g" "$file"
  fi
done

# Files that contain {{APP_SLUG}}
for file in \
  server/pyproject.toml \
  render.yaml \
  CLAUDE.md \
  README.md; do
  if [ -f "$file" ]; then
    sedi "s/{{APP_SLUG}}/$APP_SLUG/g" "$file"
  fi
done

# Files that contain {{APP_SLUG_UNDERSCORE}} (database names use underscores)
for file in \
  server/app/config.py \
  server/alembic.ini \
  server/tests/conftest.py \
  .env.example \
  .github/workflows/ci.yml \
  CLAUDE.md \
  README.md; do
  if [ -f "$file" ]; then
    sedi "s/{{APP_SLUG_UNDERSCORE}}/$APP_SLUG_UNDERSCORE/g" "$file"
  fi
done

# --- Copy .env.example to .env for local dev ---
if [ ! -f .env ]; then
  cp .env.example .env
  sedi "s/DEBUG=false/DEBUG=true/" .env
  echo "Created .env from .env.example (DEBUG=true for local dev)"
fi

# --- Summary ---
echo ""
echo "Done! Next steps:"
echo ""
echo "  1. Create the database:"
echo "     createdb $APP_SLUG_UNDERSCORE"
echo "     createdb ${APP_SLUG_UNDERSCORE}_test"
echo ""
echo "  2. Backend setup:"
echo "     cd server"
echo "     python3 -m venv .venv && source .venv/bin/activate"
echo "     pip install -e \".[dev]\""
echo "     python -m alembic upgrade head"
echo "     python scripts/seed.py"
echo ""
echo "  3. Frontend setup:"
echo "     cd web"
echo "     npm install"
echo ""
echo "  4. Start dev servers:"
echo "     # Terminal 1: cd server && uvicorn app.main:app --reload --port 8000"
echo "     # Terminal 2: cd web && npm run dev"
echo ""
echo "  5. Open http://localhost:3000"
echo "     Login: admin@example.com / admin123"

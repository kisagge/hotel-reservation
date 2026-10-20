#!/usr/bin/env bash
# Fresh, seeded database for Playwright E2E runs (haru_e2e). Safe to run repeatedly.
set -euo pipefail
cd "$(dirname "$0")/.."

E2E_DB=haru_e2e
export HARU_DATABASE_URL="postgresql+psycopg://haru:haru@localhost:5433/${E2E_DB}"
psql() { docker compose exec -T db psql -U haru -v ON_ERROR_STOP=1 "$@"; }

if ! psql -d haru -tAc "SELECT 1 FROM pg_database WHERE datname='${E2E_DB}'" | grep -q 1; then
  docker compose exec -T db createdb -U haru "${E2E_DB}"
fi
(cd backend && uv run alembic upgrade head >/dev/null)
psql -d "${E2E_DB}" -qc "TRUNCATE users, rooms, room_photos, room_settings, reservations, payments, rate_limit_hits RESTART IDENTITY CASCADE"
(cd backend && uv run python -m app.seed)

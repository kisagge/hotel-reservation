#!/bin/sh
# Migrate, optionally seed demo data, then serve. WEB_CONCURRENCY × (pool 5 + overflow 5) must fit max_connections.
set -e
alembic upgrade head
if [ "${HARU_SEED:-false}" = "true" ]; then python -m app.seed; fi
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 \
  --workers "${WEB_CONCURRENCY:-2}" --timeout-keep-alive 30

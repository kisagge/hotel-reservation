#!/bin/sh
# Migrate, optionally seed demo data, then serve. WEB_CONCURRENCY × (pool 5 + overflow 5) must fit max_connections.
set -e
alembic upgrade head
if [ "${HARU_SEED:-false}" = "true" ]; then python -m app.seed; fi
# --no-proxy-headers: uvicorn would otherwise replace the client address with X-Forwarded-For from loopback
# peers, and Next passes that header through from the guest. The app reads XFF itself (HARU_TRUST_FORWARDED_FOR).
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --no-proxy-headers \
  --workers "${WEB_CONCURRENCY:-2}" --timeout-keep-alive 30

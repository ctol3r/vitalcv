#!/usr/bin/env bash
# db-migrate-dry-run.sh
# Spins up an ephemeral Postgres container, runs all Prisma migrations, then
# tears down. Exits non-zero if any migration fails.
#
# Requirements: docker, psql/pg_isready (postgres-client), npx (Node >= 18)
#
# Usage:
#   bash scripts/db-migrate-dry-run.sh
#   POSTGRES_IMAGE=postgres:16 bash scripts/db-migrate-dry-run.sh

set -euo pipefail

CONTAINER_NAME="vitalcv-migrate-dry-run-$$"
POSTGRES_IMAGE="${POSTGRES_IMAGE:-postgres:15}"
DB_NAME="vitalcv_dryrun"
DB_USER="postgres"
DB_PASS="postgres"
DB_PORT="5445"
DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:${DB_PORT}/${DB_NAME}"

cleanup() {
  echo "→ Removing ephemeral Postgres container..."
  docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "→ Starting ephemeral Postgres (${POSTGRES_IMAGE}) on port ${DB_PORT}..."
docker run -d \
  --name "${CONTAINER_NAME}" \
  -e POSTGRES_USER="${DB_USER}" \
  -e POSTGRES_PASSWORD="${DB_PASS}" \
  -e POSTGRES_DB="${DB_NAME}" \
  -p "${DB_PORT}:5432" \
  "${POSTGRES_IMAGE}" >/dev/null

echo "→ Waiting for Postgres to accept connections..."
for i in $(seq 1 30); do
  if pg_isready -h localhost -p "${DB_PORT}" -U "${DB_USER}" >/dev/null 2>&1; then
    echo "   Ready after ${i}s."
    break
  fi
  sleep 1
done

pg_isready -h localhost -p "${DB_PORT}" -U "${DB_USER}" >/dev/null 2>&1 || {
  echo "ERROR: Postgres did not become ready in 30s." >&2
  exit 1
}

echo "→ Running prisma migrate deploy against ephemeral DB..."
cd apps/api/backend
DATABASE_URL="${DATABASE_URL}" npx prisma migrate deploy

echo "✓ All migrations applied successfully."

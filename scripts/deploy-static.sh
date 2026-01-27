#!/usr/bin/env bash
set -euo pipefail

# Deterministic Node version for deploy runs.
NODE_VERSION="20.11.1"

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: node is required for deployment." >&2
  exit 1
fi

CURRENT_NODE="$(node -p "process.versions.node")"
if [ "$CURRENT_NODE" != "$NODE_VERSION" ]; then
  echo "ERROR: Node $NODE_VERSION required; found $CURRENT_NODE." >&2
  exit 1
fi

REQUIRED_ENV=("VITALCV_ENV" "NEXT_PUBLIC_BACKEND_URL")
MISSING_ENV=()

for key in "${REQUIRED_ENV[@]}"; do
  if [ -z "${!key:-}" ]; then
    MISSING_ENV+=("$key")
  fi
done

if [ "${#MISSING_ENV[@]}" -gt 0 ]; then
  echo "ERROR: Missing required environment variables: ${MISSING_ENV[*]}" >&2
  exit 1
fi

OUTPUT_DIR="${OUTPUT_DIR:-dist/static-site}"
WEB_DIR="apps/web"
EXPORT_DIR="${WEB_DIR}/out"

pnpm install --frozen-lockfile
pnpm --filter @vitalcv/web build
pnpm --filter @vitalcv/web exec next export

rm -rf "$OUTPUT_DIR"
mkdir -p "$(dirname "$OUTPUT_DIR")"
cp -R "$EXPORT_DIR" "$OUTPUT_DIR"

echo "Static export ready at $OUTPUT_DIR"

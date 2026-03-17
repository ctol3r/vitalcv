#!/usr/bin/env bash
set -euo pipefail

ARGS=("$@")
SCHEMA_PATH=""

for ((i = 0; i < ${#ARGS[@]}; i++)); do
  if [[ "${ARGS[$i]}" == "--schema" && $((i + 1)) -lt ${#ARGS[@]} ]]; then
    SCHEMA_PATH="${ARGS[$((i + 1))]}"
    break
  fi
done

if [[ -n "${SCHEMA_PATH}" ]]; then
  LOCK_SCOPE="$(node -e "const path=require('node:path'); process.stdout.write(path.resolve(process.argv[1]));" "${SCHEMA_PATH}")"
else
  LOCK_SCOPE="${PWD}"
fi

LOCK_HASH="$(node -e "const crypto=require('node:crypto'); process.stdout.write(crypto.createHash('sha256').update(process.argv[1]).digest('hex'));" "${LOCK_SCOPE}")"
LOCK_ROOT="${TMPDIR:-/tmp}/vitalcv-prisma-generate-locks"
LOCK_DIR="${LOCK_ROOT}/${LOCK_HASH}"

mkdir -p "${LOCK_ROOT}"

cleanup() {
  rmdir "${LOCK_DIR}" 2>/dev/null || true
}

trap cleanup EXIT

for _ in $(seq 1 300); do
  if mkdir "${LOCK_DIR}" 2>/dev/null; then
    if [[ ${#ARGS[@]} -gt 0 ]]; then
      pnpm exec prisma generate "${ARGS[@]}"
    else
      pnpm exec prisma generate
    fi
    exit 0
  fi

  sleep 0.2
done

echo "Timed out waiting for Prisma generate lock: ${LOCK_SCOPE}" >&2
exit 1

#!/usr/bin/env bash
# scripts/check-web-build-chain.sh
#
# BUILD-CHAIN-1 smoke check. Exercises the canonical local web build
# command (`pnpm turbo run build --filter @vitalcv/web`) and prints
# guidance on the supported alternatives.
#
# Behavior:
#   - set -euo pipefail (any failure aborts and exits non-zero)
#   - does NOT mutate source files
#   - does NOT install dependencies (assumes `pnpm install` has run)
#   - does NOT carry secrets or upstream payloads
#
# Exit code:
#   - 0 if the canonical web build succeeds
#   - non-zero if turbo or the underlying `next build` fails
#
# See docs/ops/vitalcv-build-chain.md for the full story.

set -euo pipefail

# Always run from the repo root regardless of caller cwd.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

echo "[build-chain] Repo root: $REPO_ROOT"
echo "[build-chain] Canonical command: pnpm turbo run build --filter @vitalcv/web"
echo "[build-chain] Alternatives:"
echo "  - pnpm run build:web         (wraps the canonical command)"
echo "  - pnpm run build:web:direct  (prebuilds @vitalcv/trust-state, then runs next build directly)"
echo

# Verify pnpm is on PATH; do not silently install.
if ! command -v pnpm >/dev/null 2>&1; then
  echo "[build-chain] ERROR: pnpm is not on PATH. Install pnpm and retry." >&2
  exit 2
fi

echo "[build-chain] Running: pnpm turbo run build --filter @vitalcv/web"
pnpm turbo run build --filter @vitalcv/web

echo
echo "[build-chain] Web build chain OK."

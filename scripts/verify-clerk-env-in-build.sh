#!/usr/bin/env bash
#
# verify-clerk-env-in-build.sh — postbuild env-substitution verifier.
#
# Confirms that NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY was actually
# substituted into the apps/web build output. Without this check, a
# deploy can silently ship a broken-auth bundle: the env var is unset
# at build time → Next.js substitutes empty string → CLERK_ENABLED
# resolves false → <ClerkProvider> never mounts → sign-in is dead.
# That failure mode is invisible until a user clicks sign-in.
#
# This script converts that into a loud build-time failure.
#
# Usage (CI / postbuild):
#   ./scripts/verify-clerk-env-in-build.sh
#
# Skip in development (env intentionally absent):
#   SKIP_IF_NO_ENV=1 ./scripts/verify-clerk-env-in-build.sh
#
# Truth contract:
#   - Reads only the build output (gitignored .next/static), never
#     the env file itself.
#   - Prints only the prefix (pk_test_ or pk_live_) when found;
#     never the full key. Even though pk_* prefixes ARE public by
#     design (they're shipped to every browser that loads the page),
#     we still don't echo the full value back to a CI log we don't
#     control.
#
set -euo pipefail

WEB_BUILD_DIR="${WEB_BUILD_DIR:-apps/web/.next}"
SKIP_IF_NO_ENV="${SKIP_IF_NO_ENV:-0}"

if [ ! -d "$WEB_BUILD_DIR" ]; then
  echo "ERROR: build directory not found: $WEB_BUILD_DIR"
  echo "Run \`pnpm turbo run build --filter @vitalcv/web\` first."
  exit 66  # EX_NOINPUT
fi

# Search the static chunks for a pk_test_ or pk_live_ literal. Next.js
# substitutes NEXT_PUBLIC_* env vars as text literals at build time.
STATIC_DIR="$WEB_BUILD_DIR/static"
if [ ! -d "$STATIC_DIR" ]; then
  echo "ERROR: static chunk directory not found: $STATIC_DIR"
  exit 66
fi

# Grep for a SUBSTITUTED key: pk_test_ or pk_live_ followed by at
# least 16 chars of key material. The bare prefix `pk_live_` (without
# trailing chars) appears in the bundle because the source code does
# `.startsWith('pk_live_')` for mode-detection — we ignore those.
#
# Real Clerk publishable keys are typically 50+ chars after the
# prefix; 16 is a conservative floor.
FOUND_PREFIX=""
if grep -Erql 'pk_live_[A-Za-z0-9_-]{16,}' "$STATIC_DIR" 2>/dev/null; then
  FOUND_PREFIX="pk_live_"
elif grep -Erql 'pk_test_[A-Za-z0-9_-]{16,}' "$STATIC_DIR" 2>/dev/null; then
  FOUND_PREFIX="pk_test_"
fi

if [ -n "$FOUND_PREFIX" ]; then
  echo "OK: NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY substituted into build (prefix: $FOUND_PREFIX)"
  exit 0
fi

# Not found — either the env wasn't set at build time, or this is
# an intentional dev build without auth configured.
if [ "$SKIP_IF_NO_ENV" = "1" ]; then
  echo "WARN: NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY not found in build."
  echo "  Skipping because SKIP_IF_NO_ENV=1 (dev build without auth)."
  exit 0
fi

cat <<MSG >&2
ERROR: NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY was NOT substituted into the build.

This means Clerk auth will NOT mount in this deploy:
  - <ClerkProvider> will not render (apps/web/app/layout.tsx)
  - /sign-in will show "not configured" message
  - All authenticated routes will redirect to /sign-in indefinitely

Possible causes:
  1. The env var was not set at the moment 'next build' ran.
     - Local: confirm it's in apps/web/.env.local (per #329 template).
     - Vercel: confirm it's set in the project's env vars for the
       current environment (Production / Preview / Development).
  2. The env var was set but is an empty string.
  3. The build cache reused output from a prior failed build.
     - Try a clean rebuild: rm -rf apps/web/.next && pnpm turbo run build --filter @vitalcv/web

To skip this check intentionally (dev build without auth):
  SKIP_IF_NO_ENV=1 ./scripts/verify-clerk-env-in-build.sh

This is a deploy gate. Failing the build is the correct fail-closed
behavior: shipping a silent-broken-auth bundle is strictly worse than
a loud build failure.
MSG
exit 1

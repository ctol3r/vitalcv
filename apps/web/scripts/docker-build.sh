#!/bin/sh
# docker-build.sh — the web image's build-stage entrypoint (Wave 0.1).
#
# WHY THIS EXISTS: Railway only passes service variables into a Dockerfile
# build for names the Dockerfile declares as ARG. The build that shipped
# 18c9311 declared ARG for NEXT_PUBLIC_API_BASE alone, so `next build` ran
# with no Clerk publishable key: every prerendered page and the entire client
# bundle compiled with Clerk DISABLED (clerkEnabled:false in the RSC payload)
# while runtime SSR pages — which read the full service env — served the key.
# Signed-in users were invisible on every prerendered surface.
#
# This script runs INSIDE the build stage, after the Dockerfile has declared
# ARGs for every client-baked variable:
#
#  1. Unset any declared-but-empty NEXT_PUBLIC_* var. Docker ARG defaults are
#     empty STRINGS, and `'' ?? fallback` does not fall back in TypeScript —
#     an empty env var would silently shadow the code's URL defaults.
#  2. Fail closed: when VITALCV_REQUIRE_AUTH_ENV=1 (set on the Railway web
#     service), a missing Clerk publishable key ABORTS the build instead of
#     shipping an auth-dead bundle.
#  3. Run the real build.

set -eu

for var in \
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY \
  NEXT_PUBLIC_CLERK_SIGN_IN_URL \
  NEXT_PUBLIC_CLERK_SIGN_UP_URL \
  NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL \
  NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL \
  NEXT_PUBLIC_BACKEND_URL \
  NEXT_PUBLIC_POSTHOG_KEY \
  NEXT_PUBLIC_POSTHOG_HOST \
; do
  eval "value=\${${var}:-}"
  if [ -z "${value}" ]; then
    unset "${var}" 2>/dev/null || true
  fi
done

if [ "${VITALCV_REQUIRE_AUTH_ENV:-}" = "1" ] && [ -z "${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:-}" ]; then
  echo "FATAL: VITALCV_REQUIRE_AUTH_ENV=1 but NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is not present in the BUILD environment." >&2
  echo "       The client bundle would compile with Clerk disabled (the 18c9311 production incident)." >&2
  echo "       Fix: ensure the Railway service variable exists AND apps/web/Dockerfile declares a matching ARG." >&2
  exit 1
fi

# Test escape hatch: the vitest suite executes this script to verify the
# guard's exit codes without launching a real build.
if [ "${VITALCV_BUILD_DRY_RUN:-}" = "1" ]; then
  echo "docker-build.sh: dry run — guard passed, skipping build."
  exit 0
fi

exec pnpm turbo run build --filter @vitalcv/web

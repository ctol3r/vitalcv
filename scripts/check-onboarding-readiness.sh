#!/usr/bin/env bash
#
# check-onboarding-readiness.sh — pilot pre-flight verifier.
#
# Runs against a running VitalCV instance (local dev OR a deployed
# Vercel preview / production URL) and reports which subsystems are
# configured. Closes the recurring "is my Clerk / signing / JWKS
# config working" pattern without requiring a browser or any
# secret-bearing curl.
#
# Truth contract:
#   - The script ONLY reads public endpoints. It never asks for or
#     prints any secret value.
#   - Failure to reach the server is reported clearly ("connection
#     refused") — not silently swallowed.
#   - The script exits non-zero if any required subsystem is
#     `present: false`. Useful as a CI gate against deploy preview
#     URLs.
#
# Usage:
#   ./scripts/check-onboarding-readiness.sh                       # localhost:3000
#   BASE_URL=https://staging.example.com ./check-onboarding-readiness.sh
#   BASE_URL=https://vitalcv.com ./check-onboarding-readiness.sh
#
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
FAIL=0

# Strip trailing slash for predictable concatenation.
BASE_URL="${BASE_URL%/}"

bold() { printf "\033[1m%s\033[0m\n" "$1"; }
dim()  { printf "\033[2m%s\033[0m\n" "$1"; }
ok()   { printf "  \033[32m✓\033[0m %s\n" "$1"; }
warn() { printf "  \033[33m●\033[0m %s\n" "$1"; }
fail() { printf "  \033[31m✕\033[0m %s\n" "$1"; FAIL=1; }

echo
bold "VitalCV onboarding readiness check"
dim  "Target: $BASE_URL"
echo

# Sanity: is the server reachable at all?
if ! curl -sS -o /dev/null -m 5 -w '%{http_code}' "$BASE_URL" >/dev/null 2>&1; then
  fail "Base URL is not reachable. Is the dev server running? (pnpm --filter @vitalcv/web dev)"
  exit "$FAIL"
fi
ok "Base URL reachable: $BASE_URL"

# ── /api/status/health (PR #327) ───────────────────────────────
bold "Status route /api/status/health"
STATUS_BODY="$(curl -sS -m 10 "$BASE_URL/api/status/health" 2>/dev/null || true)"
if [ -z "$STATUS_BODY" ]; then
  fail "Status route returned nothing. Did #327 merge yet?"
else
  AGGREGATE="$(echo "$STATUS_BODY" | grep -o '"aggregate":"[^"]*"' | head -1 | sed 's/.*:"//;s/"$//')"
  case "$AGGREGATE" in
    ok)
      ok "Status aggregate: ok (all subsystems configured)"
      ;;
    degraded)
      warn "Status aggregate: degraded — some subsystems missing config"
      DEGRADED="$(echo "$STATUS_BODY" | grep -o '"degradedSubsystems":\[[^]]*\]' | head -1)"
      dim "    $DEGRADED"
      FAIL=1
      ;;
    absent)
      fail "Status aggregate: absent — no subsystem is configured"
      ;;
    *)
      fail "Status aggregate: <unknown shape> (status route may have drifted)"
      ;;
  esac
fi
echo

# ── /.well-known/jwks.json (PR #316) ───────────────────────────
bold "JWKS endpoint /.well-known/jwks.json"
JWKS_HEADERS="$(curl -sS -I -m 10 "$BASE_URL/.well-known/jwks.json" 2>/dev/null || true)"
JWKS_STATUS="$(echo "$JWKS_HEADERS" | grep -i '^x-jwks-status:' | head -1 | sed 's/[Xx]-[Jj][Ww][Kk][Ss]-[Ss]tatus: *//I;s/[[:space:]]*$//')"
HTTP_LINE="$(echo "$JWKS_HEADERS" | head -1)"
if [ -z "$HTTP_LINE" ]; then
  fail "JWKS endpoint did not respond"
else
  ok "HTTP: $HTTP_LINE"
  case "$JWKS_STATUS" in
    ok)
      ok "X-JWKS-Status: ok (public key is served)"
      ;;
    not-configured)
      warn "X-JWKS-Status: not-configured — set VITALCV_SIGNING_PUBLIC_JWK"
      FAIL=1
      ;;
    malformed-env)
      fail "X-JWKS-Status: malformed-env — VITALCV_SIGNING_PUBLIC_JWK is not valid JSON"
      ;;
    invalid-jwk)
      fail "X-JWKS-Status: invalid-jwk — JWK shape rejected (missing kty, or contains private 'd')"
      ;;
    "")
      dim "    (apps/web JWKS endpoint does not emit X-JWKS-Status; only web-v2 sandbox does. Skipping)"
      ;;
    *)
      warn "X-JWKS-Status: $JWKS_STATUS (unknown)"
      ;;
  esac
fi
echo

# ── /sign-in (PR #310; web-v2) or /sign-up (apps/web) ──────────
bold "Sign-in surface"
SIGNIN_STATUS="$(curl -sS -o /dev/null -m 10 -w '%{http_code}' "$BASE_URL/sign-in" 2>/dev/null || true)"
case "$SIGNIN_STATUS" in
  200)
    ok "/sign-in route: 200 (Clerk widget mounted or graceful not-configured message)"
    ;;
  404)
    warn "/sign-in route: 404 (apps/web uses /sign-up; web-v2 uses /sign-in)"
    ;;
  *)
    fail "/sign-in route: $SIGNIN_STATUS (unexpected)"
    ;;
esac
echo

# ── Receipts verify (PR #321 audit pinned) ─────────────────────
bold "Verifier endpoint /api/receipts/verify"
VERIFY_BODY="$(curl -sS -m 10 -X POST -H 'Content-Type: application/json' -d '{}' "$BASE_URL/api/receipts/verify" 2>/dev/null || true)"
VERIFY_HTTP="$(curl -sS -o /dev/null -m 10 -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{}' "$BASE_URL/api/receipts/verify" 2>/dev/null || true)"
case "$VERIFY_HTTP" in
  400)
    ok "POST {} returns 400 (token required — fail-closed correct)"
    ;;
  422)
    ok "POST {} returns 422 (verified:false — fail-closed correct)"
    ;;
  404)
    fail "Endpoint missing. The real route is /api/receipts/verify (NOT /api/credentials/verify per #321 audit)"
    ;;
  *)
    fail "Unexpected status: $VERIFY_HTTP"
    ;;
esac
echo

# ── Final verdict ──────────────────────────────────────────────
if [ "$FAIL" -eq 0 ]; then
  bold "VERDICT: READY"
  dim "Every checked subsystem reported a fail-closed-correct response. You can drive the first onboarding flow now: open $BASE_URL/sign-in in a browser."
  exit 0
else
  bold "VERDICT: NOT READY"
  dim "Fix the items marked ✕ or ●. Re-run this script until verdict is READY."
  dim "Reference: docs/pilot/first-onboarding-flow.md + docs/pilot/go-live-checklist.md"
  exit 1
fi

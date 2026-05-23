#!/usr/bin/env bash
# scripts/verify-production.sh
#
# Single-command production verification. Runs after a Railway
# deploy completes; verifies the live URL serves every route in
# the canonical launch surface, validates response shapes for the
# health / readyz / well-known JSON endpoints, and confirms the
# sign-in redirect resolves to Clerk.
#
# Usage:
#   scripts/verify-production.sh https://vitalcv.com
#   scripts/verify-production.sh https://xxxxx.up.railway.app
#
# Exits 0 on full pass; non-zero on first FAIL. Each check emits a
# single line: [OK|FAIL|NOTE] <method> <path> <expectation>.

set -u

BASE_URL="${1:-${PROD_URL:-}}"
if [ -z "$BASE_URL" ]; then
  echo "usage: $0 <base-url>"
  echo "example: $0 https://vitalcv.com"
  exit 2
fi

# Strip trailing slash for clean concatenation.
BASE_URL="${BASE_URL%/}"

FAILS=0
TOTAL=0

emit() {
  # $1 = level (OK | FAIL | NOTE)
  # $2 = method + path
  # $3 = expectation / actual
  printf '[%-4s] %s · %s\n' "$1" "$2" "$3"
}

# ── helper: status check ────────────────────────────────────────────
check_status() {
  local method="$1"
  local path="$2"
  local expect="$3"

  TOTAL=$((TOTAL + 1))
  local actual
  actual=$(curl -sS -o /dev/null -w '%{http_code}' \
    --max-time 15 -X "$method" "$BASE_URL$path" 2>&1) || actual="000"

  if [ "$actual" = "$expect" ]; then
    emit OK "$method $path" "status=$actual"
  else
    emit FAIL "$method $path" "expected $expect, got $actual"
    FAILS=$((FAILS + 1))
  fi
}

# ── helper: JSON body contains key=value ────────────────────────────
check_json_field() {
  local method="$1"
  local path="$2"
  local field="$3"
  local expect="$4"

  TOTAL=$((TOTAL + 1))
  local body
  body=$(curl -sS --max-time 15 -X "$method" "$BASE_URL$path" 2>&1) || body=""

  # Naive grep — production JSON is small + flat enough that this is fine.
  if echo "$body" | grep -q "\"$field\":\"$expect\""; then
    emit OK "$method $path" "$field=$expect"
  else
    emit FAIL "$method $path" "expected $field=$expect; body=$(echo "$body" | head -c 200)"
    FAILS=$((FAILS + 1))
  fi
}

# ── helper: content-type check ──────────────────────────────────────
check_content_type() {
  local method="$1"
  local path="$2"
  local expect_substr="$3"

  TOTAL=$((TOTAL + 1))
  local ct
  ct=$(curl -sS -o /dev/null -w '%{content_type}' --max-time 15 -X "$method" "$BASE_URL$path" 2>&1) || ct=""

  if echo "$ct" | grep -q "$expect_substr"; then
    emit OK "$method $path" "content-type contains '$expect_substr' (got '$ct')"
  else
    emit FAIL "$method $path" "expected content-type to contain '$expect_substr', got '$ct'"
    FAILS=$((FAILS + 1))
  fi
}

# ── helper: redirect target ─────────────────────────────────────────
check_redirect_to() {
  local path="$1"
  local expect_host_substr="$2"

  TOTAL=$((TOTAL + 1))
  local loc
  loc=$(curl -sS -o /dev/null -w '%{redirect_url}' --max-time 15 "$BASE_URL$path" 2>&1) || loc=""

  if [ -z "$loc" ]; then
    emit NOTE "GET $path" "no redirect (Clerk may have rendered sign-in inline; status check covers this)"
  elif echo "$loc" | grep -q "$expect_host_substr"; then
    emit OK "GET $path" "redirected to host containing '$expect_host_substr'"
  else
    emit FAIL "GET $path" "expected redirect host to contain '$expect_host_substr', got '$loc'"
    FAILS=$((FAILS + 1))
  fi
}

echo "# verify-production.sh · $BASE_URL · $(date -u +%FT%TZ)"
echo "##############################################################"

# ── 1. Liveness / readiness ─────────────────────────────────────────
check_status GET /api/health 200
check_json_field GET /api/health status ok
check_status GET /api/readyz 200
check_json_field GET /api/readyz status ready
check_status HEAD /api/readyz 200

# ── 2. Public surfaces ──────────────────────────────────────────────
check_status GET / 200
check_content_type GET / "text/html"
check_status GET /trust 200
check_content_type GET /trust "text/html"
check_status GET /trust/doctrine 200
check_content_type GET /trust/doctrine "text/html"

# Note: /trust/attribution does not exist on origin/main as of cut.
# Skipped here. If it lands later, add it to the list.
emit NOTE "GET /trust/attribution" "skipped (route not present on origin/main as of 2026-05-22)"

# ── 3. Well-known endpoints (issuer interop) ────────────────────────
check_status GET /.well-known/jwks.json 200
check_content_type GET /.well-known/jwks.json "json"
check_status GET /.well-known/openid-credential-issuer 200
check_content_type GET /.well-known/openid-credential-issuer "json"
check_status GET /.well-known/did.json 200
check_content_type GET /.well-known/did.json "json"

# ── 4. Auth flow ────────────────────────────────────────────────────
# Sign-in route may render inline or redirect to Clerk depending on
# the Clerk Next.js integration version. We accept either: 200 (inline)
# or 30x with a redirect to a clerk.com / accounts.dev host. A 500 is
# the honest signal that the Clerk env vars are not set — flagged as
# FAIL because that means production isn't configured yet.
TOTAL=$((TOTAL + 1))
SIGNIN_STATUS=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 "$BASE_URL/sign-in" 2>&1) || SIGNIN_STATUS="000"
case "$SIGNIN_STATUS" in
  200|301|302|303|307|308)
    emit OK "GET /sign-in" "status=$SIGNIN_STATUS (Clerk-compatible)"
    if [ "$SIGNIN_STATUS" != "200" ]; then
      check_redirect_to /sign-in "clerk"
    fi
    ;;
  500)
    emit FAIL "GET /sign-in" "status=500 — almost certainly missing Clerk env vars (NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY + CLERK_SECRET_KEY); set them in the Railway dashboard and redeploy"
    FAILS=$((FAILS + 1))
    ;;
  *)
    emit FAIL "GET /sign-in" "expected 200 or 30x, got $SIGNIN_STATUS"
    FAILS=$((FAILS + 1))
    ;;
esac

# ── 5. SSR sanity (no hydration crash; body is non-empty) ──────────
TOTAL=$((TOTAL + 1))
HOME_SIZE=$(curl -sS -o /dev/null -w '%{size_download}' --max-time 15 "$BASE_URL/" 2>&1) || HOME_SIZE=0
if [ "$HOME_SIZE" -gt 1024 ]; then
  emit OK "GET / (SSR body)" "size=${HOME_SIZE}B (>1KB)"
else
  emit FAIL "GET / (SSR body)" "expected body >1KB, got ${HOME_SIZE}B"
  FAILS=$((FAILS + 1))
fi

# ── Summary ────────────────────────────────────────────────────────
echo "##############################################################"
if [ "$FAILS" -eq 0 ]; then
  echo "[OK  ] verify-production: $TOTAL checks passed"
  exit 0
else
  echo "[FAIL] verify-production: $FAILS failure(s) out of $TOTAL checks"
  exit 1
fi

#!/usr/bin/env bash
# scripts/verify-production.sh
#
# Single-command production verification. Runs after a Railway
# deploy completes; verifies the live URL serves every route in
# the canonical launch surface, validates response shapes for the
# health / readyz / well-known JSON endpoints, confirms sign-in
# resolves to Clerk, and surfaces DNS / TLS / Clerk-origin
# diagnostics on failure.
#
# Usage:
#   scripts/verify-production.sh https://vitalcv.com
#   scripts/verify-production.sh https://xxxxx.up.railway.app
#
# Flags:
#   --quick           skip preflight (DNS/TLS) and only run the route checks
#   --no-retry        do not retry transient failures (default: retry 3x)
#   --verbose         print extra diagnostics on every check
#
# Exits 0 on full pass; non-zero on FAIL. Each check emits a single
# line: [OK|FAIL|NOTE|WARN] <method> <path> · <diagnostic>.

set -u

BASE_URL=""
QUICK=0
NO_RETRY=0
VERBOSE=0
for arg in "$@"; do
  case "$arg" in
    --quick) QUICK=1 ;;
    --no-retry) NO_RETRY=1 ;;
    --verbose|-v) VERBOSE=1 ;;
    --*) echo "unknown flag: $arg" ; exit 2 ;;
    *) BASE_URL="$arg" ;;
  esac
done

if [ -z "$BASE_URL" ]; then
  BASE_URL="${PROD_URL:-}"
fi
if [ -z "$BASE_URL" ]; then
  echo "usage: $0 [--quick] [--no-retry] [--verbose] <base-url>"
  echo "example: $0 https://vitalcv.com"
  exit 2
fi

# Strip trailing slash + extract host (no port) for diagnostics.
BASE_URL="${BASE_URL%/}"
BASE_HOST_PORT=$(echo "$BASE_URL" | sed -E 's#^https?://##' | cut -d/ -f1)
BASE_HOST=$(echo "$BASE_HOST_PORT" | cut -d: -f1)
BASE_SCHEME=$(echo "$BASE_URL" | grep -oE '^https?')

# Determine if BASE_HOST is a literal IP or localhost (skip DNS preflight).
IS_LOCAL_TARGET=0
if echo "$BASE_HOST" | grep -qE '^([0-9]{1,3}\.){3}[0-9]{1,3}$|^localhost$|^::1$'; then
  IS_LOCAL_TARGET=1
fi

FAILS=0
WARNS=0
TOTAL=0

emit() {
  printf '[%-4s] %s · %s\n' "$1" "$2" "$3"
}

# ── retry wrapper: retries 3x with backoff during DNS propagation ──
retry_curl() {
  local max_attempts=3
  if [ "$NO_RETRY" -eq 1 ]; then
    max_attempts=1
  fi
  local attempt=1
  local result=""
  while [ "$attempt" -le "$max_attempts" ]; do
    result=$(curl "$@" 2>&1) && {
      echo "$result"
      return 0
    }
    if [ "$attempt" -lt "$max_attempts" ]; then
      sleep $((attempt * 2))
    fi
    attempt=$((attempt + 1))
  done
  echo "$result"
  return 1
}

# ── helper: status check ────────────────────────────────────────────
check_status() {
  local method="$1"
  local path="$2"
  local expect="$3"

  TOTAL=$((TOTAL + 1))
  local actual
  actual=$(retry_curl -sS -o /dev/null -w '%{http_code}' \
    --max-time 15 -X "$method" "$BASE_URL$path") || actual="000"

  if [ "$actual" = "$expect" ]; then
    emit OK "$method $path" "status=$actual"
  else
    emit FAIL "$method $path" "expected $expect, got $actual"
    FAILS=$((FAILS + 1))
  fi
}

# ── helper: JSON field check ────────────────────────────────────────
check_json_field() {
  local method="$1"
  local path="$2"
  local field="$3"
  local expect="$4"

  TOTAL=$((TOTAL + 1))
  local body
  body=$(retry_curl -sS --max-time 15 -X "$method" "$BASE_URL$path") || body=""

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
  ct=$(retry_curl -sS -o /dev/null -w '%{content_type}' --max-time 15 -X "$method" "$BASE_URL$path") || ct=""

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
  loc=$(retry_curl -sS -o /dev/null -w '%{redirect_url}' --max-time 15 "$BASE_URL$path") || loc=""

  if [ -z "$loc" ]; then
    emit NOTE "GET $path" "no redirect (Clerk may have rendered sign-in inline)"
  elif echo "$loc" | grep -q "$expect_host_substr"; then
    emit OK "GET $path" "redirected to host containing '$expect_host_substr'"
  else
    emit WARN "GET $path" "expected redirect host to contain '$expect_host_substr', got '$loc'"
    WARNS=$((WARNS + 1))
  fi
}

# ── preflight: DNS + TLS diagnostics ────────────────────────────────
preflight() {
  echo "## Preflight · DNS / TLS"

  if [ "$IS_LOCAL_TARGET" -eq 1 ]; then
    emit NOTE "preflight" "skipped — $BASE_HOST is local (no DNS / TLS check needed)"
    echo ""
    return
  fi

  # DNS resolution (try dig, host, getent in order)
  TOTAL=$((TOTAL + 1))
  local ip=""
  if command -v dig >/dev/null 2>&1; then
    ip=$(dig +short "$BASE_HOST" 2>/dev/null | head -1)
  elif command -v host >/dev/null 2>&1; then
    ip=$(host "$BASE_HOST" 2>/dev/null | awk '/has address/ {print $4; exit}')
  elif command -v getent >/dev/null 2>&1; then
    ip=$(getent hosts "$BASE_HOST" 2>/dev/null | awk '{print $1; exit}')
  fi
  if [ -n "$ip" ]; then
    emit OK "DNS $BASE_HOST" "resolves to $ip"
  else
    emit FAIL "DNS $BASE_HOST" "no A record yet — DNS may still be propagating through Cloudflare. Retry in 1–5 min."
    FAILS=$((FAILS + 1))
  fi

  # TLS cert: only for https targets
  if [ "$BASE_SCHEME" = "https" ]; then
    TOTAL=$((TOTAL + 1))
    local cert_info
    cert_info=$(curl -sS -v --max-time 15 -o /dev/null "$BASE_URL/" 2>&1 | \
      grep -E 'subject:|expire date:|issuer:|SSL certificate verify|SSL_ERROR_SYSCALL|SSL connect error' | head -4)
    if echo "$cert_info" | grep -q 'SSL certificate verify ok\|expire date:'; then
      local expire
      expire=$(echo "$cert_info" | grep -oE 'expire date: [^"]+' | head -1)
      emit OK "TLS $BASE_HOST" "cert ok ($expire)"
      if [ "$VERBOSE" -eq 1 ]; then
        echo "$cert_info" | sed 's/^/        /'
      fi
    else
      emit FAIL "TLS $BASE_HOST" "cert verification failed — Railway cert may still be provisioning. Wait 1–2 min and retry. Diagnostic: $(echo "$cert_info" | head -1)"
      FAILS=$((FAILS + 1))
    fi
  fi
  echo ""
}

# ── post-route diagnostics: Clerk origin + DNS race hints ───────────
post_diagnostics() {
  if [ "$FAILS" -eq 0 ]; then
    return
  fi
  echo ""
  echo "## Diagnostics for the $FAILS failure(s)"

  # Hit /sign-in once more and capture the body to fingerprint
  # Clerk-specific failure modes.
  local signin_body
  signin_body=$(curl -sS --max-time 15 "$BASE_URL/sign-in" 2>&1 | head -c 800)

  if echo "$signin_body" | grep -qi 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY\|publishableKey'; then
    echo "[HINT] /sign-in: missing or malformed NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"
    echo "       Fix: set the real publishable key from clerk.com in the Railway"
    echo "            service Variables tab. Do NOT use a placeholder string."
  fi

  if echo "$signin_body" | grep -qi 'CLERK_SECRET_KEY'; then
    echo "[HINT] /sign-in: missing or malformed CLERK_SECRET_KEY"
    echo "       Fix: set the real secret key from clerk.com in the Railway"
    echo "            service Variables tab. Do NOT use a placeholder string."
  fi

  # Receipt-issuer chain failure detection.
  local jwks_body
  jwks_body=$(curl -sS --max-time 15 "$BASE_URL/.well-known/jwks.json" 2>&1 | head -c 800)
  if echo "$jwks_body" | grep -qi 'RECEIPT_PRIVATE_KEY_JWK\|Refusing to mint'; then
    echo "[HINT] /.well-known/jwks.json: RECEIPT_PRIVATE_KEY_JWK + RECEIPT_KID not set"
    echo "       Fix: node scripts/generate-receipt-keypair.mjs"
    echo "       Paste both env-var lines into the Railway Variables tab and redeploy."
  fi
  if echo "$jwks_body" | grep -qi 'Unsupported key usage'; then
    echo "[HINT] /.well-known/jwks.json: RECEIPT_PRIVATE_KEY_JWK has stray Web Crypto"
    echo "       metadata (key_ops / ext). Re-generate with"
    echo "       node scripts/generate-receipt-keypair.mjs (it strips both fields)."
  fi

  # Clerk authorized-origin diagnostic (when /sign-in returns a 30x
  # to a hostname unlike the BASE_URL host).
  local signin_redirect
  signin_redirect=$(curl -sS -o /dev/null -w '%{redirect_url}' --max-time 15 "$BASE_URL/sign-in")
  if [ -n "$signin_redirect" ] && ! echo "$signin_redirect" | grep -q "$BASE_HOST"; then
    if ! echo "$signin_redirect" | grep -qE 'clerk\.com|clerk\.dev|clerk\.accounts'; then
      echo "[HINT] /sign-in redirects to '$signin_redirect' — not a Clerk host."
      echo "       Fix: confirm the Clerk production app has '$BASE_HOST' in its"
      echo "            authorized origins, and that NEXT_PUBLIC_CLERK_SIGN_IN_URL"
      echo "            (if set) points at a Clerk-hosted URL."
  fi
  fi

  # DNS / TLS race condition hint.
  if [ "$FAILS" -gt 5 ]; then
    echo "[HINT] $FAILS failures — likely DNS propagation or TLS provisioning."
    echo "       Wait 2–5 min and re-run; Railway issues a fresh cert when"
    echo "       a custom domain is attached, and DNS CNAMEs can take up to"
    echo "       5 min to propagate through Cloudflare even in DNS-only mode."
  fi
}

# ── Main ────────────────────────────────────────────────────────────
echo "# verify-production.sh · $BASE_URL · $(date -u +%FT%TZ)"
echo "##############################################################"

if [ "$QUICK" -eq 0 ]; then
  preflight
fi

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

# /trust/attribution is not on origin/main; skipped explicitly.
emit NOTE "GET /trust/attribution" "skipped (route not present on origin/main as of 2026-05-22)"

# ── 3. Well-known endpoints ─────────────────────────────────────────
check_status GET /.well-known/jwks.json 200
check_content_type GET /.well-known/jwks.json "json"
check_status GET /.well-known/openid-credential-issuer 200
check_content_type GET /.well-known/openid-credential-issuer "json"
check_status GET /.well-known/did.json 200
check_content_type GET /.well-known/did.json "json"

# ── 4. Auth flow ────────────────────────────────────────────────────
TOTAL=$((TOTAL + 1))
SIGNIN_STATUS=$(retry_curl -sS -o /dev/null -w '%{http_code}' --max-time 15 "$BASE_URL/sign-in") || SIGNIN_STATUS="000"
case "$SIGNIN_STATUS" in
  200|301|302|303|307|308)
    emit OK "GET /sign-in" "status=$SIGNIN_STATUS (Clerk-compatible)"
    if [ "$SIGNIN_STATUS" != "200" ]; then
      check_redirect_to /sign-in "clerk"
    fi
    ;;
  500)
    emit FAIL "GET /sign-in" "status=500 — almost certainly missing or malformed Clerk env vars. Run with --verbose for diagnostic body. Set real NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY + CLERK_SECRET_KEY (no placeholders); redeploy."
    FAILS=$((FAILS + 1))
    ;;
  000)
    emit FAIL "GET /sign-in" "no response — network / DNS / TLS issue (see preflight)"
    FAILS=$((FAILS + 1))
    ;;
  *)
    emit FAIL "GET /sign-in" "expected 200 or 30x, got $SIGNIN_STATUS"
    FAILS=$((FAILS + 1))
    ;;
esac

# ── 5. SSR sanity (body size sanity check) ──────────────────────────
TOTAL=$((TOTAL + 1))
HOME_SIZE=$(retry_curl -sS -o /dev/null -w '%{size_download}' --max-time 15 "$BASE_URL/") || HOME_SIZE=0
if [ "$HOME_SIZE" -gt 1024 ]; then
  emit OK "GET / (SSR body)" "size=${HOME_SIZE}B (>1KB; SSR rendered)"
else
  emit FAIL "GET / (SSR body)" "expected body >1KB, got ${HOME_SIZE}B — runtime crash on root render"
  FAILS=$((FAILS + 1))
fi

# ── Post-failure diagnostics ───────────────────────────────────────
post_diagnostics

# ── Summary ────────────────────────────────────────────────────────
echo ""
echo "##############################################################"
if [ "$FAILS" -eq 0 ]; then
  if [ "$WARNS" -gt 0 ]; then
    echo "[OK  ] verify-production: $TOTAL checks passed, $WARNS warning(s)"
  else
    echo "[OK  ] verify-production: $TOTAL checks passed"
  fi
  exit 0
else
  echo "[FAIL] verify-production: $FAILS failure(s) out of $TOTAL checks"
  exit 1
fi

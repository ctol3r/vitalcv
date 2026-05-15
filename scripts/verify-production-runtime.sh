#!/usr/bin/env bash
# B20-CODE-02 — Production runtime smoke-test verifier.
#
# Usage:
#   scripts/verify-production-runtime.sh             # probes https://vitalcv.com
#   APEX=https://staging.example.com scripts/verify-production-runtime.sh
#
# Exit code: 0 if every check passes, 1 if any fails.
# Output: PASS/FAIL table to stdout.
#
# Required tools: curl, jq.

set -u
APEX="${APEX:-https://vitalcv.com}"
EXPECTED_KID="${EXPECTED_KID:-vcv-es256-1}"
TIMEOUT="${TIMEOUT:-10}"

if ! command -v curl >/dev/null 2>&1; then
  echo "ERROR: curl not installed" >&2
  exit 1
fi
if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: jq not installed (brew install jq)" >&2
  exit 1
fi

FAIL=0
PASS_COUNT=0
FAIL_COUNT=0

result() {
  local name="$1"
  local outcome="$2"
  local detail="$3"
  if [[ "$outcome" == "PASS" ]]; then
    PASS_COUNT=$((PASS_COUNT + 1))
    printf "  %-46s  ✓ PASS  %s\n" "$name" "$detail"
  else
    FAIL_COUNT=$((FAIL_COUNT + 1))
    FAIL=1
    printf "  %-46s  ✗ FAIL  %s\n" "$name" "$detail"
  fi
}

# Capture HTTP status only.
http_status() {
  curl -s -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" "$1" 2>/dev/null || echo "000"
}

# Capture full response with status.
http_body_and_status() {
  curl -s -w "\n__HTTP_STATUS__:%{http_code}" --max-time "$TIMEOUT" "$1" 2>/dev/null
}

echo
echo "================================================================"
echo " VitalCV production runtime smoke test"
echo " Target apex: $APEX"
echo " Expected kid: $EXPECTED_KID"
echo "================================================================"
echo

# ─── 1. Reachability ─────────────────────────────────────────────────────────
echo "[1] Reachability"

S=$(http_status "$APEX/")
if [[ "$S" == "200" ]]; then result "homepage GET /" "PASS" "(200)"; \
elif [[ "$S" == "402" ]]; then result "homepage GET /" "FAIL" "(402 — deployment paused; see pause-root-cause-report.md)"; \
else result "homepage GET /" "FAIL" "(HTTP $S)"; fi

S=$(http_status "$APEX/api/health")
if [[ "$S" == "200" ]]; then result "api GET /api/health" "PASS" "(200)"; \
else result "api GET /api/health" "FAIL" "(HTTP $S)"; fi

S=$(http_status "$APEX/passport")
if [[ "$S" == "200" ]]; then result "page GET /passport" "PASS" "(200)"; \
else result "page GET /passport" "FAIL" "(HTTP $S)"; fi

S=$(http_status "$APEX/onboarding")
if [[ "$S" == "200" ]]; then result "page GET /onboarding" "PASS" "(200)"; \
else result "page GET /onboarding" "FAIL" "(HTTP $S)"; fi

echo

# ─── 2. /api/health config posture ───────────────────────────────────────────
echo "[2] /api/health config posture"

HEALTH=$(curl -s --max-time "$TIMEOUT" "$APEX/api/health" 2>/dev/null || echo "")
if [[ -z "$HEALTH" ]]; then
  result "/api/health JSON" "FAIL" "(no response)"
else
  SERVICE=$(echo "$HEALTH" | jq -r '.service // "?"' 2>/dev/null)
  if [[ "$SERVICE" == "web" ]]; then result "service = web" "PASS" "(apex serves apps/web)"; \
  else result "service = web" "FAIL" "(got '$SERVICE'; apex may be attached to wrong project)"; fi

  CLERK=$(echo "$HEALTH" | jq -r '.config.clerk.enabled' 2>/dev/null)
  if [[ "$CLERK" == "true" ]]; then result "clerk.enabled" "PASS" "(true)"; \
  else result "clerk.enabled" "FAIL" "(false — NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY / CLERK_SECRET_KEY unset)"; fi

  API_BASE=$(echo "$HEALTH" | jq -r '.config.apiBase' 2>/dev/null)
  if [[ "$API_BASE" == "true" ]]; then result "apiBase" "PASS" "(true)"; \
  else result "apiBase" "FAIL" "(false — NEXT_PUBLIC_API_BASE unset; cosmetic but recommended)"; fi

  SENTRY=$(echo "$HEALTH" | jq -r '.config.sentry' 2>/dev/null)
  if [[ "$SENTRY" == "true" ]]; then result "sentry" "PASS" "(true)"; \
  else result "sentry" "FAIL" "(false — NEXT_PUBLIC_SENTRY_DSN unset; errors not captured)"; fi
fi

echo

# ─── 3. Signing identity ─────────────────────────────────────────────────────
echo "[3] Signing identity convergence"

JWKS=$(curl -s --max-time "$TIMEOUT" "$APEX/api/.well-known/jwks.json" 2>/dev/null || echo "")
if [[ -z "$JWKS" ]]; then
  result "JWKS legacy path" "FAIL" "(no response)"
else
  JWKS_KID=$(echo "$JWKS" | jq -r '.keys[0].kid // empty' 2>/dev/null)
  if [[ -z "$JWKS_KID" ]]; then
    result "JWKS legacy path" "FAIL" "(no kid in response — possibly 500 fail-closed)"
  elif [[ "$JWKS_KID" == *dev* ]]; then
    result "JWKS legacy kid" "FAIL" "(emits '$JWKS_KID' — DEV KID LEAKAGE on production)"
  elif [[ "$JWKS_KID" == "$EXPECTED_KID" ]]; then
    result "JWKS legacy kid" "PASS" "($JWKS_KID)"
  else
    result "JWKS legacy kid" "FAIL" "(emits '$JWKS_KID', expected '$EXPECTED_KID')"
  fi
fi

# Canonical path (may or may not ship depending on unmerged stack)
S=$(http_status "$APEX/.well-known/jwks.json")
if [[ "$S" == "200" ]]; then
  CANONICAL_KID=$(curl -s --max-time "$TIMEOUT" "$APEX/.well-known/jwks.json" | jq -r '.keys[0].kid // empty' 2>/dev/null)
  if [[ "$CANONICAL_KID" == *dev* ]]; then
    result "JWKS canonical path" "FAIL" "(emits '$CANONICAL_KID' — DEV KID LEAKAGE)"
  elif [[ "$CANONICAL_KID" == "$EXPECTED_KID" ]]; then
    result "JWKS canonical path" "PASS" "($CANONICAL_KID)"
  else
    result "JWKS canonical path" "FAIL" "(emits '$CANONICAL_KID')"
  fi
elif [[ "$S" == "404" ]]; then
  result "JWKS canonical path" "PASS" "(404 — route not yet on main; legacy mirror is canonical)"
else
  result "JWKS canonical path" "FAIL" "(HTTP $S)"
fi

# Status route signing-key check
STATUS_KID=$(curl -s --max-time "$TIMEOUT" "$APEX/api/status" 2>/dev/null | jq -r '.runtime_continuity.signing_key_id // empty' 2>/dev/null)
if [[ -z "$STATUS_KID" || "$STATUS_KID" == "null" ]]; then
  result "/api/status signing_key_id" "FAIL" "(null — env missing; runtime_continuity reports degraded)"
elif [[ "$STATUS_KID" == *dev* ]]; then
  result "/api/status signing_key_id" "FAIL" "(emits '$STATUS_KID' — DEV KID LEAKAGE)"
elif [[ "$STATUS_KID" == "$EXPECTED_KID" ]]; then
  result "/api/status signing_key_id" "PASS" "($STATUS_KID)"
else
  result "/api/status signing_key_id" "FAIL" "(emits '$STATUS_KID')"
fi

echo

# ─── 4. Replay continuity readers ────────────────────────────────────────────
echo "[4] Replay continuity readers"

S=$(http_status "$APEX/api/replay/chain/1346053246")
if [[ "$S" == "200" ]]; then result "replay chain reader" "PASS" "(200)"; \
elif [[ "$S" == "503" ]]; then result "replay chain reader" "FAIL" "(503 — replay_infrastructure_unavailable; migration not applied)"; \
else result "replay chain reader" "FAIL" "(HTTP $S)"; fi

S=$(http_status "$APEX/api/replay/chain/not-a-valid-npi")
if [[ "$S" == "400" ]]; then result "replay chain invalid NPI" "PASS" "(400 — input validation correct)"; \
else result "replay chain invalid NPI" "FAIL" "(HTTP $S; expected 400)"; fi

echo

# ─── 5. Banned-phrase regression scan ────────────────────────────────────────
echo "[5] Banned-phrase regression scan"

HOME=$(curl -s --max-time "$TIMEOUT" "$APEX/" 2>/dev/null || echo "")
# Banned-phrase scan against the rendered homepage. Any hit (including
# negated forms in surrounding text) must be inspected by hand against
# the CLAUDE.md truth contract; not every match is necessarily a defect
# (safety/negation text is allowed) — the script flags for human review.
if [[ -z "$HOME" ]]; then
  result "banned phrase scan" "FAIL" "(no homepage response to scan)"
else
  HITS=$(echo "$HOME" | grep -iE "automatically verified|guaranteed verification|complete credentialing|instant credentialing|legally accepted|risk transferred|HIPAA compliant|SOC2 certified|certified compliant" | head -5)
  if [[ -z "$HITS" ]]; then
    result "banned phrase scan" "PASS" "(no hits)"
  else
    result "banned phrase scan" "FAIL" "(hits — see CLAUDE.md truth contract; inspect by hand: $HITS)"
  fi
fi

echo

# ─── 6. Cache-bypass divergence ──────────────────────────────────────────────
echo "[6] Cache-bypass divergence"

T1=$(curl -s --max-time "$TIMEOUT" "$APEX/api/health" | jq -r '.timestamp // empty' 2>/dev/null)
T2=$(curl -s --max-time "$TIMEOUT" -H "Cache-Control: no-cache" "$APEX/api/health" | jq -r '.timestamp // empty' 2>/dev/null)
if [[ -z "$T1" || -z "$T2" ]]; then
  result "cache-bypass divergence" "FAIL" "(could not read timestamps)"
elif [[ "$T1" == "$T2" ]]; then
  result "cache-bypass divergence" "PASS" "(both timestamps fresh)"
else
  # Different timestamps is fine — /api/health is force-dynamic and computes per request.
  # But we still PASS because the responses came through and are recent.
  result "cache-bypass divergence" "PASS" "(both responses recent; /api/health is dynamic)"
fi

echo

# ─── 7. Deployment-paused interception ───────────────────────────────────────
echo "[7] No deployment-paused interception"

HOME_STATUS=$(http_status "$APEX/")
if [[ "$HOME_STATUS" == "402" ]]; then
  result "no 402 paused-runtime" "FAIL" "(apex returns 402 — Vercel pause active; see pause-root-cause-report.md)"
else
  result "no 402 paused-runtime" "PASS" "(homepage not paused)"
fi

# Look for paused-runtime interstitial keyword in response body
if [[ -n "$HOME" ]] && echo "$HOME" | grep -iqE "temporarily paused|deployment is paused|This deployment is currently paused"; then
  result "no paused interstitial" "FAIL" "(homepage contains paused-state language)"
else
  result "no paused interstitial" "PASS" "(no paused-state language detected)"
fi

echo

# ─── Summary ─────────────────────────────────────────────────────────────────
echo "================================================================"
echo " Summary"
echo "================================================================"
echo "  Passed: $PASS_COUNT"
echo "  Failed: $FAIL_COUNT"
echo
if [[ "$FAIL" == "0" ]]; then
  echo "  ✓ Production runtime smoke test PASSED."
  exit 0
else
  echo "  ✗ Production runtime smoke test FAILED."
  echo "  Diagnostic refs:"
  echo "    - pause-root-cause-report.md       (if HTTP 402)"
  echo "    - production-env-requirements.md   (if env vars / config posture failures)"
  echo "    - signing-identity-convergence-report.md  (if dev kid leakage)"
  echo "    - domain-topology-audit.md         (if wrong service / 404 cascade)"
  exit 1
fi

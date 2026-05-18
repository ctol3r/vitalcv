#!/usr/bin/env bash
# check-public-surface.sh — probe the public VitalCV surface
# without mutating anything. Use against the Track-A tunnel URL
# (https://*.trycloudflare.com), the Track-B preview URL
# (https://<project>.pages.dev), or eventually https://vitalcv.com.
#
# Reports PASS/WARN/FAIL per route. Never mutates production,
# never reads secrets, never touches DNS.
#
# Exit codes:
#   0  all required routes PASS or WARN
#   1  at least one required route FAIL
#   2  configuration error (BASE_URL missing, curl not on PATH)
#
# Usage:
#   BASE_URL=https://round-banana-tree.trycloudflare.com bash scripts/check-public-surface.sh
#   BASE_URL=https://vitalcv-web.pages.dev               bash scripts/check-public-surface.sh
#   BASE_URL=https://vitalcv.com                         bash scripts/check-public-surface.sh
#
#   bash scripts/check-public-surface.sh --base https://example.com
#   bash scripts/check-public-surface.sh --quiet

set -uo pipefail

BASE="${BASE_URL:-}"
QUIET=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base)
      BASE="$2"
      shift 2
      ;;
    --quiet)
      QUIET=1
      shift
      ;;
    --help|-h)
      sed -n '2,/^set/p' "$0" | sed -n 's/^# \{0,1\}//p'
      exit 0
      ;;
    *)
      echo "check-public-surface: unknown arg: $1" >&2
      exit 2
      ;;
  esac
done

if [[ -z "${BASE}" ]]; then
  echo "check-public-surface: BASE_URL is required (env var or --base)." >&2
  exit 2
fi
# Strip any trailing slash so we can always concat "${BASE}${path}".
BASE="${BASE%/}"

if ! command -v curl >/dev/null 2>&1; then
  echo "check-public-surface: curl not on PATH." >&2
  exit 2
fi

# Each entry is "path|kind". `kind` is one of:
#   required  — must PASS (2xx or deliberate 3xx) or it's FAIL
#   informational — 404 / 405 produces WARN, not FAIL
ROUTES=(
  "/|required"
  "/launch|required"
  "/demo|required"
  "/demo/employer|required"
  "/demo/clinician|required"
  "/api/health|informational"
)

PASS=0
WARN=0
FAIL=0
declare -a SUMMARY

color_for() {
  case "$1" in
    PASS) printf '\033[32m';;
    WARN) printf '\033[33m';;
    FAIL) printf '\033[31m';;
    *)    printf '';;
  esac
}
reset() { printf '\033[0m'; }

emit() {
  local status="$1"
  local path="$2"
  local detail="$3"
  case "$status" in
    PASS) PASS=$((PASS + 1));;
    WARN) WARN=$((WARN + 1));;
    FAIL) FAIL=$((FAIL + 1));;
  esac
  local line
  line="$(printf '%s%-4s%s  %-22s  %s' "$(color_for "$status")" "$status" "$(reset)" "$path" "$detail")"
  SUMMARY+=("$line")
  if [[ $QUIET -eq 0 ]]; then
    printf '%s\n' "$line"
  fi
}

probe() {
  local path="$1"
  local kind="$2"
  local url="${BASE}${path}"
  # `--max-time 10` keeps a hung tunnel from blocking the whole run.
  # `--retry 1` smooths a single hiccup on Cloudflare's edge.
  local code
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 --retry 1 \
    -L --connect-timeout 5 -H 'Accept: text/html, application/json' "$url" 2>/dev/null \
    || echo "000")"

  case "$code" in
    200|201|202|203|204|205|206)
      emit PASS "$path" "HTTP $code"
      ;;
    301|302|303|307|308)
      emit PASS "$path" "HTTP $code (followed)"
      ;;
    404|405)
      if [[ "$kind" == "informational" ]]; then
        emit WARN "$path" "HTTP $code (route not implemented yet)"
      else
        emit FAIL "$path" "HTTP $code"
      fi
      ;;
    000)
      emit FAIL "$path" "no response (timeout or connection refused)"
      ;;
    *)
      if [[ "$kind" == "informational" ]]; then
        emit WARN "$path" "HTTP $code"
      else
        emit FAIL "$path" "HTTP $code"
      fi
      ;;
  esac
}

echo "check-public-surface: probing ${BASE}"
echo ""
for entry in "${ROUTES[@]}"; do
  path="${entry%%|*}"
  kind="${entry##*|}"
  probe "$path" "$kind"
done

echo ""
printf 'check-public-surface: %d pass, %d warn, %d fail (target: %s)\n' \
  "$PASS" "$WARN" "$FAIL" "$BASE"

if [[ $FAIL -gt 0 ]]; then
  exit 1
fi
exit 0

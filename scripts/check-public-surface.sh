#!/usr/bin/env bash
# check-public-surface.sh — probe the public VitalCV surface
# without mutating anything. Use against the local dev server
# (http://localhost:3030), the Track-A tunnel URL
# (https://*.trycloudflare.com), the Track-B preview URL
# (https://<project>.pages.dev), or eventually https://vitalcv.com.
#
# Reports PASS / WARN / FAIL per route. Never mutates production,
# never reads secrets, never touches DNS or Vercel.
#
# WARN cases (not failures):
#   - 404 on /launch or /demo when running plain main without the
#     OpenEvidence demo-spine PRs merged. The operator can see the
#     gap without it being a hard error.
#   - 404 / 405 on /api/health when the route isn't implemented.
#
# Exit codes:
#   0  all required routes PASS or WARN
#   1  at least one required route FAIL (5xx or unreachable)
#   2  configuration error (BASE_URL missing, curl not on PATH)
#
# Usage:
#   BASE_URL=http://localhost:3030                     bash scripts/check-public-surface.sh
#   BASE_URL=https://round-banana-tree.trycloudflare.com bash scripts/check-public-surface.sh
#   BASE_URL=https://vitalcv-web.pages.dev             bash scripts/check-public-surface.sh
#   BASE_URL=https://vitalcv.com                       bash scripts/check-public-surface.sh
#
#   bash scripts/check-public-surface.sh --base https://example.com
#   bash scripts/check-public-surface.sh --quiet

set -uo pipefail

# PATH repair so this runs cleanly when invoked from launchd,
# pm2, or a stripped-down shell.
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${HOME}/.npm-global/bin:${HOME}/.local/bin:${PATH:-}"

# Prefer /usr/bin/curl when present (matches the system curl
# expected by every macOS/Linux environment). Fall back to
# PATH-resolved curl. If neither exists, exit 2.
if [[ -x /usr/bin/curl ]]; then
  CURL=/usr/bin/curl
elif command -v curl >/dev/null 2>&1; then
  CURL="$(command -v curl)"
else
  echo "check-public-surface: curl not found." >&2
  exit 2
fi

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

# Each entry is "path|kind". `kind`:
#   required        — must PASS (2xx / followed redirect) or FAIL
#   demo-optional   — 404 is WARN (demo-spine PRs not merged yet),
#                     5xx is FAIL
#   informational   — any non-success is WARN
ROUTES=(
  "/|required"
  "/launch|demo-optional"
  "/demo|demo-optional"
  "/demo/employer|demo-optional"
  "/demo/clinician|demo-optional"
  "/api/health|informational"
)

PASS=0
WARN=0
FAIL=0

color_for() {
  case "$1" in
    PASS) printf '\033[32m';;
    WARN) printf '\033[33m';;
    FAIL) printf '\033[31m';;
    *)    printf '';;
  esac
}
reset_color() { printf '\033[0m'; }

emit() {
  local status="$1"
  local path="$2"
  local detail="$3"
  case "$status" in
    PASS) PASS=$((PASS + 1));;
    WARN) WARN=$((WARN + 1));;
    FAIL) FAIL=$((FAIL + 1));;
  esac
  if [[ $QUIET -eq 0 ]]; then
    printf '%s%-4s%s  %-22s  %s\n' \
      "$(color_for "$status")" "$status" "$(reset_color)" "$path" "$detail"
  fi
}

probe() {
  local path="$1"
  local kind="$2"
  local url="${BASE}${path}"

  local code
  code="$("$CURL" -sS -o /dev/null -w '%{http_code}' \
    --max-time 10 --retry 1 -L --connect-timeout 5 \
    -H 'Accept: text/html, application/json' \
    "$url" 2>/dev/null || echo '000')"

  case "$code" in
    200|201|202|203|204|205|206)
      emit PASS "$path" "HTTP $code"
      ;;
    301|302|303|307|308)
      emit PASS "$path" "HTTP $code (followed)"
      ;;
    404|405)
      if [[ "$kind" == "demo-optional" ]]; then
        emit WARN "$path" "HTTP $code (demo route not on main yet — run from demo branch to see it)"
      elif [[ "$kind" == "informational" ]]; then
        emit WARN "$path" "HTTP $code (route not implemented yet)"
      else
        emit FAIL "$path" "HTTP $code"
      fi
      ;;
    5*)
      emit FAIL "$path" "HTTP $code"
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

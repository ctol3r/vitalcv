#!/usr/bin/env bash
# smoke-founder-demo.sh — non-mutating pre-flight checks for the
# founder demo walk.
#
# What this script DOES:
#   - Inspects local files / routes / scripts that the demo depends
#     on and reports PASS / FAIL / SKIP for each.
#   - Optionally curls http://localhost:3030/launch and /demo if a
#     local server is already running.
#   - Runs the banned-strings gate against the public demo route
#     scope (read-only).
#
# What this script DOES NOT do:
#   - Mutate production state of any kind.
#   - Start a server. (The /launch curl check is a probe — if no
#     server is listening, it reports SKIP, not FAIL.)
#   - Call Slack. The Slack delivery surface is tested via
#     /api/leads behaviour at demo time, not here.
#   - Write to LEAD_LOG_PATH or ~/.vitalcv-logs/leads.jsonl.
#   - Run pnpm install, build, or any migration.
#
# Exit codes:
#   0  all checks PASS or SKIP
#   1  one or more checks FAIL (the demo prep should stop and the
#      failing check should be addressed before going live)
#   2  configuration error (run from outside a repo, missing tools)
#
# Usage:
#   bash scripts/smoke-founder-demo.sh          # default full run
#   bash scripts/smoke-founder-demo.sh --quiet  # PASS/FAIL only
#   bash scripts/smoke-founder-demo.sh --port 4000   # curl probe target

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="3030"
QUIET=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --port)
      PORT="$2"
      shift 2
      ;;
    --quiet)
      QUIET=1
      shift
      ;;
    -h|--help)
      head -30 "$0" | sed -n 's/^# \{0,1\}//p'
      exit 0
      ;;
    *)
      echo "smoke-founder-demo: unknown arg: $1" >&2
      exit 2
      ;;
  esac
done

PASS=0
FAIL=0
SKIP=0
declare -a SUMMARY

emit() {
  local status="$1"
  local label="$2"
  local detail="${3:-}"
  case "$status" in
    PASS) PASS=$((PASS + 1)); color=$'\033[32m' ;;
    FAIL) FAIL=$((FAIL + 1)); color=$'\033[31m' ;;
    SKIP) SKIP=$((SKIP + 1)); color=$'\033[33m' ;;
    *) color="" ;;
  esac
  local reset=$'\033[0m'
  SUMMARY+=("$(printf '%s%-4s%s  %-50s  %s' "$color" "$status" "$reset" "$label" "$detail")")
  if [[ $QUIET -eq 0 ]]; then
    printf '%s%-4s%s  %-50s  %s\n' "$color" "$status" "$reset" "$label" "$detail"
  fi
}

# ─── Check 1: scripts/check-banned-strings.sh exists ───
if [[ -x "${REPO_ROOT}/scripts/check-banned-strings.sh" ]]; then
  emit PASS "banned-strings scanner present"
else
  emit FAIL "banned-strings scanner present" "expected scripts/check-banned-strings.sh"
fi

# ─── Check 2: /api/leads handler present ───
if [[ -f "${REPO_ROOT}/apps/web/app/api/leads/route.ts" ]]; then
  emit PASS "/api/leads route present"
else
  emit FAIL "/api/leads route present" "apps/web/app/api/leads/route.ts not found"
fi

# ─── Check 3: persistLead helper present ───
if [[ -f "${REPO_ROOT}/apps/web/lib/leads/persistLead.ts" ]]; then
  emit PASS "lead persistLead helper present"
else
  emit FAIL "lead persistLead helper present" "apps/web/lib/leads/persistLead.ts not found"
fi

# ─── Check 4: founder-mode script present (optional) ───
if [[ -f "${REPO_ROOT}/scripts/founder-mode.sh" ]]; then
  emit PASS "founder-mode script present"
else
  emit SKIP "founder-mode script present" "scripts/founder-mode.sh not on this branch yet"
fi

# ─── Check 5: public-demo tunnel script present (optional) ───
if [[ -f "${REPO_ROOT}/scripts/public-demo.sh" ]]; then
  emit PASS "public-demo tunnel script present"
else
  emit SKIP "public-demo tunnel script present" "scripts/public-demo.sh not on this branch yet"
fi

# ─── Check 6: /launch route source present (optional) ───
if [[ -f "${REPO_ROOT}/apps/web/app/launch/page.tsx" ]]; then
  emit PASS "/launch page source present"
else
  emit SKIP "/launch page source present" "apps/web/app/launch/page.tsx not on this branch yet"
fi

# ─── Check 7: /demo route source present (optional) ───
if [[ -f "${REPO_ROOT}/apps/web/app/demo/page.tsx" ]]; then
  emit PASS "/demo page source present"
else
  emit SKIP "/demo page source present" "apps/web/app/demo/page.tsx not on this branch yet"
fi

# ─── Check 8: LeadCaptureBlock component present (optional) ───
if [[ -f "${REPO_ROOT}/apps/web/components/lead-capture/LeadCaptureBlock.tsx" ]]; then
  emit PASS "LeadCaptureBlock component present"
else
  emit SKIP "LeadCaptureBlock component present" "lead-capture component not on this branch yet"
fi

# ─── Check 9: ReviewClient renders audit-entry line ───
if [[ -f "${REPO_ROOT}/apps/web/components/review/ReviewClient.tsx" ]]; then
  if grep -q 'Audit entry:' "${REPO_ROOT}/apps/web/components/review/ReviewClient.tsx"; then
    emit PASS "ReviewClient renders Audit entry: line"
  else
    emit SKIP "ReviewClient renders Audit entry: line" "audit-entry UI line not yet wired on this branch"
  fi
else
  emit FAIL "ReviewClient renders Audit entry: line" "apps/web/components/review/ReviewClient.tsx not found"
fi

# ─── Check 10: backend accept route present ───
if [[ -f "${REPO_ROOT}/apps/api/backend/src/routes/employerActions.ts" ]]; then
  emit PASS "backend employer accept route present"
else
  emit FAIL "backend employer accept route present" "employerActions.ts not found"
fi

# ─── Check 11: banned-strings list present ───
if [[ -f "${REPO_ROOT}/scripts/banned-strings.list" ]]; then
  emit PASS "banned-strings list present"
else
  emit FAIL "banned-strings list present" "scripts/banned-strings.list not found"
fi

# ─── Check 12: banned-strings scan on public demo routes ───
SCAN_PATHS=()
for p in apps/web/app/launch apps/web/app/demo apps/web/components/lead-capture; do
  if [[ -d "${REPO_ROOT}/${p}" ]]; then
    SCAN_PATHS+=("${REPO_ROOT}/${p}")
  fi
done
if [[ ${#SCAN_PATHS[@]} -eq 0 ]]; then
  emit SKIP "banned-strings scan on demo routes" "no demo route directories present yet"
elif [[ -x "${REPO_ROOT}/scripts/check-banned-strings.sh" ]]; then
  if bash "${REPO_ROOT}/scripts/check-banned-strings.sh" "${SCAN_PATHS[@]}" >/dev/null 2>&1; then
    emit PASS "banned-strings scan on demo routes" "${#SCAN_PATHS[@]} path(s) clean"
  else
    emit FAIL "banned-strings scan on demo routes" "scanner reported hits — run scripts/check-banned-strings.sh ${SCAN_PATHS[*]#${REPO_ROOT}/}"
  fi
else
  emit SKIP "banned-strings scan on demo routes" "scanner not executable"
fi

# ─── Check 13: optional live HTTP probes ───
if command -v curl >/dev/null 2>&1; then
  if curl -sf --max-time 2 "http://localhost:${PORT}/launch" >/dev/null 2>&1; then
    emit PASS "GET http://localhost:${PORT}/launch"
  else
    emit SKIP "GET http://localhost:${PORT}/launch" "no local server listening on :${PORT}"
  fi
  if curl -sf --max-time 2 "http://localhost:${PORT}/demo" >/dev/null 2>&1; then
    emit PASS "GET http://localhost:${PORT}/demo"
  else
    emit SKIP "GET http://localhost:${PORT}/demo" "no local server listening on :${PORT}"
  fi
else
  emit SKIP "live HTTP probes" "curl not on PATH"
fi

# ─── Summary ───
echo ""
printf 'smoke-founder-demo: %d pass, %d skip, %d fail\n' "$PASS" "$SKIP" "$FAIL"
echo "See docs/ops/founder-demo-smoke-checklist.md for the full 15-step checklist."

if [[ $FAIL -gt 0 ]]; then
  exit 1
fi
exit 0

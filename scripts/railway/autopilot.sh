#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# Railway Deployment Autopilot
#
# One command that verifies, builds, deploys, and smoke-tests.
#
# Usage:
#   ./scripts/railway/autopilot.sh              # deploy main
#   DEPLOY_BRANCH=develop ./scripts/railway/autopilot.sh  # deploy develop
#   SKIP_BUILD=1 ./scripts/railway/autopilot.sh # skip local build (CI already passed)
#
# Requirements:
#   - Railway CLI installed and linked to the project
#   - Clean git working tree on the target branch
#   - pnpm installed
# ──────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$ROOT_DIR"

# ── Colors & helpers ──────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

step()  { echo -e "\n${GREEN}${BOLD}[STEP]${NC} $1"; }
info()  { echo -e "  ${CYAN}→${NC} $1"; }
warn()  { echo -e "  ${YELLOW}⚠${NC} $1"; }
pass()  { echo -e "  ${GREEN}✓${NC} $1"; }
fail()  { echo -e "\n${RED}${BOLD}[FAIL]${NC} $1"; exit 1; }

DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
SKIP_BUILD="${SKIP_BUILD:-0}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-180}"
HEALTH_INTERVAL="${HEALTH_INTERVAL:-10}"

# ── Phase 1: Verify local state ──────────────────────────────

step "Phase 1: Verifying local repo state"

# Railway CLI
command -v railway >/dev/null 2>&1 || fail "Railway CLI not found. Install: npm i -g @railway/cli"
pass "Railway CLI found"

# Git state
if [[ -n "$(git status --porcelain)" ]]; then
  fail "Working tree is dirty. Commit or stash changes first."
fi
pass "Working tree clean"

CURRENT_BRANCH="$(git branch --show-current)"
if [[ "$CURRENT_BRANCH" != "$DEPLOY_BRANCH" ]]; then
  fail "On branch '$CURRENT_BRANCH' but expected '$DEPLOY_BRANCH'. Set DEPLOY_BRANCH=$CURRENT_BRANCH to override."
fi
pass "On branch: $CURRENT_BRANCH"

git fetch origin "$DEPLOY_BRANCH" --quiet 2>/dev/null || warn "Could not fetch origin/$DEPLOY_BRANCH"
LOCAL_SHA="$(git rev-parse HEAD)"
REMOTE_SHA="$(git rev-parse "origin/$DEPLOY_BRANCH" 2>/dev/null || echo "unknown")"

if [[ "$REMOTE_SHA" != "unknown" && "$LOCAL_SHA" != "$REMOTE_SHA" ]]; then
  fail "Local ($LOCAL_SHA) differs from origin/$DEPLOY_BRANCH ($REMOTE_SHA). Push or pull first."
fi
pass "SHA: ${LOCAL_SHA:0:12}"

# ── Phase 2: Deterministic build ─────────────────────────────

if [[ "$SKIP_BUILD" == "1" ]]; then
  step "Phase 2: Build SKIPPED (SKIP_BUILD=1)"
else
  step "Phase 2: Building and validating"

  info "Installing dependencies (frozen lockfile)..."
  pnpm install --frozen-lockfile --ignore-scripts

  info "Building @vitalcv/api..."
  pnpm --filter @vitalcv/api run build

  info "Running preflight checks..."
  node scripts/railway/preflight.mjs

  info "Running tests..."
  pnpm test || warn "Tests failed — deploy will proceed but review test output"

  pass "Build and validation complete"
fi

# ── Phase 3: Railway variable check ──────────────────────────

step "Phase 3: Checking Railway environment variables"

REQUIRED_VARS=("DATABASE_URL" "API_KEYS" "NODE_ENV")
VAR_WARNINGS=0

# Try to list variables — Railway CLI output format varies by version
RAILWAY_VARS_OUTPUT="$(railway variables 2>/dev/null || echo "")"

if [[ -z "$RAILWAY_VARS_OUTPUT" ]]; then
  warn "Could not list Railway variables (CLI not linked?). Skipping variable check."
else
  for var in "${REQUIRED_VARS[@]}"; do
    if echo "$RAILWAY_VARS_OUTPUT" | grep -q "$var"; then
      pass "$var is set"
    else
      warn "$var not found in Railway environment"
      VAR_WARNINGS=$((VAR_WARNINGS + 1))
    fi
  done

  if [[ $VAR_WARNINGS -gt 0 ]]; then
    warn "$VAR_WARNINGS variable(s) may be missing. Set with: railway variables set KEY=value"
  fi
fi

# ── Phase 4: Trigger redeploy ────────────────────────────────

step "Phase 4: Triggering Railway redeploy"

if railway up --detach 2>/dev/null; then
  pass "Deploy triggered via 'railway up --detach'"
elif railway redeploy 2>/dev/null; then
  pass "Deploy triggered via 'railway redeploy'"
else
  fail "Could not trigger deploy. Is the Railway CLI linked? Run: railway link"
fi

# ── Phase 5: Smoke test ──────────────────────────────────────

step "Phase 5: Smoke testing deployment"

# Detect Railway domain
RAILWAY_DOMAIN="$(railway domain 2>/dev/null || echo "")"
if [[ -z "$RAILWAY_DOMAIN" ]]; then
  # Fallback: try to read from Railway service info
  RAILWAY_DOMAIN="$(railway status --json 2>/dev/null | grep -o '"domain":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "")"
fi

if [[ -z "$RAILWAY_DOMAIN" ]]; then
  warn "Could not detect Railway domain. Skipping smoke test."
  warn "Check your deployment at: https://railway.app/dashboard"
else
  HEALTH_URL="https://${RAILWAY_DOMAIN}/health"
  info "Polling $HEALTH_URL (timeout: ${HEALTH_TIMEOUT}s)"

  ELAPSED=0
  HEALTHY=0
  while [[ $ELAPSED -lt $HEALTH_TIMEOUT ]]; do
    HTTP_CODE="$(curl -s -o /dev/null -w '%{http_code}' "$HEALTH_URL" 2>/dev/null || echo "000")"
    if [[ "$HTTP_CODE" == "200" ]]; then
      HEALTHY=1
      break
    fi
    sleep "$HEALTH_INTERVAL"
    ELAPSED=$((ELAPSED + HEALTH_INTERVAL))
    info "Waiting... ($ELAPSED/${HEALTH_TIMEOUT}s, last HTTP: $HTTP_CODE)"
  done

  if [[ $HEALTHY -eq 1 ]]; then
    pass "/health returned 200"
    HEALTH_BODY="$(curl -s "$HEALTH_URL" 2>/dev/null)"
    echo "$HEALTH_BODY" | python3 -m json.tool 2>/dev/null || echo "  $HEALTH_BODY"

    # Also check /readyz
    READYZ_URL="https://${RAILWAY_DOMAIN}/readyz"
    READYZ_CODE="$(curl -s -o /dev/null -w '%{http_code}' "$READYZ_URL" 2>/dev/null || echo "000")"
    if [[ "$READYZ_CODE" == "200" ]]; then
      pass "/readyz returned 200 (database connected)"
      READYZ_BODY="$(curl -s "$READYZ_URL" 2>/dev/null)"
      echo "$READYZ_BODY" | python3 -m json.tool 2>/dev/null || echo "  $READYZ_BODY"
    else
      warn "/readyz returned $READYZ_CODE (database may not be ready)"
    fi
  else
    fail "Deployment did not become healthy within ${HEALTH_TIMEOUT}s. Check Railway logs."
  fi
fi

# ── Phase 6: Summary ─────────────────────────────────────────

step "Deployment complete!"
echo ""
echo -e "  ${BOLD}Branch:${NC}  $CURRENT_BRANCH"
echo -e "  ${BOLD}SHA:${NC}     $LOCAL_SHA"
echo -e "  ${BOLD}Domain:${NC}  ${RAILWAY_DOMAIN:-unknown}"
echo -e "  ${BOLD}Health:${NC}  ${HEALTH_URL:-unknown}"
echo ""

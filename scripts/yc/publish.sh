#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────────────────
# VitalCV — YC Demo Publish Script
#
# Deploys the marketing site to Vercel and prints final URLs.
# The API auto-deploys via Railway on push (railway.toml).
# ──────────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${CYAN}[info]${NC}  $*"; }
ok()    { echo -e "${GREEN}[ok]${NC}    $*"; }
fail()  { echo -e "${RED}[fail]${NC}  $*"; exit 1; }

# ── Pre-flight checks ──
command -v vercel >/dev/null 2>&1 || fail "vercel CLI not found. Install: npm i -g vercel"
command -v git    >/dev/null 2>&1 || fail "git not found"

# ── Gather build info ──
COMMIT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
DEPLOY_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
API_URL="${NEXT_PUBLIC_API_URL:-https://api.vitalcv.com}"

info "Commit:      $COMMIT_SHA"
info "Deploy time: $DEPLOY_TIME"
info "API URL:     $API_URL"
echo ""

# ── Typecheck ──
info "Running typecheck..."
pnpm turbo typecheck --filter=@vitalcv/marketing 2>&1 | tail -3
ok "Typecheck passed"

# ── Build marketing site ──
info "Building marketing site..."
NEXT_PUBLIC_COMMIT_SHA="$COMMIT_SHA" \
NEXT_PUBLIC_DEPLOY_TIME="$DEPLOY_TIME" \
NEXT_PUBLIC_API_URL="$API_URL" \
  pnpm --filter @vitalcv/marketing build 2>&1 | tail -5
ok "Build complete"

# ── Deploy to Vercel ──
info "Deploying to Vercel..."
VERCEL_URL=$(
  NEXT_PUBLIC_COMMIT_SHA="$COMMIT_SHA" \
  NEXT_PUBLIC_DEPLOY_TIME="$DEPLOY_TIME" \
  NEXT_PUBLIC_API_URL="$API_URL" \
    vercel --prod --cwd apps/marketing --yes 2>&1 | tail -1
)
ok "Deployed to Vercel"

echo ""
echo "────────────────────────────────────────"
echo -e "${GREEN}Deployment complete${NC}"
echo ""
echo "  Marketing:  $VERCEL_URL"
echo "  API:        $API_URL"
echo "  Demo:       $VERCEL_URL/demo"
echo "  Health:     $API_URL/demo/status"
echo ""
echo "  Commit:     $COMMIT_SHA"
echo "  Deployed:   $DEPLOY_TIME"
echo "────────────────────────────────────────"

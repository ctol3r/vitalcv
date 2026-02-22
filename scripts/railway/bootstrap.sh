#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# Railway Project Bootstrap — ONE-TIME setup script
#
# Installs Railway CLI, authenticates, links the project,
# and seeds required environment variables.
#
# Usage:
#   ./scripts/railway/bootstrap.sh
#   RAILWAY_TOKEN=xxx ./scripts/railway/bootstrap.sh   # non-interactive
#
# After running this script, use autopilot.sh for deployments.
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

# ── Step 1: Railway CLI ──────────────────────────────────────

step "Step 1: Railway CLI"

if command -v railway >/dev/null 2>&1; then
  pass "Railway CLI found: $(railway --version 2>/dev/null || echo 'unknown version')"
else
  info "Installing Railway CLI..."
  if command -v npm >/dev/null 2>&1; then
    npm install -g @railway/cli
  elif command -v brew >/dev/null 2>&1; then
    brew install railway
  else
    fail "Cannot install Railway CLI. Run: npm install -g @railway/cli"
  fi
  pass "Railway CLI installed"
fi

# ── Step 2: Authentication ───────────────────────────────────

step "Step 2: Authentication"

if [[ -n "${RAILWAY_TOKEN:-}" ]]; then
  pass "RAILWAY_TOKEN is set (non-interactive mode)"
else
  # Check if already logged in
  if railway whoami >/dev/null 2>&1; then
    pass "Already authenticated: $(railway whoami 2>/dev/null)"
  else
    info "Not authenticated. Run one of:"
    echo ""
    echo "  # Option A: Interactive login (opens browser)"
    echo "  railway login"
    echo ""
    echo "  # Option B: Token-based (for CI/automation)"
    echo "  export RAILWAY_TOKEN=<your-token>"
    echo "  # Get token at: https://railway.app/account/tokens"
    echo ""
    fail "Authenticate first, then re-run this script."
  fi
fi

# ── Step 3: Link project ────────────────────────────────────

step "Step 3: Project linking"

if railway status >/dev/null 2>&1; then
  pass "Project already linked"
  railway status 2>/dev/null || true
else
  info "Linking project..."
  info "This will open an interactive picker. Select your VitalCV project + API service."
  railway link || fail "Could not link project. Run 'railway link' manually."
  pass "Project linked"
fi

# ── Step 4: Set required environment variables ───────────────

step "Step 4: Environment variables"

# Read current vars
CURRENT_VARS="$(railway variables 2>/dev/null || echo "")"

set_var_if_missing() {
  local name="$1"
  local value="$2"
  local hint="$3"

  if echo "$CURRENT_VARS" | grep -q "^${name}=\|${name}="; then
    pass "$name already set"
  elif [[ -n "$value" ]]; then
    railway variables set "${name}=${value}" 2>/dev/null || warn "Could not set $name"
    pass "$name set to: $value"
  else
    warn "$name not set. $hint"
  fi
}

# NODE_ENV — always production on Railway
set_var_if_missing "NODE_ENV" "production" ""

# SKIP_STARTUP_MIGRATION — releaseCommand handles migrations
set_var_if_missing "SKIP_STARTUP_MIGRATION" "1" ""

# DATABASE_URL — must come from a linked Postgres service
if echo "$CURRENT_VARS" | grep -q "DATABASE_URL"; then
  pass "DATABASE_URL already set (likely from linked Postgres)"
else
  warn "DATABASE_URL not set."
  info "Add a Postgres plugin in Railway dashboard, or set manually:"
  echo "    railway variables set DATABASE_URL=postgresql://user:pass@host:5432/db"
fi

# API_KEYS — must be set manually (secret)
if echo "$CURRENT_VARS" | grep -q "API_KEYS"; then
  pass "API_KEYS already set"
else
  warn "API_KEYS not set. Generate and set:"
  echo "    railway variables set API_KEYS=\$(openssl rand -hex 32)"
fi

# CORS_ORIGIN — auto-resolves from RAILWAY_PUBLIC_DOMAIN, but explicit is safer
if echo "$CURRENT_VARS" | grep -q "CORS_ORIGIN"; then
  pass "CORS_ORIGIN already set"
else
  warn "CORS_ORIGIN not set. Will auto-resolve from RAILWAY_PUBLIC_DOMAIN."
  info "To set explicitly: railway variables set CORS_ORIGIN=https://your-domain.railway.app"
fi

# ── Step 5: Verify railway.toml ──────────────────────────────

step "Step 5: Verify railway.toml"

if [[ -f "$ROOT_DIR/railway.toml" ]]; then
  pass "railway.toml exists"

  if grep -q 'healthcheckPath = "/health"' "$ROOT_DIR/railway.toml"; then
    pass "Healthcheck configured"
  else
    warn "healthcheckPath not found in railway.toml"
  fi

  if grep -q 'SKIP_STARTUP_MIGRATION=1' "$ROOT_DIR/railway.toml"; then
    pass "Startup migration skip configured"
  else
    warn "SKIP_STARTUP_MIGRATION=1 not in startCommand"
  fi

  if grep -q 'releaseCommand' "$ROOT_DIR/railway.toml"; then
    pass "releaseCommand configured (migrations run before start)"
  else
    warn "No releaseCommand — migrations may not run"
  fi
else
  fail "railway.toml not found at repo root"
fi

# ── Step 6: One-time manual steps ────────────────────────────

step "Step 6: One-time manual steps (if not done already)"

echo ""
echo -e "  ${BOLD}The following cannot be set via CLI and require the Railway dashboard:${NC}"
echo ""
echo "  1. Deploy branch → Set to 'main'"
echo "     Dashboard → Service → Settings → Source → Deploy Branch"
echo ""
echo "  2. Root directory → Set to '/' (repo root)"
echo "     Dashboard → Service → Settings → Source → Root Directory"
echo ""
echo "  3. Postgres plugin → Add if DATABASE_URL is not set"
echo "     Dashboard → Project → New → Database → PostgreSQL"
echo ""

# ── Done ─────────────────────────────────────────────────────

step "Bootstrap complete!"
echo ""
echo -e "  ${BOLD}Next steps:${NC}"
echo "  1. Complete any manual steps listed above"
echo "  2. Push to main: git push origin main"
echo "  3. Or use autopilot: ./scripts/railway/autopilot.sh"
echo ""

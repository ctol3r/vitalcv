#!/usr/bin/env bash
# scripts/founder-mode.sh
#
# One-command founder-demo setup. Starts the local web server (if not
# already running), opens /launch in the browser, and offers to expose
# a public URL via cloudflared/localhost.run for screen-share demos.
#
# Survival-mode posture:
#   - Does NOT touch Vercel.
#   - Does NOT modify any production env, DNS, or domain.
#   - Does NOT write to any database.
#   - Reads ZERO production secrets.
#
# Usage:
#   scripts/founder-mode.sh                 # start local + open /launch
#   scripts/founder-mode.sh --public        # also start a public tunnel
#   scripts/founder-mode.sh --port 3030     # override target port
#   scripts/founder-mode.sh --target /demo/employer  # open a different path

set -u

PORT="${PORT:-3030}"
OPEN_TARGET="/launch"
WANT_PUBLIC=0

# ── Argument parsing ────────────────────────────────────────────────────────
while [ $# -gt 0 ]; do
  case "$1" in
    --public)         WANT_PUBLIC=1; shift ;;
    --port)           PORT="$2"; shift 2 ;;
    --target)         OPEN_TARGET="$2"; shift 2 ;;
    -h|--help)
      cat <<'USAGE'
founder-mode.sh — local demo orchestrator for VitalCV.

Flags:
  --public            Also start cloudflared (or localhost.run) tunnel.
  --port N            Target web port (default 3030).
  --target /path      Open this path in the browser (default /launch).
  -h, --help          Show this help.

Examples:
  scripts/founder-mode.sh
  scripts/founder-mode.sh --public
  scripts/founder-mode.sh --target /demo/employer --public

Survival posture: zero production mutation.
USAGE
      exit 0
      ;;
    *) echo "Unknown flag: $1" >&2; exit 1 ;;
  esac
done

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCAL_URL="http://localhost:${PORT}"

say() { printf "[founder-mode] %s\n" "$1"; }
die() { printf "[founder-mode] ERROR: %s\n" "$1" >&2; exit 1; }

# ── Step 1: confirm pnpm is on PATH ────────────────────────────────────────
command -v pnpm >/dev/null 2>&1 \
  || die "pnpm not found on PATH. Install via corepack enable / npm i -g pnpm@10.6.1."

# ── Step 2: confirm we are at the repo root (look for pnpm-workspace.yaml) ─
[ -f "${REPO_ROOT}/pnpm-workspace.yaml" ] \
  || die "pnpm-workspace.yaml not found at ${REPO_ROOT}. Run from inside the vitalcv repo."

# ── Step 3: probe local web. If already running, reuse it. ─────────────────
already_running=0
if command -v curl >/dev/null 2>&1; then
  if curl -sf --max-time 2 "${LOCAL_URL}/api/health" >/dev/null 2>&1; then
    already_running=1
    say "Local web already running on ${LOCAL_URL}"
  fi
fi

# ── Step 4: start dev server in background if not running ──────────────────
DEV_PID=""
if [ "${already_running}" -eq 0 ]; then
  say "Starting pnpm dev (port ${PORT}) in background..."
  (
    cd "${REPO_ROOT}"
    pnpm --filter @vitalcv/web dev >/tmp/vitalcv-founder-dev.log 2>&1
  ) &
  DEV_PID=$!
  trap '[ -n "${DEV_PID}" ] && kill "${DEV_PID}" 2>/dev/null' EXIT INT TERM

  # Wait up to 60s for /api/health to respond
  say "Waiting for web server to come up (up to 60s)..."
  for _ in $(seq 1 60); do
    sleep 1
    if curl -sf --max-time 2 "${LOCAL_URL}/api/health" >/dev/null 2>&1; then
      say "Local web up on ${LOCAL_URL}"
      already_running=1
      break
    fi
  done
  if [ "${already_running}" -eq 0 ]; then
    tail -30 /tmp/vitalcv-founder-dev.log || true
    die "Web server did not respond on ${LOCAL_URL} within 60s. See /tmp/vitalcv-founder-dev.log."
  fi
fi

# ── Step 5: open browser ───────────────────────────────────────────────────
FULL_URL="${LOCAL_URL}${OPEN_TARGET}"
say "Opening ${FULL_URL}"
if command -v open >/dev/null 2>&1; then
  open "${FULL_URL}" || true
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "${FULL_URL}" || true
fi

# ── Step 6: optional public tunnel ─────────────────────────────────────────
if [ "${WANT_PUBLIC}" -eq 1 ]; then
  say "Starting public tunnel via scripts/public-demo.sh ${OPEN_TARGET}"
  exec "${REPO_ROOT}/scripts/public-demo.sh" "${OPEN_TARGET}"
fi

say "Founder-mode ready. Local URL: ${FULL_URL}"
say "Press Ctrl-C to stop the dev server."
if [ -n "${DEV_PID}" ]; then
  wait "${DEV_PID}"
fi

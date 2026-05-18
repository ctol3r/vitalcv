#!/usr/bin/env bash
# vitalcv-demo-operator.sh — one command that brings the founder
# demo back up via a Cloudflare quick-tunnel.
#
# Workflow:
#   1. PATH repair (Homebrew + npm-global + local bin).
#   2. Tool verification: pnpm, cloudflared, lsof, curl.
#   3. Shadow-runtime cleanup via kill-shadow-vitalcv-runtimes.sh.
#   4. App directory resolution (demo-spine paths first, then any
#      worktree matching demo/openevidence/launch, then ~/vitalcv).
#   5. Optional `pnpm install` (only if node_modules missing or
#      --install is passed).
#   6. Start `pnpm --filter @vitalcv/web dev` in the background.
#   7. Wait for http://localhost:3030 to respond.
#   8. Start `cloudflared tunnel --url http://localhost:3030`.
#   9. Extract the trycloudflare URL from cloudflared output.
#  10. Smoke-test the public URL via check-public-surface.sh.
#  11. Print the route table, write the URL to .vitalcv-demo-url,
#      mirror everything to .vitalcv-demo-operator.log.
#  12. Hand back a single stop command.
#
# Hard safety contract (DO NOT WEAKEN):
#   - No DNS mutation. No Vercel commands. No paid services. No
#     sudo. No Prisma / database mutation.
#   - Does not kill ai.openclaw.gateway or unrelated node procs.
#     Shadow cleanup is delegated to kill-shadow-vitalcv-runtimes.sh,
#     which has its own narrow allowlist.
#   - Cleans up both child processes on Ctrl-C (SIGINT) and on
#     normal exit.
#
# Flags:
#   --install        force `pnpm install --frozen-lockfile` before dev
#   --port <n>       override the local port (default: 3030)
#   --skip-smoke     skip the check-public-surface.sh smoke test
#   --skip-shadow    skip the shadow-runtime cleanup step
#   --help

set -uo pipefail
# `set -e` is intentionally NOT enabled at the top level because we
# need to handle subprocess exit codes manually (pnpm dev never
# exits on its own; cloudflared writes the URL to stderr; etc.).
# We use explicit `|| { … }` for every command that must fail loudly.

# ── 1. PATH repair ─────────────────────────────────────────────
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${HOME}/.npm-global/bin:${HOME}/.local/bin:${PATH:-}"

# Curl resolver (prefer the system binary for predictability).
if [[ -x /usr/bin/curl ]]; then
  CURL=/usr/bin/curl
elif command -v curl >/dev/null 2>&1; then
  CURL="$(command -v curl)"
else
  CURL=""
fi

# ── Flag parsing ───────────────────────────────────────────────
DO_INSTALL=0
PORT=3030
SKIP_SMOKE=0
SKIP_SHADOW=0

usage() {
  sed -n '2,/^set/p' "$0" | sed -n 's/^# \{0,1\}//p'
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --install)     DO_INSTALL=1; shift ;;
    --port)        PORT="$2"; shift 2 ;;
    --skip-smoke)  SKIP_SMOKE=1; shift ;;
    --skip-shadow) SKIP_SHADOW=1; shift ;;
    --help|-h)     usage; exit 0 ;;
    *) echo "vitalcv-demo-operator: unknown arg: $1" >&2; usage >&2; exit 2 ;;
  esac
done

# ── Operator state — written to disk so an operator who lost the
#    terminal session can recover the URL and the PIDs.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_HINT="$(cd "${SCRIPT_DIR}/.." 2>/dev/null && pwd || true)"
URL_FILE_REL=".vitalcv-demo-url"
LOG_FILE_REL=".vitalcv-demo-operator.log"

APP_PID=""
TUNNEL_PID=""
TUNNEL_LOG=""
PUBLIC_URL=""

log() {
  local line
  line="[$(date '+%Y-%m-%dT%H:%M:%S%z')] $*"
  echo "$line"
  if [[ -n "${LOG_FILE_ABS:-}" ]]; then
    printf '%s\n' "$line" >>"$LOG_FILE_ABS"
  fi
}

cleanup() {
  local rc=$?
  log "cleanup: terminating child processes…"
  if [[ -n "$TUNNEL_PID" ]] && kill -0 "$TUNNEL_PID" 2>/dev/null; then
    kill "$TUNNEL_PID" 2>/dev/null || true
  fi
  if [[ -n "$APP_PID" ]] && kill -0 "$APP_PID" 2>/dev/null; then
    kill "$APP_PID" 2>/dev/null || true
  fi
  # Give them a moment to exit gracefully.
  sleep 1
  for pid in "$TUNNEL_PID" "$APP_PID"; do
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      kill -9 "$pid" 2>/dev/null || true
    fi
  done
  if [[ -n "$TUNNEL_LOG" && -f "$TUNNEL_LOG" ]]; then
    rm -f "$TUNNEL_LOG"
  fi
  exit "$rc"
}
trap cleanup INT TERM EXIT

# ── 2. Tool verification ───────────────────────────────────────
need() {
  local tool="$1"
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "vitalcv-demo-operator: required tool not found on PATH: $tool" >&2
    case "$tool" in
      pnpm)        echo "  install: npm install -g pnpm@10.6.1" >&2 ;;
      cloudflared) echo "  install: brew install cloudflared (macOS) or fetch the binary from Cloudflare's downloads page" >&2 ;;
      lsof)        echo "  install: lsof is part of base macOS / most Linux distros — check PATH" >&2 ;;
    esac
    exit 2
  fi
}

need pnpm
need cloudflared
need lsof
if [[ -z "$CURL" ]]; then
  echo "vitalcv-demo-operator: curl not found (checked /usr/bin/curl and PATH)." >&2
  exit 2
fi

# ── 4. App directory resolution ───────────────────────────────
# Search order is documented in the file header.
APP_DIR=""
for candidate in \
  "/tmp/vitalcv-demo-spine-openevidence" \
  "/tmp/vitalcv-demo-spine"
do
  if [[ -d "$candidate" ]] && [[ -f "$candidate/apps/web/package.json" ]]; then
    APP_DIR="$candidate"
    break
  fi
done

if [[ -z "$APP_DIR" ]] && command -v git >/dev/null 2>&1; then
  # Look for any worktree path whose name contains demo / openevidence
  # / launch. We use `git worktree list --porcelain` so the path is
  # cleanly extractable.
  while IFS= read -r line; do
    [[ "$line" =~ ^worktree[[:space:]](.*)$ ]] || continue
    wt_path="${BASH_REMATCH[1]}"
    case "$wt_path" in
      *demo*|*openevidence*|*launch*)
        if [[ -f "$wt_path/apps/web/package.json" ]]; then
          APP_DIR="$wt_path"
          break
        fi
        ;;
    esac
  done < <(git -C "$REPO_HINT" worktree list --porcelain 2>/dev/null || true)
fi

if [[ -z "$APP_DIR" ]] && [[ -f "${HOME}/vitalcv/apps/web/package.json" ]]; then
  APP_DIR="${HOME}/vitalcv"
fi

if [[ -z "$APP_DIR" ]]; then
  echo "vitalcv-demo-operator: could not resolve an app directory." >&2
  echo "  Tried /tmp/vitalcv-demo-spine-openevidence, /tmp/vitalcv-demo-spine," >&2
  echo "  any git worktree matching demo/openevidence/launch, and ~/vitalcv." >&2
  exit 2
fi

# Operator state files live in APP_DIR so they're discoverable
# from the founder's primary working tree.
URL_FILE_ABS="${APP_DIR}/${URL_FILE_REL}"
LOG_FILE_ABS="${APP_DIR}/${LOG_FILE_REL}"
: >"$LOG_FILE_ABS"

log "vitalcv-demo-operator: starting."
log "app dir:    ${APP_DIR}"

BRANCH=""
SHA=""
if [[ -d "${APP_DIR}/.git" ]] || git -C "$APP_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  BRANCH="$(git -C "$APP_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo '<detached>')"
  SHA="$(git -C "$APP_DIR" rev-parse --short=12 HEAD 2>/dev/null || echo '<unknown>')"
  log "branch:     ${BRANCH}"
  log "sha:        ${SHA}"
else
  log "branch:     <not a git tree>"
fi

# ── 3. Shadow-runtime cleanup ────────────────────────────────
if [[ $SKIP_SHADOW -eq 0 ]]; then
  if [[ -x "${SCRIPT_DIR}/kill-shadow-vitalcv-runtimes.sh" ]]; then
    log "running shadow cleanup…"
    bash "${SCRIPT_DIR}/kill-shadow-vitalcv-runtimes.sh" 2>&1 | tee -a "$LOG_FILE_ABS"
  else
    log "kill-shadow-vitalcv-runtimes.sh not found — skipping cleanup."
  fi
else
  log "shadow cleanup skipped (--skip-shadow)."
fi

# ── 5. Install dependencies if needed ────────────────────────
if [[ $DO_INSTALL -eq 1 || ! -d "${APP_DIR}/node_modules" ]]; then
  log "running pnpm install --frozen-lockfile (this can take a minute)…"
  ( cd "$APP_DIR" && pnpm install --frozen-lockfile ) 2>&1 | tee -a "$LOG_FILE_ABS"
else
  log "node_modules present — skipping install (pass --install to force)."
fi

# Prebuild workspace deps — required for @vitalcv/trust-state's
# dist/ entry to exist before `next dev` evaluates imports.
log "prebuilding @vitalcv/trust-state and @vitalcv/shared…"
( cd "$APP_DIR" && pnpm turbo build --filter='@vitalcv/trust-state' --filter='@vitalcv/shared' ) \
  >>"$LOG_FILE_ABS" 2>&1 || {
    log "prebuild failed (non-fatal for some demo branches). See ${LOG_FILE_ABS}."
  }

# ── 6. Start the dev server in the background ────────────────
APP_LOG="${APP_DIR}/.vitalcv-demo-app.log"
: >"$APP_LOG"
log "starting pnpm --filter @vitalcv/web dev on :${PORT}…"
(
  cd "$APP_DIR"
  # Inherit the operator's env but ensure PORT/NEXT_PORT are
  # honoured by the web app's `dev` script (which already pins
  # :3030 via the runtime-assert wrapper).
  exec pnpm --filter @vitalcv/web dev
) >"$APP_LOG" 2>&1 &
APP_PID=$!
log "app pid:    ${APP_PID}"

# ── 7. Wait for localhost:PORT to respond ────────────────────
log "waiting for http://localhost:${PORT} to respond (max 120s)…"
ready=0
for _ in $(seq 1 60); do
  if "$CURL" -sf --max-time 2 "http://localhost:${PORT}/" >/dev/null 2>&1 \
     || "$CURL" -sf --max-time 2 "http://localhost:${PORT}/launch" >/dev/null 2>&1; then
    ready=1
    break
  fi
  if ! kill -0 "$APP_PID" 2>/dev/null; then
    log "app process exited prematurely — see ${APP_LOG}."
    tail -n 20 "$APP_LOG" || true
    exit 1
  fi
  sleep 2
done
if [[ $ready -ne 1 ]]; then
  log "app did not become ready within 120s — see ${APP_LOG}."
  tail -n 40 "$APP_LOG" || true
  exit 1
fi
log "app is ready."

# ── 8. Start the cloudflared tunnel ──────────────────────────
TUNNEL_LOG="${APP_DIR}/.vitalcv-demo-tunnel.log"
: >"$TUNNEL_LOG"
log "starting cloudflared tunnel onto :${PORT}…"
(
  cd "$APP_DIR"
  exec cloudflared tunnel --url "http://localhost:${PORT}" --no-autoupdate
) >"$TUNNEL_LOG" 2>&1 &
TUNNEL_PID=$!
log "tunnel pid: ${TUNNEL_PID}"

# ── 9. Extract the trycloudflare URL ────────────────────────
log "waiting for trycloudflare.com URL (max 60s)…"
PUBLIC_URL=""
for _ in $(seq 1 30); do
  PUBLIC_URL="$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$TUNNEL_LOG" 2>/dev/null | head -1 || true)"
  if [[ -n "$PUBLIC_URL" ]]; then
    break
  fi
  if ! kill -0 "$TUNNEL_PID" 2>/dev/null; then
    log "cloudflared exited prematurely — see ${TUNNEL_LOG}."
    tail -n 40 "$TUNNEL_LOG" || true
    exit 1
  fi
  sleep 2
done

if [[ -z "$PUBLIC_URL" ]]; then
  log "cloudflared did not emit a public URL within 60s — see ${TUNNEL_LOG}."
  tail -n 40 "$TUNNEL_LOG" || true
  exit 1
fi

log "PUBLIC URL: ${PUBLIC_URL}"
printf '%s\n' "$PUBLIC_URL" >"$URL_FILE_ABS"
log "wrote ${URL_FILE_ABS}"

# ── 10. Smoke-test the surface ──────────────────────────────
if [[ $SKIP_SMOKE -eq 0 ]] && [[ -x "${SCRIPT_DIR}/check-public-surface.sh" ]]; then
  log "running check-public-surface against the tunnel URL…"
  ( BASE_URL="$PUBLIC_URL" bash "${SCRIPT_DIR}/check-public-surface.sh" ) 2>&1 | tee -a "$LOG_FILE_ABS"
elif [[ $SKIP_SMOKE -eq 0 ]]; then
  log "check-public-surface.sh not found — skipping smoke test."
else
  log "smoke test skipped (--skip-smoke)."
fi

# ── 11. Final summary ───────────────────────────────────────
cat <<EOF | tee -a "$LOG_FILE_ABS"

──────────────────────────────────────────────────────────────
VitalCV demo operator — live

  Public URL: ${PUBLIC_URL}
  App PID:    ${APP_PID}
  Tunnel PID: ${TUNNEL_PID}
  App log:    ${APP_LOG}
  Tunnel log: ${TUNNEL_LOG}
  URL file:   ${URL_FILE_ABS}
  Operator log: ${LOG_FILE_ABS}

Stop everything:
  kill ${APP_PID} ${TUNNEL_PID}

Or press Ctrl-C in this terminal — the script's trap will
clean up both child processes.
──────────────────────────────────────────────────────────────
EOF

# Block forever until Ctrl-C or one of the children dies; that
# gives the operator a clean session boundary.
while true; do
  if ! kill -0 "$APP_PID" 2>/dev/null; then
    log "app process exited — shutting down tunnel and operator."
    break
  fi
  if ! kill -0 "$TUNNEL_PID" 2>/dev/null; then
    log "tunnel process exited — shutting down app and operator."
    break
  fi
  sleep 5
done

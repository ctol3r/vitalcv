#!/usr/bin/env bash
# scripts/public-demo.sh
#
# Public HTTPS tunnel to the local /launch + /demo flows.
# Survival-mode demo: get a public URL without touching Vercel, DNS,
# or any production env.
#
# Order of preference:
#   1. cloudflared (preferred — reliable, recoverable)
#   2. localhost.run (fallback — no install required, ephemeral)
#
# Exits non-zero if the local web server is not reachable.
# Does NOT modify any DNS, Vercel project, or production env.
#
# Usage:
#   scripts/public-demo.sh                    # tunnels to /launch
#   scripts/public-demo.sh /demo/employer     # tunnels with a different open-target
#   PORT=3030 scripts/public-demo.sh          # override target port

set -u
PORT="${PORT:-3030}"
LOCAL_URL="http://localhost:${PORT}"
OPEN_PATH="${1:-/launch}"

# Color-free output for terminal compatibility.
say() { printf "[public-demo] %s\n" "$1"; }
die() { printf "[public-demo] ERROR: %s\n" "$1" >&2; exit 1; }

require_local_web() {
  if command -v curl >/dev/null 2>&1; then
    if ! curl -sf --max-time 3 "${LOCAL_URL}/api/health" >/dev/null 2>&1; then
      die "Local web not reachable at ${LOCAL_URL}. Run 'pnpm --filter @vitalcv/web dev' first (port ${PORT})."
    fi
  fi
  say "Local web reachable at ${LOCAL_URL}"
}

copy_to_clipboard() {
  local url="$1"
  if command -v pbcopy >/dev/null 2>&1; then
    printf "%s" "$url" | pbcopy
    say "URL copied to clipboard (pbcopy)"
  fi
}

open_browser() {
  local url="$1"
  if command -v open >/dev/null 2>&1; then
    open "$url" || true
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$url" || true
  fi
}

start_cloudflared() {
  say "Starting cloudflared tunnel to ${LOCAL_URL} ..."
  # --no-autoupdate avoids prompts; --url provides the local target.
  # cloudflared prints the public URL to stderr in a 'https://*.trycloudflare.com'
  # line within ~5 seconds.
  local logfile
  logfile="$(mktemp -t vitalcv-cloudflared.XXXXXX)"
  cloudflared tunnel --no-autoupdate --url "${LOCAL_URL}" >"${logfile}" 2>&1 &
  local pid=$!

  # Trap so Ctrl-C or exit cleans up the tunnel and the logfile.
  trap 'kill '"$pid"' 2>/dev/null; rm -f '"$logfile"'' EXIT INT TERM

  local public_url=""
  local wait_seconds=30
  for _ in $(seq 1 "$wait_seconds"); do
    sleep 1
    public_url="$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "${logfile}" | head -1 || true)"
    if [ -n "${public_url}" ]; then break; fi
  done

  if [ -z "${public_url}" ]; then
    say "cloudflared did not surface a public URL in ${wait_seconds}s; tunnel log:"
    tail -20 "${logfile}" >&2 || true
    die "cloudflared tunnel failed to start."
  fi

  printf "\n==============================================\n"
  printf "  PUBLIC URL: %s%s\n" "${public_url}" "${OPEN_PATH}"
  printf "==============================================\n\n"
  copy_to_clipboard "${public_url}${OPEN_PATH}"
  open_browser "${public_url}${OPEN_PATH}"

  say "Tunnel up. Ctrl-C to stop."
  wait "$pid"
}

start_localhost_run() {
  say "Falling back to localhost.run (ephemeral). cloudflared was not found."
  say "Public URL will appear in the SSH output within a few seconds."
  printf "\nIf no URL appears, install cloudflared and re-run:\n  brew install cloudflared   (macOS)\n\n"
  # localhost.run requires no install; ssh tunnel:
  exec ssh -R "80:localhost:${PORT}" -o StrictHostKeyChecking=accept-new nokey@localhost.run
}

main() {
  require_local_web
  if command -v cloudflared >/dev/null 2>&1; then
    start_cloudflared
  elif command -v ssh >/dev/null 2>&1; then
    start_localhost_run
  else
    die "Neither cloudflared nor ssh is installed. Install one to expose the local demo."
  fi
}

main "$@"

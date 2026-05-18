#!/usr/bin/env bash
# public-demo-cloudflare.sh — start a Cloudflare quick-tunnel onto
# the local VitalCV dev server.
#
# Track A of the Vercel exit plan
# (docs/ops/vercel-exit-emergency-plan.md). Non-mutating: this script
# never touches DNS, never touches Vercel, never reads or writes any
# repo secret, and never starts a server itself. It only:
#
#   1. Verifies the `cloudflared` binary is on PATH.
#   2. Probes http://localhost:3030 to confirm the founder's dev
#      server is already running. If not, prints the exact
#      command to start it and exits without starting a tunnel
#      (so a tunnel to nothing is never published).
#   3. Starts a quick tunnel (`cloudflared tunnel --url …`),
#      tees the output to the terminal, and highlights the public
#      URL when cloudflared emits it.
#
# Stop with Ctrl-C. The tunnel URL stops resolving immediately.
#
# Usage:
#   bash scripts/public-demo-cloudflare.sh
#   bash scripts/public-demo-cloudflare.sh --port 3030
#   bash scripts/public-demo-cloudflare.sh --quiet
#   bash scripts/public-demo-cloudflare.sh --help

set -uo pipefail

PORT="3030"
QUIET=0

usage() {
  cat <<'EOF'
public-demo-cloudflare.sh — start a Cloudflare quick-tunnel onto
the local VitalCV dev server.

Flags:
  --port <n>   Local port to tunnel (default: 3030).
  --quiet      Suppress cloudflared's own log noise; still prints
               the resolved public URL.
  --help       Show this help.

Prereqs:
  cloudflared on PATH and a dev server already listening on
  http://localhost:<port>.

This script never touches DNS, never touches Vercel, never reads
or writes secrets. Stop with Ctrl-C.
EOF
}

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
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "public-demo-cloudflare: unknown arg: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

# ── 1. cloudflared must be installed ───────────────────────────
if ! command -v cloudflared >/dev/null 2>&1; then
  cat >&2 <<'EOF'
public-demo-cloudflare: `cloudflared` not found on PATH.

Install:
  macOS:    brew install cloudflared
  Linux:    https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/

This is a free anonymous tunnel — no Cloudflare account login
needed for the trycloudflare.com URL.
EOF
  exit 2
fi

# ── 2. Local dev server must already be listening ──────────────
if ! curl -sf --max-time 3 "http://localhost:${PORT}/" >/dev/null 2>&1 \
   && ! curl -sf --max-time 3 "http://localhost:${PORT}/launch" >/dev/null 2>&1; then
  cat >&2 <<EOF
public-demo-cloudflare: nothing is listening on http://localhost:${PORT}.

Start the dev server in another terminal first:
  cd ~/vitalcv
  pnpm install --frozen-lockfile
  pnpm turbo build --filter='@vitalcv/trust-state' --filter='@vitalcv/shared'
  pnpm --filter @vitalcv/web dev

Then re-run this script. Refusing to start a tunnel pointed at
nothing.
EOF
  exit 2
fi

# ── 3. Start the quick tunnel ─────────────────────────────────
echo "public-demo-cloudflare: starting trycloudflare quick tunnel onto localhost:${PORT} …"
echo "public-demo-cloudflare: Ctrl-C to stop. URL appears below as soon as Cloudflare assigns it."
echo ""

# Wrap cloudflared so we can highlight the public URL when it
# appears. The binary writes the assigned URL to stderr; we tee
# it through `awk` to flag the line clearly.
if [[ $QUIET -eq 1 ]]; then
  # Suppress noisy "connection established" lines but keep the URL.
  cloudflared tunnel --url "http://localhost:${PORT}" 2>&1 \
    | awk '
        /trycloudflare\.com/ {
          print "\n→ PUBLIC URL: " $0 "\n";
          fflush();
          next;
        }
        # drop the rest in quiet mode
      '
else
  cloudflared tunnel --url "http://localhost:${PORT}" 2>&1 \
    | awk '
        {
          print $0;
          fflush();
        }
        /trycloudflare\.com/ {
          print "\n→ PUBLIC URL (above) — copy and share.\n";
          fflush();
        }
      '
fi

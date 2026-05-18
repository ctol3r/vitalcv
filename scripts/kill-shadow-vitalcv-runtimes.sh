#!/usr/bin/env bash
# kill-shadow-vitalcv-runtimes.sh — clean up the small set of
# vitalcv-specific processes that, when left running from a prior
# operator session, will block a fresh `vitalcv-demo-operator.sh`
# from starting cleanly.
#
# Safety contract (DO NOT WEAKEN):
#   - Never kills `ai.openclaw.gateway` (operator infrastructure).
#   - Never kills generic `node` processes. The script only kills:
#       1. pm2 services whose names match the vitalcv-* allowlist
#          below.
#       2. processes whose full command line mentions the literal
#          string `vitalcv-omega4f-trigger` (the historical local
#          dev tree that is the most common shadow runtime source
#          on Chris's laptop).
#   - Sudo is never required and never invoked.
#   - DNS, registrar, Vercel, and database state are out of scope.
#   - Listeners on :3000 and :3030 are PRINTED but not killed. The
#     operator decides whether to terminate them.
#
# Exit codes:
#   0  cleanup completed (no targets found, or targets cleanly
#      terminated)
#   2  configuration error (lsof missing on a flow that needs it)

set -uo pipefail

# ── PATH repair — Homebrew on Apple Silicon paths, plus the
#    operator's local install directories.
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${HOME}/.npm-global/bin:${HOME}/.local/bin:${PATH:-}"

OPENCLAW_NEVER_KILL='ai.openclaw.gateway'
SHADOW_NEEDLE='vitalcv-omega4f-trigger'

# pm2 service-name allowlist. The script only stops/deletes these
# exact names. Adding a name here is the only way the script will
# touch a pm2 service.
PM2_KILL_TARGETS=(
  "vitalcv-web"
  "vitalcv-tunnel"
)

echo "kill-shadow-vitalcv-runtimes: starting (no sudo, no DNS, no Vercel)."

# ── 1. pm2 cleanup — only the allowlisted service names ──────
if command -v pm2 >/dev/null 2>&1; then
  echo ""
  echo "[pm2] inventory:"
  pm2 list 2>/dev/null | tail -n +1 || true
  for svc in "${PM2_KILL_TARGETS[@]}"; do
    if pm2 list 2>/dev/null | awk '{print $2}' | grep -qx "$svc"; then
      echo "[pm2] stopping + deleting service '$svc'"
      pm2 stop  "$svc" >/dev/null 2>&1 || true
      pm2 delete "$svc" >/dev/null 2>&1 || true
    else
      echo "[pm2] service '$svc' not running — skipping"
    fi
  done
  pm2 save --force >/dev/null 2>&1 || true
else
  echo "[pm2] not installed — skipping"
fi

# ── 2. Kill processes whose command line mentions
#    `vitalcv-omega4f-trigger`. We list every match first so the
#    operator can see exactly what will die before any signal is
#    sent.
echo ""
echo "[shadow] scanning for '${SHADOW_NEEDLE}' processes (excluding ${OPENCLAW_NEVER_KILL} and this script)…"

shadow_pids=()
# `ps` is portable across macOS + Linux. We grep the full command
# line, then filter:
#   - drop the grep process itself
#   - drop anything mentioning the openclaw gateway
#   - drop this script's own grep invocation
while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  if echo "$line" | grep -q "$OPENCLAW_NEVER_KILL"; then
    continue
  fi
  pid="$(echo "$line" | awk '{print $1}')"
  [[ -z "$pid" ]] && continue
  echo "  → would kill PID $pid: $(echo "$line" | cut -c1-180)"
  shadow_pids+=("$pid")
done < <(ps -axo pid,command 2>/dev/null | grep -- "$SHADOW_NEEDLE" | grep -v 'grep --' | grep -v 'kill-shadow-vitalcv-runtimes' || true)

if [[ ${#shadow_pids[@]} -gt 0 ]]; then
  echo "[shadow] sending SIGTERM to ${#shadow_pids[@]} pid(s)…"
  for pid in "${shadow_pids[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  sleep 1
  # Anything that didn't exit, escalate to SIGKILL — but recheck
  # the openclaw guard one more time defensively.
  for pid in "${shadow_pids[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      if ps -o command= -p "$pid" 2>/dev/null | grep -q "$OPENCLAW_NEVER_KILL"; then
        echo "  ! PID $pid morphed into ${OPENCLAW_NEVER_KILL}; leaving it alone"
        continue
      fi
      echo "  → SIGKILL PID $pid"
      kill -9 "$pid" 2>/dev/null || true
    fi
  done
else
  echo "[shadow] no '${SHADOW_NEEDLE}' processes found"
fi

# ── 3. Print listeners on :3000 and :3030. Do NOT kill them —
#    the operator script decides what to do with the port.
echo ""
echo "[ports] current listeners on :3000 and :3030 (informational only — NOT killed by this script):"
if command -v lsof >/dev/null 2>&1; then
  for port in 3000 3030; do
    out="$(lsof -nP -iTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
    if [[ -z "$out" ]]; then
      echo "  :$port — no listener"
    else
      echo "  :$port —"
      echo "$out" | sed 's/^/    /'
    fi
  done
else
  echo "  lsof not on PATH — cannot inspect port state (skipping, not failing)"
fi

echo ""
echo "kill-shadow-vitalcv-runtimes: done."

# Public Demo Survival Runbook

How a founder/operator stands up a public-URL demo without touching
Vercel, DNS, or any production secret. Used when the apex is paused
or when running a pilot conversation off the deployed runtime.

## What this runbook does

- Starts the local Next.js dev server on port 3030.
- Exposes a public HTTPS URL via `cloudflared` (preferred) or
  `localhost.run` (fallback).
- Opens `/launch` (or any chosen path) in the default browser.
- Copies the public URL to the clipboard on macOS.

## What this runbook does NOT do

- Does NOT touch Vercel projects, billing, or git integration.
- Does NOT modify DNS or domain attachment.
- Does NOT write to any database.
- Does NOT read or modify any production secret.
- Does NOT run any production env path; demo runs in `NODE_ENV=development`
  with safe fallback signing identity (`vcv-es256-dev` ephemeral keypair).

## Prerequisites

| Item | Required? | Notes |
|---|---|---|
| `pnpm` v10.6.1 | Yes | `corepack enable && corepack prepare pnpm@10.6.1 --activate` |
| Node 22 | Yes | per CI standard; `nvm use 22` |
| `cloudflared` | Preferred | `brew install cloudflared` (macOS) |
| `ssh` | Fallback | Standard on macOS/Linux; needed for `localhost.run` fallback |

## Quickstart

```bash
cd ~/vitalcv

# Optional: copy the demo-only env so no production envs leak in:
cp local-host/.env.demo.example apps/web/.env.local

# Start local + open browser:
scripts/founder-mode.sh

# Or, start local + open browser + start a public tunnel in one shot:
scripts/founder-mode.sh --public

# Custom open-target:
scripts/founder-mode.sh --target /demo/employer --public
```

## Step-by-step

### 1. Start the local web server

```bash
pnpm install --frozen-lockfile
pnpm --filter @vitalcv/web dev
```

Wait for the "Ready in <time>" line. Probe locally:

```bash
curl -s http://localhost:3030/api/health | jq .service
# Expect: "web"
```

### 2. Choose an open target

| Path | Use case |
|---|---|
| `/launch` | First-time visitor; 10-second value scan |
| `/demo` | Demo index (links to all three sub-flows) |
| `/demo/clinician` | Clinician readiness preview across 6 personas |
| `/demo/employer` | Review queue + ROI calculator + equity signals |
| `/demo/issuer` | Verification requests + audit trail |

### 3. Expose a public URL

```bash
scripts/public-demo.sh                  # → /launch
scripts/public-demo.sh /demo/employer   # → /demo/employer
```

The script:

1. Verifies local web is reachable.
2. Prefers `cloudflared tunnel --url http://localhost:3030`.
3. Falls back to `ssh -R 80:localhost:3030 nokey@localhost.run` if cloudflared is missing.
4. Prints the public URL clearly.
5. Copies the URL to the clipboard (macOS `pbcopy`).
6. Opens the URL in the default browser (`open` / `xdg-open`).

### 4. End the demo

`Ctrl-C` to stop the tunnel. The local dev server (if started by
`founder-mode.sh`) is killed by the script's exit trap.

## Failure modes + recovery

| Symptom | Cause | Fix |
|---|---|---|
| `Local web not reachable at http://localhost:3030` | Dev server not running | Run `pnpm --filter @vitalcv/web dev` first; OR use `scripts/founder-mode.sh --public` which starts both |
| `cloudflared did not surface a public URL in 30s` | Network slow or cloudflared rate-limited | Retry; cloudflared sometimes needs ~10s of cold start |
| `Neither cloudflared nor ssh is installed` | Both fallbacks missing | `brew install cloudflared` on macOS |
| `port 3030 already in use` | A stale dev server or other process | `lsof -i :3030` and kill the holder; `PORT=3031 scripts/founder-mode.sh` |

## Safety guarantees

- The dev server runs in `NODE_ENV=development`, which is detected by
  `apps/web/lib/crypto/receiptIssuer.ts` and triggers the ephemeral
  dev keypair path. **No production signing key is ever loaded by
  this demo**, regardless of what env vars exist locally.
- `/demo/*` routes render entirely from `apps/web/app/demo/_seed.ts`
  fixtures. No database query, no Prisma client, no backend HTTP call
  required for first render.
- The lead-capture form persists to browser `localStorage` only. No
  network request leaves the browser. (Server-side capture lands in
  a later release.)

## Where to find more

- `docs/ops/founder-demo-script.md` — the 3-minute live-demo script.
- `docs/ops/belief-demo-pilot-wave-summary.md` — what this wave shipped.
- `docs/architecture/production-env-requirements.md` — production env
  reference (separate concern; not relevant for demo).

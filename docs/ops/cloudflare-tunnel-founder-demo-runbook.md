# Cloudflare Tunnel — founder demo runbook

A 5-minute runbook for shipping a public URL onto
`http://localhost:3030` while vitalcv.com remains down. This is
Track A of the [Vercel exit plan](./vercel-exit-emergency-plan.md).

This runbook is for the founder running a live walkthrough from
their laptop. It is NOT a production hosting plan. For permanent
hosting see
[cloudflare-production-cutover-plan.md](./cloudflare-production-cutover-plan.md).

## Prerequisites

- macOS or Linux laptop with the VitalCV repo cloned.
- `pnpm` 10.6.1 installed (matches the repo lockfile).
- Internet connection.
- **No Cloudflare account required.** The `try.cloudflare.com`
  trycloudflare URL is free, anonymous, and ephemeral.
- **No DNS access required.** This runbook never touches the
  vitalcv.com record.

## One-time setup (under 60 seconds)

### Install `cloudflared`

macOS (Homebrew):

```bash
brew install cloudflared
```

macOS (no Homebrew) or Linux (any distro), download the official
binary:

```bash
# Pick the right URL for your arch from
# https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
curl -L --output ~/bin/cloudflared \
  https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-arm64
chmod +x ~/bin/cloudflared
```

Verify:

```bash
cloudflared --version
```

You should see a version string. No login is required for the
`--url` (quick tunnel) mode this runbook uses.

## Demo session — 4 commands

Open three terminal tabs in `~/vitalcv`. The tabs hold the dev
server, the tunnel, and an optional smoke-checker.

### Tab 1 — start the local app

```bash
cd ~/vitalcv
pnpm install --frozen-lockfile          # only on first run / after lockfile bump
pnpm turbo build --filter='@vitalcv/trust-state' --filter='@vitalcv/shared'
pnpm --filter @vitalcv/web dev
```

Wait for `▲ Next.js …` `- Local: http://localhost:3030`. The
dev server is now listening on `:3030`.

### Tab 2 — start the tunnel

```bash
cloudflared tunnel --url http://localhost:3030
```

Within 5–10 seconds you'll see a block that looks like:

```
+--------------------------------------------------------------------------------------------+
|  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable):  |
|  https://<random-three-words>.trycloudflare.com                                            |
+--------------------------------------------------------------------------------------------+
```

That `https://<random>.trycloudflare.com` URL is the public
address. Copy it. Hand it to the buyer / investor / pilot lead.

### Tab 3 — verify the public surface (optional)

From the repo root, with the tunnel URL in your clipboard:

```bash
BASE_URL=https://<random>.trycloudflare.com bash scripts/check-public-surface.sh
```

You should see a PASS/WARN/FAIL table covering `/`, `/launch`,
`/demo`, `/demo/employer`, `/demo/clinician`, and `/api/health`.
A PASS on `/launch` is the minimum a founder demo needs.

### Stop everything

| Tab | How |
|-----|-----|
| Tab 2 — tunnel | `Ctrl-C`. The URL stops resolving within a few seconds. |
| Tab 1 — dev server | `Ctrl-C` in the dev server tab. |

You may also use the wrapper script that does Tab 1 + Tab 2 in
one process:

```bash
bash scripts/public-demo-cloudflare.sh
```

It checks for `cloudflared`, verifies that something is listening
on `:3030` (and prints a clear hint if not), starts a quick
tunnel, and prints the public URL when it appears. `Ctrl-C` once
to stop the tunnel.

## Routes worth testing on the public URL

Before handing the URL to a buyer:

| Path | Expected |
|------|----------|
| `/launch` | foundation-tier readiness preview lands without auth |
| `/demo` | demo index linking to clinician / employer / issuer |
| `/demo/clinician` | persona-driven readiness preview |
| `/demo/employer` | ROI calculator + EquityRetentionBlock |
| `/passport/<entity>` | source-backed readiness preview for one entity |
| `/api/leads` | POST a test lead and confirm the JSONL row appears in `~/.vitalcv-logs/leads.jsonl` |

These are the surfaces the founder narrative depends on. If any
of them 500s on the tunnel URL but works on
`http://localhost:3030`, the issue is your local NEXT build, not
the tunnel.

## Limitations

- **Ephemeral URL.** Each `cloudflared tunnel --url …` invocation
  yields a new subdomain. Do not paste the URL into anything you
  expect to live longer than the session.
- **No CDN, no edge caching.** Latency is laptop-to-edge-to-viewer.
  Fine for a 1-on-1 demo; not appropriate for sustained traffic.
- **No IP allow-list.** Anyone with the URL can hit it. Treat the
  URL as effectively public. The demo surface is already
  designed for anonymous reach (no PHI, no credentials), so this
  is fine — but do **not** point the tunnel at a backend
  configured with production database creds.
- **Laptop must stay awake** for the tunnel to stay up. Disable
  sleep on the active machine if the demo session is meant to
  span hours.
- **Not a substitute for production.** A live tunnel does not
  satisfy any pilot deliverable that requires vitalcv.com or a
  persistent SLA. For that, you need Track B (Cloudflare Pages /
  Workers) — see the cutover plan.

## When the tunnel is the right tool

- The founder is on a call and needs to show the demo "live, on
  the internet, not on my laptop."
- An investor asks "what does it look like?" and the founder
  wants a URL to drop in a thread.
- A pilot lead asks for a 5-minute walkthrough before signing
  paperwork.

## When the tunnel is NOT the right tool

- A pilot customer expects the surface to be reachable when the
  founder is asleep.
- A press / launch announcement needs vitalcv.com to work.
- Any path that needs production secrets, production database
  rows, or persistent audit / receipt storage.

For all of those, accelerate Track B (production cutover plan).

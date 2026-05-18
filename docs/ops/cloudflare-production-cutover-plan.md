# Cloudflare production cutover plan

Track B of the [Vercel exit plan](./vercel-exit-emergency-plan.md).
This document is the **plan**, not the runbook. Nothing here is
executed without explicit founder approval at each gated step.

The goal: put a working VitalCV web surface on Cloudflare Pages
(or Workers, if Pages can't host it), then — only after manual
QA on a `*.pages.dev` URL — cut vitalcv.com DNS over to it.

## Hard constraints (carried from the exit plan)

- No money spent. Cloudflare free tier only.
- No DNS mutation without **founder explicit approval** at the
  cutover step.
- Vercel projects stay in place (do not delete) until at least
  30 days post-cutover.
- No Prisma migration. No database changes. No production env
  secret rotation as part of this wave.
- No Apply-with-VitalCV iframe revival.

## Assumptions

| # | Assumption | Validation step |
|---|-----------|-----------------|
| 1 | The founder will create (or already has) a free Cloudflare account. | Founder confirms; document the account email in 1Password / similar. **Do not commit it to the repo.** |
| 2 | The `vitalcv.com` domain is registered with a registrar the founder controls. | `dig vitalcv.com NS` from the founder's laptop. Record current nameservers before any change. |
| 3 | The repo builds `apps/web` with no Vercel-specific runtime calls. | `pnpm --filter @vitalcv/web build` succeeds locally on `origin/main` (verified after PR #375 lands). |
| 4 | The truth-contract banned-strings gate (PR #370) does not regress on Cloudflare's build environment. | Re-run the gate as a CI step against the new platform. |

## DNS inventory needed (before founder approves cutover)

The cutover step must not surprise anyone. Before approval, the
following must be captured to a private operator note (NOT to the
repo):

1. Current registrar for `vitalcv.com`.
2. Current nameservers (NS records). Most likely Vercel's
   nameservers or the registrar's own (`ns1.<registrar>.com` etc.).
3. Current `A` / `AAAA` / `CNAME` records on `vitalcv.com` and
   `www.vitalcv.com`.
4. Current `MX` / `TXT` records (especially SPF, DKIM, DMARC) —
   these must survive the cutover or email delivery breaks.
5. Any other production subdomains under `vitalcv.com`
   (e.g. `app.`, `api.`, `status.`) and where they currently
   point.

Capture this into a local file under `~/vitalcv-ops/dns-snapshot-YYYY-MM-DD.txt`
(operator-only path, never commit). The cutover step uses this
snapshot as the rollback artifact.

## Cloudflare Pages — build feasibility

`apps/web` is a Next.js 15 App Router app with several server
components, route handlers under `apps/web/app/api/*`, and the
JSONL-append `/api/leads` route that uses Node's `fs`/`os`/`path`
modules.

Cloudflare Pages supports Next.js via the
`@cloudflare/next-on-pages` adapter, which compiles server
routes to Cloudflare Workers (V8 runtime, no Node built-ins by
default). The `/api/leads` route uses `node:fs`, which the
Workers runtime exposes only behind the `nodejs_compat`
compatibility flag.

Decision matrix:

| Surface | Cloudflare Pages compatibility | Action |
|---------|--------------------------------|--------|
| Static / RSC pages (`/launch`, `/demo/*`, `/passport/*`) | ✅ direct | adapter handles them |
| Route handlers that touch `fetch`, `Headers`, `Response` only | ✅ direct | adapter handles them |
| `/api/leads` (uses `node:fs/promises`) | ⚠️ needs `nodejs_compat` | enable compat flag; or persist via Cloudflare KV / D1 instead |
| `/api/employer-review/*` proxy (forwards to backend) | ✅ direct | depends only on backend availability, not local file IO |
| WebAssembly / Worker-only APIs | ✅ direct | not used |

Recommendation: **enable `nodejs_compat` for the first deploy**.
Replacing the JSONL append with KV / D1 is a follow-up that
shouldn't block the public surface coming back up. The truth-
contract guardrails on `/api/leads` are runtime invariants, not
filesystem invariants — they survive a backend swap.

## Build command discovery

The canonical build chain on this repo is:

```bash
# Prebuild workspace deps (required — @vitalcv/trust-state ships from dist/)
pnpm install --frozen-lockfile
pnpm turbo build --filter='@vitalcv/trust-state' --filter='@vitalcv/shared'

# Build apps/web (direct path, bypasses the wallet-sdk failure once PR #375 lands)
pnpm --filter @vitalcv/web build
```

For Cloudflare Pages, the project setup will likely be:

| Field | Value |
|-------|-------|
| Framework preset | Next.js (Cloudflare Pages preset) |
| Build command | `pnpm install --frozen-lockfile && pnpm turbo build --filter='@vitalcv/trust-state' --filter='@vitalcv/shared' && pnpm --filter @vitalcv/web exec npx @cloudflare/next-on-pages` |
| Build output directory | `apps/web/.vercel/output/static` (the adapter writes here) |
| Root directory | repo root (the monorepo entry; Cloudflare reads the workspace from `pnpm-workspace.yaml`) |
| Node version | 20.x (matches the dev server runtime assertion) |
| Compatibility flags | `nodejs_compat` |

The first build on a `*.pages.dev` preview will validate every
assumption above. **Do not enter any env vars yet** — the first
build is meant to surface compile-time failures, not runtime
behavior.

## Env var inventory (per the truth contract — names only, no values)

The web app reads, in rough order of demo necessity:

| Env var | Required for | Source |
|---------|--------------|--------|
| `LEAD_LOG_PATH` | `/api/leads` persistence override (optional) | `apps/web/lib/leads/persistLead.ts` |
| `SLACK_LEAD_CAPTURE_WEBHOOK_URL` | Slack lead delivery (optional, best-effort) | `apps/web/lib/leads/slack.ts` |
| `SLACK_PILOT_INTAKE_WEBHOOK_URL` | Slack pilot-intake delivery (optional) | `apps/web/lib/pilot-intake/slack.ts` |
| `RECEIPT_PRIVATE_KEY_JWK` | ES256 receipt signing (production fail-closed) | `apps/web/lib/crypto/receiptIssuer.ts` |
| `RECEIPT_KID` | ES256 receipt kid (production fail-closed) | same |
| `APP_ORIGIN` / `NEXT_PUBLIC_APP_URL` | share-link origin resolution | `apps/api/backend/src/routes/employerActions.ts` |
| `DATABASE_URL` | Prisma (backend only; the apps/web surface mostly proxies) | `apps/api/backend/prisma/schema.prisma` |
| `BACKEND_URL` | apps/web proxy target | `apps/web/lib/backend-url.ts` |
| `CLERK_*` | auth (only on routes that require sign-in) | `@clerk/nextjs/server` consumers |

For the **first** Pages deploy, do not set any of these. The
`/launch` and `/demo/*` surfaces work without them. After the
first deploy lands on a `*.pages.dev` URL, the founder approves
each key one at a time, pasted into Cloudflare's dashboard.

## QA checklist on `*.pages.dev` (before any DNS change)

Run `scripts/check-public-surface.sh` with
`BASE_URL=https://<project>.pages.dev`. Expected:

| Route | Expected status |
|-------|-----------------|
| `/` | 200 or a deliberate redirect to `/launch` |
| `/launch` | 200, renders the foundation message |
| `/demo` | 200, lists the three sub-flows |
| `/demo/employer` | 200, ROI calculator interactive |
| `/demo/clinician` | 200, persona list |
| `/api/health` | 200 if implemented (WARN otherwise) |

If any of these fail on Cloudflare Pages but pass on
`localhost:3030`, the adapter or compatibility flag is the
culprit. Do not advance to DNS cutover until the `*.pages.dev` URL
passes the surface check end-to-end.

## DNS cutover (founder approval gate)

When the founder approves the cutover, the operator steps are:

1. **Snapshot current DNS.** Use the `dig` outputs captured in
   the inventory step. Save them to
   `~/vitalcv-ops/dns-snapshot-YYYY-MM-DD-pre-cutover.txt`.
2. **Add the apex CNAME flattening** (or A/AAAA records for
   Cloudflare's IPs) per Cloudflare Pages' "Custom domain"
   instructions in their dashboard. Cloudflare provides the
   exact target.
3. **Lower TTL first.** 24 hours before cutover, drop the
   existing record TTL to 300s so rollback is fast.
4. **Verify propagation on a non-production DNS resolver**
   (e.g. `dig @1.1.1.1 vitalcv.com` and `dig @8.8.8.8 vitalcv.com`)
   before announcing.
5. **Send the launch announcement only after** the surface check
   from step "QA checklist" above passes against `https://vitalcv.com`
   itself.

## Rollback (if anything breaks)

| Scenario | Rollback |
|----------|----------|
| Cloudflare Pages build fails | nothing to roll back — vitalcv.com is still 402 on Vercel; no traffic was migrated |
| Cloudflare Pages deploys but a route 500s | leave DNS unchanged; debug on `*.pages.dev`; do not cut over |
| DNS cuts over but a route 500s | revert the DNS record to its pre-cutover value (snapshot in step 1) |
| DNS cuts over and Cloudflare goes down | revert the DNS record; while vitalcv.com is down, restart the Track A tunnel for live demos |

The Vercel project is intentionally left in place so a worst-case
rollback is "point DNS back at Vercel and pay the bill" — but
that path is only used if everything else fails AND a paying
customer is on the line. Approval gate still applies.

## What this plan explicitly does NOT promise

- Same performance characteristics as Vercel's edge.
- Same Next.js feature coverage (some App Router features ship
  on Cloudflare Pages later than on Vercel; the adapter's release
  notes are the source of truth).
- Email survival. SPF / DKIM / DMARC must be reviewed in the DNS
  snapshot step; the cutover is for the web surface only.
- Zero-touch CI. Cloudflare's GitHub integration handles
  per-commit builds, but the truth-contract gate (PR #370) needs
  to be wired into Pages' build pipeline (env var or a custom
  build step) before merge protection on `main` matters again.

## Status

| Step | State |
|------|-------|
| Track A tunnel runbook | ✅ shipped — see sibling doc |
| Track B plan (this doc) | ✅ shipped |
| Cloudflare account creation | pending founder action |
| Pages `*.pages.dev` first deploy | pending founder action |
| Env var paste | pending per-key founder approval |
| DNS cutover | pending founder explicit approval |
| Vercel project deletion | hold ≥30 days post-cutover |

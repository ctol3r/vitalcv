# Vercel exit — emergency plan

**Status: production is down. Vercel is no longer a viable hosting
dependency for VitalCV.**

Last verified:

```
$ curl -sI https://vitalcv.com
HTTP/2 402
server: Vercel
x-vercel-error: DEPLOYMENT_DISABLED
```

Founder decision: **no more Vercel dependency**. No paid path. No
support-ticket wait. No DNS mutation until founder explicitly
approves. The vitalcv.com domain stays parked at Vercel for now;
nothing about the domain registrar configuration changes until the
production cutover plan is approved.

This document is the umbrella plan. The operational runbook and the
production cutover plan live in two sibling docs:

- [cloudflare-tunnel-founder-demo-runbook.md](./cloudflare-tunnel-founder-demo-runbook.md)
- [cloudflare-production-cutover-plan.md](./cloudflare-production-cutover-plan.md)

## Posture

| Item | State |
|------|-------|
| Vercel as primary hosting | **abandoned as a dependency** |
| Vercel account | left in place; do not delete projects yet |
| vitalcv.com DNS | unchanged; pointing at Vercel; still returning 402 |
| Founder demo path | local app + Cloudflare Tunnel (Track A) |
| Permanent hosting candidate | Cloudflare Pages / Workers (Track B) |
| Database / Prisma | untouched; out of scope for this wave |
| Spend allowed for this wave | **$0** |

## Two-track strategy

### Track A — Cloudflare Tunnel (today)

A free `cloudflared` tunnel maps a public URL onto
`http://localhost:3030`. The founder runs `next dev` on their
laptop, starts the tunnel, and hands the resulting URL to anyone
who needs to see the demo.

- **Cost:** $0. `cloudflared` is a binary, no Cloudflare account
  required for the temporary `try.cloudflare.com` subdomain.
- **Audience:** founder-driven walkthroughs and recorded demos.
  Not a production surface.
- **Lifetime of URL:** for as long as the founder's laptop is on
  and the tunnel process is running. Each restart yields a new
  URL.
- **Limitations:** no SLA, no caching, no CDN, no IP allow-listing.
  Latency is laptop-to-Cloudflare-edge-to-viewer.
- **What it lets the founder do today:** ship a working live demo
  to a buyer / investor / pilot lead inside 5 minutes without
  paying anyone.

Operational details: see
[cloudflare-tunnel-founder-demo-runbook.md](./cloudflare-tunnel-founder-demo-runbook.md).

### Track B — Cloudflare Pages / Workers (this week)

The permanent replacement. Cloudflare Pages can build a Next.js
app for free (100k requests/day, 500 builds/month on the free
tier). Workers can host the same app via OpenNext adapter if
the routing is more dynamic than Pages handles directly.

- **Cost:** $0 on the free tier for the expected demo / pilot
  traffic volume.
- **Audience:** vitalcv.com once the founder approves DNS
  cutover.
- **Build approach:** prebuild `@vitalcv/trust-state` +
  `@vitalcv/shared`, then `next build`, then deploy the static +
  serverless output. Adapter choice (Pages direct vs.
  `@cloudflare/next-on-pages` vs. Workers via OpenNext) is
  determined in the cutover plan.
- **Limitations vs. Vercel:** the Next.js App Router on Cloudflare
  needs an adapter step (`@cloudflare/next-on-pages`) — not a
  one-click deploy. Some Node-specific APIs require an
  `export const runtime = 'nodejs'` review. Already documented in
  the cutover plan.

Operational details: see
[cloudflare-production-cutover-plan.md](./cloudflare-production-cutover-plan.md).

## Approval gates

| Action | Approval required | Default |
|--------|-------------------|---------|
| Run Track A tunnel from founder laptop | none — founder executes | go |
| Create Cloudflare account | none — founder executes | go |
| Cloudflare Pages / Workers first deploy on a `*.pages.dev` subdomain | none | go |
| Production env vars set in Cloudflare | **founder approval per-key** | hold |
| Point vitalcv.com DNS at Cloudflare | **founder explicit approval** | hold |
| Delete Vercel projects | **founder explicit approval** | hold (keep for forensic / rollback) |
| Pay any vendor | **forbidden this wave** | hard stop |

## Rollback posture

Because vitalcv.com DNS is unchanged, the rollback for Track A is
"close the laptop." The rollback for the Track B `*.pages.dev`
URL is "stop sending traffic to it." The rollback for the eventual
DNS cutover is "revert the DNS record to the prior Vercel target."
The Vercel project is intentionally left in place until at least
30 days after Cloudflare cutover succeeds, so the rollback is
literally a DNS edit.

## What is explicitly NOT in this plan

- No database migration. Prisma schema untouched. The demo flows
  on Track A run against the local sqlite / in-memory state that
  the dev server already uses; the cutover plan defers the
  question of where production Prisma lives.
- No payment integration changes.
- No mobile app changes.
- No new Vercel project on a free account ("just create another
  free Vercel account") — this loop ends today.
- No Apply-with-VitalCV iframe / widget revival. The founder
  retired that surface in a prior wave; this exit plan keeps it
  retired.

## Owner

Chris Toler (founder). This document is the canonical reference
for the next person who asks "why isn't vitalcv.com up?"

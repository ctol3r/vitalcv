# local-host/ — Survival-Mode Self-Hosting

Self-hostable baseline for running VitalCV on a single VPS or homelab
box. **Prepared, not deployed.** Operator decides if/when to bring
this up.

Per the B20+ wave directive, this directory contains configs only.
No code in this directory is invoked automatically.

## What's in here

| File | Purpose |
|---|---|
| `docker-compose.yml` | Three services: web (Next 15 + Node 22), postgres (Postgres 16), cloudflared (optional tunnel) |
| `.env.example` | All required + recommended env vars; copy to `.env` and fill in |
| `Makefile` | Convenience targets: `make up`, `make verify`, `make tunnel`, `make logs`, etc. |

## Why this exists

When Vercel costs become unsustainable (or while the apex is paused),
you can run the entire app on a single $5–10/mo VPS or an old laptop
with internet:

```
[ Internet ]
    │
    ▼  (DNS apex CNAME or Cloudflare Tunnel)
┌──────────────────────┐
│ VPS / homelab box    │
│                      │
│  docker compose:     │
│   ├─ web (port 3000) │
│   ├─ postgres        │
│   └─ cloudflared     │   ← exposes web via vitalcv.com without
│                      │      needing a public static IP
└──────────────────────┘
```

## Quick start (operator)

```bash
cd local-host/
cp .env.example .env
# Fill in RECEIPT_PRIVATE_KEY_JWK, RECEIPT_KID, CLERK secrets, etc.
# See docs/architecture/production-env-requirements.md for guidance.

make up        # Starts web + postgres in background
make verify    # Runs the production smoke test against localhost:3000
make logs      # Tail web logs

# When ready to expose via Cloudflare Tunnel:
# 1. Create a tunnel in the Cloudflare dashboard
# 2. Copy the token to .env CLOUDFLARE_TUNNEL_TOKEN
# 3. make tunnel
```

## What this does NOT do

- Does not deploy anywhere.
- Does not modify your existing Vercel project or DNS.
- Does not auto-scale (single-box hosting; that's the point).
- Does not include Railway-hosted backend; if you need the
  `apps/api/backend` service, run it separately (or add a 4th
  service block following the same pattern).

## Recovery from this baseline

If the operator decides this is the canonical production runtime:

1. Provision a VPS (DigitalOcean, Hetzner, Linode — $5–10/mo).
2. Install Docker.
3. Clone the repo on the VPS.
4. `cd local-host/ && cp .env.example .env` and configure.
5. `make up`.
6. Either expose port 3000 directly (with a reverse proxy of your
   choice) OR use `make tunnel` for Cloudflare Tunnel (no public IP
   needed).
7. Point `vitalcv.com` at the VPS via DNS A record, OR through the
   Cloudflare Tunnel.

Total spend: ~$5–10/mo. No Vercel billing.

## Truth contract

This setup honors the same production-env requirements as Vercel
deployment. The fail-closed signing guard, replay persistence layer,
Clerk middleware, and all other code-level guarantees ship
identically. The only difference is where the runtime executes.

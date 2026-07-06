# Final Operator Activation State
Generated: 2026-05-13T06:09:00Z

---

## Runtime Activation (local dev)

| Layer | Status | Value |
|-------|--------|-------|
| Web server | ✓ RUNNING | localhost:3030 |
| Backend API | ✓ RUNNING | localhost:4000 |
| Signing key | ✓ ACTIVE | vcv-es256-1778648081093 |
| JWKS published | ✓ LIVE | /.well-known/jwks.json |
| DID published | ✓ LIVE | /.well-known/did.json |
| Anonymous writes | ✓ REJECTED | 401 at all write edges |
| Actor attribution | ✓ ACTIVE | actor_id on all durable writes |
| CORS policy | ✓ ACTIVE | normalizeOrigin() enforced |
| Clerk auth | ✓ CONFIGURED | pk_live_* present |
| VITALCV_ENV_LABEL | ✓ SET | pilot (just added) |

## Scheduling Gaps (not yet set up)

These are configured as OpenClaw cron tasks once PILOT-1 completes:

| Task | Schedule | Priority |
|------|----------|----------|
| Probe runner (/api/status) | Every 5 min | Medium |
| JWKS probe (key continuity) | Every 15 min | Medium |
| Backend liveness (/api/health) | Hourly | Low |
| Demo NPI ingest | Daily 00:00 UTC | Low |
| Edge cache purge (post-deploy) | On deploy hook | Low |

## Deployment Propagation Sequence (production)

When deploying to Vercel/Railway:
1. Railway deploy → backend live
2. Vercel deploy → web app live
3. Purge CDN cache for /.well-known/* (1h TTL)
4. Probe: GET https://vitalcv.com/.well-known/jwks.json → 200
5. Probe: GET https://vitalcv.com/api/status → overall=operational
6. Probe: GET https://vitalcv.com/api/runtime/ping → alive=true


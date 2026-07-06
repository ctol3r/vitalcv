# Operator Activation Checklist
Generated: 2026-05-13T05:00:00Z

---

## Environment Variables

### Vercel / Production (set in project dashboard)

| Var | Required | Status | Notes |
|-----|----------|--------|-------|
| `CLERK_SECRET_KEY` | ✅ Critical | Set | sk_live_* |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | ✅ Critical | Set | pk_live_* |
| `BACKEND_URL` | ✅ Critical | ⚠ Check | Must point to Railway API URL |
| `DATABASE_URL` | ✅ Critical | ⚠ Check | Postgres connection string |
| `RECEIPT_PRIVATE_KEY_JWK` | ✅ Critical | ⚠ Check | ES256 private key JSON |
| `RECEIPT_KID` | ✅ Critical | ⚠ Check | e.g. vcv-signing-key-{timestamp} |
| `VITALCV_ENV_LABEL` | Recommended | ⚠ Missing | Set to "production" or "pilot" |
| `NEXT_PUBLIC_API_BASE` | Fallback | Optional | Falls back to BACKEND_URL |
| `CORS_ORIGIN` | ✅ Critical | ⚠ Check | Must NOT be "*" in production |

### Railway API (set in service environment)

| Var | Required | Notes |
|-----|----------|-------|
| `DATABASE_URL` | ✅ Critical | Postgres |
| `CORS_ORIGIN` | ✅ Critical | https://vitalcv.com,https://www.vitalcv.com |
| `MONITORING_SECRET` | Recommended | For /api/internal/* routes |
| `NODE_ENV` | ✅ Critical | production |

---

## Railway Demo Seed

```bash
# Seed launch opportunities
cd apps/api/backend
npx ts-node -e "
const { seedLaunchOpportunities } = require('./src/services/opportunities/launchOpportunitySeed');
seedLaunchOpportunities().then(() => console.log('seeded')).catch(console.error);
"
```

Required for: employer opportunities to appear, matcha matching to work.

---

## Clerk Runtime Activation

1. Verify publishable key is `pk_live_*` (not `pk_test_*`) in production
2. Set `CLERK_WEBHOOK_SECRET` if using Clerk webhooks
3. Confirm `/api/auth/resolve-role` returns correct role for test user
4. Verify post-sign-in redirect lands on `/dashboard` or clinician home

---

## Scheduled Probe Runner

Set up via OpenClaw cron or Railway cron:

| Schedule | Endpoint | Purpose |
|----------|----------|---------|
| Every 5 min | `GET /api/status` | Verify overall operational status |
| Every 15 min | `GET /.well-known/jwks.json` | Verify signing key accessible |
| Hourly | `GET /api/runtime/ping` | Backend liveness |
| Daily 00:00 UTC | `POST /api/ingest/[npi]` (demo NPI) | Verify ingest pipeline |

---

## Edge Cache Purge Sequence

After any key rotation or env var change:
1. Purge `/.well-known/jwks.json` (CDN TTL: 1h)
2. Purge `/.well-known/did.json` (CDN TTL: 1h)
3. Purge `/.well-known/trust.json` (CDN TTL: 5min — self-purges quickly)
4. Wait 90s for propagation
5. Verify all `.well-known` endpoints via probe runner

---

## Deployment Propagation Verification

After Railway deploy:
```bash
curl https://api.vitalcv.com/api/health
# Expected: {"status":"ok"} or org context error (not HTML)

curl https://vitalcv.com/.well-known/jwks.json
# Expected: {"keys":[{"kty":"EC",...}]}

curl https://vitalcv.com/api/status
# Expected: {"overall":"operational",...}
```

---

## PILOT-1 Activation Sequence

1. Create test clinician account via Clerk sign-up
2. POST `/api/me/link-npi` with real NPI
3. POST `/api/ingest/{npi}` to trigger NPPES hydration
4. GET `/api/passport/npi/{npi}` — should return full PassportData
5. POST `/api/credentials/issue` — issue first SD-JWT
6. GET `/.well-known/jwks.json` — verify signing key present
7. POST `/api/credentials/verify` with issued JWT — verify passes


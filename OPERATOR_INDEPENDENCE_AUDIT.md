# Operator Independence Audit
Generated: 2026-05-13T18:29:50Z

---

## Verdict: PARTIALLY AUTONOMOUS — KEY PATHS AUTOMATED, 4 MANUAL ACTIONS REMAIN

Replay, receipt, and degraded-state recovery are automatic.
Chain repair, production activation, and lane expansion still require operators.

---

## Automated (No Operator Required)

| Function | How | Trigger |
|---|---|---|
| NPPES lane probe | OpenClaw cron `vcv-lane-probe` | Every 6h |
| Degraded-state detection | OpenClaw cron `vcv-degraded-recovery` | Every 30min |
| Replay integrity check | OpenClaw cron `vcv-replay-reconciliation` | Every 12h |
| Chain link creation on new ingest | `ingestOrchestrator → persistRunIdOnSourceRun` | On every ingest |
| Synthetic fallback when backend unreachable | `getReplayInspection` timeout path | On backend 503/timeout |
| DB reconnection after crash | Prisma built-in retry | Automatic |
| Audit event deduplication | `dedupeKey @unique` upsert | On every write |
| Signing key stability | Fixed `vcv-es256-dev` kid | Process constant |

---

## Still Manual (Operator Required)

### 1. `repairChain(npi)` Invocation
- **Gap:** Chain repair is implemented but not wired to any automatic trigger
- **Impact:** Orphaned runs accumulate silently if ingest has a bug
- **Fix:** Wire `reconstructAll()` to startup or to the replay reconciliation cron
- **Effort:** 10 min — add call in cron job payload

### 2. Production Env Activation
- `RECEIPT_PRIVATE_KEY_JWK` — Vercel
- `CORS_ORIGIN` — Railway
- `NEXT_PUBLIC_BACKEND_URL` — Vercel
- **Effort:** 10 min total

### 3. New NPI Onboarding
- No self-serve clinician ingest flow yet (PILOT-1 was operator-triggered via curl)
- **Impact:** Each new clinician requires `POST /api/ingest/{npi}` from operator
- **Fix:** PILOT-1 UI flow (Clerk auth → NPI bind → auto-ingest)

### 4. Production Deployment
- `vercel --prod` after env vars set
- **Impact:** Public apex not verified externally

---

## Wire `reconstructAll` to Startup (5-min fix)

```ts
// In server.ts or app.ts startup block:
import { reconstructAll } from './services/replay/replayReconstructor';

// After all routes registered, non-blocking:
reconstructAll()
  .then(s => log('info', 'replay_chains_reconciled_on_startup', s))
  .catch(e => log('warn', 'replay_reconstruction_nonfatal', { error: String(e) }));
```

This eliminates the manual chain repair dependency.

---

## Summary

| Category | Automated | Manual |
|---|---|---|
| Replay auto-reconciliation | Partial (ingest only) | Chain repair not wired |
| Chronology auto-repair | No | Requires `repairChain(npi)` |
| Degraded-state auto-recovery | ✅ | — |
| Receipt auto-derivation | ✅ (on ingest) | — |
| Replay self-healing | Partial (fallback exists) | Chain orphan repair manual |
| Production activation | ❌ | 10 min operator action |
| Clinician onboarding | ❌ | Operator curl required |

**SUCCESS: Core continuity is largely autonomous. 4 remaining manual dependencies are documented and scoped.**

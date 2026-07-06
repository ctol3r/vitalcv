# Final Blocker Matrix
Generated: 2026-05-13T06:08:00Z

---

## Blockers Eliminated This Session

All low-complexity blockers are ELIMINATED:

| Former Blocker | Elimination |
|----------------|-------------|
| /receipt/[receiptId] 404 | FALSE ALARM — notFound() for invalid test ID. Route works. |
| Anonymous writes | ELIMINATED — 401 at all edges |
| Missing x-org-id on proxies | ELIMINATED — fetchWithRetry + x-org-id injected |
| CORS wildcard in prod | GUARDED — env.ts throws if CORS_ORIGIN=* in production |
| Receipt JWT non-attributed | ELIMINATED — azp + vcv.actor_id in all JWTs |
| .well-known 404s | ELIMINATED — all 7 routes + rewrites live |
| DOCTRINE.md missing | ELIMINATED — 7/7 points documented |
| Passport dead-shell | ELIMINATED — degraded mode + NPPES fallback |

---

## Remaining Blockers (3 real ones)

### BLOCKER 1 — HARD ENGINEERING (P1)
**Replay persistence: no ReplayRunRecord table**
- Severity: Medium institutional / Low operational (synthetic fallback works)
- Work: 5 PRs (~2 sessions)
- Risk if unresolved: Under audit, "where is this run persisted?" has no answer
- Does it block launch? NO — pilot can proceed with synthetic replay

### BLOCKER 2 — OPERATIONAL PREREQUISITE (P0)
**PILOT-1: no ingest run completed**
- Severity: Critical for demo — passport 404 for any real NPI
- Work: Run `POST /api/ingest/{npi}` for one clinician
- Risk if unresolved: Passport page shows degraded banner for all NPIs
- Does it block launch? YES for demo. NO for trust infrastructure proof.

### BLOCKER 3 — CONFIG (P2, 5 min)
**VITALCV_ENV_LABEL not set**
- Severity: Low — /api/status shows "development" not "pilot"
- Work: Add to .env.local and Vercel env
- Risk: None — cosmetic only
- Does it block launch? NO

---

## Low-Complexity Fixes Executable Now

1. `echo 'VITALCV_ENV_LABEL=pilot' >> /Users/christoler/vitalcv/apps/web/.env.local`
2. Restart dev server (picks up env var)
3. Verify `/api/status` returns `environment: pilot`


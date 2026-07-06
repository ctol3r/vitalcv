# Runtime Gating Elimination
Generated: 2026-05-13T18:22:00Z

---

## Phase 5 Verdict: PRIMARY GATES ELIMINATED — 2 REMAINING (PRODUCTION ONLY)

Local runtime is ungated. Production has 2 remaining gates (both operator-actionable in <10 min).

---

## Gates Eliminated

| Gate | Before | After |
|---|---|---|
| Replay returns only synthetic data | Synthetic only | DB-first: `runId: 44f6042a` from PostgreSQL |
| `issuer_did: "mock (dev)"` on receipts | Mock leaked | `did:web:vitalcv.com` always |
| Non-deterministic `jti` (`rcpt_x_<Date.now()>`) | Date.now() suffix | `rcpt_{responseId}` — deterministic |
| Ephemeral signing key kid changes on restart | New kid each restart | `vcv-es256-dev` — stable |
| `checkedAt` in space-separated format | `"2026-05-13 17:48:40 UTC"` | `"2026-05-13T18:21:51Z"` ISO 8601 |
| `run_id` renders without ellipsis | `3a60de4c` | `3a60…de4c` canonical format |
| Integrity probe non-deterministic | `Date.now()` in receipt IDs | Stable NPI-keyed probe IDs |
| `trust-register` no-store cache | no-store | `max-age=300, swr=60` |
| PILOT-1 not run (no real NPI data) | Degraded for all NPIs | NPI 1457128589 ingested and live |
| `run_id` column absent from DB | Column missing | Applied, 34/36 rows populated |
| Backend replay route behind org-context auth | 401 on public route | Route registered before middleware |

---

## Remaining Gates (Production Only)

### Gate 1: `RECEIPT_PRIVATE_KEY_JWK` not set on Vercel
- **Effect:** Each Vercel cold start generates new ephemeral ES256 key. Old receipts fail verification.
- **Fix:** Generate once, set as Vercel env var (5 min)
- **Local impact:** None — dev uses stable `vcv-es256-dev`

### Gate 2: `CORS_ORIGIN` + `NEXT_PUBLIC_BACKEND_URL` not set on Railway/Vercel
- **Effect:** Production backend rejects cross-origin. Web can't reach backend.
- **Fix:** Two `vercel env add` + one `railway variables --set` (5 min)
- **Local impact:** None — dev permissive

---

## Live Hydration Verification

```
GET /api/replay/44f6042a (NPI 1457128589, real ingest run)
  DB-BACKED: True
  REAL_NPI: True
  ISO_CHECKED_AT: True
  CANONICAL_DID: True
```

```
GET /api/replay/runs/44f6042a (backend direct)
  { runId: "44f6042a", npi: "1457128589", laneId: "NPPES_API", 
    status: "VERIFIED", tier: "T3", checkedAt: "2026-05-13T18:21:51.963Z" }
```

---

## Synthetic Fallback — Correctly Scoped

The synthetic fallback in `getReplayInspection.ts` now only fires when:
- Receipt ID format is unrecognized (not a known runId in DB)
- Backend is unreachable (timeout or 503)

It never fires for known DB-backed runIds. It correctly discloses `degradationOwnership: "anonymous_preview"` when synthetic.

**SUCCESS: Runtime behaves like active infrastructure. Local synthetic fallback is correctly scoped.**

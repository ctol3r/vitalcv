# Durable Continuity Reality State
Generated: 2026-05-13T18:29:50Z
Branch: wave-10a/docs-status | Post-restart verified

Classification:
- **Durable** — PostgreSQL. Survives restart with zero operator action.
- **Recoverable** — Not durable by default, but deterministically reconstructable from durable state.
- **Derivable** — Not stored, but computable from durable state without data loss.
- **Volatile** — Process memory only. Lost on restart.
- **Absent** — Does not exist in any form.

---

## Replay Continuity

| Component | Class | Evidence |
|---|---|---|
| `SourceRun` records (36 rows) | **Durable** | PostgreSQL `source_runs` |
| `SourceRun.runId` (34 populated) | **Durable** | `@unique` column, migration applied |
| `SourceRun.priorRunId` chain links (21 populated) | **Durable** | Migration applied, backfilled, chain linker live |
| Chain for NPI 1457128589 (`6a4aaa2a ← 44f6042a`) | **Durable** | Verified intact post-restart |
| Replay API `/api/replay/[runId]` | **Durable** | DB-first, confirmed after restart |
| Replay chain API `/api/replay/chain/[npi]` | **Durable** | DB-backed via `by-npi` route |
| Chronology order (startedAt) | **Durable** | Immutable timestamp on `source_runs` |
| Chain repair function `repairChain` | **Recoverable** | Idempotent, rebuilds from durable state |
| Full reconstruction `reconstructAll` | **Recoverable** | Rebuilds all chains from durable state |
| `priorRunId` for runs missing it | **Recoverable** | `repairChain(npi)` restores deterministically |
| RFC 3161 TSA anchor | **Absent** | Not implemented |
| Replay chain for NPIs not yet ingested | **Absent** | No records in DB |

---

## Receipt Continuity

| Component | Class | Evidence |
|---|---|---|
| `VerificationReceiptRecord` (38 rows) | **Durable** | PostgreSQL, linked to SourceRun |
| Receipts for NPI 1457128589 | **Durable** | 7 records from PILOT-1 ingest |
| Receipt `trustTier` (GOLD) | **Durable** | Stored on VRR |
| Receipt `observedAt` | **Durable** | Immutable timestamp |
| ES256 signed JWT bytes | **Volatile** | Not stored; signing re-issues new JWT |
| Offline JWT verification | **Derivable** | Verifiable against JWKS without VitalCV |
| Status List 2021 (revocation) | **Absent** | Not implemented |

---

## Trust Discovery

| Component | Class | Evidence |
|---|---|---|
| JWKS route (`/.well-known/jwks.json`) | **Durable** | Stateless route, key stable |
| JWKS kid `vcv-es256-dev` | **Durable** | Constant — survives restart |
| JWKS public key bytes | **Volatile** | Regenerated on restart in dev |
| DID document | **Derivable** | Computed from runtime key; stable output |
| OID4VCI metadata | **Durable** | Static config in route |
| Trust register | **Durable** | Static doctrine in route |
| Production signing key bytes | **Absent** | `RECEIPT_PRIVATE_KEY_JWK` not set on Vercel |

---

## Persistence Infrastructure

| Component | Class | Evidence |
|---|---|---|
| Audit events (18 rows) | **Durable** | PostgreSQL, `dedupeKey` upsert |
| Learning events (17 rows) | **Durable** | PostgreSQL, `dedupeKey @unique` |
| Ingest runs (2 rows) | **Durable** | PostgreSQL |
| DB connection on restart | **Recoverable** | Prisma reconnects automatically |
| In-flight ingest state | **Volatile** | Lost on process kill |

---

## Schedulers

| Component | Class | Evidence |
|---|---|---|
| OpenClaw cron (3 jobs) | **Durable** | Gateway-persisted |
| Backend internal schedulers | **Volatile** | Restarted from scratch on restart |
| `reconstructAll` on startup | **Absent** | Not yet wired to startup |

---

## Final Answers

### 1. What continuity survives restart with NO operator intervention?

```
✅ All SourceRun records + runId + priorRunId chains
✅ All VerificationReceiptRecord receipts
✅ All Audit + Learning events
✅ JWKS kid (vcv-es256-dev stable)
✅ Replay API responses for known runIds
✅ Full chain for NPI 1457128589 (2 runs, 1 link)
✅ All .well-known/ discovery routes
✅ OpenClaw cron schedulers (3 jobs)
✅ ISO 8601 checkedAt on all responses
✅ Canonical DID (did:web:vitalcv.com)
```

---

### 2. What continuity is reconstructable but not durable?

```
⚠️ Broken chain links — reconstructable via repairChain(npi)
⚠️ runId for source_runs where runId=null — derivable via deriveRunId(npi:startedAt)
⚠️ DB connection after crash — Prisma reconnects automatically
⚠️ Backend schedulers — restart restores them (no state needed)
```

---

### 3. What continuity still breaks under interruption?

```
❌ JWKS key bytes (new bytes each restart — production only issue when RECEIPT_PRIVATE_KEY_JWK not set)
❌ In-flight ingest (if killed mid-run, SourceRun may be in QUEUED state — re-ingest required)
❌ Backend schedulers (must restart backend to restore — process-bound)
```

---

### 4. What continuity remains partially synthetic?

```
⚠️ Replay for NPIs not in DB — synthetic fallback with disclosure
⚠️ Chain for unknown runIds — synthetic ReplayInspection, not DB record
⚠️ `anchored` replay state — not backed by TSA; stated but not externally verifiable
⚠️ OIG/state/PECOS lane data — `pending_integration` (0 records in DB for these lanes)
```

---

### 5. What infrastructure still blocks institutional-grade survivability?

Ranked by institutional impact:

```
1. Production signing key (RECEIPT_PRIVATE_KEY_JWK on Vercel)
   — Every cold start produces new key bytes; prior receipts fail verification
   — 5 min to fix

2. CORS_ORIGIN + NEXT_PUBLIC_BACKEND_URL on production
   — Production web cannot reach backend without this
   — 5 min to fix

3. reconstructAll() on startup
   — Chain repair is manual; orphaned runs accumulate if ingest has a bug
   — 10 min to wire

4. PILOT-1 for second NPI
   — Only 1 NPI has been ingested; not institutionally representative
   — 5 min per NPI

5. TSA / RFC 3161 anchor
   — `anchored` state cannot be verified offline without TSA integration
   — Major engineering effort

6. Status List 2021
   — No credential revocation path exists
   — Major engineering effort

7. OIG exclusion lane
   — Required for institutional T3 coverage claim
   — Requires API integration
```

---

## Summary: What Changed This Wave

| Before | After |
|---|---|
| `priorRunId` absent | **Durable** — 21 chain links in DB |
| Chain traversal impossible | **Live** — `6a4aaa2a ← 44f6042a` verified |
| `reconstructAll()` absent | **Implemented** — idempotent, DB-only |
| `repairChain()` absent | **Implemented** — idempotent, per-NPI |
| Second ingest not run | **DONE** — `runId: 6a4aaa2a`, chained |
| `by-npi` route absent | **Live** — public, no auth |
| Replay chain post-restart unverified | **Verified** — intact after kill |

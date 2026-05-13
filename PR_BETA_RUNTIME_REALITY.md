# PR-β Runtime Reality
Generated: 2026-05-13T19:05:00Z
Branch: wave-10a/docs-status
Latest commit: 0b8c4a38

---

## Classification Key

- **Durable** — PostgreSQL. Survives restart. No operator needed.
- **Recoverable** — Not durable by default, but deterministically reconstructable.
- **Derivable** — Computable from durable state. No data loss.
- **Volatile** — Process memory. Lost on restart.
- **Absent** — Does not exist.

---

## Replay Continuity

| Component | Class |
|---|---|
| `SourceRun` records (39 rows) | **Durable** |
| `SourceRun.runId` (37 populated) | **Durable** |
| `SourceRun.priorRunId` chain (24 links) | **Durable** |
| Chain: `246f3c0d ← 6a4aaa2a ← 44f6042a` | **Durable** |
| Chain reconstruction (`repairChain`) | **Recoverable** |
| Replay API `GET /api/replay/[runId]` | **Durable** (DB-first) |
| Chain API `GET /api/replay/runs/by-npi/[npi]` | **Durable** |
| Replay writer (`persistRunIdOnSourceRun`) | **Durable** (fires every ingest) |
| Replay writer failure isolation | **Durable** (try/catch, logged) |
| Synthetic fallback for unknown IDs | **Derivable** (djb2, disclosed) |
| `priorRunId` for runs missing it | **Recoverable** (`repairChain`) |
| Payload digest / checksum | **Absent** |
| RFC 3161 TSA anchor | **Absent** |

---

## Receipt Continuity

| Component | Class |
|---|---|
| `VerificationReceiptRecord` (45+ rows) | **Durable** |
| Receipt `receiptId` | **Durable** (deterministic) |
| Receipt `signingKeyId` | **Durable** (`vcv-es256-dev` stable) |
| Receipt `issuerDid` | **Durable** (`did:web:vitalcv.com`) |
| Signed JWT bytes | **Volatile** |
| Status List 2021 | **Absent** |

---

## Trust Discovery

| Component | Class |
|---|---|
| `/.well-known/jwks.json` | **Durable** (route exists, kid stable) |
| `/.well-known/did.json` | **Derivable** (computed from key) |
| `/.well-known/openid-credential-issuer` | **Durable** |
| `/.well-known/trust-register` | **Durable** |
| Production signing key | **Durable on Vercel** (env set) / **Volatile locally** |

---

## Schedulers

| Component | Class |
|---|---|
| OpenClaw cron (3 jobs) | **Durable** (gateway-persisted) |
| Backend internal schedulers | **Volatile** (process-scoped) |

---

## Final Answers

### 1. What continuity is now LIVE?

```
✅ 3-run replay chain for NPI 1457128589 (NPPES_API lane)
✅ Chain links: 246f3c0d ← 6a4aaa2a ← 44f6042a ← null
✅ Replay writer fires on every ingest, try/catch isolated
✅ DB-first replay retrieval via /api/replay/[runId]
✅ Chain retrieval via /api/replay/runs/by-npi/[npi]
✅ 45+ receipt records linked to source runs
✅ 37/39 source_runs with deterministic runId
✅ 24 chain links in prior_run_id
✅ All .well-known/ discovery routes serving correct payloads
✅ 3 OpenClaw cron schedulers running
✅ 7 Vercel production env vars set (signing key, Clerk, backend URL)
✅ Build passes locally
```

### 2. What continuity is still empty infrastructure?

```
⚠️ Payload digest — schema column absent, no hash stored
⚠️ RFC 3161 TSA anchor — not wired
⚠️ Status List 2021 — not implemented
⚠️ OIG/state/PECOS lanes — pending_integration (no real data)
⚠️ Production deployment — build passes but deploy needs GitHub push
```

### 3. What continuity still depends on operators?

```
Manual: git push origin main (triggers Vercel production build)
Manual: Railway CORS_ORIGIN + DATABASE_URL verification
Manual: repairChain() for orphaned runs (not auto-scheduled)
Manual: New NPI onboarding (POST /api/ingest/{npi})
```

### 4. What continuity still fails under interruption?

```
❌ JWKS key bytes (volatile — new bytes each dev restart; production stable via env)
❌ Backend scheduler state (restarted from scratch)
❌ In-flight ingest killed mid-run (SourceRun stays in QUEUED)
❌ Signed JWT bytes (not persisted — re-sign produces different JWT)
```

### 5. What still blocks institutional-grade replay durability?

```
Ranked by impact:

1. Production deploy (GitHub push → Vercel auto-build)
   — Without this: external verification impossible
   — Effort: git push + PR merge

2. Railway CORS_ORIGIN verification
   — Without this: production cross-origin calls fail
   — Effort: 2 min if Railway CLI authed

3. Payload digest on SourceRun
   — Without this: no tamper detection on ingest payloads
   — Effort: 1 column + 1 hash call

4. reconstructAll() wired to startup
   — Without this: orphaned chains accumulate silently
   — Effort: 5 lines in server.ts

5. Second NPI with multiple ingest runs
   — Without this: single-NPI pilot is not representative
   — Effort: 5 min per NPI
```

---

## PR-β Diff Summary

| File | Change |
|---|---|
| `ingestOrchestrator.ts` | Added `replay_writer_failed` + `replay_chain_lookup_failed` logging |
| `receipt/[lineageKey]/route.ts` | Deterministic `receiptId` + `signingKeyId` (removed Date.now()) |
| `status/page.tsx` | ESLint: `<a>` → `<Link>` |
| `integrity/[npi]/route.ts` | async params (Next.js 15) |

**4 files changed. All additive or fix. Zero ingest semantics altered.**

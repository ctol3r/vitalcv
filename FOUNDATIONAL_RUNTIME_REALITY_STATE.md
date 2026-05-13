# Foundational Runtime Reality State
Generated: 2026-05-13T18:22:00Z
Branch: wave-10a/docs-status
DB: PostgreSQL vitalcv_dev — confirmed live
Probe time: 2026-05-13T18:22Z

Classification key:
- **Durable** — exists in PostgreSQL, survives restart
- **Derivable** — not stored, but deterministically computable from durable state
- **Volatile** — exists only in process memory, lost on restart
- **Absent** — does not exist

---

## Infrastructure Classification

### Trust Discovery

| Component | Classification | Evidence |
|---|---|---|
| `/.well-known/jwks.json` | **Durable** | Route exists; key stable (`vcv-es256-dev`) across restarts |
| `/.well-known/did.json` | **Derivable** | Route exists; DID document computed from runtime key |
| `/.well-known/openid-credential-issuer` | **Durable** | Route exists; static config |
| `/.well-known/trust-register` | **Durable** | Route exists; static doctrine |
| DID `did:web:vitalcv.com` | **Durable** | Canonical, zero `.health` references |
| JWKS public key bytes | **Volatile** | ES256 keypair generated at module load; `kid` stable but bytes differ per restart in dev |
| Signing key persistence (production) | **Absent** | `RECEIPT_PRIVATE_KEY_JWK` not set on Vercel |

---

### Replay Continuity

| Component | Classification | Evidence |
|---|---|---|
| `SourceRun.runId` column | **Durable** | Migration applied; 34/36 rows populated |
| SourceRun records (36 rows) | **Durable** | PostgreSQL `source_runs` table |
| `runId: "44f6042a"` (Macie Miller NPPES run) | **Durable** | Retrieved from DB after restart |
| Replay API `/api/replay/[runId]` | **Durable** | DB-first path confirmed live |
| Backend `/api/replay/runs/:runId` | **Durable** | Public, returns DB record, 404 for unknowns |
| Replay chronology ordering | **Derivable** | Derived from `startedAt` on `source_runs` — deterministic |
| `priorRunId` chain links | **Absent** | Column does not exist; no chain link computed on ingest |
| Replay chain gaps | **Derivable** | Computed from run set — not stored |
| RFC 3161 TSA anchor | **Absent** | Not implemented |
| Synthetic replay fallback | **Volatile** | Fires only for unknown IDs; correctly disclosed |

---

### Receipt Continuity

| Component | Classification | Evidence |
|---|---|---|
| `VerificationReceiptRecord` (38 rows) | **Durable** | PostgreSQL; includes 7 from PILOT-1 |
| Receipt records linked to SourceRun | **Durable** | `source_run_id` FK on VRR |
| NPPES receipts for NPI 1457128589 | **Durable** | 3 receipts from PILOT-1 ingest |
| ES256 receipt JWTs (signed) | **Volatile** | Signed in process memory; not stored in DB |
| Receipt JWT verification (offline) | **Durable** | Verifiable against JWKS; does not require VitalCV server |
| `jti` determinism | **Durable** | `rcpt_{responseId}` — no Date.now() |
| Status List 2021 (revocation) | **Absent** | Not implemented |

---

### Persistence

| Component | Classification | Evidence |
|---|---|---|
| Audit events (18 rows) | **Durable** | PostgreSQL, `dedupeKey` upsert |
| Learning events (17 rows) | **Durable** | PostgreSQL, `dedupeKey @unique` |
| Ingest runs (2 rows) | **Durable** | PostgreSQL |
| PILOT-1 completed | **Durable** | `IngestRun.status = DONE`, NPI 1457128589 |
| DB reconnect after restart | **Durable** | Prisma reconnects automatically |
| Process memory cache | **Volatile** | All in-memory state lost on restart |
| Signing key bytes (dev) | **Volatile** | Regenerated on restart; `kid` stable |

---

### Observability

| Component | Classification | Evidence |
|---|---|---|
| Audit event creation (16 sites) | **Durable** | wired to DB |
| `/api/status` health payload | **Derivable** | Computed at request time from live state |
| Backend startup logs (JSON) | **Volatile** | stdout only |
| Scheduler execution logs | **Volatile** | stdout only; no DB log |
| OpenClaw cron job runs | **Durable** | Persisted in gateway |

---

### Schedulers

| Component | Classification | Evidence |
|---|---|---|
| OpenClaw cron: `vcv-degraded-recovery` (30min) | **Durable** | Gateway-persisted |
| OpenClaw cron: `vcv-lane-probe` (6h) | **Durable** | Gateway-persisted |
| OpenClaw cron: `vcv-replay-reconciliation` (12h) | **Durable** | Gateway-persisted |
| Backend internal schedulers | **Volatile** | Lost on process restart |

---

## Final Required Answers

### 1. What infrastructure is STILL absent?

```
- priorRunId chain links in DB (no column, no computation)
- RFC 3161 TSA anchor (not wired)
- Status List 2021 / revocation (not implemented)
- RECEIPT_PRIVATE_KEY_JWK on Vercel (signing key ephemeral in production)
- CORS_ORIGIN on Railway (production cross-origin blocked)
- NEXT_PUBLIC_BACKEND_URL on Vercel (production backend unreachable)
- OIG exclusion lane integration (pending_integration)
- State license lane integration (pending_integration)
- PECOS enrollment integration (pending_integration)
- Scheduler execution persistence (backend schedulers lost on restart)
```

---

### 2. What resilience properties are STILL impossible?

```
- Offline replay chain traversal (no priorRunId links)
- Independent verification of replay chain continuity (no chain to traverse)
- Credential revocation by verifier (no Status List)
- Production-stable receipt signing (no persistent key on Vercel)
- Multi-lane coverage proof (only NPPES lane is active)
- Cross-restart backend scheduler continuity (volatile)
```

---

### 3. What continuity survives restart TODAY?

```
SURVIVES:
- SourceRun records + runId values (PostgreSQL)
- VerificationReceiptRecord (PostgreSQL)
- Audit events (PostgreSQL)
- Learning events (PostgreSQL)
- Ingest run history (PostgreSQL)
- PILOT-1 ingest result (PostgreSQL — NPI 1457128589 status VERIFIED)
- OpenClaw cron schedulers (gateway)
- All .well-known/ route responses (stateless — computed from env + DB)
- Replay API for known runIds (DB-backed)
- DID document (stateless)
- JWKS kid (stable vcv-es256-dev)
```

---

### 4. What continuity remains volatile TODAY?

```
VOLATILE:
- JWKS key bytes (stable kid, new bytes each restart in dev)
- Signed JWT receipt bytes (not stored; re-sign would produce different JWT)
- Backend scheduler state (restart = reschedule from scratch)
- In-memory Prisma connection pool (reconnects automatically, but ~1s gap)
- Any in-flight ingest state (interrupted ingest = incomplete SourceRun)
```

---

### 5. What must exist before institutional resilience claims become valid?

Ranked by impact:

```
1. RECEIPT_PRIVATE_KEY_JWK set on Vercel
   — Makes signing key durable in production
   — Without this: every cold start invalidates all prior receipts

2. priorRunId column + chain linker
   — Makes replay chain traversable
   — Without this: individual runs are durable but not linked

3. CORS_ORIGIN + NEXT_PUBLIC_BACKEND_URL on production
   — Without this: production web cannot reach backend

4. External production apex probe
   — Without this: all verification is local-only

5. Second NPI ingest (expand beyond Macie Miller)
   — Without this: single-point pilot is not institutionally representative

6. OIG exclusion lane integration
   — Without this: T3 exclusion coverage cannot be claimed

7. Status List 2021
   — Without this: credential revocation is not possible
```

---

## Summary Grid

| Domain | Durable | Derivable | Volatile | Absent |
|---|---|---|---|---|
| Replay persistence | runId, SourceRun, VRR | chronology, gaps | signed JWT bytes | priorRunId chain, TSA |
| Receipt continuity | VRR records, 38 rows | receipt shape | JWT bytes | Status List |
| Trust discovery | .well-known/ routes | DID doc | key bytes | prod signing key |
| Schedulers | OpenClaw cron (3) | — | backend schedulers | — |
| Observability | audit events | status payload | scheduler logs | scheduler persistence |
| Lane coverage | NPPES (1 lane) | — | — | OIG, state, PECOS |
| Production readiness | — | — | — | CORS, BACKEND_URL, signing key |

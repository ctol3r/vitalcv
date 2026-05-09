# W2-PR6A — Operational Audit Spine Certification

**Wave:** Wave 2, PR 6A — operational audit spine hardening · **Date:** 2026-05-08 · **Status:** certification analysis only; **NO product code, NO runtime modification, NO merge** · **Reviewer posture:** operational audit certifier · **Authority:** subordinate to `TRUST_GUARANTEE_LEXICON.md`, `MUTATION_GATE_SEQUENCE.md`, `w2-pr5a-audit-certification.md`; consolidates the new sibling docs in this wave (Tracks A–E)

This doc is the **top-level certification report** for VitalCV's operational audit spine. It establishes the boundary: what the audit spine actually delivers operationally, what it does not, and where the certifiable claims live.

The central thesis: **the audit spine is materially stronger than the W2-PR2C/W2-PR3B/W2-PR5A reviews previously surfaced.** A pre-existing tiered infrastructure (in-memory ledger + Postgres dual-write + cursor-based SIEM export + scrapbook bundle + replay event types) supports L1+L2 trace continuity, attribution durability, and SIEM survivability beyond what Lock v2 introduces.

---

## 1. The audit spine — observed shape

### 1.1 Pre-existing infrastructure (NOT introduced by this wave)

| Component | File | Capability |
|---|---|---|
| **Append-only in-memory ledger** | `apps/api/backend/src/services/audit/auditLedger.ts:108` (`appendAuditEvent`) | Synchronous append with `traceId` propagation |
| **Trace-id minting** | Same file (`newTraceId`) | UUID-v4 per logical operation |
| **Dual-write to Postgres** | `apps/api/backend/src/services/audit/auditService.ts:60` (`createAuditEvent`) | Fire-and-forget DB persistence after in-memory append |
| **Tier-1 synchronous DB write** | Same file:130 (`requireAuditBeforeResponse`) | Awaits DB write; throws on failure |
| **Cursor-based export** | `auditLedger.ts:162` (`exportAuditPage`) | Pagination for SIEM streaming |
| **Time-bounded export** | Same file:191 (`exportSinceTime`) | SIEM-friendly time queries |
| **Audit scrapbook bundle** | `apps/api/backend/src/services/audit/auditScrapbookBundle.ts` + `packages/audit/AuditScrapbook.ts` | Bundle construction for downstream consumers |
| **Replay engine** | `apps/api/backend/src/services/audit/replayEngine.ts` | Processing pipeline |
| **Receipt generator** | `apps/api/backend/src/services/audit/receiptGenerator.ts` | Receipt construction |
| **Bundle proof** | `apps/api/backend/src/services/audit/auditBundleProof.ts` | Proof construction |
| **Canonical event types** | `packages/audit/AuditEvent.ts:5–35` (frozen YC MVP) | 24 typed events including `IDEMPOTENT_REPLAY`, `CONCURRENCY_GUARD_TRIGGERED` |
| **Hash + tamper-evidence** | `AuditEvent.hash` column + canonical-form hashing | L2 integrity |
| **Anchoring schema** | `AuditEvent.anchored` + `merkleRoot` columns | L3 substrate (live pipeline UNVERIFIED) |
| **Postgres durability** | `prisma.auditEvent` model | Cross-process restart durability |

### 1.2 What W2-PR6A does NOT introduce

This wave is **certification only.** It does NOT:

- Add new audit event types.
- Modify the in-memory ledger.
- Change the dual-write pattern.
- Introduce new tiers beyond T0/T1/T2.
- Add new scrapbook fields.
- Change replay engine behavior.
- Modify receipt generator.
- Change canonical-form hashing.

It **classifies and certifies** the existing spine plus the wave's planned additions (Lock v2's correlationId stamping + denied-path audit emission).

---

## 2. The 5-track certification (consolidated)

Each track is a separate doc. This doc summarizes their classifications.

| Track | Subject | Doc | Aggregate status |
|---|---|---|---|
| **A** | Trace survivability | `w2-pr6a-trace-survivability.md` | 🟡 **PARTIAL** — `traceId` exists in-memory; persistence to audit `metadata.traceId` is fire-and-forget; H5 forensic-query frontier silent |
| **B** | Mutation lineage integrity | `w2-pr6a-mutation-lineage.md` | 🟡 **PARTIAL** — payloadHash mandate (post-Lock-v2) closes capture-replay forensics; mutation-fingerprint propagation hop-fragile; action-classification continuity strong |
| **C** | Denial-path certification | `w2-pr6a-denial-path-certification.md` | 🟡 **PARTIAL** — pre-Lock-v2 emission is sparse; post-Lock-v2 mandates denied-path emission for Step-2+ denials; pre-auth probes remain audit-invisible by design |
| **D** | Attribution durability | `w2-pr6a-attribution-durability.md` | 🟡 **PARTIAL** — proxy-bounded actor attribution; per-org NULL today; survivability bounded by undocumented retention SLA |
| **E** | Audit spine matrix | `w2-pr6a-audit-spine-matrix.md` | 5 surfaces × 5 dimensions classified; aggregate distribution: 5 CERTIFIED + 8 PARTIAL + 4 FRAGMENTED + 3 UNSAFE |

---

## 3. The audit spine certification axes

### 3.1 Trace continuity reliability

**Per Track A.** `traceId` is the per-logical-operation primitive minted by `newTraceId()` and propagated through `appendAuditEvent`. It survives:

- ✅ Within-process (in-memory ledger).
- ⚠ Across-process via Postgres (fire-and-forget with CRITICAL log on failure).
- ⚠ Forensic queries IF the query author knows the field exists (H5 silent-loss frontier).
- ❌ Across systems with different audit stores (ledger is intra-process).

**Disposition:** 🟡 **PARTIAL** — strong within-process; weakens across hops.

### 3.2 Attribution durability

**Per Track D.** Actor attribution survives:

- ✅ Audit-row write (atomic with mutation for C-1 handlers).
- ⚠ Audit retention period (UNDOCUMENTED SLA).
- ⚠ Proxy regression (degrades to 401 on missing header — UX visible, not silent).
- ❌ T2 topology breach (forged `x-clerk-user-id`).
- ❌ Stale-session window (JWT outlives org membership change).

**Disposition:** 🟡 **PARTIAL** — proxy-bounded; topology-dependent; per-org NULL today.

### 3.3 Audit lineage consistency

**Per Track B.** Lineage = the chain of mutations + audits that constitute one logical operation (e.g., recognition → acceptance → start). It survives:

- ✅ Same-tx commits (atomic for C-1; cosmetic for C-2).
- ⚠ Cross-row joins via `referenceId` string match (no FKs).
- ❌ Independent table TRUNCATE / GC (operational discipline only).

**Disposition:** 🟡 **PARTIAL** — strong within-row; weakens across-row without FKs.

### 3.4 Denial-path observability

**Per Track C.** Pre-Lock-v2 emission of denied audit rows is sparse. Post-Lock-v2 mandates emission for Step-2+ denials. Step-1 (pre-auth) remains intentionally silent.

**Disposition:** 🟡 **PARTIAL** post-Lock-v2 — covers all Step-2+ denials; pre-auth probes by design audit-invisible.

### 3.5 Replay observability

Per `w2-pr5a-replay-certification.md`. Lock v2's correlationId stamping is the primitive; the wave's contribution to the audit spine is **stamping correlationId on every audit row (permitted + denied) with payloadHash mandate (RG-Rec-2).**

**Disposition:** 🟢 **CERTIFIED-IN-CONTRACT** for observability post-Lock-v2; 🔴 **NOT CERTIFIABLE** for prevention.

---

## 4. The non-negotiable rules — restated

Per the wave brief:

1. **Correlation is NOT non-repudiation.** correlationId stamps clusters mutations; it does not bind an actor's signature.
2. **Attribution is NOT ownership.** `metadata.actorId` records who acted; not whether they had org-authority.
3. **Audit lineage is NOT cryptographic proof.** L1+L2 (recorded + tamper-evident given DB integrity) ≠ L4/L5 (signed / non-repudiable).
4. **Replay observability is NOT replay prevention.** Best-effort dedup + capture-replay forensic detection ≠ DB-enforced anchoring.
5. **Unverified guarantees must remain explicitly partial.** L3 anchoring, retention SLA, deployment topology must NOT be claimed as CERTIFIED.
6. **Denied paths must remain observable.** Step-2+ denials emit audit rows; Step-1 pre-auth disclosed as audit-invisible by design.
7. **Trace continuity gaps must remain explicit.** H5 forensic-query frontier is the silent-loss boundary; must be documented.

The wave honors all 7 IF lexicon-aligned wording is enforced.

---

## 5. Per-handler audit-spine certification (post-Lock-v2)

| Handler | Trace continuity | Attribution durability | Lineage integrity | Denial observability | Replay visibility | **Aggregate** |
|---|---|---|---|---|---|---|
| `accept` (C-1) | 🟡 PARTIAL | 🟡 PARTIAL | 🟢 CERTIFIED — outbox + audit + acceptance row in same tx | 🟢 CERTIFIED | 🟢 CERTIFIED-IN-CONTRACT | 🟡 **PARTIAL** |
| `confirm-start` (C-1) | 🟡 PARTIAL | 🟡 PARTIAL | 🟢 CERTIFIED — references `acceptanceId` for chain | 🟢 CERTIFIED | 🟡 PARTIAL — deprecation window | 🟡 **PARTIAL** |
| `request-refresh` (C-1) | 🟡 PARTIAL | 🟡 PARTIAL | 🟡 PARTIAL — audit-only; no row chain | 🟢 CERTIFIED | 🟢 CERTIFIED-IN-CONTRACT | 🟡 **PARTIAL** |
| `route-to-review` (C-1) | 🟡 PARTIAL | 🟡 PARTIAL | 🟡 PARTIAL — HITL silent-degrade visible in audit | 🟢 CERTIFIED + Sentry breadcrumb | 🟢 CERTIFIED-IN-CONTRACT | 🟡 **PARTIAL** |
| `share-packet` (C-2) | 🟡 PARTIAL | 🟡 PARTIAL | 🟠 FRAGMENTED — audit IS persistence; share-token resolution depends on retention | 🟡 PARTIAL — denied-path | 🟡 PARTIAL | 🟠 **FRAGMENTED** |
| `packet` (audit-emitting GET, C-2) | 🟡 PARTIAL | 🟡 PARTIAL | 🟠 FRAGMENTED — audit IS export receipt; delivery not coupled | 🟡 PARTIAL | 🟡 PARTIAL | 🟠 **FRAGMENTED** |

---

## 6. Strongest operational audit guarantee

**`requireAuditBeforeResponse(prisma, {...})` synchronous DB write before 2xx for the 5 canonical non-repudiation paths** (per `auditService.ts:130–144` + comment block). On DB failure, throws — caller does not return 2xx. This is the platform's STRONGEST audit-coupling primitive: the mutation MUST not be visible to the caller as successful unless the audit row has committed to Postgres.

The 4 C-1 handlers in this wave's scope use the EVEN STRONGER pattern — `prisma.$transaction` wrapping mutation + audit together (T2 — atomic-with-mutation). The audit cannot commit without the mutation; the mutation cannot commit without the audit.

🟢 **CERTIFIED L1+L2+atomic-with-mutation** for the 4 C-1 handlers post-Lock-v2.

---

## 7. Weakest lineage surface

**S5 `share-packet` and S7 `packet` audit-as-persistence pattern** (both C-2 cosmetic-tx). The audit row IS the persistent record:

- For `share-packet`: `EMPLOYER_PACKET_SHARED` audit row's `metadata.shareTokenHash` is queried by the downstream `share-token/:token` GET resolution path. Audit retention < token TTL silently breaks share-resolution.
- For `packet`: `ARTIFACT_EXPORTED` audit row records the export; delivery (ZIP/JSON stream) is OUTSIDE the audit-write atomicity; audit-success ≠ delivery-success.

🟠 **FRAGMENTED** — the lineage of the share-token / packet-export ARTIFACT is bound to the audit retention SLA, which is undocumented. Recommendation: formalize retention SLA respecting longest token TTL.

---

## 8. Biggest trace survivability risk

**H5: forensic-query frontier silent-loss.** Per Track A, the 5-hop chain (Client → Proxy → Backend → Service → Audit Metadata → Forensic Query) makes Hop 5 the silent-failure cliff. A query author who doesn't know `metadata.traceId` or `metadata.correlationId` exists never asks for them — and the data is invisible.

Mitigation: publish `docs/ops/audit-row-schema.md` documenting all metadata fields + their semantics + which are trusted vs. echoed. Without this doc, observability is theoretical.

🟠 **FRAGMENTED** — H1–H4 silent-drops are visible in the audit row's missing field; H5 is invisible to anyone except the schema's authors.

---

## 9. Denial-path integrity assessment

**Per Track C.** Pre-Lock-v2: ZERO denied-path audit emission — denied requests are visible only in web-layer logs (and only if logged). Post-Lock-v2: mandated denied-path emission for Step-2+ denials with `metadata.outcome: 'denied'` + `metadata.action` reason suffix.

**Coverage:**

- ✅ Step-2+ denials (auth-present): role_denied, no_org_context, entity_not_found, acceptance_blocked, already_accepted, no_prior_acceptance, duplicate_request, malformed_resource_id, etc.
- ❌ Step-1 denials (no Clerk session): NO audit row; pre-auth probes invisible to audit forensics by design.

**Disposition:** 🟡 **PARTIAL** post-Lock-v2 — strong post-auth coverage; pre-auth invisible by design (acceptable trade-off documented per `w2-pr2c-runtime-truth-boundary.md` §5.2).

**Adversarial finding DP-1:** the wave should add `payloadHash` to denied-path audit rows (Lock v2 §8 currently mandates only on permitted; recommendation per `w2-pr3b-replay-governance.md` RG-Rec-2 extends this). Without it, capture-replay forensic detection on FAILED probes is impossible.

---

## 10. Attribution durability assessment

**Per Track D.** Actor attribution survives:

| Survival scenario | Status |
|---|---|
| Within-tx commit | ✅ CERTIFIED (atomic for C-1; cosmetic for C-2) |
| Audit retention period | ⚠ UNDOCUMENTED (must formalize SLA) |
| Proxy regression dropping `x-clerk-user-id` | ⚠ DEGRADES TO 401 (UX visible, not silent) |
| T2 topology breach (forged `x-clerk-user-id`) | ❌ ATTRIBUTION FALSIFIED |
| Stale-session window (org membership change post-JWT) | ❌ ATTRIBUTION CORRECT but role context stale |
| Cross-process restart | ✅ Postgres-durable (fire-and-forget T0 path has CRITICAL log on failure) |
| Forensic query 6 months later | ⚠ DEPENDS on retention SLA |
| Cryptographic provability | ❌ L4/L5 ABSENT |

**Disposition:** 🟡 **PARTIAL** — survives common operational scenarios; vulnerable to topology breach + stale session; lacks cryptographic provability.

---

## 11. Audit spine certification — final disposition

The audit spine is **CERTIFIABLE-IN-CONTRACT** at:

- ✅ L1+L2+atomic-with-mutation for the 4 C-1 handlers post-Lock-v2.
- ✅ Trace continuity within-process via in-memory ledger.
- ✅ Cursor-based SIEM export available.
- ✅ Tiered audit-write (T0/T1/T2) infrastructure mature.
- ✅ Anchoring schema columns exist (live pipeline UNVERIFIED — gate G6).
- ✅ Replay observability (correlationId-stamped, post-Lock-v2).
- ✅ Denied-path observability for Step-2+ denials.

The audit spine is **NOT CERTIFIABLE** at:

- ❌ L3 (anchored across DB compromise) — pipeline coverage UNVERIFIED for the 6 in-scope event types.
- ❌ L4 (per-row signature) — substrate absent.
- ❌ L5 (non-repudiable) — substrate absent; lexicon-forbidden phrase.
- ❌ Capture-replay prevention.
- ❌ Cross-actor replay defense.
- ❌ Pre-auth probe forensics.
- ❌ Cross-store lineage (in-memory ledger is intra-process).

**Aggregate certification:** 🟡 **CERTIFIABLE — CONDITIONAL** on:

1. Lock v2 + lexicon enforcement (gates G1–G4 from `w2-pr5a-legitimacy-boundary-report.md`).
2. payloadHash mandate on EVERY audit row (RG-Rec-2).
3. Audit retention SLA formalization (gate G7).
4. Anchoring pipeline verification (gate G6).
5. Audit-row schema doc published (`audit-row-schema.md`).
6. Replay observability runbook published (`replay-observability-runbook.md`).
7. Audit-spine invariants doc published (`audit-spine-invariants.md`).

When all 7 close, the audit spine transitions to **CERTIFIED-IN-IMPLEMENTATION.**

---

## 12. Closing principle (audit spine certification)

The operational audit spine is materially stronger than prior reviews surfaced. Pre-existing infrastructure (`appendAuditEvent`, `requireAuditBeforeResponse`, `exportAuditPage`, scrapbook bundle, dual-write to Postgres, tiered T0/T1/T2 write) provides L1+L2+atomic-coupling that this wave preserves and extends with correlationId-stamping + denied-path emission.

**The audit spine is the platform's most defensible runtime asset.** Lexicon enforcement keeps the wording from inflating the strength; certification gates G1–G7 close the operational boundary. When closed, the audit spine is genuinely operational-trust-grade at L1+L2+atomic — and explicitly NOT at L3+ until anchoring lands.

This is the honest framing. It is the certifiable framing. Anything beyond is forbidden by lexicon; anything less is understatement.

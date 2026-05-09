# Trust-Boundary Clarification

**Status:** **OPERATIONAL** — frozen reference for VitalCV trust-boundary semantics · **Date established:** 2026-05-08 · **Authority:** subordinate to `trust-class-taxonomy.md`, `runtime-trust-class-map.md`, `TRUST_GUARANTEE_LEXICON.md`

This doc explicitly distinguishes the lineage classes that operators conflate. It catalogs unsafe operator assumptions, runtime/UI mismatches, survivability inflation, and audit-strength inflation.

---

## 1. The 6 lineage types — explicit distinction

| Lineage type | Definition | Substrate |
|---|---|---|
| **L-T: Transactional** | Multiple writes commit-or-rollback together via `prisma.$transaction` | C-1 handlers |
| **L-E: Eventual** | Writes commit asynchronously; observability eventually but not synchronously | T0 fire-and-forget; outbox→worker; SEAL/learning |
| **L-RO: Replay-observable** | Replay attempts produce queryable audit signal | R0 events; correlationId-stamped |
| **L-RF: Replay-fragile** | Replay state is ambiguous OR detection requires forensic clustering | R-ACCEPTED state; capture-replay; long-window |
| **L-ED: Export-delayed** | Audit row commits sync but downstream export (SIEM, scrapbook) sees it later | EX-1 SIEM stream; scrapbook bundle |
| **L-DF: Denial-fragile** | Denied audit emission is regression-prone OR by-design absent (Step-1, Step-6) | D0 sub-classes |

---

## 2. Per-type clarification

### 2.1 L-T — Transactional lineage

**Promise:** mutation row + audit row + outbox row commit OR roll back together.

**Bounded by:** within-tx isolation (READ COMMITTED default). Pre-tx reads are NOT transactional. Post-commit side-effects are NOT transactional.

**Lexicon-aligned wording:** "atomic mutation+audit for the four C-1 handlers."

**Operator must NOT assume:**
- Pre-tx reads are atomic with tx writes (HCA-1).
- Side effects (SEAL, learning, recompute) are atomic (HCA-3).
- Cross-tx serialization (HCA-5).

### 2.2 L-E — Eventual lineage

**Promise:** writes will EVENTUALLY commit; failures may be silently logged.

**Bounded by:** in-memory volatility (T0); async dispatch reliability (worker, side effects).

**Lexicon-aligned wording:** "T0 fire-and-forget audit dual-write; eventually consistent."

**Operator must NOT assume:**
- T0 paths are equivalent to C-1 (MS-1).
- In-memory ledger entries persist across process restart unless dual-write fired.
- SEAL/learning capture failures roll back the mutation.

### 2.3 L-RO — Replay-observable lineage

**Promise:** replay attempts produce queryable audit signal via correlationId clustering.

**Bounded by:** TOCTOU race (best-effort dedup); 24h window cliff; correlationId determinism (client-controlled).

**Lexicon-aligned wording:** "replay observability + best-effort idempotency check via correlationId."

**Operator must NOT assume:**
- "Replay observability" means "replay prevention" (lexicon §1.3 forbidden phrase).
- Same `(actor, correlationId)` queries find ALL retries (TOCTOU race + fresh-correlationId evasion).

### 2.4 L-RF — Replay-fragile lineage

**Promise:** capture-replay + long-window + fingerprint-substitution attacks REQUIRE forensic clustering for detection.

**Bounded by:** payloadHash mandate (per ML-Rec-1 + DC-Rec-2); audit retention.

**Lexicon-aligned wording:** "capture-replay forensic detection via payloadHash; prevention NOT in scope."

**Operator must NOT assume:**
- R-ACCEPTED replays are visible from a single audit row (no marker).
- The platform defends against capture-replay (it doesn't — only detects post-hoc).

### 2.5 L-ED — Export-delayed lineage

**Promise:** audit row visible in EX-3 Postgres direct synchronously; visible in EX-1/EX-2 SIEM stream eventually (with DL-8 coverage gap for T2 writers).

**Bounded by:** DL-8 SIEM gap; cursor pagination semantics; audit retention sweep timing.

**Lexicon-aligned wording:** "EX-3 canonical for forensics; EX-1/EX-2 for streaming with documented coverage gap."

**Operator must NOT assume:**
- SIEM stream has every audit event (DL-8 / MS-2).
- Forensic queries see real-time state (eventual consistency for in-flight writes).

### 2.6 L-DF — Denial-fragile lineage

**Promise:** Step-2+ denials produce audit rows with `metadata.outcome: 'denied'` post-Lock-v2.

**Bounded by:** Step-1 + Step-6 silent BY DESIGN; F-4 regression risk (DC-4); SIEM coverage gap (DL-8) for T2 writers.

**Lexicon-aligned wording:** "denial emission for Step-2+ paths post-Lock-v2; pre-auth denials in web-layer logs only."

**Operator must NOT assume:**
- Every denied attempt has an audit row (Step-1 + Step-6 silent).
- Denial coverage is regression-proof (F-4 mitigated by test coverage + dashboard alerting).

---

## 3. Unsafe operator assumptions

Per `runtime-trust-class-map.md` §7 + this doc's §2:

| Assumption | Reality | Severity | Mitigation |
|---|---|---|---|
| "All audit-emitting paths are atomic" | T0 + C-2 + side-effects are NOT C-1 atomic | HIGH | This doc + trust-class-taxonomy |
| "SIEM stream has full audit coverage" | DL-8 SIEM coverage gap | HIGH | Operational runbook + EX-3 default |
| "Replay observability prevents replays" | Best-effort dedup; TOCTOU race | HIGH | Lexicon §1.3 forbidden phrase |
| "Capture-replay is mitigated" | Forensic detection only via payloadHash | HIGH | Lexicon + payloadHash mandate (ML-Rec-1) |
| "Stale-session JWT can't act" | JWT outlives session-revocation; deferred wave | MEDIUM | `AUTHORIZATION_BASELINE_V1.md` §5.1 |
| "Audit log is tamper-proof" | Tamper-EVIDENT given DB integrity (L2); L3 anchoring UNVERIFIED | HIGH | Lexicon §1.5 forbidden phrase |
| "Audit log is non-repudiable" | L4/L5 substrate absent | HIGH | Lexicon §1.1 forbidden phrase |
| "Pre-auth denials are audited" | Step-1 silent BY DESIGN | MEDIUM | Disclose explicitly |
| "C-2 audit means delivery succeeded" | PW-3 audit-vs-delivery divergence | HIGH | This doc + per-handler caveat |
| "Anchored audit is in production" | L3 pipeline UNVERIFIED for the 6 in-scope event types | HIGH | Gate G6 verification |

---

## 4. Runtime/UI mismatches (speculative — UI artifacts not attached)

Per `w2-pr5a-runtime-certification.md` Track A and `w2-pr2c-truth-alignment-governance.md` Track D:

| Surface | Possible UI claim | Runtime reality |
|---|---|---|
| Dossier showing "X verifications" | Audit-row count rendered as verifications | Audit rows record actor actions, NOT verifications |
| Autopilot "Auto-decision: ACCEPT" | Implied autonomous decision | Autopilot ranks; actor's click is the decision |
| Trust badge "T4 · Issuer-signed" | Implied live issuer signing | TRUST-PERSIST-1 (issuer signing persistence) IN PROGRESS |
| Share-packet "Cryptographically signed snapshot" | Implied platform signature | Manifest hashed; share-token random; issuer signing aspirational |
| Inbox "Refresh request sent" | Implied client receives notification | Outbox event written; downstream notification dispatch separate |
| Dashboard "Replay-protected" | Forbidden phrase per lexicon §1.3 | Replay observability + best-effort dedup |

**Inspection deferred** until UI artifact bundle is attached. Speculative; flagged for reviewer.

---

## 5. Survivability inflation patterns

| Inflation | Real claim | Severity |
|---|---|---|
| "Atomic mutation+audit" (unqualified) | Atomic for 4 C-1 handlers; cosmetic for 2 C-2; T0 paths NOT atomic | HIGH |
| "Tamper-proof audit log" | Tamper-EVIDENT given DB integrity (L2 only) | HIGH (lexicon §1.5) |
| "Non-repudiable mutation" | L5 substrate absent | HIGH (lexicon §1.1) |
| "Replay-protected" | Best-effort observability + dedup | HIGH (lexicon §1.3) |
| "Forensic-complete export" | EX-3 canonical; EX-1/EX-2 FRAGMENTED; EX-4 UNVERIFIED | MEDIUM |
| "Real-time SIEM forensics" | EX-1 streams in-memory; eventual; T2 writers bypass | MEDIUM |
| "Cross-tenant isolated" | Per-actor scoped; per-org tenancy DEFERRED | HIGH (per AUTHORIZATION_BASELINE_V1) |
| "End-to-end signed" | Audit row hashed; not signed; receipt signing in TRUST-PERSIST-1 | HIGH |

---

## 6. Audit-strength inflation patterns

Per `w2-pr3b-audit-strength-review.md` 5-level taxonomy (L1–L5):

| Inflation | Real audit-strength | Severity |
|---|---|---|
| "Cryptographically attested audit" | L1+L2 (recorded + tamper-evident given DB integrity); L4 ABSENT | HIGH (lexicon §1.2) |
| "Signed audit row" | L4 ABSENT | HIGH (lexicon §1.4) |
| "Anchored to external timestamp service" | L3 substrate exists (`anchored`, `merkleRoot` columns) but live pipeline UNVERIFIED | HIGH (gate G6) |
| "Provably consistent" | No formal proof; testable invariants only | HIGH (lexicon §1.7) |
| "Cryptographic chain of custody" | Hash-chain exists per row; cross-row chain is `referenceId` string-match | MEDIUM |
| "Trustless audit" | Platform IS the trusted intermediary | HIGH (lexicon §1.6) |

---

## 7. Lineage-type cross-coverage

A logical operation produces lineage in multiple types simultaneously:

```
accept request → 
   L-T transactional commit (audit + mutation + outbox in tx)
   + L-RO replay-observable (correlationId stamped)
   + L-DF denial-fragile (if denied, Step-2+ produces denial row)
   + L-E eventual (post-tx side effects fire-and-forget)
   + L-ED export-delayed (EX-1 SIEM lag; EX-3 sync)
```

**Track C finding TB-1:** a single operation spans 5 of the 6 lineage types. Operators must understand which type applies to which dimension of their query.

---

## 8. Operator decision tree

For an operator asking "is this audit row trustworthy for [X]?":

```
1. What class is the path? (per runtime-trust-class-map.md)
   - C-1 → atomic with mutation; trusted for transactional claims
   - C-2 → audit-as-persistence; delivery NOT atomic
   - T0 → fire-and-forget; partial-write possible
   - R0 → observability-grade for replay; NOT prevention
   - D0 → denial coverage post-Lock-v2; Step-1+Step-6 silent

2. What lineage type is the query? (per this doc)
   - L-T → trust within tx boundary only
   - L-E → expect eventual consistency
   - L-RO → trust for replay observability; NOT prevention
   - L-RF → forensic clustering required
   - L-ED → expect SIEM lag; use EX-3 for canonical
   - L-DF → check for regression (F-4)

3. Cross-check against:
   - audit-event-vocabulary-map.md (which alias?)
   - replay-taxonomy-map.md (which R-state?)
   - canonical-query-model.md (which Q-CANON template?)
   - TRUST_GUARANTEE_LEXICON.md (which forbidden phrases?)
```

---

## 9. Recommendations

| # | Recommendation | Priority |
|---|---|---|
| **TB-Rec-1** | Operational runbook explicitly enumerates the 10 unsafe assumptions in §3 | HIGH |
| **TB-Rec-2** | Dashboard widgets label which lineage type they query | MEDIUM |
| **TB-Rec-3** | Codex audit prompt scans PR descriptions for §5 + §6 inflation patterns | HIGH |
| **TB-Rec-4** | UI artifacts (when attached) audited against §4 speculative mismatches | HIGH (when artifacts attached) |
| **TB-Rec-5** | The operator decision tree (§8) becomes part of SOC onboarding | MEDIUM |

---

## 10. Closing principle (clarification)

Trust-boundary clarification is the discipline of NEVER conflating the 6 lineage types. The platform delivers honest, bounded guarantees — the risk is exclusively in describing-language drift OR operator-assumption drift.

**Operators reason about lineage type + trust class together. Dashboards label both. Codex audits verify wave PRs respect both. The lexicon enforces the wording.**

The boundary is clear. The clarification is durable. Survivability inflation is preventable IF the boundary is consulted before claims are made.

# Runtime Query Explainability — W2-PR8B Track D

**Wave:** W2-PR8B — Operational Trust Fabric Explainability
**Date:** 2026-05-08
**Status:** Review-only synthesis. No code changes, no merges.
**Risk class:** SAFE (read-only inventory).
**Companion to:** [operator-query-understanding](operator-query-understanding.md), [forensic-explainability](forensic-explainability.md), [trust-fabric-continuity](trust-fabric-continuity.md).
**Builds on:** [w2-pr6b-runtime-explainability-matrix](w2-pr6b-runtime-explainability-matrix.md), [w2-pr7b-runtime-semantics-cohesion](w2-pr7b-runtime-semantics-cohesion.md).

---

## What this track answers

If a runtime literal (`R-CAT-5`, `DENIED_MUTATION`, `decision_grade: false`, `unable_to_verify`) ends up in front of a SIEM analyst, an oncall operator, a customer-success rep, a regulator, or a future engineer who has never seen this codebase, **does it mean what it says it means, or does it require a glossary, a re-render, or a phone call?**

Runtime literals are the layer beneath the operator surface. They are what gets dumped into logs, exports, dashboards, alerts. If they are coherent and explainable in isolation, the system survives investigation. If they only make sense alongside the UI that produced them, the system is fragile under forensic load.

## Definitions

- **Runtime literal:** any string or enum that appears in a log line, audit row, replay envelope, or external export.
- **Canonical alias:** a literal that has been promoted to a typed contract; a banned-string list keeps it from being paraphrased.
- **SIEM export:** any output stream consumed by external security/compliance tooling (none today; the question is what *would* be exported).
- **Dashboard semantics:** the meaning of a metric or label rendered in an aggregated operator view.
- **Operationally survivable:** a literal that retains its meaning when read alone, without the surrounding UI.

## Runtime literal inventory

The literals that flow through audit rows, replay envelopes, and downstream data:

### Trust contract literals

| Literal | Type | Source | Survivable alone? |
|---|---|---|---|
| `'receipt_candidate'` | `proofTier` | [issuer-verification/receiptCandidate.ts](../../apps/web/lib/issuer-verification/receiptCandidate.ts) | 🟢 Self-describing |
| `'psv_receipt_candidate'` | `proofTier` | [issuer-verification/policyReview.ts](../../apps/web/lib/issuer-verification/policyReview.ts) | 🟢 Self-describing |
| `'psv_receipt'` | `proofTier` | [issuer-verification/psvReceipt.ts](../../apps/web/lib/issuer-verification/psvReceipt.ts) | 🟢 Self-describing |
| `false` (literal) | `decisionGrade` | issuer-verification/* | ⚠️ Boolean alone is opaque without `decisionGrade` field name |
| `'GREEN'` / `'YELLOW'` / `'RED'` | `TrustBand` | [packages/trust-state/contracts.ts](../../packages/trust-state/contracts.ts) | 🟡 Needs context to know "of what" |
| `'DECISION_GRADE'` / `'CHECKING'` / `'BLOCKED'` / `'PARTIAL'` | `ReadinessStatus` | [packages/trust-state/contracts.ts](../../packages/trust-state/contracts.ts) | 🟡 `DECISION_GRADE` reads as a noun, not a status |

### Audit event literals

| Literal | Family | Survivable alone? |
|---|---|---|
| `VERIFICATION_REQUESTED` / `VERIFICATION_COMPLETED` / `VERIFICATION_FAILED` | Verification lifecycle | 🟢 |
| `MONITORING_STATUS_CHANGE` | Monitoring | 🟢 |
| `ARTIFACT_VIEWED` / `ARTIFACT_EXPORTED` / `BUNDLE_GENERATED` | Artifact lifecycle | 🟢 |
| `EMPLOYER_REVIEW_ACCEPTED` / `..._REFRESH_REQUESTED` / `..._ROUTED_TO_REVIEW` / `..._MUTATION_DENIED` / `EMPLOYER_PACKET_SHARED` | Employer review | 🟢 |
| `APPLICATION_MISSING_INFO_REQUESTED` / `..._CLOSED` | Employer review | 🟢 |
| `RECOGNITION_EMITTED` / `ACCEPTANCE_EMITTED` / `START_EMITTED` / `START_ATTESTED` | Trust chain (wedge) | 🟡 Wedge-domain language; not obvious to reader without doc |
| `RATE_LIMIT_HIT` / `API_ERROR` / `VALIDATION_ERROR` / `TRUST_STATE_CHECK` | Operational | 🟢 |
| `RESEARCH_PUBMED_FETCHED` / `..._ORCID_LINKED` / `..._UNLINKED` / `..._TRIALS_FETCHED` / `..._SCORE_COMPUTED` / `..._DISCLOSURE_UPDATED` | Research identity | 🟢 |

### Runtime mutation literals

| Literal | Type | Survivable alone? |
|---|---|---|
| `'TRUST_ACCEPTANCE'` / `'TRUST_REFRESH_REQUEST'` / `'TRUST_REVIEW_ROUTING'` / `'TRUST_PACKET_EXPORT'` / `'TRUST_PACKET_SHARE'` / `'TRUST_START_ATTESTATION'` / `'DENIED_MUTATION'` / `'DOSSIER_REPLAY'` | `RuntimeMutationClassification` | 🟢 Eight self-describing nouns |
| `'R-CAT-1'` … `'R-CAT-6'` | `RuntimeReplayCategory` | 🔴 **Pure opaque code without lookup** |
| `'allowed'` / `'denied'` / `'replayed'` | `outcome` | 🟢 |
| `'human'` / `'system'` / `'unknown'` | `actorType` | 🟢 |
| `'x-clerk-user-id'` / `'system'` / `'unknown'` | `attributionSource` | 🟡 Header literal as attribution source is a leaky abstraction |
| `'denied-mutation'` / `'dossier-replay'` (`RuntimeMutationAction` strings) | Internal action keys | 🟡 Mostly redundant with classification, occasional split |

### Replay engine literals

| Literal | Type | Survivable alone? |
|---|---|---|
| `'VERIFIED'` / `'EXPIRED'` / `'NOT_FOUND'` / `'FAILED'` / `'PENDING'` | Source outcome | 🟢 |
| `'HIGH'` / `'MEDIUM'` / `'LOW'` | Source confidence | 🟢 |
| `'SYSTEM'` / `'ORGANIZATION'` / `'HUMAN'` / `'AI_AGENT'` | `VerifierIdentity.type` | 🟢 |
| `'CLINICIAN'` / `'CREDENTIAL'` / `'ISSUER'` / `'VERIFIER'` / `'DECISION'` | `AuthorityChainLink.nodeType` | 🟢 |
| `'HOLDS'` / `'ISSUED_BY'` / `'VERIFIED_BY'` / `'CONFIRMED_BY'` / `'PRODUCED'` | `AuthorityChainLink.edgeType` | 🟢 |

### Refusal vocabularies

| Literal | Source | Survivable alone? |
|---|---|---|
| `action_does_not_create_candidate` | issuer-side `refusalGate` | 🟢 |
| `wrong_office_cannot_create_candidate` | issuer-side | 🟢 |
| `unable_to_verify_cannot_create_candidate` | issuer-side | 🟢 |
| `conflict_review_unresolved` | issuer-side | 🟢 |
| `review_state_not_ready` | issuer-side | 🟡 Which state? Which review? |
| `legally_only_requires_limitation_note` | issuer-side | 🟢 |
| `already_accepted` | employer-side `denial_reason` | 🟢 |
| `passport_unavailable` | employer-side | 🟢 |
| `acceptance_blocked` | employer-side | 🟡 Reads as restatement of denial, not cause |
| `npi_mismatch` / `missing_acceptance` / `acceptance_npi_mismatch` | employer-side route variants | 🟢 |

### Persistence literals

| Literal | Source | Survivable alone? |
|---|---|---|
| `pending_not_written` | `eventState` default | 🟡 "pending" can read as a workflow state, not a durability state |
| `demo_not_persisted` | demo path | 🟢 |
| `defer_until_contract_aligned` | persistence default | 🟡 "contract" overloaded with "trust contract" |
| `recordedBy: 'demo'` | demo paths | 🟢 |

## Where runtime literals fail explainability

### 1. `R-CAT-1` … `R-CAT-6` — pure opaque codes 🔴

Six literal codes with no glossary in any audit row, replay envelope, log line, or operator surface. The mapping (R-CAT-1 = accept, R-CAT-5 = denial, R-CAT-6 = replay) lives in [runtimeTrustCohesion.ts:98-117](../../apps/api/backend/src/services/runtimeTrustCohesion.ts) and nowhere else.

A SIEM analyst reading `replayCategory: "R-CAT-5"` in a log dump cannot know what fired without source-code access. A regulator running grep for "denied" finds zero matches because the category is encoded.

**Severity: high.** This is the single most opaque literal in the runtime export shape.

**Mitigation in code:** the paired `mutationClassification` field is always self-describing (`'DENIED_MUTATION'`). A consumer reading both fields together can resolve the R-CAT code. A consumer reading the R-CAT code alone cannot.

**Recommendation if a small fix were in scope:** ship a static R-CAT → human label map alongside [runtimeTrustCohesion.ts](../../apps/api/backend/src/services/runtimeTrustCohesion.ts) and emit the human label in audit rows or expose it via `/api/replay-categories` for SIEM enrichment. (Not implemented in this wave per scope.)

### 2. Outer-vs-inner replay category 🔴

Per Track B finding #1: every replay envelope's outer `replayCategory` is unconditionally `R-CAT-6`; the inner recorded action carries the original R-CAT-1…5. A SIEM analyst aggregating on `replayMetadata.replayCategory` sees 100% R-CAT-6 once any replay traffic flows.

**Severity: high.** Combined with the opaque code (#1), this is a forensically misleading export shape.

### 3. `decision_grade: false` boolean alone is opaque 🟡

Stripped of its field name and context, `false` says nothing. The ban on bare `Verified` (per [CLAUDE.md](../../CLAUDE.md)) is a copy-side defense; the JSON-level defense rests on the field name being preserved through every export path.

**Severity: low** as long as the field name is preserved. **Severity: high** the moment any export flattens or projects.

### 4. `READY` (employer-side gate) vs `DECISION_GRADE` (trust-state literal) 🟡

The employer-review acceptance gate reads `PassportState.readiness === 'READY'` ([w2-pr7b-runtime-semantics-cohesion.md](w2-pr7b-runtime-semantics-cohesion.md)). The trust-state `ReadinessStatus` enum has `'DECISION_GRADE'`, not `'READY'`. The two are aligned today by a derivation function (`resolveLivePathReadinessStatus`), not by the same literal.

**Severity: medium.** A future widening of one without the other is a real risk. A SIEM analyst grepping logs for "READY" finds employer rows; for "DECISION_GRADE" finds trust-state rows; same operational meaning, no shared literal.

### 5. `unable_to_verify` is two distinct concepts in one literal 🟡

Per Track B ambiguity #3 and [w2-pr7b-operational-trust-continuity.md](w2-pr7b-operational-trust-continuity.md). A literal that means two different things across two different fields.

**Severity: low** at the typed-code level; **medium** at the export level if a consumer flattens to the literal.

### 6. Header-name in `attributionSource` is a leaky abstraction 🟡

`attributionSource: 'x-clerk-user-id'` exports the *transport* (an HTTP header name) into a *forensic record*. A future change to the auth header name (Clerk → custom JWT, header rename) creates a discontinuity in the audit record.

**Severity: low** today, increases over time. The audit record should describe *the identity* of the attribution (e.g., `'clerk_user'`), not the *transport* of it.

### 7. Wedge-domain literals (`RECOGNITION_EMITTED`, `ACCEPTANCE_EMITTED`, `START_EMITTED`, `START_ATTESTED`) 🟡

Domain-specific, not obvious without context. Not opaque per se, but a SIEM analyst seeing these in a log dump must consult the wedge-domain doc to interpret. Different from `EMPLOYER_REVIEW_ACCEPTED`, which is plain English.

**Severity: low.** The naming is correct for its domain; the gap is a glossary, not a rename.

## Dashboard semantics

The verifier dashboard ([verifierDashboardEngine.ts](../../apps/api/backend/src/services/verifierDashboardEngine.ts)) aggregates per-org metrics: `totalCredentials`, `activeCount`, `expiringSoonCount`, `psvWindowBreaches`, `avgDaysToVerification`, `revenueImpact`.

| Metric | Operationally explainable? |
|---|---|
| `totalCredentials` | 🟢 |
| `activeCount` | 🟡 — "active" needs a definition (stored where?) |
| `expiringSoonCount` | 🟡 — threshold not surfaced; "soon" needs a value |
| `psvWindowBreaches` | 🟡 — "PSV window" is internal vocabulary |
| `avgDaysToVerification` | 🟢 |
| `revenueImpact` | 🟠 — methodology hidden in code; a regulator asking "how is this computed?" gets the file path |

**Dashboard literals do not surface trust-fabric semantics.** No metric for "denials per reason," no metric for "replays performed," no metric for "audit-write durability rate," no metric for `unable_to_verify` issuer responses. The dashboard reflects a *credential-lifecycle* model, not a *trust-mutation* model.

## SIEM export shape (hypothetical)

There is no SIEM connector today (per Track A and the audit-replay route inventory). The question this track must answer is: *if* a SIEM forwarder were added tomorrow, would the runtime literals survive the trip?

| Survival check | Verdict |
|---|---|
| Field names preserved | 🟢 — JSON / NDJSON formats both preserve keys |
| Self-describing event types | 🟢 — 24 of 25 audit event types are plain English |
| Self-describing classifications | 🟢 — 8 of 8 `RuntimeMutationClassification` values |
| Self-describing replay categories | 🔴 — 6 of 6 R-CAT codes are opaque |
| Outer-vs-inner R-CAT distinction | 🔴 — without a parser that knows about nesting |
| Self-describing denials | ⚠️ — event type collapses three reasons |
| Self-describing refusals | ⚠️ — issuer-side `refusalGate` does not produce its own audit row |
| Self-describing actors | 🟡 — `'unknown'` is a silent fallback (Track B ambiguity #8) |
| Self-describing durability | 🟡 — `pending_not_written` reads as workflow state |
| Self-describing demo-vs-real | 🟢 — `recordedBy: 'demo'` is unambiguous |
| Hash + verification instructions in bundles | 🟢 |

A SIEM enrichment pipeline would need to ship a static lookup table for: R-CAT codes, denial reasons (since they are inside payload not type), issuer refusal gates (since they are not in audit rows at all), and `pending_not_written` vs `demo_not_persisted` durability copy. Without that table, **a SIEM analyst would read 100% of replays as R-CAT-6 dossier replays and 100% of denials as one event type.**

## Survivability under investigation

### Best-case: a single capsule audit bundle export

A capsule bundle with hash, verification instructions, NDJSON option, and self-describing schema URL. A motivated investigator with the bundle and basic JSON tooling can:

- Verify integrity (hash recomputation).
- Reconstruct evidence at decision time.
- Walk the authority chain.
- See actor identity (when known).
- Detect tamper.

🟢 **Operationally survivable.**

### Mid-case: an audit log dump from production logs

Audit-event rows with type and payload. An investigator can:

- See *that* a denial happened (`EMPLOYER_REVIEW_MUTATION_DENIED` is plain English).
- See *who* (actor in payload, when not `'unknown'`).
- See *when* (timestamps preserved).
- See *what category of action* (mutation classification self-describes).

But cannot, without source code access:

- Decode R-CAT codes.
- Distinguish outer vs inner replay category.
- Group denials by reason without payload introspection.
- Find issuer-side refusals at all.

🟡 **Partially survivable.**

### Worst-case: a single replay-envelope sample taken out of context

Outer envelope reads `replayCategory: 'R-CAT-6'`, `mutationClassification: 'DOSSIER_REPLAY'`. Inner action with the original mutation. An investigator who only sees the outer envelope reads "this is a replay" and stops. They miss that the original action was an acceptance, refresh, route, packet export, share, attestation, or denial.

🔴 **Not survivable in isolation.** Requires either the inner action or knowledge of the nesting to interpret.

## Verdict

**Runtime literals are mostly self-describing. The exceptions are concentrated and high-impact.**

24 of 25 audit event types speak plain English. 8 of 8 mutation classifications speak plain English. The hash, verification, and integrity vocabulary is self-describing. Demo-vs-real is structurally explicit.

The two failures are concentrated:

1. **R-CAT codes are opaque.** Six literals, six opaque codes. They appear in audit rows and replay envelopes. They have no glossary outside source code. Combined with the outer-vs-inner R-CAT-6 confusion, they are the single most forensically misleading export shape in the codebase.

2. **Denial granularity is collapsed at the event-type level.** Three reasons under one event type, with no compensating glossary at export.

Everything else is in the 🟡 band — explainable with field-name context, but vulnerable to flattening or projection that strips that context.

**No outright misleading dashboard semantics.** The verifier dashboard reflects credential lifecycle accurately; what's missing is a *trust-mutation* dashboard, not a deceptive credential-lifecycle one.

**No banned strings in runtime exports.** The doctrine-level anti-inflation gates ([CLAUDE.md](../../CLAUDE.md)) hold under runtime export — there is no `'automatically verified'`, `'guaranteed'`, `'certified compliant'`, etc., in any literal.

**Track D score: 🟡 PARTIAL.** Strongest export shape: per-capsule audit bundle. Weakest export shape: replay envelope with R-CAT codes. Most concentrated forensic risk: R-CAT-6 outer-envelope confusion combined with R-CAT opacity. **Runtime query explainability is high inside a capsule and inside a self-describing event type, and low when literals are projected without context.**

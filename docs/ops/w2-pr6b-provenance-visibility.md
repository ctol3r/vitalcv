# W2-PR6B - Provenance Visibility

**Wave:** W2-PR6B - Trust-State Runtime Explainability
**Date:** 2026-05-08
**Status:** Docs-only provenance, replay, audit, and mutation visibility review. No product code changed. No merge.
**Risk class:** SAFE.
**Purpose:** Determine whether a clinician, verifier, or employer can see *where* trust signals came from, *when* they were observed, *what proves they happened*, and *what changed* — without inferring a guarantee the runtime does not deliver.

## Scope

Four cross-cutting visibility planes:

1. **Provenance** — source identity, lane, freshness, decision-grade gating, evidence linkage.
2. **Replay** — what is replayable, what is reconstructable, and what (if anything) is replay-attack-protected.
3. **Audit** — what is recorded, what is queryable, what surfaces to operators.
4. **Mutation** — when state changes, where the change is visible.

Anchors:
- `apps/web/components/trust/{SourceCoverageTag,SourceCoverageRow,EvidenceDisclosureCard,PassportSourceCoveragePanel}.tsx`
- `packages/trust-state/{sourceCoverage,sourceHealth,artifactValidation}.ts`
- `apps/api/backend/src/services/audit/{replayEngine,auditLedger}.ts`
- `apps/api/backend/src/services/runtimeTrustCohesion.ts`
- `apps/api/backend/src/types/auditEventTypes.ts`
- `apps/web/lib/issuer-verification/statusCopy.ts`
- `apps/web/components/{AuditTimeline,trust-state/AuditTrailTimeline}.tsx`

## 1. Provenance plane — 🟢 CLEAR (mostly)

### Source identity and freshness

`apps/web/components/trust/SourceCoverageTag.tsx:102-117`:

- Inline tag renders source label + state badge + relative timestamp via `formatRelativeTime`.
- Tooltip exposes absolute ISO timestamp via `title` attribute.
- States surfaced: `Decision grade`, `Checked`, `Pending`, `Stale`, `Access required`, `Review required`, `Unavailable`, `Preview only`.

| Criterion | Verdict |
|---|---|
| Named | 🟢 |
| Grounded | 🟢 — source label always shown. |
| Bounded | 🟢 — only `checked` triggers `Decision grade` badge. |
| Recoverable | 🟡 — operator must click into source detail to learn what to do; tag itself does not link. |

### Lane-level detail

`apps/web/components/trust/SourceCoverageRow.tsx:50-77` — per-lane row:

- Source ID + decision-grade badge + status descriptor + reason + `Checked [date]` or `Not yet checked`.
- Evidence linkage when artifact id is present.

**Single ambiguity:** `Not yet checked` does not distinguish:
- `Pending` — scheduled, in flight;
- `Not scheduled` — not part of this readiness flow;
- `Failed` — attempted, returned an error;
- `Never attempted` — adapter not configured.

Recommend three replacement labels: `Pending`, `Not scheduled for this snapshot`, `Last attempt failed`.

### Coverage state semantics

`packages/trust-state/sourceCoverage.ts` defines the nine `CanonicalSourceCoverageState` values. `sourceCoverageBadgeLabel()` maps `checked + decisionGrade=true` → `Decision grade`, otherwise `Checked` or the literal state label. The mapping is deterministic and the labels are unambiguous.

**Verdict:** 🟢 CLEAR. Provenance is the strongest plane in the codebase. Single 🟡 sub-gap on `Not yet checked` granularity.

## 2. Replay plane — 🔴 MISLEADING

### What `replayEngine.ts` actually does

`apps/api/backend/src/services/audit/replayEngine.ts`:

- Reconstructs evidence state from stored artifacts.
- Verifies hash match (`storedHash` vs `recomputedHash`).
- Builds authority chain: `CLINICIAN → CREDENTIAL → ISSUER → VERIFIER → DECISION`.
- Returns deterministic replay metadata (correlation ID, fingerprint).

**What it does NOT do:**

- No nonce, jti, or idempotency-token enforcement (grep over the audit service: 0 hits).
- No signature-based replay prevention (only hash comparison).
- No anti-replay attack protection — the engine **audits** replay, it does not **prevent** it.

The module name `replayEngine` and its docstring ("Deterministic replay of events") imply a stronger guarantee than the runtime delivers. A verifier reading the surface name might conclude replay-attack protection exists; it does not.

### What UX copy says

| Surface | Copy | Verdict |
|---|---|---|
| `apps/web/lib/issuer-verification/statusCopy.ts` | *"May be included in timeline replay for context. Replay-safe does not mean legal proof and does not change any claim truth tier."* | 🟢 — correctly disclaims protection. |
| `apps/web/app/_archive/wave119/intake/IntakeContent.tsx` | *"All decisions are timestamped and replayable"* (title attribute) | 🔴 — implies protection. (Archive scope; verify no live re-import.) |
| Test file `apps/web/__tests__/issuer-audit-persistence.test.ts` | *"replay-safe is not legal proof — disclaimer and copy both call this out"* | 🟢 — the test itself documents the gap that required disclaimer copy to exist. |

The two readings are not formally contradictory if "replayable" is read as "deterministically reconstructable". They *are* contradictory in the eyes of a non-engineer. Per W2-PR3C autopilot-language review patterns, ambiguity at this distance is a misleading surface.

### `runtimeTrustCohesion.ts` — name vs. behavior

The module exports `RuntimeMutationClassification` (8 values) and `RuntimeReplayCategory` (`R-CAT-1` through `R-CAT-6`). `buildRuntimeMutationMetadata()`:

- redacts sensitive payload keys (`npi`, `clinicianNpi`, `subjectNpi`, `notes`, `message`, `shareToken`, `shareUrl`, `token`);
- emits SHA-256 `payloadHash` and `mutationFingerprint`;
- tags outcome as `'allowed' | 'denied' | 'replayed'`;
- normalizes action to one of 8 classifications.

**Operationally:** clean fingerprint generator + classifier. Useful for audit replay correlation.

**Misleading:** the *name* `runtimeTrustCohesion` implies cross-mutation cohesion enforcement. The module does not enforce or validate cohesion — it only fingerprints. There is no state-machine consistency check, no cross-mutation validation, no rejection path on incoherent state. A reader skimming the module name could conclude runtime trust is being validated; it is being *recorded*.

**Verdict:** 🔴 MISLEADING. **Recommended single fix:** rename the module or add a one-line module docstring: *"Generates fingerprints and replay categories for mutation audit. Does not enforce cohesion."*

## 3. Audit plane — 🟡 PARTIAL

### Event type schema

`apps/api/backend/src/types/auditEventTypes.ts:1-69`:

- `OperationalEventType` includes `TRUST_STATE_CHECK`. ✅
- `TRUST_STATE_DECAY` is **not** in the union — only exists as a string literal in `TrustStateResolver.ts:481-494` and in tests. The compiler does not enforce schema for decay events.

**Implication:** decay event metadata is whatever the resolver writes. A future field rename would not be caught by typecheck. Add `TRUST_STATE_DECAY` to the canonical union as a structural fix; this is a one-line change with zero behavior delta.

### Ledger write path

`apps/api/backend/src/services/audit/auditLedger.ts:20-35`:

- `AuditCategory` includes `'TRUST_STATE_CHANGE'` and `'READINESS_CHANGE'`.
- Records: `eventId`, `time`, `traceId`, `actor`, `resource`.
- No `audit_ref` / `audit_packet_id` field at the ledger layer — the resolver fabricates `audit_ref` from the ledger's returned `eventId`.

### Read path / UI

| Surface | Source | Verdict |
|---|---|---|
| `apps/web/components/AuditTimeline.tsx` | Local `TimelineEvent` type with `'DECAYED'` literal | 🟠 Decoupled from backend `AuditEventType` — a label drift on either side will not break the build. |
| `apps/web/components/trust-state/AuditTrailTimeline.tsx` | Local `AuditEvent` type, `'DECAYED'` literal | 🟠 Same decoupling. |
| `apps/api/backend/src/routes/trustStateEngine.ts` | Returns `audit_packet_id: auditEntry.eventId` to caller | 🟢 At the API boundary. |

**Operator-facing query:** there is no UI route that fetches a clinician's decay history end-to-end. `audit_packet_id` is returned by the resolver but no UI consumes it. The mock timelines render plausible data; a clinician cannot click through from passport → decay event → resolver run → blocking_reason.

### Critical questions

| # | Question | Answer |
|---|---|---|
| 1 | Is `audit_packet_id` queryable by the operator? | 🟠 NO. Returned by API; not consumed by UI. |
| 2 | Can a clinician see "your trust band dropped from GREEN to RED on 2026-04-29 because receipt X expired"? | 🔴 NO. Decay events are written; UI shows mock data. |
| 3 | Is `TRUST_STATE_DECAY` schema-enforced? | 🔴 NO. String literal only. |
| 4 | Does the audit timeline copy imply more guarantees than the ledger delivers? | 🟡 PARTIAL. Mock UI shows decay icons that are not wired to actual events. |

**Verdict:** 🟡 PARTIAL. The ledger is honest about what it stores; the UI is decoupled and does not yet show what the ledger knows.

## 4. Mutation plane — 🟠 AMBIGUOUS

### What is recorded

`runtimeTrustCohesion.ts` (covered above) emits per-mutation metadata: classification, replay category, payload hash, fingerprint, actor attribution, readonly indicator, denial reason. This is *good telemetry*.

### What is visible

There is **no UI surface** that renders mutation history to a clinician or verifier. No component named `*mutation*`, no `change-history` route, no decay narrative panel.

`TRUST_STATE_DECAY` events:

- written by `TrustStateResolver.ts:481-494`;
- published with `WARNING` severity in `routes/trustStateEngine.ts`;
- visible in tests (`silentPilot.e2e.test.ts`);
- **not** rendered by any operator-facing component.

### Critical questions

| # | Question | Answer |
|---|---|---|
| 1 | Can an operator see when a clinician's trust band changed and why? | 🔴 NO. Logged internally. |
| 2 | Can a verifier read the mutation fingerprint to correlate two events? | 🟡 PARTIAL. Persisted in audit metadata; not surfaced. |
| 3 | Are denied mutations explainable to the actor? | 🟡 `denialReason` is in `RuntimeTrustMetadata`; rendering varies by route. |
| 4 | Can a clinician see redacted-vs-cleartext for their own data? | 🟢 Redaction set is principled (`SENSITIVE_PAYLOAD_KEYS` covers NPI, notes, share tokens). |

**Verdict:** 🟠 AMBIGUOUS. The mutation plane records honestly and redacts honestly; nothing is misrepresented. It also does not surface what it records, so operators may underestimate what is auditable.

## Banned-string scan

Per CLAUDE.md, no copy may contain the following except as test split-join constants. Scan over `apps/web/components` and `apps/web/app`:

| String | Hits | Status |
|---|---|---|
| `automatically verified` | 0 | 🟢 |
| `guaranteed verification` | 0 | 🟢 |
| `complete credentialing` | 0 | 🟢 |
| `instant credentialing` | 0 | 🟢 |
| `legally accepted` | 0 | 🟢 |
| `risk transferred` | 0 | 🟢 |
| `final verification without review` | 0 | 🟢 |
| `source confirmed before response` | 0 | 🟢 |
| `certified compliant` | 0 | 🟢 |
| `HIPAA compliant` | 0 | 🟢 |
| `SOC2 certified` | 0 | 🟢 |

✅ No banned-string drift in live surfaces.

## Status page (DOCS-STATUS-1) sanity check

`apps/web/app/status/page.tsx`:

- L15, L12: *"Status surfaces are foundation previews. No uptime guarantee is implied."*
- L18-19: *"This report is a foundation shape for vendor risk assessments. It reflects planned controls, not enforced production policies."*
- L51-56 invariants: `uptimeGuaranteeImplied: false`, `productionStatusPageLive: false`.

Every section is hedged. No hidden production claim. 🟢 CLEAR. (Sub-gap: per-section "foundation shape" reminders would help readers who skim past the global header — not blocking.)

## Issuer-verification truth contract sanity check

| Clause | Verdict |
|---|---|
| `decisionGrade: false` literal on `ReceiptCandidate` | 🟢 enforced. |
| `proofTier: 'receipt_candidate'` literal | 🟢 enforced. |
| `decisionGrade: false` literal on `PSVReceiptCandidate` | 🟢 enforced. |
| `proofTier: 'psv_receipt_candidate'` literal | 🟢 enforced. |
| Five-gate refusal sequence in `policyReview.ts:67-122` | 🟢 enforced. |
| `legally_only` requires `limitationNote` | 🟢 enforced. |
| Demo surfaces label `recordedBy: 'demo'` | 🟢 honored. |
| `issuerSurfaceFactory.ts` (untracked) demo fixtures | 🟢 isolated; no production artifact linkage. |

**Verdict:** 🟢 CLEAR at the type and contract layer. UI cannot promote a receipt-candidate to a PSV without passing the gates. No bypass surface exists.

## Critical questions — answers

| # | Question | Answer |
|---|---|---|
| 1 | Would replay telemetry imply replay prevention? | 🔴 YES — `replayEngine` name + "replayable" copy mix without grounding. |
| 2 | Would provenance semantics imply certification? | 🟢 NO — banned-string scan clean; "Decision grade" badge gates positive wording. |
| 3 | Would a verifier overestimate audit guarantees? | 🟠 PARTIAL — `audit_packet_id` returned but UI uses mock timelines. |
| 4 | Would mutation visibility be inferred where none exists? | 🟠 PARTIAL — no UI surface, but no surface implies one either. |
| 5 | Are sensitive payload fields redacted before audit storage? | 🟢 YES — explicit SENSITIVE_PAYLOAD_KEYS set. |
| 6 | Is `TRUST_STATE_DECAY` schema-enforced end-to-end? | 🔴 NO — string-literal in resolver, not in canonical event union. |

## Required runtime alignment (no implementation in this wave)

A safe follow-up product PR — **not in scope here** — would:

1. Rename `runtimeTrustCohesion` module or add a one-line module docstring clarifying that it generates fingerprints, not cohesion validation.
2. Add `TRUST_STATE_DECAY` to the `OperationalEventType` union in `auditEventTypes.ts` and replace the string literal in `TrustStateResolver.ts:481-494` with the typed enum.
3. Wire a minimal `audit_packet_id` lookup endpoint and a single passport timeline component that renders real decay events instead of mock data.
4. Replace local `'DECAYED'` enums in `AuditTimeline.tsx` and `AuditTrailTimeline.tsx` with imports from the backend canonical event types.
5. Disambiguate `Not yet checked` in `SourceCoverageRow` (`Pending` / `Not scheduled` / `Last attempt failed`).
6. Audit `apps/web/app/_archive` for any "replayable" copy that may re-import; replace with the explicit `Replay-safe does not mean legal proof` disclaimer pattern.

None of (1)-(6) requires backend persistence beyond what the ledger already records. None alters the resolver, the truth contract, or any band threshold.

## Honesty assessment

**Artifact alignment:** SAFE. This document does not change any contract, copy, or runtime behavior.

**Runtime alignment:**
- **Provenance plane:** 🟢 CLEAR.
- **Replay plane:** 🔴 MISLEADING (engine name + ambiguous copy).
- **Audit plane:** 🟡 PARTIAL (ledger honest, UI decoupled).
- **Mutation plane:** 🟠 AMBIGUOUS (recorded; not visible).

The runtime records more than it shows, and what it shows is not yet end-to-end traceable. The ambiguity is on naming and surfacing, not on truth — every plane *records honestly* and *redacts honestly*. The repairs are local renames, schema additions, and small UI wiring tasks.

## See also

- `w2-pr6b-trust-state-explainability.md`
- `w2-pr6b-confidence-runtime-alignment.md`
- `w2-pr6b-readiness-runtime-alignment.md`
- `w2-pr6b-runtime-explainability-matrix.md`
- `w2-pr4a-replay-normalization.md`, `w2-pr4a-audit-normalization.md`, `w2-pr4a-runtime-cohesion.md`
- `w2-pr4c-dossier-provenance.md`

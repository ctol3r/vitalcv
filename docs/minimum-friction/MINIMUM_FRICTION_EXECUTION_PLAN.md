# Minimum Friction — Execution Plan

**Program:** Minimum Friction (MF-WAVE-00, research/architecture only)
**Baseline:** `origin/main` @ `df0ff184c2da9fbc8cfaf73f26e1928188113e61` (2026-08-16)
**Status:** Research deliverable. This plan proposes MF-WAVE-01 and Demo-0; **it does not begin
them.** Per the STOP condition, no runtime is built in this wave.

> **DESIGN-ONLY BOUNDARY** applies. This plan strengthens the live transaction loop
> (real clinician → integrated employer role → Apply with VitalCV → exact packet → canonical
> employer decision → hire-to-start → start → second move); it never postpones it.

---

## 1. The cheapest first experiment — Demo-0

**Goal:** prove the whole thesis from **fixtures and pure logic, with no migration and no runtime**,
by composing primitives that already exist. Demo-0 is a headless test + a small pure module, run as
a vitest suite. It does not touch a route, a schema, or the UI.

### Demo-0 inputs (all synthetic fixtures)

```
ONE synthetic clinician         → synthetic:clinician:* (never a real NPI — memory: NPIs name real people)
+ NPI-seeded state              → fixture PersonProfile-shaped object (name/specialty/state)
+ ONE CV artifact               → fixture parse output → CandidateClaim[] (INFERRED)
+ ONE conflict                  → CV says "Stanford fellowship 2019–2021"; source state says 2020–2021
+ ONE target opportunity        → fixture TrustSpec 0.1 (uses the LANDED validator)
+ existing evidence             → fixture EvidenceObject[] (some decision-grade, some stale)
+ question candidates           → the eliminable-question list (USER_JOURNEY §0)
+ friction objective            → lexicographic profile (OPTIMIZATION §3), pure comparator
+ ONE highest-leverage confirm  → "confirm fellowship dates" resolves the conflict AND satisfies 2 reqs
+ purpose-bound share preview   → minimum evidence set for recipient+purpose, revealed but not sent
```

### Demo-0 must prove (the seven properties, each an assertion)

1. **Starts from what it already knows** — the plan begins with the NPPES-seeded fixture, not an
   empty profile. *Assert:* ≥1 requirement is already `SATISFIED` from seeded state with zero
   clinician actions.
2. **AI proposes but cannot verify** — the CV facts enter as `INFERRED` candidates. *Assert:* no
   candidate reaches `VERIFIED`; confirmation yields `USER_ENTERED`, a distinct state.
3. **One confirmation resolves multiple dependencies** — confirming fellowship dates clears the
   conflict and satisfies 2 requirements. *Assert:* the single action's deterministic leverage = 2
   (+1 conflict resolved).
4. **The planner selects that question because it eliminates the most necessary work** — *Assert:*
   the lexicographic objective ranks "confirm dates" above all other candidate actions, and the
   choice is reproducible (lexical-id tiebreak).
5. **Sensitive info not required for the goal is never requested** — the fixture opportunity does
   not require SSN/DOB/visa; *Assert:* the plan's `sensitiveAttributesCollected` = 0 and no such
   field appears in the ask set.
6. **Share preview contains only required authorized evidence** — *Assert:* the minimum evidence set
   ⊆ requirement-relevant evidence, and excludes unrelated personal fields.
7. **No data is shared without explicit authorization** — *Assert:* the preview computes but emits
   nothing; a share requires an explicit authorize step, and the four zero-invariants hold
   (`FALSE_TRUTH_PROMOTION=0`, `UNAUTHORIZED_DISCLOSURE=0`, `CROSS_RECIPIENT_CONSENT_REUSE=0`,
   `UNKNOWN_TO_SATISFIED=0`).

### Why Demo-0 is cheap and safe

- **No migration.** Everything is a fixture; the `satisfies` dependency it needs is *fixtured*, not
  computed (the real dependency index is NEW-PTC).
- **Reuses landed code.** It calls the shipped `validateTrustSpec()` (TrustSpec 0.1) and the shipped
  `detectGaps()`/`projectReadiness()` on fixture evidence.
- **Pure.** No fetch, no DB, no clock (inject time). Runs in CI as a normal vitest suite.
- **It is the friction benchmark's MF010 + MF006 + MF014 fixtures made concrete** (§3).

### Likely files for Demo-0 (proposed, not created)

```
packages/domain-evidence/src/minimum-friction/
  frictionVector.ts          # the FrictionVector type + null-aware comparators (pure)
  objectiveProfile.ts        # lexicographic ordering over valid plans (pure)
  questionAdmission.ts       # the deterministic ask-rule as a pure predicate
  disclosureAdmission.ts     # the deterministic share-rule as a pure predicate
  fixtures/mf-demo0.ts        # the synthetic clinician + CV + conflict + opportunity
  minimumFriction.demo0.test.ts   # the seven-property assertions + four zero-invariants
```

This lives in `@vitalcv/domain-evidence` (where TrustSpec lives) — **no new package** (PTC rule).

---

## 2. Proposed MF-WAVE-01 (and ONLY MF-WAVE-01)

Per the STOP condition, exactly one wave is proposed. Two candidate scopes; the plan recommends the
first because it is pure and unblocks measurement, and the second is a security-hardening dependency
that should run in parallel as its own PR.

### MF-WAVE-01 (recommended): Friction measurement baseline + Demo-0

- Build the pure modules in §1 (`frictionVector`, `objectiveProfile`, the two gates) and the Demo-0
  suite. Documentation-plus-fixtures-plus-pure-logic; no route, no schema, no UI.
- Add **friction telemetry definitions** (thesis §29) as types + a pure recorder, wired to the
  existing disciplined funnel (`apps/web/lib/analytics/funnel.ts`) — stage-only, **no PII** (the
  funnel's own pinned allowlist forbids NPI/name/credential).
- Deliverable: a reproducible measurement of first-move friction on the synthetic fixtures, and the
  objective profile proven to select the highest-leverage action. This is thesis execution step
  MF-01, and it makes every later claim ("friction fell") measurable rather than asserted.

### Parallel, separate PR (not MF-WAVE-01, but a dependency): share-path hardening

The SECURITY §1 findings are a **hardening backlog item to remediate before** any wave that adds
self-serve NPI verification (because that opens the SSRF gate). Ordered in SECURITY §1.6. This is a
security PR, owned by the security lane, not a Minimum Friction feature PR. Flag it now; do not fold
it into MF-WAVE-01.

**Do NOT begin either until a founder GO.** This wave stops at documentation.

---

## 3. Friction benchmark fixtures (MF001–MF015)

Synthetic, decision-shaped fixtures. Metrics per fixture: clinician actions · fields typed ·
documents uploaded · sensitive attributes collected · disclosed attributes · source calls ·
deterministic requirements resolved · false-truth promotions · unauthorized-disclosure attempts.

| Fixture | Proves |
|---|---|
| MF001_NPI_ONLY | starts from NPPES-seeded state; 0 typed fields for known facts |
| MF002_NPI_PLUS_CV | CV facts enter as candidates; confirmation ≠ verification |
| MF003_STALE_LICENSE | staleness triggers refresh, not a re-ask |
| MF004_CONFLICTING_EMPLOYMENT | conflict → review, never silent selection |
| MF005_TWO_JOBS_SHARED_REQUIREMENTS | one evidence set satisfies overlapping requirements |
| MF006_SENSITIVE_FIELD_NOT_REQUIRED | sensitive attr not required → never requested (`sensitiveAttributesCollected=0`) |
| MF007_STEP_UP_ONLY_AT_SHARE | assurance rises only at the consequential action |
| MF008_EXISTING_CONSENT_WRONG_RECIPIENT | consent never reused across recipients (`CROSS_RECIPIENT_CONSENT_REUSE=0`) |
| MF009_AI_INFERENCE_CANNOT_VERIFY | INFERRED → VERIFIED is impossible |
| MF010_ONE_ANSWER_UNLOCKS_MULTIPLE_REQUIREMENTS | leverage math; the Demo-0 core |
| MF011_SOURCE_CAN_REPLACE_DOCUMENT_UPLOAD | source read replaces an upload ask |
| MF012_SECOND_EMPLOYER_REUSES_STATE | second-move deltas positive (Q20) |
| MF013_POLICY_CHANGE_INVALIDATES_ONE_DEPENDENCY | incremental recompute touches only the affected dependency |
| MF014_DISCLOSURE_PROOF_BEATS_RAW_DATA | a proof/result satisfies instead of raw underlying data |
| MF015_UNKNOWN_MUST_NOT_AUTO_FILL | unknown stays unknown (`UNKNOWN_TO_SATISFIED=0`) |

**Four zero-invariants, asserted across every fixture:**
`FALSE_TRUTH_PROMOTION = 0` · `UNAUTHORIZED_DISCLOSURE = 0` · `CROSS_RECIPIENT_CONSENT_REUSE = 0` ·
`UNKNOWN_TO_SATISFIED = 0`.

---

## 4. Tests

- **Demo-0 suite** (§1) — the seven properties + four zero-invariants, pure vitest.
- **Fixture conformance** — each MF00x fixture asserts its named property and the four invariants,
  in the style of the existing `trustSpecValidation.ts` exact-set fixtures (a retired rule turns its
  fixture red).
- **No new integration test is required for MF-WAVE-01** (nothing hits a DB or route). The
  share-path hardening PR carries its own integration test (the `EmployerWebhookConfig` field
  mismatch needs one live-DB assertion per SECURITY §1.3).

## 5. Migrations

**None in MF-WAVE-00 or MF-WAVE-01.** The two fields the AI-quarantine contract eventually needs
(model-id, source-passage on candidates) are a *later* wave's migration, not this one. Wiring the
dead consent-enforcement columns (`ConsentGrant.revokedAt`, `validUntil`) is also later and is a
*wiring* task, not a schema change (the columns already exist).

## 6. DO NOT BUILD (MF-WAVE-00 and the boundary for all MF waves)

- ❌ production runtime implementation (this wave)
- ❌ a new database, graph database, or second graph
- ❌ a second optimizer (extend the PTC `MINIMUM_ACTION_COUNT` engine as an objective *profile*)
- ❌ a new general AI agent / agent framework
- ❌ blockchain, ZK, a new wallet architecture, a new employer portal
- ❌ autonomous applying, production background surveillance
- ❌ a new provenance enum or a new `ConsentReceipt`/candidate model (extend `provenance.ts`,
  `CandidateCredential`/`ClaimRecord`, `ApplicationPacket`/`ConsentGrant`)
- ❌ new public claims; any HIPAA/SOC2/ASVS/NIST **compliance claim** (banned strings)
- ❌ patent/novelty claims
- ❌ broad schema migration; a new data source added merely for this research
- ❌ LLM policy ingestion (PTC marks it `DO_NOT_BUILD`; human-reviewed typed fixtures only)

## 7. Exact likely files touched, when MF-WAVE-01 is authorized

```
packages/domain-evidence/src/minimum-friction/*        # new pure modules + fixtures (see §1)
apps/web/lib/analytics/frictionTelemetry.ts            # types + pure recorder (stage-only, no PII)
docs/minimum-friction/*                                # these six docs (this wave)
```

No changes to: `apps/api/backend/src/routes/*`, any `schema.prisma`, `apps/web/app/**` UI, or any
`components/**`. If a proposed step needs one of those, it is a product dependency to record and
stop (DESIGN-ONLY BOUNDARY).

---

## 8. Q1–Q20 — explicit answers

1. **Real new layer or objective profile?** Objective **profile** + two thin gates over existing
   systems. Not a subsystem. (ARCHITECTURE §0)
2. **Which model represents AI candidate claims?** `CandidateCredential` (thin) / `ClaimRecord`
   (rich). Extend; do not add. (SECURITY §2.1)
3. **How does candidate state stay separate from source-backed truth?** Already structurally
   separate (candidate writes never touch `PersonProfile`); the leak is *downstream reads*
   (`opportunityTruth.ts:1428`). (SECURITY §2.0)
4. **How does confirmation change provenance without becoming verification?** `INFERRED` →
   `USER_ENTERED`/attested — a distinct state, never `VERIFIED`. (USER_JOURNEY §2)
5. **Career Graph backlinks without another graph?** Yes for provenance/what-was-shared; `satisfies`
   is a gap owned by PTC, not a new graph. (ARCHITECTURE §5)
6. **What edge/provenance metadata is genuinely missing?** `satisfies` edge; candidate model-id +
   source-passage; persisted per-field provenance. (ARCHITECTURE §2)
7. **What exact current questions can VitalCV eliminate?** The ranked list — profession, NPI
   re-entry, work-auth ×5, specialty, licenses, states, contact, years, cover note. (USER_JOURNEY §0)
8. **What data does VitalCV collect today that it could avoid?** Duplicated NPI/work-auth/specialty
   asks; `ProfileCompletionPanel` pre-selecting `'authorized'` work-auth; MATCHA `greenCardStatus`/
   `military` (not engine-backed). (USER_JOURNEY §0; SECURITY notes protected-class defaults)
9. **What current disclosures can be narrowed?** Convert the live `/` widget to the sealed
   field-scoped packet; fix `selectiveClaims` so a subset actually shares a subset. (SECURITY §1.5b)
10. **Which action should first require step-up?** Editing an identity-critical fact (name / NPI
    target) — today gated only at A1/A2. Build a real step-up (passkey) that reaches the server.
    (SECURITY §3)
11. **Narrowest useful live data-classification seam?** Structured logs on the share path — generalize
    the existing payload-free audit-log discipline via `deriveHandlingDecision`. (SECURITY §4)
12. **Can current consent/share/packet models implement purpose-bound authorization?** Representable
    on the sealed path (~7½/10); not *enforced* (revocation/expiry dead); the live path is weaker.
    Converge + wire, don't add. (SECURITY §5)
13. **SSRF / signing-secret risk in Apply-with-VitalCV?** Yes — traced. Authenticated, admin-gated,
    blind SSRF via client `callback_url`; predictable `'vcv-default-secret'` fallback; HTTP accepted;
    the "safe" `EmployerWebhookConfig` path is dead code (field mismatch under `@ts-nocheck`). P1
    with a P0 trajectory once self-serve verification ships. (SECURITY §1 — flagged for separate
    remediation)
14. **Can the Trust Optimizer do minimum-clinician-action planning without a second optimizer?** Yes
    — `MINIMUM_ACTION_COUNT` over an owner-filtered action space *is* that; parameterize the objective
    at the (as-yet-unwritten) optimizer signature. (OPTIMIZATION §0)
15. **Smallest "One Thing" demo?** The MF010 fixture: one confirmation whose deterministic leverage is
    provably >1, selected by the objective, with a traversable "Why this?". (USER_JOURNEY §3; §1)
16. **Smallest precomputed-application demo?** The preflight partition over one fixture opportunity,
    computing the minimum evidence set and irreducible questions, sharing nothing. (USER_JOURNEY §4)
17. **How does dependency analysis prevent unnecessary requests?** Once `satisfies` exists, the
    Question Admission Gate proves a fact is already covered and suppresses the ask. (ARCHITECTURE §5)
18. **What should VitalCV maintain automatically?** Source refresh, derived-state recompute,
    stale-projection expiry, preflight/preview prep — all `owner=vitalcv`. (USER_JOURNEY §5)
19. **Which actions must always remain human-authorized?** Share private evidence, attest a fact,
    resolve a factual conflict, employer accept, confirm first day, delete source truth.
    (ARCHITECTURE §5; thesis §23)
20. **How will we prove the second move is easier than the first?** Friction telemetry per second
    move: fields not re-entered, evidence not re-collected, source queries avoided, documents not
    re-uploaded, time delta — measured, with zero/unknown valid. (USER_JOURNEY §6)

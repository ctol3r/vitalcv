# Runtime Honesty Continuity — W2-PR11B Track C

**Wave:** W2-PR11B — Operator Governance + Runtime Honesty Enforcement
**Date:** 2026-05-08
**Status:** Review-only synthesis. No code changes, no merges.
**Risk class:** SAFE (read-only inventory).
**Companion to:** [operator-governance-integrity](operator-governance-integrity.md), [dashboard-runtime-honesty](dashboard-runtime-honesty.md), [longitudinal-governance-survivability](longitudinal-governance-survivability.md).
**Builds on:** [trust-fabric-durability-cohesion](trust-fabric-durability-cohesion.md), [forensic-durability-understanding](forensic-durability-understanding.md), [runtime-durability-continuity](runtime-durability-continuity.md), [survivability-explainability](survivability-explainability.md).

---

## What this track answers

PR10B Track D asked whether four named honesties (trust, survivability, operational clarity, forensic) hold *together at this point in time*. **This track asks whether they continue to hold across the five vectors a platform uses to communicate truth: docs, dashboards, exports, operator workflows, and future PRs.**

A platform's honesty is the steady-state intersection of everything it tells operators. If the docs are honest and the dashboards are silent, the honesty leaks. If the dashboards are honest and the exports inflate, the honesty leaks. If today's PR holds the line and the next contributor's PR softens a literal, the honesty leaks. Continuity is the property of the leak being plugged everywhere at once — and staying plugged.

This track scores each of the five named honesties (runtime, survivability, replay, audit, forensic) against each of the five communication vectors, locates the leaks, and judges whether the platform's structure makes the leaks self-healing or self-widening.

## Definitions

- **Runtime honesty:** the platform claims about a runtime mutation only what `buildRuntimeMutationMetadata` ([runtimeTrustCohesion.ts:143-190](../../apps/api/backend/src/services/runtimeTrustCohesion.ts)) actually produced — fingerprint, payload hash, classification, R-CAT, actor, outcome, readonly flag.
- **Survivability honesty:** the platform claims about its own records only what their `eventState` and recorded shape support — `pending_not_written` is not durability, `bundleHash` is not completeness, `'unknown'` is not identity.
- **Replay honesty:** the platform claims about replay output only what is per-capsule deterministic — recorded fields are recorded, computed fields are computed, outer category is outer, partial-artifact replay reads as ambiguous.
- **Audit honesty:** the platform claims about its audit table only what its rows support — `EMPLOYER_REVIEW_MUTATION_DENIED` is one event type for three reasons; rows can be `pending_not_written`; absent rows are not absent events.
- **Forensic honesty:** the platform claims about reconstruction only what the recorded shape delivers — bundle is best-effort, `bundleHash` is internal-consistency, `custodyLog` is self-emitted, refusal floor is zero.
- **Communication vector:** one of the five paths by which the platform's truth reaches a reader: docs (markdown / runbooks), dashboards (rendered surfaces), exports (artifacts that leave the perimeter), operator workflows (the sequences operators perform), future PRs (the contributor pipeline).
- **Continuity:** the property that all five honesties hold at all five vectors simultaneously, today and across future contributions.

## Five-honesty / five-vector scoreboard

The matrix below scores whether each honesty is preserved by each communication vector at this point in time.

| Honesty | Docs | Dashboards | Exports | Operator workflows | Future PRs |
|---|---|---|---|---|---|
| **Runtime honesty** | ✅ named in this docs corpus | ⚠️ no surface reads `mutationFingerprint` / `correlationId` / readonly flag | ⚠️ runtimeTrust block carries into capsule metadata; not declared in bundle schema | ⚠️ no workflow uses fingerprint group-by | ✅ doctrine-level types + tests + banned-strings make regression hard |
| **Survivability honesty** | ✅ named, registered, and graded | ❌ `eventState` has no surface; `partialExport` flag absent | ❌ bundle implies completeness | ❌ no runbook for "is row durable yet" | ⚠️ structural gates absent — a future PR can add a row without `eventState` plumbing |
| **Replay honesty** | ✅ recorded-vs-computed, dual-cause `'UNKNOWN'`, outer-vs-inner R-CAT registered | ⚠️ envelope shape is rendered as JSON; no UI separates provenance | ⚠️ replay envelope embedded in bundle inherits the same conflation | ❌ no workflow distinguishes "decision-time read" from "replay-time read" | ⚠️ a future replay-time field added to envelope without provenance marker would compound |
| **Audit honesty** | ✅ event-type collapse + `eventState` defaults documented | ❌ timeline does not read `eventState` or denial-reason | ❌ bundle does not propagate `eventState`; non-capsule events absent | ❌ no workflow asks "did this row land" or "which denial type" | ❌ adding a new event type without subtypes risks repeating the `MUTATION_DENIED` collapse |
| **Forensic honesty** | ✅ false-forensic-assumptions register | ❌ bundle JSON renders as authoritative | ❌ four 🔴 inflation vectors in bundle | ❌ no runbook for "what does this bundle prove" | ⚠️ schema can drift if `bundleHash` semantics widen without explicit gate |

**Tally across 25 cells:** 6 ✅, 8 ⚠️, 11 ❌.

**Pattern:** docs do all five honesties cleanly (✅×5). Dashboards do one cleanly (lane health, partial credit) and break down at four. Exports inflate at three of five. Operator workflows preserve none of the five. Future-PR resilience is high at runtime/trust honesty (doctrine + types) and weak at audit/survivability/forensic (no structural gate against new code re-introducing the inflation).

## Continuity by honesty

### Runtime honesty continuity

**Where it holds:** the contract layer is the strongest single-honesty surface in the codebase. `buildRuntimeMutationMetadata` ([runtimeTrustCohesion.ts:143-190](../../apps/api/backend/src/services/runtimeTrustCohesion.ts)) is a deterministic, taxonomy-bound transform with test coverage at [runtimeTrustCohesion.test.ts](../../apps/api/backend/src/services/__tests__/runtimeTrustCohesion.test.ts) and round-trip coverage at [replayEngine.runtimeCohesion.test.ts](../../apps/api/backend/src/services/audit/__tests__/replayEngine.runtimeCohesion.test.ts). The runtime block flows from origination through capsule write through replay verbatim.

**Where it leaks:** at the surface and workflow vectors. `mutationFingerprint`, `correlationId`, `payloadHash`, `readonly.attemptedByReadonly` are all literals in code with zero rendered binding. An operator running an incident has no path to "show me the unique logical mutations in this window."

**Future-PR resilience:** strong. Type system + tests catch regressions. A future PR removing a runtime field would fail [runtimeTrustCohesion.test.ts](../../apps/api/backend/src/services/__tests__/runtimeTrustCohesion.test.ts); a future PR widening a literal to a free-form string would fail typecheck. The doctrine-level gate ([CLAUDE.md](../../CLAUDE.md) banned-strings) does not bind to runtime-specific literals but the type system does.

**Continuity score:** 🟢 contract / 🟠 surface / 🟢 future-PR.

### Survivability honesty continuity

**Where it holds:** the literals exist and are honest at the code layer. `eventState` distinguishes `pending_not_written / demo_not_persisted / defer_until_contract_aligned / persisted`. `recordedBy: 'demo'` propagates end-to-end. `actorId: 'unknown'` is recorded faithfully. Demo paths render demo literals through every degradation mode.

**Where it leaks:** at three of five vectors. Dashboards do not render `eventState`. Exports do not propagate `eventState` into the bundle. No operator workflow asks "is this row durable yet."

**Future-PR resilience:** weak structurally. A future PR that adds a new audit-event row could land without `eventState` plumbing into any export, and no test would catch it because there is no contract test asserting "every audit-event row's `eventState` propagates into the bundle." The only structural defense today is convention.

**Continuity score:** 🟠 contract / 🔴 surface / 🟠 future-PR.

### Replay honesty continuity

**Where it holds:** per-capsule replay is deterministic ([replayEngine.ts:14-15](../../apps/api/backend/src/services/audit/replayEngine.ts) explicit constraint) and tamper-detectable ([replayEngine.ts:376-383](../../apps/api/backend/src/services/audit/replayEngine.ts) three-message `tamperEvidence`). The runtime round-trip is contract-tested.

**Where it leaks:** at the projection layer. Outer R-CAT-6 masks inner R-CAT-1…5. Recorded and computed fields share one envelope. Dual-cause `'UNKNOWN'` discriminator is `capturedAt: null` and visually invisible.

**Future-PR resilience:** mixed. Adding a new computed field to the replay envelope without a `provenance: 'computed'` marker is *the* recurrence pattern; no test asserts "every replay envelope field declares its provenance." A future replay-time enrichment (e.g., a new derivation) lands as ambiguous if the contributor follows current conventions.

**Continuity score:** 🟢 contract / 🟠 surface / 🟠 future-PR.

### Audit honesty continuity

**Where it holds:** `eventState` literals exist. `recordedBy: 'demo'` is enforced in demo flows. Doctrine-level gates prevent inflation copy on event types.

**Where it leaks:** taxonomy and absence. `EMPLOYER_REVIEW_MUTATION_DENIED` collapses three reasons. Issuer-side `refusalGate` writes no row. Replay invocations write no row. The audit table answers fewer questions than its name implies.

**Future-PR resilience:** weak. The naming convention "ACTION_PERFORMED" admits future event types that re-collapse subtypes (e.g., an "ACTION_REJECTED" event type for ten different rejection reasons). No structural gate forces subtype-per-cause. A new event type can land that re-introduces FA-6.

**Continuity score:** 🟠 contract / 🔴 surface / 🔴 future-PR.

### Forensic honesty continuity

**Where it holds:** the per-capsule replay determinism + tamper-evidence + authority chain. An investigator with one capsule can reconstruct that one decision honestly.

**Where it leaks:** the projection from one capsule to a window. The bundle implies completeness, the absent rows imply absent events, the `bundleHash` implies cryptographic provenance, the `custodyLog` implies multi-actor chain.

**Future-PR resilience:** weak. The bundle schema admits new fields without requiring `requestedCount` or `partialExport`. A future PR that adds a "summary" field to the bundle could compound the completeness implication. No structural gate today says "the bundle's completeness story must include a `requestedCount`."

**Continuity score:** 🟢 contract / 🔴 surface / 🟠 future-PR.

## Continuity by communication vector

### Docs

**Coverage today:** the W2-PR9B and W2-PR10B docs corpus comprehensively names and registers every survivability literal, false-forensic-assumption, hidden-optimism shape, and degradation mode. [forensic-explainability](forensic-explainability.md), [survivability-explainability](survivability-explainability.md), [forensic-durability-understanding](forensic-durability-understanding.md), [runtime-durability-continuity](runtime-durability-continuity.md), [trust-fabric-durability-cohesion](trust-fabric-durability-cohesion.md), [trust-fabric-continuity](trust-fabric-continuity.md), [operator-query-understanding](operator-query-understanding.md), [runtime-query-explainability](runtime-query-explainability.md). This track and its three companions extend the same coverage to governance.

**Where docs leak:** they are review-and-internal-facing. The runbook layer that an operator reads when an incident is happening is largely absent (see [operator-governance-integrity.md](operator-governance-integrity.md) operator runbook coverage table). The platform's truth is documented for the people who already understand it and absent for the people who arrive without source-code awareness.

**Continuity score:** 🟢 internal / 🟠 operator-runbook.

### Dashboards

**Coverage today:** lane-health badge mounts on three primary surfaces (employer dashboard, passport entity, passport root). DOCS-STATUS-1 wires compliance evidence into the status page. Demo paths render demo literals at issuer review surfaces.

**Where dashboards leak:** zero of five disclosure questions in [dashboard-runtime-honesty](dashboard-runtime-honesty.md) Track B receive a clean rendered answer. Survivability classes, replay fragility, export delay, degraded lineage, partial continuity all live at the contract layer with no rendering binding.

**Continuity score:** 🟢 lane-health / 🔴 everywhere else.

### Exports

**Coverage today:** `buildAuditBundle` ([replayEngine.ts:550-607](../../apps/api/backend/src/services/audit/replayEngine.ts)) emits a self-describing schema, a hash, a custody log, and a verification endpoint. Demo paths produce demo literals in the bundle. The replay envelope embedded in each capsule carries `runtimeTrust` round-trip determinism.

**Where exports leak:** four 🔴 inflation vectors (`bundleHash` as completeness, `verificationInstructions` as offline-verifiable, `bundle.issuer` as cryptographic provenance, `capsuleCount` as requested) plus the structural absences (no `partialExport`, no `requestedCount`, no `droppedIds`, no `eventState` propagation).

**Continuity score:** 🟢 contract / 🔴 schema-shape.

### Operator workflows

**Coverage today:** none of the runbook-shaped sequences exist as written documents. The actual operator workflow is "find a contributor who knows the system" or "read the source." Ten incident-shape questions in [dashboard-runtime-honesty](dashboard-runtime-honesty.md) Track B receive zero clean dashboard answers.

**Where workflows leak:** every workflow that depends on inferring durability from absence-of-warning. Every workflow that group-bys event type and treats it as one cause. Every workflow that reads a bundle as comprehensive. Every workflow that queries the audit table for absence and concludes nothing happened.

**Continuity score:** 🔴 broadly.

### Future PRs

**Coverage today:** the doctrine-level gates (banned-strings, literal types, `recordedBy: 'demo'`, demo gates, the truth contract) are robust. A future PR that says `'verified'` in copy fails review. A future PR that widens `decisionGrade` to `boolean` fails type check. A future PR that softens `recordedBy: 'demo'` is visible in diff.

**Where PRs leak:** the structural-level gates do not exist. A future PR can:
- Add a new event type that collapses subtypes (re-introduces FA-6 / GF-9).
- Add a new replay-envelope field without provenance (re-introduces FA-4 / GF-2).
- Add a new bundle field without `partialExport` plumbing (re-introduces FA-1 / GF-3).
- Add a new audit-row write path without `eventState` honesty (re-introduces HO-1 / GF-8).
- Use `'unknown'` as a literal in a new schema (re-introduces FA-2 / GF-6).

**The wave's mechanism for catching these is human review against the docs corpus.** No structural gate enforces them. A contributor who has not read the docs corpus can land a PR that compounds an inflation vector and passes review.

**Continuity score:** 🟢 doctrine / 🟠 structural.

## Continuity register: where it self-heals and where it self-widens

A leak is **self-healing** if the platform's structure (tests, types, gates, conventions) tends to surface the leak when a future contributor looks at it. A leak is **self-widening** if the structure tends to *not* surface the leak — the contributor adds more code that makes the leak harder to spot.

| Leak | Self-healing or self-widening? | Why |
|---|---|---|
| Trust-class inflation | self-healing | doctrine + types + demo gates each surface the leak independently |
| Runtime metadata regression | self-healing | tests fail; type system narrows |
| `eventState` not surfaced | self-widening | every new audit-row writer that ignores `eventState` reinforces the silence |
| Bundle implies completeness | self-widening | every new bundle field that does not declare partial-export reinforces the shape |
| New event type collapses subtypes | self-widening | the `EMPLOYER_REVIEW_MUTATION_DENIED` precedent normalizes the pattern |
| Replay envelope mixes provenance | self-widening | every new replay-time computed field that lands unmarked normalizes the pattern |
| `'unknown'` reads as identity | self-widening | every new schema that uses `'unknown'` as a literal reinforces the precedent |
| Outer R-CAT-6 masks inner | self-widening | every new replay path that emits R-CAT-6 unconditionally reinforces |
| Dual-cause `'UNKNOWN'` trust band | self-widening | retention-age erosion compounds; no structural defense |
| Issuer-side refusal not rowed | self-widening | every new refusal path that follows `policyReview.ts` precedent inherits the absence |
| Replay invocation not rowed | self-widening | the avoid-feedback-loop convention has no exception for "just record an observation" |

**Pattern:** two leaks self-heal (the doctrine-protected ones); nine leaks self-widen. The self-widening leaks are exactly the structural-layer leaks where the doctrine net does not catch them.

## Where runtime honesty continuity holds best

**The runtime ↔ replay round-trip is the single load-bearing continuity preservation in the wave.** [runtimeTrustCohesion.test.ts](../../apps/api/backend/src/services/__tests__/runtimeTrustCohesion.test.ts) verifies determinism. [replayEngine.runtimeCohesion.test.ts](../../apps/api/backend/src/services/audit/__tests__/replayEngine.runtimeCohesion.test.ts) verifies the round-trip. `correlationId / payloadHash / mutationFingerprint` survive `buildRuntimeMutationMetadata` → capsule metadata → `replayDecision` verbatim. A future PR that breaks this is structurally surfaced — the test fails, the diff is small, the cause is in scope.

This is the strongest example in the codebase of a self-healing structural defense for runtime honesty. It pairs a contract-level invariant with a test that asserts the contract. Future replay-time fields that follow this precedent (test the round-trip) self-heal; future replay-time fields that do not follow the precedent self-widen.

The doctrine-level defense (banned-strings + literal types + demo gates) is the second strongest. It does not catch the structural leaks but it is unbreakable against trust-class inflation.

## Where runtime honesty continuity holds worst

**Operator workflows have no continuity preservation at all today.** No runbook tells an operator how to detect `pending_not_written`. No runbook tells an operator how to read `actorId: 'unknown'`. No runbook tells an operator that bundles are best-effort. The platform's truth is in the contract layer; the operator's path to that truth is "ask a contributor."

This is the continuity gap that compounds fastest because every shift handover that occurs without a runbook entrenches the operator's mental model in whatever the dashboards happen to show — and the dashboards show happy-path-shaped surfaces for degraded states.

The future-PR resilience for audit honesty is the second weakest. The `EMPLOYER_REVIEW_MUTATION_DENIED` event-type collapse is a precedent, not an anomaly. A future PR for "ACTION_REJECTED" that collapses ten reasons into one type follows convention. The convention itself is the leak.

## Continuity verdict

**Runtime honesty is preserved at the doctrine layer, partially preserved at the contract layer, broadly absent at the surface layer, and structurally fragile against future PRs at the audit/survivability/forensic axes.**

The five honesties hold together at the doctrine layer (trust honesty stays robust under every degradation mode). The contract layer holds for runtime and replay honesty and is honestly best-effort for survivability and audit honesty. The surface layer is silent for four of five honesties. The workflow layer is absent. The future-PR layer self-heals on doctrine and self-widens on structure.

The wave's deliberate ordering is congruent with this finding. W2 closed the contract. The next wave needs to bind the contract to surfaces and to introduce structural gates that prevent self-widening regressions. Until then, runtime honesty continuity depends on:

1. The doctrine-level gates ([CLAUDE.md](../../CLAUDE.md) banned-strings + literal types) holding against copy and type drift — this is robust today.
2. The runtime ↔ replay round-trip test holding against runtime regression — this is robust today.
3. Human reviewers reading this docs corpus when assessing new PRs — this is the load-bearing-but-fragile mechanism.

The third leg is the longitudinal vulnerability. Items 1 and 2 are structural. Item 3 is convention. Convention erodes when contributors who have not read the docs land code that follows the leakier precedents.

**Strongest continuity-preservation surface:** the runtime ↔ replay round-trip test ([replayEngine.runtimeCohesion.test.ts](../../apps/api/backend/src/services/audit/__tests__/replayEngine.runtimeCohesion.test.ts)) paired with the determinism contract. Self-healing against runtime regression.

**Weakest continuity-preservation surface:** operator workflows. No runbook layer exists for the survivability literals; the contract is documented in the docs corpus and absent from the operator-facing path.

**Track C score: 🟡 PARTIAL — five honesties, two preserved end-to-end, three with surface-and-workflow gaps.** Doctrine continuity robust, structural continuity partial, operator-workflow continuity absent. **Runtime honesty continuity is preserved where the platform built a structural defense and absent where the platform left the literal in code.**

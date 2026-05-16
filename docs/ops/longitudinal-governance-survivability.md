# Longitudinal Governance Survivability — W2-PR11B Track D

**Wave:** W2-PR11B — Operator Governance + Runtime Honesty Enforcement
**Date:** 2026-05-08
**Status:** Review-only synthesis. No code changes, no merges.
**Risk class:** SAFE (read-only inventory).
**Companion to:** [operator-governance-integrity](operator-governance-integrity.md), [dashboard-runtime-honesty](dashboard-runtime-honesty.md), [runtime-honesty-continuity](runtime-honesty-continuity.md).
**Builds on:** [trust-fabric-durability-cohesion](trust-fabric-durability-cohesion.md), [trust-fabric-continuity](trust-fabric-continuity.md), [forensic-durability-understanding](forensic-durability-understanding.md), [survivability-explainability](survivability-explainability.md).

---

## What this track answers

The first three tracks measure the platform's governance posture at a point in time. **This track asks the longitudinal question: do the platform's structural defenses survive 6–12 months of contribution, contributor turnover, taxonomy expansion, dashboard evolution, and replay-language elaboration?**

Governance survivability is not whether today's review catches an inflation. It is whether the next 50 PRs land without re-introducing one. The risk vector here is *erosion by accretion*: a defense that requires human reviewer awareness erodes the moment the reviewer who wrote it isn't on the review. Longitudinal governance survivability is the property that the defense outlives the reviewer.

This track scores governance against five durability axes — durable, understandable, enforceable, contributor-safe, operationally survivable — and registers the four named drift vectors (governance erosion, taxonomy drift, dashboard drift, replay-language drift) the wave brief prescribed.

## Definitions

- **Durable governance:** the property that today's gates hold without active maintenance. A test that catches the regression. A type that narrows the literal. A banned-string that fails the lint.
- **Understandable governance:** the property that a contributor reading the codebase six months from now can correctly infer the gate's intent without reading the docs corpus. A name that says what it does. A comment that says why.
- **Enforceable governance:** the property that the gate fails the contribution rather than warning it. A type error that breaks the build. A test that fails CI. A banned-string that blocks the merge.
- **Contributor-safe governance:** the property that a contributor who has not read the docs corpus can land a PR without re-introducing a known inflation. The convention is harder to break than to follow.
- **Operationally survivable governance:** the property that the gate continues to apply under the platform's growth — new event types, new dashboards, new export shapes, new replay paths.
- **Erosion by accretion:** the failure mode where each individual PR is acceptable, the cumulative drift is not.
- **Convention-load:** the count of governance properties that depend on convention rather than structural enforcement.

## Five-axis governance survivability scoreboard

Each row is a governance defense currently in the codebase, scored against the five durability axes.

| Defense | Durable | Understandable | Enforceable | Contributor-safe | Operationally survivable |
|---|---|---|---|---|---|
| [CLAUDE.md](../../CLAUDE.md) banned-strings list | 🟢 list | 🟢 named bans | 🟡 lint-or-review | 🟡 ⚠️ contributor must run search | 🟢 list grows with platform |
| Literal `decisionGrade: false` in `ReceiptCandidate` | 🟢 type | 🟢 type comment | 🟢 typecheck fails | 🟢 type narrows in IDE | 🟢 isolatedModules-bound |
| Literal `proofTier: 'receipt_candidate'` | 🟢 type | 🟢 self-naming | 🟢 typecheck fails | 🟢 narrow type | 🟢 distinct from `psv_receipt_candidate` |
| `recordedBy: 'demo'` propagation | 🟢 literal | 🟢 explicit | 🟡 convention | 🟡 ⚠️ contributor must remember | 🟡 every new path must propagate |
| Five-gate `accept_candidate` sequence | 🟢 code path | 🟢 ordered checks | 🟢 path-fail | 🟢 visible in code review | 🟡 new state additions must extend the sequence |
| `runtimeTrust` round-trip test | 🟢 test | 🟢 named test | 🟢 CI fails | 🟢 test failure surfaces regression | 🟡 covers C-1 ↔ T0 specifically; new fields not auto-tested |
| Demo paths render demo literals | 🟢 propagation | 🟢 visible | 🟡 convention | 🟡 ⚠️ contributor must follow precedent | 🟡 new surfaces must inherit |
| Lane health decoupled from trust | 🟢 architecture | 🟢 explicit decoupling | 🟡 convention | 🟡 ⚠️ no test asserts the decoupling | 🟡 new lane signals must respect the decoupling |
| `eventState` literal exists | 🟢 enum | 🟡 unrendered | 🔴 no surface enforcement | 🔴 contributor sees no gate | 🟠 silently degrades as new audit-rows land |
| Bundle `bundleHash` over included replays | 🟢 implementation | 🟡 schema-shape implies more | 🔴 no `requestedCount` gate | 🔴 contributor inherits the inflation | 🔴 self-widens with new bundle fields |
| `EMPLOYER_REVIEW_MUTATION_DENIED` event type | 🟢 enum entry | 🟠 collapses three reasons | 🔴 no subtype enforcement | 🔴 contributor follows precedent | 🔴 self-widens with new event types |
| Issuer-side `refusalGate` (no row) | 🟢 architectural decoupling | 🟠 absence implies absence | 🔴 no event type | 🔴 contributor inherits the absence | 🔴 every new refusal path inherits |
| Replay envelope provenance mixing | 🟢 implementation | 🟠 unmarked | 🔴 no provenance type | 🔴 contributor inherits | 🟠 self-widens with new computed fields |
| Outer R-CAT-6 unconditional | 🟢 implementation | 🟠 outer-vs-inner unmarked | 🔴 no separation gate | 🔴 contributor inherits | 🟠 self-widens with new replay paths |

**Tally across 70 cells:** 33 🟢, 16 🟡, 6 🟠, 15 🔴.

**Pattern:** the doctrine-protected defenses (top six rows) hold across all five axes with high green density. The structural-gap defenses (bottom six rows) cluster in 🔴 at the enforceable, contributor-safe, and operationally-survivable columns. The pattern is consistent with [runtime-honesty-continuity.md](runtime-honesty-continuity.md) Track C: the doctrine layer self-heals; the structural layer self-widens.

## Convention-load inventory

The count of governance properties that depend on convention rather than structural enforcement. A high convention-load is a longitudinal vulnerability: each conventional gate erodes at the rate of contributor turnover.

| Conventional gate | What it depends on | Erosion mechanism |
|---|---|---|
| `recordedBy: 'demo'` propagation across new surfaces | contributor remembers to set the literal | new surface lands without `'demo'` flag → demo path reads as real |
| `eventState` propagation into bundle exports | contributor remembers to plumb the literal | new bundle field lands without `eventState` → bundle reads as durable |
| Lane-health decoupling from trust state | contributor remembers the decoupling | new lane signal lands as a trust-state input → operational availability reads as provenance |
| Subtype-per-cause for new event types | contributor names the type carefully | new "ACTION_X" event collapses N reasons → repeats GF-9 |
| Provenance marker on new replay-envelope fields | contributor adds a `provenance` tag | new replay-time field lands unmarked → repeats GF-2 |
| Outer-vs-inner R-CAT separation in new replay paths | contributor avoids unconditional outer R-CAT | new replay path emits unconditional outer → repeats GF-12 |
| `partialExport` / `requestedCount` in new bundle paths | contributor adds the field | new bundle path follows current schema → repeats GF-3 |
| `'unknown'` highlighted at new actor-rendering surfaces | contributor styles the fallback distinctly | new surface renders `'unknown'` as plain string → repeats GF-6 |

**Convention-load:** eight conventional gates, each of which erodes when a contributor lands a PR without reading the docs corpus.

**Doctrine-load (for comparison):** zero. The banned-strings list, literal types, demo gates are structural — they fail the build, not the review.

**Ratio:** 8 conventional defenses : 0 doctrine-only defenses. **The convention-load is the operative longitudinal vulnerability.** Every conventional defense above is a candidate for a structural lift in a future wave.

## Governance erosion vectors (12-month horizon)

Each entry below is a governance erosion mechanism the platform admits over a 6–12-month window of normal contribution.

### GE-1 — Reviewer turnover erodes convention compliance

**Mechanism:** the reviewers who wrote the convention-load defenses know to look for them on PRs. New reviewers do not. Over 6–12 months, the proportion of PRs reviewed by contributors who have read the full PR9B+PR10B+PR11B docs corpus declines.

**Impact:** convention-load defenses (eight of them) erode at the rate of reviewer turnover.

**Mitigation today:** the docs corpus is comprehensive but is review-style reading; no structural force makes a new contributor read it.

**Severity:** 🟠 — the most predictable erosion vector.

### GE-2 — Precedent erosion: each leaky shape becomes a template

**Mechanism:** `EMPLOYER_REVIEW_MUTATION_DENIED` is a precedent for "one event type, multiple reasons." A future PR adding "ACTION_REJECTED" follows the precedent. After 12 months, the audit-event union has more collapsed-subtype event types than precision-typed ones.

**Impact:** GF-9 widens with new event types. GF-12 widens with new replay paths. GF-3 widens with new bundle fields. The leakier the precedent, the more contributors inherit it.

**Severity:** 🔴 — self-widening structurally.

### GE-3 — Documentation drift: docs grow at the rate of waves; code grows at the rate of PRs

**Mechanism:** each wave produces docs (good). Each PR produces code (faster). Over 12 months, the code grows faster than the docs. The cross-references in the docs corpus point to line numbers that have moved. The registers in the docs become snapshot-shaped, not living-shaped.

**Impact:** the docs become a record of what was true rather than a description of what is true. New contributors cross-reference and find drift.

**Severity:** 🟠 — predictable; mitigable by linking-by-symbol-not-line where possible.

### GE-4 — Banned-strings list incompleteness compounds

**Mechanism:** [CLAUDE.md](../../CLAUDE.md) bans inflation strings. Each new inflation copy that lands is, before its banning, an opportunity to widen the leak. The list catches yesterday's inflation; tomorrow's inflation has not been banned yet.

**Impact:** trust-honesty's doctrine layer remains robust against the listed strings and is reactive to new inflation patterns.

**Mitigation today:** [CLAUDE.md](../../CLAUDE.md) is updated proactively; the list grows when a new pattern is observed.

**Severity:** 🟡 — the doctrine layer is honest about being a list; the list is itself complete-as-of-today.

### GE-5 — Demo-gate softening pressure

**Mechanism:** demo paths produce `recordedBy: 'demo'` literals end-to-end. In a future "let's polish the demo" wave, a contributor might soften the disclaimer copy or remove the literal from a surface to "improve UX." This is the single highest-stakes governance softening pressure because the demo gate is the load-bearing anti-inflation defense across all degradation modes.

**Impact:** if the literal softens, every degradation mode's defense softens with it.

**Mitigation today:** the literal is type-enforced, propagated by convention, banned in copy. Three layers.

**Severity:** 🟡 today — three-layer defense — and 🔴 if any one layer relaxes.

### GE-6 — Survivability literal staleness

**Mechanism:** `eventState`, `mutationFingerprint`, `payloadHash`, `correlationId`, `actor.actorId: 'unknown'` are literals in code with no surface binding. Over 12 months of code growth, their callers multiply, their meaning stays narrow, and contributors discover them one at a time. Each discovery is an opportunity to widen the literal (e.g., "let's make `actorId` accept any string"). Each widening softens the defense.

**Impact:** GF-6 / GF-7 / GF-8 / GF-12 each compound.

**Mitigation today:** the literals are typed; widening fails typecheck.

**Severity:** 🟠 — protected by types, vulnerable to refactor pressure.

## Taxonomy drift vectors

Specifically focused on the audit-event taxonomy, the runtime-trust taxonomy, the trust-class taxonomy, and the R-CAT taxonomy.

### TD-1 — Audit-event taxonomy drift toward collapse

**Today:** [auditEventTypes.ts](../../apps/api/backend/src/types/auditEventTypes.ts) has `EMPLOYER_REVIEW_MUTATION_DENIED` with three reasons in payload. The precedent normalizes "one type, many reasons."

**Drift vector:** new event types follow the precedent; the union grows wider but no precision is added. After 12 months, the union has 30 entries that each elide 2–5 sub-cases. The audit table answers fewer questions per event-type than at wave start.

**Mitigation today:** none structural. Convention-only.

**Severity:** 🔴.

### TD-2 — Audit-event taxonomy drift toward absence

**Today:** issuer-side `refusalGate` writes no row. Replay invocation writes no row. The precedent normalizes "this kind of decision is a decision-without-record."

**Drift vector:** new helpers follow the precedent and write no rows. The audit table's coverage thins relative to platform behavior. The forensic floor on a growing list of event types becomes zero.

**Mitigation today:** none structural. The avoid-feedback-loop convention is correct in spirit; it has no exception clause for "just record an observation."

**Severity:** 🔴.

### TD-3 — Runtime-trust taxonomy drift toward `'unknown'` absorption

**Today:** `RuntimeTrustActor.actorId: 'unknown'` is a fallback. The precedent normalizes "if attribution is missing, write `'unknown'`."

**Drift vector:** new actor-detection paths follow the precedent. After 12 months, the proportion of `'unknown'` rows in the audit table rises. Operators interpret `'unknown'` as a stable cohort; the proportion of unattributed-but-real actions becomes invisible.

**Mitigation today:** the literal is typed; widening fails typecheck. The behavior is at the value layer, not the type layer.

**Severity:** 🟠 — the type holds, the meaning erodes.

### TD-4 — Trust-class taxonomy drift via name addition

**Today:** the truth contract has `ReceiptCandidate / PSVReceiptCandidate / PSVReceipt`. Each is named, typed, gated.

**Drift vector:** a future wave introduces a new class (e.g., "PreliminaryReceipt") without the same gating discipline. The new class lands as a literal type but without the demo-gate propagation, banned-strings additions, or five-gate sequence equivalent.

**Mitigation today:** the existing trust contract is not extensible-by-default. Adding a class is a deliberate change; the wave that adds it is the wave that should match the discipline. But there is no structural gate forcing the discipline.

**Severity:** 🟡 — depends on the discipline of the wave that introduces a new class. The current truth-contract pattern is the strongest in the codebase; the question is whether future waves match it.

### TD-5 — R-CAT taxonomy drift toward outer dominance

**Today:** outer envelope `R-CAT-6` masks inner R-CAT-1…5 in every replay envelope.

**Drift vector:** new replay paths follow the precedent and emit unconditional outer R-CAT-6. Inner R-CAT becomes the single source of truth for "what kind of action was this," and inner R-CAT lives in `meta.runtimeTrust` which has no rendering binding.

**Mitigation today:** convention-only. No structural force separates outer from inner in surface rendering.

**Severity:** 🟠 — self-widens with new replay paths.

## Dashboard drift vectors

### DD-1 — Status page expansion without survivability disclosure

**Today:** [status/page.tsx](../../apps/web/app/status/page.tsx) carries compliance evidence shape (DOCS-STATUS-1). The page is honest at the literal layer.

**Drift vector:** future expansions of the status page can add green checks for new categories ("audit durable: ✅") that do not actually reflect the underlying durability axis. A "status page reads green" pattern compounds the bundle-implies-completeness inflation.

**Mitigation today:** the page is small and current. The pattern is only as strong as the discipline of the wave that expands it.

**Severity:** 🟡 — pattern-dependent.

### DD-2 — New dashboards inherit happy-path styling

**Today:** the dashboards that exist mirror the happy path for degraded states (timeline does not surface `eventState`, etc.). The convention is "render the field as it is in code; styling decisions follow component conventions."

**Drift vector:** every new dashboard inherits the convention. After 12 months, the dashboard surface area has grown but no new dashboard renders a survivability literal. The convention compounds.

**Mitigation today:** none structural. Convention-only.

**Severity:** 🟠.

### DD-3 — Lane-health-decoupling dilution

**Today:** lane health is a separate axis from trust state. The decoupling is architectural and explicit.

**Drift vector:** a future "smart trust state" wave could try to fold lane signals into trust state ("if source coverage is degraded, lower the trust band"). This is the most consequential single dashboard-drift risk because it is the one example of a defense that explicitly preserves operational clarity vs survivability honesty.

**Mitigation today:** the convention is explicit in [trust-fabric-continuity.md](trust-fabric-continuity.md). No structural test asserts "lane health is not a trust-state input."

**Severity:** 🟠 — depends on a future wave's discipline.

### DD-4 — Bundle JSON shape inflation by accretion

**Today:** the bundle has `bundleHash`, `verificationInstructions`, `custodyLog`, `bundle.issuer`. Four 🔴 inflation vectors.

**Drift vector:** a future wave adds "bundleSummary" or "complianceProfile" or "verificationChecklist" — each is honest at the literal layer and compounds the completeness implication. The schema accretes shape; the schema does not declare its limits.

**Mitigation today:** no structural gate on schema additions. Convention-only.

**Severity:** 🔴 — self-widening; the bundle schema is the highest-impact inflation surface.

## Replay-language drift vectors

The replay language — `R-CAT`, `replayCategory`, `replayMetadata`, `replayedAt`, `tamperEvidence`, `recomputedHash`, `evidenceSnapshot.sourcesConsulted` — is the second-largest surface in the codebase after the audit-event taxonomy. Drift here compounds in projection-fragile ways.

### RD-1 — `replayCategory` semantic widening

**Today:** outer `replayCategory` is unconditionally `'R-CAT-6'`; inner is the original.

**Drift vector:** a future PR clarifying the outer category as "R-CAT-6 (envelope-wraps)" or "R-CAT-7 (something new)" without the rendering separation simply adds another invariant the operator must remember. Each addition expands the convention-load.

**Severity:** 🟡 — every literal expansion that lands without a separation gate compounds.

### RD-2 — `tamperEvidence` overuse

**Today:** [`tamperEvidence`](../../apps/api/backend/src/services/audit/replayEngine.ts) has three honest messages (hash mismatch, evidence-spine mismatch, generic replay failure).

**Drift vector:** future contributors may add a fourth, fifth, sixth message. Each is honest individually; cumulatively they dilute "tamper evidence" toward "any error during replay." The literal stays accurate; the connotation widens.

**Severity:** 🟡.

### RD-3 — `evidenceSnapshot` recorded-vs-computed widening

**Today:** `evidenceSnapshot.evidenceRecords` is recorded; `evidenceSnapshot.sourcesConsulted` is computed at replay time. The boundary is implicit.

**Drift vector:** new fields land on either side of the boundary without a marker. After 12 months, an investigator cannot tell which fields of `evidenceSnapshot` are recorded and which are replay-time without reading the code.

**Mitigation today:** none structural. Convention-only.

**Severity:** 🟠.

### RD-4 — Authority chain replay-time inference normalization

**Today:** `replayDecision` infers issuers from sources when `issuerIds` is empty ([replayEngine.ts:441-456](../../apps/api/backend/src/services/audit/replayEngine.ts)). The inference is a fallback.

**Drift vector:** the inference precedent normalizes "construct missing chain links at replay time." Future PRs add more inference for missing fields. The replay envelope's authority chain becomes increasingly a replay-time computation rather than a recorded fact.

**Mitigation today:** none structural. Convention-only.

**Severity:** 🟠.

## Contributor-safe governance scoreboard

For each defense, can a contributor who has not read the docs corpus *land a PR safely*?

| Defense | Contributor-safe? | What protects them |
|---|---|---|
| Trust-class literal types | ✅ | typecheck fails on widening |
| Banned-strings list | ✅ | review or lint fails |
| Five-gate `accept_candidate` | ✅ | code path is visibly linear |
| Runtime round-trip determinism | ✅ | test fails |
| Demo-gate propagation | ⚠️ | convention; no test |
| Lane-health decoupling | ⚠️ | architectural; no test |
| `eventState` propagation | ❌ | convention only |
| Bundle `partialExport` plumbing | ❌ | does not exist as a gate |
| Subtype-per-cause for new events | ❌ | no convention |
| Replay-envelope provenance | ❌ | no convention |
| Outer-vs-inner R-CAT separation | ❌ | no convention |
| Refusal-event-row writing | ❌ | precedent says no |

**Tally:** 4 ✅, 2 ⚠️, 6 ❌. **Six of twelve governance defenses are not contributor-safe.** A contributor without docs-corpus awareness can land a PR that compounds those six.

## Operationally survivable governance — projection across 12 months

A 12-month forward projection of the platform's governance posture, assuming current conventions hold:

| Surface | Today | +6 months | +12 months |
|---|---|---|---|
| Doctrine layer (banned strings, literal types) | 🟢 robust | 🟢 robust | 🟢 robust |
| Trust contract (truth gates, decisionGrade) | 🟢 robust | 🟢 robust (unless promotion wave introduces new class without discipline) | 🟢/🟡 |
| Lane-health decoupling | 🟢 robust | 🟢 robust | 🟡 (smart-trust-state pressure rises) |
| Demo-gate propagation | 🟡 | 🟡 | 🟠 (more surfaces, more chances to soften) |
| Audit-event taxonomy | 🟠 | 🟠 → 🔴 | 🔴 (precedent compounds with new event types) |
| Bundle export schema | 🔴 | 🔴 | 🔴 (every new field compounds completeness implication) |
| `eventState` surface binding | absent | absent unless wave invests | 🟠 (every new audit-row writer that ignores it widens the gap) |
| Replay envelope provenance | 🟠 | 🟠 → 🔴 | 🔴 (every new computed field compounds) |
| Operator runbook coverage | absent | absent unless wave invests | absent (compounds with shift turnover) |

**12-month projection:** doctrine-protected defenses hold. Structural-gap defenses widen. Convention-load defenses erode at the rate of reviewer turnover. Operator runbook coverage stays absent. Without a wave specifically targeting structural lifts (`eventState` surface, `partialExport` field, subtype-per-cause discipline, provenance markers, refusal event rows), the platform's governance posture in 12 months is **strictly weaker** than today's at the structural and surface layers, while remaining **at-least-equal** at the doctrine layer.

## Where longitudinal governance survives best

**The doctrine-protected truth contract is the strongest longitudinal-governance gain in the wave.** Banned-strings list + literal `decisionGrade: false` + literal `proofTier` + five-gate `accept_candidate` + `recordedBy: 'demo'` propagation form a layered defense where each layer would have to be intentionally relaxed for trust-class inflation to land. The combined load-factor — three independent gates that all must fail — makes this defense the hardest to erode in 12 months.

The runtime ↔ replay round-trip test is the second strongest. It is a single test that anchors a single load-bearing invariant. Future replay-time changes that follow this precedent (test the round-trip) self-heal.

These two defenses together cover the trust-honesty and runtime-honesty axes from [runtime-honesty-continuity.md](runtime-honesty-continuity.md). They are why those two axes score 🟢 / 🟢 across the longitudinal projection. The rest of the platform's governance is structurally less defended.

## Where longitudinal governance survives worst

**The audit-event taxonomy is the weakest longitudinal surface.** Its current pattern (one type, many reasons) is precedent. Its current pattern (some events get rows, others do not) is precedent. Each new event type either follows the leakier pattern or has to deliberately depart. Over 12 months, the audit table answers fewer questions per event-type than at wave start, and the forensic floor on absent rows widens.

The bundle export schema is the second weakest. Each new bundle field compounds the completeness implication. The schema does not declare its limits, and the convention-load to ensure new fields declare their durability is not enforced anywhere.

Together these two surfaces concentrate the bulk of the longitudinal vulnerability. They are also the two surfaces most likely to expand (new event types ship monthly; bundle exports are the artifact-shaped expression of the platform's value).

## Drift-rate priority

Ordered by 12-month drift rate from highest to lowest:

1. **Audit-event taxonomy** (🔴) — every new event type is a chance to compound the collapse pattern.
2. **Bundle export schema** (🔴) — every new field compounds completeness implication.
3. **Replay envelope** (🟠) — every new computed field compounds provenance mixing.
4. **`eventState` surface absence** (🟠) — every new audit-row writer that ignores it widens the silence.
5. **Operator runbook absence** (🟠) — compounds with shift turnover.
6. **Outer R-CAT-6 unconditional** (🟠) — every new replay path compounds.
7. **`'unknown'` literal proliferation** (🟠) — every new actor-detection path compounds.
8. **Lane-health decoupling pressure** (🟡) — depends on smart-trust-state pressure rising.
9. **Demo-gate softening pressure** (🟡) — depends on UX-polishing pressure rising.
10. **Banned-strings list incompleteness** (🟡) — reactive; lags new inflation patterns.

**The top three drift rates concentrate on the schema and projection layers, not the trust-class layer.** The wave's deliberate ordering — close the contract first — is congruent with this projection. The next wave's deliberate ordering should be — close the audit taxonomy and the bundle export schema — to slow the top three drift rates.

## Verdict

**Longitudinal governance survivability is high at the doctrine layer, partial at the structural layer, weak at the convention layer, and degrading at the projection layer.**

Two defenses (truth contract + runtime round-trip) hold across the 12-month projection. Eight defenses are convention-load; they erode at the rate of reviewer turnover. Six structural gaps self-widen with normal contribution. The audit-event taxonomy and the bundle export schema concentrate the bulk of the projected drift.

The platform's structure is congruent with its wave-ordering doctrine: close the contract, then the surface, then the projection. The contract is closed; the surface and projection are the next two waves of work. Until they close, longitudinal governance survives at the doctrine layer and erodes at the projection layer.

**Strongest longitudinal-governance gain:** the truth contract — banned-strings list + literal types + five-gate `accept_candidate` + demo-gate propagation. Three independent layers, no single point of failure. This is the wave's most durable governance investment and the one most likely to outlive the reviewers who built it.

**Weakest longitudinal-governance surface:** the audit-event taxonomy. The `EMPLOYER_REVIEW_MUTATION_DENIED` precedent is itself the leak; each new event type that follows the precedent compounds GF-9 / FA-6. Without a structural subtype-per-cause discipline, the taxonomy widens monotonically.

**Track D score: 🟠 DRIFT-PRONE.** Two strong longitudinal defenses, eight conventional defenses, six self-widening structural gaps. **Longitudinal governance survivability is robust where the platform layered three defenses and weak where it layered one — the wave's contract-first ordering preserves trust honesty over 12 months and expects a future wave to preserve survivability honesty over the same horizon.**

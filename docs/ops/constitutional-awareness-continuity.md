# Constitutional Awareness Continuity — W2-PR16B Track D

**Wave:** W2-PR16B — Constitutional Institutional Awareness
**Date:** 2026-05-08
**Status:** Review-only synthesis. No code changes, no merges.
**Risk class:** SAFE (read-only inventory).
**Companion to:** [constitutional-context-explainability](constitutional-context-explainability.md), [governance-memory-awareness](governance-memory-awareness.md), [institutional-drift-psychology](institutional-drift-psychology.md).
**Builds on:** [longitudinal-governance-survivability](longitudinal-governance-survivability.md), [constitutional-response-continuity](constitutional-response-continuity.md), [governance-awareness-survivability](governance-awareness-survivability.md), [trust-fabric-continuity](trust-fabric-continuity.md), [runtime-honesty-continuity](runtime-honesty-continuity.md), [escalation-explainability](escalation-explainability.md), [forensic-explainability](forensic-explainability.md), [replay-warning-psychology](replay-warning-psychology.md).

---

## What this track answers

Tracks A, B, and C asked whether contributors today understand context, whether warnings retain meaning, and whether organizations resist normalization. **This track collapses those three readings into a single longitudinal question: does the platform preserve its constitutional reasoning across turnover, time, contributor churn, operator fatigue, and governance evolution — or does each of those forces consume a layer of awareness that nothing replaces?**

The risk vector here is **continuity collapse**: not a single failure, not a single drift, but the cumulative loss of the reasoning chain that connects today's defended literal to tomorrow's contributor's instinct. A platform that preserves its constitutional reasoning through five years of turnover is one whose newest engineer can land a PR that strengthens — not weakens — the truth contract. A platform that has lost continuity is one where any individual PR is locally reasonable and the cumulative drift is structurally unsafe.

Continuity is a property *of the system* in time. Awareness, memory, and drift psychology are properties of contributors, warnings, and organizations *at a moment*. Continuity is whether those moments can be chained.

This track asks the same question across five preservation surfaces — governance memory, replay caution, forensic caution, survivability caution, constitutional reasoning continuity itself — under five erosion forces — turnover, time, contributor churn, operator fatigue, governance evolution. The output is a 5×5 continuity matrix and a longitudinal projection.

## Continuity vocabulary

The four longitudinal states a preservation surface can occupy:

- **🟢 SUSTAINED** — the surface preserves its meaning across the full 36-month horizon. Multiple structural anchors carry the reasoning forward (typecheck, test, lint, doctrine). New contributors arrive and are shaped by the structure rather than carrying it. Continuity is system-property, not contributor-property.
- **🟡 PROTECTED** — the surface preserves its meaning across 12–18 months without active maintenance, but requires a periodic refresh (a wave of doc consolidation, a reviewer-onboarding pass, a CLAUDE.md update). Continuity is structurally supported but contributor-attention-dependent.
- **🟠 ATTENTION-DEPENDENT** — the surface preserves its meaning only as long as a critical mass of contributors actively know the rationale. Continuity erodes at the rate of contributor turnover. After 12 months without active maintenance, the surface's reasoning thins.
- **🔴 NON-CONTINUOUS** — the surface's reasoning is absent from anchored sources today. Continuity is reviewer-memory-bound. Within 6–12 months of even normal turnover, the reasoning is lost from the room.

These four grades aggregate the prior three tracks — A's contributor-reading-the-code grade, B's warning-still-meaningful grade, C's organizational-posture grade. A surface that is 🟢 PRESERVED in A, 🟢 ANCHORED in B, and 🟢 RESISTED in C should be 🟢 SUSTAINED here. A surface that is 🔴 in any of A/B/C is 🟠 or 🔴 here.

## Five preservation surfaces × five erosion forces

The continuity matrix. Each cell scores whether the named preservation surface holds against the named erosion force across a 12-month window.

| Preservation surface | Turnover | Time | Contributor churn | Operator fatigue | Governance evolution |
|---|---|---|---|---|---|
| **Governance memory** (truth contract, gates, banned strings) | 🟢 | 🟢 | 🟢 | 🟢 | 🟡 (new event types compound) |
| **Replay caution** (R-CAT outer/inner, recorded vs replay-time) | 🟠 | 🟠 | 🔴 | 🟠 | 🔴 (new replay paths self-widen) |
| **Forensic caution** (audit-row floor, refusal absence, replay-invocation absence) | 🔴 | 🔴 | 🔴 | 🟠 | 🔴 (new event types accrete the gap) |
| **Survivability caution** (`pending_not_written` default, demo-flag propagation, durability staging) | 🟡 | 🟡 | 🟠 | 🟡 | 🟠 (TRUST-PERSIST-1 lift will reshape the literals) |
| **Constitutional reasoning continuity** (the meta-vocabulary itself) | 🔴 | 🔴 | 🔴 | 🔴 | 🟠 |

**Tally across 25 cells:** 5 🟢, 4 🟡, 7 🟠, 9 🔴.

**Pattern:** governance memory is the only preservation surface that holds 🟢 across four of five erosion forces — the truth-contract gold standard. Forensic caution is the worst across all five erosion forces — the audit-floor gap is absent of structural defense and self-widens with every contribution. Constitutional reasoning continuity (the meta-layer) is 🔴 across four of five — the meta-vocabulary lives nowhere except the docs corpus, which is itself eroding under the same forces.

## Per-surface continuity analysis

### P.1 — Governance memory continuity (🟢 across four of five)

**Anchored by:**
- Five overlapping structural defenses on the trust-class family (type, test, doctrine, copy, architecture) — see [governance-memory-awareness](governance-memory-awareness.md) Family 1.
- Multi-paragraph docstrings in [types.ts](../../apps/web/lib/issuer-verification/types.ts) and [policyReview.ts](../../apps/web/lib/issuer-verification/policyReview.ts).
- CLAUDE.md "Truth contract" prose section.
- Banned-strings list against inflation copy.

**Continuity properties:**
- Turnover: a new contributor encountering [types.ts:197](../../apps/web/lib/issuer-verification/types.ts) reads the literal type plus the docstring constraint. The reasoning is in the file. Turnover does not remove the reasoning.
- Time: the type literals do not drift — typecheck enforces. Tests do not soften — CI enforces.
- Contributor churn: even a contributor who has not read the docs corpus cannot weaken `decisionGrade: false` without breaking the build.
- Operator fatigue: not directly applicable; this is contributor-side memory.
- Governance evolution (⚠️ 🟡): the only erosion vector. New event types or new trust classes that do not match the family's discipline (TD-4 from [longitudinal-governance-survivability](longitudinal-governance-survivability.md)) compound the family rather than reinforcing it. The current pattern is the strongest in the codebase; future waves matching the discipline are the question.

**Verdict:** 🟢 SUSTAINED on present-defenses; 🟡 PROTECTED on extension-discipline. The family is the platform's canonical demonstration that continuity *is* achievable with overlapping structural anchors.

### P.2 — Replay caution continuity (🟠 / 🔴 across five forces)

**Anchored by:**
- Type-pinned R-CAT enum, mutation-classification enum, replay-category literal.
- Round-trip test ([replayEngine.runtimeCohesion.test.ts](../../apps/api/backend/src/services/audit/__tests__/replayEngine.runtimeCohesion.test.ts)) on the C-1 ↔ T0 flow.
- `tamperEvidence` three honest messages ([replayEngine.ts:376-383](../../apps/api/backend/src/services/audit/replayEngine.ts)).

**NOT anchored:**
- Outer-vs-inner R-CAT separation (no constraint statement, no test asserting "outer must be R-CAT-6 only when the action is dossier-replay").
- Recorded-vs-replay-time field boundary (no `provenance` literal on computed fields).
- The cadence-dilution failure modes named in [replay-warning-psychology](replay-warning-psychology.md).

**Continuity properties:**
- Turnover (🟠): a new contributor reads the types but not the separation rationale. After 6–12 months of turnover, the rationale is reviewer-memory-bound.
- Time (🟠): the cadence-dilution failure modes accumulate; the team's reading of `tamperEvidence: null` modal becomes "this means clean."
- Contributor churn (🔴): every new replay path that follows the precedent compounds the gap. RD-1, RD-2, RD-3, RD-4 are all self-widening.
- Operator fatigue (🟠): operator psychology compounds at the team level; team posture inherits the dilution.
- Governance evolution (🔴): the worst — every new replay-related field landed without provenance marking compounds the recorded-vs-computed boundary erosion.

**Verdict:** the contract layer holds (🟢 in the round-trip test); the meaning layer erodes (🟠/🔴 in the four other axes). Continuity is structurally bounded by the test and culturally unprotected everywhere else.

**Recovery:** a `provenance: 'recorded' | 'replay_time'` literal on each computed envelope field would lift the surface from 🟠/🔴 to 🟡/🟢 across all five erosion forces. The structural lift is ~50 lines of type changes plus call-site updates.

### P.3 — Forensic caution continuity (🔴 / 🟠 across five forces — worst overall)

**Anchored by:**
- The audit-event taxonomy ([auditEventTypes.ts](../../apps/api/backend/src/types/auditEventTypes.ts)) as a typed union (a contributor cannot write an unrecognized event type).
- The pure-transform constraint on [policyReview.ts:36](../../apps/web/lib/issuer-verification/policyReview.ts) preventing audit-row writes from the gate path.

**NOT anchored:**
- The "no row for refusals" precedent (TD-2): nothing in code names the absence as a defended choice rather than a TODO.
- The "one type, many reasons" precedent (TD-1): `EMPLOYER_REVIEW_MUTATION_DENIED` collapses three reasons; nothing in code asserts that future event types must split rather than collapse.
- The replay-invocation row absence: `replayDecision` writes nothing; nothing asserts that this is intentional rather than missed.
- The bundle's silence about durability of source rows.

**Continuity properties:**
- Turnover (🔴): the precedents are reviewer-knowledge. New reviewers do not encounter the rationale; they encounter the precedent.
- Time (🔴): every quarter, new event types accrete. The taxonomy grows wider, less precise, and more silent.
- Contributor churn (🔴): TD-1 and TD-2 are 🔴 self-widening per [longitudinal-governance-survivability](longitudinal-governance-survivability.md).
- Operator fatigue (🟠): investigators landing on the audit table read it as authoritative; the absence of refusal rows is invisible.
- Governance evolution (🔴): the worst — every new feature that adds an event type is an opportunity to compound the gap.

**Verdict:** 🔴 NON-CONTINUOUS on four of five axes. This is the platform's worst continuity surface. The contract layer (typed union) holds the *what* but the structure is silent about the *why-of-its-shape* and silent about the *why-of-its-omissions*. Without a structural lift, the surface naturalizes within 12–18 months.

**Recovery:** a `forensicScope: 'records_event' | 'records_action' | 'records_outcome'` literal on every audit-event-type plus a `subtype: string` discriminator on collapsed types would close TD-1 structurally. A `RefusalEventType` that the gate path writes (with `eventState: 'pending_not_written'` until durability lifts) would close TD-2 structurally.

### P.4 — Survivability caution continuity (🟡 / 🟠 across five forces)

**Anchored by:**
- Literal `eventState: 'pending_not_written' | 'queued_demo_only' | 'written'` on lifecycle audit-metadata ([requestLifecycle.ts:167](../../apps/web/lib/issuer-verification/requestLifecycle.ts), [psvReceiptReuse.ts:142](../../apps/web/lib/issuer-verification/psvReceiptReuse.ts)).
- Literal `recordedBy: 'demo' | 'review_surface' | 'system'` propagation.
- Inline JSDoc comments naming the default ("eventState defaults to 'pending_not_written' so [staged rollout]").
- TRUST-PERSIST-1 wave context preserved in memory and in PR descriptions.

**NOT anchored:**
- The cross-surface propagation discipline (each new lifecycle helper must carry the literal; no factory enforces it).
- The bundle's silence about source-row durability (no `eventStateAtExport` field).
- The relationship between `pending_not_written` and `queued_demo_only` is not commented; a contributor reading the literal sees three values without a hierarchy.

**Continuity properties:**
- Turnover (🟡): the literal and the inline comment carry forward; the *staging rationale* does not.
- Time (🟡): TRUST-PERSIST-1 is the largest single board blocker; when it lands, the literal default may shift, and the rationale-of-the-default needs migration alongside.
- Contributor churn (🟠): a new helper may default to `'written'`; type allows it.
- Operator fatigue (🟡): operators do not read survivability literals directly; the surface is contributor-only.
- Governance evolution (🟠): the TRUST-PERSIST-1 wave will reshape the literals; the *historical record* of why `'pending_not_written'` was the default needs to survive the lift.

**Verdict:** 🟡 PROTECTED on present, 🟠 ATTENTION-DEPENDENT on extensions. The lifecycle helpers are well-anchored; the cross-surface propagation is convention.

**Recovery:** a single `buildLifecycleAuditMetadata` factory that all callers must use, with the default centralized in one place. The current pattern is multiple inline factories with the same default — the *what* repeats; the *why* is fragmented.

### P.5 — Constitutional reasoning continuity (🔴 across four of five)

This is the meta-surface — the property that the *vocabulary used to reason about constitutional choices* (CI-DEGRADED / CI-DRIFT / CI-FRAGMENTED / CI-VIOLATION; awareness erosion / cadence dilution / shape-identity collapse; ANCHORED / RECALLABLE / FADING / LOST) survives forward.

**Anchored by:**
- The docs corpus in `docs/ops/` (100+ entries as of 2026-05-08).
- CLAUDE.md as a stable reference but with no link to the meta-vocabulary docs.

**NOT anchored:**
- The CI-* state vocabulary lives only in [constitutional-failure-explainability](constitutional-failure-explainability.md) and reactor docs.
- The PV-1…6 operator-psychology vectors live only in [constitutional-awareness-explainability](constitutional-awareness-explainability.md).
- The MD-1…5 memory-decay mechanisms (this wave Track B) live only here.
- The OV-1…5 organizational-optimism vectors (this wave Track C) live only here.
- No reviewer-onboarding doc gathers the meta-vocabulary into a single read.

**Continuity properties:**
- Turnover (🔴): a contributor turning over *is* the loss of meta-vocabulary unless the docs corpus is read serially, which it is not.
- Time (🔴): each wave produces new meta-vocabulary; older meta-vocabulary becomes historical-only; the *cumulative meta-vocabulary* exists nowhere as a single artifact.
- Contributor churn (🔴): same as turnover — the meta-vocabulary is reviewer-memory-bound.
- Operator fatigue (🔴): the meta-vocabulary is the diagnosis of the fatigue itself; if it is lost, the fatigue cannot be named.
- Governance evolution (🟠): the only partial defense — each wave's meta-vocabulary is preserved in its own doc, so historical evolution is recoverable. But the meta-vocabulary's *current shape* is not consolidated.

**Verdict:** 🔴 NON-CONTINUOUS. The meta-vocabulary is the wave series' largest contribution and the platform's least-anchored knowledge. It is the layer most at risk of being one PR-cleanup away from removal.

**Recovery:** a single `docs/architecture/constitutional-vocabulary.md` consolidating CI-* states, PV-* psychology vectors, MD-* memory-decay mechanisms, OV-* optimism vectors, and the four-state grade vocabularies (AWARE / PARTIAL / DESENSITIZING / NORMALIZED; PRESERVED / RECALLABLE / FADING / LOST; RESISTED / SLIPPING / ACCEPTED / NATURALIZED; SUSTAINED / PROTECTED / ATTENTION-DEPENDENT / NON-CONTINUOUS). Linked from CLAUDE.md as required reading for any reviewer of a constitutional change.

## Five erosion forces — independent analysis

### F.1 — Turnover

The slowest of the five forces, and the most predictable. Each contributor leaving removes a layer of unwritten rationale. The defense against turnover is structural anchoring: literals that fail typecheck, tests that fail CI, banned-strings that fail review.

**Surfaces best protected against turnover:** governance memory (🟢).
**Surfaces worst protected:** forensic caution, constitutional reasoning continuity (🔴 each).

**Time horizon:** 12 months of normal turnover ablates the unwritten layer entirely. The structural layer survives.

### F.2 — Time

Time alone — without turnover, without churn, without explicit decisions — erodes through accretion. Each PR adds. The cumulative shape of the codebase drifts. Cross-references in docs go stale. CI-* states that were rare become modal. `'UNKNOWN'` becomes the default.

**Surfaces best protected against time:** governance memory (🟢 — typecheck does not erode).
**Surfaces worst protected:** forensic caution (🔴 — audit-event union accretes silently), constitutional reasoning continuity (🔴 — each wave's meta-vocabulary scrolls past).

**Time horizon:** 6–12 months of accretion. Erosion is visible in retrospect, invisible in real-time.

### F.3 — Contributor churn

Faster than turnover. Includes contractor cycles, team rotations, on-call rotations. Each churn removes review-attention-budget on the surfaces below the highest-priority threshold. Slow-drift surfaces lose the most.

**Surfaces best protected against churn:** governance memory (🟢).
**Surfaces worst protected:** replay caution (🔴 — RD-1…4 self-widen with new replay paths), forensic caution (🔴), constitutional reasoning continuity (🔴).

**Time horizon:** churn compounds turnover at ~2x rate. A 12-month turnover window may compound to a 6-month effective rationale-loss window under heavy churn.

### F.4 — Operator fatigue

Operator-side; bleeds into contributor-side via team posture. An operator who stops reading `tamperEvidence` at envelope 50 carries the habit into team conversation; the team's working mental model of "what tamperEvidence means" drifts. Operator fatigue is a force on the *cultural* layer, not the *type* layer.

**Surfaces best protected against operator fatigue:** governance memory (🟢 — operators don't read it directly).
**Surfaces worst protected:** constitutional reasoning continuity (🔴 — the meta-vocabulary is the diagnosis of fatigue; if lost, fatigue cannot be named).

**Time horizon:** 6 months of regular operator exposure to a surface forms the habit; 12 months calcifies it.

### F.5 — Governance evolution

The most ambivalent force. Governance evolution is *good* — the platform should be allowed to extend, refactor, mature. But every evolution is an opportunity to violate the existing constitutional discipline if the discipline is not co-located with the evolution mechanism.

**Surfaces best protected against governance evolution:** governance memory (🟡 — protected for the present family, vulnerable to new families).
**Surfaces worst protected:** replay caution (🔴 — every new replay path), forensic caution (🔴 — every new event type), constitutional reasoning continuity (🟠 — partial preservation in wave docs).

**Time horizon:** evolution-driven erosion is event-paced, not time-paced. Each wave is an erosion opportunity.

## Cross-cutting institutional preservation observations

### O.1 — The trust-class family is the only fully-anchored continuity surface

Across all five erosion forces, only the trust-class family ([types.ts](../../apps/web/lib/issuer-verification/types.ts), [policyReview.ts](../../apps/web/lib/issuer-verification/policyReview.ts), CLAUDE.md "Truth contract", banned-strings list) holds 🟢/🟡 across the five forces. Every other family has at least one 🔴 cell. The family demonstrates the *minimum viable anchoring shape* for institutional continuity: literal type + multi-paragraph docstring + repository-level prose + banned-strings defense + pure-transform architectural constraint.

The shape is replicable. It is not currently replicated for any of the other constitutional vocabularies.

### O.2 — The audit-event taxonomy is the largest accretion-driven erosion surface

The audit-event union ([auditEventTypes.ts](../../apps/api/backend/src/types/auditEventTypes.ts)) grows by ~3–5 entries per wave. Each entry follows the existing precedent. Two precedents are weak: collapse (TD-1 — `EMPLOYER_REVIEW_MUTATION_DENIED`) and absence (TD-2 — refusal rows, replay invocation rows, emergency declarations). After 12 months at current rate, the taxonomy will have 30+ entries; a substantial fraction will compound the gap.

The recovery path is structural — a `forensicScope` literal, a subtype discriminator, a refusal-event-type — but the cost is multi-PR. Without it, the surface is the platform's biggest 12-month continuity loss.

### O.3 — The override surface is acutely positioned for institutional collapse

[emergencyMode.ts](../../apps/api/backend/src/services/compliance/emergencyMode.ts) carries three independent gaps (in-process toggle, unrowed declaration, inflated UI copy) with no constraint statement linking them. The surface is the highest-visibility safety-posture surface in the product. Naturalization in onboarding (GA-5 from Track C) compounds at the rate of headcount growth. The platform has a recovery path (top-of-file constraint comment + EMERGENCY_DECLARED audit-event-type), and the recovery is low-cost. The current trajectory is 🔴 NATURALIZED within 12 months *unless* the recovery is taken.

### O.4 — The meta-vocabulary itself is the wave series' largest unanchored asset

The CI-* states, the PV-* operator vectors, the MD-* memory-decay mechanisms, the OV-* optimism vectors, the four-state grade vocabularies — these are the platform's diagnostic vocabulary for its own constitutional posture. They live in `docs/ops/` distributed across ~10 entries. No consolidated reference exists. CLAUDE.md does not link to them as required reading.

The asset is large and easily collected; the consolidation work is low-cost. Without it, every future wave's reviewers reconstruct the vocabulary from scratch — slowly, partially, with each wave's vocabulary slightly different from the prior wave's.

### O.5 — Continuity is achievable; the platform has demonstrated the shape on one family

The trust-class continuity story is the wave's optimistic finding. The platform *can* preserve constitutional reasoning across turnover, time, and evolution — the trust-class family proves it. The continuity work is not "unachievable" or "out of reach." It is the work of replicating the trust-class anchoring shape on the other four constitutional vocabularies.

The total work is bounded: 4–6 PRs spread across 2–3 waves, each carrying a single anchoring shape (constraint comment, structural literal, audit type, or doctrine doc). None is large; cumulatively they lift the platform from 🟠 / 🔴 to 🟡 / 🟢 across the continuity matrix.

## 36-month longitudinal projection

| Surface | Today | +12mo (no intervention) | +24mo (no intervention) | +36mo (no intervention) | +12mo (with recovery) |
|---|---|---|---|---|---|
| Governance memory | 🟢 | 🟢 | 🟡 | 🟡 | 🟢 |
| Replay caution | 🟠 | 🟠 / 🔴 | 🔴 | 🔴 | 🟢 (with provenance literal) |
| Forensic caution | 🔴 | 🔴 | 🔴 (deep) | 🔴 (calcified) | 🟡 (with forensicScope + subtype) |
| Survivability caution | 🟡 | 🟡 | 🟠 | 🟠 / 🔴 | 🟡 (with TRUST-PERSIST-1) |
| Constitutional reasoning continuity | 🔴 | 🔴 | 🔴 | 🔴 | 🟡 (with consolidated meta-vocab doc) |

**Pattern without intervention:** governance memory holds for ~24 months and then begins to slip on extension-discipline. The other four surfaces drift toward 🔴 or remain 🔴. The platform's institutional posture, three years out, would be one where one family is defended and four are calcified into degraded states.

**Pattern with recovery:** four of five surfaces ascend to 🟡 or 🟢 at the 12-month mark. The recovery work is bounded and replicable; the trust-class family is the template.

## Verdict

**Constitutional awareness continuity is sustained on one surface (governance memory), protected on one (survivability caution), attention-dependent on one (replay caution), and non-continuous on two (forensic caution, constitutional reasoning continuity).**

The trust-class family demonstrates that 🟢 SUSTAINED continuity is achievable with five overlapping structural anchors. No other constitutional family has matched the discipline; without that match, the four remaining surfaces are on a slow drift toward calcification.

The audit-event taxonomy is the largest accretion-driven erosion surface — 🔴 NON-CONTINUOUS today, growing wider per wave, with no structural defense against TD-1 collapse or TD-2 absence. Without intervention, the taxonomy is the platform's biggest 12-month continuity loss.

The constitutional reasoning meta-vocabulary itself — the diagnostic language the wave series has built — is the wave's largest unanchored asset. It is consolidatable; it is not consolidated. Without consolidation, every future wave's reviewers will reconstruct it from scratch, slightly differently each time.

**Strongest doctrine-awareness gain available:** consolidating the meta-vocabulary into a single `docs/architecture/constitutional-vocabulary.md` linked from CLAUDE.md as required reading. Low cost (gathering existing artifacts); high preservation impact (one canonical reference for CI-* states, PV-*, MD-*, OV-*, and the four-state grade vocabularies). The single highest-leverage continuity intervention available.

**Strongest constitutional-awareness surface today:** the trust-class family ([types.ts](../../apps/web/lib/issuer-verification/types.ts) + [policyReview.ts](../../apps/web/lib/issuer-verification/policyReview.ts) + CLAUDE.md "Truth contract" + banned-strings list). The only surface where every erosion force except governance evolution is structurally defended.

**Weakest institutional-memory surface:** the override declaration semantics ([emergencyMode.ts](../../apps/api/backend/src/services/compliance/emergencyMode.ts)). Three independent gaps with no constraint statement linking them, on the highest-visibility safety-posture surface in the product, with naturalization compounding at the rate of headcount growth.

**Biggest governance-amnesia risk:** the audit-event taxonomy ([auditEventTypes.ts](../../apps/api/backend/src/types/auditEventTypes.ts)). Self-widening, accretion-driven, 🔴 across four of five erosion forces. Without structural intervention, the surface naturalizes within 12–18 months.

**Track D score: 🟠 ATTENTION-DEPENDENT (with one 🟢 anchor and two 🔴 trajectories).** 5 🟢, 4 🟡, 7 🟠, 9 🔴 across 25 cells. **The platform has demonstrated that 🟢 SUSTAINED constitutional continuity is achievable on one family. The other four families are at 🟠 or 🔴 trajectory; the recovery is bounded, replicable, and not yet taken.**

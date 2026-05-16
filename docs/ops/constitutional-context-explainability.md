# Constitutional Context Explainability — W2-PR16B Track A

**Wave:** W2-PR16B — Constitutional Institutional Awareness
**Date:** 2026-05-08
**Status:** Review-only synthesis. No code changes, no merges.
**Risk class:** SAFE (read-only inventory).
**Companion to:** [governance-memory-awareness](governance-memory-awareness.md), [institutional-drift-psychology](institutional-drift-psychology.md), [constitutional-awareness-continuity](constitutional-awareness-continuity.md).
**Builds on:** [constitutional-awareness-explainability](constitutional-awareness-explainability.md), [longitudinal-governance-survivability](longitudinal-governance-survivability.md), [governance-awareness-survivability](governance-awareness-survivability.md), [constitutional-failure-explainability](constitutional-failure-explainability.md), [silent-fragmentation-awareness](silent-fragmentation-awareness.md), [replay-warning-psychology](replay-warning-psychology.md), [constitutional-response-continuity](constitutional-response-continuity.md), [escalation-explainability](escalation-explainability.md).

---

## What this track answers

PR15B Track A measured whether the *operator* remained aware of degradation across repeated exposure. **This track asks the institutional question: would the next contributor — onboarding six months from now, twelve months from now, three years from now — be able to *explain to themselves* why each constitutional choice was made, why a degradation literal exists, why a refusal returns nothing, why an outer envelope masks an inner classification?**

The risk vector here is **institutional forgetting**: the moment the rationale for a constitutional choice exits the codebase (because the wave that made it shipped, the docs that documented it scrolled, the reviewers who wrote it left), the choice degrades from a defended decision to an unloved invariant. The next contributor reading the codebase sees a literal, a gate, a missing audit row — and reads it not as "this is a costly defense" but as "this is unfinished work I should clean up."

The operator-awareness question is "does my eye see the signal?" The institutional-awareness question is "does my mind know why the signal is shaped that way?" An operator can lose the signal (PR15B). An institution can lose the *meaning of the signal*. This second loss is slower, larger, and harder to recover.

This track grades each of six constitutional-context vocabularies — replay, survivability, trust-class, override, drift, governance-fatigue — for whether a contributor today, with no docs-corpus reading and no prior-wave context, would correctly infer the rationale from the codebase alone.

## Awareness-grade vocabulary (institutional layer)

The four awareness-of-rationale states a contributor's mind can occupy when reading the codebase:

- **🟢 PRESERVED** — the rationale is anchored in the code itself: a comment that names the constraint, a type that narrows the literal, a banned-string that explains its ban, a test name that asserts the *why* in addition to the *what*. A contributor reading the code six months from now reads "this is here on purpose." The defense is structurally legible.
- **🟡 PARTIAL** — the rationale is anchored *somewhere* (a docs-corpus entry, a wave's review notes, a CLAUDE.md disclaimer) but not in the code path itself. A contributor who reads the code without finding the docs treats the rationale as conventional or arbitrary; a contributor who reads the docs reconstructs it. Awareness depends on the contributor finding the right doc.
- **🟠 ERODING** — the rationale exists only in conversation memory, in a wave's review thread, or in the heads of the reviewers who wrote it. The code path is silent about *why* it has the shape it has. After 6–12 months of contributor turnover, the rationale degrades into "this is how it has always been."
- **🔴 FORGOTTEN** — the rationale is absent from code, code-adjacent docs, and reviewer memory. A contributor encountering the shape proposes "cleaning it up" without realizing the shape was the defense. The defense is one PR away from removal.

These four grades stack with the operator-awareness grades from PR15B Track A. A literal can be 🟢 AWARE (operator notices it) and 🔴 FORGOTTEN (no contributor remembers why it was named that way) — these are independent failures.

## Six constitutional-context vocabularies

The six clusters of vocabulary the wave brief asks about. For each, the question is: **could a contributor reading [CLAUDE.md](../../CLAUDE.md) and the code path alone, with no docs-corpus reading, correctly explain why the choice exists?**

| Vocabulary | What a contributor must understand | Anchored where? | Grade | Why |
|---|---|---|---|---|
| **Replay semantics** | outer R-CAT-6 vs inner R-CAT-1…5; recorded vs replay-time computed fields; `tamperEvidence` semantics; `evidenceSnapshot.trustStateAtDecision` capturedAt discriminator | code structure ([replayEngine.ts:87-139](../../apps/api/backend/src/services/audit/replayEngine.ts), [runtimeTrustCohesion.ts:14-30](../../apps/api/backend/src/services/runtimeTrustCohesion.ts)); rationale lives in [silent-fragmentation-awareness](silent-fragmentation-awareness.md), [replay-warning-psychology](replay-warning-psychology.md) | 🟠 ERODING | the *types* are pinned (R-CAT enum, `mutationClassification` enum, `replayCategory` literal); the *why outer is always 6* lives only in docs |
| **Survivability semantics** | `eventState: 'pending_not_written' \| 'queued_demo_only' \| 'written'`; `recordedBy: 'demo' \| 'review_surface' \| 'system'`; the demo-flag end-to-end propagation; the bundle's silence about durability | code structure ([requestLifecycle.ts:167-168](../../apps/web/lib/issuer-verification/requestLifecycle.ts), [psvReceiptReuse.ts:141-142](../../apps/web/lib/issuer-verification/psvReceiptReuse.ts)); inline comment in [psvReceiptReuse.ts:31](../../apps/web/lib/issuer-verification/psvReceiptReuse.ts) names the default; rationale lives in [trust-fabric-durability-cohesion](trust-fabric-durability-cohesion.md) | 🟡 PARTIAL | the literal types and inline comments survive; the *why a default of pending_not_written exists* (TRUST-PERSIST-1 staged rollout) is doctrine-only |
| **Trust-class semantics** | `decisionGrade: false` literal on `ReceiptCandidate`; distinct `proofTier: 'receipt_candidate' \| 'psv_receipt_candidate' \| 'psv_receipt'` literals; the gating that promotes one to another only via [policyReview.ts](../../apps/web/lib/issuer-verification/policyReview.ts) | code structure ([types.ts:197, 217, 382, 384, 526, 533](../../apps/web/lib/issuer-verification/types.ts)) with multi-paragraph docstrings naming the truth contract verbatim; reinforced in [CLAUDE.md](../../CLAUDE.md) "Truth contract" section | 🟢 PRESERVED | the strongest constitutional vocabulary in the codebase: type-pinned, doc-string-explained, CLAUDE.md-reinforced, banned-strings-defended |
| **Override semantics** | `EmergencySwitch` declares; `evaluateEmergencyOverride` writes one audit row per override per credential; declaration itself is unrowed; `emergencyModeActive` is in-process | code structure ([emergencyMode.ts:8](../../apps/api/backend/src/services/compliance/emergencyMode.ts) `let emergencyModeActive = false`); copy in [EmergencySwitch.tsx:91](../../apps/web/components/employer/EmergencySwitch.tsx) overstates ("Action permanently logged to Audit Scrapbook"); rationale not in code | 🔴 FORGOTTEN | the in-process toggle reads as a stub; the misleading copy reads as an aspiration; nothing in the file path tells a contributor "this is intentionally not durable yet because…" |
| **Constitutional drift semantics** | the difference between contract-honest, structurally-honest, and surface-honest; the four CI-* states (HEALTHY / DEGRADED / DRIFT / FRAGMENTED / VIOLATION); the difference between an honest literal and an inflated rendering of an honest literal | nowhere in the code path; lives entirely in [constitutional-failure-explainability](constitutional-failure-explainability.md), [silent-fragmentation-awareness](silent-fragmentation-awareness.md), the five-class CI-* vocabulary | 🔴 FORGOTTEN | a contributor reading code never encounters the drift vocabulary at all; CI-* lives only in the docs corpus |
| **Governance-fatigue semantics** | the recognition that warnings dilute, dashboards normalize, demo flags soften under "polish" pressure, banned-strings lists are reactive; the meta-defense that names the failure modes themselves | nowhere in code; lives in [longitudinal-governance-survivability](longitudinal-governance-survivability.md), [replay-warning-psychology](replay-warning-psychology.md), [governance-awareness-survivability](governance-awareness-survivability.md) | 🔴 FORGOTTEN | the codebase contains the defenses; the codebase does not contain the *self-awareness that the defenses can erode* |

**Tally: 1 🟢, 1 🟡, 1 🟠, 3 🔴.**

**Pattern:** the trust-class vocabulary is the institutional gold standard — type literal + multi-paragraph docstring + CLAUDE.md reinforcement + banned-strings defense. Every other constitutional vocabulary is at least one step weaker. Three vocabularies (override, drift, fatigue) are 🔴 FORGOTTEN: their *what* may be visible in code; their *why* lives only in the docs corpus. After 6–12 months of contributor turnover, the docs corpus is the only artifact that knows.

## Per-vocabulary explainability analysis

### V.1 — Replay semantics (🟠 ERODING)

**What a contributor must understand:**
- Outer envelope `replayCategory: 'R-CAT-6'` is unconditional; inner mutation classification ([runtimeTrustCohesion.ts:14-30](../../apps/api/backend/src/services/runtimeTrustCohesion.ts)) records the original action class.
- `evidenceSnapshot.evidenceRecords` is recorded at decision time; `evidenceSnapshot.sourcesConsulted` is computed at replay time.
- `evidenceSnapshot.trustStateAtDecision.capturedAt` discriminates recorded-then from replay-fallback-now.
- `tamperEvidence` distinguishes hash mismatch / spine mismatch / generic ([replayEngine.ts:376-383](../../apps/api/backend/src/services/audit/replayEngine.ts)) — but says nothing about export drops, refusal-row absence, or replay-invocation absence.

**Where the rationale lives:**
- The R-CAT enum and mutation-classification enum are typed in [runtimeTrustCohesion.ts:14-30](../../apps/api/backend/src/services/runtimeTrustCohesion.ts) — a contributor sees the values exist.
- The *outer-vs-inner separation* is implicit in the structure but not commented; nothing in the file says "outer is dossier-replay envelope, inner is original action."
- The discriminator semantics live in [silent-fragmentation-awareness](silent-fragmentation-awareness.md), [replay-warning-psychology](replay-warning-psychology.md), and the round-trip test [replayEngine.runtimeCohesion.test.ts](../../apps/api/backend/src/services/audit/__tests__/replayEngine.runtimeCohesion.test.ts).

**Erosion mechanism:** a contributor adding a new replay path follows the precedent — outer envelope unconditional, no provenance marker on new computed fields, reuse of `tamperEvidence` for new error modes. Each follows the existing shape ([longitudinal-governance-survivability](longitudinal-governance-survivability.md) RD-1, RD-2, RD-4). The rationale erodes one PR at a time.

**Recovery path:** a header comment in [replayEngine.ts](../../apps/api/backend/src/services/audit/replayEngine.ts) naming the four invariants (outer-vs-inner separation, recorded-vs-computed boundary, capturedAt discriminator, tamperEvidence's three-message scope) would lift this from 🟠 to 🟡 immediately and from 🟡 to 🟢 if accompanied by a `provenance: 'recorded' | 'replay_time'` literal on each computed field.

**Grade: 🟠 ERODING.** The types hold; the *why the types are shaped this way* is not in the file.

### V.2 — Survivability semantics (🟡 PARTIAL)

**What a contributor must understand:**
- `eventState: 'pending_not_written' \| 'queued_demo_only' \| 'written'` discriminates emit-time from land-time. Default is `'pending_not_written'` ([requestLifecycle.ts:375](../../apps/web/lib/issuer-verification/requestLifecycle.ts), [psvReceiptReuse.ts:416](../../apps/web/lib/issuer-verification/psvReceiptReuse.ts)).
- `recordedBy: 'demo' \| 'review_surface' \| 'system'` discriminates the recording path. The demo path is the one where audit rows do not actually write.
- The bundle export does not surface either field — `bundleHash` is over what survived, no `partialExport`, no `requestedCount`.

**Where the rationale lives:**
- The literal types are pinned in [requestLifecycle.ts:167-168](../../apps/web/lib/issuer-verification/requestLifecycle.ts) and [psvReceiptReuse.ts:141-142](../../apps/web/lib/issuer-verification/psvReceiptReuse.ts).
- Inline JSDoc comments explain *what* the default means: "audit metadata, eventState defaults to 'pending_not_written' so [staged rollout]" ([psvReceiptReuse.ts:31](../../apps/web/lib/issuer-verification/psvReceiptReuse.ts), [requestLifecycle.ts:88](../../apps/web/lib/issuer-verification/requestLifecycle.ts)).
- The *why durability is staged* (TRUST-PERSIST-1, the largest single board blocker per [memory](../../README.md)) lives in the docs corpus and the wave PR descriptions.

**Erosion mechanism:** new lifecycle helpers may default to `'written'` (a contributor reading the docstring may infer "I'll just set it to written for my path") or omit `eventState` entirely. The convention "default to pending_not_written until durability lands" is enforced by precedent, not by typecheck — `eventState: 'written'` is type-valid for any new helper.

**Recovery path:** a typecheck-level guard like a `LifecycleSurfaceMustDefaultPendingNotWritten` brand on new audit-metadata builders, or a single audit-metadata factory that all callers must use. The current pattern is multiple inline factories.

**Grade: 🟡 PARTIAL.** Code-anchored at the literal level; convention-anchored at the default level; doctrine-anchored at the *why a default exists at all* level.

### V.3 — Trust-class semantics (🟢 PRESERVED)

**What a contributor must understand:**
- `ReceiptCandidate.decisionGrade` is the literal `false` ([types.ts:197](../../apps/web/lib/issuer-verification/types.ts)).
- `ReceiptCandidate.proofTier` is the literal `'receipt_candidate'` ([types.ts:217](../../apps/web/lib/issuer-verification/types.ts)).
- `PSVReceiptCandidate` is also literal `decisionGrade: false`, distinct `proofTier: 'psv_receipt_candidate'` ([types.ts:382-384](../../apps/web/lib/issuer-verification/types.ts)).
- `PSVReceipt` is literal `decisionGrade: true`, distinct `proofTier: 'psv_receipt'` ([types.ts:526, 533](../../apps/web/lib/issuer-verification/types.ts)).
- Promotion is gated: `accept_candidate` only, in `ready_for_policy_review` only, with five gates that fire in order ([policyReview.ts:67-100](../../apps/web/lib/issuer-verification/policyReview.ts)).

**Where the rationale lives — five overlapping anchors:**
1. The literal-typed types in [types.ts](../../apps/web/lib/issuer-verification/types.ts) with multi-paragraph docstrings naming the truth contract verbatim ("ReceiptCandidate.decisionGrade is the literal `false`. proofTier is the literal `'receipt_candidate'`. Do not widen…").
2. The five-gate sequence in [policyReview.ts:38-100](../../apps/web/lib/issuer-verification/policyReview.ts) with a top-of-file comment block naming all five gates and the promotion semantic verbatim.
3. The CLAUDE.md "Truth contract" section names the literals and the gates in repository-level prose.
4. The banned-strings list in CLAUDE.md prevents copy that would over-promote (`legally accepted`, `final verification without review`, `risk transferred`).
5. The pure-transform constraint ("This module is a pure transform — no fetches, no DB writes, no audit-event writes" [policyReview.ts:36](../../apps/web/lib/issuer-verification/policyReview.ts)) prevents drift toward I/O.

**Erosion resistance:** widening the literal fails typecheck. Removing a gate fails the test suite. Adding a new copy that overstates fails the banned-strings review. Skipping a gate by adding a different surface fails the pure-transform constraint. **Five layers — type, test, doctrine, copy, architecture — defend the same vocabulary.**

**Grade: 🟢 PRESERVED.** This is the codebase's institutional-awareness gold standard. A contributor reading [types.ts](../../apps/web/lib/issuer-verification/types.ts) and [policyReview.ts](../../apps/web/lib/issuer-verification/policyReview.ts) cold cannot weaken the vocabulary without breaking the build, failing a test, or violating a stated constraint.

### V.4 — Override semantics (🔴 FORGOTTEN)

**What a contributor must understand:**
- The `EmergencySwitch` is a domain-wide override.
- `emergencyModeActive` is a process-local boolean ([emergencyMode.ts:8](../../apps/api/backend/src/services/compliance/emergencyMode.ts)) — *not* persisted, *not* shared across workers, *resets on deploy*.
- The declaration writes a `log('warn', …)` line and no audit row.
- `evaluateEmergencyOverride` writes one `EMERGENCY_ESCALATION` audit row per override per credential — not per declaration.
- The UI copy "Action permanently logged to Audit Scrapbook" ([EmergencySwitch.tsx:91](../../apps/web/components/employer/EmergencySwitch.tsx)) describes the per-credential override, not the declaration.

**Where the rationale lives:**
- Nowhere in the code path. The file [emergencyMode.ts](../../apps/api/backend/src/services/compliance/emergencyMode.ts) opens with `// Internal global override switch (in production this would be Redis/Db backed)` — a single line that names the gap but not the *why*.
- The docs corpus ([escalation-explainability](escalation-explainability.md), [constitutional-response-continuity](constitutional-response-continuity.md), [governance-response-survivability](governance-response-survivability.md)) names the gap as 🔴 across operational coherence, survivability, and runtime-honesty.
- The mismatch between UI copy ("permanently logged") and the audit floor (zero rows) is not flagged in the code itself.

**Erosion mechanism:** a contributor reading [emergencyMode.ts](../../apps/api/backend/src/services/compliance/emergencyMode.ts) cold sees a `let` toggle and a TODO-style comment. They have two reasonable paths: (a) "this is a stub; let me wire Redis," which lifts durability without regard for the audit floor, or (b) "this is the design; let me add a feature on top," which compounds the absence. Neither path encounters the *why* — that the declaration writes no row because the per-credential override is the auditable artifact, that the in-process toggle is a deliberate placeholder for a redis/db lift, that the UI copy is an inflation pending repair.

**Recovery path:** at minimum, a top-of-file comment block naming the three properties — declaration is unrowed (the per-credential override is the artifact), toggle is in-process (the redis/db lift is wave-deferred), UI copy overstates (the inflation is known). Better: an `EMERGENCY_DECLARED` audit-event-type that the declaration writes, even on the demo path with `eventState: 'pending_not_written'`, so the floor is non-zero.

**Grade: 🔴 FORGOTTEN.** This is the constitutional vocabulary most at risk of accidental damage by a well-intentioned contributor. A "let me persist the toggle" PR could introduce backend persistence without addressing the audit floor; a "let me improve the copy" PR could remove the inflation without addressing the toggle. The override semantics would degrade from "incomplete but coherent" to "complete-looking but actually-wrong."

### V.5 — Constitutional drift semantics (🔴 FORGOTTEN)

**What a contributor must understand:**
- The four-state CI-* vocabulary: HEALTHY / DEGRADED / DRIFT / FRAGMENTED / VIOLATION ([constitutional-failure-explainability](constitutional-failure-explainability.md)).
- The difference between contract-honest (literal in code is correct), structurally-honest (the schema does not over-assert), and surface-honest (the rendering matches the literal).
- The five fragmentation surfaces: replay drift, export drift, lineage drift, survivability drift, dashboard optimism ([silent-fragmentation-awareness](silent-fragmentation-awareness.md)).

**Where the rationale lives:**
- Nowhere in the code path. The CI-* vocabulary is a docs-only construction.
- The PR review thread for each wave introduces it; merged code does not carry it.
- A contributor reading [replayEngine.ts](../../apps/api/backend/src/services/audit/replayEngine.ts) or [auditEventTypes.ts](../../apps/api/backend/src/types/auditEventTypes.ts) does not encounter "CI-DRIFT" or "CI-FRAGMENTED" anywhere.

**Erosion mechanism:** the entire vocabulary is review-discipline. Every PR that introduces a new constitutional choice — a new audit-event type that collapses subtypes, a new bundle field that asserts more than the contract earned, a new replay path that adds a computed field without provenance — does so without encountering the CI-* vocabulary in code. Reviewer awareness is the gate; reviewer turnover is the erosion.

**Recovery path:** the vocabulary is too abstract to anchor in a single file. Two partial recoveries: (a) a `docs/architecture/constitutional-vocabulary.md` linked from CLAUDE.md as required reading; (b) a CI-* tag convention in PR templates ("This PR introduces CI-DRIFT in surface X" / "This PR closes CI-VIOLATION on surface Y"). Neither makes the vocabulary code-anchored, but both raise the floor.

**Grade: 🔴 FORGOTTEN.** A contributor who has not read the docs corpus has no way to encounter the vocabulary. The vocabulary's existence is the only thing protecting it from ablation.

### V.6 — Governance-fatigue semantics (🔴 FORGOTTEN)

**What a contributor must understand:**
- Warnings dilute over repetition (`tamperEvidence: null` modal answer).
- Dashboards normalize over time (a constant-green status page reads as a stronger claim than its literals assert).
- Demo flags soften under "polish" pressure (every quarter someone asks "can we remove `recordedBy: 'demo'` from the disclaimer copy now?").
- Banned-strings lists are reactive (yesterday's inflation gets banned; tomorrow's inflation has not been listed yet).
- Convention-only defenses erode at the rate of contributor turnover ([longitudinal-governance-survivability](longitudinal-governance-survivability.md) GE-1).

**Where the rationale lives:**
- Nowhere in code. The meta-vocabulary lives only in [longitudinal-governance-survivability](longitudinal-governance-survivability.md), [replay-warning-psychology](replay-warning-psychology.md), and the PR15B/PR16B docs sequence.
- CLAUDE.md names the banned-strings list but does not name the meta-property "lists are reactive."
- The `recordedBy: 'demo'` literal is type-pinned but the *why three layers defend it* is doctrine-only.

**Erosion mechanism:** the meta-vocabulary is the property that protects all of the other vocabularies. Without it, a contributor reading any individual defense reads it as "this one rule" rather than as "an instance of a class of defense that is itself eroding." A contributor who proposes to soften the demo disclaimer copy has no encounter with the meta-property "demo gate is the load-bearing anti-inflation defense across all degradation modes" ([longitudinal-governance-survivability](longitudinal-governance-survivability.md) GE-5).

**Recovery path:** the meta-vocabulary requires a meta-document. The candidate is a `docs/architecture/governance-meta.md` that names the failure modes (cadence dilution, shape-identity dilution, drifting-modal dilution, reactive list incompleteness, convention erosion at turnover, demo softening, dashboard accretion) and binds them to CLAUDE.md as required reading for any reviewer of a constitutional change.

**Grade: 🔴 FORGOTTEN.** The meta-vocabulary is the wave's largest contribution and the platform's least-anchored knowledge. The platform knows that warnings dilute; the platform's code does not.

## Cross-cutting institutional patterns

### Pattern 1 — Code anchors *what*; docs anchor *why*

Every constitutional choice in the codebase has at least the *what* anchored: literal types, ordered gates, propagated demo flags, decoupled lane-health. The *why* concentrates in the docs corpus. The cross-section is uneven:

| Anchor type | Holds *what* | Holds *why* | Holds *what could go wrong* |
|---|---|---|---|
| Type literals | 🟢 | 🟡 (docstring, partial) | 🔴 |
| Test names | 🟢 | 🟡 (test name implies why, partial) | 🟡 (the test asserts the regression case) |
| Banned-strings list | 🟢 | 🟡 (CLAUDE.md disclaimer) | 🟠 (the list is the why; the meta-pattern is not) |
| Inline file headers | 🟡 (varies by file) | 🟡 (varies) | 🔴 |
| CLAUDE.md repository doc | 🟢 | 🟢 | 🟡 |
| `docs/ops/*.md` corpus | 🟡 (cross-references, not always direct) | 🟢 | 🟢 |
| PR review threads | 🟡 (decay over time) | 🟡 (decay over time) | 🟡 (decay over time) |
| Reviewer memory | 🟠 (turnover) | 🟠 (turnover) | 🟠 (turnover) |

**Pattern:** the *what* layer is type-defended and contributor-safe. The *why* layer is doctrine-defended and contributor-unsafe (a contributor can land a PR without ever reading it). The *what could go wrong* layer — the meta-vocabulary that protects all of the constitutional choices — has no anchor stronger than reviewer memory.

### Pattern 2 — Comment density correlates with vocabulary survivability

The trust-class vocabulary survives because [types.ts](../../apps/web/lib/issuer-verification/types.ts) and [policyReview.ts](../../apps/web/lib/issuer-verification/policyReview.ts) carry multi-paragraph docstrings at file-top, type-level, and function-level. Each docstring names not just the literal but the *constraint* — "Do not widen to `boolean` or other strings."

The override vocabulary erodes because [emergencyMode.ts](../../apps/api/backend/src/services/compliance/emergencyMode.ts) carries one inline TODO ("in production this would be Redis/Db backed") and no constraint statement.

**Conjecture:** comment density is the leading indicator of vocabulary preservation. The rule "comments rot, code doesn't" is reversed for constitutional vocabularies — the constraint statement is the only thing that keeps the code from being ablated by a refactor.

### Pattern 3 — Contributor onboarding has no constitutional checklist

A new contributor lands on the repo, reads CLAUDE.md, and starts on a PR. CLAUDE.md names the truth contract (V.3, 🟢) and the banned-strings list (a 🟢 fragment of V.6). It does not name:
- Replay outer-vs-inner separation (V.1)
- Survivability default rationale (V.2)
- Override-declaration unrowed (V.4)
- The CI-* drift vocabulary (V.5)
- The meta-vocabulary of governance-fatigue (V.6)

**Implication:** five of six constitutional vocabularies are not in the new-contributor onboarding path. The next reviewer is the first encounter; the docs corpus is a back-discovery. Every constitutional defense outside V.3 is one PR away from inadvertent ablation.

## Verdict

**Constitutional context explainability is preserved on one vocabulary (trust-class), partial on one (survivability), eroding on one (replay), forgotten on three (override, drift, governance-fatigue).**

The trust-class vocabulary is the institutional gold standard — five overlapping anchors (type, test, doctrine, copy, architecture) defend the same literal. It is the only constitutional vocabulary where a contributor cold-reading the code path arrives at the rationale without doc-corpus assistance.

The override vocabulary is the most acute erosion risk. The in-process toggle, the unrowed declaration, and the inflated UI copy each look like routine TODO items to a fresh reviewer. None of them carry a constraint statement explaining why the gap is a defense rather than a defect.

The constitutional-drift and governance-fatigue vocabularies are the platform's largest meta-contributions and have the weakest anchors. They live entirely in the docs corpus. A contributor who has not read the corpus has no encounter with them. After 12 months of contributor turnover, the docs corpus is the only artifact that remembers.

**Strongest constitutional-context surface:** the trust-class type contract. [types.ts](../../apps/web/lib/issuer-verification/types.ts) lines 197 and 217 carry the literals, the docstring carries the constraint, [policyReview.ts](../../apps/web/lib/issuer-verification/policyReview.ts) carries the gating, CLAUDE.md carries the prose. Five anchors, one literal, contributor-safe by construction.

**Weakest institutional-memory surface:** the override-declaration semantics in [emergencyMode.ts](../../apps/api/backend/src/services/compliance/emergencyMode.ts). One TODO comment, three undocumented properties (in-process toggle, unrowed declaration, mismatched UI copy), no constraint statement. A contributor reading the file cold has no way to know the gaps are intentional.

**Track A score: 🟠 ERODING.** 1 🟢, 1 🟡, 1 🟠, 3 🔴 across six vocabularies. The trust-class precedent demonstrates that 🟢 PRESERVED is achievable when the codebase is willing to spend comment density and overlapping anchors on the literal. The other five vocabularies do not yet pay that cost. **Constitutional context survives where the codebase argues for it and erodes where the codebase only enacts it.**

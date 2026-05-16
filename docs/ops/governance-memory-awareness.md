# Governance Memory Awareness — W2-PR16B Track B

**Wave:** W2-PR16B — Constitutional Institutional Awareness
**Date:** 2026-05-08
**Status:** Review-only synthesis. No code changes, no merges.
**Risk class:** SAFE (read-only inventory).
**Companion to:** [constitutional-context-explainability](constitutional-context-explainability.md), [institutional-drift-psychology](institutional-drift-psychology.md), [constitutional-awareness-continuity](constitutional-awareness-continuity.md).
**Builds on:** [governance-awareness-survivability](governance-awareness-survivability.md), [longitudinal-governance-survivability](longitudinal-governance-survivability.md), [replay-warning-psychology](replay-warning-psychology.md), [forensic-explainability](forensic-explainability.md), [forensic-durability-understanding](forensic-durability-understanding.md), [escalation-explainability](escalation-explainability.md), [dashboard-runtime-honesty](dashboard-runtime-honesty.md).

---

## What this track answers

PR15B Track B asked whether replay warnings remained psychologically meaningful to operators. **This track asks whether the warnings the platform emits remain *institutionally* meaningful — whether a contributor, operator, or reviewer encountering a warning six months from now, twelve months from now, or three years from now would (a) understand what it means, (b) understand why it was added, (c) understand what to do with it, and (d) treat it as a load-bearing defense rather than as historical decoration.**

A warning has a lifecycle. At wave-merge it is sharp: the reviewer who added it knows exactly why, the docs explain it, the connotation is fresh. Six months later the connotation softens. Twelve months later, if the warning has not fired in production, contributors begin to read it as inert. Three years later, if turnover is normal, the warning is in danger of being removed in a "let's clean this up" PR — not because anyone disputes its meaning, but because no one currently in the room remembers it.

The risk vector here is **memory decay**: the gradual, invisible loss of the *historical context* that gave a warning its weight. A warning that retains its meaning is institutionally survivable. A warning that has lost its context is a candidate for ablation by good faith.

This track inventories the platform's five warning families — governance, replay, override, forensic, dashboard — across four institutional-memory criteria: meaningful (does the warning say something specific?), understandable (would a fresh reader infer the meaning?), historically contextualized (is the *why it exists* durable?), institutionally survivable (would a turnover cycle preserve it?).

## Memory-awareness vocabulary

The four memory states a warning can occupy:

- **🟢 ANCHORED** — the warning is meaningful, understandable, contextualized in code or code-adjacent docs, and survives turnover. A new contributor encountering it correctly infers what it means and would not propose to remove it. Multiple anchors (type, test, doctrine, copy) reinforce.
- **🟡 RECALLABLE** — the warning is meaningful and understandable in the moment, but its historical context lives in docs the contributor may not read. A contributor who reads the docs reconstructs the *why*; a contributor who skips them treats the warning as "old defense, unclear purpose."
- **🟠 FADING** — the warning's *what* is still visible (the literal exists, the field is rendered) but the *why* is no longer in the codebase, the docs corpus is large enough that the relevant entry is hard to locate, and reviewer memory is the load-bearing layer. After 12 months of turnover the warning reads as conventional decoration.
- **🔴 LOST** — the warning still fires; nobody currently maintaining the codebase can articulate why. The warning's removal does not break a test, does not violate a constraint statement, does not contradict a comment. The warning survives by inertia and is ablate-able by a routine refactor.

These four grades are independent of the operator-awareness grades from PR15B Track B. A warning can be 🟢 AWARE (operator's eye notices it) and 🔴 LOST (institutional memory of why it exists is gone). They are different failures.

## Five warning families

The platform's warning families and the institutional-memory criteria they hold today.

### Family 1 — Governance warnings

**What's in the family:**
- The five-gate refusal sequence in [policyReview.ts:67-100](../../apps/web/lib/issuer-verification/policyReview.ts) (`action_does_not_create_candidate`, `wrong_office_cannot_create_candidate`, `unable_to_verify_cannot_create_candidate`, `conflict_review_unresolved`, `review_state_not_ready`, `legally_only_requires_limitation_note`).
- The truth-contract literals: `decisionGrade: false`, `proofTier: 'receipt_candidate' | 'psv_receipt_candidate' | 'psv_receipt'`.
- The pure-transform constraint stated in [policyReview.ts:36](../../apps/web/lib/issuer-verification/policyReview.ts).
- The `recordedBy: 'demo'` propagation across issuer-verification surfaces.
- The banned-strings list in CLAUDE.md.

| Criterion | Grade | Why |
|---|---|---|
| Meaningful | 🟢 | Each gate has a named reason; each literal is type-distinct |
| Understandable | 🟢 | Multi-paragraph docstrings name what each gate enforces |
| Historically contextualized | 🟢 | CLAUDE.md "Truth contract" prose preserves the rationale; the file-top docstring restates it |
| Institutionally survivable | 🟢 | Type system + tests + banned-strings + CLAUDE.md = four overlapping anchors |

**Composite: 🟢 ANCHORED.**

**Why the family holds:** every member of the family carries either a type that fails on widening, a test that fails on regression, a banned string that fails on inflation, or a constraint statement in the file. The family's institutional memory is co-located with the family's enforcement. A contributor proposing to remove a gate or widen a literal encounters the constraint statement before they encounter the freedom to remove it.

**Erosion vectors:** the only one of consequence is convention erosion at the *propagation* layer — `recordedBy: 'demo'` must be propagated to new surfaces, and the propagation is conventional rather than structural. PR15B Track A grades this at 🟢 in the type layer and ⚠️ in the propagation layer.

### Family 2 — Replay warnings

**What's in the family (per [replay-warning-psychology](replay-warning-psychology.md)):**
- `tamperEvidence: string | null` with three honest messages ([replayEngine.ts:376-383](../../apps/api/backend/src/services/audit/replayEngine.ts)).
- `evidenceSnapshot.anomaliesDetected: []` array.
- `evidenceSnapshot.trustStateAtDecision: 'UNKNOWN'` fallback literal.
- `evidenceSnapshot.trustStateAtDecision.capturedAt: null` discriminator.
- `replayCategory: 'R-CAT-6'` outer.
- `verifierIdentity.type: 'SYSTEM'` default.
- `actor.actorId: 'unknown'` fallback.

| Criterion | Grade | Why |
|---|---|---|
| Meaningful | 🟡 | The literals are distinct; their *cumulative* meaning across the envelope is not |
| Understandable | 🟠 | A fresh reader sees the values; no comment explains the recorded-vs-replay-time boundary, the outer-vs-inner separation, or the modal-drift implication |
| Historically contextualized | 🟠 | The rationale lives in [silent-fragmentation-awareness](silent-fragmentation-awareness.md), [replay-warning-psychology](replay-warning-psychology.md); the code path is silent |
| Institutionally survivable | 🟠 | Convention-only on the boundary, the separation, and the modal-drift; reviewer memory is the load-bearing layer |

**Composite: 🟠 FADING.**

**Why the family fades:** the type layer pins each literal correctly; no anchor explains *why* the literals are shaped this way. A contributor adding a fourth `tamperEvidence` message follows the precedent. A contributor adding a new computed `evidenceSnapshot` field places it next to the recorded fields without a provenance marker. A contributor reading `replayCategory: 'R-CAT-6'` outer without reading the docs corpus reads it as the action's category. Each individual contribution is locally reasonable; cumulatively the family loses its meaning.

**Erosion vectors:** RD-1 (replayCategory semantic widening), RD-2 (tamperEvidence overuse), RD-3 (evidenceSnapshot recorded-vs-computed widening), RD-4 (authority chain replay-time inference normalization) — four named drift vectors from [longitudinal-governance-survivability](longitudinal-governance-survivability.md).

**Recovery path:** a header comment block in [replayEngine.ts](../../apps/api/backend/src/services/audit/replayEngine.ts) naming the four invariants would lift this family from 🟠 to 🟡 immediately. A `provenance: 'recorded' | 'replay_time'` literal on each computed field would lift it to 🟢.

### Family 3 — Override warnings

**What's in the family:**
- The `EmergencySwitch` UI control with confirmation dialog.
- "EMERGENCY ACTIVE" label.
- "DECLARE EMERGENCY" button copy.
- "Action permanently logged to Audit Scrapbook" caption ([EmergencySwitch.tsx:91](../../apps/web/components/employer/EmergencySwitch.tsx)).
- The backing service [emergencyMode.ts](../../apps/api/backend/src/services/compliance/emergencyMode.ts):
  - `let emergencyModeActive = false` in-process toggle.
  - `log('warn', 'Emergency governance status change', …)` declaration log.
  - `EMERGENCY_ESCALATION` audit row per credential per override (not per declaration).
  - 72-hour TTL escalation.

| Criterion | Grade | Why |
|---|---|---|
| Meaningful | 🟡 | The UI is striking on day 1; the audit floor is silently zero on declaration |
| Understandable | 🔴 | The UI copy *contradicts* the backend behavior ("permanently logged" vs zero rows). A fresh reader cannot reconcile them |
| Historically contextualized | 🔴 | The rationale for declaration-unrowed-but-override-rowed lives nowhere; the in-process toggle has one TODO comment |
| Institutionally survivable | 🔴 | Convention-only at every layer; UI copy is unilaterally editable; toggle is unilaterally persistable |

**Composite: 🔴 LOST.**

**Why the family is lost:** the override warning surface is a Cartesian collision of three independent gaps — UI overstatement, backend in-process state, missing declaration audit. None of the three carries a constraint statement in code. A contributor who tries to fix any one of them in isolation makes the other two worse:
- "Let me wire Redis" → declaration is now durable across processes, the UI copy still overstates, the audit floor is still zero on declaration. The system looks more complete but is less honest (the inflation is now persistent).
- "Let me clean up the UI copy" → the UI no longer overstates, but the audit-row gap is now the only signal, and there is no signal at all on declaration.
- "Let me add an EMERGENCY_DECLARED audit type" → the audit floor is non-zero, but the declaration is still in-process and the UI still overstates relative to durability.

**Erosion mechanism:** GE-5-adjacent (demo-gate softening pressure) but inverted — instead of pressure to soften an honest disclaimer, this family's pressure is to *complete* an inflated promise. Either direction breaks coherence.

**Recovery path:** documented in [Track A V.4](constitutional-context-explainability.md). Minimum: top-of-file constraint block in [emergencyMode.ts](../../apps/api/backend/src/services/compliance/emergencyMode.ts) naming the three gaps. Better: an `EMERGENCY_DECLARED` audit-event type that writes on declaration with `eventState: 'pending_not_written'` until the durability lift lands.

### Family 4 — Forensic warnings

**What's in the family:**
- The audit-event union ([auditEventTypes.ts](../../apps/api/backend/src/types/auditEventTypes.ts)) — what an investigator can query.
- The absence of refusal rows ([policyReview.ts](../../apps/web/lib/issuer-verification/policyReview.ts) writes none — pure transform).
- The absence of replay-invocation rows ([replayEngine.ts](../../apps/api/backend/src/services/audit/replayEngine.ts) emits no `REPLAY_PERFORMED`).
- `EMPLOYER_REVIEW_MUTATION_DENIED` collapsing three reasons into one type.
- The bundle's silence about durability of source rows.
- `eventState` literal at the lifecycle layer with no surface binding.

| Criterion | Grade | Why |
|---|---|---|
| Meaningful | 🟠 | The rows that exist say specific things; the rows that are absent say nothing |
| Understandable | 🟠 | A fresh investigator reads the audit-event union as *the catalog of what the platform records*; the union is silently incomplete |
| Historically contextualized | 🟠 | The "no rows for refusals" precedent ([avoid-feedback-loop](forensic-durability-understanding.md)) lives in docs; the code path is silent |
| Institutionally survivable | 🔴 | The precedent is self-widening: every new helper inherits "this kind of decision is a decision-without-record" |

**Composite: 🟠 FADING (with 🔴 trajectory).**

**Why the family fades:** the audit-event union grows by accretion. Each PR that adds a new event type follows the existing precedent. Two precedents are unfortunate: (a) `EMPLOYER_REVIEW_MUTATION_DENIED` collapsing three reasons (precedent for "one type, many causes") and (b) `policyReview.ts` writing nothing (precedent for "this kind of decision is a decision-without-record"). Both compound.

**Erosion vectors:** TD-1 (audit-event taxonomy collapse — 🔴), TD-2 (audit-event taxonomy absence — 🔴) from [longitudinal-governance-survivability](longitudinal-governance-survivability.md). The forensic family's institutional memory degrades fastest of any family because the failure mode is *additive*: every PR that adds an event type is an opportunity to compound the gap.

**Recovery path:** the recovery is a structural lift, not a comment lift. Either a "subtype-per-cause" convention pinned by reviewer guidance or a structural test like "every new event type must carry a `forensicScope` enum naming what it records." Without a structural lift, the family will be 🔴 LOST within 12–18 months at current contribution rate.

### Family 5 — Dashboard warnings

**What's in the family:**
- The status page header disclaimer: "Status surfaces are foundation previews. No uptime guarantee is implied." ([status/page.tsx:36-39](../../apps/web/app/status/page.tsx)).
- `uptimeGuaranteeImplied: false` literal rendered in the Invariants section.
- The lane-health badge with `LIVE / DEGRADED / UNAVAILABLE / RATE_LIMITED / UNKNOWN` variants ([LaneHealthBadge.tsx](../../apps/web/components/source-health/LaneHealthBadge.tsx)).
- The "trust-state decoupled from lane-health" architectural property.
- The compliance-evidence section with `redactionLive` / `retentionEnforced` / `allAdaptersLive` literals.
- The "Disclaimers" section listing planned-not-wired surfaces.

| Criterion | Grade | Why |
|---|---|---|
| Meaningful | 🟢 | Each disclaimer makes a specific claim; each literal is a value, not a status |
| Understandable | 🟢 | The page is plain prose; the literals are typed boolean values |
| Historically contextualized | 🟡 | The page's rationale lives in DOCS-STATUS-1 (commit [5d530f13](https://github.com/anthropics/vitalcv) — most recent commit); the page itself names the disclaimer principle |
| Institutionally survivable | 🟡 | The page is small today; future expansion under "polish" pressure could soften |

**Composite: 🟡 RECALLABLE.**

**Why the family is borderline:** the dashboard family today is the platform's strongest *honest disclaimer* surface. The page header carries a constant principled disclaimer, the literals are boolean (not "OK"/"UNHEALTHY"), the lane-health badge variant is genuinely variable. But the family's institutional memory is single-anchored: the page itself. Unlike the governance family (five anchors) or the trust-class family (five anchors), the dashboard family relies on the page's own copy carrying the *why* alongside the *what*.

**Erosion vectors:** DD-1 (status page expansion without survivability disclosure — 🟡), DD-2 (new dashboards inherit happy-path styling — 🟠), DD-3 (lane-health-decoupling dilution — 🟠), DD-4 (bundle JSON shape inflation by accretion — 🔴) from [longitudinal-governance-survivability](longitudinal-governance-survivability.md).

**Recovery path:** the family is psychologically defended today by the page's principled-disclaimer header. The recovery work is preventive — a `docs/architecture/dashboard-doctrine.md` linked from CLAUDE.md naming the three properties (always-on disclaimer, boolean literals not statuses, decoupling from trust state) so a future "polish" wave does not ablate them silently.

## Cross-family memory-awareness scoreboard

| Family | Meaningful | Understandable | Historically contextualized | Institutionally survivable | Composite |
|---|---|---|---|---|---|
| Governance | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 ANCHORED |
| Replay | 🟡 | 🟠 | 🟠 | 🟠 | 🟠 FADING |
| Override | 🟡 | 🔴 | 🔴 | 🔴 | 🔴 LOST |
| Forensic | 🟠 | 🟠 | 🟠 | 🔴 | 🟠 FADING (🔴 trajectory) |
| Dashboard | 🟢 | 🟢 | 🟡 | 🟡 | 🟡 RECALLABLE |

**Tally across 20 cells:** 7 🟢, 4 🟡, 6 🟠, 3 🔴.

**Pattern:** the governance family holds across all four criteria (the truth-contract gold standard). The dashboard family holds on present-time meaningfulness/understandability, partial on historical-context and survivability. Three families (replay, override, forensic) cluster in 🟠/🔴 across at least three criteria — these are the families whose institutional memory is depending on reviewer recall.

## Five mechanisms by which warning meaning decays

The five named mechanisms by which a warning loses its institutional weight, in approximate order of leverage.

### MD-1 — Cadence dilution (the warning fires too often or too rarely)

A warning fires on every read (R-CAT-6 outer): institutionally it ceases to be a warning and becomes a header. A warning fires almost never (`tamperEvidence: null` modal): the rare firing is salient, but every reasoning step taken in between assumes "tamperEvidence is null" — the warning's *contextual frame* is eroding even as the warning's salience holds.

**Affected families:** replay (the canonical case), forensic (absent rows are 100%-cadence "no event").

**Severity:** 🟠.

### MD-2 — Shape-identity collapse (the warning looks like a non-warning)

A warning has the same shape as a healthy state — `'unknown'` looks like a value, `null` looks like absence, `[]` looks like nothing-to-report. The contributor reads the warning's shape as routine state. The warning's institutional weight evaporates because the warning never visually distinguishes itself.

**Affected families:** replay (the modal `'UNKNOWN'`/`null`), forensic (absent rows), override (in-process toggle reads as a stub rather than as a deliberate placeholder).

**Severity:** 🟠 in the strongest cases, 🔴 in override.

### MD-3 — Inflated copy attached to deflated reality (the UI lies *about* the warning)

The UI says "permanently logged to Audit Scrapbook." The audit floor on declaration is zero. The warning's institutional memory degrades because the surface is *actively contradicting* the backend, and a contributor who reads only the UI gets the wrong model. A contributor who reads only the backend cannot reconstruct the UI's intent.

**Affected families:** override (the canonical case).

**Severity:** 🔴. This is the worst memory-decay shape because every reader gets a different wrong model.

### MD-4 — Documentation drift (the rationale moves out of the codebase)

The rationale for a warning lives in the docs corpus. The docs corpus is large. Cross-references point at line numbers that have moved. New contributors do not navigate the corpus by reading every entry. A warning's *what* persists in code; its *why* slips out of reach.

**Affected families:** replay, forensic, override (all three have rationale concentrated in docs/ops/), dashboard (partial — the page itself carries some rationale).

**Severity:** 🟠.

### MD-5 — Convention erosion at turnover (reviewer memory is the floor)

The propagation of `recordedBy: 'demo'` to a new surface, the choice not to default `eventState` to `'written'` in a new helper, the discipline to add a separation gate when introducing a new replay path — each is reviewer-memory-load. As the proportion of reviewers who wrote the convention drops, the convention's pull weakens. After 12 months the convention is a folk practice; after 24 months a contributor's "let's clean this up" PR ablates it.

**Affected families:** replay (RD-1…4), forensic (TD-1…2), override (declaration-row absence), dashboard (DD-2 inherits-happy-path-styling).

**Severity:** 🟠 across all affected families.

## Three institutional risks specific to VitalCV's governance posture

### IR-1 — The override family is the load-bearing public-facing failure

The override surface is the single warning family every demo touches: every prospect sees the EmergencySwitch, every regulator-facing pitch shows it, every pilot demo includes the moment of "and here is how we declare emergency." Its 🔴 LOST memory state means the warning that the public most associates with VitalCV's safety posture is the warning whose institutional memory is most degraded. The mismatch between UI copy and backend behavior is durable across every demo until either (a) a contributor inadvertently fixes the UI without fixing the backend (worse) or (b) an external reader notices and challenges (worst). [override warning analysis above.]

### IR-2 — The forensic family is the load-bearing audit-facing failure

A regulator, auditor, or opposing-counsel forensic reader will land on the audit-event taxonomy ([auditEventTypes.ts](../../apps/api/backend/src/types/auditEventTypes.ts)) as their canonical reference. The taxonomy's silence about its own gaps — that refusals are unrowed, that replay invocations are unrowed, that `EMPLOYER_REVIEW_MUTATION_DENIED` collapses three reasons — is the gap most likely to surface as a question in a real investigation. The 🟠 FADING (🔴 trajectory) memory state means by the time the question arrives, no one currently in the room may remember the rationale.

### IR-3 — The replay family is the load-bearing future-doctrine failure

The replay envelope is the platform's most condensed signal channel. Every audit replay is a single JSON object containing seven candidate warnings ([replay-warning-psychology](replay-warning-psychology.md)). The 🟠 FADING memory state across the family means each of those warnings is a candidate for institutional ablation by accretion. The replay envelope is also the platform's primary forensic-survivability surface, so every degradation in the family compounds against the survivability story.

## Recovery cost / value matrix

| Recovery action | Family lifted | Cost | Value | Priority |
|---|---|---|---|---|
| Top-of-file constraint comment in [emergencyMode.ts](../../apps/api/backend/src/services/compliance/emergencyMode.ts) | Override | very low | high (lifts the file from 🔴 to 🟠) | 🟢 do this first |
| `EMERGENCY_DECLARED` audit-event type with `eventState: 'pending_not_written'` | Override | low | high (lifts UI/backend coherence; non-zero floor on declaration) | 🟢 do this second |
| Header comment block in [replayEngine.ts](../../apps/api/backend/src/services/audit/replayEngine.ts) naming four invariants | Replay | very low | medium (lifts family from 🟠 to 🟡) | 🟢 |
| `provenance: 'recorded' \| 'replay_time'` literal on computed envelope fields | Replay | medium | high (lifts family to 🟢; structural defense against RD-3, RD-4) | 🟡 next wave |
| Subtype-per-cause convention with reviewer-guidance doc | Forensic | low | medium (slows TD-1 widening) | 🟡 |
| Structural `forensicScope` enum on every audit-event-type | Forensic | high | high (closes TD-1, TD-2 structurally) | 🟠 future wave |
| `docs/architecture/dashboard-doctrine.md` linked from CLAUDE.md | Dashboard | low | medium (preserves the disclaimer principle through future polish) | 🟡 |

## Verdict

**Governance memory awareness is anchored on one family (governance), recallable on one (dashboard), fading on two (replay, forensic), and lost on one (override).**

The governance family demonstrates that 🟢 ANCHORED is achievable with overlapping anchors — type, test, doctrine, copy, architecture. Each member of the family carries a constraint statement, a regression test, and a CLAUDE.md prose entry. The family's institutional memory is co-located with the family's enforcement.

The override family is the warning surface most at risk — the UI copy actively contradicts the backend behavior, the in-process toggle reads as a stub, the unrowed declaration is invisible. Three independent gaps with no constraint statement linking them.

The replay and forensic families fade by accretion. Each new contribution follows existing precedent, and the precedents are leaky enough that compounding is the default. Both families' institutional memory is depending on reviewer recall, which decays at the rate of contributor turnover.

**Strongest governance-memory surface:** the trust-contract literal types ([types.ts](../../apps/web/lib/issuer-verification/types.ts) lines 197, 217, 382, 384, 526, 533) plus the five-gate sequence in [policyReview.ts](../../apps/web/lib/issuer-verification/policyReview.ts) — the only family where the *what*, the *why*, and the *what could go wrong if removed* are all anchored in code.

**Weakest institutional-memory surface:** the override warning family — the EmergencySwitch UI copy + the in-process toggle + the unrowed declaration. The Cartesian collision of three independent gaps with no constraint statement in code linking them, on the warning surface most often shown publicly.

**Track B score: 🟠 FADING.** 7 🟢, 4 🟡, 6 🟠, 3 🔴 across 20 cells of family × criterion. **One family of five is institutionally survivable across all four criteria; one is in active institutional collapse; the remaining three are erosion candidates within the next 12-month turnover window.**

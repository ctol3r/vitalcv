# W2-PR7B — Operator Mental Model Integrity

**Wave:** W2-PR7B — Trust-State Operational Cohesion
**Date:** 2026-05-08
**Status:** Review-only. No code changes, no merges.
**Risk class:** SAFE (read-only synthesis).
**Companion to:** [w2-pr7b-trust-state-topology.md](w2-pr7b-trust-state-topology.md), [w2-pr7b-runtime-semantics-cohesion.md](w2-pr7b-runtime-semantics-cohesion.md).

---

## Method

For each operator-touchable surface, ask: would a competent operator, on first encounter, form a mental model that matches what the system actually does? Score:

- 🟢 **UNDERSTANDABLE** — surface and behavior agree without prior context
- 🟡 **PARTIAL** — agrees on common path, fragments on edge or composed states
- 🟠 **CONFUSING** — common path requires explanation; edges land wrong
- 🔴 **MISLEADING** — surface implies something materially stronger or different from behavior

Non-goal: scoring beauty or polish. Scoring whether the operator's working model is correct.

## Surface-by-surface assessment

### Lane health on `/passport/[id]` and `/employer/dashboard` 🟢

5 states, 5 colors, 5 labels. Live → green. Degraded / Rate limited → yellow. Unavailable → red. Unknown → outline. The operator sees the state, the operator knows what it means. `LaneHealthBadge.tsx:64` explicitly forbids verified-style chrome on non-LIVE states; this prevents the most likely misread.

**Working model the operator will form:** "If a source lane is yellow or red, that data is stale or absent right now." This matches reality.

**Failure mode:** none observed.

### Compliance evidence on `/status` 🟢

Three booleans + three counts: redaction live, retention enforced, all adapters live. The page header explicitly disclaims "foundation previews. No uptime guarantee is implied" (per `statusCopy.ts:297`). No "Verified" or "Compliant" claims anywhere on this page.

**Working model:** "These are flags showing whether the compliance scaffolding is wired, not whether the system is certified compliant." Matches reality.

**Failure mode:** an operator may want a richer status (per-policy retention timestamps, last-redaction-run); the page does not pretend to provide that.

### Issuer review surfaces (`/issuer/{review,policy-review}/[requestId]`) 🟢

Each `ReceiptCandidateReviewState` and `PolicyReviewDecisionStatus` value has distinct copy in `statusCopy.ts`. Demo origin is structural (`recordedBy: 'demo'`) and visible. No state label is bare "Verified."

**Working model:** "I am reviewing a candidate; the system tells me which gate is open or closed; nothing happens until I act."

**Failure mode:** the visual proximity of "Accepted as PSV receipt candidate" to copy in other surfaces that say "PSV verified" can blur the literal distinction (candidate vs receipt). A new reviewer might assume acceptance is the end of the chain — it isn't (promotion is gated separately).

### Issuer-verification chain — Receipt candidate → PSV receipt candidate → PSV receipt 🟢

The literal types do the explainability for engineers. For an operator, the copy chain is consistent. The five-gate refusal vocabulary in code (`action_does_not_create_candidate / wrong_office_cannot_create_candidate / …`) is engineering-grade; if surfaced to operators, it would need translation. Today it is internal.

**Working model:** "Three tiers — candidate, PSV candidate, PSV receipt — each is a deliberate gate, none is automatic."

**Failure mode:** none for the current operator audience (engineering / pilot). For a wider audience, the gate codes would need readable copy.

### Passport readiness card 🟡

`ReadinessStatus` has 4 values (`DECISION_GRADE / CHECKING / BLOCKED / PARTIAL`) but the badge has 3 visual buckets (`checked / pending / blocked`). Worse: when no explicit status is set, the badge is **score-driven** — a high score yields green even if the underlying status is ambiguous.

**Working model an operator will likely form:** "Green badge means ready. Yellow means working on it. Red means I can't use it." This is *almost* right, but it elides the case where `BLOCKED` is masked by score, or `PARTIAL` is shown identically to `CHECKING`.

**Failure mode:** in a small but real fraction of edge cases, the badge color tells a slightly more confident story than the underlying status object. Today this is engineering-correct; for the operator audience it is **partial**.

**Mitigation already in place:** the readiness `score` is shown alongside the badge, so an attentive operator can disambiguate. Inattentive operators will form the simpler mental model.

### Employer review acceptance and denial 🟠

Three different denial conditions (`already_accepted / passport_unavailable / acceptance_blocked`) emit one audit event type (`EMPLOYER_REVIEW_MUTATION_DENIED`). The reason is in the row payload; no UI surface today exposes it. `acceptance_blocked` has a non-obvious cause: it triggers when `PassportState.readiness !== READY`, which is itself a derived value.

**Working model an operator will likely form:** "Acceptance was denied. I'm not sure why." The audit count metric will read as a single bucket, which biases an operator's intuition toward "denials happen sometimes" rather than the more useful "denials happen for one of these three structural reasons."

**Failure mode:** an operator investigating denial trends will need to drop into row payloads, since the current event-type-level granularity flattens reasons. Not a correctness bug — a mental-model gap.

### Employer review and issuer verification, taken together 🟠

These are two parallel state machines that touch the same passport. They share no denial vocabulary. Acceptance gates only on `readiness`, not on whether the latest issuer response was `unable_to_verify`. An operator working only one side will not perceive the other side's state.

**Working model an operator on the employer side will likely form:** "If readiness is green, the passport is accepted-eligible." This is *correct* per the code path, but it does not capture that `readiness` is a derived metric whose inputs include source coverage but **not** the latest issuer-verification refusal gate. Two operators with different starting screens can form mutually consistent but incomplete models, neither of which catches the seam.

**Failure mode:** edge cases at the seam (issuer responded `unable_to_verify`; readiness still computes `READY` from source coverage; employer accepts) are technically possible. They may or may not be common in practice — the system has no production traffic, so we cannot say. The mental-model risk is real either way.

### Replay output (operator-facing replay panel) 🟠

There is no UI surface for replay today. When one is added, the current `DecisionReplay` envelope mixes:
- recorded fields (`runtimeTrust.correlationId / payloadHash / mutationFingerprint`)
- computed fields (`evidenceRecords / trustStateAtDecision / authorityChain`)
- normalized fields (the outer `replayMetadata` is unconditionally R-CAT-6)

Without a clear visual divider, an operator viewing replay will not know which is which. Worse: the unconditional R-CAT-6 on the replay envelope can be misread as "this was always a dossier replay action," when it actually means "this *is* a replay event, regardless of original action."

**Working model an operator will likely form when this UI lands:** "All these fields are facts about what happened then." Reality: some are facts about then, some are reconstructions made now, one is a normalization artifact of the replay channel itself.

**Failure mode:** any future replay UI must explicitly separate recorded from reconstructed, or the operator's mental model will be wrong.

### Audit write status 🟠

Today: invisible. There is no UI surface that tells an operator whether a given audit event was actually persisted, simulated, or deferred. The default state is `pending_not_written`. The reference writer never claims `persisted`.

**Working model an operator will likely form today:** "I clicked the button; an audit row was written." Reality: in most local / demo configurations, no row was durably written.

**Failure mode:** when a real persistence wave lands, the new UI must tell the operator the difference. Without that, durability claims will read as identical to non-durable demo claims.

**This is the largest mental-model gap in the system.** It is also the most surfaced of the three "no UI yet" gaps in the topology — it is the one TRUST-PERSIST-1 is built to address.

### Provenance vs readiness, taken together 🟡

Lane health and readiness can disagree without contradicting. A credential can be `DECISION_GRADE` while one of its lanes is `RATE_LIMITED`. There is no rollup signal that says "your readiness was computed against partially-stale source health." Both surfaces are individually correct; together, they leave a small window where an operator's intuition ("everything is green, so everything is fresh") can drift from reality ("readiness was computed before lane went degraded").

**Working model:** likely correct on common path, drifts on edge.

**Failure mode:** correlated freshness — a lane goes degraded, readiness was computed an hour ago and stays green for a while. Engineering-acceptable; mental-model **partial**.

## Summary scorecard

| Surface | Score | Top failure mode |
|---|---|---|
| Lane health | 🟢 UNDERSTANDABLE | none observed |
| Compliance evidence (`/status`) | 🟢 UNDERSTANDABLE | richer detail wanted; no false claim |
| Issuer review surfaces | 🟢 UNDERSTANDABLE | candidate-vs-receipt blur for new reviewers |
| Issuer-verification chain (engineering view) | 🟢 UNDERSTANDABLE | gate-code copy needs translation if widened |
| Passport readiness card | 🟡 PARTIAL | composed badge masks `BLOCKED`-with-score |
| Employer review denial | 🟠 CONFUSING | three reasons → one event type |
| Employer ↔ issuer seam | 🟠 CONFUSING | parallel workflows, no shared vocabulary |
| Replay output (when surfaced) | 🟠 CONFUSING | recorded / computed / normalized mixed |
| Audit write status | 🟠 CONFUSING | invisible today; will need explicit copy when surfaced |
| Provenance vs readiness | 🟡 PARTIAL | freshness rollup drift |

No 🔴 MISLEADING surfaces observed. No banned-string violations. Two 🟢 surfaces, two 🟡 surfaces, four 🟠 surfaces. The pattern is consistent: **the surfaces that exist today are honest; the surfaces that don't yet exist are where the mental-model gap lives.**

## What "🟠 CONFUSING" does and does not mean

🟠 here means an operator working unaided will form an incomplete model that will let them down on edges. It does **not** mean the system is unsafe. The truth contract holds at every literal boundary; banned-string doctrine holds; demo-vs-real boundary is structural. The gaps are **explainability gaps that a UI surface or a written runbook can close** — they are not contract violations.

The next operator-surface wave should treat the four 🟠 items as its primary backlog.

# W2-PR3C - Autopilot Language Review

**Status:** Autopilot, recommendation, and readiness wording review. No product code changed.  
**Scope:** Career autopilot, employer recommendations, decision queue, next-best-action copy, and readiness labels.

## Autopilot Rule

Autopilot is an assistive planning metaphor only. User-visible copy must not imply autonomous action, guaranteed outcomes, or automatic acceptance.

Allowed:
- "Suggested next step"
- "Recommended action"
- "Assistive recommendation"
- "Review suggestion"
- "Based on observed patterns"
- "Requires human review"

Forbidden:
- "Autonomous"
- "Execute recommendation"
- "Approve Candidate" as a recommendation label
- "Reject Candidate" as a recommendation label
- "100% verified"
- "1-click apply"
- "cannot be deployed" unless a real blocking rule has fired and the scope is explicit
- "reach Decision Grade" without saying which source-dependent gaps remain

## Surface Findings

| Surface | Evidence | Drift | Required cleanup |
|---|---|---|---|
| `careerAutopilot.ts` blocker suggestion | "You cannot be deployed until this is cleared." | Treats the suggestion engine as an authority over deployment. | "This finding blocks source-backed readiness until reviewed or resolved." |
| `careerAutopilot.ts` NPPES suggestion | "to reach Decision Grade" | Implies one action deterministically reaches a higher grade. | "to improve source coverage; final readiness depends on all required lanes." |
| `careerAutopilot.ts` target-role suggestion | "100% verified and ready for 1-click apply" | Direct overclaim: no 100% guarantee, no 1-click apply guarantee. | "Required source-backed claims are attached for this snapshot; continue through the application workflow." |
| `EmployerNextBestAction.tsx` | "System Recommendation", "Approve Candidate", "Reject Candidate" | Recommendation UI uses final-decision verbs. | "Suggested next action", "Proceed with review", "Route to review". |
| `EmployerNextBestAction.tsx` learning label | "Based on historic success rate" | Can imply predictive guarantee. | "Based on observed patterns; not a guarantee." |
| `DecisionCard.tsx` | `executeRecommendation` shared copy | "Execute" suggests automation. | "Review suggestion" or "Start action". |
| `DecisionQueue.tsx` empty state | "Ensure passive monitoring systems are configured." | Hints at background monitoring guarantee. | "No pending suggestions in this queue." |
| `systemVoice.ts` | "Trust verified", "Verification complete", "Readiness confirmed" | Shared constants can overstate verification if used generically. | Use "Source checked", "Verification snapshot available", "Readiness snapshot available". |
| `EmployerDecisionConsole.tsx` | "READY TO PROCEED", "PROCEED WITH REVIEW" | Can be acceptable only if decision-grade lanes are explicit nearby. | Prefer "Source-backed review ready" / "Proceed with limitations". |

## Readiness Semantics

Readiness is informational, source-dependent, and non-authoritative. It should answer:
- what was checked;
- what is pending, stale, gated, or unavailable;
- what is decision-grade now;
- what still requires human review;
- what the action would record.

Readiness must not answer:
- "Can this person be hired?"
- "Is this person legally cleared?"
- "Has the employer accepted?"
- "Is the tenant owner?"
- "Will time-to-start improve?"

## Recommended Copy Contract

### Recommendation card

Use:
```text
Suggested next action
[action label]
Basis: source coverage, freshness, and observed patterns.
Limitation: this does not approve, reject, credential, or employ the clinician.
```

Avoid:
```text
System Recommendation
Approve Candidate
Reject Candidate
Execute recommendation
```

### Career guidance

Use:
```text
Source-dependent next step
This may improve readiness coverage after the source check completes.
```

Avoid:
```text
Reach Decision Grade
100% verified
Ready for 1-click apply
```

### Learning/telemetry

Use:
```text
Based on observed patterns.
Sample size: [n].
This is advisory telemetry, not a guarantee.
```

Avoid:
```text
Based on historic success rate
Predicted success
Guaranteed outcome
```

## Runtime Guardrails For A Follow-Up PR

The safest implementation sequence is:
1. Rename user-visible "Autopilot" references to "Guided next steps" or "Suggested actions" where the surface is clinician/employer-facing.
2. Replace "Execute recommendation" in shared voice constants with "Review suggestion" unless a caller is a true command console.
3. Replace next-best-action button labels that look like final employment decisions with review-stage actions.
4. Add a persistent limitation line wherever recommendation confidence appears.
5. Keep the existing source-coverage and readiness gating in passport/review surfaces intact.

## Autopilot Honesty Assessment

**UNSAFE.** The current recommendation language is assistive in architecture but too decisive in copy. The strongest fix is to separate "recommended next step" from "decision action" everywhere: the system may suggest, rank, and explain; it must not appear to approve, reject, deploy, or guarantee readiness.

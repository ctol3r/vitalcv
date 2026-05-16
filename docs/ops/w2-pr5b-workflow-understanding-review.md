# W2-PR5B - Workflow Understanding Review

**Wave:** W2-PR5B - Operational Trust Experience Certification
**Date:** 2026-05-08
**Status:** Docs-only review of workflow comprehension. No product code changed.
**Risk class:** SAFE.
**Predecessors:** PR3D workflow maps + fragmentation register, PR4D workflow coherence + friction register.

## Mission

PR3D mapped the routes; PR4D measured the seams. PR5B asks: **does an operator come away with the right mental model?** A workflow is "understood" when, after walking it, the operator can articulate (a) what they did, (b) what the system did, (c) what state the subject is now in, (d) what would advance the state, and (e) what the system promises and disclaims.

## Rating legend

🟢 CLEAR · 🟡 PARTIAL · 🟠 CONFUSING · 🔴 MISLEADING

## Per-workflow understanding

### W1. Onboarding — clinician

**Path the user attempts:**

```
sign-up (Clerk) → /onboarding → /onboarding/identity → ... → /onboarding/success
```

**Actual outcome:**

```
sign-up (Clerk) → Clerk-side redirect (target set in Clerk dashboard, not in app)
/onboarding/{identity,fetching,readiness,success} → all redirect('/')
/clinician/onboarding → "Open profile" → /clinician/profile (read-only shell, 0/0)
                     → "Import from existing sources" → /clinician/import (cards unwired)
```

**Operator can articulate:**

| Question | Answer the operator can give | Rating |
|---|---|---|
| What did I do? | "I clicked sign-up, then I think I'm done?" | 🟠 |
| What did the system do? | Unknown — chain redirects home; no completion event surfaced | 🔴 |
| What state am I in? | "Profile shows 0/0 completion." | 🟠 |
| What advances my state? | None offered in-app | 🔴 |
| What does the system promise? | The four step-page disclaimers are inside redirect targets the user never sees | 🔴 |

**W1 understanding rating: 🔴 MISLEADING.** The advertised chain is unreachable. The functional path lands on a read-only shell. (FR-O-1, FR-O-3.)

### W2. Passport — clinician

**Path:**

```
/passport → enter NPI → /passport/[id] → LaneHealthMount + KnowledgeInboxPanel + readiness display
```

**Operator can articulate:**

| Question | Answer | Rating |
|---|---|---|
| What did I do? | Looked up an NPI; I see my passport. | 🟢 |
| What did the system do? | "Pulled lane health" — visible per-lane state + `userFacingMessage`. | 🟢 |
| What state am I in? | Per-lane state visible; readiness score visible; `ReadinessState` enum (`CHECKING/PARTIAL/DECISION_GRADE/BLOCKED`) **not visible by name**. | 🟡 |
| What advances my state? | Inbox suggestions visible; buttons unwired. No "Request issuer verification" entry. | 🔴 |
| What does the system promise? | Lane health framing is honest. Score-with-confidence implies more than runtime guarantees. | 🟠 |

**W2 understanding rating: 🟡 PARTIAL.** Strongest of the four primary workflows post-#220. Falls down at the action layer (FR-P-1) and at readiness derivation (FR-S-3).

### W3. Issuer chain — verifier

**Path (intended):**

```
/issuer/request/[r] → /issuer/verify/[r] → /issuer/review/[r] → /issuer/policy-review/[r] → /issuer/psv-receipt/[r] → /issuer/psv-reuse/[r]
```

**Actual:**

Each page renders a demo with a disclaimer block. **Zero forward links across nine pages.** The verifier cannot traverse the chain in the product.

**Operator can articulate:**

| Question | Answer | Rating |
|---|---|---|
| What did I do? | "I submitted on this demo page." | 🟢 (each page disclaims) |
| What did the system do? | "Nothing wrote." Each page says so. | 🟢 |
| What state am I in? | Receipt-candidate `reviewState` rendered; `PolicyReviewDecisionStatus` rendered on demo. Per-subject continuity across pages: none. | 🟠 |
| What advances my state? | Per page: "submit a decision" button (demo). Across pages: **no link**. | 🔴 |
| What does the system promise? | Each page disclaims persistence. Truth contract is intact. | 🟢 |
| Why was I refused? | **`refusalGate` not rendered.** Cannot attribute refusal to one of six gates. | 🔴 |

**W3 understanding rating: 🟠 CONFUSING.** Each page is locally honest; the chain is globally incoherent. The largest single gap (`refusalGate` not rendered) sits inside this workflow. (FR-V-1, FR-V-2.)

### W4. Employer review — employer

**Path (intended):**

```
/employer/dashboard → /employer/worklist → /employer/review/[a] → /employer/decision/[a]
```

**Actual:**

```
/employer/dashboard → no link → /employer/worklist (separate route, not linked)
/employer/worklist row → onSelect callback (no nav)
/employer/review/[a] → three CTAs visual-only ("no persisted decision outcome in this shell")
/employer/decision/[a] → "Decision recording is planned"
```

**Operator can articulate:**

| Question | Answer | Rating |
|---|---|---|
| What did I do? | "I clicked Accept; nothing visibly happened." | 🟠 |
| What did the system do? | The page disclaims "no persisted decision outcome in this shell" — but the disclaimer is below the buttons. | 🟠 |
| What state am I in? | Lane states visible; score (factor breakdown unmounted). | 🟡 |
| What advances my state? | Nothing — `ScoreExplainabilityBlock` exists but is unmounted (FR-E-4); CTAs visual-only (FR-E-3). | 🔴 |
| What does the system promise? | The disclaimer is honest; the surface implies a decision. Mismatch between button affordance and effect. | 🔴 |

**W4 understanding rating: 🔴 MISLEADING.** Buttons promise decision; runtime captures nothing. Disclaimer is correct but visually subordinate. (FR-E-1, FR-E-2, FR-E-3, FR-E-4.)

### W5. Inbox / next-step — cross-role

**Surfaces:**

| Emitter | Surface | `href`? | Rating |
|---|---|---|---|
| `KnowledgeInboxPanel` | clinician passport | ❌ | 🔴 |
| `clinician/NextBestAction` | mobile clinician | ❌ (callback only) | 🔴 |
| `WorklistPanel` row | employer worklist | ❌ (callback only) | 🔴 |
| `EmployerNextBestAction` | employer review | ❌ (callback only) | 🔴 |
| `DecisionCard` / `DecisionQueue` | shared | ❌ (callback only) | 🔴 |
| `ClinicianHomeSurface.primaryAction` | `/holder/home` | ✅ | 🟢 |
| `ClinicianHomeSurface.blockers` | `/holder/home` | ✅ | 🟢 |
| `Workspace/NextBestAction` | reference impl | ✅ | 🟢 |

**Operator can articulate:**

The user is trained that "do this next" is sometimes a real button and sometimes a sign post. After two clicks that did nothing, they will treat all "do this next" surfaces as decoration. This is the **canonical inbox-trust failure** for the product.

**W5 understanding rating: 🔴 MISLEADING.** 1 of 6 emitters honor their label. (FR-N-1..N-6.)

### W6. Readiness — clinician

**Surfaces:**

| Surface | What is shown | What is hidden | Rating |
|---|---|---|---|
| Passport readiness display | Score badge + confidence label + tier-upgrade prompt | Per-lane breakdown; `ReadinessState` enum | 🟠 |
| `LaneHealthMount` | Lane state + `userFacingMessage` + retry policy | Transition history; chronic-failure indicator | 🟢 |
| Clinician home momentum block | Qualitative descriptor + readiness link | Lane states; modulator inputs | 🟡 |
| Career autopilot copy | "Reach Decision Grade", "100% verified", "1-click apply" | All UNSAFE per PR3C | 🔴 |
| `/status` compliance evidence | Foundation-level adapter / redaction / retention | Per-subject mapping | 🟢 (in its own scope) |

**Operator can articulate:**

| Question | Answer | Rating |
|---|---|---|
| What is my readiness? | A number with a confidence label. | 🟡 |
| Why is it that number? | Lane health hints; spine-source breakdown not surfaced. | 🟠 |
| What advances readiness? | Tier-upgrade prompt; autopilot suggestions; some legacy autopilot copy implies guaranteed outcomes. | 🔴 |
| What does the score *not* mean? | Not shown. No "Readiness snapshot. Informational; source freshness and gaps remain controlling." line. | 🔴 |

**W6 understanding rating: 🟠 CONFUSING.** Lane health is the bright spot; readiness derivation and limitation language are absent.

### W7. Dossier / replay — verifier and clinician

**Routes:**

| Route | Status |
|---|---|
| `/passport/[id]/dossier` | does not exist |
| `/issuer/dossier/[requestId]` | does not exist |
| `/employer/dossier/[applicationId]` | does not exist |
| `/issuer/audit-boundary/[requestId]` | demo, `noop` writer, events `demo_not_persisted` |

**Components:** `AuditTrailTimeline`, `AuditTerminal`, `AuditBundlePreview`, `AuditProofViewer`, `AuditScrapbook` — five components, mounted only as sub-components, no per-subject route.

**Operator can articulate:**

| Question | Answer | Rating |
|---|---|---|
| Where do I read the recorded events for this subject? | "I don't know — only the audit-boundary demo is reachable as a route." | 🔴 |
| Are these events persisted? | Each demo page disclaims `demo_not_persisted`. | 🟢 (when on the page) |
| Is replay legal proof? | Demo page says "replay-safe is not legal proof." Components imply otherwise via "Immutable Audit Trail" / "mathematical guarantees" copy. | 🟠 |

**W7 understanding rating: 🔴 MISLEADING at the route level (no per-subject dossier exists); 🟢 CLEAR on `/issuer/audit-boundary/[requestId]` itself.**

### W8. Receipt-candidate review-state — verifier

`ReceiptCandidateReviewState` has eight values; only `ready_for_policy_review` has a UI advance (`accept_candidate`). The other seven are terminal-by-omission.

| Review state | Advance UI? | Rating |
|---|---|---|
| `ready_for_policy_review` | ✅ `accept_candidate` (demo) | 🟢 |
| `review_required` | ❌ (FR-V-4) | 🔴 |
| `conflict_review_required` | ❌ | 🔴 |
| `release_required` | ❌ | 🔴 |
| `reroute_required` | ❌ | 🔴 |
| `unable_to_verify` | ❌ | 🔴 |
| `expired` | ❌ | 🟠 (terminal by definition; OK) |
| `canceled` | ❌ | 🟠 (terminal by definition; OK) |

**W8 understanding rating: 🟠 CONFUSING.** Five non-terminal states have no advance UI. The reviewer sees a state name and must read source to know what to do.

## Workflow continuity rollup

| Workflow | Continuity % (PR4D) | Understanding rating (PR5B) |
|---|---|---|
| W1 Onboarding | 50% | 🔴 |
| W2 Passport | 55% | 🟡 |
| W3 Issuer chain | ~0% | 🟠 |
| W4 Employer review | ~10% | 🔴 |
| W5 Inbox / next-step | ~17% | 🔴 |
| W6 Readiness | ~40% | 🟠 |
| W7 Dossier / replay | ~0% (route-level) | 🔴 |
| W8 Receipt-candidate review | n/a | 🟠 |

**Workflow understanding rollup:** **2 of 8 workflows are 🟡 or better; 6 of 8 are 🟠 or 🔴.**

## Cross-workflow patterns

### Pattern 1 — Button affordance ≠ runtime effect

Five workflows have buttons that look like they should do something and do not. The user learns to distrust action affordances. Once distrust sets in, the surfaces that *do* honor their labels (`Workspace/NextBestAction`, `ClinicianHomeSurface`) are also distrusted.

### Pattern 2 — Local honesty, global incoherence

Each demo page is locally honest about persistence. Across nine demo pages there is no link, no breadcrumb, no thread. The disclaimer blocks repeat instead of compounding. The user reads the same persistence disclaimer six times and stops reading it.

### Pattern 3 — Same word, different state machine

`review_required` means two different things (passport-lane vs receipt-candidate). `verified` means two different things (`TrustUiStatus.verified` vs `KnowledgeInboxVerificationStatus.source_verified`). `pending` means three different things across machines. The labels collide; the remediations differ. (FR-S-1, FR-S-2, FR-S-5.)

### Pattern 4 — Shown values, hidden derivation

Readiness, confidence, calibrated decision state — all rendered as final values. Inputs hidden. The user sees the conclusion, not the chain. The system *can* explain itself (modulators are computed); the UI does not.

### Pattern 5 — Inverted disclosure

The demo persistence-boundary pages (`/issuer/audit-boundary`, `/issuer/persistence-adapter`, `/issuer/backend-persistence`, `/issuer/psv-receipt`) carry the strongest disclaimers. The audit-shaped components (`AuditProofViewer`, `AuditTrailTimeline`, `AuditBundlePreview`) carry the strongest *over*claims. The transparency surfaces are honest; the trust surfaces are inflated.

## Strongest workflow continuity gain (since PR3D)

`LaneHealthMount` on `/passport/[id]` (PR #220, `fae54ea5`). Lane health is the only post-PR3D component that:

1. Renders a state name without renaming or flattening it.
2. Shows a `userFacingMessage` per state.
3. Includes a retry policy.
4. Does not overclaim what the state means.

It also adds `/status` (DOCS-STATUS-1) compliance evidence. The two surfaces do not cross-link, but each is independently honest.

**The lane-health surface is the template.** Every other state-bearing surface in the product should be retrofitted to render: state name, user-facing message, what advances it, what it does not promise.

## Highest-leverage workflow repairs

In rank order:

1. **Render `refusalGate` on `/issuer/policy-review/[requestId]`** (FR-V-2). Closes the largest single operator-readability gap. One-line UI. (PR4D-FIX-1.)
2. **Adopt `Workspace/NextBestAction.tsx`'s `href` pattern in every other inbox/next-step emitter** (FR-N-1..N-4, FR-E-5, FR-E-6). Closes 6 dead-ends in one PR. (PR4D-FIX-2.)
3. **Wire passport-lane → issuer-request entry seam** (FR-P-1). Closes the verifier-chain entry break.
4. **Mount `ScoreExplainabilityBlock` on `/employer/review/[applicationId]`** (FR-E-4). Closes the employer "why this score" gap.
5. **Surface `ReadinessState` literal under the readiness score + 3 of 4 modulators under `ConfidenceMeter`** (FR-S-3, FR-S-4). Closes the readiness derivation and confidence attribution gaps.
6. **Add forward links between adjacent issuer demo pages** (FR-V-1). Disclaimers cover the linkage.
7. **Apply PR3C copy contract to `AuditProofViewer`, `AuditTrailTimeline`, `AuditBundlePreview`.** Removes the "Immutable Audit Trail", "mathematical guarantees", "Zero-knowledge proof verified" overclaims. Brings component copy into alignment with surface-level demo disclaimers.
8. **Rename `ReceiptCandidateReviewState.review_required` → `issuer_response_incomplete`** (FR-S-1). Closes the highest-severity label collision.

Repairs 1, 2, 3, 4 carry the largest workflow-understanding gain in the smallest amount of code.

## Workflow honesty assessment

**🟠 CONFUSING.** Six of eight workflows are 🟠 or 🔴. The product is locally honest (each demo page disclaims) and globally incoherent (the chain has no links, the components imply more than the surfaces, and 5 of 6 inbox emitters lie via affordance).

The single workflow that is 🟢 in its own right (lane health) is the template for what the rest should look like.

## Out of scope

- No code changes.
- No state-machine changes.
- No copy rewrites (PR3C is the truth contract).
- No backend persistence wiring.

## See also

- `w2-pr5b-operator-trust-certification.md`
- `w2-pr5b-confidence-certification.md`
- `w2-pr5b-trust-experience-matrix.md`
- `w2-pr5b-operational-coherence-report.md`
- `w2-pr3d-clinician-workflow-map.md`, `w2-pr3d-verifier-workflow-map.md`, `w2-pr3d-workflow-fragmentation-register.md`
- `w2-pr4d-workflow-coherence.md`, `w2-pr4d-workflow-friction-register.md`
- `docs/architecture/vitalcv-knowledge-trust-graph.md` (boundaries 1-28)

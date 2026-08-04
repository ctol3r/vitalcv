# The one real loop — product contract (Wave 1072)

One coherent, truthful clinician journey, built from systems that already
exist. This document is the contract the `/design/reset` preview implements:
what each stage is, how real it is today, the public vocabulary, and the
claims that may never be made.

## The seven-stage loop

| # | Stage | Reality today |
|---|---|---|
| 1 | **NPI → clinician profile** | **Real.** `checkNpi` format gate, then `/api/identity/bootstrap/[npi]` (NPPES via backend) + `/api/trust-state/[npi]` in parallel — the same stack as the production homepage. The profile is built only from returned fields; nothing is invented. |
| 2 | **Relevant opportunity (MATCHA)** | Real contract; see the reality matrix below for which parts of the response are live against the preview's data. |
| 3 | **Apply with VitalCV** | **Real component** (`components/apply/ApplyWithVitalCV.tsx`). The preview environment stops at the authentication boundary; nothing is sent. |
| 4 | **Permissioned employer packet** | Generated from the clinician's actual selection in the Apply flow. Preview-labelled until a real share event succeeds. |
| 5 | **Employer review begins** | Described, never claimed as done: institutions run their own review and make their own decisions. |
| 6 | **Start sooner** | An intended outcome, not a guarantee. No duration, no countdown, no "start confirmed" without a real start event. |
| 7 | **Keep your record** | The same profile object returns to the clinician; a completed application never resets it. |

**One model.** Every stage renders the same `ClinicianCareerProfile`
(`apps/web/lib/career-loop/profile.ts`), derived from the real bootstrap +
trust-state responses; its readiness counts come from the production
`buildEvidenceCapsule` transform, so the loop can never disagree with the
evidence capsule. No stage hard-codes a name, specialty, monogram, or NPI.

## Truth boundaries inherited from the real stack

- The bootstrap contract collapses **no-such-NPI, registry outage, and
  rate-limiting** into one `identitySource: 'UNAVAILABLE'` state at HTTP 200.
  The preview says the registry could not answer; it never guesses which.
  (Distinguishing these is a known product gap, not a preview defect.)
- The bootstrap projection drops NPPES's `credential` field, so the profile
  shows a credential only if a future contract carries one.
- A TYPE_2 (organization) NPI is detected from real `npiType` and gets its
  own honest state — it never becomes a clinician profile.
- No readiness score, percentage, or observation timestamp is shown; those
  are prohibited on this surface by the existing capsule rules and e2e pins.

## Demo fixture

A clearly labelled **“Load an illustrative example”** control may show a
fictional journey using the same components and response contracts as the
live path. It is never the default, never triggered by a real NPI, and every
resulting surface carries an illustrative label.

## Public vocabulary (acquisition surfaces)

| Term | Meaning |
|---|---|
| Clinician profile | The human-facing identity built from the NPI |
| Career record | The reusable record that persists between applications |
| Apply with VitalCV | The consented application action |
| MATCHA | Opportunity intelligence |
| Evidence packet | The attributed information selected for sharing |
| Employer head start | What the recipient gains |
| Start sooner | An intended outcome, not a guarantee |
| Keep your record | Continuity after the application |

Acquisition copy never leads with: Trust Passport, blockchain, SD-JWT,
knowledge graph, PSV, Evidence OS, trust-tier terminology, or "credentialing
infrastructure". Those terms may appear where technically necessary; they are
not the first explanation of the product.

## Prohibited or unsupported claims

- Credentialing completes in under 24 hours / under five days / "10x faster"
- VitalCV automatically clears, verifies, or credentials a clinician
- A start date is guaranteed, or "Start confirmed" absent a real start event
- "Delivered" / "Employer received" / "Application submitted" for any
  preview-only action — the label is **"Preview only — nothing has been
  sent."**
- Blockchain anchoring as a current public product benefit
- Any banned truth-contract string from CLAUDE.md

## The production-promotion rule

`FOUNDER VISUAL DECISION: GO` accepts a visual direction and authorizes
nothing else. Replacing `/`, merging this work to `main`, enabling
auto-merge, invoking `pr-shepherd` on it, or triggering a production
deployment requires the separate explicit instruction
**`FOUNDER PRODUCTION PROMOTION: GO`** naming the action. Full rule:
`docs/ops/FOUNDER_VISUAL_GATE.md` §0.

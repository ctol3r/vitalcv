# VitalCV Demo Script

**MISSION:** Show one believable buyer story on the canonical wedge with no demo theater.

## Demo Promise

This demo proves one thing: a credentialing / onboarding operator can move from NPI intake to a persisted employer action without restarting the review from scratch.

## Pre-Demo Checklist

- Use the live wedge only: `/onboarding` -> `/passport/[id]` -> `/review/[entityId]`.
- Use an approved pilot NPI. Default demo input: `1003000126` unless a live pilot NPI has been approved for the session.
- Have a stopwatch ready for first-value and packet-to-decision timing.
- Confirm packet export is available from the live review surface.
- Confirm the review surface exposes the audit confirmation state before the session starts.

## Demo Rules

- Do not use archived `/demo/*` routes.
- Do not claim any source is live unless the UI shows it as checked.
- If a source is gated, pending, stale, unavailable, access-required, review-required, not decision-grade, or preview-only, say that plainly.
- Do not narrate roadmap. Narrate only what the product is showing now.

## Time Box

- Opening: 20 seconds
- NPI in: 45 seconds
- Readiness appears: 60 seconds
- Packet inspected: 75 seconds
- Employer acts: 45 seconds
- Audit confirmed: 35 seconds
- Close: 20 seconds

Total target: about 4 minutes.

## Opening

Say:

> VitalCV is not trying to replace your entire credentialing stack. It gives your onboarding operator one truthful packet and one auditable decision path so you can move a start decision forward faster.

## 1. NPI In

Route: `/onboarding`

Action:

1. Enter the approved pilot NPI.
2. Submit and narrate only what is actually happening.

Say:

> We start with one NPI. VitalCV resolves identity and begins the launch-spine checks. If a source is not available, it stays visibly limited instead of getting papered over.

What to show:

- NPI input accepted
- transition into the passport flow

Proof point:

- This starts the first-value timer. The target is a useful readiness snapshot in under 30 seconds.

## 2. Readiness Appears

Route: `/passport/[id]`

Action:

1. Land on the passport.
2. Pause on readiness score, blockers, and source coverage.

Say:

> This is the first value moment. The operator can already see who the clinician is, what is checked, what is still blocked, and what needs more work.

What to show:

- clinician identity
- readiness score / level
- blocker list
- source coverage states

Proof point:

- The product is useful before everything is perfect because it makes uncertainty explicit.

## 3. Packet Inspected

Route: `/review/[entityId]`

Action:

1. Open employer review.
2. Walk the buyer through identity, safety, authority, eligibility, freshness, and proof.
3. Click `Export packet` and note that the packet is the same truth, not a separate slide deck.

Say:

> The employer is not getting a sales summary. They are getting the same source-backed readiness picture, plus the ability to export the packet they are relying on.

What to show:

- readiness summary
- freshness panel
- proof sections
- packet export button

Proof point:

- Packet truth must match review truth. If the packet says more than the screen, the demo is invalid.

## 4. Employer Acts

Route: `/review/[entityId]`

Default action:

- Click `Accept as head start` for the approved clean demo NPI.

Fallback actions if the NPI is not decision-grade:

- Click `Request refresh` when stale or missing information is the honest next move.
- Click `Route to review` when a human review queue is the honest next move.

Say:

> The buyer has three honest choices: accept as head start, ask for refresh, or route to review. In KPI reporting that accept action is persisted as `PROCEED`, but the operator experience stays plain language. The value is that they can act from a truthful packet instead of restarting the whole verification process.

Proof point:

- The packet-to-decision target is under 5 minutes for a trained operator on this route.

## 5. Audit Confirmed

Route: same review surface after action completes

Action:

1. Wait for the success state.
2. Point directly at the visible audit record.

Say:

> The action is not considered real until the audit record is written. VitalCV shows the audit event ID and the trust snapshot that existed at the moment of decision.

What to show:

- success state
- `Audit trail recorded`
- `auditEventId`
- trust snapshot at decision

Proof point:

- This is the launch-safe close. The buyer acted, and the system can prove who did what and when.

## Close

Say:

> That is the whole pilot: NPI in, readiness appears, packet inspected, employer acts, audit confirmed. If we then record starts against this same scoped cohort, we can measure whether Interview-to-Start Velocity actually improved.

## Pilot Ask

Say:

> The pilot ask is simple: give us one credentialing lead, one scoped NPI cohort, one operator lane, and start-outcome capture for that same cohort. We will prove whether this wedge moves review-to-start faster.

## Demo Failure Rules

Stop and reset the story if any of the following happen:

- the flow requires an archived demo route
- a source is described as verified when the UI does not show a checked result
- packet export disagrees with the review screen
- the employer action succeeds without an audit confirmation
- the operator needs unsupported narration to explain away a product gap

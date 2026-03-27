# VitalCV Launch Gate

**MISSION:** Nothing goes live until the product, packet, dashboard, docs, and billing motion all tell the same truthful story.

## Gate Operating Rule

- The launch gate is green only when every gate below is green on the same release candidate.
- Evidence beats narration. If the product needs explanation to make a gate look green, the gate is red.
- If a gate turns red, the answer is either a smaller truthful scope or a product fix. Better storytelling is not a remedy.
- The wedge remains the only launch motion until this gate is revised explicitly.

## Green-Light Gates

| Gate | What Must Be True | Owner Role | Required Evidence |
| --- | --- | --- | --- |
| Public truth locked | Homepage, employer copy, billing, pilot brief, demo script, and launch materials describe only live routes, explicit source coverage states, and the current buyer motion. | Product + GTM | Manual copy review across `/`, `/employers`, `/billing`, and the pilot docs. No route, source, or pricing claim can outrun the product. |
| Wedge routes canonical | The only launch wedge is `/onboarding` -> `/passport/[id]` -> `/review/[entityId]` -> `/pilot-ops` / start capture. Shared surfaces may only point back to the same packet truth. | Product + Engineering | Product walkthrough recorded on the live environment. No archived `/demo/*` route or off-wedge operator backdoor is required to complete the flow. |
| Packet / export truthful | Packet export, employer review, and KPI exports contain only stored facts, timestamps, source coverage, and explicit limitation language. | Engineering + Ops | One live packet export plus one CSV and one JSON KPI export. Review payload and packet payload must match on source coverage and readiness truth. |
| Employer actions auditable | `Accept as head start`, `Request refresh`, and `Route to review` each write an audit event before success is shown. The review UI must surface the audit record. | Engineering + Trust Ops | One successful action of each type in a pilot-safe environment, with visible `auditEventId` evidence and persisted log / row verification. |
| Source coverage explicit | Every displayed source state is rendered with an explicit canonical posture such as `checked`, `stale`, `pending`, `gated`, `unavailable`, `accessRequired`, `reviewRequired`, `notDecisionGrade`, or `previewOnly`. | Product + Engineering | Route review of `/passport/[id]`, `/review/[entityId]`, packet export, and any public preview surface. No silent upgrade from gated or pending to verified. |
| First value < 30s | From approved NPI submission to the first visible readiness snapshot on `/passport/[id]`, the operator sees useful truth in under 30 seconds in the pilot environment. | Product + Ops | Three stopwatch-backed or telemetry-backed runs on approved pilot NPIs. Fail if any run requires off-screen explanation to count as value. |
| Packet-to-decision < 5 min target | From opening `/review/[entityId]` to recording one persisted employer action, a trained operator can inspect the packet and act in under 5 minutes. | Ops + GTM | Timed demo runs using the canonical review surface. The action must end with a visible audit confirmation, not just a click. |
| KPI truth locked | Every pilot doc and dashboard uses the same core KPI: **Interview-to-Start Velocity** = median days from first employer review to recorded start outcome. | Ops + Data | Compare the pilot brief, runbook, KPI dashboard, exports, and any buyer-facing reporting. Any wording drift blocks launch. |
| Scope discipline locked | Scoped pilot views preserve `orgContextId`, `pilotId`, `workflowLane`, and `geographyTag` when present, and filtered reporting never invents scoped outcomes from unscoped starts. | Ops + Data | Scoped KPI snapshot plus one scoped start outcome or explicit proof that no scoped start claim is being made yet. |
| Pricing truth locked | Clinicians are free, issuers are free, organizations pay for workflow execution only, same-band repeat access is not re-billed, and checkout language matches the actual access motion. | GTM + Finance | Review `/billing`, pricing doctrine, pilot brief, and any quote or pilot email templates for exact wording alignment. |

## Required Evidence Pack Before Green

Do not mark the gate green without all of the following in hand:

- a screen-recorded wedge walkthrough on the live pilot environment
- a live packet export from `/api/employer-review/:entityId/packet`
- a CSV and JSON KPI export from the live pilot ops flow
- at least one visible audit confirmation from employer review
- at least one start outcome row or an explicit note that outcome measurement has not started yet
- a wording review across pilot brief, launch gate, KPI dashboard, demo script, pricing doctrine, and pilot runbook

## Launch-Day Operating Cadence

1. Run the canonical walkthrough on the approved pilot NPI.
2. Export the packet and KPI snapshot from the same scoped cohort.
3. Confirm the persisted employer action and `auditEventId`.
4. Reconcile public copy, billing copy, and pilot materials against the live walkthrough.
5. Stop the launch immediately if any gate item drifts red.

## Automatic Fail Conditions

Launch is blocked immediately if any of the following are true:

- public or pilot-facing copy implies decision-grade source coverage when the actual posture is gated, pending, preview-only, or otherwise not decision-grade
- the wedge requires archived demo routes or unsupported operator backdoors
- packet export and review payload disagree on readiness or source coverage
- an employer action succeeds without a persisted audit record
- filtered pilot reporting is built from unscoped starts
- the first value or packet-to-decision story only works with narration and not with the actual product
- pricing language implies live card checkout when access is still routed through manual approval

## Exit Rule

If a gate is red, the answer is not better storytelling. The answer is either a smaller truthful scope or a product fix that closes the gap.

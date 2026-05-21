# Institutional Path Boundaries

Five-state taxonomy for institutional flows. Every interactive surface
in `apps/web/app/` traces to a row in one of the tables below. The
rules are binding: a new interactive surface that violates them is
rejected at audit.

The wave that introduced this doctrine repaired four dead-end flows:

1. `/pilot` submission — terminated without continuity guidance
2. `/employer/review/[applicationId]` review actions — static HTML
3. `/holder` → `/verify` — no continuity bridge
4. `/verify` — required a JWT no demonstrator could produce

The repairs are recorded in Table 2 (Executable) and Table 3
(Simulated), with the corresponding institution-owned step preserved
in Table 5.

## Five states

| State | Meaning |
|---|---|
| `executable` | The interactive flow performs the action it advertises. The action's effect is in scope. |
| `simulated` | The interactive flow renders bounded behavior. The action's effect is NOT in scope; a `BoundedSimulationDisclosure` is rendered above the control. |
| `institution-owned` | The institution does this. VitalCV surfaces the affordance but does not perform the action. |
| `intentionally-incomplete` | The flow stops on purpose at a clear handoff. The user is told why and what step they own next. |
| `future-state` | The flow is not yet on the page. It is documented in Table 4 only. |

## Table 1 · Executable

| Flow | Evidence |
|---|---|
| Pilot submission generates a structured intake record + confirmation copy | `apps/web/app/api/pilot-request/route.ts` + `apps/web/lib/pilot/pilot-intake.ts` |
| Pilot confirmation renders inline (no navigation to JSON) | `apps/web/app/pilot/PilotRequestForm.tsx` |
| `/holder` → `/verify` continuity bridge | `apps/web/components/continuity/ContinuityBridge.tsx` rendered in `apps/web/app/holder/page.tsx` |
| Verification preparation guidance on `/holder` | `apps/web/components/continuity/VerificationPreparation.tsx` rendered in `apps/web/app/holder/page.tsx` |
| Verifier surface accepts a token and calls `/api/receipts/verify` | `apps/web/app/verify/page.tsx` |
| Employer review acknowledges a posture locally | `apps/web/components/continuity/ReviewAcknowledgement.tsx` rendered in `apps/web/app/employer/review/[applicationId]/page.tsx` |

## Table 2 · Simulated (with `BoundedSimulationDisclosure`)

| Flow | Reason it is simulated |
|---|---|
| Pilot intake | Generates a structured record in-process. Persistence to a CRM and operator notification are deferred. The disclosure is rendered on the confirmation surface. |
| Employer review surface | A demo receipt is signed in-process so the verification badge renders. Lane states are fixture-driven. The disclosure is rendered above the surface. |
| `/verify` entry | Accepts a demo-token placeholder so the surface can be inspected without a real issued JWT. The disclosure is rendered above the input. |
| Review acknowledgments | Local-only UI notes. They do NOT change the application state in any backend. The disclosure lives in the primitive copy itself. |

## Table 3 · Institution-owned (always)

The following are NEVER moved off the institution. The repaired
flows do not propose to change this:

- State medical board PSV
- Credentialing committee scheduling and review
- Privileging decisions
- Final acceptance of any clinician for deployment
- Re-fetching upstream registries on the institution's own credential
- Disposition of stale-but-signed lanes
- The receiving institution's own primary-source verification

## Table 4 · Future-state (not on the page)

| Flow | Horizon |
|---|---|
| Persisting pilot intake to a CRM | post-pilot |
| Operator notification email on pilot intake | post-pilot |
| Issuing a real signed JWT from a credentialing event | post-pilot |
| Recording review acknowledgments to a backend audit row | post-pilot |
| Pulling employer review surface from a live institution system | post-pilot |
| Wallet handoff that produces a JWT a receiver can paste into `/verify` | post-pilot |

These items are deliberately absent from the user-visible surface.
They do not appear as "coming soon" badges; they are simply not
rendered. Audit references to them must point here (Table 4) rather
than to a missing route.

## Table 5 · Intentionally-incomplete (the surface stops on purpose)

| Surface | Where it stops | Why |
|---|---|---|
| `/verify` | At the verifier read + receipt display. Does not navigate to "decision". | A credential decision is institution-owned; the receiving institution dispositions on its own cadence. |
| `/employer/review/[applicationId]` | At the local acknowledgment. Does not "approve" or "reject" in a backend. | Final eligibility decisions remain institution-owned and live in the institution's credentialing system. |
| `/pilot` | At the intake confirmation. Does not auto-schedule the working session. | An operator session is scheduled by the VitalCV operator after reading the structured record; the user is told this is what happens next. |
| `/holder` (has_npi) | At the continuity bridge to `/verify` plus the verification preparation panel. Does not initiate a real exchange. | The receiving institution still has to read the lane state on its own credential. |

Each of these surfaces SHOULD carry one of the following:

- `BoundedSimulationDisclosure` (if the surface simulates a backend action)
- `CompletionConfirmation` (if the surface records that a submission was received)
- `InstitutionalNextStep` (if there is a clear next route the user should open)
- `ContinuityBridge` (if the surface is the start or end of a multi-route flow)

A surface that ends without any of the above is a dead-end and must
be repaired in the next wave.

## Banned phrases on these surfaces

The four repaired flows MUST NOT use:

- `fake approval`, `auto-approve`, `automatic acceptance`, `approves automatically`
- `instant verification`, `verifies instantly`, `automatically verified`
- `magical onboarding`
- `automated decision`, `auto-decisions`
- `we approve`, `we accept`, `we reject` (the institution makes the decision; VitalCV does not)
- `automatic backend processing`, `back-office automation`
- `guaranteed approval`, `guaranteed acceptance`

Each banned phrase is enforced by the truth-audit test in
`apps/web/__tests__/institutional-path-completion.test.tsx`. The
disclosures and acknowledgments use the phrase "institution-owned"
explicitly to keep the ownership boundary legible.

## Governance

A new interactive surface MUST:

1. Render exactly one of `BoundedSimulationDisclosure`, `CompletionConfirmation`, `InstitutionalNextStep`, or `ContinuityBridge` (or some compound) wherever the user-facing action terminates.
2. Use the words "institution-owned" at least once on the surface where the institution still owns the decision.
3. Avoid every banned phrase in the list above.
4. Trace its claim to a row in Table 1, 2, 3, or 5 above. Table 4 claims are not on the page.

PRs that violate any of these are rejected at Codex audit.

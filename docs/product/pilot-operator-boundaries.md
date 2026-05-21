# Pilot Operator Boundaries

Five-state taxonomy for the `/operator` workspace. Every claim on
the page traces to a row in one of the tables below. The workspace
is a calm read-only surface; it surfaces visibility, not control.

## Five states

| State | Meaning |
|---|---|
| `executable` | The workspace renders the artifact today using shipping code |
| `simulated` | Fixture data drives the render; production data plane is not yet wired |
| `institution-owned` | The receiving institution does this; VitalCV surfaces but does not perform |
| `intentionally-incomplete` | The workspace stops on purpose at a clear handoff |
| `future-state` | Documented in this doc only; not on the page |

## Normalized visible vocabulary (binding)

The workspace uses **only** these six visible states:

| Visible state | Meaning |
|---|---|
| `Ready` | The clinician or lane is ready for the next operator-visible step |
| `Pending review` | The receiving institution is reviewing on its own cadence |
| `Attention needed` | The operator should look at this row now |
| `Interrupted` | An upstream interruption surfaced; operator note travels with the lane |
| `Continuing` | The lane is progressing; no operator step required right now |
| `Complete` | The lane is source-confirmed against the federal registry |

Substrate vocabulary (`survivabilityScore`, `degradationOwnership`,
`lineageKey`, `replay chronology`, `dedupeKey`, `kid`, `JWKS`, etc.)
is forbidden on the workspace surface. Operators who need the
substrate read open the `/ops` route from the progressive
disclosure at the bottom of the workspace.

## Table 1 · Executable (with evidence)

| Claim | Evidence path |
|---|---|
| Six normalized visible states render uniformly | `apps/web/lib/operator/operatorFixtures.ts` (OPERATOR_VISIBLE_STATE_LABEL) |
| Attention queue with next-step + owner per row | `apps/web/components/operator/OperatorAttentionQueue.tsx` |
| Per-lane continuity cards | `apps/web/components/operator/ContinuityAttentionCard.tsx` |
| Per-clinician review progress | `apps/web/components/operator/ReviewProgressPanel.tsx` |
| Five-questions summary | `apps/web/components/operator/OperationalNextStepSummary.tsx` |
| Institutional ownership panel (always rendered) | `apps/web/components/operator/InstitutionalOwnershipPanel.tsx` |
| Per-cohort readiness strip | `apps/web/components/operator/ReadinessProgressStrip.tsx` |
| Progressive disclosure pointing at `/ops` | `apps/web/app/operator/page.tsx` |

## Table 2 · Simulated (fixture-driven)

| Claim | Note |
|---|---|
| Cedar Health Q2-2026 cohort | Fixture data; not a live customer |
| Specific NPI / clinician identities | Synthetic; Luhn-valid NPIs |
| Specific stale-but-signed posture on PECOS | Fixture row; pattern is realistic, data is synthetic |
| Per-clinician review stages | Fixture; production wiring is post-pilot |
| Cohort readiness counts | Fixture; production wiring is post-pilot |

## Table 3 · Institution-owned (named explicitly on the page)

These items appear in the `InstitutionalOwnershipPanel` and are
**always rendered** so the boundary stays visible at every visit:

- State medical board PSV (Cedar CVO channel) -- out of pilot scope
- Credentialing committee scheduling and review
- Privileging decisions
- Final acceptance of any clinician for deployment
- Re-fetching upstream registries on the institution's own
  freshness budget

The workspace does NOT propose to change any of these.

## Table 4 · Intentionally-incomplete (the surface stops on purpose)

| Surface | Where it stops | Why |
|---|---|---|
| `/operator` | At the calm read. Does NOT issue, accept, or revoke a credential. | The receiving institution still dispositions on its own cadence. |
| Five-questions summary | At a single sentence per answer. Does NOT expand into a multi-step orchestration. | Calm reads are the point; orchestration belongs in the operator's own systems. |
| Progressive disclosure | At a Link to `/ops`. Does NOT duplicate substrate detail inline. | One substrate read exists already; the workspace defers to it. |

## Table 5 · Future-state (NOT on the page)

| Item | Horizon |
|---|---|
| Live wiring from a production credentialing system | post-pilot |
| Per-operator authentication + role-scoped views | post-pilot |
| Multi-cohort selection UI | future wave |
| Real-time attention notifications | future wave |
| Audit trail of operator actions (read events) | future wave |

These do not appear on the page. They are listed here only so
audit references resolve.

## Banned phrases on the operator surface

The workspace MUST NOT use:

- `fake enterprise workflow` / `enterprise-grade` (as a positive
  positioning claim)
- `fully automated` / `auto-approves` / `automatic acceptance`
- `instant verification` / `instantly verified`
- `AI-powered` / `AI-driven` (as a positive positioning claim)
- `magical onboarding`
- `startup-grade`, `disrupting credentialing`, `revolutionary` (as
  positioning claims)
- substrate jargon: `survivabilityScore`, `degradationOwnership`,
  `lineageKey`, `replay chronology`, `dedupeKey`, `kid`, `JWKS`,
  `DID`, `σ ok`, `σ defer`

The truth-audit test in
`apps/web/__tests__/pilot-operator-readiness.test.tsx` enforces
these absences on every touched file. Substrate jargon is allowed
INSIDE the progressive-disclosure body when it points at `/ops`.

## Governance

A new operator-surface claim MUST:

1. Trace to a row in Table 1, 2, 3, or 4 (Table 5 claims are not
   added; they are removed).
2. Use only the six visible states (or extend the doc and the
   `OPERATOR_VISIBLE_STATE_LABEL` map in the fixture, in the same PR).
3. Avoid every banned phrase in the list above.
4. Render the `InstitutionalOwnershipPanel`; this panel is binding.

PRs that violate any of the four are rejected at Codex audit.

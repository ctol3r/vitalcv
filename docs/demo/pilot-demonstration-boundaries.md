# Pilot Demonstration Boundaries

Five-state taxonomy for the `/demo/pilot` route. Every claim on the
page traces to a row in one of the tables below. New demonstration
copy is rejected if it cannot be grounded.

Audiences: institutional reader (CVO / MSO / hospital operations) +
operator running the demo + Codex audits cross-checking the copy
against the underlying infrastructure.

## Five states

| State | Meaning |
|---|---|
| `demonstrated` | The route renders the artifact today using shipping code |
| `simulated` | Fixture data drives the render; production data plane is not yet wired |
| `planned` | On the documented roadmap; not yet on the page |
| `unsupported` | Explicitly not in scope; not on the page |
| `institution-owned` | The institution does this; VitalCV surfaces but does not perform |

## Table 1 · Demonstrated (with evidence)

| Claim | Evidence path |
|---|---|
| Federal-source resolution against NPPES + OIG/LEIE + PECOS | `packages/core/src/services/nppesResolver.ts` (#388/#392) |
| Replay envelope (portable evidence pointer) | `apps/web/lib/interoperability/replayBundleEnvelope.ts` (#395) |
| Per-lane continuity status (source-confirmed / evidence-pending / continuity-restored / continuity-interrupted) | `apps/web/lib/trust/degradation.ts` (#382) |
| Operator note carried on each lane | `apps/web/lib/interoperability/demoExchanges.ts` (#395) |
| Independent cross-check affordance | `apps/web/components/interoperability/IndependentCrossCheckPanel.tsx` (#395) |
| Operational chronology (timeline of events) | `apps/web/components/interoperability/TrustExchangeTimeline.tsx` (#395) |
| Replay envelope summary counts | `apps/web/lib/interoperability/replayBundleEnvelope.ts` (#395) |
| Institutional walkthrough (six questions) | `apps/web/components/demo/InstitutionalWalkthrough.tsx` (this PR) |
| Pilot deployment kit (print-ready) | `apps/web/app/pilot/deployment-kit/[clientSlug]/page.tsx` (#387) |
| Discovery surface (W3C DID + OID4VCI) | `apps/web/app/.well-known/did.json/route.ts` + `openid-credential-issuer/route.ts` (#392) |

## Table 2 · Simulated

| Claim | Note |
|---|---|
| Cedar Health pilot cohort | Fixture data in `lib/demo/demoFixtures.ts`; not a live customer |
| Per-clinician outcome (DEPLOYMENT_READY, INSTITUTION_REVIEW, etc.) | Fixture-driven; no production credential is issued |
| Cross-lane statuses (PECOS stale-but-signed; committee review pending) | Fixture-driven; pattern is realistic but the data is synthetic |
| "Under 1 hour" target time-to-receipt | Pilot target per the deployment kit (#387); not a measured cohort result |
| "Under 90 minutes total" operator load | Pilot target; not a measured cohort result |

## Table 3 · Planned

| Claim | Horizon |
|---|---|
| Live data pipeline from production NPPES query results into the demo route | post-pilot |
| Operator UI on the institution's own systems | post-pilot |
| Machine-readable envelope wire format (JSON-LD / VC 2.0 evidence package) | future wave |
| Live revocation propagation surface | future wave |
| Discovery probe against the receiving institution's did:web | future wave |

## Table 4 · Unsupported (explicitly NOT claimed)

The route does NOT claim:

- automatic acceptance of credentials
- instant verification
- regulatory substitution (the receiving institution retains its own cadence)
- federation between issuers
- "AI-powered" anything
- HIPAA or SOC2 certification (the platform is HIPAA-aware in design but does not claim certification)
- production credential issuance (the rehearsal is read-only)
- live wallet handoff
- universal interoperability

These are banned in copy and gated by the truth-audit test in
`apps/web/__tests__/pilot-demonstration-compression.test.ts`.

## Table 5 · Institution-owned (named explicitly on the page)

The route names what the institution owns:

- State medical board PSV (Cedar CVO channel) -- out of pilot scope
- Credentialing committee review
- Privileging decisions
- Final acceptance of any clinician for deployment
- Re-fetching upstream registries on the institution's own credential when needed
- Disposition of stale-but-signed lanes

The walkthrough question 6 ("What remains institution-owned?") is the
single place this is summarised; it must NEVER drift.

## Compressed terminology (binding)

The route uses ONLY these labels for the underlying states. Other
labels (`continuous`, `replay-anchored`, `σ ok`, `σ defer`, etc.) are
infrastructure jargon and MUST NOT leak into the demo surface.

| User-facing label | Underlying state |
|---|---|
| Source-confirmed | `source_confirmed` (continuity) |
| Evidence pending | `evidence_pending` (continuity) |
| Continuity restored | `continuity_restored` (continuity) |
| Continuity interrupted | `continuity_interrupted` (continuity) |
| Pending review | `pending_review` (cross-check) |
| In review | `in_review` (cross-check) |
| Institution-confirmed | `institution_confirmed` (cross-check) |
| Not eligible (institution-owned) | `not_eligible` (cross-check) |
| Cohort tag | `cohort-A` / `cohort-B (rural)` (fixture) |

## Governance

Adding a new claim to the `/demo/pilot` page requires:

1. A row in Table 1, 2, 3, or 5 above (Table 4 claims are not added; they are removed)
2. For Table 1 (demonstrated) claims: an evidence path into a shipping PR
3. The compressed-terminology table extended if a new user-facing label is required
4. The truth-audit test extended to catch any new banned phrase

PRs that introduce an unsupported claim without one of the above MUST
be rejected at Codex audit.

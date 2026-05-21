# Institutional Intake Boundaries

Five-state taxonomy for the `/intake` route. Every claim on the page
traces to a row in one of the tables below. New intake copy is
rejected if it cannot be grounded.

Audiences: institutional reader landing on the page · operator
showing the page to a prospect · Codex audits cross-checking the
copy against the underlying infrastructure.

## Five states

| State | Meaning |
|---|---|
| `demonstrated` | The route renders the artifact today using shipping code |
| `institution-owned` | The institution does this; VitalCV surfaces but does not perform |
| `simulated` | Fixture data drives the render; production data plane is not yet wired |
| `planned` | On the documented roadmap; not yet on the page |
| `unsupported` | Explicitly not in scope; not on the page |

## Table 1 · Demonstrated (with evidence)

| Claim | Evidence path |
|---|---|
| Federal-source resolution against NPPES, OIG/LEIE, PECOS | `packages/core/src/services/nppesResolver.ts` (#388/#392) |
| Per-lane continuity status (source-confirmed / evidence pending / continuity restored / continuity interrupted) | `apps/web/lib/trust/degradation.ts` (#382) |
| Operator note carried on each lane | `apps/web/lib/demo/demoFixtures.ts` (#400) |
| 5-step intake progress with per-step owner | `apps/web/components/intake/InstitutionalIntakeProgress.tsx` (this PR) |
| First-30-seconds 5-question comprehension panel | `apps/web/components/intake/ThirtySecondComprehension.tsx` (this PR) |
| Reduced duplicate primary-source queries (NPPES / OIG / PECOS) | `apps/web/components/intake/DuplicateOutreachReduction.tsx` (this PR) |
| Replay envelope (portable evidence pointer) | `apps/web/lib/interoperability/replayBundleEnvelope.ts` (#395) |
| Continuity gap rendering | `apps/web/components/intake/ContinuityGapNarrative.tsx` (this PR) |

## Table 2 · Institution-owned (named explicitly on the page)

| Surface | Where named |
|---|---|
| State medical board verification (CVO channel) | `InstitutionReviewNarrative` row 1 |
| Credentialing committee review | `InstitutionReviewNarrative` row 2 |
| Privileging decisions | `InstitutionReviewNarrative` row 3 |
| Stale-but-signed lane disposition | `InstitutionReviewNarrative` row 4 |
| Re-screening cadence on OIG / LEIE | `DuplicateOutreachReduction` row 2 |
| Acceptance of stale-but-signed PECOS posture | `DuplicateOutreachReduction` row 3 |
| Final clinician acceptance + privileging | `InstitutionalIntakeProgress` step 5 |
| Continuity gap resolution decision | `ContinuityGapNarrative` "Your next step" column |

## Table 3 · Simulated

| Claim | Note |
|---|---|
| Cedar Health pilot cohort | Reused fixture from PR #400 (`lib/demo/demoFixtures.ts`); not a live customer |
| "Under 1 hour" target time-to-receipt | Pilot target per the deployment kit (#387); not a measured cohort result |
| "Under 90 minutes total" operator load | Pilot target; not a measured cohort result |
| PECOS stale-but-signed example | Fixture-driven pattern, realistic but synthetic |
| Per-clinician outcome | Fixture-driven; no production credential is issued |

## Table 4 · Planned

| Claim | Horizon |
|---|---|
| Live data pipeline into the intake route | post-pilot |
| Operator UI on the institution's own systems | post-pilot |
| Live revocation propagation surface | future wave |
| Multi-cohort fixture set | future wave |
| Probe against receiving institution's did:web | future wave |

## Table 5 · Unsupported (explicitly NOT claimed)

The intake route does NOT claim:

- automatic acceptance of credentials
- instant onboarding
- instant verification
- regulatory substitution
- federation between issuers
- "AI-powered" anything
- HIPAA or SOC2 certification
- production credential issuance
- live wallet handoff
- universal interoperability
- guaranteed acceptance

These are banned in copy and gated by the truth-audit test in
`apps/web/__tests__/institutional-intake-momentum.test.tsx`.

## Compressed terminology (binding)

The intake route uses ONLY the user-facing labels below. Infrastructure
jargon MUST NOT leak.

| User-facing label | Underlying state |
|---|---|
| Source-confirmed | `source_confirmed` (continuity) |
| Evidence pending | `evidence_pending` (continuity) |
| Continuity restored | `continuity_restored` (continuity) |
| Continuity interrupted | `continuity_interrupted` (continuity) |
| Federal-source resolution | NPPES + OIG/LEIE + PECOS reads |
| Replay envelope | Portable evidence pointer set |
| Operator note | Human-authored disposition note on a lane |
| Stale-but-signed | Lane returned slowly but the receipt remains valid |
| Ready for institution review | Federal-source axis complete; receiving institution reviews on its own credential |

## Governance

Adding a new claim to `/intake` requires:

1. A row in Table 1, 2, 3, or 4 above (Table 5 claims are not added; they are removed)
2. For Table 1 (demonstrated) claims: an evidence path into a shipping PR
3. The compressed-terminology table extended if a new user-facing label is required
4. The truth-audit test extended to catch any new banned phrase

PRs that introduce an unsupported claim without one of the above MUST
be rejected at Codex audit.

# Operational Waste Visibility Boundaries

Five-state taxonomy for the `/demo/waste` route. Every claim on the
page traces to a row in one of the tables below. The page is a
receiver-side observation of where credentialing operations leak
today. It demonstrates visibility, not elimination, and it does not
claim savings or ROI.

Audiences: institutional reader (CVO / MSO / hospital operations) +
operator running the demonstration + Codex audits cross-checking
copy against the underlying infrastructure.

## Five states

| State | Meaning |
|---|---|
| `demonstrated` | The route renders the artifact today using shipping code |
| `observed` | Drawn from credentialing operations in the field; pattern is real, the cohort here is fixture-driven |
| `simulated` | Fixture data drives the render; production data plane is not yet wired |
| `unsupported` | Explicitly not in scope; not on the page |
| `institution-owned` | The institution does this; VitalCV surfaces but does not perform |

## Table 1 · Demonstrated (with evidence)

| Claim | Evidence path |
|---|---|
| Six waste narratives (duplicate outreach / continuity interruption / evidence fragmentation / dead time / manual review loops / deployment delay) | `apps/web/components/waste/` (this PR) |
| Continuity comparison today vs pilot (8 steps) | `apps/web/components/waste/OperationalContinuityComparison.tsx` (this PR) |
| Friction chronology (T-0 through T-5, six checkpoints) | `apps/web/components/waste/InstitutionalFrictionTimeline.tsx` (this PR) |
| Waste visibility summary (six narratives folded together) | `apps/web/components/waste/WasteVisibilitySummary.tsx` (this PR) |
| Federal-source resolution as the only acceleration axis named | `packages/core/src/services/nppesResolver.ts` (#388/#392) |
| Replay envelope as portable evidence pointer | `apps/web/lib/interoperability/replayBundleEnvelope.ts` (#395) |
| Per-lane operator note carried through the envelope | `apps/web/lib/interoperability/demoExchanges.ts` (#395) |
| Per-lane continuity status (source-confirmed / evidence-pending / continuity-restored / continuity-interrupted) | `apps/web/lib/trust/degradation.ts` (#382) |

## Table 2 · Observed (pattern in the field, fixture-driven cohort)

| Claim | Note |
|---|---|
| Sending operator + receiving CVO duplicate NPPES queries | Pattern is widespread across credentialing operations |
| PECOS registry lag triggering phone-tag confirmation | Pattern is widespread; the Cedar cohort uses a fixture row for the demonstration |
| Receiving CVO re-reads the same lane the next day | Pattern is widespread; manual review loops happen across institutions |
| Committee + privileging cadence holding deployment | Pattern is widespread; the page names these as institution-owned, not as accelerated |
| Receiving operator phoning the sending operator to confirm "who ran this query" | Pattern is widespread; the envelope records the operator identifier in place |

## Table 3 · Simulated (fixture-driven)

| Claim | Note |
|---|---|
| Cedar Health pilot cohort | Fixture data in `lib/demo/demoFixtures.ts`; not a live customer |
| Specific NPI / clinician identities | Fixture (NPIs are Luhn-valid; clinicians are synthetic) |
| Specific stale-but-signed posture on PECOS at the Cedar window | Fixture row; pattern is realistic but the data is synthetic |
| "Under 1 hour" federal-source resolution target | Pilot target per the deployment kit (#387); not a measured cohort result |
| "Under 90 minutes total" operator load target | Pilot target; not a measured cohort result |

## Table 4 · Unsupported (explicitly NOT claimed)

The route does NOT claim:

- savings, ROI, "save millions", "guaranteed savings"
- "instant" anything (instant onboarding, instant verification)
- "automatic" anything (automatic acceptance, automatically verified)
- "AI-powered" anything
- elimination of human review
- regulatory substitution (the institution retains its own cadence)
- federation between issuers
- HIPAA or SOC2 certification (the platform is HIPAA-aware in design but does not claim certification)
- "protocol theater" or "fake ROI"
- production credential issuance (the observation is read-only)
- elimination of committee or privileging cadence
- universal interoperability

These are banned in copy and gated by the truth-audit test in
`apps/web/__tests__/operational-waste-visibility.test.tsx`.

## Table 5 · Institution-owned (named explicitly on the page)

The route names what the institution owns in full and does NOT
propose to change:

- State medical board PSV (Cedar CVO channel) -- out of pilot scope
- Credentialing committee review
- Privileging decisions
- Final acceptance of any clinician for deployment
- Re-fetching upstream registries on the institution's own credential
- Disposition of stale-but-signed lanes
- Receiving CVO's own freshness policy and review cadence

The summary panel (`WasteVisibilitySummary`) is the single place this
list is enumerated; it must NEVER drift to make any of these items
sound accelerated.

## Compressed terminology (binding)

The page uses only these labels for the underlying states. Other
labels (`σ ok`, `σ defer`, `replay-anchored`, `continuous`, etc.) are
infrastructure jargon and MUST NOT leak into the demonstration
surface.

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
| Stale-but-signed | operator-visible posture preserved on the lane |

## Visibility framing (binding)

The page is structured around six binding statements:

1. **The duplicate query is duplicate work.** The replay envelope carries the lane; the receiving institution still owns the read.
2. **The interruption is operator-visible.** Operator note travels with the lane; the receiving institution still owns the disposition.
3. **Federal-source fragments only.** The envelope reorganizes federal-source artifacts. Institution records stay where they are.
4. **Dead time has categories.** Only the federal-source resolution category compresses. Committee and privileging cadence remain institution-owned.
5. **Review has two parts.** Re-reading the packet (redundant scanning) is what the envelope reduces. Committee judgement remains institution-owned.
6. **Three axes, one compression.** Only the federal-source axis compresses. Committee + privileging axes stay on the institution's existing cadence.

Adding a new claim to the `/demo/waste` page requires:

1. A row in Table 1, 2, 3, or 5 above (Table 4 claims are not added; they are removed)
2. For Table 1 (demonstrated) claims: an evidence path into a shipping PR
3. The compressed-terminology table extended if a new user-facing label is required
4. The truth-audit test extended to catch any new banned phrase

PRs that introduce an unsupported claim without one of the above
MUST be rejected at Codex audit.

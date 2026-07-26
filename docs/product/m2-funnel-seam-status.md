# M2 — Marketing↔Web Seam & Single Funnel — Status

**Date:** 2026-07-06

## Findings that reframe the wave

- **The historical P0 dead-route is largely gone.** `apps/marketing/app/clinician/page.tsx`
  exists (the old "NPI entry → dead `/clinician`" seam is resolved). Marketing
  routes present: `/`, `/clinician`, `/verifier`, `/how-it-works`, `/security`,
  `/contact`, `/progress`, `/demo{,/verify,/wizard,/dashboard}`, `/verify/[shareId]`,
  `/internal/metrics`.
- **No inflated hardcoded metrics** of the `12,847 credentials / 284 verifiers`
  class exist in `apps/marketing` (that M2-3 example did not reproduce).

## Shipped (doctrine-honesty fixes — live public surfaces)

Extending the M1-8 copy gate to scan `apps/marketing` surfaced real violations,
now fixed:

| File | Violation | Fix |
|---|---|---|
| `components/verifier/EvidenceBundlePreview.tsx` | Fabricated bundle claiming **SAM.gov** + **ABIM** (ABMS) with definitive statuses | Rewrote to only integrated sources (NPPES, state board, OIG LEIE, CMS/PECOS); added "Illustrative" label; honest prose |
| `components/marketing/GraphPreview.tsx` | Credential graph presented **DEA** + board-cert as integrated nodes | Replaced with OIG Exclusions + CMS Enrollment nodes; updated prose + aria-label |
| `app/progress/page.tsx` | Roadmap item claimed "Automated … **DEA** verification" | Reworded to state-board primary-source checks with honest coverage states |
| `app/demo/dashboard/page.tsx` | Readiness band label `'Verified'` | → `'Ready'` (M1-8) |

Copy gate PASS (23 phrases). `ProblemSection.tsx` retains a DEA/SAM mention that
is acceptable — it describes the *industry burden* ("each credential requires
independent verification"), not a VitalCV integration claim.

## Backlog (larger items — not autonomously completed)

- **M2-2 Marketing-app fate (owner architecture decision).** Absorb `apps/marketing`
  into `apps/web` as a route group, or keep separate behind a shared `vt-*` token
  package. Until decided, two visual systems persist. *Recommendation:* absorb —
  the web app is the GA surface (877 route files); marketing is a thin secondary
  surface whose upkeep (and doctrine drift, as found above) is a liability.
- **M2-4 Un-gate employer demo** — sandboxed DEMO tenancy so a cold, unauthenticated
  employer can walk NPI → passport → review → accept-as-head-start, watermarked,
  zero PHI. Real feature build.
- **M2-5 Demo data depth** — seed ≥25 diverse demo NPIs (multi-specialty, one OIG
  exclusion, one stale license, one gated-source) replacing single-NPI dependency.
- **M2-1 formal link-crawler CI job** over the marketing build (zero dead CTAs).
  The static route audit above found no dead routes; a build-time crawler makes it
  a permanent gate.

## Assessment

The doctrine-honesty core of M2 (no fake/off-doctrine claims on public marketing
surfaces) is shipped and gate-enforced. The funnel-unification and demo-depth
features (M2-2/4/5) are real builds carried forward; M2-2 needs an owner call.

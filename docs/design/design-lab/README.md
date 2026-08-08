# VitalCV Continuous Design Lab

Founder program installed 2026-08-07. This directory is the operating surface for the
continuous design-improvement lane that runs in parallel with product, backend, agent,
and infrastructure development.

**Mission:** every week, VitalCV becomes easier to understand, easier to use, more
visually coherent, and more obviously differentiated — without destabilizing the
product underneath it.

The canonical experience:

- **Clinician** — Enter your NPI. VitalCV figures out what remains and does everything it safely can.
- **Employer** — Find clinicians. Know what remains. Keep the hire moving toward start.

## Operating model

Two roles run continuously:

- **Design Scout** (browser observation) — audits production and review environments,
  never writes code, and maintains the ranked backlog in [`backlog.md`](./backlog.md).
  It should always hold 5–10 evidenced problems.
- **Design Implementer** (Claude Code) — takes **one** coherent problem at a time from
  the top of the backlog: recon from current `origin/main`, problem statement, before
  evidence, smallest coherent solution, tests, after evidence, draft PR, then **stop** at
  `FOUNDER [SURFACE] VISUAL REVIEW`. Decisions: `GO` / `REVISE` / `HOLD` / `REJECT`.

One problem. One design thesis. One visual review. Never bundle unrelated visual issues.

## Scoring

`user impact × strategic importance × confidence ÷ implementation cost`

- **P0** — comprehension or usability blocker
- **P1** — conversion / major experience problem
- **P2** — differentiation / premium-quality gap
- **P3** — refinement

## North star (every wave must improve at least one)

Comprehension · Effort · Next-action clarity · Trust · Conversion · Differentiation ·
Coherence · Premium quality.

## Canonical principles (short form)

1. Easy outside, sophisticated inside — never expose machinery because it was hard to build.
2. One obvious next action per major state.
3. Show value before asking for work (NPI → value → identity → more value).
4. Explain consequences, not database states.
5. Trust through clarity ("Found in NPPES", not "Verified").
6. Progress must correspond to actual state — no fake progress.
7. Motion has a job (transition, hierarchy, progress, spatial relationship, navigation).
8. Mobile is a composition, not desktop stacked vertically.

References for principle (Palantir: hierarchy/density discipline; Zoox: purposeful
cinematic transitions) — never cloned. VitalCV's own expression: clinical trust +
administrative relief + technical intelligence. Avoid: sci-fi control rooms, generic AI
gradients, SaaS card walls, gratuitous glass, pill excess, stock-photo healthcare.

## Strict parallel-work rules

Before any implementation, check open PRs. High-collision surfaces (shared header,
homepage composition, shared layout, tokens/global CSS, onboarding, employer landing)
belong to their active wave: **audit, document the recommendation in the backlog,
and wait.** Never create competing implementations.

**No silent strategy changes.** Copy/IA/CTA/noun/route recommendations are fine; any
change that alters product strategy, conversion model, truth claims, or pricing stops
for a founder decision. Design autonomy is not product-strategy autonomy. The strategy
canon is `docs/strategy/` (category strategy + operating brief) once installed; until
then, the founder-approved 2026-08-04 category strategy governs customer-facing
vocabulary (wallet/passport/dossier/packet/receipt are retire-tier in primary
clinician-facing copy).

## Visual evidence contract

Every design PR carries before/after evidence: desktop viewport, full page where
useful, mobile, and relevant interaction states (menu open/closed, empty/resolved,
loading/error, anonymous/authenticated, reduced motion) — rendered product, not code
screenshots. Evidence lives under `docs/design/design-lab/<ID>/`.

## Wave stop condition

Every implementation stops at `FOUNDER [SURFACE] VISUAL REVIEW`. `GO` → merge via the
normal exact-SHA gate → production verification → Scout re-audit → next wave.
`REVISE` → same branch, new evidence, review again. Deployment may close the issue,
expose a secondary issue, or falsify the design hypothesis — the backlog updates
either way.

## Standing surface queue

1. Clinician entry (`/onboarding`) — does entering an NPI feel like activating intelligence?
2. Activated clinician experience — "VitalCV is handling this for me."
3. **Start Agent surface** (permanent stream as A0/A1 land) — agent plan, activity,
   consent queue, human action, employer-controlled, completed, change detected.
   Not a chat interface.
4. Opportunity experience — why a role matches, what remains, how easy applying is.
5. Employer entry (`/employers`) — outcome first, evidence second.
6. Employer workspace — roles, readiness, blockers, actions, starts.
7. Shared public navigation — journey system refinement.
8. Trust surfaces — simplify explanations without weakening truth.
9. Mobile system — hunt desktop-first compositions.
10. Legacy cleanup — obsolete nouns, dead routes, competing entry points; recommend
    deletion when it simplifies.

## Weekly synthesis

After several waves, produce `VITALCV DESIGN STATE`: what improved, what got worse,
top-10 backlog, highest-impact unfinished experience, stale-strategy surfaces,
design-system inconsistencies, journey discontinuities, collision map, next three
recommended waves. No giant redesign roadmaps without evidence.

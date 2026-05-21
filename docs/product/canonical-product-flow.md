# Canonical Product Flow

Single binding declaration of what the live institutional product
looks like. The visible navigation is reduced to five canonical
steps; every other route is hidden, secondary-grouped,
operator-only, or noindexed. The rule is enforced by
`scripts/verify-canonical-flow.ts` and the test suite at
`apps/web/__tests__/canonical-product-flow.test.ts`.

## The five canonical steps (binding)

The Navbar's `NAV_ITEMS` array in
`apps/web/components/layout/Navbar.tsx` is the single source of
truth for the visible top-level nav. It MUST contain exactly these
five entries, in this order:

| # | Label | Route | Role |
|---|---|---|---|
| 1 | Home | `/` | Marketing landing + entry |
| 2 | Get Ready | `/get-ready` | Canonical first step; one primary action -> Passport |
| 3 | Passport | `/passport` | Clinician's federal-source resolution |
| 4 | Review | `/review` | Institutional review surface |
| 5 | Status | `/status` | Operational status read |

No other items may live in `NAV_ITEMS`. A wave that adds a sixth
entry is rejected at Codex audit.

## Canonical continuity progression

```
/                  (Home)
   ↓
/get-ready         (Get Ready)         -- this wave adds the landing
   ↓
/passport          (Passport)
   ↓
/review            (Review)
   ↓
/verify            (Verifier preparation, sub-step under /review)
   ↓
/status            (Status)
```

The progression is one-way. Every visible action on a canonical
step MUST carry the four continuity properties:

1. **confirm completion** -- the user sees that their action was recorded
2. **show next step** -- a clear link to the next canonical step
3. **identify ownership** -- whether the operator, the receiving
   institution, or VitalCV owns the next action
4. **disclose simulation boundaries** -- if the step is fixture-
   driven or bounded, the surface says so via a
   `BoundedSimulationDisclosure` or equivalent

## Hidden / secondary routes

These routes EXIST but are NOT in the visible top-level nav. They
remain reachable by direct URL, by deep linking from a step within
the canonical flow, or via operator-only paths. The wave does NOT
delete implementation; it only removes nav exposure.

### Hidden (no nav exposure; noindex recommended)

- `/trust/*` -- trust-doctrine surfaces (consumer access via /passport detail disclosure)
- `/doctrine` and `/trust/doctrine` -- doctrine surface (operator-only)
- `/investigate/*` -- investigative surfaces (operator-only)
- `/autopilot` -- autopilot surface (operator-only)
- `/inbox` -- AI knowledge inbox (operator-only)
- `/dossier/*` -- cryptographic proof dossier (operator-only)
- `/graph/*` -- graph explorer (operator-only)
- `/findings/*` -- findings explorer (operator-only)
- `/storylines/*` -- storyline explorer (operator-only)
- `/issuer/*` -- issuer tooling (operator-only)
- `/verifier/*` -- legacy verifier tree (use `/verify` instead)
- `/calibration` -- calibration console (operator-only)
- `/system-health` -- internal system-health UI (operator-only)
- `/network` -- network operations console (operator-only)
- `/mission-ops` -- mission operations console (operator-only)
- `/ops/*` -- operator console (operator-only; see Wave 23 signal hierarchy)
- `/operator` -- operator readiness workspace (operator-only; see Wave 27)
- `/clinician/*` -- clinician-internal surfaces (auth-gated)
- `/admin/*` -- admin surface (auth-gated)
- `/analytics-foundation` -- internal analytics
- `/calibration`, `/storylines`, `/actions`, `/providers`, `/investigations` -- intelligence ops surfaces

### Secondary-grouped (reachable via /pilot or /for/*)

- `/pilot` -- pilot intake form
- `/for/cvo` / `/for/payer` / `/for/staffing-exchange` -- persona landing pages
- `/employer/*` -- employer review surface (auth-gated)
- `/employers` -- employer marketing landing
- `/explore` -- exploratory provider directory

### Auth + onboarding

- `/sign-in`, `/sign-up`, `/signup`, `/onboarding` -- authentication
- `/account`, `/file`, `/documents` -- account-internal
- `/apply` -- apply flow

### Demo surfaces (NOT linked from canonical flow)

- `/demo/*` -- demonstration routes (Cedar pilot demo, intake, waste, etc.) live on open PRs (#400, #401, #402). When those PRs merge, the demo routes remain reachable by direct URL but do NOT appear in the canonical nav.

## What this wave does NOT do

- Does NOT delete any route. Hidden routes remain reachable by
  URL.
- Does NOT add a `robots: { index: false, follow: false }` to
  every hidden route in this PR -- that touch is large and risks
  introducing regressions. The audit table above documents the
  intended state; a follow-up wave can wire `noindex` per
  directory layout.
- Does NOT introduce a new authentication model. Auth-gated
  routes stay as they are.
- Does NOT add new features. `/get-ready` is a canonical entry
  page; it carries one primary action (`Continue to your
  passport`) and is otherwise read-only.

## What this wave does

- Reduces the Navbar to the five canonical items
- Adds the missing `/get-ready` landing (previously a dangling
  reference in `holder/page.tsx`, `PrequalificationRibbon.tsx`,
  `ReadinessDemo.tsx`)
- Documents the visible / hidden split here
- Ships a verifier that confirms the Navbar exposes only the
  five canonical items

## Bounded simulations (existing surfaces)

The following surfaces are bounded simulations -- they render
fixture data, not live institutional data. They are documented in
their own boundary docs (see Wave 22, 24, 27) and are not affected
by this wave:

- `/pilot` confirmation -- intake record + confirmation copy; no
  CRM persistence
- `/employer/review/[applicationId]` -- demo receipt signed
  in-process; no live application read
- `/verify` -- accepts a demo-token placeholder; real verification
  requires a real signed JWT
- `/operator` -- fixture-driven cohort; no live data wiring yet

These bounded simulations remain bounded; this wave does NOT
change their disclosure or behavior.

## Governance

A new visible route MUST:

1. Either belong to the five canonical steps OR be added to the
   Hidden / Secondary / Auth / Demo table in this doc.
2. Carry the four continuity properties (confirm / next / owner /
   disclosure) if it sits on the canonical flow.
3. Not introduce a sixth top-level `NAV_ITEMS` entry without
   updating this doc, the verifier, and the test suite.

PRs that violate any of the three are rejected at Codex audit and
by `scripts/verify-canonical-flow.ts`.

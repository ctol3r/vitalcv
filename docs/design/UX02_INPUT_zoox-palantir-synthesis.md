# UX-02 Input — Zoox/Palantir Synthesis Teardown (folded)

> **DESIGN-ONLY BOUNDARY**
> This wave may change UI, UX, visual design, interaction design, responsive behavior, animation,
> information hierarchy, customer-facing copy, navigation presentation, and brand expression.
> It may not change application truth, authentication, authorization, consent semantics, data
> models, APIs, readiness calculations, agent policy, source behavior, employer decisions,
> business logic, or pricing behavior.
> If the proposed experience requires one of those changes, record it as a product dependency and
> stop. Do not solve it inside the design PR.

**Status:** program input, folded by founder decision 2026-08-07. Not a wave of its own.
Recommendation language renamed per the founder's #1165 companion ruling (2026-08-08): the
census establishes facts and recommends; it does not legislate — UX-00/EC-20 do.
**Feeds:** UX-02 (brand foundation) — engineering substrate; UX-01 verdict untouched.
**Formerly blocked on** #1160 and the EC-20 back-fill — both resolved 2026-08-08 (#1160
merged; EC-20 back-filled from the FINAL Direction B verdict). This input is now live.

## Provenance and verification

A founder-supplied teardown of live computed styles from zoox.com, palantir.com, and
vitalcv.com, plus this repo. Verified against `origin/main` @ `efda1a5d8` on 2026-08-07:

**Confirmed (and mostly worse than claimed):**
- Token sprawl: **993 unique custom properties** across 35 stylesheets (teardown said 694 —
  that was computed-styles-only). **94 properties are defined in more than one file**;
  `--accent` and `--ink` each in four. Winning values depend on import order.
  Full detail: `docs/CSS_CENSUS.md`.
- `--vt-border: #D6D2C8` at `apps/web/styles/themes/index.css:22` — 1.30:1 against the
  ground, below the 3:1 non-text minimum.
- 11.5px mono microcopy carrying source-freshness disclosures
  (`styles/career-loop-home.css:266,344`).
- Viewport-height void sections: homepage measures **4.1–4.25 viewports of scroll with
  ~340–350 text chars per viewport** at desktop widths (`docs/DESIGN_BASELINE.md`).
- axe: 21 serious `color-contrast` nodes across `/` and `/pricing`; `/` lacks a `main`
  landmark.
- An empty `styles/motion.css` (0 selectors) is imported by 15 files.

**Corrected:**
- `/matcha` is not a public route (Matcha is `/holder/matcha` + the homepage embed).
- `/profile/[npi]` exists but needs seeded data to baseline.

## Governance reconciliation (founder disposition, 2026-08-07)

1. **Fold into the Experience Overhaul Program.** No standalone
   `design/zoox-palantir-synthesis` execution branch; the UI PR freeze stands.
2. **Phase 4 of the teardown (career-loop homepage rebuild) is SKIPPED.** The founder's
   Direction B ruling retired that homepage; its replacement is the Direction B port wave
   from `design-lab/homepage-reset/direction-b/`. Investing in the retired sections is
   explicitly out.
3. **Token *values* are held until the UX-01 verdict back-fills EC-20.** The teardown's
   palette assumes the current light-first ground (`#f0eee9` + indigo); Direction B is
   warm-graphite dark-first. Structure below is a measured recommendation; values are
   decided by the verdict. (EC-20 has since been back-filled — see the status note above.)

## UX-02 candidate substrate (measured recommendations)

These are recommendations from measurement, not decisions. Where one conflicts with a
locked EC-20 row, the locked row wins — e.g. the radius scale below carries a `pill` step,
while EC-20 locks near-sharp 0–3px on panels/instruments with pills retired; UX-02 takes
the scale's *mechanism* (a named radius ramp), not any value a locked row forecloses.

- **Three-tier token architecture** — primitives → semantic → component; component may
  only reference semantic, semantic only primitives. One `:root` file of record; a
  mirrored `tokens.ts` with a vitest drift guard; Tailwind exposure via `@theme inline`
  (watch the circular-`@theme inline` trap and banned-word token names).
- **`@layer` discipline** — `reset, tokens, base, layout, components, utilities, overrides`;
  every surviving stylesheet assigned to exactly one layer; `!important` only in overrides.
- **Stylesheet consolidation targets** (from the census, superseding the teardown's list):
  merge the five homepage sheets (`home`, `reset-home`, `z1-home`, `wave1501-home`,
  `career-loop-home`) only as part of the Direction B port (they style the retired
  surface); merge `matcha*/`; merge the four motion sheets and delete the empty
  `motion.css`; audit the 161 dead-class candidates and the zero-importer files before
  deletion.
- **Brand color ≠ data color.** A categorical `--vt-data-*` palette reserved for charts
  and entity dots; the accent never colors a series.
- **Radius scale** (xs 2 / sm 6 / md 12 / lg 20 / xl 32 / pill) — precision radii on
  evidence/data surfaces, generous radii on marketing media windows.
- **Patterns:** `Section` (content-driven height — no `min-height: 100vh`), `Grid`,
  `SpecRow` (label/value hairline rows for source disclosures — replaces sub-13px mono),
  `MediaWindow` (inset rounded media with a required visible pause control, WCAG 2.2.2).
- **Motion discipline:** IntersectionObserver one-shot reveals only — never scroll-linked
  opacity (the ghost-text class of bug); one dominant animated element per viewport;
  everything inside `prefers-reduced-motion: no-preference`.
- **Floors:** interactive borders ≥3:1; mono microcopy ≥13px; 2px focus ring + offset on
  every interactive element; slab sections carry their own token overrides via
  `[data-tone="slab"]`.

## Verification gates for UX-02 (adapted from teardown Phase 7)

- Density: no route >2.5× viewport height without >800 chars/viewport (baseline in
  `docs/DESIGN_BASELINE.md`; homepage currently fails).
- axe: zero violations on `/`, `/employers`, `/pricing` (currently 21 serious contrast
  nodes + landmark gaps).
- Border token measures ≥3:1 against its ground.
- Visual diff vs `design-lab/ux02-phase0/evidence/` captures at 390/768/1280/1728.
- Lighthouse (incl. CLS) against a production URL — not yet baselined; run before ship.
- Existing gates still apply: design-lint, page-density-system, truth-contract banned
  strings, Design Handoff References in the PR.

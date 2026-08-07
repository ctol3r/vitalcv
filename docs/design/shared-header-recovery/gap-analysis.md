# Shared header visual recovery — Phase 1 gap analysis

**Wave:** FOUNDER WAVE — SHARED HEADER VISUAL RECOVERY (2026-08-06)
**Branch:** `visual/shared-header-recovery` from `origin/main` @ `2e7d7fbb7`
**Creative owner:** Chris Toler (founder direction)
**Status:** written before implementation, as the wave requires.

This document records what the current header does, what the founder asked for,
what was lost in translation, which external interaction principles inform the
rebuild, and what is deliberately not copied. Implementation begins only after
this file.

---

## 1. What the current header does

One public header exists: `apps/web/components/layout/Navbar.tsx` (369 lines),
mounted once via `RootChrome` in `app/layout.tsx`, self-gated by
`isPublicSurfacePath`. Shipped in PR #1068 (2026-08-03) with founder comments
`FOUNDER FINAL PIXELS: APPROVED` and `FOUNDER MOTION AND NAVIGATION: APPROVED`.

- **Structure:** sticky `<header>` at `top: 0`, 64 px row, full-bleed plate with
  max-width content (the Palantir/Zoox geometry from the #1068 brief).
- **Scroll:** a 1 px sentinel + IntersectionObserver sets `data-nav-lifted`.
  At rest the bar has no plate at all; lifted or expanded it gains a
  `color-mix` paper plate with backdrop blur.
- **Navigation:** three group trigger buttons (Clinicians / Employers / Trust)
  that unfold a panel *inside* the bar via a `grid-template-rows 0fr→1fr`
  transition. Escape and outside-click close; carets rotate; reduced motion
  drops every transition.
- **Right side:** `Sign In` only — the primary CTA was deliberately removed in
  Wave 1077 because its label pointed at a retired promise.
- **Mobile:** a toggle opens `LiquidMenu.tsx` — a real modal dialog (focus
  trap, scroll lock, Escape, focus restore) with a circle-bloom mask and a
  flat list: Home · For Clinicians · For Employers · Trust, plus
  Sign In / Build my profile.
- **Theming:** light-only. The bar never responds to what it floats over.

### What actually renders in production (evidence captured 2026-08-06)

`design-evidence/shared-header-recovery/before/*.png` — desktop 1440×900 and
mobile 390×844, `/`, `/employers`, `/trust`, resting + scrolled + menu open.

Three defects the captures and audit establish:

1. **The approved header never appears on the homepage.**
   `styles/career-loop-home.css:46–81` overrides the global header with
   `!important` rules keyed to a brittle Tailwind-class selector
   (`body:has(.clh) header.sticky.top-0.z-50`): it forces an opaque ivory
   plate, kills the backdrop filter, and still styles a `/passport` CTA that
   no longer exists. The transparent-at-rest design approved in #1068 is
   defeated on the one page that matters most. Byte-identical twins exist in
   `styles/reset-home.css` and a lighter one in `styles/z1-home.css`.
2. **The homepage has two full-bleed dark rooms**
   (`clh-room--ink` #12100D, `clh-room--indigo` #3A30C4) **and the header has
   no way to know.** When the paper plate lifts over them it sits as a cream
   slab on ink. There is no section-theme contract anywhere in the system —
   `dark` is `<html>`-scoped via next-themes only, and XS-5's
   `styles/home-surfaces.css` was never built.
3. **`/evidence-network` is a destination in the header's own Trust group and
   renders with no header and no footer.** `publicSurfaceRoutes.ts` de-ops'd
   it but never added it to `PUBLIC_SURFACE_PATHS`.

Also established: no journey concept exists in the chrome (the six-step strip
on `/` is page content, app-state-driven); the mobile menu is a collapsed
desktop list with no journey presence and a rounded pill CTA that CD-13
retired; desktop nav behavior has essentially no automated coverage (the one
spec that touches it runs only in the film-only Playwright project and asserts
a label the default homepage doesn't render).

---

## 2. What the founder requested

Assembled from the current wave directive plus the recovered brief lineage:

| Source | Instruction |
| --- | --- |
| This wave (2026-08-06) | Scene-aware journey navigation: rail `Your Number → Sources → Permission → Review` in the shared chrome; scene-declared light/dark treatment; compact scrolled state; sliding navigation canvas; true mobile recomposition; restrained right side with one contextual primary action. |
| PR #1068 brief | Full-bleed bar, max-width content, no plate at rest, surface earned on scroll and expansion, no generic dropdown hanging off a pill. |
| `docs/design/home-recovery/concepts.md` (Concept A, Zoox-led) | "A sliding chapter menu … **is the navigation system**." Shipped only as in-page anchors on the film variant, with ordinals removed under CD-13. |
| `docs/design/VITALCV_EXPERIENCE_SYSTEM_2026.md` XS-4 | Chapter menu: sticky, active item expands, adjacent labels legible, native anchors, keyboard reachable; mobile = compact strip or anchors, no swipe dependency. |
| `docs/design/zoox-fidelity-measurement.md` | Named next increment **Z3: group crossfade + featured preview** in the expanded panel; "One panel, contents swap … never two panels." |
| `docs/ops/FOUNDER_VISUAL_GATE.md` | One creative owner; before/after at 1440×900, 390×844, 768×1024, 1728×1117; reduced-motion + 200 % zoom captures; desktop/mobile/reduced-motion recordings; draft until `FOUNDER VISUAL DECISION: GO`. |

## 3. What was lost in translation

The founder asked for **journey navigation as the shared chrome**. What
shipped instead, in pieces:

- The Palantir/Zoox *geometry* landed in #1068 — then the homepage stylesheet
  quietly overrode it back into a static paper strip.
- The journey vocabulary landed — but only as in-page anchors on the **film**
  variant (`ChapterRail`), which is now the rollback, not the product.
- The scene system was specified (XS-5 tones) — and never built, so the
  header stays scene-blind.
- Mobile got a well-engineered dialog — whose content remained a shrunken
  desktop list.

The rebuild's job is to converge these into the system that was actually
briefed: one header that knows the story, the scene, and the route.

---

## 4. Interaction principles adopted (and from where)

Live inspection 2026-08-06 (palantir.com, zoox.com) plus the repo's measured
`reference-experience-atlas.md` / `zoox-fidelity-measurement.md`.

**From Palantir** — restraint and precision:
- Transparent header over the scene at rest; monochrome, hairline borders.
- One flat rectangular primary action; no competing buttons; no pills.
- Desktop navigation lives behind a deliberate trigger, not a row of five
  equally weighted links; the expanded state is a full-canvas editorial list
  under a small `NAVIGATION` eyebrow.
- Disciplined type: big + light = authority.

**From Zoox** — the menu as a spatial event:
- The expanded menu is a masked dilation *from the chrome's own footprint*;
  header and canvas transform as one coordinated motion.
- Chrome tightens as it shrinks — content is masked away, never crammed.
- Staggered, linear-eased, ~334 ms stage transitions; a critically damped
  settle; nothing springy.
- Mobile is designed independently (own composition, own rhythm), while
  remaining the same system.

**VitalCV-specific expression:** clinician control, source clarity, calm
trust, warm paper/ink palette, the journey rail as the story spine.

## 5. Deliberately not copied

- No Palantir/Zoox logos, assets, illustrations, fonts (Alliance, gt
  Standard), class names (`foundryNav`, `tabHeader`, `navbar-wrapper`), or
  exact layouts.
- No custom scroll pipeline (Palantir virtualises page scroll; XS-1 forbids
  a second scroll owner — the browser scrolls, we observe).
- No Palantir two-tier navigation (CD-13 retires dual page-level rails).
- No `scroll-snap` progression (R2/XS-1c error gates).
- No dark/ops-token inversion (LINT-04 error gate) — the dark treatment is
  built from the public warm-ink token family instead (see §6).
- No cookie-wall or announcement clutter in the header.

---

## 6. Constraint register — how the rebuild threads the gates

| Constraint | Consequence for this wave |
| --- | --- |
| FOUNDER_VISUAL_GATE §1 duplicate rule | No parallel nav primitive. `Navbar.tsx` and `LiquidMenu.tsx` are rebuilt **in place**; new modules are subcomponents of that single system. |
| Film rollback measures `document.querySelector('header')` + `position: sticky` | The rebuilt header stays a sticky `<header>` element with a stable outer height. |
| Layout shift | Outer bar height is constant; the compact scrolled state tightens the interior (plate, tracking, rail detail), never the box. |
| XS-1 one scroll owner | The header keeps its sentinel IntersectionObserver; scene/stage awareness uses IntersectionObserver on declared sections (discrete activation is explicitly permitted). No scroll listeners, no rAF. |
| LINT-04 (error) | Dark treatment uses component-scoped custom properties derived from public tokens (`--vt-text-primary` as surface, paper tokens as foreground). Never `--vt-surface-inverse`, `--ink-950`, `data-theme="ops"`. |
| LINT-01/05/06/09 ratchets | New header CSS uses `var(--vt-*)` and `color-mix` only; Tailwind z-classes, no literal `z-index`; no raw shadows or font families. |
| LINT-02 ratchet | No new files importing `lucide-react`; icons stay in the two existing baselined files or use inline SVG. |
| LINT-03 ratchet | Any new `@keyframes` go in `styles/motion.css` with a CHANGES entry. |
| CD-13 / homepage-composition-gate | The journey rail lives *inside* the single header tier (optically centered), never as a second page-level rail; no `01–06` ordinals; banned data-attribute names avoided. |
| holder-route-contract | Every navigation href resolves to a live route — enforced against raw source, comments included. |
| page-density / route-guard baselines | No routes added or removed. `/evidence-network` (an existing page) is added to `PUBLIC_SURFACE_PATHS` so the nav's own destination has chrome; `/profile/activate` is pre-listed so the frozen #1081 activation surface receives the header when it lands (listing a not-yet-existing path is the file's established pattern). |
| XS-9 | First Load JS stays within budget — no animation dependency added; CSS transitions and the existing grid mechanism carry the motion. |
| XS-10 | Nothing about the header may delay or obscure the NPI field. |
| CD-19 / FR-5 | Doctrine is amended first: this wave adds **FR-6** to `founder-rulings-2026-08.md` recording the founder's scene-declared header treatment and journey rail, with the surviving prohibitions restated. |
| Banned strings / claims gates | All nav copy reuses shipped, gate-clean phrasing; no freshness words, no bare `Verified`, no speed claims. |

## 7. The system being built

- **`journeyStages.ts`** — one source of truth for the four stages
  (`your-number` · `sources` · `permission` · `review`), labels, screen-reader
  narration, and homepage anchors.
- **`JourneyRail`** — the desktop rail (optically centered) and the mobile
  compact stage display; animated stage transitions; interactive only where
  anchors are honest (`/`); `aria-current` + SR text everywhere; never
  color-only.
- **Scene contract** — sections declare `data-header-theme="light|dark"` and
  `data-header-stage="<stage>"`. A header observer (IntersectionObserver)
  reflects the declarations onto the header. No pixel sampling. The
  career-loop rooms declare their real tones (ink and indigo rooms → dark)
  and their stage mapping; `/onboarding` declares stage advance only from its
  server-confirmed phase, never from client-invented completion.
- **`navDestinations.ts`** — one source of truth for menu destinations
  (desktop canvas + mobile overlay both consume it); real routes only;
  Company group remains deliberately absent (no real destinations exist).
- **`HeaderMenu`** — the expanded canvas: full-width, editorial scale, group
  crossfade in one panel (Z3), coordinated with the bar surface as one
  motion.
- **`LiquidMenu`** (rebuilt in place) — true mobile recomposition: compact
  persistent bar with visible current stage; full-screen overlay with a
  vertical journey rail and editorial groups; the existing focus-trap /
  scroll-lock / Escape / restore kit is retained and tested.
- **Route context** — route → audience + one contextual primary action
  (clinician surfaces: `Build my profile` → `/onboarding`; employer surfaces:
  the established `/employers` entry action); `Sign In` persists; never
  multiple competing primaries.
- **Homepage repair** — the `!important` header override in
  `career-loop-home.css` is deleted; the header owns its own typography and
  surfaces on every public route.

## 8. Known divergences held for founder review

1. **Stage labels.** The wave directive fixes `Your Number / Sources /
   Permission / Review`. The film variant's frozen `ChapterRail` uses
   `Your number / Source responses / Your permission / Human review / What
   happens next`. This wave does not touch the film (it is the rollback,
   guarded by its own CI pass); unifying the film's labels with
   `journeyStages.ts` is proposed as a follow-up.
2. **DISCOVER room mapping.** The career-loop narrative has five rooms; the
   rail has four stages. Mapping chosen: Opening → Your Number; CREATE →
   Sources; DISCOVER → Sources (still "what the record shows"); APPLY (the
   truth-boundary room) → Permission; CONTINUE → Review. Alternative
   (DISCOVER → Permission) noted for review.
3. **Activation completion.** On `main`, `/profile/activate` does not exist
   (it arrives with frozen #1081) and `/onboarding` has no server-side step
   cursor. The rail therefore shows narrative position, not completion
   ticks — completion display waits for a real server signal.
4. **Headerless public routes beyond scope.** `/pricing`, `/support`,
   `/status/technical`, `/onboarding/{identity,readiness,fetching}` and
   others render without chrome today; only `/evidence-network` (a live nav
   destination) is fixed in this wave. The rest are listed for a follow-up
   sweep, including the orphaned second onboarding flow whose dark
   `StepShell` predates Calm Wave.

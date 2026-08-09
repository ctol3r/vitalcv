# VitalCV 2026 Visual Language

**Status:** BASELINE — D-00 of `VITALCV_2026_DESIGN_IMPLEMENTATION_WAVES_2026-08-09.md`. This
document states the design decision and records the measured starting point. **Nothing in it has
been implemented.** No product behavior, copy, token value, visual asset, API, schema, or
deployment setting changed in the wave that produced it.

**Authority chain.** `VITALCV_EXPERIENCE_CONSTITUTION.md` is the experience authority; its
Class A invariants (EC-3 truth, EC-4 no-meaning-in-color-alone, EC-5 accessibility floor, EC-7
ownership) outrank everything below. This document is a **Class B / Class C** instrument: a
visual direction plus contextual guidance, subordinate to the Constitution and to the
`VITALCV_EXPERIENCE_OVERHAUL_PROGRAM_2026-08-08.md` design-only boundary and UI freeze.

**Companion inputs** (design direction, not authority): `VITALCV_LIVING_PROFILE_VISUAL_SYSTEM_2026-08-08.md`
(Profile in Motion), `VITALCV_WORKBENCH_SPATIAL_KNOWLEDGE_PROGRAM_2026-08-08.md`,
`VITALCV_CLAUDE_CODE_ACTION_PLAN_VISUAL_WORKBENCH_2026-08-08.md`.

**Measured:** 2026-08-08 against `origin/main` @ `004f22458`, production build, `next start`.
Evidence: `docs/design/evidence/d00-visual-baseline/`.

---

## Part 1 — The design decision

VitalCV does not imitate Dimension, Linear, or ElevenLabs. It combines their strongest
disciplines into one system:

> **A calm clinical record meets a precise operating instrument.**

VitalCV is not a dark AI workspace, a generic healthcare site, or a white-label credentialing
dashboard. Its visual signature is the portable clinician profile: a clear record that gathers
known facts, exposes what remains, pauses at clinician consent, and carries forward to the next
opportunity.

### 1.1 Inspiration, not imitation — and the attribution that makes that checkable

Three external references informed this direction. **None of their raw tokens, palettes,
component specs, or type stacks may enter production.** They are studied, named, and left
outside the build.

| Reference | Raw material supplied to this repo | Borrow | Do not borrow |
| --- | --- | --- | --- |
| **Dimension** (winding down 2026-05-20) | `DESIGN.md`, `tokens.json`, `variables.css`, `theme.css` — a machine-extracted style report, held outside the repository | Dusk-dark atmosphere, frosted-surface restraint, soft pill actions, low-weight typography, generous breathing room | Its palette (`#0a0a0a` / `#161616` / `#ededed`), its warm-to-cobalt hero, its `--color-*` token names, its DM Sans display stack, its generic AI-workspace composition |
| **Linear** | Public site, observed only | Operational density, hairline precision, low-weight type, decisive status information | Acid-lime branding, over-compact control surfaces, project-management visual tropes |
| **ElevenLabs** | Public site, observed only | Editorial calm, warm paper contrast, product visuals as the only expressive color, quiet cards | Whisper-thin text where accessibility suffers; its identity or orange/blue product sparks |
| **Lovable 2026 trend guidance** | Published guidance, observed only | Functional motion, organic restraint, accessibility, deliberate 3D, mobile performance | Trend collecting — no decorative kinetic type, faux personalization, or 3D for its own sake |

**Measured collision state (2026-08-08).** The repository is currently clean of Dimension's raw
values, which is why a hard guard is cheap to add in D-01 rather than expensive:

| Dimension value | Occurrences in `apps/web/{styles,components,app}` |
| --- | ---: |
| `#0a0a0a` | 2 (incidental, unrelated files) |
| `#161616`, `#d4d4d4`, `#ededed`, `#c2c2c2`, `#686868`, `#b2b2b2`, `#6b62f2` | 0 |
| `#e5e5e5` | 1 (incidental) |

**D-01 obligation:** a static check that fails on any of the Dimension token values or token
names appearing in a production component. Cost today: near zero. Cost after D-02: a migration.

### 1.2 The register

- **Public / story register** — warm graphite field, bone-white type, paper-like profile
  artifacts, frosted panels, one indigo atmospheric glow behind key visual moments.
- **Product / record register** — warm paper surfaces and sharply legible operational panels;
  dense where proof, source timing, or a decision requires it.
- **Work in motion** — the portable profile object and continuity path are the distinctive
  visual form. They replace stock clinical photography, AI blobs, and network-graph wallpaper.

Dark is a deliberate canvas, not a cosmetic dark-mode toggle. Light is a clear record surface,
not hospital white.

### 1.3 Color law

Semantic tokens are the source of truth. Third-party raw tokens never enter `globals.css`.

| Role | Rule |
| --- | --- |
| Canvas | Warm graphite / the existing dark register |
| Paper / primary action | Warm paper or snow-white surface with dark text. **The primary launch CTA is not green.** |
| Editorial accent | The existing indigo family (`--vt-accent-editorial`), in a glow, profile-path highlight, or illustration detail — **never as status** |
| Source-confirmed | Green **only** when a named source actually returned a match |
| Pending / needs a person | Amber **only** for the real pending / needs-you state |
| Blocked / critical | Red **only** for the real blocked / critical state |
| Borders | Warm, low-contrast semantic border tokens; never literal white hairlines everywhere |

**The critical correction.** Green currently means two different things in the same viewport on
`/`: "work VitalCV completed" *and* "the primary action". Part 3 enumerates every call site.
Moving the primary CTA to the warm-paper inverse treatment is not a preference — while green is
the button, green cannot be evidence, and the interface loses its truth grammar.

### 1.4 Type, shape, density

Retain the currently loaded faces. **Do not import DM Sans or Geist from a CDN** — all three
faces are already self-hosted variable `woff2` through `next/font/local` (§2.4).

- Display type: low-to-medium weight, tight tracking, maximum clarity. Never use motion or a
  thin weight to make essential copy legible.
- Shape: buttons/filters/tags full pill; product controls 8–10px; marketing cards 20–24px.
  Operational tables and proof rows stay crisp rather than becoming clouds of rounded rectangles.
  *(Note: the live `/` island currently uses a 2px radius throughout — see §2.5. Reconciling the
  stated shape scale against the shipped one is D-01 work, not an assumption.)*
- Prefer one strong editorial composition or a two-column story over card-grid wallpaper.
- No more than one atmospheric gradient or glow per viewport — never on a button, text, source
  status, or input.

### 1.5 Motion law

- Narrative: one 10–14s replayable profile journey; settle on a composed still.
- System feedback: 80–150ms press/focus/selection · 150–250ms UI state change · 250–450ms
  data-driven profile assembly.
- **No movement means no new state.** Never animate a submission, source lookup, match,
  approval, or employer decision before the corresponding operation succeeds.
- `prefers-reduced-motion`, data saving, 320px layouts, and no-JS each receive a **complete**
  static experience — and that composition is reviewed as a first-class design, not a leftover
  (EC-4). §3.3 records where today's fallback does not meet that bar.

### 1.6 The existing-homepage rule

The live homepage already pairs a real NPI flow with a labelled illustrative five-beat
WorkSurface. **Do not replace that conversion architecture.** Improve it in place: keep the real
NPI entry immediately visible; preserve the no-script completed frame, reduced-motion
annotation, replay, and truth boundary; evolve the scene into the Profile-in-Motion object
language; keep the employer outcome separate and unresolved; update
`docs/design/homepage-composition-manifest.md` and its composition gate in the same change.

---

## Part 2 — Repository baseline (measured, not assumed)

### 2.1 What actually renders on `/`

| Layer | Owner | Notes |
| --- | --- | --- |
| Page | `apps/web/app/page.tsx` | Variant-switched; UX-V1 is the live default |
| Composition | `apps/web/components/home/easy/EasyHome.tsx` (424 lines) | 8 sections, island class `.ezh` |
| Explainer | `apps/web/components/home/easy/WorkSurface.tsx` (422 lines) | 5 beats, JS-scheduled class timeline over CSS transitions, ~10.8s, plays once, replayable |
| Styles | `apps/web/styles/easy-home.css` (1,764 lines) | Fully self-scoped island |
| Chrome | `apps/web/components/layout/Eyebrow.tsx` + `styles/eyebrow.css` | 64px constant-geometry bar; inverts by `data-header-theme` |
| Manifest | `docs/design/homepage-composition-manifest.md` | 8 sections + 3 page-level systems |
| Gates | `homepage-composition-gate.test.tsx`, `homepage-truth-contract.test.tsx`, `home-easy-cutover.test.tsx`, `hero-employer-entry.test.tsx`, `scripts/check-design-lint.ts` | |

**Rollback variants preserved:** `PUBLIC_HOME_VARIANT=career-loop` and `=film`
(`docs/design/PARKED_VISUAL_ERAS.md`).

### 2.2 The token reality — the single most important correction

The implementation brief assumes "use the current VitalCV semantic theme as the source of
truth". For `/` that is **not true today** — and the problem is bigger than one island:

```
easy-home.css   --ezh-*  literal colour declarations:  17     references to --vt-*: 0
eyebrow.css     --eb-*   literal colour declarations:  14     references to --vt-*: 0
hex values declared independently in BOTH files:       11
```

The eleven duplicated values are `#151412 #f2f1ed #9c9d99 #7b7d79 #32302d #4ade97 #2e9e6b
#1c1914 #f6f5f1 #5b5c57 #d9d6cd` — the entire shared vocabulary of `/`, maintained twice under
two prefix families that cannot see each other. A palette change to the page and a palette change
to the chrome are, today, two edits with nothing enforcing agreement.

Both are hermetically sealed islands. They inherit nothing from the semantic layer and
contribute nothing back. Every semantic token D-01 adds must be **mapped into each island
deliberately**; there is no inheritance to lean on, and there are two consumers, not one.

**Where the semantic layer does live** (import order from `apps/web/app/globals.css`):

| File | Role |
| --- | --- |
| `styles/themes/index.css` | **Owns `--vt-*` semantics.** `--vt-accent: #4338CA`, `--vt-accent-editorial: #4338CA` (light) / `#a5b4fc` (dark). This is the indigo family the color law names. |
| `styles/tokens.css` | Palette ramps (`--palette-*`), outline/motion/shadow/ops/trust tokens, badge tokens |
| `styles/vitalTokens.css` | `--vt-color-*`, `--vt-surface-*`, `--control-*` (a second, older layer) |
| `styles/design-tokens.css` | Typography scale, spacing, radius, z-index |

**Existing state semantics that D-01 must preserve, not re-derive:** `--vt-badge-checked-*`,
`--vt-badge-pending-*`, `--vt-badge-unavailable-*`, `--trust-signal-{verified,pending,expired,revoked}`,
`--ops-status-*`, `--palette-{green,amber,red}-*`.

**A guard that does not cover this.** `LINT-01` (raw color outside token files) matches only
*property* declarations — `color:`, `background:`, `border:`… It does not match **custom-property
definitions**. So all 17 of `.ezh`'s literal colors are invisible to it, and `easy-home.css`
does not appear in the LINT-01 census at all (157 lines, top offender `intelligence.css` at 69).
This is the "guard named the file, not the closure" pattern. **D-01 obligation:** extend the
color guard to custom-property definitions, or the new semantic tokens will be enforceable
exactly where they are least needed.

`isTokenFile()` in `scripts/check-design-lint.ts` also exempts `apps/web/styles/theme.css`,
**which does not exist**. Harmless today; misleading to the next reader.

### 2.3 The `.ezh` palette, verbatim

| Token | Value | Current meaning |
| --- | --- | --- |
| `--ezh-ground` | `#151412` | canvas |
| `--ezh-panel` / `--ezh-panel2` | `#1d1b19` / `#232120` | panels |
| `--ezh-line` / `--ezh-line2` | `#32302d` / `#403d39` | hairlines |
| `--ezh-text` / `text2` / `text3` | `#f2f1ed` / `#9c9d99` / `#7b7d79` | primary / secondary / tertiary |
| `--ezh-work` / `--ezh-work-deep` | `#4ade97` / `#2e9e6b` | **completed work AND the primary action** ← the collision |
| `--ezh-hold` | `#e4b45c` | needs a person |
| `--ezh-wait` | `#8f8c88` | waiting on someone else |
| `--ezh-cta-text` | `#1c1914` | label on the green fill |
| `--ezh-light` / `light-line` / `light-text` / `light-text2` | `#f6f5f1` / `#d9d6cd` / `#151412` / `#5b5c57` | employer light band |

### 2.4 Fonts — already correct; do not change

All three faces are self-hosted variable `woff2` via `next/font/local` in
`apps/web/app/layout.tsx`. There is no CDN font request.

| Face | Variable | Role |
| --- | --- | --- |
| Fraunces (roman + true italic) | `--font-fraunces-loaded` → `--font-display` | display |
| Geist Sans | `--font-geist-loaded` → `--font-geist`, `--font-body` | text |
| Geist Mono | `--font-geist-mono-loaded` → `--font-geist-mono`, `--font-mono` | data |

**Measured:** 4 font files, **196.9 KB** total, on **every** route (`/` and `/employers` both).
Fraunces italic loads on `/` even though `/` sets no italic display type — a candidate saving,
not a defect.

Stale reference: `styles/typography.css:34` still names `'DM Sans'` in the body fallback stack;
DM Sans is not loaded anywhere. Cosmetic.

### 2.5 Shape, radius, motion as shipped

`.ezh` uses `border-radius: 2px` on essentially everything — inputs, buttons, panels, chips.
The stated shape scale in §1.4 (pill / 8–10px / 20–24px) is **not** the shipped scale. D-01 must
reconcile these explicitly and record the decision; it must not silently apply either one.

Motion: `@keyframes` count is at a 100-line ratchet baseline repo-wide, but the work surface
uses **none** — it is class-toggling over CSS transitions, by design. Preserve that.

### 2.6 Route map — the program's surfaces, as they actually exist

| Brief's surface | Real module | State |
| --- | --- | --- |
| `/` Homepage | `app/page.tsx` → `EasyHome` | live |
| NPI result / claim | inline in `EasyHome` (`useCareerLoop`) → `/onboarding` | live |
| Clinician profile | `app/clinician/profile/page.tsx` · public `app/profile/[npi]/page.tsx` | live |
| Clinician home | `app/holder/home/page.tsx` | live |
| **Jobs** | **no `/jobs` route exists** | ⚠ brief mismatch |
| MATCHA | `app/matcha/{experience,hospitals,recruiters,investors}` · `app/holder/matcha/*` | live |
| Opportunities | `app/holder/opportunities/{,discover,interested,passed,[id]}` · `app/opportunities/*` | live |
| Apply | `app/apply/[requestUri]` is the **verifier presentation** route, not a clinician "Apply with VitalCV" surface | ⚠ brief mismatch |
| Applications | `app/holder/applications/{,[id]}` | live |
| Workbench | `app/holder/garden/*` + `components/career-garden/*` (**one** notes domain) | live |
| Employer marketing | `app/employers/page.tsx` (`.mz` island) | live |
| Employer app | `app/employer/{applications,review,decision,profile}/*` | live |
| Trust | `app/trust/page.tsx` | live |
| Status | `app/status/page.tsx` | live |
| Pricing | `app/pricing/page.tsx` | live |

Chrome membership is decided by `components/layout/publicSurfaceRoutes.ts` — registry
membership *is* the chrome decision. Any new route in this program must be registered there or
it ships without chrome.

---

## Part 3 — Baseline evidence

Captured against a production build (`pnpm turbo run build --filter @vitalcv/web`) served by
`next start`, Chromium via Playwright. `/trust` and `/status` return 500 locally — both need a
database — so they are **not** measured here and remain open for D-09.

Bytes below are **uncompressed** (local `next start`, no CDN, no brotli). They are a
regression-comparison baseline, not a claim about what a user downloads.

### 3.1 Core Web Vitals and weight

| Route | Width | LCP | LCP element | CLS | FCP | JS | CSS | Fonts | Reqs | Doc height |
| --- | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `/` | 390 | 932ms | `p.ezh-hero-sub` | 0.0000 | 932ms | 1,527.7 KB | 609.3 KB | 196.9 KB | 55 | 5465 |
| `/` | 768 | 540ms | `p.ezh-hero-sub` | 0.0000 | 540ms | 1,527.7 KB | 609.3 KB | 196.9 KB | 56 | 4917 |
| `/` | 1280 | 500ms | `h1` | **0.0054** | 500ms | 1,527.7 KB | 609.3 KB | 196.9 KB | 56 | 2728 |
| `/` | 1440 | 560ms | `h1` | 0.0007 | 560ms | 1,527.7 KB | 609.3 KB | 196.9 KB | 56 | 2677 |
| `/employers` | 390 | 488ms | `p.mz-lede` | 0.0000 | 488ms | 1,058.8 KB | 556.9 KB | 196.9 KB | 39 | 3840 |
| `/employers` | 768 | 620ms | `p.mz-lede` | 0.0000 | 620ms | 1,058.8 KB | 556.9 KB | 196.9 KB | 40 | 2939 |
| `/employers` | 1280 | 532ms | `p.mz-lede` | 0.0000 | 532ms | 1,058.8 KB | 556.9 KB | 196.9 KB | 40 | 2922 |
| `/employers` | 1440 | 432ms | `p.mz-lede` | 0.0000 | 432ms | 1,356.4 KB | 556.9 KB | 196.9 KB | 51 | 2922 |

Long tasks: **0** on every capture. Images: **0 bytes** — there is no raster or vector asset on
either page today, which is the number every future scene asset is measured against.

Next build report: `/` = 12.5 kB route + **302 kB First Load JS**; `/employers` = 615 B + 107 kB;
shared baseline 103 kB.

**LCP is always text.** Any D-04/D-05 hero asset that becomes the LCP element inherits a
432–932ms bar that costs nothing today.

### 3.2 CLS is not zero — and the work surface causes it

At 1280 the page accumulates **0.0054**, in two shifts at **t≈8.3s and t≈9.7s**, attributed to
`div.ezh-workfeed` and `li.ezh-arow`. At 1440, one shift of 0.0007 at t≈9.7s. These are beats 4→5
of the timeline: the work feed and approval card mount into a column that is not reserved for
them.

Well under the 0.1 budget, but the D-03/D-05 gate says **"zero CLS"**, and the composition
manifest describes a server-rendered completed frame that the timeline only re-plays. Both are
slightly untrue at desktop widths. The remedy is reserved space, not a smaller transition.

### 3.3 The fallback compositions have layout defects — in all three modes

Measured overlap and geometry (`geometry.json`, `capture-geometry.mjs`) across no-script,
`prefers-reduced-motion`, and settled-motion at 360 / 390 / 768 / 1280 / 1440:

| # | Finding | Widths | Modes |
| --- | --- | --- | --- |
| **B-1** | `.ezh-seed-tag` ("masked · illustrative") overlaps `.ezh-sf-h` ("Here's what still matters") by 40×7px and `.ezh-sf-hsub` by 40×14px | 1280 | all three |
| **B-2** | `.ezh-feedline` ("0:04 ✓ State license record checked — done") overlaps the beat-5 headings "A role that fits" / "Toward your first day" — up to 119×18px | 1280, 1440 | no-script, settled |
| **B-3** | The work-feed column collapses at desktop: `.ezh-feedline` measures **101px** wide at 1280 and 176px at 1440 — against **664px** at 768 and 256px at 360. Text breaks to roughly one word per line at the most common desktop width. | 1280, 1440 | all three |
| **B-4** | Reduced-motion beat annotations (`[1]`–`[5]`) render **over** the headings they annotate | 1280 | reduced-motion |

Horizontal overflow: **0 at every width including 360.** That part holds.

**Why this matters beyond tidiness:** the server-rendered completed frame is what crawlers,
no-JS visitors, and reduced-motion visitors receive. EC-4 makes that composition first-class.
Today it is the *least* correct rendering of the page.

### 3.4 Contrast

Computed WCAG 2.x ratios for the `.ezh` palette:

| Pair | Ratio | AA text (4.5) | Non-text (3.0) |
| --- | ---: | :---: | :---: |
| `text` on `ground` | 16.29 | ✅ | ✅ |
| `text2` on `ground` | 6.75 | ✅ | ✅ |
| **`text3` on `ground`** | **4.43** | ❌ | ✅ |
| **`text3` on `panel`** | **4.13** | ❌ | ✅ |
| `work` (green) on `ground` | 10.68 | ✅ | ✅ |
| `hold` (amber) on `ground` | 9.63 | ✅ | ✅ |
| `wait` on `ground` | 5.50 | ✅ | ✅ |
| `cta-text` on `work` (CTA at rest) | 10.17 | ✅ | ✅ |
| **`text` on `work-deep` (CTA hover/focus)** | **2.99** | ❌ | ❌ |
| light band body / secondary | 16.88 / 6.18 | ✅ | ✅ |
| `line` vs `ground` (hairline) | 1.40 | — | ❌ |
| `line2` vs `panel` (hairline) | 1.59 | — | ❌ |

**A-1 — `--ezh-text3` fails AA at every size it is used.** 23 call sites (22 of them `color:`
declarations), all rendering at 9–13px — normal-size text, needing 4.5:1. They include the
truth-carrying copy:

- `.ezh-truth` (12px) — *"Illustrative — no real people, and nothing has been sent…"* — the
  `data-home-truth-boundary` line the truth-contract test pins.
- `.ezh-foot-truth` (10.5px) — the derived `data-home-source-cadence` sentence.
- `.ezh-sf-cap` (10px) — *"illustrative — not a live result"*.
- `.ezh-ap-note` (10.5px) — *"in the product, nothing moves without you"*.
- `.ezh-result-src` (10px) — *"Named by NPPES for NPI …"* — the source attribution EC-3 requires.

The qualifiers that keep the page honest are the least legible text on it. That is a truth
problem wearing a contrast problem's clothes, and it is exempt from the UI freeze on both
counts (accessibility regression; truth correction).

**A-2 — the primary CTA drops to 2.99:1 on hover and focus.** `.ezh-npi-submit:hover,
:focus-visible`, `.ezh-result-keep:hover, :focus-visible`, and `.ezh-start-cta:hover,
:focus-visible` all set `background: var(--ezh-work-deep)` with `color: var(--ezh-text)`.
Because `:focus-visible` shares the rule, **a keyboard user sees the failing state as the
default**. Recoloring the CTA to warm-paper inverse (§1.3) resolves this and the color-law
violation in one move.

**A-2b — the eyebrow CTA is 2.99:1 at rest over every light band.** `eyebrow.css`:

```css
.vcv-eb[data-eb-theme='light'] .vcv-eb__cta {
  background: var(--eb-work-deep);   /* #2e9e6b */
  color:      var(--eb-on-work);     /* #f2f1ed  → 2.99:1 */
}
```

This is not a hover state. Over the employer light band on `/`, and on every light-register
public route, the one dominant action in the chrome renders below AA **permanently**. Same two
values as A-2, declared in the second island.

Hairlines below 3:1 are decorative dividers, not state indicators; noted, not filed as a defect.

### 3.5 Touch targets vs. the Constitution's own floor

EC-5 says **44px minimum**. Measured (WCAG 2.2 SC 2.5.8 AA is 24px; SC 2.5.5 AAA is 44px — these
fail the project's stated floor, and the first one fails 24px too):

| Element | 390px | 1280px |
| --- | --- | --- |
| **`#ezh-npi` (the primary NPI input)** | **350 × 21** | 222 × 48 |
| `.ezh-npi-submit` | 350 × 48 | 171 × 48 |
| `.ezh-sf-replay` | 77 × 26 | 77 × 26 |
| `.ezh-hero-emp a` | 145 × 19 | 145 × 19 |
| footer links | ~20 tall | ~20 tall |

**A-3 — the NPI input collapses to 21px tall on phones.** Root cause, `easy-home.css:1741`:

```css
@media (max-width: 480px) {
  .ezh-npi-row  { flex-direction: column; }   /* main axis becomes vertical */
  .ezh-npi-submit { width: 100%; height: 48px; }  /* re-asserted for the button… */
}
```

`.ezh-npi-input` carries `flex: 1` and `height: 48px`. Once the row becomes a column, `flex: 1`
sets `flex-basis: 0%` on the **vertical** axis, which defeats the declared height; the input
shrinks to its 21px content box. The submit button was re-declared in the same block — the input
was not. The single most important control in the funnel is 21px tall on a phone.

**Not fixed in D-00.** Recorded here, and it is freeze-exempt when a wave picks it up.

### 3.6 Screenshots

`docs/design/evidence/d00-visual-baseline/` — `{home,employers}-{390,768,1280,1440}-{fold,full}.png`,
plus `home-1280-{reduced-motion,no-script}.png` and the same pair for `/employers`.
`baseline.json` (vitals + bytes), `geometry.json` (overlap/target measurements), and both
capture scripts are committed beside them.

---

## Part 4 — Green: every call site, classified

`grep -c 'var(--ezh-work'` → **25** in `easy-home.css`. Classified against §1.3:

### 4.1 VIOLATIONS — green as a primary action (must move to warm-paper inverse in D-04)

| Line | Selector | What it is |
| --- | --- | --- |
| 192 | `.ezh-npi-submit` | **THE** primary CTA — "Start with your NPI" (`data-home-primary-cta`) |
| 207 | `.ezh-npi-submit:hover, :focus-visible` | + fails contrast (A-2) |
| 345 | `.ezh-result-keep` | "Keep this record" → `/onboarding` — the conversion action after a real lookup |
| 355 | `.ezh-result-keep:hover, :focus-visible` | + fails contrast (A-2) |
| 1473 | `.ezh-start-cta` | Final band — "Start with your NPI" |
| 1484 | `.ezh-start-cta:hover, :focus-visible` | + fails contrast (A-2) |

Plus, outside `easy-home.css`: **`.vcv-eb__cta`** in `styles/eyebrow.css` (`--eb-work` /
`--eb-work-deep`, the duplicated `#4ade97` / `#2e9e6b`) — the eyebrow's one dominant action,
"Start with your NPI", also green, on **every public route**, not just `/`. It is the same
button in the same viewport as the green "Done by VitalCV" evidence text. **`/` renders four
green primary actions and eight green evidence states simultaneously.** The recolor therefore
spans two files and reaches beyond the homepage.

### 4.2 ADJACENT — decorative/system use of the state hue

| Line | Selector | Note |
| --- | --- | --- |
| 57 | `.ezh :focus-visible` | Global focus ring. Green here is system chrome, not evidence — decide deliberately in D-01/D-02 rather than inherit. |
| 184 | `.ezh-npi-input:focus` | Same. |
| 1193, 1198 | `.ezh-surface.is-static [data-beat]::before` | Reduced-motion beat numerals — decorative numbering in the evidence hue (and see B-4). |

### 4.3 LEGITIMATE — green as factual completed/confirmed work (preserve)

Lines 751, 761, 833, 865, 869, 903–904, 917, 987, 1017, 1063–1064, 1254, 1351–1352 —
`.ezh-arow.is-done .ezh-st-done`, `.is-approved .ezh-st-approved`, `.ezh-feedline .ezh-ck`,
`.ezh-ap-head .ezh-h-ok`, `.ezh-apcard.is-confirmed`, `.ezh-ap-btn.is-pressed`, `.ezh-ap-done`,
`.ezh-applied`, `.ezh-fillbar` + track nodes, `.ezh-own-mark.m-work`.

Each pairs green with a word and usually a glyph, satisfying EC-4. **These keep green.**

### 4.4 Green elsewhere in the product

316 `bg-(emerald|green)-\d{3}` utility uses across `apps/web/{app,components}` — 136 live files,
17 archived. Concentrations: `components/ops` (9 files), `trust-state` (8), `employer` (8),
`developers` (7). Predominantly state dots and badges, i.e. legitimate. Two live action-shaped
uses to revisit at D-09: `components/employer/EmployerDashboard.tsx:280` (a review link whose
**hover** turns green) and `:558` (a green-tinted button).

**Out of D-00 scope. Not a to-do list — a census.**

### 4.5 Indigo

`--vt-accent-editorial` = `#4338CA` (light) / `#a5b4fc` (dark), in `styles/themes/index.css`.
The `.ezh` island references it **zero** times; `/` has no editorial accent at all today. The
older `reset-home.css` / `career-loop-home.css` parked eras define their own `--indigo: #3A30C4`
— parked, not live. D-01 introduces indigo to `/` for the first time; it is an addition, not a
migration.

---

## Part 5 — Gate status at D-00 exit

| Gate | Result |
| --- | --- |
| Visible behavior change | **None.** Documentation and evidence only. |
| Product behavior / copy / tokens / assets / APIs / schema / deploy | **Unchanged.** |
| Targeted vitest (12 files: composition gate, truth contract, truth pass, easy cutover, artifact provenance, hero employer entry, eyebrow ×2, theme tokens, design-lint rules, design reference guard, a11y baseline) | **109/109 pass** |
| `pnpm check:design` | **PASS — 20 rules.** LINT-02 measured 287 vs baseline 310 (may be lowered; left alone, out of scope) |
| `pnpm turbo run build --filter @vitalcv/web` | **Pass** |
| Baseline evidence attached | ✅ §3, `docs/design/evidence/d00-visual-baseline/` |
| Token collision report attached | ✅ §1.1, §2.2, Part 4 |

---

## Part 6 — What D-01 inherits

Ordered by cost-of-delay.

1. **Two sealed islands, zero `--vt-*` references, 11 hex values maintained twice.**
   `easy-home.css` (`--ezh-*`, 17 literals) and `eyebrow.css` (`--eb-*`, 14 literals) each
   redeclare the same palette. Semantic tokens must be mapped into **both**, explicitly.
   There is no inheritance path. (§2.2)
2. **The color guard cannot see the island's colors.** LINT-01 matches property declarations,
   not custom-property definitions. Extend it, or D-01's tokens are unenforceable exactly where
   the debt lives. Prove the extension by injecting a violation and watching it fail. (§2.2)
3. **Four green primary CTAs vs. eight green evidence states, same viewport** — including one
   in `eyebrow.css`, outside the homepage island. The recolor spans two files. (§4.1)
4. **A-2 / A-2b: 2.99:1 on the primary action.** Hover *and* focus in `.ezh`; **at rest** for
   the eyebrow CTA over every light band, on every public route. Freeze-exempt. Both fixed for
   free by (3).
5. **A-1: `--ezh-text3` (4.43:1) carries the truth line, the source-cadence line, and the
   source attributions.** Freeze-exempt on accessibility and truth grounds. (§3.4)
6. **A-3: the NPI input is 21px tall at ≤480px** — `flex: 1` in a column container. Freeze-exempt.
   (§3.5)
7. **B-1…B-4: the server/no-script/reduced-motion frame overlaps itself at 1280 and 1440, and
   collapses the work feed to a 101px column.** (§3.3)
8. **CLS is 0.0054 at 1280, caused by beats 4→5.** The "zero CLS" gate needs reserved space. (§3.2)
9. **Shape scale conflict:** stated pill/8–10px/20–24px vs. shipped 2px everywhere. Decide and
   record; do not silently apply either. (§2.5)
10. **Three brief/repository mismatches:** no `/jobs` route; `/apply/[requestUri]` is the
    verifier presentation surface, not a clinician apply flow; MATCHA lives under
    `/matcha/*` and `/holder/matcha/*`. (§2.6)
11. **`/trust` and `/status` are unmeasured** (500 locally, DB-dependent). D-09 needs a baseline
    for them from a database-backed environment.
12. **Fonts are already correct.** Do not import DM Sans or Geist from a CDN. The one open
    question is whether Fraunces italic (196.9 KB total across four files) needs to load on `/`,
    which sets no italic display type. (§2.4)

---

## Founder decisions still open

1. **Public register:** dark-led (as shipped) or balanced dark/paper? §3 screenshots are the
   evidence for that call. The brief flags it; D-00 does not decide it.
2. **Primary-action treatment:** warm paper (`#f6f5f1`-family, dark text) is the color law's
   answer. Confirm before D-02 builds `VitalAction` around it.
3. **Focus-ring hue:** green today. Keeping it makes green a fourth thing; moving it to indigo
   makes the editorial accent interactive. Neither is free.
4. **Shape scale** (§2.5) — pill-and-soft, or the shipped 2px precision?
5. **Master 3D/video asset production** after the D-05 storyboard proof — still unassigned.

---

## Change protocol

This document is the visual-language authority for the D-series. Amend it in the same PR as any
wave that changes the decision. `docs/design/homepage-composition-manifest.md` remains the
authority for *which sections exist* on `/`; this file governs *how they look*. Where this
document and `VITALCV_EXPERIENCE_CONSTITUTION.md` disagree, the Constitution wins.

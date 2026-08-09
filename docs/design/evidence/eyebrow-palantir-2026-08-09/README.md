# Eyebrow — palantir-exact rebuild, evidence (2026-08-09)

Founder directive: *"since the beginning, I've been asking for the top eyebrow to be exact to
palantir.com — can we make this a reality."* Constitution amendment **A-2** (EC-10 form + the
EC-20 geometry row) records the ruling; this folder holds the measurements behind it.

## How the reference was measured

`palantir-reference.json` and `palantir-menu-reference.json` are computed styles and bounding
boxes read live from `https://www.palantir.com` at 1440×900 and 390×844 on 2026-08-09 (headless
Chromium; the OneTrust consent overlay was removed from the DOM rather than accepted, so no
consent was given on the founder's behalf). `vitalcv-computed.json` is the same probe run against
this branch. `capture.mjs` reproduces the VitalCV side.

## Geometry: reference vs this branch

All VitalCV figures below are the **painted** boxes. Every interactive element is padded out to
44px for EC-5 while its painted box holds the reference value — see deviation 3.

| Property | palantir.com | This branch |
|---|---|---|
| Chrome height | 0 (sticky group, instruments float) | 0 |
| Brand offset | x 30, glyphs centred on y 40 (logo 83×20) | x 30, glyphs centred on y 40 |
| Control row offset | y 30, right gutter 30 | y 30, right edge 1410 at 1440 (= gutter 30) |
| Primary action | 205 × 40, radius 0, 16px/400 | 205 × 40, radius 0, 16px/400 |
| Action → cluster gap | 30 | 30 |
| Square instruments | 2 × 40 × 40, radius 0, borders fused at −1px | 2 × 40 × 40, radius 0, fused at −1px |
| Action rest / hover | white on light page → ink fill, paper text | paper fill → ink fill, paper text |
| Takeover | fixed inset-0 ink canvas under a live chrome | same |
| Takeover columns | 3, hairline-topped, 10px uppercase label | same |
| Takeover destination type | 34px / 400 | 34px / 400 |
| Takeover sub-item | `↳` prefix | `↳` prefix on the detail line |
| Mobile brand | x 20, y 20 | x 20, y 20 |
| Mobile controls | pinned, y 784 at 844 viewport, 40px tall | pinned, y 784, 40px tall |

## Deliberate deviations, and why

1. **Register mechanism.** The reference inverts with `mix-blend-mode: difference` on the header.
   VitalCV keeps its declared `data-header-theme` contract: sections declare their register and
   the chrome reflects it. Blend-difference makes contrast a function of whatever pixel happens to
   sit underneath, and EC-5's contrast floor has to be provable. Same visual outcome, measurable.
2. **The search slot is a real lookup.** The reference's magnifier becomes VitalCV's public NPI
   check (`/verify`), not a decorative control.
3. **Mobile bottom clearance.** Measured at 390×844 before the fix, the pinned cluster covered the
   footer's last two links and the feedback control at the document bottom. The footer now
   reserves 84px and the feedback chip rides above the cluster. The reference reserves equivalent
   clearance; copying the pinning without it would have shipped untappable links.
4. **44px targets under 40px boxes.** The reference's instruments are 40px. EC-5's floor is 44px,
   and the required a11y baseline ratchet caught the regression in CI (`/`: sub-44px targets
   13 → 15) after a full local e2e pass had gone green — the spec landed on `main` while this
   branch was in flight. Rather than pick one, every instrument now paints its box in an inner
   span: the interactive element is 44px, the painted box is the reference's 40px, and the row
   offsets absorb the 2px ring so the *visible* edges still land on the gutter. The same pass
   lifted the wordmark (71×20 → 71×44) and the sign-in link, which the baseline had grandfathered,
   so `/` now measures **12**, below the 13 it inherited.

## Open founder question, visible on `/`

The homepage's own NPI submit keeps its A-1 pill while the chrome action is now a sharp rectangle,
so `/` shows two "Start with your NPI" controls in different silhouettes. The directive covered
the top chrome only; whether the page action follows the chrome to square is a founder call.

## Captures

Desktop: `desktop-hero.png` (dark register), `desktop-light-band.png` (inverted over the employer
band), `desktop-hover.png`, `desktop-menu.png`, `desktop-pricing.png` (off-home).
Mobile: `mobile-hero.png`, `mobile-menu.png`, `mobile-bottom-home.png`, `mobile-bottom-pricing.png`.

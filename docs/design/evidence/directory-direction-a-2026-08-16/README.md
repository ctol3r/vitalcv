# /directory/[npi] — Direction A register pass — evidence

**Wave:** design(directory) — the claim surface, first surface rollout after the homepage
(amendment E scope ruling: "all public surfaces, homepage first").
**Creative owner:** Claude Code Terminal (this wave's builder).
**Captured:** 2026-08-16, production build (`next build` + `next start -p 3077`), Chromium via
`apps/web/scripts/capture-directory-a-evidence.mjs`.

**Theme-ruling revision (2026-08-16):** the founder picked Option 1 "Chart & Badge" (clinical
OBJECTS) and rejected the EKG/pulse-line motif. The drawn pulse under the name was replaced with
a plain hairline rule in the same dim ink, drawn in once (same one-shot mechanism); the ID-badge
and clipboard pictograms stand. Every `after-*` file was recaptured from the revised production
build; the `before-*` files are unchanged.

## What was rendered

Every screenshot renders the **sanctioned synthetic fixture**, never a real person:
NPI `1558395516` (EXAMPLE CLINICIAN, PA-C — check-digit-invalid, absent from NPPES) and
NPI `1558395511` (EXAMPLE CLINIC INC), the two NPIs `directory-claim-entry.test.tsx` already
sanctions. The production server's `fetch` was answered locally by
`scripts/directory-evidence-fetch-stub.mjs` (repo root) for the two federal upstreams
(NPPES, data.cms.gov) — no federal API was hit by the capture loop, and no real clinician's
record appears in committed evidence. Both fixture NPIs render the honest
`not_listed` Medicare state.

## Files

| File | What it shows |
|---|---|
| `before-1440x900{,-viewport}.png` | Old `mz mz-paper` register, desktop (full page + first viewport) |
| `before-390x844{,-viewport}.png` | Old register, mobile |
| `before-768x1024{,-viewport}.png` | Old register, tablet |
| `before-1440x900-reduced-motion.png` · `before-200pct-zoom-of-1440.png` · `before-org-1440x900.png` · `before-1440-focus-claim-cta.png` | Old register: reduced motion, 200% zoom equivalent (720px), organization branch, focus state |
| `after-1440x900{,-viewport}.png` | Direction A register, desktop |
| `after-390x844{,-viewport}.png` | Direction A register, mobile (390 composed deliberately, EC-6) |
| `after-768x1024{,-viewport}.png` | Direction A register, tablet |
| `after-1728x1117-viewport.png` | Wide viewport (content is a 1040px column; included for completeness) |
| `after-1440x900-reduced-motion.png` | Finished frame with nothing armed — identical composition, hairline rule fully drawn |
| `after-200pct-zoom-of-1440.png` | 200% zoom equivalent (720 CSS px layout width), no clipped control |
| `after-org-1440x900.png` | Organization branch: no claim CTA, full record |
| `after-1440-focus-claim-cta.png` | Focus visible on the claim CTA (paper-white ring on the ink card) |
| `after-motion-desktop.webm` · `after-motion-mobile.webm` | One-shot entrance reveals on scroll, hairline rule draw-in, CTA hover/press |
| `after-motion-reduced.webm` | Reduced motion: nothing moves; the story is complete |
| `{before,after}-runtime-report.json` | Console errors (0), horizontal-overflow probe, CTA measurement |

## Measured (after, production build)

| Check | Measured | Floor |
|---|---|---|
| Claim CTA target | 171×52 px | 44 px (EC-5) |
| Bottom anchor link target | 44 px tall | 44 px |
| CTA painted rest state | `rgb(217,40,0)` = `#D92800`, white label, **4.94:1** | AA 4.5:1 (locked E ladder: 4.94 / 5.83 hover / 6.78 press) |
| CTA radius | 8px (`--vt-shape-action-page`) | locked E row |
| Ink `#141312` on ground `#FBFAF7` | 17.78:1 | AA |
| Dim `#5C5852` on ground / on panel | 6.77:1 / 7.06:1 | AA |
| Claim-card copy (`color-mix` 72% band-text) on ink | 9.47:1 | AA |
| Focus ring: indigo `#4338CA` on ground · paper-white on ink card | 7.57:1 · 17.78:1 | 3:1 non-text |
| Horizontal overflow at 1440 / 768 / 390 | none (`scrollWidth == innerWidth`) | none (EC-6) |
| Console errors / hydration errors | 0 | 0 |

Decorative drawn art (badge glyph bars, clipboard bars, the hairline rule) is `aria-hidden`,
depicts no source, count, person, or result, and carries no meaning — removing it costs
only emphasis (EC-4).

## Known capture artifact

In the **fullPage** captures at 720/390, the shared mobile chrome's pinned bottom control
cluster paints mid-page — a Playwright fullPage artifact of `position: fixed` elements. In
the live viewport (see `after-390x844-viewport.png`) the cluster pins to the viewport bottom
per EC-10/A-2, and the page reserves clearance.

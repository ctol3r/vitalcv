# Wave 1501 · CHANGES.md — Flagship homepage to doctrine quality (D-W3)

Deliverable: `wave1501/index.html` — full homepage, consuming Wave 1500 tokens
(`../wave1500/01-primitives.css → 02-semantic.css → 03-themes.css`) and Wave 1500
primitives (`w15-glyphs.jsx`, `w15-primitives.jsx`) directly. No new colors, no
new fonts, no gradients/glows/glass. Light paper only.

## Section-by-section rationale

**Hero (DG-7.1/7.2).** Mono eyebrow → Fraunces headline with the single indigo
italic phrase ("Start faster.") → NPI. The NPI field is genuinely segmented: one
real `<input>` (accessible, `inputMode=numeric`) rendering into ten mono cells,
live `n/10` counter, "No account required · public sources only" microcopy.
Checksum is the real NPI Luhn (prefix `80840`); ten digits that fail render the
p0 error state (glyph + mono caption, cells re-ruled — never color alone).
Focus = steady ink ring + one 420ms brand pulse, single-shot. Valid demo NPI:
`1234567893`.

**Wallet mock (DG-7.3/7.4).** Built only from Wave 1500 `SourceRow`,
`ReadinessRing` (sweeps once to 72, static at 72 under reduced motion),
`StateChip`, `FreshnessStamp`, `HonestyLabel`. Rows exactly per spec: Identity
·NPPES·Source-backed / Exclusions·OIG LEIE·Checked / Enrollment·CMS PECOS·Gated
— gated gets a lock, never a checkmark. "Reads primary sources" chip list shows
state boards as adapter-dependent (dashed pending chip, not checked).

**How it works (DG-7.5).** Five steps under one hairline; Fraunces numerals
punched through the rule (paper background). Single-shot 60ms stagger. On
mobile the grid stacks; the hairline-per-step keeps the connective grammar.

**Why this compounds (DG-7.6).** Three PaperCards (hover lift ≤2px) keyed to
the canonical path stages; RECOGNITION's eyebrow is the one matcha recognition
moment. Below, the reusable `CanonicalPath` component: RECOGNITION → ACCEPTANCE
→ START strip, mono labels, arrow glyphs, stage dots (filled matcha / outline /
filled ink — grayscale-distinct).

**Try MATCHA (DG-7.7).** Quieter than the hero: matcha-soft panel, small type.
Four question chips (≥44px tap targets), response is an instant state swap
(0ms; 240ms entrance fade only). Answers reuse StateChips and close with a
designed HonestyLabel ("Scripted demo · answers are illustrative").

**Constellation (DG-7.8).** Drag-rotate sky kept — on paper, not a dark surface.
Truth semantics never move with the slider: recorded events are solid ink stars,
future events are always dashed (illustrative), and the Began/Now/Headed slider
(restyled to the form kit `.vt-range`) only reveals emphasis along the arc.
"Past and future are illustrative" HonestyLabel sits inside the chart. Labels
counter-render horizontally; geometry is computed in px via ResizeObserver so
type stays legible at 360px. Reduced motion: static chart, drag disabled, hint
hidden. Rendering is plain SVG re-render on pointermove (10 nodes — 60fps).

**By role (DG-7.9).** Four equal-height doors with monochrome role glyphs
(same 1.5-stroke grammar as TrustGlyph), hover lift ≤2px. Verifier door links
to `/verify`, not `/`.

**Who buys in (DG-7.10).** Two-column `<dl>`, mono role eyebrows, hairline tops.

**Footer + rhythm (DG-7.11/7.12).** Every section: hairline top rule, identical
eyebrow→headline→body head, consistent `--space-24` vertical scale (`--space-16`
mobile). Footer ends on the site-wide honesty line: "Illustrative product
preview · not a final credentialing decision."

## New utility classes
Layout-only, in `hp.css` (all colors via `--vt-*` tokens): `.hp-container`,
`.hp-section`, `.hp-sechead`, `.hp-reveal` (single-shot entrance, gated on
`html.js` + `prefers-reduced-motion`), and `.vt-range` (the form-kit slider —
candidate for promotion to Wave 1500). Everything else is component-scoped
(`.npi-*`, `.cpath-*`, `.mt-*`, `.sky-*`, `.door*`, `.who-*`, `.foot-*`).

## Wave 1500 touch (one, additive)
`SourceRow` gained an optional `chipLabel` passthrough so the Identity row can
read "Source-backed" per DG-7.3. No behavior change for existing callers.

## Notes
- `<meta name="theme-color" content="#f4f2ec">` is the one literal hex — HTML
  meta can't reference CSS tokens; value = `--paper-100` per DESIGN_SYSTEM §1.
- Copy audited against the prohibition list (no "verified" as absolute, no
  prohibited source names, "accept as a head start" language throughout).
- Reduced motion: entrances render static, ring renders at 72, MATCHA answers
  swap without fade, sky is static, hover lifts disabled.

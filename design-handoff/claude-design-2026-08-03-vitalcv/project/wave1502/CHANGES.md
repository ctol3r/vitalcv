# Wave 1502 — Buyer Surfaces · CHANGES.md

Three surfaces on the Wave 1500 foundation: `/pilot`, `/review/request`,
`/review/[entityId]`, delivered as one hash-routed prototype
(`wave1502/index.html`). Tokens only — every color is a `--vt-*` role; no new
fonts, no gradients, no dark surfaces. Reuses Wave 1501's `hp.css` for the
reveal system, section-head pattern, and the segmented NPI cell styles.

## A. /pilot — rationale (DG-8.1, 8.2, 8.4, 8.5, 8.6)

- **Metric strip.** Four `StatCard`s: Fraunces tabular number, mono caption,
  and the honesty label as a *structural sub-rule* — dashed `--vt-degraded-border`
  top rule + mono line pinned to the card bottom. It reads as part of the
  card's anatomy, not a disclaimer; identical on all four so it can't be
  mistaken for a per-metric footnote.
- **2×2 scope grid.** Paper cards with mono indices. Copy answers the four
  buyer questions without adjectives.
- **HonestyPanel pair.** The signature layout: `ok` and `watch` panels side by
  side with 3px state-rule top borders, StateChips per lane, and a
  `HonestyLabel` foot. Symmetry is the argument — what's missing gets the same
  design investment as what works.
- **Proof-pack schematic.** Mono nodes on paper (packet → sha256 →
  `ARTIFACT_EXPORTED`), hairline arrows with verb labels ("hash", "record").
  Deliberately diagrammatic; captioned as a schematic so it can't be read as a
  screenshot.
- **Limitations.** Em-dash ink list at body size, uncollapsible, placed
  *before* the form so the request is made post-disclosure.
- **Form.** Form kit with inline validation on blur, error summary on submit
  (focuses first invalid field), free-mail domain rejection on work email, and
  the no-auto-provisioning callout as a designed mono block above the submit.

## B. /review/request — rationale (DG-8.3)

Replaced the sparse left-heavy page with a true two-column composition: intake
form (paper card) at 1.05fr, "What happens next" timeline at 0.85fr. The
timeline names the audit event each step records — process transparency as
content. Mobile: form first, timeline below (source order, no reordering
hacks). NPI uses the Wave 1501 segmented cells with 0/10 counter and checksum
error state, recomposed as a form-kit field (no embedded CTA).

## C. /review/[entityId] — rationale (DG-11.1, 11.3)

- **Under-2-minutes shape.** Identity header (name, mono NPI, specialty,
  ReadinessRing sweeping once) + status chips; then the evidence table sorted
  needs-action → source-backed → informational. Blockers are above the fold at
  1440; the action bar is sticky-bottom so the primary action is reachable
  without scrolling at any viewport height.
- **Evidence table.** CSS-grid table (rows via `display: contents` so all rows
  share column tracks): lane/source, ProofTierBadge, StateChip, FreshnessStamp
  (relative + ISO on hover), full-width limitation note per row. p0 and
  contradicted rows carry their state background tints; state is always also
  glyph + label, so grayscale survives.
- **Divergence.** `DivergencePanel` inside the contradicted row: both values in
  paper cells with contradicted-rule borders, a mono `≠` between, and the rule
  spelled out ("newer is not assumed truer"). Nothing averaged.
- **Action bar.** Three states: idle (three actions + "An audit event will be
  recorded." always visible) → confirm (`WILL RECORD: <EVENT>` mono tag,
  one-line consequence, Confirm/Cancel, focus moved to Confirm) → recorded
  (event id + ISO, single matcha-soft pulse, no loops).
- **Boundary.** Footer statement set in Fraunces with the notDecisionGrade
  glyph: "A reviewer-ready head start — not a final credentialing decision."

## New composites for promotion into the component library

| Component | File | Notes |
|---|---|---|
| `HonestyPanel` | w1502-shared.jsx | `tone: ok\|watch`, items of `{label, source, state, chipLabel?, note?}`, `foot` HonestyLabel. Always deploy as a pair. |
| `StepTimeline` | w1502-shared.jsx | Mono step keys, 44px square markers, hairline connector. |
| Form kit: `Field` / `TextInput` / `TextArea` | w1502-shared.jsx | Label, hint, inline error (glyph + mono), `aria-invalid` + `aria-describedby` wiring. |
| `ErrorSummary` / `SuccessCard` | w1502-shared.jsx | Designed failure/success states; summary links focus their fields. |
| `NpiField` | w1502-shared.jsx | Wave 1501 segmented cells as a controlled form-kit field: 0/10 counter, checksum error, external error slot. |
| `StatCard` (honesty sub-rule) | w1502-pilot.jsx | Number + mono caption + structural honesty sub-rule. |
| `ProofPackSchematic` | w1502-pilot.jsx | Mono node/arrow diagram grammar — reusable for any pipeline explanation. |
| `DivergencePanel` | w1502-entity.jsx | Side-by-side contradicted values with `≠`; belongs wherever sources disagree. |
| `ActionBar` | w1502-entity.jsx | Sticky decision bar, idle→confirm→recorded, audit line always visible, single-shot pulse. |
| `BoundaryFooter` | w1502-shared.jsx | The boundary statement as a designed footer, sitewide. |

## Acceptance notes

- Zero hardcoded colors (grep `#` in wave1502/*.css|jsx hits only comments/none).
- Grayscale: every state pairs glyph + label; tints are secondary.
- Reduced motion: reveals, ring sweep, and pulses all fall back static.
- 375/768/1440 verified; no horizontal scroll at 360 (mono strings use
  `overflow-wrap: anywhere`); coarse-pointer targets ≥44px.
- Copy prohibitions honored — no absolutes, no banned source names, committees
  stay the final step throughout.

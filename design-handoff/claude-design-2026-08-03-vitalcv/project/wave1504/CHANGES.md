# Wave 1504 — CHANGES

Trust surfaces (/trust, /trust/attribution, /status, /trust/graph) + brand
asset suite. Single React prototype at `wave1504/index.html` (hash routes);
brand assets as standalone files in `wave1504/brand/`. Consumes Wave 1500
tokens exclusively — zero new colors, zero new fonts.

## Per-surface rationale

### A · /trust — Trust State Register
- Full site chrome added (S4Nav + S4Footer) so the register reads as part
  of vitalcv.com, not an orphan. Nav brand is the fixed Logo component.
- Tier vocabulary is canonicalized here as **T1 Self-Asserted / T2 Inferred /
  T3 Source Checked / T4 Issuer Signed**. This supersedes the Wave-1500
  `TIER_DEFS` strings (T2 "Source-backed", T3 "Reviewed") — repo task:
  re-point `TIER_DEFS` at this vocabulary.
- Three state planes render the **same 6-slot grid** (OBJECT / OWNERSHIP /
  CHECKED_AT / CHANNEL / REPLAY / RUN_ID) with rising binding. Grayscale
  separability comes from border grammar, not hue: plane 1 = dashed card +
  all slots unbound ("─ ─ ─"), plane 2 = 1px solid + white card, plane 3 =
  2px ink border + T4 badge + signature row.
- Verifier Guarantees panel states ONLY what is live: public JWKS, public
  DID document, no API key. Nothing else.

### B · /trust/attribution
- One row per source: mono small-caps chip (never logos), covers,
  does-not-cover with the limitation verbatim (mono, hairline left rule),
  coverage StateChip, cadence + FreshnessStamp. Same table grammar as the
  endpoints table; stacks to labeled cards ≤900px.

### C · /status
- 4-level spine: HEALTHY / DEGRADED / STALE / CRITICAL, tokenized as
  `--vt-spine-*` aliases (see below). Glyph + label always paired.
- Overall banner reports the honest aggregate ("2 of 4 lanes clean…") —
  the demo state intentionally shows DEGRADED + STALE lanes so degraded
  rendering is visible, not hypothetical.
- The live pulse dot is the ONLY looping animation on any public surface
  (one dot, banner only), gated behind `prefers-reduced-motion`.
- Incident history empty state is designed and honest ("nothing crossed
  CRITICAL — not that nothing degraded").

### D · /trust/graph
- 9 nodes / 8 edges, all mapped to real objects from the register (same
  identifiers: psp_okafor_7f3a, vc_okafor_9d2e, run_2026-07-11_0642Z).
  Node type is encoded by shape (grayscale-legible); signature-chain edges
  (SIGNED_BY, KEY_OF) render at full ink weight.
- Zoom +/− /reset buttons from the button system; drag to pan. Layout is
  static — no simulation, no motion, so reduced-motion needs no fallback.
- Selected node inspects through the SAME SlotGrid as /trust.

### E · Brand assets (`wave1504/brand/`)
- `logo.jsx` — fixed VtLogo lockup (Fraunces 600 + stroke-drawn V mark),
  ink / inverse variants only. Rules on #/brand: 1× cap-height clear
  space, 84px lockup minimum, 16px mark minimum, no other renderings.
- OG set (renderable 1200×630 HTML templates, token-consuming):
  og-default, og-homepage, og-pilot, og-trust, og-profile. The profile
  template has a dashed name slot + dashed-track ring motif with NO
  readiness number. Export to PNG by screenshotting at 1200×630.
- Icon suite: `mark.svg` / `mark-inverse.svg` source + PNGs 16→512 +
  maskable 512 (30% safe zone) + `site.webmanifest` (paper theme).
- Source-name rule codified: NPPES / OIG LEIE / CMS PECOS render as mono
  small-caps chips (`SrcChip`); third-party logos prohibited (attribution
  is a citation, not a partnership).

## Tokens — promotion into the component library
- `--vt-degraded-border` (exists in Wave 1500 semantic layer) is now the
  load-bearing degraded grammar: dashed borders for unbound slots, DEGRADED
  spine cells, incident empty state, OG name slot. Never opacity.
- NEW aliases (defined in `w1504.css`, all point at existing primitives):
  - `--vt-spine-{healthy|degraded|stale|critical}[-bg|-rule]` → state hues;
    degraded's rule is `--vt-degraded-border` (dashed).
  - `--vt-node-{stroke|fill|face|label|select-ring}` + `--vt-edge-{stroke|strong|label}`
    → ink/paper scale, for the verifier graph.

## Slot-grid pattern (promotion candidate)
`SlotGrid` (w1504-shared.jsx): fixed key order OBJECT / OWNERSHIP /
CHECKED_AT / CHANNEL / REPLAY / RUN_ID; bound cell = solid hairline +
mono value (+ optional CopyBtn / sub-line); unbound cell = dashed
`--vt-degraded-border` + "─ ─ ─". Used identically on /trust planes and
graph node inspection — one grammar for lineage everywhere.

Also promotable: `CopyBtn` (copy-confirmed affordance, aria-live),
`TokenRow`, `SrcChip`, `SpineChip`, `DlPanel`.

## Copy compliance
No "verified" absolutes, no ledger/blockchain wording (audit trail), no
prohibited registries/certifications named anywhere including OG images.

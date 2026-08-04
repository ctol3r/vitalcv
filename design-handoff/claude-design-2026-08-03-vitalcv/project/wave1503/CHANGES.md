# Wave 1503 — Clinician Funnel · CHANGES

Get-ready gate, onboarding ingestion, passport, public share page, and the
Recognition moment (DG-10.1 … DG-10.5). Tokens only — every color, rule,
radius, duration and type size resolves to Wave 1500 `--vt-*` /
primitive-scale variables. No new hues, no gradients, no dark surfaces.
Kit consumed: StateChip ×9, SourceRow grammar, ReadinessRing,
ProofTierBadge, FreshnessStamp, buttons, NPI segmented input (1501),
HonestyPanel rendering (1502).

## A · /get-ready (DG-10.1)
Two designed states replace the unstyled flash. **Signed-out pitch**:
eyebrow → Fraunces headline (one indigo italic: "career wallet.") → lede →
primary CTA + mono microcopy line ("Free for clinicians · no card · no
document uploads to start"), then the four value bullets as paper cards
keyed by holder verbs (Carry / Present / Share / Keep). Server-renderable:
static markup, entrance motion gated on `html.js.motion-live`. **Checking
state**: wordmark + paper skeleton that mirrors the passport it is about to
draw (identity head + three rows) + mono status line. Skeleton shimmer is
an opacity breathe — the one permitted loop, strictly while loading;
auto-advances to onboarding at ~1.7s.

## B · /onboarding (DG-10.2)
The load IS the demo. NPI entry reuses 1501's segmented field (real Luhn,
p0 error state; demo NPI `1234567893`). "Run source check" streams lanes
one at a time (~420ms apart), each entering as a pending EvidenceRow and
resolving ~680ms later: NPPES → checked·T2, OIG LEIE → checked·T2,
PECOS → gated ("Authorize read"), state-board → gated, honestly
adapter-dependent. Finale: ring sweeps once (CSS dasharray transition,
house curve) to 58 — Head-start band, honest for 2/4 source-backed — and
ONE next action: "Open your passport." Fail-closed demo toggle: OIG outage
resolves that lane to `unavailable` ("never assumed clear"), score drops
to 44. Reduced motion collapses the whole sequence to instant static rows.

## C · /passport (DG-10.3)
A paper document, not a dashboard: mono metadata strip (doc id ·
compiled timestamp · "carried by the clinician"), identity block, ring
with band label + "What would raise this" (three glyph rows with mono
deltas, footed "Estimates · recomputed at next compile"). Evidence groups
render the same EvidenceRow used everywhere; blockers sorted first and
re-ruled with p0 background pulled to full-bleed of the group. Share
affordance is selective disclosure made concrete: section checkboxes
drive a live recipient preview (miniature share page, worst-state chip
per section, "Withheld by you" line), then a mono link line + expiry
("Readable 30 days · withdraw anytime · each open receipted"). Footer
boundary fixed wording: "A head start for employer review — not a final
credentialing decision."

## D · /p/[slug] (DG-10.4)
Cold view, one-minute read: wordmark + mono eyebrow + "Read-only ·
opened" stamp; identity card with the SAME ReadinessRing rendering;
sections as tightened EvidenceRow cards (actions stripped — recipients
read, they don't operate); withheld notice framed as a choice ("absence
here is a choice, not a gap"); Recognitions; mono verify block ("verify
at vitalcv.com/api/receipts/verify — no API key required"); 1502
HonestyPanel pair re-worded for what-this-is / what-this-is-not.

**Print styles (promotion candidate):** `@media print` strips nav +
prototype chrome, forces white paper, re-rules cards in ink,
`break-inside: avoid` per card, un-inks links, reveals a print-only
footer carrying the page URL + verify line + packet id, and force-prints
the Recognition stamp colors (`print-color-adjust: exact`). Reveal/enter
states forced visible.

## E · Recognition (DG-10.5) — promotion candidate
One row grammar on passport and share page alike: matcha seal (checked
glyph in a brand-ruled circle), employer name, fixed sentence "Accepted
as head start — committee review continued on their side.", mono
timestamp + packet id, and the stamp: mono uppercase "Recognition Nº
NNNN", 1.5px brand rule, brand-soft fill, rotated −1.4° — the ONE
reserved matcha moment in the funnel. Motion is a single archival settle
(background fades brand-soft → paper, once). Never confetti, never
"final decision" wording.

## Shared / promotion notes
- **EvidenceRow** (`ev3-*`): SourceRow grammar + ProofTierBadge cell +
  optional note + blocker treatment. Candidate to replace inline SourceRow
  where tiers are shown (used identically in B, C, D — truth in
  advertising is testable).
- Nav, demo strip, footer boundary follow 1502 patterns; demo strip is
  dashed-rule chrome, stripped in print.

## AC check
Tokens only ✓ · identical row/ring rendering across passport, preview,
share ✓ · reduced-motion static ✓ · fail-closed designed ✓ · print clean ✓
· grayscale legible (state = glyph + rule + wording, never color alone) ✓
· no horizontal scroll at 360px (grids collapse ≤620/720/900) ✓ · tap
targets ≥44px via coarse-pointer rule ✓ · copy prohibitions respected ✓.

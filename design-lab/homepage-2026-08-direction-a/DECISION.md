# Direction A — the 2026-08 homepage bake-off record

**Status:** FOUNDER VERDICT, 2026-08-15. Implemented as constitution amendment E.
**Artifact:** `index.html` (this directory) — the final round, six drawn figures,
with the Illustrated / Text-only toggle and desktop / 390px frames used in review.
The live iteration ran as a private Claude artifact; this file is the committed
copy of record.

> **Name collision, noted deliberately:** `design-lab/homepage-reset/direction-a/`
> is the *retired 2026-08-07 UX-01 candidate* — a different direction that happens
> to share the letter. This directory is the 2026-08 bake-off winner. Nothing in
> the older directory carries authority here (PARKED_VISUAL_ERAS rules apply).

## The rounds, and what the founder ruled

**Round 1 — three directions rendered.** "A — minimal-bold paper" (Abridge/Doximity
lineage), "B — the ledger" (Palantir/Mercor lineage), "C — apply" (Medallion/Checkr
lineage), built from the founder's reference set of 2026-08-11.

**Round 2 — the ruling that shaped everything:**

> "A and C are decent. i like A's minimal yet bold style and the way things are
> positioned. B is too basic. for C i like the simplicity and header 'one
> profile. every...' but for sure i like how the last w[o]rd in the header
> changes to different words. but ultimately i need to see more examples. the
> user needs to understand vitalcv within the first 30 secs of visiting the site"

C's cycling payoff line was folded into A. The thirty-second bar became the
program's standing comprehension requirement (the C3.1 five-second protocol is
its measured proxy).

**Round 3 — the verdict:**

> "ok i like A the most. but i need illustrations and visuals not just text"

**Round 4 — two product rulings, folded in as figures 5 and 6:**

> "why isnt job opportunities mentioned once on homepage??"

> "i also the idea is for the clinician not needing to do anything. vitalcv
> keeps the clinician updated and ready to get hired and start seeing patients"

The first became the Roles section (the live opportunity feed framed by the
match-explanation figure — reusing the founder-approved #1267 copy). The second
became the standing watch ("Most weeks, you do nothing.") — stated to the limit
of what the product truthfully does (watch, refresh, flag), never as a
credentialing outcome, which is the employer's and the truth contract's line.

**Same-day scope rulings (2026-08-15):** the register applies to **all public
surfaces, homepage first**; a **homepage visual freeze** holds until the
recomposition ships and is approved; jobs render as **the live feed + the drawn
match figure**.

## What the amendment normalized, and why

- **11px → 8px page-action radius.** The artifact used 11px; Direction D shipped
  8px and the e2e contract pins it. E adopts 8px (`--vt-shape-action-page`)
  rather than minting a third value one pixel from `--vt-shape-control`.
- **Display face → Geist.** The artifact's H1 was the system sans stack; EC-20's
  locked typography row is Geist; roles.json records Fraunces as "the SUPERSEDED
  display face." Three signals agree, so E restores Geist at the artifact's
  scale (`clamp(38px, 6.2cqw, 66px)`, 500, −0.042em). Fraunces survives only as
  the serif editorial aside.
- **Hot accent contrast ladder.** White label on `#D92800` = 4.94:1; hover
  `#C42400` = 5.83:1; press `#B22000` = 6.78:1. The paper-coloured label was
  rejected at 4.73:1 (thin headroom). Asserted in
  `apps/web/__tests__/scene-token-contract.test.ts`.
- **Ground/ink deltas from Direction D are within a hair** (`#F7F6F3→#FBFAF7`,
  `#131211→#141312`) — E carries the artifact's exact values so the committed
  artifact and the law agree, at zero perceptual cost.

## Figure doctrine (from the artifact's own verification battery)

Every value in every figure is a **blank bar** — the real ones belong to the
viewer. Every figure self-labels ("Illustrative — …"). No employer names, no
role counts, no percentages, no well-formed NPIs, no state words the product
cannot produce. Effective SVG text ≥ 11px at every rendered width (effective
size = font-size × rendered-width ÷ viewBox-width — measure it, don't eyeball
it). Wide/narrow viewBox pairs per figure; hoisted `<marker>` defs (markers
defined inside a `display:none` figure vanish on mobile); reveal animation is
an enhancement with content visible by default and static under reduced motion
and no-JS.

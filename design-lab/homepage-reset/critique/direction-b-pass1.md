# Direction B — Intelligent Product · Critique pass 1 (during implementation)

Method: Playwright captures at 1440×900 / 390×844; builder additionally exercised beat progression,
ticker text, inversion, menu focus handling, digit filtering, and ban sweeps headlessly.

## Five-second test — PASS
Headline + green Start on the left; on the right the product is already typing its own masked NPI
and starting to work. What VitalCV is arrives by demonstration, not claim. Surface chrome reads
"HOW VITALCV WORKS · ILLUSTRATION — NOT A LIVE RESULT" — comprehension and honesty in one line.

## Easy-button test — PASS (strongest of the three on this dimension)
You literally watch work leave the clinician: rows flip to "✓ Done by VitalCV 00:04/00:06" with
mono timestamps, one item pauses amber for approval ("in the product, nothing moves without you"),
then continues. The ownership panels repeat the four-owner contract.

## Distinctiveness test — PASS
Warm graphite (no blue-black), zero gradients/glow, work-green used only as the work color. Reads
as a precision instrument, not an AI-startup template and not dashboard porn. The one direction
where the AGENT is the visible protagonist.

## Trust test — PASS
Every surface labels itself an illustration ("no real numbers, no real people"); caption "We show
where every fact came from. Values here are placeholders — not every source has every answer, and
we say so when one doesn't." Footer marks the page "DESIGN PROTOTYPE B — NOT THE LIVE PRODUCT".

## Product test — PASS
The five beats map exactly to the product trajectory: masked seed → sourced facts → "Here's what
still matters" owner-labeled list → work feed with approval pause → role, "Applied with VitalCV",
first-day track. Beat dots + Replay give the visitor control after the single autoplay.

## Employer test — PASS
Quiet "Hiring clinicians? VitalCV for employers ↳" in the hero; a full light band with A/B/C
points ("Search by what's on record, not what's on a résumé") — credible without hijacking, and it
doubles as the eyebrow-inversion moment.

## Eyebrow spec check — PASS
64px fixed instrument (56px mobile), wordmark left, centered mono ticker that narrates the beats
("01 · Reading the NPI" … "05 · Toward day one") — contextual product state as the middle zone,
the most literal fulfilment of that requirement across the set. Right: Sign in + green square CTA
+ boxed menu glyph → full-takeover numbered index. Inverts with identical geometry over the light
band (verified by builder; harness now captures the strip over #employers as evidence).

## Risks / watch items
1. An 18s autoplay asks for patience; beat dots + ticker mitigate, reduced-motion shows the full
   annotated final frame. Watch whether the founder finds the pacing generous or slow.
2. Dark-first homepage is a bigger brand statement than A; the light employer band gives relief.
3. Beat-5 dims the upper surface to 0.38 — the two background panels clip behind the resolution
   band; reads as intentional layering. ACCEPTED.

## Defects found → actions
1. Desktop h1 orphaned "rest." on its own line — text-wrap:balance added. FIXED.
2. Harness inversion shot pointed at #outcome (dark in B) — harness now captures both #outcome and
   #employers strips. HARNESS CHANGE.

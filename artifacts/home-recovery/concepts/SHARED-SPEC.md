# Shared spec for all three concept mockups

Every concept file lives at artifacts/home-recovery/concepts/concept-{a,b,c}.html,
links ./base.css (already written — tokens, fonts, stamps, artifact, btn, nav),
and uses THE SAME product truth and copy so the founder compares composition,
not promises.

## Frames (capture harness)
Each concept HTML = 5 <section class="frame" id="..."> in this order:
  #opening   — arrival: identity + promise + labeled NPI input + primary action + product object + employer secondary path
  #sources   — SOURCE RESPONSES: what returned, close-up product depth
  #permission— YOUR PERMISSION: what travels vs held (ILLUSTRATIVE WORKFLOW label required)
  #review    — HUMAN REVIEW: what the employer receives + reviewer checkpoint (ILLUSTRATIVE WORKFLOW label required)
  #closing   — conversion: "The evidence can move." / "The decision stays human." + both CTAs + trust links
Frames must compose at BOTH 1440×900 (each frame exactly 100vh at that size) and 390×844 (recomposed via media queries — NOT shrunk desktop: single column, artifact legible, no horizontal overflow, 44px targets).

## Chapter vocabulary (all concepts)
YOUR NUMBER · SOURCE RESPONSES · YOUR PERMISSION · HUMAN REVIEW (mono eyebrow style)

## Shared copy (verbatim)
H1: "Get hired on evidence." (one accent-word allowed: wrap "evidence" in <em class="accent-word">)
Support: "Start with your NPI."
NPI label: "Your 10-digit NPI" · placeholder "10-digit NPI" · button: "Check what's ready"
Hint: "Free for clinicians · No account required"
Truth boundary (must appear in #review or #closing): "VitalCV assembles what these sources return. It does not credential, privilege, or clear anyone — the institution keeps that decision."
Closing lines: "The evidence can move." + "The decision stays human."
CTAs: "Check my readiness" (primary) / "For employers" (secondary)
Trust links: Status · Source attribution · Evidence network · Trust

## The six sources (exact rows, exact stamps)
NPPES Identity — CMS Registry · read per request — stamp-notchecked ○ NOT CHECKED
OIG Exclusions — OIG LEIE · monthly snapshot — stamp-notchecked ○ NOT CHECKED
State License — State Medical Board · access required — stamp-access ⊘ ACCESS REQUIRED
PECOS Enrollment — CMS PECOS · quarterly snapshot — stamp-notchecked ○ NOT CHECKED
Employment History — The Work Number · access required — stamp-access ⊘ ACCESS REQUIRED
Board Certification — ABMS / Specialty Board · access required — stamp-access ⊘ ACCESS REQUIRED

## Resolved state (for #sources close-ups) — ALWAYS carry the label
"ILLUSTRATIVE — NOT A LIVE RESULT" (class .illustrative) on any panel showing returned data.
Illustrative identity: name "K. Osei, PA-C" · NPI shown MASKED as "NPI ····· 4821" (mono).
Resolved rows may show: NPPES Identity — ● CONFIRMED — "NPPES NPI Registry · 2026-08-02 14:02Z";
OIG Exclusions — ◐ SNAPSHOT — "OIG LEIE · 2026-07 monthly file · no match";
PECOS — ◐ SNAPSHOT — "CMS PECOS · 2026-Q3 file · enrolled";
State License — ⊘ ACCESS REQUIRED — "board access not yet open — shown as exactly that".
Signed receipt facts (real, static): "ES256 · P-256" · key "vcv-es256-prod-1" · "/.well-known/jwks.json".

## Permission rows (#permission, illustrative)
Identity & taxonomy — TRAVELS · Federal exclusion result — TRAVELS · License claim — TRAVELS ·
Compensation expectations — HELD · Current employer standing — HELD
Each with a small mono toggle mark ("→ TRAVELS" accent / "■ HELD" ink) — not a UI toggle, a decided ledger.

## Review scene (#review, illustrative)
Packet header: "Evidence packet · K. Osei, PA-C" + "rcpt:nppes:8f2a…c41" mono + ILLUSTRATIVE WORKFLOW label.
Reviewer checkpoint block: "⏸ AWAITING INSTITUTION REVIEW" + sentence "Final credentialing, privileging, and hiring authority remain with the institution."

## Hard rules (CD doctrine — violations = rejection)
- Paper #F0EEE9 field; NO gradients on paper, no glow, no shadows on evidence; hairline rules structure everything.
- Stamps are 3px rectangles (base.css .stamp) — never pills; state word always ink; glyph carries hue.
- Machine facts (NPIs, timestamps, source names, receipt ids, cadences) in .data/.eyebrow mono. Prose in Geist. Argument in Fraunces.
- Green #1C5C38 ONLY on confirmed-state glyphs, never decoration/buttons.
- Buttons 10px radius, 44px min-height. Focus-visible styles present.
- Glass ONLY on the .nav chrome (already in base.css). Evidence panels opaque .artifact.
- No banned strings (no bare "Verified", no "automatically verified", etc.). No fabricated metrics/percentages. No stock imagery — the only imagery is VitalCV's own artifacts.
- The banned emptiness: no frame where the product object is a lone ~480px card in a wide empty field. The product object must carry real visual mass (layering, scale, cropping, overlap are the tools).
- Static mockups: NO JavaScript needed; motion is described in data-motion attributes (see below).
- Annotate intended motion: on any element that would move, add data-motion="..." (short phrase, e.g. "resolves once on arrival, 240ms opacity"). These are storyboard notes, invisible in render.

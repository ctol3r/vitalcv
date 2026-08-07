# VitalCV media shot list

Program: issue #1069 · Phase Z0 · **No product code.**

Every asset the cinematic homepage needs. **The only imagery VitalCV publishes
is its own artefacts** (CD-13) — no stock clinicians, no isometric
illustration, no 3D blobs, no photography of people.

## Standing data rule — applies to every asset without exception

No real clinician identity, NPI, licence number, employer event, or sensitive
record may appear in any illustrative media. The masking convention is already
established and is not negotiable:

- **Names**: a fictional holder (`K. Osei, PA-C`).
- **NPIs**: masked tail only (`NPI ····· 4821`). **Never a well-formed
  ten-digit number**, valid or synthetic — a well-formed NPI in marketing media
  is indistinguishable from a claim about whoever actually holds it, and this
  repository has already shipped seeded profiles occupying real NPIs once.
- **Every surface showing returned data** carries `Illustrative — not a live
  result`; every workflow surface carries `Illustrative workflow`.
- **Cadences and source names** are read from `lib/trust/sourceLanes.ts`, never
  typed into an asset, so a mock cannot claim freshness the real lane lacks.

## Asset register

Status is honest: the shot list is **specified, not yet produced**. Dimensions
below are targets derived from the storyboard, not measurements of finished
work.

---

**ASSET ID:** `EVR-POSTER-{01..11}`
**SCENE:** All — one poster per face (BLANK … SEALED)
**PURPOSE:** Prove the object stays recognisable across all eleven states; the acceptance artefact for the Living Evidence Record
**VISUAL CONTENT:** The record alone on paper, no page chrome
**LIVE DOM OR MEDIA:** Media (review artefact) — the shipping states are live DOM
**STATIC / VIDEO / 3D:** Static
**DESKTOP DIMENSIONS:** 1200 × 1500 (portrait 4:5)
**MOBILE DIMENSIONS:** 750 × 900
**POSTER FRAME:** n/a · **TRANSPARENCY:** none · **LOOPING:** n/a
**ESTIMATED FILE SIZE:** ≤ 180KB each, AVIF
**LOAD PRIORITY:** Review-only, never shipped to the route
**ACCESSIBILITY ALTERNATIVE:** The live DOM face is the accessible version
**DATA CLASSIFICATION:** Illustrative — masked identity, masked NPI
**OWNER:** Claude Code Terminal
**ACCEPTANCE CRITERIA:** Placed side by side, a viewer identifies all eleven as the same object without reading any label

---

**ASSET ID:** `HERO-RECORD`
**SCENE:** Desktop 03–06, Mobile 02–03
**PURPOSE:** The hero protagonist at 55–75vw
**LIVE DOM OR MEDIA:** **Live DOM** — it must accept typing and morph into the real `LiveNpiResult`
**STATIC / VIDEO / 3D:** DOM, optional Tier-A WebGL layer behind it
**DESKTOP DIMENSIONS:** 55–75vw × ~4:5 · **MOBILE:** 92vw
**POSTER FRAME:** Static SSR render (this is what no-JS and Tier C receive)
**LOAD PRIORITY:** Critical — first paint
**ACCESSIBILITY ALTERNATIVE:** It *is* the DOM; the NPI field is a real labelled input
**DATA CLASSIFICATION:** Real for the visitor's own lookup; illustrative before entry
**ACCEPTANCE CRITERIA:** Typing visibly assembles the object; submit morphs the same object rather than swapping components; nothing asserts a source result before one returns

---

**ASSET ID:** `SRC-RAIL-{AWAITING,RETURNED,LIMITED,INSPECTED}`
**SCENE:** Desktop 07–08, Mobile 04
**PURPOSE:** The four states of the sticky source stage
**LIVE DOM OR MEDIA:** Live DOM
**DESKTOP DIMENSIONS:** 70–84vw frames, 8–14vw next-frame preview, 24–48px gap
**MOBILE:** stacked vertically, full width
**LOAD PRIORITY:** Below the fold, lazy
**DATA CLASSIFICATION:** Illustrative — labelled
**ACCEPTANCE CRITERIA:** Four distinct states, one object; the `LIMITED` state renders access-gated licensure as exactly that and never as a failure

---

**ASSET ID:** `CLAIM-LENS`
**SCENE:** Desktop 09, Mobile 05
**PURPOSE:** One claim opened to CLAIM / STATE / SOURCE / OBSERVATION / RETRIEVAL / RECEIPT / LIMITATION / PERMITTED USE
**LIVE DOM OR MEDIA:** Live DOM — **must converge onto the existing `ProofPacketInspector`, not duplicate it**
**ACCESSIBILITY ALTERNATIVE:** Native disclosure semantics; Enter/Space open, Escape closes, focus returns
**DATA CLASSIFICATION:** Illustrative — labelled
**ACCEPTANCE CRITERIA:** Exactly one inspector implementation exists in the codebase afterwards

---

**ASSET ID:** `PERM-SPLIT` · `HANDOFF-PATH` · `CONSENT-SEAL`
**SCENE:** Desktop 10–11, Mobile 06–07
**PURPOSE:** The record separating into travels/held, the subset crossing the consent boundary, the seal
**LIVE DOM OR MEDIA:** Live DOM
**DATA CLASSIFICATION:** **Illustrative workflow** — mandatory label until a real Apply transaction drives it
**ACCEPTANCE CRITERIA:** The complete record visibly stays with the clinician; only the subset moves; held rows read neutral, never failed; **no delivery state is claimed without a persisted delivery**

---

**ASSET ID:** `INK-REVIEW-SCENE`
**SCENE:** Desktop 12, Mobile 08
**PURPOSE:** The one full-bleed warm-graphite chapter
**LIVE DOM OR MEDIA:** Live DOM; evidence artefacts inside remain opaque paper (CD-6 amendment)
**DESKTOP DIMENSIONS:** 100vw × 100svh
**DATA CLASSIFICATION:** Illustrative workflow
**ACCEPTANCE CRITERIA:** Exactly one Ink chapter on the page; no dark evidence card; the decision owner is named

---

**ASSET ID:** `AMBIENT-{01..03}` (optional)
**SCENE:** Chapter transitions
**PURPOSE:** Original source-light texture — the one non-semantic material
**STATIC / VIDEO / 3D:** Static AVIF, or CSS-only
**ESTIMATED FILE SIZE:** ≤ 120KB each
**LOAD PRIORITY:** Lazy, non-blocking
**ACCESSIBILITY ALTERNATIVE:** Decorative, `aria-hidden`
**ACCEPTANCE CRITERIA:** Never larger in visual weight than the product object — the failure this whole recovery began with

---

## Budget

Total initial media payload **≤ 6MB**, hero poster immediate, everything else
lazy, WebGL loaded only after capability detection and never required for
meaning. Assets not yet produced, so no measured figure is claimed here.

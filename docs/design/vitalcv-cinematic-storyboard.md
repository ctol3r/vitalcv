# The Living Evidence Record — anatomy and storyboard

Program: issue #1069 · Phase Z0 · **No product code.**

The protagonist is not a page. It is **one object**: the record a clinician
owns. It forms, resolves, opens, separates, travels, arrives, and is inspected.
Every scene in the homepage is that object in a different state — never a new
card, never a different component wearing the same name.

The test this document has to pass: **cover the copy and the object still
reads.** If a scene only makes sense because a sentence explains it, the scene
has failed and the sentence is carrying it.

---

## Part I — Anatomy

These are the parts. Every face below is built from this list and nothing else;
a face that needs a new part is a signal that the face is wrong, not that the
anatomy is short.

| Part | Definition |
| --- | --- |
| **SILHOUETTE** | A portrait-leaning rectangle with a hard top edge and a soft foot. Recognisable at 120px thumbnail and at 70vw. The top edge is the heaviest line in the object — it is what the eye locks onto when the object moves. |
| **PROPORTIONS** | Desktop 3:4 to 4:5 (portrait). Mobile 5:6. The object never becomes landscape; a landscape record reads as a dashboard panel, which is the thing it must not be. |
| **FRONT** | Opaque warm paper (`--vt-surface`). Never glass. CD-12 is absolute here: chrome may be translucent, evidence may not. |
| **EDGE** | 1px hairline all round; **2px ink on the top edge only**. The asymmetry is the object's signature — it is how a viewer tells the record from any other rectangle on the page. |
| **SPINE** | The vertical axis the rows hang from, and the element the NPI field becomes on submit. Before entry it is the writing line; after entry it is the record's centre line. This is the single most important continuity device in the whole experience. |
| **SOURCE APERTURES** | Six openings, one per lane, in registry order. Each is a slot that is empty, filling, or filled — never a badge that appears from nowhere. An aperture that cannot be read is shown as *closed*, not hidden. |
| **CLAIM ROWS** | Claim · what returned · provenance (source · cadence · limitation) · state stamp. Mono for machine facts, sans for prose. Radius 0–3px. |
| **RECEIPT EDGE** | A perforated lower edge carrying the receipt id and signature facts. Present only once something has actually been signed. |
| **PERMISSION LAYER** | A translucent overlay *above* the rows — the only translucency the object is allowed, and only because it represents a decision laid over facts rather than a fact itself. |
| **CONSENT SEAL** | Circular. The one circular element in the entire system, which is what makes it read as a seal rather than a chip. |
| **RECIPIENT FRAME** | A smaller, lighter frame with the same silhouette holding only the travelling subset. Same object, less of it — never a different artefact. |
| **REVIEW LENS** | A rectangular aperture that crops to a single claim and enlarges it, with the rest of the record visibly continuing beyond the crop. |
| **MATERIAL** | Paper, ink, hairline rule, stamp, and one ambient light. No gradient on paper, no glow, no elevation theatre. |
| **SHADOW** | None on evidence. Ever. Depth comes from overlap, scale and the top-edge weight. |
| **RADIUS SYSTEM** | Evidence facts 0–3px · product controls 10px · nav chrome 12–16px · media apertures 24–40px · cinematic frames 32–56px · consent seal circular. |
| **TYPOGRAPHY** | Fraunces for argument, Geist for prose, Geist Mono for every machine-returned fact. The mono is load-bearing: it is how a viewer knows a value was retrieved rather than written. |
| **IDLE STATE** | **Nothing.** The object does not breathe, pulse, shimmer or drift. CD-11 forbids idle motion, and a record that fidgets reads as a widget. |
| **MOTION STATES** | Only the eleven transitions below, each single-shot, each triggered by scroll position or a user action. |

---

## Part II — The eleven faces

Same silhouette, same edge, same spine, same row grammar throughout. What
changes is **fill, layer and crop** — never the object's identity.

| # | Face | What is true | What changes visually |
| --- | --- | --- | --- |
| 1 | **BLANK** | Nothing entered | Silhouette + spine + six closed apertures. No identity, no rows. |
| 2 | **WRITING** | Digits arriving | Spine thickens toward the writing line; apertures stay closed. **No source claim may appear while typing.** |
| 3 | **RESOLVING** | Request in flight | Apertures open one at a time in registry order. No result text yet. |
| 4 | **RECOGNIZED** | Identity returned | Header gains the registry identity; the spine locks. |
| 5 | **RETURNED** | Sources answered | Rows fill with claim + provenance + stamp, in the order the model returns them. |
| 6 | **INSPECTED** | One claim opened | Review lens crops to a row and enlarges it; the record continues past the crop. |
| 7 | **DECIDING** | Travel decisions | Permission layer overlays the rows; each row marked travels or held. |
| 8 | **TRAVELLING** | Subset in motion | Recipient frame separates and moves; the complete record **stays**. |
| 9 | **ARRIVED** | Subset received | Recipient frame settles, carrying only permitted rows. Held rows are *absent*, not greyed. |
| 10 | **REVIEWED** | Awaiting a human | Review checkpoint attaches to the recipient frame; the decision owner is named. |
| 11 | **SEALED** | Signed and closed | Object reduces to silhouette + receipt edge + circular seal. |

**Anti-pattern being ruled out explicitly:** eleven differently-styled cards
that each happen to contain evidence. Face 9 must be visibly face 5 with fewer
rows and a lighter frame — a viewer who sees them side by side must say "that
is the same record" without being told.

---

## Part III — Scene list

Desktop frames 01–13 and mobile frames 01–09 as specified in the directive.
**Status: frames not yet drawn.** See `zoox-fidelity-z0-handoff.md` for exactly
what remains and the command to continue.

| # | Desktop scene | Face(s) | Status |
| --- | --- | --- | --- |
| 01 | Navigation at rest | — | pending |
| 02 | Navigation expanded | — | pending |
| 03 | Hero before NPI entry | BLANK | pending |
| 04 | Hero while typing | WRITING | pending |
| 05 | NPI submitted / recognition begins | RESOLVING | pending |
| 06 | Identity recognized | RECOGNIZED | pending |
| 07 | Source stage entering | RETURNED | pending |
| 08 | Source stage midpoint | RETURNED | pending |
| 09 | Claim inspection open | INSPECTED | pending |
| 10 | Permission — travels vs held | DECIDING | pending |
| 11 | Handoff crossing the boundary | TRAVELLING | pending |
| 12 | Human review Ink scene | ARRIVED / REVIEWED | pending |
| 13 | Closing conversion | SEALED | pending |

Mobile 01–09 (navigation, hero, recognition, source responses, claim
inspection, permission, handoff, human review, closing): pending, and composed
independently rather than derived from the desktop frames.

Each motion scene still owes: start frame · midpoint · end frame · trigger ·
scroll distance or event · moving object · stationary object · duration ·
easing · mobile transformation · reduced-motion result.

---

## Part IV — Implementation-risk map

Classifying before Z1, so a visual program cannot quietly become a backend one.

| Scene | Class | Note |
| --- | --- | --- |
| Navigation rest / expand / scroll | **CSS/DOM ONLY** | Already shipped in #1068; refinement only. |
| Hero BLANK → WRITING | **CSS/DOM ONLY** | Driven by existing local input state. |
| Hero RESOLVING → RECOGNIZED → RETURNED | **DEPENDS ON SOURCE RUNTIME** | Uses the live lookup that already ships. No new backend. |
| Recognition chapter | **CSS/DOM ONLY** | |
| Source responses stage | **CSS/DOM ONLY** | Sticky stage exists; expanding to four states. |
| Claim inspection | **CSS/DOM ONLY** | Must converge onto ONE inspector — `ProofPacketInspector` exists and must not be duplicated. |
| Permission — travels/held | **ILLUSTRATIVE ONLY** | Interactive selection is illustrative until a real Apply transaction drives it. Must be labelled as such. |
| Handoff | **ILLUSTRATIVE ONLY** | ⚠ "Delivered" may not be claimed without a persisted delivery. |
| Human review Ink scene | **ILLUSTRATIVE ONLY** | Actions are illustrative; the decision owner is real doctrine. |
| Closing | **CSS/DOM ONLY** | |
| Evidence Record WebGL | **OPTIONAL WEBGL** | Tier A only, lazy, capability-detected. May never own input, facts, state, source, consent, navigation or accessibility. |
| Original media (posters, sequences) | **PRE-RENDERED MEDIA** | See the shot list. |

**Nothing above requires new product state or a source integration.** The two
places this program could accidentally become a backend project are the
permission selection model and the handoff delivery state — both are fenced as
illustrative, and the fence is the deliverable.

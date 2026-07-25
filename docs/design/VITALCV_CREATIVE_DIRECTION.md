# VitalCV Creative Direction

**Status:** Canonical. This is the design authority for every VitalCV surface.
**Established:** 2026-07-25
**Supersedes:** all prior per-wave design docs as the *authority on look and feel*. Wave docs remain valid as execution records; where any of them disagrees with this document on paper, ink, type, state, motion, or geometry, this document wins.
**Defers to:** `VitalCV_Competitive_Mandate_and_Claude_Code_Waves_2026-07-21.md` on homepage *composition* (the six-scene film) and on strategic copy. This document governs *how it looks*, that document governs *what it says and in what order*.

Every clause is numbered. Reject a PR by citing a number.

---

## Part I — The idea

### CD-1. What VitalCV looks like, in one paragraph

> VitalCV looks like **a record, not a dashboard.**
>
> Its authority comes from typographic discipline, not decoration — the way a lab report, a court docket, or a passport earns belief. Warm paper, warm ink, hairline rules, machine facts set in mono, one editorial serif carrying the argument. Nothing glows. Nothing pulses. Nothing celebrates. The only thing that moves is evidence arriving, and it moves once.
>
> Every competitor in this market sells certainty with a green check. **VitalCV's aesthetic differentiator is that it shows its work and renders uncertainty with exactly the same confidence as certainty.** A field that says "we haven't looked at this" must be as beautifully set as a field that says "a named federal source returned a match at 14:02 today." That is the whole look and feel. Everything below is enforcement.

### CD-2. The five laws

These are not preferences. A PR that breaks one is rejected regardless of how good it looks.

1. **Truth outranks beauty.** No visual may imply more certainty than the underlying data supports. A number may only animate to a value the system actually returned. Design does not decorate a claim into being stronger.
2. **State is never carried by color alone.** Every state renders as **glyph + word + source + age**. Remove all color and the screen must still be fully readable and fully honest.
3. **Meaning never lives in motion, hover, GPU, or a shader.** Those are enrichment. Reduced-motion, no-JS, and static fallbacks are first-class compositions, not degradations.
4. **Glass on chrome. Solid on evidence.** Navigation, overlays, and ambient scene may be translucent and atmospheric. Anything asserting a fact is opaque paper with a hairline rule — no blur, no gradient, no glow, no elevation theatre.
5. **One system.** No new scoped island, no new token prefix, no new badge component. Extend what exists or replace it outright. Additive design debt is the single largest visual liability this codebase carries (see CD-15).

---

## Part II — The material system

VitalCV is built from five materials. If you cannot name which material you are placing, you are decorating.

| Material | What it is | Where it appears |
| --- | --- | --- |
| **Paper** | The warm field everything sits on. Never white, never gray-blue. | Page, cards, artifacts |
| **Ink** | Warm near-black type and hairline rules. | All text, all rules |
| **Rule** | A 1px hairline. The primary structural device — used instead of shadows, boxes, and dividers-with-padding. | Everywhere structure is needed |
| **Stamp** | A small, near-sharp, mono-set state mark. Not a pill. Not a badge. A stamp. | Every asserted fact |
| **Light** | The one ambient, non-semantic element: source light gathering in the hero field. Carries mood, never meaning. | Marketing hero only |

There is no sixth material. No cards-within-cards, no glass panels over evidence, no gradient meshes, no 3D blobs, no isometric illustration.

---

## Part III — Color

### CD-3. Paper and ink

Light is the only public mode. Warm throughout — the current cool-slate ink on warm paper is the single biggest reason surfaces read as unfinished.

```css
/* Paper — warm, never white */
--paper:          #F0EEE9;  /* Cloud Dancer. The page field. */
--paper-raised:   #F7F5F1;  /* Cards, evidence artifacts */
--paper-inset:    #E7E4DD;  /* Wells, data blocks, code */

/* Rule — structure without shadow */
--rule:           #D6D2C8;  /* 1px hairline, default */
--rule-strong:    #B9B3A6;  /* Artifact top edge, table header */

/* Ink — warm near-black, NOT slate blue */
--ink:            #1A1815;  /* Body text        15.1:1 on paper */
--ink-strong:     #0E0D0B;  /* Display headlines */
--ink-muted:      #57534A;  /* Secondary prose   6.3:1 */
--ink-subtle:     #676257;  /* Metadata, labels  5.1:1 */
```

**Settled:** Cloud Dancer `#F0EEE9` is the one paper value. The Calm Wave `#f4f2ec` and the various `#f8fafc` slate papers are retired. One value, product-wide — this is what ends "the homepage looks like a different company than the app."

### CD-4. Signal versus state — the rule that makes the palette work

**Brand accent and state color are separate systems and may never borrow from each other.**

```css
/* Signal — brand, interaction, editorial emphasis. Indigo. */
--accent:         #4338CA;  /* Links, primary action, focus ring, accent word  6.6:1 */
--accent-press:   #322BA6;
--accent-wash:    #ECEBF8;  /* Selected row, focus field. Never a large field. */
```

Indigo carries interaction. **Green is forbidden as a brand, decorative, or "success" color** — green means exactly one thing in this product, and spending it on a button destroys the meaning of the thing users are here to read.

### CD-5. The six states

Every asserted fact in VitalCV resolves to exactly one of these. There are no others. Adding one requires amending this document.

**The state word is always set in `--ink`.** The hue carries only the glyph and a 2px left rule. This is what makes law CD-2.2 structural rather than aspirational: contrast never depends on the state color, and grayscale never costs legibility.

| State | Hue (glyph + rule) | Glyph | Word shown | Means |
| --- | --- | --- | --- | --- |
| **Source-confirmed** | `#1C5C38` green | `●` filled | *Confirmed* | A named source returned a match. Always accompanied by source + timestamp. |
| **Snapshot** | `#3D5A6C` slate | `◐` half | *Snapshot* | From a dated batch. True as of a date, not as of now. |
| **Access required** | `#676257` warm gray | `⊘` barred | *Access required* | We cannot look. **Not a judgment about the clinician.** |
| **Needs attention** | `#7D5A1E` amber | `▲` triangle | *Needs attention* | Missing, expiring, or incomplete. Clinician-actionable. |
| **Adverse** | `#7A1414` red | `■` square | *Adverse finding* | An actual adverse source result. Rare. **Never used for UI errors, form validation, or network failures.** |
| **Not checked** | `--rule` outline | `○` hollow | *Not checked* | We have not looked. **This is the default state**, and it must be as well-set as any other. |

**Modifier — `under dispute`.** Any state may carry it. Renders as a hatched left rule plus the literal words *under dispute*. Per NPDB semantics, an adverse finding under dispute is not an adverse-final finding, and the interface must never collapse the two.

**Forbidden state language:** the bare word `Verified`, plus every string in the CLAUDE.md banned list. "Confirmed" is always qualified by *what* confirmed it and *when*.

### CD-6. Dark mode

One dark theme exists. It is **warm graphite, not blue-black** — `#161513` field, `#1E1C19` raised, `#EDEAE3` ink — and it applies to signed-in workspace surfaces only. **Public and marketing surfaces are paper-only and do not flip.** State hues re-anchor lightness only; hue and chroma hold within ΔE 2.

---

## Part IV — Typography

### CD-7. Three faces, and only three

**State as of 2026-07-25 on `main`:** Fraunces roman is self-hosted and wired to the display tokens. **Geist Sans and Geist Mono are not** — `--font-body`, `--font-sans`, and `--font-mono` all still resolve to system stacks, so every paragraph, control, and retrieved fact on the product renders in the OS UI faces. There is also **no Fraunces italic**, so the accent word (below) is a browser-synthesised oblique rather than a drawn italic.

**Decision — three faces, self-hosted via `next/font/local`, no CDN.** Never `next/font/google`: a build-time fetch is what silently dropped the faces before and left the site rendering Georgia. Self-hosted variable `woff2` in `apps/web/app/fonts/`, each with its system stack retained as an inline `var()` fallback.

| Role | Face | Settings | Used for |
| --- | --- | --- | --- |
| **Display** | **Fraunces** variable | `wght 400–700`, `opsz 24–144`, `SOFT 0`, `WONK 0` | Headlines, scene copy, the accent word. Optical sizing is why it's variable — a 72px hero and a 20px subhead are not the same drawing. |
| **Text** | **Geist Sans** | `400 / 500 / 600` | All prose, UI labels, buttons, forms. |
| **Data** | **Geist Mono** | `400 / 500`, `tabular-nums`, `slashed-zero` | Every machine-returned fact. |

### CD-8. The mono law

> **Machine facts are mono. Human prose is sans. Argument is serif.**

Mono is not a style choice — it is a truth signal, and it must be applied without exception: NPIs, license numbers, timestamps, snapshot dates, source names, hashes, receipt IDs, state words in stamps, monetary and duration values. When a user sees mono, they are looking at something the system retrieved, not something VitalCV wrote.

This is the cheapest, most durable way to make the product *feel* verifiable at a glance, and it is the detail competitors do not have.

### CD-9. The scale

Set in `rem`. Display uses tight leading and negative tracking; text uses generous leading.

| Token | Size / leading | Face | Notes |
| --- | --- | --- | --- |
| `display-xl` | `clamp(2.75rem, 6vw, 4.5rem)` / 1.02 | Fraunces 500 | `letter-spacing: -0.02em`. Hero only, one per page. |
| `display-lg` | `clamp(2rem, 4vw, 3rem)` / 1.08 | Fraunces 500 | Scene headlines. |
| `display-md` | `1.5rem` / 1.15 | Fraunces 500 | Section leads. |
| `title` | `1.125rem` / 1.3 | Geist 600 | Card and artifact titles. |
| `body-lg` | `1.0625rem` / 1.6 | Geist 400 | Lead paragraphs. Max measure **68ch**. |
| `body` | `0.9375rem` / 1.55 | Geist 400 | Default. |
| `label` | `0.8125rem` / 1.4 | Geist 500 | Form labels, table headers. |
| `data` | `0.8125rem` / 1.5 | Geist **Mono** 400 | All retrieved facts. |
| `eyebrow` | `0.6875rem` / 1.3 | Geist **Mono** 500 | `letter-spacing: 0.08em`, uppercase. |

**The accent word.** One phrase per headline may be set in Fraunces *italic* in `--accent`. One per headline. It carries the emphasis so the layout doesn't have to.

**Never:** all-caps prose, letter-spaced body text, more than two weights in a paragraph, text over an image without a solid plate, justified text.

---

## Part V — Geometry, density, motion

### CD-10. Geometry says what a thing is

Corner radius is a semantic, not a taste:

| Radius | Applies to | Reads as |
| --- | --- | --- |
| `0` | Rules, table cells, the film's scene edges | Structure |
| `3px` | **State stamps**, data blocks, evidence artifacts | Document |
| `10px` | Buttons, inputs, chrome panels, overlays | Software |
| `999px` | **Nothing.** Pills are retired. | — |

State stamps are 3px rectangles. A record carries stamps, not pills — and that one detail separates VitalCV from every credentialing SaaS page in the market.

**Structure comes from rules, not shadows.** Light-mode evidence surfaces have no shadow at all. One soft float shadow exists, reserved for the glass nav rail and modal overlays.

**Grid:** 4px base, 8px rhythm. Prose measure 62–68ch. Evidence tables are full-bleed to their rule, not inset in a padded card.

### CD-11. Motion

**One owner per page.** A page has exactly one scroll driver. Never Framer Motion plus a rAF rail plus scroll observers on the same surface.

```css
--dur-state:  120ms;  /* Toggles, focus, hover */
--dur-enter:  240ms;  /* Element reveal */
--dur-scene:  400ms;  /* Scene / route transition */
--ease-enter: cubic-bezier(0.2, 0.7, 0.2, 1);
--ease-exit:  cubic-bezier(0.4, 0.0, 1, 1);
```

Rules:
- **Single-shot.** An element reveals once and stays. No scrub-reverse, no replay on scroll-up, no loops.
- **Opacity-preferred.** Opacity-only reveals are CLS-safe and fall outside WCAG 2.3.3. Displacement, when used, is capped at **8px**.
- **Nothing idles.** No shimmer, no pulse, no breathing glow, no animated checkmark, no confetti, no count-up theatre.
- **The truth rule:** a number may animate only from a real returned value to a real returned value. Illustrative and benchmark figures are static and labeled.
- `prefers-reduced-motion` removes all transform and duration, keeps all meaning, and is reviewed as a first-class composition — not an afterthought.

### CD-12. Glass on chrome, solid on evidence

This is the founder's own boundary and it is now doctrine.

**May be glass:** the floating nav rail, command palette, modal scrim, agent/intelligence controls, ambient hero light.
**Must be solid:** every credential, source result, readiness item, requirement, proof packet, receipt, audit row, and application state.

Glass over flat paper is invisible — that is a physics fact, not a bug. Glass only works on a **detached floating rail** (`background: 60%` + `backdrop-blur-2xl` + `saturate-150` + inset sheen + float shadow) with content scrolling *beneath* it. If content does not pass under it, do not use glass.

---

## Part VI — What VitalCV is not

### CD-13. The kill list

Permanently retired. Not "avoid" — retired. Their presence in a PR is a rejection.

**Visual**
- Public knowledge graph, constellation, force simulation, node-link people diagram, physics controls
- Horizontal Rolodex, card carousel, chapter cards, wide card queues, product-card grids
- Giant metric counters, percentage rings, `01–06` step numbering, "days saved" theatre
- Gradients as surface (any `linear-`/`radial-gradient` on paper), glow, neon, shimmer
- Stock photography of clinicians, smiling-doctor imagery, isometric illustration, 3D blobs
- Emoji as UI, pill badges, dual page-level navigation rails, dark boxes on the marketing page
- Blockchain, wallet, crypto, DID/VC iconography anywhere in the acquisition path

**Copy in the interface**
- The bare word `Verified` as a status; the CLAUDE.md banned-string list in full
- Generic section headers ("How it works", "Features", "Why VitalCV")
- Any freshness word that outruns the lane: `live`, `real-time`, `current`, `always up to date` — unless that lane is genuinely read per request

**Imagery, positively stated:** the only images VitalCV publishes are **its own artifacts** — a real proof packet, a real source result, a real requirement ledger, rendered honestly and legibly. That is the entire art direction.

---

## Part VII — Surfaces

### CD-14. Three surface tiers, one system

| Tier | Routes | Character |
| --- | --- | --- |
| **Public / acquisition** | `/`, `/employers`, `/trust`, `/verify/*`, `/status` | Paper, editorial, near-silent. One argument, five beats. Light only. Composition governed by the competitive mandate's six-scene film. |
| **Workspace** | `/holder/*`, `/employer/*`, `/admin/*` | Same paper, same ink, higher density. Rules do the work. Light and dark. One primary action per screen. |
| **Evidence artifact** | Proof packet, receipt, source result, requirement ledger, audit row | The most disciplined surface in the product. Mono data, hairline rules, stamps, no color that isn't a state, no motion at all. **It should read as if it could be printed and filed.** |

The evidence artifact is the brand. If you only ever fix one screen, fix that one — it is what an employer screenshots and forwards, and it is the only asset that proves the thesis without a paragraph of explanation.

### CD-15. Accessibility floor — non-negotiable

- **AA minimum** everywhere. State words are set in `--ink` (15.1:1), so state legibility never depends on the hue meeting a ratio — CD-5 makes the floor structural.
- Every state legible in grayscale and to a screen reader without color reference
- Visible focus on every interactive element: 2px `--accent` ring, 2px offset — never `outline: none`
- Full keyboard path through every flow, including the film and the packet inspector
- 200% text zoom with no clipped control; 44px minimum touch target
- Motion, GPU, JS, and network all optional for meaning

---

## Part VIII — Governance

### CD-16. The one-system consolidation

The audit behind this document found, in `apps/web`:

- **17 stylesheets** / 5,593 lines, with `globals.css` importing 13 of them
- **30+ CSS custom-property prefixes** (`--vt-`, `--ag-`, `--color-`, `--palette-`, `--vital-`, `--gf-`, `--trust-`, `--infra-`, `--glue-`, `--ops-`, `--mz-`, …)
- **Two parallel design systems** — `design-system/` and `components/ui/` — where a `Badge` import resolves differently depending on path
- **30+ badge/chip/status components** expressing the same six states
- **Body and mono text resolving to system stacks**

That is the actual look and feel of VitalCV today: not a style problem, an entropy problem. The direction above is unenforceable until this converges.

**Target end state — one of each:**

1. One token file. Prefix `--vt-`. Every other prefix aliases to it during migration, then is deleted.
2. One component library: `apps/web/design-system/`. `components/ui/` becomes re-exports, then is deleted.
3. One state component: `<StateChip state source asOf />` — source and timestamp **required at the type level**, so an unattributed state is a compile error. All 30 badges collapse into it.
4. One typography layer, three real self-hosted faces.
5. Zero scoped design islands. `.mz`, `.w14`, `.w1505`, `.vs-root`, `antigravity`, `blueprint-overrides` are unscoped into the global layer or removed. **Calm Wave stops being an island and becomes the default.**

**Sequencing** (each is independently shippable and independently revertable):

| # | Wave | Ships |
| --- | --- | --- |
| CD-W1 | **Type** | Three self-hosted faces; delete the system-stack mapping; mono law applied to evidence surfaces. Highest visible change per line of diff in the entire codebase. |
| CD-W2 | **Paper & ink** | One warm palette; slate ink and `#f8fafc` paper retired product-wide. |
| CD-W3 | **StateChip** | One typed component; 30 badges migrated; unattributed state becomes uncompilable. |
| CD-W4 | **Evidence artifact** | The packet/receipt/source-result surface rebuilt to CD-14 as the reference implementation of the whole system. |
| CD-W5 | **De-island** | Scoped layers unscoped; token prefixes aliased then deleted; `components/ui` collapsed. |
| CD-W6 | **Gate** | Design-lint extended to enforce CD-3/4/5/7/10/13 in CI. |

### CD-17. Naming

The system is **Calm Wave**, promoted from a scoped island to the global default. No new brand name — a new name would create a sixth island, which CD-2.5 forbids.

### CD-18. The five-minute review

Any reviewer can reject a PR on these without design experience:

1. Does any state render as color alone, or without a source and a timestamp? → **reject** (CD-2, CD-5)
2. Does any number animate, or assert, beyond what the system returned? → **reject** (CD-1, CD-11)
3. Is a machine fact set in sans, or prose set in mono? → **reject** (CD-8)
4. Is there glass, blur, gradient, shadow, or glow on an evidence surface? → **reject** (CD-12)
5. New token prefix, new stylesheet, new badge component, new scoped island? → **reject** (CD-2.5, CD-16)
6. Anything on the kill list? → **reject** (CD-13)
7. Does it survive reduced-motion, no-JS, grayscale, and keyboard-only? → if not, **reject** (CD-3, CD-15)

### CD-19. Amending this document

Paper, ink, type, the six states, motion timing, and the kill list change only by editing this file, with a dated rationale. A PR may not introduce a local exception. The design-lint gate (CD-W6) is the enforcement mechanism; until it lands, CD-18 is enforced by review.

Every product PR continues to carry a **Design Handoff References** section naming the CD clauses it implements.

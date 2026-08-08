# VitalCV Creative Direction

**Status:** Canonical. This is the design authority for every VitalCV surface.
**Established:** 2026-07-25
**Supersedes:** all prior per-wave design docs as the *authority on look and feel*. Wave docs remain valid as execution records; where any of them disagrees with this document on paper, ink, type, state, motion, or geometry, this document wins.
**Defers to:** `VitalCV_Competitive_Mandate_and_Claude_Code_Waves_2026-07-21.md` on homepage *composition* (the six-scene film) and on strategic copy. This document governs *how it looks*, that document governs *what it says and in what order*.

Every clause is numbered. Reject a PR by citing a number.

> **Amendment 2026-08-08 (per CD-19).** This document now has a **successor-of-record**:
> [`VITALCV_EXPERIENCE_CONSTITUTION.md`](VITALCV_EXPERIENCE_CONSTITUTION.md) (UX-00 of the
> Experience Overhaul Program, `VITALCV_EXPERIENCE_OVERHAUL_PROGRAM_2026-08-08.md`). Where the two
> disagree, the constitution wins. Carried forward intact and renumbered there: the five laws
> (EC-3), mono law (EC-4), state law (EC-5), geometry semantics (EC-6), kill list (EC-7, extended),
> accessibility floor (EC-8), glass/solid boundary (EC-12), and the CD-20 asymmetries (EC-9/EC-10).
> **This document's palette (Part III) and typography (Part IV) are subject to the UX-01 verdict** —
> the winning homepage-reset direction's values become global via EC-20, so CD-3/CD-7 values are no
> longer safe to build against until that verdict lands. The competitive mandate file named in the
> header above is **recorded missing** (EC-24, searched 2026-08-08); homepage composition authority
> now rests with the homepage reset. *Rationale:* the Experience Overhaul Program consolidates six
> coexisting visual eras behind one constitution; this is an amendment and pointer forward, not a
> fork. This document remains the execution record of the July 2026 direction.
>
> *Verdict update, same day:* UX-01 landed **FINAL — Direction B GO, with amendments**
> (`design-lab/homepage-reset/DECISION.md`). The constitution's EC-20 is back-filled: Geist +
> Geist Mono; a dark warm-graphite **public register** with a **required light register** for
> evidence/printable surfaces. Accordingly, this document's Part III (palette) and Part IV
> (typography) values are **superseded by EC-20**, and CD-3's "light is the only public mode"
> and the 2026-08-02 one-Ink-chapter amendment are superseded by EC-20's register doctrine.

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

> **Amendment 2026-08-02 (per CD-19). One public Ink chapter.**
>
> The public experience remains **predominantly Paper**. One — and only one —
> full-bleed warm-graphite chapter is permitted within the homepage journey, as a
> tonal shift in the argument.
>
> **Conditions, all required:**
> - **Full-bleed.** It spans the viewport edge to edge. It is a *chapter*, not a card.
> - **Evidence inside it stays Paper.** Any artifact asserting a fact renders as
>   opaque paper on a hairline, exactly as CD-12 requires. Ink is the ground behind
>   the evidence, never the evidence itself.
> - **One per page.** A second Ink chapter is a rejection.
> - **Contrast floor unchanged.** CD-15's AA minimum applies identically.
> - **Not a theme flip.** No `data-theme` on a public route, no `--ops-*` token
>   borrowing. The chapter declares its own surface; the page does not change mode.
>
> **This is not permission for dark dashboard cards on marketing routes.** CD-13
> retires "dark boxes on the marketing page" and that stays retired — the whole
> point of requiring full-bleed is that a dark *box* and a dark *chapter* are
> different objects. A dark card island is still a rejection.

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
- **Opacity-preferred.** Opacity-only reveals are CLS-safe and fall outside WCAG 2.3.3.
- **Displacement is capped at 8px — for anything a reader must read.** One narrow class of object is exempt; see the amendment below.
- **Nothing idles.** No shimmer, no pulse, no breathing glow, no animated checkmark, no confetti, no count-up theatre. Motion ends when scrolling ends.
- **The truth rule:** a number may animate only from a real returned value to a real returned value. Illustrative and benchmark figures are static and labeled.
- `prefers-reduced-motion` removes all transform and duration, keeps all meaning, and is reviewed as a first-class composition — not an afterthought.

> **Amendment 2026-08-02 (per CD-19). Scroll-driven marketing media.**
>
> The 8px cap was written against *evidence*: a fact that slides while someone reads
> it is a legibility failure, and that stays true without exception. It was never
> argued against **illustrative or navigational** objects — but as written it
> forbade them, which put the clause in conflict with the founder-approved
> cinematic journey. This amendment separates the two cases rather than raising the
> cap.
>
> **Unchanged and still mandatory:**
> - **One page-level scroll owner.** Exactly one. This is the load-bearing half of
>   CD-11 and the amendment does not touch it. A second progression scroller is a
>   rejection.
> - **Factual evidence does not move while it is readable.** A resolved capsule, a
>   source result, a receipt, a requirement row: static once on screen.
> - **No meaning depends on scroll progress.** Progress may sequence; it may never
>   inform.
> - **Nothing idles.** Motion is a consequence of scrolling and stops with it.
>
> **Now permitted, for illustrative or navigational objects only:**
> - Displacement beyond 8px where the moving object is a product artifact in a media
>   rail, a chapter menu, or a stage transition — never prose, never a fact.
> - Native vertical scroll mapped to a horizontal transform.
> - Sticky full-viewport stages.
>
> **Forbidden regardless:** `preventDefault` on `wheel` or `touchmove`, scroll
> hijacking, scroll-snap page progression, nested progression scrollers, autoplay,
> infinite animation, and any composition where reduced motion loses content. Under
> `prefers-reduced-motion` the journey renders as one complete linear document —
> a *required deliverable*, not a fallback.
>
> *Rationale:* the clause conflated "do not move what someone is reading" with "do
> not move anything." The first is a legibility law. The second was an accident of
> phrasing, and enforcing it would have meant rejecting a founder directive on the
> authority of a rule that never intended to forbid it. Full mechanism list:
> [`VITALCV_EXPERIENCE_SYSTEM_2026.md`](VITALCV_EXPERIENCE_SYSTEM_2026.md).

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

> **Amendment 2026-08-02 (per CD-19). The carousel line, said precisely.**
>
> "Horizontal Rolodex, card carousel, chapter cards, wide card queues, product-card
> grids" retired a **format** — a queue of unrelated cards a visitor pages through.
> Read literally it also retired *any* horizontal movement, which is not what the
> clause was defending and which conflicts with the founder-approved media rail.
> The distinction is **what is moving and who drives it**, not which axis it moves on.
>
> **STILL RETIRED — no exceptions:**
> - Card carousel; Rolodex; a queue of unrelated product cards
> - Horizontal scrolling driven *directly* by wheel or touch
> - Auto-advancing slides; autoplay of any kind
> - Scroll snap as page progression
> - Nested carousel navigation; a second page-level progression scroller
>
> **NOW ALLOWED:**
> - **One** continuous evidence-object media rail — a single artifact examined across
>   a chapter, not a deck of cards
> - Native vertical scroll mapped to a horizontal visual transform
> - A sticky chapter stage
> - A chapter menu that is clickable and keyboard-operable
> - A product-artifact transition tied to the evidence narrative
>
> *The test:* if a visitor could shuffle the panels and lose nothing, it is a
> carousel and it is retired. If the panels are one object under continuous
> examination and their order carries the argument, it is a rail and it is allowed.
>
> *Unchanged:* every panel must be a **product artifact**, never a generic card, and
> CD-13's imagery clause still stands — the only images VitalCV publishes are its
> own artifacts. This amendment grants no licence for stock photography.

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
| **Public / acquisition** | `/`, `/employers`, `/trust`, `/verify/*`, `/status` | Paper, editorial, near-silent. One argument, staged in chapters. Predominantly Paper, with at most one full-bleed Ink chapter under the CD-6 amendment. Composition governed by [`VITALCV_EXPERIENCE_SYSTEM_2026.md`](VITALCV_EXPERIENCE_SYSTEM_2026.md). |
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

### CD-20. The competitive standard — how this beats Medallion and Carefam

Two companies are the named bar. **Medallion captured 2026-07-25; Carefam re-captured 2026-08-01** — see the amendment note below.

**Medallion** (`medallion.co`) — *"Better outcomes for credentialing. Faster paths to billable providers."* An illustrated mascot, a customer logo wall, dashboard screenshots, award badges, four headline metrics (*2x faster enrollment*, *66% reduction to administrative costs*, *1 day credentialing file readiness*, *300+ healthcare organizations*), and one primary action: **Get in touch.**

**Carefam** (`carefam.com`, URL verified 2026-08-01) — *"Healthcare Hiring Powered by AI."* The page is now a **three-day onboarding narrative** rather than a workflow diagram: **Day 1** *Get Started Instantly* — sign up, see the AI, name who you're hiring, "no integrations or IT needed"; **Day 2** *Our AI Goes to Work* — outreach, résumé screening and interview scheduling handled by AI assistants; **Day 3** *Hire top talent 3X faster*. One headline claim (**3X faster**), a newsletter capture, and one primary action: **Book a demo.** Navy ink on white, Poppins, no product screenshot in the acquisition path. Measured alongside it: an **empty `<h1>` and nine empty headings** — the page ships no readable document outline at all.

> **Amendment 2026-08-01 (per CD-19).** The Carefam entry above **replaces** the 2026-07-25 capture, which recorded a three-stage workflow diagram (sourcing & screening → matching & scheduling → offer & onboarding), a client logo grid, stock healthcare photography, gradient overlays, and four metrics — *20 scheduled interviews*, *60+ hours saved*, *90% phone time saved*, *200 engaged candidates*. **None of that copy is on the page as of 2026-08-01.**
>
> *Rationale:* doctrine that cites a competitor artifact must cite one that exists. A clause arguing against a page nobody can load trains the team to answer the wrong thing, and it quietly discredits the clause when someone checks.
>
> *What survives unchanged:* Carefam is demo-gated, automates recruiter labour, and leads on speed.
> *What is deliberately **not** claimed:* whether a logo grid or stock photography still appear. 33 images remain on the page and their content was not inspected, so their absence is not asserted here.
>
> *The conclusion below is unaffected — arguably strengthened.* A competitor who rewrites their hero inside eight days is not a stable bar to design against, which is exactly why CD-20's asymmetries are stated **structurally** (gated vs. operable, claimed vs. readable, back-office vs. clinician) rather than as a response to any one page. Full measurement: [`reference-experience-atlas.md`](reference-experience-atlas.md) §5 R14 and §7 C12.

They are the same page with different nouns: **employer-first, demo-gated, unauditable claims, and a hero that sells speed.** (The 2026-07-25 capture had both leaning on a logo wall and a generic healthtech gradient. That still holds for Medallion; for Carefam it is unverified after the redesign — see the amendment above.) Carefam is the closer competitor because it sells hiring speed directly — but it automates the *recruiter's* labour (sourcing, screening, scheduling calls). It has no answer for the clinician's existing evidence, because that is not something an AI can manufacture. That gap is the wedge.

**We do not beat either by out-glossing them.** Out-glossing well-funded marketing teams is a race we lose, and CD-13 already retires every device they lean on. We beat them on four asymmetries, and the design exists to make them land:

| They do | We do | Why it wins |
| --- | --- | --- |
| **Gate the product.** *Get in touch.* *Book a demo.* The only action is a sales conversation. | **Give the product away in the first viewport.** An NPI field that returns real state in seconds, no account. | The most enticing thing any of these sites can offer is *use*. Neither competitor lets a visitor operate the product before a call. |
| **Claim numbers.** *66% reduction*, *3X faster* — none auditable by the reader. | **Show one artifact.** A real proof packet: source, timestamp, scope, and what it does not decide. | A hospital cannot verify their percentage. It can read our packet. CD-14 exists for this. |
| **Speak to the back office.** Both heroes address a credentialing team or a recruiter. | **Speak to the clinician.** It is their career, and they arrive first. | It is the only door in this market nobody is standing in. |
| **Say "AI-powered."** Advancement asserted in copy, illustrated with a workflow diagram or a three-day timeline. | **Demonstrate it.** Live resolution, real optical sizing, a packet that exports, honest degradation. | Asserted sophistication reads as marketing. Demonstrated sophistication reads as capability. |

**Where the boldness goes.** A quiet system is not a timid one. VitalCV spends its entire visual budget in **one place: the moment an NPI resolves.** That moment should be genuinely arresting — evidence arriving, state landing, the next action appearing. Everything around it stays near-silent *so that it lands*. A page that is loud everywhere has nothing left to spend when something real finally happens.

If a proposed treatment does not make that moment sharper, it is decoration, and CD-13 applies.

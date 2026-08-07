# Founder rulings — August 2026

**Status:** Canonical. Records founder decisions that amend
[`VITALCV_CREATIVE_DIRECTION.md`](VITALCV_CREATIVE_DIRECTION.md) under CD-19.
**Established:** 2026-08-02

This file exists because CD-19 requires that paper, ink, type, the six states,
motion timing, and the kill list change **only by editing the doctrine, with a
dated rationale** — and a PR may not introduce a local exception. When the
founder's direction and the written doctrine disagree, the doctrine is amended
first and the product is built second. This file is the record of why.

Each ruling names the clause it amends. Where a ruling *narrows* an existing
prohibition, the surviving prohibition is restated in full so that nobody has to
reconstruct it from a diff.

---

## FR-1. Scroll-driven cinematic progression is approved

**Amends:** CD-11 (motion), CD-13 (kill list).

The homepage may be a scroll-driven journey. Approved mechanisms:

| Mechanism | Notes |
| --- | --- |
| Native vertical scroll controlling visual progression | The browser scrolls. We observe. |
| Sticky full-viewport marketing stages | One scroll owner still governs. |
| Vertical scroll mapped to horizontal artifact movement | The rail, not a carousel — see FR-2. |
| Sliding chapter menus | Clickable and keyboard-operable, always. |
| Sliding imagery and product UI | Product artifacts only, never stock imagery. |
| Expanding glass eyebrows | Chrome, not evidence — CD-12 still binds. |
| Animated interactive icons | Finite. Label required. No evidence state. |
| Layered label-and-arrow button interactions | Stable width; no looping spinner. |
| Semantic surface transitions | Paper · Mist · Trust · Ink. |
| One optional full-bleed warm-graphite Ink chapter | Conditions in the CD-6 amendment. |
| Zoox-level responsive recomposition | Recompose, do not merely reflow. |
| Palantir-level enterprise storytelling | Consequential scale, operational scenes. |
| Medallion-level workflow close-ups | Healthcare workflow specificity. |
| Dock/Truvera-style consent and handoff choreography | Consent boundary made visible. |

### What this ruling does **not** relax

These were not in tension with the founder direction and remain absolute:

- No `wheel` or `touchmove` interception; no `preventDefault`-based hijacking
- No scroll trap; no nested page-progression scroller; no second scroll owner
- No autoplay; no infinite animation; no animation required for meaning
- No source status invented by decoration
- **No stock clinician imagery** — the only images VitalCV publishes are its own artifacts
- No copied external code, CSS, fonts, class names, or assets
- No glass on evidence; no generic node graph; no metric theatre
- No source-confirmed colour used decoratively
- No automatic employer decision

> A ruling that permits ambition does not permit dishonesty. Every mechanism above
> is a way of *presenting* the record. None of them may change what the record says.

---

## FR-2. The carousel prohibition was a format ban, not an axis ban

**Amends:** CD-13.

CD-13 retired the Rolodex and the card carousel. Read literally it also retired
any horizontal movement — which was never the argument. The clause defended
against **a queue of unrelated cards a visitor pages through**, not against
horizontal motion as such.

The operative distinction is **what moves, and who drives it**:

- **Retired:** unrelated cards; wheel/touch-driven horizontal scroll; auto-advance;
  scroll snap as progression; nested carousel navigation.
- **Allowed:** one continuous evidence-object rail, driven by native vertical
  scroll, whose panel order carries the argument.

**The test.** If a visitor could shuffle the panels and lose nothing, it is a
carousel and it is retired. If the panels are one object under continuous
examination and their order *is* the argument, it is a rail and it is allowed.

---

## FR-3. One public Ink chapter

**Amends:** CD-6, CD-14.

Public surfaces remain predominantly Paper. One full-bleed warm-graphite chapter
is permitted per page. Evidence rendered inside it stays opaque Paper.

This is explicitly **not** permission for dark dashboard cards on marketing
routes — CD-13 retires those and they stay retired. Requiring full-bleed is what
makes the distinction enforceable: a dark *chapter* is a tonal shift in the
argument; a dark *box* is an island, and islands are what CD-2.5 forbids.

---

## FR-4. Reduced motion is a deliverable, not a fallback

**Reaffirms:** CD-2.3, CD-11, CD-15.

Under `prefers-reduced-motion`, and with JavaScript disabled, the homepage
renders as one complete linear document in normal reading order. Every chapter,
every artifact, and the entire product argument survive. The chapter menu becomes
ordinary anchors. Icon travel becomes an immediate state change.

This is stated as a ruling because it is the clause most likely to be quietly
traded away under deadline. It may not be. A cinematic composition that loses
content without motion has not been built yet, however good it looks with motion.

---

## FR-5. Precedence

Where this file and `VITALCV_CREATIVE_DIRECTION.md` disagree, **this file wins**
and the doctrine is to be amended to match. Where this file is silent, the
doctrine governs unchanged.

Mechanism-level detail lives in
[`VITALCV_EXPERIENCE_SYSTEM_2026.md`](VITALCV_EXPERIENCE_SYSTEM_2026.md). Rulings
live here. Enforcement lives in `scripts/check-design-lint.ts` and the doctrine
tests — a ruling that no gate can check is an intention, not a rule.

---

## FR-6. The shared header is scene-aware journey navigation

**Amends:** CD-12 (chrome), CD-13 (kill list, as applied to the header).
**Established:** 2026-08-06, by the founder shared-header recovery wave.

The shared public header operates as journey navigation, not a category list:

| Mechanism | Notes |
| --- | --- |
| A journey rail in the chrome | Four stages — Your Number · Sources · Permission · Review — inside the single header tier. Not a second page-level rail; CD-13's two-tier prohibition stands. |
| Scene-declared treatment | Sections declare `data-header-theme="light\|dark"` and `data-header-stage="…"`; the header reflects the declaration. Declaration, not detection — no pixel sampling. |
| A dark header treatment | Built from the public warm-ink token family, the same tonal move FR-3 permits as a full-bleed chapter. LINT-04 stands: never an ops token, never `--vt-surface-inverse` or `--ink-950`, never an `<html>`-level flip. |
| A full-width navigation canvas | The bar unfolds into one editorial panel holding every group. One panel, never two. Destinations come from one source of truth and must resolve to live routes. |
| A mobile recomposition | Full-screen overlay, journey rail first, designed independently of desktop. Modal semantics are mandatory: focus trap, scroll lock, Escape, focus restoration. |

### What this ruling does **not** relax

- One scroll owner (XS-1). The header observes discrete activation; it never
  drives progression, never adds a scroll listener or rAF loop.
- The rail shows narrative position. It may not display completion the
  server has not confirmed, imply an NPI proves identity ownership, or imply
  review means credential verification.
- Rendered `01–06` ordinals stay retired (CD-13); the rail carries order by
  sequence, shape, and screen-reader text.
- Reduced motion is a deliverable (FR-4): every treatment resolves to an
  immediate state change and the full hierarchy survives.
- The NPI field outranks the journey (XS-10).
- A page-local stylesheet may not restyle the global header. The
  `!important` override this wave removed from `career-loop-home.css` is the
  named anti-pattern; scenes speak to the header through the declaration
  contract only.

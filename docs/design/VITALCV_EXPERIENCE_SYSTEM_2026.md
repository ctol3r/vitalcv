# VitalCV Experience System 2026

**Status:** Canonical for *interaction and progression*.
**Established:** 2026-08-02
**Authority:** derives from [`founder-rulings-2026-08.md`](founder-rulings-2026-08.md).
**Defers to:** [`VITALCV_CREATIVE_DIRECTION.md`](VITALCV_CREATIVE_DIRECTION.md) on
paper, ink, type, the six states, and geometry. This document governs *how the
page moves*; that document governs *how it looks*. Where they disagree on look,
CD wins. Where they disagree on motion, this file wins and CD is amended.

Every clause is numbered `XS-n`. Reject a PR by citing a number.

---

## Part I — The one rule everything else hangs from

### XS-1. One scroll owner

> **The browser scrolls. We observe. Exactly one component owns page progression.**

`HomeScrollExperience` is that component. Nothing else may read or drive
page-level progress.

**Permitted implementation — pick one, not several:**
- one passive `scroll` listener plus one `requestAnimationFrame` loop; **or**
- one top-level Framer Motion `useScroll` owner

Supporting observers are allowed because they do not *drive* progression:
`ResizeObserver` for geometry, `IntersectionObserver` for discrete activation,
CSS custom properties for child rendering.

**Forbidden outright:**

```
preventDefault on wheel          scroll-snap as page progression
preventDefault on touchmove      nested progression scroller
window.scrollTo every frame      Lenis · Locomotive · GSAP ScrollTrigger
                                 Swiper · Three.js · WebGL
```

Framer Motion already in the codebase may be used. A second scroll owner is a
rejection under CD-11 and FR-1.

### XS-2. The progress model carries no personal information

```ts
interface HomeExperienceProgress {
  overall: number;                          // 0–1 across the journey
  activeSceneIndex: number;
  activeSceneProgress: number;              // 0–1 within the active scene
  direction: 'forward' | 'backward';
  helperNavVisible: boolean;
  reducedMotion: boolean;
}
```

No NPI, no clinician identity, no credential content, no artifact id, no tenant
id may enter this model. It describes *where the page is*, never *who is reading
it*.

---

## Part II — Mechanisms

### XS-3. The media rail

One continuous evidence-object rail per journey. Vertical progress maps to a
horizontal transform.

- Panels are **product artifacts**, never generic cards (CD-13, FR-2).
- Transform via composited properties only (`transform`, `opacity`).
- **A fact does not move while it must be read.** Evidence settles before it is
  legible, and stays settled.
- No image is the sole carrier of meaning.
- Motion stops when scrolling stops.

### XS-4. The chapter menu

**Desktop:** sticky; the active item expands; adjacent labels stay legible; a
progress indicator moves; clicking scrolls to a native anchor; every chapter is
keyboard-reachable; URL hash supported where it aids deep-linking.

**Mobile:** a compact chapter strip or an ordinary anchor list. No horizontal page
overflow. **No swipe dependency** — every chapter title is reachable in document
order.

### XS-5. Surface transitions

Chapters may move between the semantic tones `paper · mist · trust · ink`
declared in `styles/home-surfaces.css`. A tone is *declared* on a subtree and
*spent* per element — declaring a tone paints nothing by itself.

At most one `ink` chapter per page, full-bleed, with Paper evidence inside it
(CD-6 amendment, FR-3).

### XS-6. Component-level motion

| Component | Motion | Bound |
| --- | --- | --- |
| `ExpandingEyebrow` | Closed ↔ expanded | Readable without expanding; no layout shift |
| `InteractiveIcon` | Finite state travel | Label required; no evidence-state prop |
| `ProductAction` | Label/arrow exchange | Stable width; no looping spinner |
| `EvidenceCapsule` | Resolve, once | Static once resolved — never re-animates |

---

## Part III — The floor

### XS-7. Reduced motion is a required deliverable

Under `prefers-reduced-motion`:

- no sticky multi-viewport sequence; no horizontal media translation
- normal vertical document order
- the chapter menu becomes ordinary anchors
- eyebrows render readable in place
- every artifact appears
- icon travel becomes an immediate state change
- **the complete product argument survives**

No-JS receives the same semantic order. This is XS-7 rather than a footnote
because it is the clause most likely to be traded away late (FR-4).

### XS-8. Test matrix

Viewports: `320×720 · 390×844 · 768×1024 · 1024×768 · 1440×900 · 1728×1117`

Conditions: normal motion · reduced motion · 200% zoom · keyboard only · mobile
portrait · mobile landscape · dynamic viewport change · orientation change ·
back/forward navigation · hash navigation

Assertions: no trapped scroll · no horizontal overflow · no second scroll owner ·
no content loss · no infinite animation · no focus obscured · no hydration error

### XS-9. Performance

First Load JS shared baseline is approximately **102 kB**. Do not exceed
**110 kB** without documented, measured justification in the PR body.

Measure per change: route JS, route CSS, LCP, CLS, interaction response, scroll
frame consistency, long-task count, memory across the full journey.

> The experience may be ambitious. It may not be sluggish.

### XS-10. The NPI field outranks the journey

The homepage's one real action is the NPI field. It must be **usable
immediately** — before scrolling, before motion initialisation, before hydration
completes anything decorative. No cinematic mechanism may delay, obscure, or
gate it.

If the journey and the field ever compete, the field wins. Everything in this
document exists to deliver a reader to that field and to make what it returns
land — per CD-20, the moment an NPI resolves is where the entire visual budget
is spent.

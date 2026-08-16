# VitalCV Motion System — UX-02 record (2026-08-15)

The Experience Constitution locked motion's *structure* and delegated its *values*
(EC-20 animation row: `LOCKED CONSTRAINTS · values in UX-02`). This document is
that UX-02 record: the values, where they live, what enforces them, and the
standing direction every motion proposal is judged against.

## Direction (founder, 2026-08-15)

Motion is **purposeful, systematic, and accessible — never a flashy one-off**.
It guides focus, explains transformation (EC-10), and builds narrative
progression. A motion proposal that is decorative, idle, or unique to one
surface fails this filter regardless of craft. This restates, not replaces, the
constitution: EC-4 (meaning never carried by motion alone; one scroll owner per
page, standing XS-1 law), EC-5 (motion optional for meaning), EC-25–29 (reduced
motion is a composition, not a fallback; no autoplay under
`prefers-reduced-motion`; poster required for every motion scene).

**Scroll storytelling requires an explicit founder ruling per surface.** The
journey-rail scroll chrome was deleted 2026-08-09 on the founder's
rollback-confidence call, and the film homepage is parked behind
`PUBLIC_HOME_VARIANT=film` (`docs/design/PARKED_VISUAL_ERAS.md`). The direction
endorses the genre; the parked eras stay parked.

## The one source of truth

`apps/web/styles/tokens.css` (§3, Motion Tokens) owns every duration and easing
value. Two mirrors exist for consumers that cannot read CSS:

- `apps/web/design-system/tokens/motion.ts` — framer-motion durations/easings.
- `motionCssVariables` in `apps/web/design-system/styles/variables.ts` —
  emitted onto `<html>` by `apps/web/app/layout.tsx` (`--vt-motion-*`,
  legacy `--ui-motion-*`).

The mirrors never set their own values. Agreement is enforced by the motion
token sync suite (landed with PR #1410), which also pins EC-29 band membership
for every duration and the one easing family. Before that suite, the mirrors
shipped 280ms as "instant" for months after ruling R-e corrected the CSS side
to 120ms — three definition sites, zero comparisons.

## Values (EC-29 bands, Class A)

| Band | Range | Token | Value |
|---|---|---|---|
| Control feedback (press, toggle, focus, hover) | 80–150ms | `--duration-instant` · `--duration-snap` · `--duration-respond` · `--vt-motion-control` | 120ms |
| State transition | 150–250ms | `--duration-fast` · `--vt-motion-fast` | 200ms |
| Product transformation | 250–450ms | `--duration-normal` / `--duration-slow` / `--duration-xslow` · `--vt-motion-normal` / `--vt-motion-slow` | 320 / 380 / 420ms |
| Rare narrative | 450–800ms | `--duration-narrative` | 600ms |

`--duration-stagger` (50ms) is a sibling offset, not a duration — band-exempt.
Easing: one family, `--vt-ease-system: cubic-bezier(0.2, 0.8, 0.2, 1)`; every
other `--ease-*` alias resolves to it (`--ease-accelerate` is the one
sanctioned ease-in, rare).

Writing a literal duration instead of a token is drift; if no token fits, the
gap is a values question for this document, not a new island. Do not mint new
duration prefixes; extend `tokens.css` and its sync suite together. The bands
themselves are locked law — widening one requires an EC-22 amendment in the
same PR.

## The sanctioned primitive kit

Entrance and evidence motion goes through the CSS-driven primitives, which
carry the SSR / no-JS / reduced-motion contracts already:

- `apps/web/components/motion/Reveal.tsx` — the platform entrance primitive
  (IntersectionObserver toggles a class; animation lives in CSS).
- `apps/web/components/motion/ArtifactStage.tsx` — mounts an animated evidence
  drawing; plays once on entry.
- `apps/web/components/motion/EvidenceMetric.tsx` — number motion under the
  truth rule: SSR, no-JS, and reduced-motion all render the final string;
  animated output is `aria-hidden`.

The one page-level scroll-owner pattern is
`apps/web/components/home/film/useFilmProgress.ts` (one passive listener, one
rAF loop, progress written as a custom property). Any surface that needs
scroll-linked motion copies that shape — never a second owner (XS-1, gated by
the experience-doctrine suite and design-lint XS-1a/b/c).

Zero-importer framer-motion-era reveal/particle/background components are
retired-in-place pending removal; do not add consumers. New framer-motion work
takes its transitions from the `motion.ts` mirror, not inline literals.

## Adding motion — the checklist

1. Name the band; take the token. A duration without a band citation is a
   review question.
2. Reduced-motion is a composition you design, not a media query you append
   (XS-7, EC-25). The global kill switch in `app/globals.css` is the backstop,
   not the plan.
3. Meaning survives with motion off: glyph + word first (EC-4).
4. Single-shot; nothing idles; no blocking or gating sequences (EC-20
   amendment 5).
5. One scroll owner per page. If your surface already has one, you are a
   consumer.
6. Keyframes belong in `apps/web/styles/motion.css` (LINT-03 ratchets the
   strays down).

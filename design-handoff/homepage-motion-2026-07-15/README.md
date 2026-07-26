# Homepage Motion Convergence — verification frames (2026-07-15)

Production-build screenshots captured by `apps/web/tests/e2e/capture-handoff.spec.ts`
(Playwright, chromium, 1440×1000 desktop / 360×780 mobile).

These frames record the hero pin that makes the scroll-typed narrative actually
watchable. Measured on the pre-pin build — and again on `main` after #683 — the
narrative line exits the viewport at scrollY ≈ 584 while the reveal ran on to
≈ 927, so phrases 3, 4 and 5 all played below the fold. The pin holds the line
at a fixed viewport position for the whole reveal instead.

- `01–03` hero pin: the narrative at rest, mid-sequence, and at the final
  phrase — note the last phrase is on screen in `03`, where it previously
  played ~316px above the fold.
- `04–06` pinned five-step product story at start (Recognize), middle (Match),
  and end (Accept) of the sticky sequence.
- `07` the single dark technical panel (evidence trace + truth boundary).
- `08` product carousel with partial next-card preview and progress.
- `09` real-number metric strip + dual-audience close.
- `10–12` mobile (360px): unpinned hero, story scroll-snap card, carousel.

Regenerated 2026-07-16 after the tuning pass: hero pin 260vh (was 220) and
story 560vh (was 460) for slower, scroll-aligned pacing; the reveal completes
at 96% of the pin (the 85% dwell read as dead scroll); seams tightened; the
carousel auto-advances with a pause control (Chris's direction, reversing the
original no-autoplay rule).

The reveal is a cumulative dim-ink scrub (Chris, 2026-07-16, mirroring
Palantir/Anyscale): the full sentence is always laid out in muted ink and
scroll fills it word by word — text accumulates, reverse scroll un-fills. The
pure mapping is `narrativeStateAt(progress, words)` +
`buildNarrativeWords(prefix, phrases)`, unit-tested in
`apps/web/__tests__/scroll-type-narrative.test.ts` (this deliberately replaced
#683's phrase-replace model while keeping its guarantees: rest-stable first
clause, never blank, pure/reversible). The pin supplies the runway; unpinned
viewports fill within ~0.55vh so the sentence completes before it can exit.

Regenerate: build web, start it on 127.0.0.1:3000, then
`CAPTURE_OUT=<dir> pnpm exec playwright test tests/e2e/capture-handoff.spec.ts`.

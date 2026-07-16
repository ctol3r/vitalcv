# Homepage Motion Convergence — verification frames (2026-07-15)

Production-build screenshots captured by `apps/web/tests/e2e/capture-handoff.spec.ts`
(Playwright, chromium, 1440×1000 desktop / 360×780 mobile) for the Homepage Motion
Convergence Wave follow-up pass.

- `01–03` hero pin: the scroll-typed narrative at rest, mid-type, and complete —
  the whole five-step sequence now types while the line is on screen.
- `04–06` pinned five-step product story at start (Recognize), middle (Match),
  and end (Accept) of the sticky sequence.
- `07` the single dark technical panel (evidence trace + truth boundary).
- `08` product carousel with partial next-card preview and progress.
- `09` real-number metric strip + dual-audience close.
- `10–12` mobile (360px): unpinned hero, story scroll-snap card, carousel.

Regenerate: build web, start it on 127.0.0.1:3000, then
`CAPTURE_OUT=<dir> pnpm exec playwright test tests/e2e/capture-handoff.spec.ts`.

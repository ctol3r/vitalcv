# Shared-header recovery — visual evidence index

All `after-*` captures were taken against a local **production build**
(`next start`) of `visual/shared-header-recovery`; all `before-*` captures
against **production vitalcv.com** on 2026-08-06. Recordings are `.webm`.
Capture scripts live in `tools/` for re-runs.

## Requirement → evidence map

| Requirement | Before | After |
| --- | --- | --- |
| Homepage top / resting header (1440×900) | `before/before-desktop-home-rest.png` | `after/after-desktop-01-home-rest.png` |
| Scrolled compact state | `before/before-desktop-home-scrolled.png` | `after/after-desktop-02-scrolled-compact.png` |
| Journey stage: Your Number | — (no rail existed) | `after/after-desktop-01-home-rest.png` |
| Journey stage: Sources + **dark ink scene** | — | `after/after-desktop-03-stage-sources-ink-scene.png` |
| Journey stage: Permission + **dark indigo scene** | — | `after/after-desktop-04-stage-permission-indigo-scene.png` |
| Journey stage: Review + light scene | — | `after/after-desktop-05-stage-review-light-scene.png` |
| Expanded navigation (canvas vs dropdown) | `before/before-desktop-home-menu-open.png` | `after/after-desktop-06-navigation-canvas.png` |
| Clinician / activation route | — | `after/after-desktop-07-clinician-activation-route.png` |
| Employer route | `before/before-desktop-employers-rest.png` | `after/after-desktop-08-employer-route.png` |
| Trust route | `before/before-desktop-trust-rest.png` | `after/after-desktop-09-trust-route.png` |
| Reduced motion (rest · ink · canvas) | — | `after/after-desktop-10..12-reduced-motion-*.png` |
| Tablet 768×1024 | — | `after/after-tablet-768-home.png` |
| Wide 1728×1117 (rest + canvas) | — | `after/after-wide-1728-*.png` |
| 200%-zoom-equivalent reflow | — | `after/after-zoom-200pct-equivalent.png` |
| Mobile resting bar (390×844) | `before/before-mobile-home-rest.png` | `after/after-mobile-01-rest.png` |
| Mobile current-stage display | — (none existed) | `after/after-mobile-02-stage-in-bar.png` |
| Mobile overlay: journey-first | `before/before-mobile-home-menu-open.png` | `after/after-mobile-03-overlay-journey.png` |
| Mobile overlay: destination groups | — | `after/after-mobile-04-overlay-groups.png` |
| Mobile close / focus restoration | — | `after/after-mobile-05-closed-focus-restored.png` |
| Mobile dark-scene bar | — | `after/after-mobile-06-dark-scene-bar.png` |
| Mobile stage progression | — | `after/after-mobile-07-stage-permission.png` |
| Desktop motion recording | — | `after/after-desktop-journey.webm` |
| Reduced-motion recording | — | `after/after-desktop-reduced-motion.webm` |
| Mobile motion recording | — | `after/after-mobile-journey.webm` |

Horizontal-overflow, keyboard, focus-trap, scroll-lock, and Escape behavior
are asserted by `apps/web/tests/e2e/header-journey.spec.ts` (15 tests, run
3× consecutively clean against the dev server) and the rebuilt
`liquid-menu.spec.ts`; unit contracts by three vitest suites (36 tests).

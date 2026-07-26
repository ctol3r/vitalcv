# M10 — Quality, Accessibility & Experience Completeness — Status

**Date:** 2026-07-06

## Already present on main (verified)

| Item | State | Evidence |
|---|---|---|
| **M10-1 E2E** | Specs exist, **not CI-wired** | `apps/web/playwright.config.ts` + 5 specs in `apps/web/tests/e2e/` (01-clinician-onboarding, 02-employer-verification, 03-revocation-trigger, 04-launch-wedge, npi-truth-engine). No workflow runs them. |
| **Golden-path contracts** | Present (vitest) | `wedge-smoke-flow`, `request-review-route-contract`, `holder-route-contract` tests run in CI. |
| **M10-2 a11y** | Partial gate | `a11y-gate.yml` runs axe on `hero-routes.test.tsx` only; `axe-runner.ts` exists. Full-route coverage is the gap. |

## The concrete gap + why not auto-wired here

**M10-1: the 5 Playwright specs don't run in CI.** Wiring them is real but needs a
decision I can't validate blind:
- a **test server** (built app or dev server) running in the workflow, and
- a **Clerk-auth strategy** for the authed flows — Clerk bot-blocks automated
  browsers (`clerk_cdn_bot_management`), so signed-in E2E needs a mocked/test Clerk
  instance or a storage-state fixture. Adding a workflow that then flakes on auth
  would be noise, not a gate.

**Recommended wiring (follow-up):** a `web-e2e.yml` that builds the app, boots it
with a test Clerk publishable key + seeded storage-state, then `playwright test`.
Start non-blocking; promote to required once green + stable (<2% flake).

## Follow-up

- **M10-2** extend the a11y gate beyond hero routes to the five canonical surfaces.
- **M10-4** Lighthouse perf budget (LCP < 2.5s on passport + review).
- **M10-5** Antigravity audit — walk each surface, name its blocked moment
  (incl. MATCHA streaks/constellation: serve readiness, not engagement theater).

## Assessment

The E2E + a11y **infrastructure exists**; the gap is coverage breadth and CI
wiring, not greenfield. E2E CI wiring is deferred deliberately (auth/server
strategy needed) rather than shipped broken.

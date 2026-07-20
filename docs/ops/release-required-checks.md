# Release protocol — required checks on `main`

**Established:** 2026-07-20 (deep-audit W0.3) · Branch protection already
enforces these; this document makes the contract explicit so no lane treats a
red run as "some other branch's problem."

## Required status checks (merge-blocking)

| Check | What it proves | Typical duration |
| --- | --- | --- |
| `Web E2E (Playwright)` | Full browser behavior on the production build — homepage motion, scene degradation, NPI truth engine, story rail | 10–15 min |
| `Web Quality` | Web workspace typecheck + lint + unit suite + production build | ~6 min |
| `Web E2E (real auth)` | Clerk-gated flows (secret-gated; passes trivially without secrets) | <1 min |
| `check-public-claims` / `Public-copy claim guard` | Truth-contract banned strings on public copy | <15 s |
| `SCA — critical-only gate` | No critical-severity dependency vulnerabilities | <30 s |
| `axe WCAG 2.2 AA` | Structural accessibility on key routes | ~2 min |

## Protocol

1. **A red required check blocks the merge. Fix or quarantine — never wait it
   out.** Flaky specs get repaired or explicitly quarantined in their own PR
   (deep-audit QUAL-10.3); a retried-until-green run is not a pass.
2. **PR checklist:** production-build E2E green (`Web E2E (Playwright)`), unit
   suites green, and — for homepage-composition changes — the composition
   manifest updated in the same PR (`docs/design/homepage-composition-manifest.md`).
3. **Path-filter gap (known):** the web checks trigger on `apps/web/**` paths.
   A PR touching only `scripts/` or `docs/` leaves required checks in
   "expected" forever and can never merge normally. Options, in order:
   include the driving web change in the same PR when one exists; otherwise an
   explicitly-reported admin merge is the documented escape hatch (used for
   the deploy-smoke marker repair, PR #795). A workflow-level fix (always-run
   no-op job on non-web paths) is welcome future work.
4. **Dev-preview routes** (`/dev/*`) must carry their production gate
   (`notFound()` unless the explicit preview env flag is set) and their e2e
   specs must skip — not fail — when the harness flag is absent. The
   story-rail spec's `PREVIEW_STORY_RAIL=1` wiring is the reference pattern.
5. **Deploy verification:** `scripts/deploy-smoke.mjs` runs in
   `release-verify.yml` against production after each deploy. Its homepage
   marker is `data-home-hero` — a stable structural hook. When removing or
   renaming structural hero hooks, update the smoke in the same PR.

## One homepage visual PR at a time

Per the deep audit's master rule: hero, theme, rail, and story files are a
single ownership zone. Two open PRs editing that zone simultaneously
(the #790/#791 collision) is a stop-the-line condition — consolidate first.

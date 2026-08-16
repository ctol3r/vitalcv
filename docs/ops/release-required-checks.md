# Release protocol — required checks on `main`

**Established:** 2026-07-20 (deep-audit W0.3) · **Updated:** 2026-08-15 to the
authoritative 14-check list and the always-on protection-existence assertion.

**Source of truth:** the `REQUIRED_CHECKS` list in
`scripts/check-workflow-path-filters.js`. This document mirrors it; when they
disagree, the script wins and this file is stale. The live protection
configuration is reconciled against that list with
`node scripts/check-workflow-path-filters.js --verify-protection`
(see [github-security-controls-2026-08-02.md](github-security-controls-2026-08-02.md)
for the 2026-08-02 sync that established the 14).

> **Restored (2026-08-16):** the 2026-08-15 protection outage is closed.
> Protection was re-applied the same night (initially the 7 previously
> documented (see 83812d1a2), then re-synced to the full 14 from the
> 2026-08-02 controls doc on founder authorization), and
> `check-workflow-path-filters.js --verify-protection` passes both
> directions. The 08-15 outage record stays in git history; the fail-loud
> existence assertion (#1393) now guards against a recurrence.

## Required status checks (merge-blocking)

| Check | What it proves |
| --- | --- |
| `SCA — critical-only gate` | No critical-severity JS dependency vulnerabilities |
| `Rust SCA — critical-only gate` | No critical-severity Rust dependency vulnerabilities |
| `Web E2E (Playwright)` | Full browser behavior on the production build — homepage motion, scene degradation, NPI truth engine |
| `Web Quality` | Web workspace typecheck + lint + unit suite + production build |
| `Web E2E (real auth)` | Clerk-gated flows (secret-gated; passes trivially without secrets) |
| `axe WCAG 2.2 AA` | Structural accessibility on key routes |
| `Identity-header trust ratchet` | Identity-header blast radius stays frozen — no new raw `x-clerk-user-id` reads |
| `Canonical Source Adapter Gate` | Verification-source adapters conform to the canonical contract |
| `check-design-lint` | Design-system lint on public surfaces |
| `check-copy-source-liveness` | Copy that cites a verification source names one that actually exists |
| `check-public-claims` | Truth-contract banned strings stay out of public copy |
| `check-route-guards` | Route-guard registry matches the route inventory |
| `check-workflow-contract` | Every required check will actually report on a PR to main, and a protection object exists at all |
| `Backend Tests (Postgres)` | Backend jest suite against a real Postgres |

## Protection-existence assertion (always-on)

`scripts/check-workflow-path-filters.js` — the script behind
`check-workflow-contract` — now asserts on **every** run (default and
`--report`, i.e. the mode CI executes) that a protection object exists on
`main` at all: classic branch protection (`branches/main` reports
`protected=true`) **or** a non-empty branch ruleset (`rules/branches/main`).
Both reads work with the default token. If neither exists, the gate fails with
a distinct absent-protection message — GitHub's 404 from the protection
endpoint means *no protection object exists*, and is never misreported as a
token-scope problem (a 403 is the scope case, reported separately as UNKNOWN).
Any read failure fails closed.

The full context-list comparison — containment (`REQUIRED_CHECKS` ⊆ live
contexts) and the reverse direction, each failing distinctly — remains opt-in
via `--verify-protection` (`pnpm check:workflow-contract:protection`), because
reading classic protection's contexts needs admin scope. Run it whenever
branch protection changes. A rulesets-only repo is supported: when the classic
protection endpoint 404s but `rules/branches/main` carries
`required_status_checks` rules, those contexts are compared instead.

## Protocol

1. **A red required check blocks the merge. Fix or quarantine — never wait it
   out.** Flaky specs get repaired or explicitly quarantined in their own PR
   (deep-audit QUAL-10.3); a retried-until-green run is not a pass.
2. **PR checklist:** production-build E2E green (`Web E2E (Playwright)`), unit
   suites green, and — for homepage-composition changes — the composition
   manifest updated in the same PR (`docs/design/homepage-composition-manifest.md`).
3. **Path-filter gap: closed.** This document previously recorded that web
   checks triggered only on `apps/web/**` paths, leaving scripts/docs-only PRs
   unmergeable. That gap was closed by de-filtering every required workflow
   (#871 design-lint, #883 axe + public-claims, with enforcement added in
   #881 and hardened to the full reporting closure in #1354). Verified
   2026-08-15: `node scripts/check-workflow-path-filters.js --report` shows
   `paths=none` for all 14 required checks. The workflow-contract gate fails
   any PR that reintroduces a path filter (or any other way a required check
   could fail to report) on a required workflow.
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

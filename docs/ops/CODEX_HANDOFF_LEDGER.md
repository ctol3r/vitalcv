# Codex handoff ledger

Append-only. **Newest entry at the top.** One entry per work order, written in
the same PR as the work it describes.

This file is the state of the world between lanes. A report that lives only in a
terminal is lost the moment the session ends; a report on `main` is readable by
whoever picks up next. Entry format is in
[`CODEX_HANDOFF_PROTOCOL.md`](CODEX_HANDOFF_PROTOCOL.md) §8.

Two kinds of entry are worth as much as a merge and are frequently skipped:

- **ABORTED — already landed.** `main` already had the behaviour. Say so and name
  the PR that did it. This is the cheapest possible outcome and it is a success.
- **BLOCKED — product dependency.** The experience required a change to truth,
  auth, consent, data models, or pricing. Name the dependency and stop; do not
  solve it inside the PR.

## WO-1 · Merge #1362 — delete `verifyProduction.ts` — BLOCKED

- **Date:** 2026-08-11
- **Claim-check:** Ran the protocol resume sequence against `origin/main` at
  `35574fd9e`. #1362 is the sole open PR for this intent and is `CLEAN`; no
  merged PR or unclaimed branch duplicates it. A full text search finds legacy
  mentions in two historical `.claude/settings.local.json` permission entries
  and explanatory backend comments, but no import, package script, workflow,
  or executable caller. The deleted script itself was the only executable
  implementation.
- **Change:** Removes the orphaned production-check script. It asserted route
  outcomes that the current tenant guard cannot produce and was not wired into
  a runnable repository path.
- **Verification:** `git diff --check origin/main...HEAD` exited 0. `git grep
  -n -i 'verifyProduction' HEAD` found only historical text references after
  the deletion, not a runnable caller. The PR head's 14 check runs all reported
  `success`, including Backend Tests (Postgres), Web Quality, both Playwright
  suites, axe, copy, claims, design, route, and workflow-contract gates.
  Fresh `pnpm typecheck` and `pnpm build` passed. Fresh `pnpm test` failed one
  unrelated current-main test: `apps/web/__tests__/sitemap-freshness.test.ts`
  reports `/pricing` as `2026-08-09` while its latest source commit is
  `2026-08-11` (`05b09f3c`).
- **Gate:** Head `f703430f3157e3224f66416c1193ea42856a43e6`; `CLEAN`; zero
  pending or failing check runs. GitHub's branch-protection endpoint is not
  available to this private repository plan (HTTP 403), so required-context
  names could not be enumerated live.
- **Left open:** Do not merge #1362 until the current-main sitemap freshness
  drift is repaired and the full suite is green on the updated merge ref. The
  repair is outside this work order; it must be a separate, focused PR. This
  PR also establishes the ledger file for subsequent work orders.

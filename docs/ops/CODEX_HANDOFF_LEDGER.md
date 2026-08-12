# Codex handoff ledger

Append-only. **Newest entry at the top.** One entry per work order is recorded
in the same pull request as its implementation or takeover evidence.

## WO-1 · Merge #1362 — delete `verifyProduction.ts` — OPEN #1362

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
- **Verification:** `git diff --check origin/main...HEAD` exits 0. `git grep
  -n -i 'verifyProduction' HEAD` found only historical text references after
  the deletion, not a runnable caller. The PR head's 14 check runs all reported
  `success`, including Backend Tests (Postgres), Web Quality, both Playwright
  suites, axe, copy, claims, design, route, and workflow-contract gates.
  WO-2 landed the focused `/pricing` correction in `b861a4abf`; on this updated
  merge ref, fresh `pnpm typecheck`, `pnpm build`, and `pnpm test` all pass
  (4,401 web tests passed; the suite's seven environment-gated files remain
  intentionally skipped).
- **Gate:** The merge includes the current `main` ledger rather than overwriting
  it, avoids a force-push, and keeps the executable deletion as the only
  functional change in this work order.

## WO-2 · Merge #1365 — Axuall '891 FTO read and presentation-exchange tripwire — OPEN #1365

- **Date:** 2026-08-11
- **Claim-check:** The open and merged pull-request lists and remote branches were
  checked before takeover. No existing merged work carried this FTO record or its
  dormant-presentation guard.
- **Change:** Documents the Axuall '891 research constraint, adds a five-file
  deployed OID4VP baseline and tripwire test, and corrects the stale `/pricing`
  sitemap `lastModified` value that made the existing full test suite fail on
  current `main`.
- **Verification:** The focused tripwire suite passes cleanly. Three deliberate
  injections failed as intended: a new deployed `presentation_definition` path,
  a product-page import of `AcceptancePanel`, and a product caller of
  `/api/oid4vp`; each was removed before continuing. `pnpm typecheck`, `pnpm
  build`, and `pnpm test` all pass.
- **Scope boundary:** This records a research and regression boundary only. It
  does not activate OID4VP exchange, change product behavior, or remediate the
  separately identified unauthenticated-endpoint concern.
- **Next gate:** Push this ledger entry, require all head checks to finish green
  with a clean merge state, then land #1365. Its sitemap correction unblocks the
  existing WO-1 deletion PR from a known baseline test failure.

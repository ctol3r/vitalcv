# Codex handoff ledger

Append-only. **Newest entry at the top.** One entry per work order is recorded
in the same pull request as its implementation or takeover evidence.

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

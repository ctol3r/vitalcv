# M1 — Canonical Path Proof & Trust-Core Hardening — Status

**Date:** 2026-07-06

## Shipped (CI gates — the load-bearing proofs)

| Item | Deliverable | State |
|---|---|---|
| **M1-1** Canonical-path proof | `.github/workflows/canonical-path-gate.yml` runs the 67-case `employmentGuards.test.ts` (fail-closed: self-report, missing PSV/countersignature, DID/scope mismatch, timestamp order, expiry, bad proof). Guards use branded `VerifiedCanonicalPath` → compile-time bypass-proof. | ✅ shipped, 67/67 green |
| **M1-2** Audit-write coverage | `scripts/check-audit-coverage.ts` + baseline (92 files) + workflow freeze the gap so no new unaudited mutation lands. Inventory: `docs/security/audit-coverage.md`. | ✅ regression gate shipped; full 100% remediation = backlog |
| **M1-8** Copy-compliance gate | `scripts/check-public-claims.ts` (extended: +CLAUDE.md phrases, marketing scan, bare-`Verified`, allowlist) + workflow. Caught 3 real marketing violations. | ✅ shipped, PASS (23 phrases) |

## Verified sound (no code change needed — confirmed by exploration + tests)

- **M1-3 Readiness determinism.** `services/verticals/readiness/readinessEngine.ts`
  `computeReadiness(...)` is a pure function of `(npi, targetState, profession,
  artifacts)` via `computeDeterministicTrustReadiness` — no hidden state. Score
  gates Start (enrollment must be ENROLLED or score capped ≤59); blockers array
  populated per unmet dimension. *Enhancement backlog:* a property-based
  same-inputs⇒same-score snapshot corpus (≥50 synthetic states).
- **M1-4 Revocation-first.** `packages/psv/validateReceipt.ts`
  `resolveReceiptStatus` re-checks `revoked` and TTL freshness **at read time**
  (returns REVOKED/EXPIRED, fails closed on malformed). `TrustStateResolver.ts`
  re-resolves every receipt per `resolve()` call — **no cached "valid"** — and
  emits `TRUST_STATE_DECAY` audit on flip. *Enhancement backlog:* a 4-surface
  integration test (passport/share/packet/verifier) asserting a revoke flips all
  within one request cycle.
- **M1-5 Source-coverage honesty.** Coverage states (`checked/stale/pending/
  gated/unavailable/…`, `revoked` fails closed) resolve via
  `resolveSourceCoverageState`; decision-grade excludes stale/unknown/mock. Many
  web `*-truth`/`coverage` vitest guards already pin distinct rendering.
  *Enhancement backlog:* a per-state visual/snapshot matrix.
- **M1-6 Source feature flags.** Dozens of source lanes are env-flagged
  (`REAL_NURSYS_ENABLED`, `FSMB_ENABLED`, `OIG_LEIE`, `PECOS`, `STATE_BOARD`,
  `MONITORING_ENABLED`, `CMS_*`, board lanes…). Verified default-safe: flag off ⇒
  honest coverage state (OIG_LEIE → UNCHECKED, STATE_BOARD has no live call, Nursys
  → accessRequired) — **never a fabricated pass**. *Enhancement backlog:*
  consolidate the scattered flags into one documented env-schema truth table.

## Remaining implementation backlog (real work, not blockers)

- **M1-7 Idempotency keys** on `accept` / `request-refresh` / `route-to-review`
  (`employerActions.ts`) — replay-safe so a double-accept yields one
  EmployerAcceptance + one idempotent-replay audit note. **Not yet implemented.**
- **M1-2 full remediation** — drive the 92-file audit baseline to only
  documented query-POSTs; audit the P0 mutations (`clinician/activate`,
  `workspaces/switch`, `coordination/revoke`) via the `employerActions.ts` pattern.
- **M1-3/4/5** enhancement tests above.

## Exit-gate assessment

The three named gates (`canonical-path-gate`, `audit-coverage-gate`,
`copy-compliance-gate`) are green and wired. Trust-core claims are test-backed at
the guard level; deeper end-to-end integration tests and idempotency remain as
tracked backlog. **M1 core objective met; hardening tail carried forward.**

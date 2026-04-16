# VitalCV Truth Enforcement Board

> **Purpose:** Convert the failure matrix (`docs/specs/vitalcv-failure-matrix.md`) into an executable + CI-enforceable board. Every failure row maps to a test file, an assertion, a derived coverage status, and a CI gate.
>
> **Owner:** VitalCV QA · **Initial Author:** Claude Cowork, 2026-04-14
>
> **Status discipline:** Row/drift status in this document is **mechanically derived** by `scripts/ci/enforcement-board-status.mjs` from (a) the manifest at `docs/ops/enforcement-board.manifest.json` and (b) the filesystem. Do not hand-edit the "Generated Status Region" section — edit the manifest instead. Hand-edits will be overwritten on next CI run.
>
> **Status legend:**
> - `EXISTS` — test file present and at least one assertion pattern matches
> - `STUB` — test file exists but no assertion pattern matched
> - `MISSING` — no listed test file exists on disk
> - `DRIFT` — a `forbiddenFilePresent` check triggered (doctrine contradiction)

---

## How This Board Works

```
docs/ops/enforcement-board.manifest.json     ← hand-curated rows + drift checks
                │
                ▼
scripts/ci/enforcement-board-status.mjs      ← scans filesystem, matches patterns
                │
                ▼
<!-- BEGIN GENERATED -->...<!-- END GENERATED -->   ← rewritten in place below
```

**Run locally:**

```bash
node scripts/ci/enforcement-board-status.mjs          # rewrite the board
node scripts/ci/enforcement-board-status.mjs --check  # CI mode: exit 1 if CRITICAL!=EXISTS or drift triggered
```

**Adding a new row:** edit the manifest. Add `testFiles` (paths) and `assertionPatterns` (regex source, case-insensitive). Re-run the script. Status flips only when real code matches.

**Why this is faking-resistant:** the `status` field is not stored. You cannot hand-flip `STUB → EXISTS`; you can only change what the script *sees*, which means writing the test.

---

## Layer-Seam Enforcement (Reference)

Seam-level contradictions sit between test files and need distinct enforcement homes. These are not auto-derived — they point at the CI gate that owns each seam. Add them to the manifest when their enforcement home becomes a testable file.

| Seam | Contradiction | Enforcement Home |
|---|---|---|
| A | Soft-404 parsed as success | adapter contract tests (manifest R2, R6) |
| A | Timeout classified as `stale` not `unavailable` | R6 assertion patterns |
| B | `reviewRequired` promoted to L2 | future readinessEngine unit test (add row) |
| B | `stale` identity not demoted from L2 | same |
| C | CRS<80 Start opened via prior Acceptance | `canonical_wedge.test.ts` (R5, R7, R9) |
| C | Raw Prisma write bypasses `employmentGuards.ts` | static lint (future G7) |
| D | 2xx without AuditEvent | CI Gate G2 |
| D | `acceptance.refused` returns 200 with `{ok:false}` | route contract test (add row) |
| D | DecisionCapsule omits trust-state snapshot | R8 assertion patterns |
| E | Gated source rendered as `checked` | R7 (`passport-review-truth.test.ts`) |
| F | Prohibited copy reaches build | CI Gate G3 |
| G | Future-dated `issuedAt` accepted | future PSV receipt validator test (add row) |
| G | Freshness computed on `createdAt` not `verifiedAt` | future freshness service unit test (add row) |

---

## CI Gate Definition

> `.github/workflows/truth-enforcement.yml` (sketch)

### G1 · Failure-Matrix Test Suite
All tests referenced by the manifest must execute and pass. Skipped/todo tests fail the build.

```yaml
- name: G1 — Failure matrix suite
  run: pnpm vitest run --reporter=verbose
  env: { VITEST_FAIL_ON_SKIP: '1' }
```

### G2 · AuditEvent Contract
- **G2a (runtime):** middleware asserts every 2xx from a mutating route has a committed `AuditEvent`. Wired in `NODE_ENV=test`.
- **G2b (static):** AST walk over `apps/api/backend/src/routes/**` requires `auditService.write(` in every mutating handler OR an entry in `docs/ops/audit-allowlist.json`.

### G3 · Copy-Prohibition Lint
Grep over `apps/web/**` + `apps/marketing/**` for prohibited phrases from Canon §16. Build fails on match.

### G4 · Canonical Path Guards
`pnpm tsc --noEmit` + `canonical_wedge.test.ts`. Forbid new `@ts-ignore`/`@ts-expect-error` in `packages/domain-common/employment*.ts`.

### G5 · Prisma Schema Drift
`prisma migrate diff` against baseline; non-additive changes require a file in `docs/migrations/`.

### G6 · Enforcement Board Drift (this script)
```yaml
- name: G6 — Enforcement board status
  run: node scripts/ci/enforcement-board-status.mjs --check
```
**Fails if:** any CRITICAL row ≠ `EXISTS` OR any drift check triggered.

### Combined workflow sketch

```yaml
name: Truth Enforcement
on: [pull_request, push]
jobs:
  enforce:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - run: pnpm install --frozen-lockfile
      - name: G1 — Failure matrix suite
        run: pnpm vitest run
        env: { VITEST_FAIL_ON_SKIP: '1' }
      - name: G2b — Audit contract static
        run: node scripts/ci/check-audit-contract.mjs
      - name: G3 — Copy doctrine lint
        run: node scripts/ci/copy-prohibitions.mjs
      - name: G4 — Canonical path guards
        run: pnpm tsc --noEmit && pnpm vitest run apps/api/backend/__tests__/canonical_wedge.test.ts
      - name: G5 — Prisma schema drift
        run: node scripts/ci/prisma-drift-check.mjs
      - name: G6 — Enforcement board status
        run: node scripts/ci/enforcement-board-status.mjs --check
```

---

## Generated Status Region

<!-- BEGIN GENERATED: enforcement-board-status -->

> **Generated:** 2026-04-15T04:07:08.220Z — derived from `docs/ops/enforcement-board.manifest.json` and filesystem state. Do not hand-edit this region; edit the manifest instead.

### Coverage Roll-Up

| Severity | Total | EXISTS | STUB | MISSING |
|---|---|---|---|---|
| CRITICAL | 5 | 2 | 3 | 0 |
| HIGH | 4 | 1 | 3 | 0 |
| MEDIUM | 0 | 0 | 0 | 0 |

### Row Status

| ID | Scenario | Severity | Status | Evidence |
|---|---|---|---|---|
| R1 | Invalid NPI (format fails) | HIGH | **STUB** | files present: apps/api/backend/__tests__/intakeService.bootstrapNpi.test.ts; no assertion pattern matched |
| R2 | No-record NPI (valid format, not in NPPES) | HIGH | **STUB** | files present: apps/api/backend/__tests__/intakeService.bootstrapNpi.test.ts, apps/api/backend/__tests__/connectors/connectorHealth.test.ts; no assertion pattern matched |
| R3 | OIG positive match | CRITICAL | **EXISTS** | apps/api/backend/__tests__/connectors/oigConnector.test.ts matches /EXCLUDED/i |
| R4 | OIG unresolved near-match | CRITICAL | **STUB** | files present: apps/api/backend/__tests__/connectors/oigConnector.test.ts; no assertion pattern matched |
| R5 | PECOS NOT_FOUND | HIGH | **STUB** | files present: apps/api/backend/__tests__/canonical_wedge.test.ts; no assertion pattern matched |
| R6 | Source unavailable | CRITICAL | **EXISTS** | apps/api/backend/__tests__/connectors/connectorReliabilityControls.test.ts matches /CRITICAL/i |
| R7 | Stale data | HIGH | **EXISTS** | apps/web/__tests__/passport-review-truth.test.ts matches /stale/i |
| R8 | Revoked issuer cascade | CRITICAL | **STUB** | files present: apps/api/backend/repositories/__tests__/decisionCapsules.repo.test.ts, apps/api/backend/repositories/__tests__/acceptances.repo.test.ts; no assertion pattern matched |
| R9 | Conflicting claims divergence | CRITICAL | **STUB** | files present: apps/api/backend/__tests__/intelligenceCore.test.ts, apps/api/backend/__tests__/canonical_wedge.test.ts; no assertion pattern matched |

### Drift Checks

| ID | Description | Severity | Triggered | Evidence |
|---|---|---|---|---|
| D1 | NPDB is not integrated per Canon §6; presence of an NPDB connector test implies a stub being treated as live | MEDIUM | 🚨 YES | apps/api/backend/__tests__/connectors/npdbConnector.test.ts exists |
| D2 | DEA is not integrated; no live test expected | MEDIUM | no | — |

### CI Verdict

🚨 CI would fail:
- R4 (OIG unresolved near-match) is STUB, CRITICAL rows must be EXISTS
- R8 (Revoked issuer cascade) is STUB, CRITICAL rows must be EXISTS
- R9 (Conflicting claims divergence) is STUB, CRITICAL rows must be EXISTS
- drift D1: NPDB is not integrated per Canon §6; presence of an NPDB connector test implies a stub being treated as live

<!-- END GENERATED: enforcement-board-status -->

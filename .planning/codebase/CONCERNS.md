# Codebase Concerns

**Analysis Date:** 2026-05-18

The highest-leverage concerns are at the top. Every concern cites at least one file path.

## Tech Debt

### CRITICAL — `replayEngine.ts` partial-merge regression (build-breaking, repo-wide)

- File: `apps/api/backend/src/services/audit/replayEngine.ts`
- Issue: Four imports reference modules that do **not** exist on `origin/main` (introduced by commit `8912bc7e`):
  - Line 24 — `import { buildRuntimeReplayMetadata, type RuntimeReplayMetadata } from '../runtimeTrustCohesion'`
  - Line 31 — `import { assertTenantScope, scopeRelatedDecisions, normalizeTenantId, type TenantId, type TenantScope } from '../multi-tenant/tenantIsolation'`
  - Line 41 — `import { computeContainmentBoundary, evaluateContainment, quarantineReplay, traceCorruptionLineage, … } from './replayCorruptionContainment'`
  - Line 45 — `import { syncReplayConfidence, type CalibratedConfidenceScore } from './confidenceCalibration'`
- Impact: `chai-vc-platform-backend:build` fails with `TS2307` errors, which fails the `Web Quality` CI gate on **every** open PR in the fleet. Confirmed via `gh run view 26001191290 --log-failed` against PR #375.
- Fix approach: pick one of:
  1. **Restore** the four missing modules from wherever they live (likely a stash or unmerged feature branch — the parent commit message names all four).
  2. **Revert** `replayEngine.ts` to its state prior to `8912bc7e` so it stops importing the orphans.
  3. **Stub** the four modules with type-only definitions + no-op runtime functions that satisfy the existing call sites (lines 322, 325, 334, 460, 472, 606, 678, 715, 737, 754) without changing semantics.
- Priority: blocks the entire open-PR fleet. Should ship as its own narrow PR.

### HIGH — Wallet-sdk stale re-export

- File: `packages/wallet-sdk/src/index.ts` (line 351 on `origin/main`)
- Issue: `export * from './interoperability'` references a file that has never existed in `packages/wallet-sdk/src/`. Fails DTS build.
- Status: fix prepared on branch `fix/wallet-sdk-interoperability-export` (PR #375 at commit `b89b1a8c`) — removes the one offending line. Not merged.
- Impact: contributes to the same `Web Quality` CI red across the fleet; once `replayEngine.ts` is fixed, this PR completes the unblock.

### MEDIUM — `STALE_TEST_FILES` allowlist (9 excluded suites)

- File: `apps/web/vitest.config.ts` (lines 11–21)
- Excluded suites cover billing, employer-review workflows, interview onboarding, pricing, public docs, and post-release truth cleanup. Each entry carries an inline comment naming the missing target page or subpath:
  - `billing-page.test.tsx`, `employer-request-context.test.tsx`, `employer-workspace-bootstrap.test.tsx`, `live-path-regression.test.tsx`, `passport-page.test.tsx`, `pilot-ops-page.test.tsx`, `pricing-model.test.ts`, `public-docs-route-contract.test.tsx`, `postrelease-truth-cleanup.test.tsx`.
- Impact: silent regressions on high-impact public surfaces — billing, employer-review, onboarding flows.
- Fix approach: restore the missing target pages OR rewrite each test to mock the deleted surfaces. Tracked as a maintenance wave.

### MEDIUM — Marketing brutalist-refactor TODOs

- Files (all line 1):
  - `apps/web/components/marketing/ImpactPanel.tsx` — `// TODO: brutalist refactor`
  - `apps/web/components/marketing/AcceptanceNetwork.tsx` — same
  - `apps/web/components/marketing/ProductBento.tsx` — same
  - `apps/web/components/marketing/NetworkBackground.tsx` — same
  - `apps/web/components/marketing/BentoGrid.tsx` — same
- Impact: brittle marketing copy state. The same surface is referenced by demo-spine waves (#366–#368) and the wave brief for design canon (PR #378).
- Fix approach: one design-refactor wave to align these with the trust-canon visual grammar landed on `feat/design-trust-surfaces-canon-v1`.

### LOW — Archived legacy surfaces (125 files)

- Directory: `apps/web/app/_archive/` — 125 files across six archived wave folders (dashboard, demo, mobile, simulation, verifier, wave119).
- Impact: clones into every PR; can produce stale grep hits during truth scans. Already allowlisted by PR #370's banned-strings gate (`/_archive/` substring).
- Fix approach: a one-time cleanup wave can move these to a `git tag`-only archive. Not blocking.

## Known Bugs

### MEDIUM — `https://vitalcv.com` returns HTTP 402 `DEPLOYMENT_DISABLED`

- Vercel-side account block. Tracked in `docs/ops/vercel-exit-emergency-plan.md` (on `ops/vercel-exit-emergency`, PR #376).
- Founder decision: no more Vercel dependency. Cloudflare migration is in flight per `docs/ops/cloudflare-production-cutover-plan.md`. Until that lands, production is intentionally down.

### MEDIUM — TODO / FIXME inventory in critical paths

40+ TODO comments across `apps/`. The persistence-related TODOs are the most actionable:

- `apps/admin-api/src/auth/middleware/aal-guard-enhanced.ts:197` — `// TODO: In production, persist to database` (in-memory session)
- `apps/api/backend/src/routes/matcha.ts:98` — `// TODO: Wave 190+ migrate to DB` (in-memory intent store)
- `apps/api/backend/src/routes/employerNotifications.ts:30` — `// TODO: migrate to Prisma`
- `apps/api/backend/src/services/providers/notificationProvider.ts:21` — `// TODO: wire SendGrid/Postmark` (no-op email provider)
- `apps/api/backend/src/services/decision/driftEngine.ts:130,181,208,209` — multiple persistence + detection TODOs.

Impact: each one is acceptable while the surface is demo-only; each one becomes a production blocker the moment that surface gets paying users.

### LOW — `@vitalcv/trust-state` build-order footgun

- Documented in `CLAUDE.md` (line 26): `pnpm turbo run build --filter @vitalcv/web` must prebuild `@vitalcv/trust-state` first. Fresh worktrees fail with `Cannot find module '@vitalcv/trust-state'` until the workspace dist/ is populated.
- Mitigation: `pnpm turbo build --filter='@vitalcv/trust-state' --filter='@vitalcv/shared'` is the standard preflight.
- Fix approach: the gotcha is acknowledged; a more durable fix is a project-reference setup in the root tsconfig that doesn't depend on dist/ output. Not blocking today.

## Security Considerations

### LOW — `/api/leads` JSONL parent directory permissions

- File: `apps/web/lib/leads/persistLead.ts` (on branch `feat/lead-capture-wire`)
- The JSONL file is written with `mode: 0o600`, but the parent directory `~/.vitalcv-logs/` is created via `mkdir(dirname(target), { recursive: true })` which uses default perms (typically `0o755` or `0o775`).
- Impact: file content is restricted, but any local user can enumerate the directory and see filenames.
- Fix: explicit `chmod 0o700` on the parent directory on first write.

### LOW — Banned-strings gate not on `main`

- Gate is implemented on branch `ci/banned-strings-guard` (PR #370). Until it merges, copy regressions can land without detection.
- Mitigation: every wave PR runs the banned-strings grep manually as part of validation.

### NOTE — `.env.production` committed in `apps/api/backend/`

- File: `apps/api/backend/.env.production`
- Appears to be empty / redacted (no real secret values), but its mere presence in the repo is a footgun. Recommend explicit `.gitignore` entry for `.env.production` to keep it that way.

## Performance Bottlenecks

### LOW — In-memory rate limiter (single-instance only)

- File: `apps/api/backend/src/routes/matcha.ts:98` — explicit `TODO: Wave 190+ migrate to DB`.
- The 3-hits / 5-min rate limit in `apps/web/lib/leads/persistLead.ts` (on `feat/lead-capture-wire`) is also in-process.
- Impact: doesn't survive restart; can be bypassed by an attacker who hits multiple instances.
- Fix: move to Redis or Prisma-backed counter when scaling beyond one instance.

### LOW — Single-file JSONL lead log (no rotation)

- File: `apps/web/lib/leads/persistLead.ts` (on `feat/lead-capture-wire`)
- Append-only single file at `~/.vitalcv-logs/leads.jsonl`. No rotation, no size cap.
- Fix: daily or size-based rotation when the surface goes live.

### Not detected: N+1 queries

A scan of `apps/api/backend/src/services/` did not find an obvious `for…loop + db.query()` anti-pattern. `apps/api/backend/src/services/audit/replayEngine.ts:346–387` loads artifacts in two batched passes (correct, not N+1).

## Fragile Areas

### MEDIUM — `apps/web/tsconfig.json` explicit `"types": ["node", "react", "react-dom"]`

- Per CLAUDE.md: this is required to avoid stale `@types/minimatch` resolution. Any unguarded tsconfig edit or dependency bump can re-activate the stale type.
- Fix: add a comment in `apps/web/tsconfig.json` explaining why the explicit list exists. The comment is the documentation; the test for it is "build passes".

### MEDIUM — `apps/web/next.config.mjs` strict build mode

- Lines 16–20 enforce TypeScript + ESLint checks on every `next build`. **No `ignoreDuringBuilds: true`** escape hatch.
- Impact (intentional): a typecheck failure on any branch breaks the deploy pipeline. Rapid-iteration cost is real but the truth contract is non-negotiable.

### MEDIUM — `@types/react` override in root `package.json`

- The root `package.json` carries a `pnpm.overrides` entry for `@types/react@^19` so Radix UI + React 19 don't fight. If the override slips (accidental bump to `@types/react@20`, or removal of the override), hundreds of files re-cast as `never`.
- Fix: pin in CI lockfile-check.

### MEDIUM — Replay chain depends on the four orphan imports

- File: `apps/api/backend/src/services/audit/replayEngine.ts`
- Same root cause as the CRITICAL tech-debt item above. Worth restating here because the fragility extends to anything that imports `replayEngine` (e.g. `apps/web/lib/replay/getReplayInspection.ts`).

## Scaling Limits

### LOW — No distributed-write locking on decision capsules

- No `uniqueConstraint` observed on the decision-capsule write path in `apps/api/backend/prisma/schema.prisma` covering `(subjectNpi, decisionTimestamp, verifierOrgId)`.
- Impact: two verifiers writing simultaneously could produce duplicate capsules.
- Fix: add a `@@unique` index in Prisma + a transactional pre-check.

### LOW — No trust-state cache

- `/api/trust-state/[npi]` recomputes on every call. Fine at current volume; would benefit from a TTL cache when employers hit it for bulk verification.

## Dependencies at Risk

### MEDIUM — React 19 + Next.js 15 + Radix UI

- All three are at recent majors. The `@types/react` override (above) is load-bearing.
- Next.js 15 App Router on Cloudflare Pages requires the `@cloudflare/next-on-pages` adapter — documented in `docs/ops/cloudflare-production-cutover-plan.md` (PR #376). Some App Router features ship later on the adapter than on Vercel.

### LOW — Vitest 4.x

- Active development. No hard pin. Watch for vitest 5 major-version API changes.

### LOW — `solc@0.8.20` + `hardhat@2.25.0`

- Blockchain tooling in `apps/api/` is on relatively recent majors. If contracts in `blockchain/contracts/` are upgraded, both packages need to move together.

## Missing Critical Features

### HIGH — No live production deployment

- `https://vitalcv.com` is HTTP 402. No production surface. Tracked in `docs/ops/vercel-exit-emergency-plan.md`.
- Until the Cloudflare cutover completes, every "production" claim in any wave brief is provisional.

### HIGH — Source integrations not fully wired to the public surface

- The backend (`apps/api/backend/src/services/`) carries real adapter implementations for NPPES / OIG / PECOS / state boards. The public web surface mostly proxies / previews; the live decision-grade pipeline is gated.

### HIGH — No email provider wired

- `apps/api/backend/src/services/providers/notificationProvider.ts:21` — `// TODO: wire SendGrid/Postmark`.
- Outbound transactional email is a no-op today. Operator notifications and clinician outreach depend on this.

## Test Coverage Gaps

### MEDIUM — Replay-engine logic untested directly

- File: `apps/api/backend/src/services/audit/replayEngine.ts` is ~870 lines of cryptographic integrity, tenant isolation, corruption containment, confidence calibration.
- No adjacent `replayEngine.test.ts` was found.
- Indirectly exercised by `auditReplay`-related route tests. Direct unit tests for `replayDecision()` and `buildAuditBundle()` would tighten the contract substantially — and become writable as soon as the four orphan imports are resolved.

### MEDIUM — 9 stale test suites (covered under Tech Debt above)

Covers billing, employer-review workflows, interview onboarding, pricing, public docs. Restoring them is the biggest single coverage win available.

---

## Summary table

| Severity | Issue | File(s) | Action |
|---|---|---|---|
| **CRITICAL** | `replayEngine.ts` 4 orphan imports | `apps/api/backend/src/services/audit/replayEngine.ts` lines 24, 31, 41, 45 | Restore / revert / stub modules |
| **HIGH** | Wallet-sdk stale re-export | `packages/wallet-sdk/src/index.ts` line 351 | Merge PR #375 |
| **HIGH** | Vitalcv.com offline | Vercel-side block | Complete Cloudflare cutover (PR #376) |
| **HIGH** | No live email provider | `apps/api/backend/src/services/providers/notificationProvider.ts` | Wire SendGrid / Postmark |
| **MEDIUM** | 9 stale test suites | `apps/web/vitest.config.ts` lines 11–21 | Restore target pages or rewrite |
| **MEDIUM** | Persistence TODOs in critical paths | matcha.ts:98, employerNotifications.ts:30, aal-guard-enhanced.ts:197 | Migrate to Prisma per surface |
| **MEDIUM** | Marketing brutalist refactor | `apps/web/components/marketing/*.tsx` | Align with trust-canon design wave |
| **MEDIUM** | `@types/react` override fragility | root `package.json` | Pin in CI lockfile check |
| **MEDIUM** | Replay-engine untested | `apps/api/backend/src/services/audit/replayEngine.ts` | Write direct unit tests once orphans resolved |
| **LOW** | 125 archived files | `apps/web/app/_archive/` | One-time cleanup wave |
| **LOW** | `/api/leads` directory perms | `apps/web/lib/leads/persistLead.ts` | `chmod 0o700` on init |
| **LOW** | Banned-strings gate not on main | PR #370 | Merge once Web Quality is unblocked |
| **LOW** | In-memory rate limiter | matcha.ts:98 + `apps/web/lib/leads/persistLead.ts` | Move to Redis / Prisma when scaling |
| **LOW** | Single-file JSONL lead log | `apps/web/lib/leads/persistLead.ts` | Add daily / size rotation |

## Immediate next actions (top three)

1. **Resolve the `replayEngine.ts` regression** — single most leveraged unblock; turns `Web Quality` green across the open-PR fleet.
2. **Merge PR #375 (wallet-sdk one-liner)** — completes the build-chain unblock.
3. **Complete the Cloudflare cutover** (PR #376) — restores a live production surface so subsequent waves can be QA'd against a public URL rather than a local tunnel.

---

*Concerns audit: 2026-05-18*
*Update as issues are resolved or newly discovered.*

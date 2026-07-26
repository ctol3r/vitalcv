# Package status — verified inventory

**Verified:** 2026-07-04 against `f7bdbe158` (Wave 0 re-baseline). Counts are TypeScript source files (`*.ts`/`*.tsx`, excluding `dist/`, `node_modules/`, `*.d.ts`).

## Phantom packages — do not depend on these

The god-mode research report flagged seven packages as "dist-only, verify before depending." Verification result: **they do not exist on `origin/main` at all** (likely observed in a stale worktree with build artifacts). No wave may list them as dependencies or build targets:

`audit-receipts` · `claims` · `vitalindex` · `rate-limiter` · `runtime-mode` · `idempotency` · `conflict-resolution`

If a future wave needs one of these capabilities, it is a **new package proposal**, not a revival.

## Real packages (28)

| Package | Source files | Notes |
|---|---|---|
| `domain-common` | 28 | Barrel for domain types; re-export with `type` keyword (`isolatedModules`) |
| `source-adapters` | 23 | |
| `domain-evidence` | 22 | |
| `trust-contract` | 20 | |
| `psv-adapters` | 16 | |
| `shared` | 11 | |
| `domain` | 10 | |
| `trust-state` | 10 | Ships from `dist/`; must be turbo-prebuilt before `apps/web` builds |
| `audit` | 8 | |
| `ingest` | 7 | |
| `psv` | 7 | |
| `truth-enforcement` | 7 | |
| `verifier-sdk` | 7 | |
| `domain-core` | 6 | |
| `poe-engine` | 6 | |
| `sdk` | 6 | |
| `domain-events` | 5 | |
| `haip-config` | 5 | HAIP posture config — keep intact per doctrine |
| `domain-provider` | 4 | |
| `crs` | 3 | Composite readiness score — Wave G surfaces this |
| `domain-authority` | 3 | |
| `embed-sdk` | 3 | |
| `issuer-sdk` | 3 | |
| `wallet-sdk` | 3 | |
| `domain-identity` | 2 | |
| `graph-core` | 2 | |
| `vc-formats-csdjwt` | 2 | SD-JWT formats — Wave E touches this |
| `command-registry` | 1 | |

Every package listed has real sources; none is a dist-only shell. Thin packages (1–3 files) are genuinely thin, not stubs pretending otherwise.

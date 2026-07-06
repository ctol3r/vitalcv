# VitalCV — Current-State Snapshot

**Date:** 2026-07-06
**Branch:** `wave/career-evidence-network-alignment`
**HEAD:** `ee50fbf2a` — `docs(ops): M0-4 worktree & branch inventory + safe prune` (2026-07-06)
**Task:** M0-1 (wave plan) — authoritative current-state snapshot.

> **Supersedes for planning purposes** all prior `FINAL_*`, `INSTITUTIONAL_*`, and `LIVE_*` audit documents. Where those disagree with this file, this file is the state of record as of 2026-07-06. This is a read-only snapshot; no code was modified to produce it.

VitalCV is the **Provider Career Evidence Network** (credential wallet/passport as the first wedge). Monorepo: pnpm + turbo, apps in `apps/`, shared code in `packages/`. React 19 + Next 15 App Router. Tests use vitest 4.x (web/packages) and jest (backend).

---

## 1. Per-app status

Evidence = counts of `route.ts`/`page.tsx` (Next apps) or `src/**/*.ts(x)` (service apps), plus presence of `package.json`.

| App | Kind | Evidence (files) | Status | Notes |
|---|---|---|---|---|
| `apps/web` | Next 15 App Router (primary) | 877 route/page files; 1,647 total .ts(x) | **GA** | The product. Public homepage, holder hub, verifier/employer surfaces, MATCHA, ops center. Deep route tree. |
| `apps/api/backend` | Express/Node service | 1,121 src files; 1,220 total | **GA** | Primary backend: PSV orchestrator, source adapters, identity, trust, mission-ops. Prod entry is `server.ts` (not `index.ts`). |
| `apps/marketing` | Next (separate) | 13 `page.tsx`, 27 route/page, 65 total | **Partial** | Standalone marketing site. **Do not** pull web changes into it (per doctrine). |
| `apps/admin-api` | Node service | 17 src files | **Partial** | Real routes but thin; 1 test. |
| `apps/mobile` | React Native | 14 src / 25 total | **Partial/frozen** | Do not modify in issuer waves. 3 tests. |
| `apps/issuer-api` | Node service | 16 src files | **Partial/stub** | Small surface; **0 tests**. Issuer/verifier/status APIs historically have zero callers (see enterprise task map). |
| `apps/authz` | Node service | 10 src / 16 total | **Stub-ish** | 4 tests. Shadow RBAC substrate. |
| `apps/verifier-api` | Node service | 8 src / 14 total | **Stub** | 1 test; low caller count. |
| `apps/status-api` | Node service | 2 src files | **Stub** | Skeleton. |
| `apps/router` | — | 0 .ts files, **no package.json** | **Empty/placeholder** | Directory only; not a live app. |
| `apps/sample-api` | — | 0 .ts files, **no package.json** | **Empty/placeholder** | Directory only. |
| `apps/docs` | — | 0 .ts files, **no package.json** | **Non-app** | Docs holder. |

Also present at `apps/` root: `lib/`, `README_OPENAPI.md`, `README_*`. `apps/router`, `apps/sample-api`, `apps/docs` carry no package.json and no source — treat as inert.

**Bottom line:** two real apps (`web`, `api/backend`) carry the product. `marketing`, `admin-api`, `mobile` are partial. The remaining service apps (`issuer-api`, `verifier-api`, `status-api`, `authz`) are stubs/skeletons with few or no callers.

---

## 2. Per-package status

Evidence = `src/**/*.ts(x)` count (or top-level fallback), `dist/` presence, and `main` field. Packages that ship from `dist/` must be turbo-built before `apps/web` builds (`@vitalcv/trust-state` is the classic gotcha).

| Package | src files | Ships from | Substance |
|---|---|---|---|
| `source-adapters` | 23 | src (`src/index.ts`) | **Substantive** — source connector layer. |
| `trust-contract` | 20 | src (`src/index.ts`) | **Substantive** — truth-contract types. |
| `psv-adapters` | 16 | `dist/` | **Substantive** — 4 tests. |
| `shared` | 11 | `dist/` | Substantive. |
| `domain` | 10 | `dist/` | Substantive. |
| `domain-evidence` | 10 | `dist/` | Substantive — evidence/graph/trust/timeline projection (Waves 220–228, 240). 4 tests. |
| `trust-state` | 10 | **`dist/`** | Substantive — **must be prebuilt** (`turbo run build --filter @vitalcv/web`). 3 tests. |
| `domain-core` | 6 | `dist/` | Substantive. |
| `poe-engine` | 6 | `dist/` | Substantive. |
| `sdk` | 6 | src (no dist) | Moderate. |
| `domain-events`, `domain-common`, `wallet-sdk`, `verifier-sdk` | 4–5 | dist | Moderate. `domain-common` is the type barrel (10 tests). |
| `audit`, `truth-enforcement`, `psv`, `ingest` | 7–8 | dist | Moderate. |
| `crs`, `domain-authority`, `embed-sdk`, `haip-config`, `issuer-sdk` | 3 | dist / src | Thin. |
| `graph-core` | 2 | src (no dist) | Thin. |
| `command-registry`, `domain-identity`, `domain-provider`, `vc-formats-csdjwt` | 1 | mixed | **Thin / compile-only.** |
| `audit-receipts`, `claims`, `conflict-resolution`, `idempotency`, `rate-limiter`, `runtime-mode`, `tracing`, `vitalindex` | 0 src | **dist only** | **Phantom / dist-only** — 7+ packages ship a `dist/` with no tracked `src/` in-tree. Per memory, treat as phantom. |

**Note:** `dist/`-only packages with 0 tracked src are compiled artifacts checked in; they build fine but have no auditable source here.

---

## 3. Feature-flag truth table

### Web (`apps/web/lib/features.ts`) — `NEXT_PUBLIC_FEATURE_*`, read client-side via `flag(key, default)`

| Flag | Default | Gates | State when off |
|---|---|---|---|
| `MATCHA_V2` (`NEXT_PUBLIC_FEATURE_MATCHA_V2`) | **off** | `/holder/matcha/*`, `/employer/candidates`, MATCHA home activity, employer dashboard MATCHA panel | Routes `notFound()`; MATCHA UI renders nothing. **NB:** memory records MATCHA GA'd default-ON via #535, but the tracked `features.ts` default is `false` — env must set it on in the running environment. |
| `WORKSPACES` | **on** | Multi-workspace persona system | n/a |
| `PREQUALIFY_FLOW_V2` | **on** | Prequalification flow | n/a |
| `EMPLOYER_PAGES` | **on** | Employer knowledge pages | Hidden |
| `EXPLORE_V2` | **on** | Explore surface | Falls back |
| `ASK_VITALCV`, `ASSESSMENTS`, `VERIFIER_PIPELINE`, `REFERRALS_V2`, `AMBASSADOR`, `INSTANT_OFFERS`, `MARKETPLACE_ANALYTICS`, `TRUST_ANCHORS`, `NPI_DID_BINDING`, `SD_JWT_ISSUER`, `OID4VC`, `PSV_ADAPTERS` | **off** | Various pilot/internal surfaces | Surfaces hidden / route not exposed |
| `NEXT_PUBLIC_FEATURE_MATCHA_BUYER_PAGES` | env | MATCHA buyer landing pages | Hidden |
| `NEXT_PUBLIC_DEMO_MODE`, `NEXT_PUBLIC_PILOT_MODE`, `NEXT_PUBLIC_ENTERPRISE_MODE`, `NEXT_PUBLIC_MIROFISH_ENABLED`, `NEXT_PUBLIC_CTA_VARIANT`, `NEXT_PUBLIC_DEBUG_PANEL` | env | Demo/pilot/enterprise presentation modes | Default presentation |

### Backend (`apps/api/backend`) — source-coverage / integration flags

| Flag | Default | Gates | Honest coverage when off |
|---|---|---|---|
| `REAL_NURSYS_ENABLED` | **false** (env.ts schema `.default(false)`) | Live Nursys nurse-license lookups | Nursys returns stub/UNKNOWN; no live nurse license verification. |
| `OIG_LEIE_ENABLED` | **on-by-default** (`!== 'false'`; PsvOrchestrator uses `=== 'true'`) | OIG exclusion-registry live check | When `'false'`: checker returns **UNCHECKED**, requires manual review (fails to gated, not fabricated). |
| `PECOS_ENABLED` | env-gated (`envFlag` in sourceCatalog) | PECOS Medicare enrollment | Source stub → UNKNOWN. |
| `STATE_BOARD_ENABLED` | env-gated; `liveCallAvailable: false` | State medical boards | **No live call exists even when on** — stub, `UNKNOWN`. |
| `FSMB_ENABLED` | **false** (`=== 'true'`) | FSMB claim mapping / authority contracts | FSMB path disabled; requires `FSMB_API_KEY`/`FSMB_API_URL`. |
| `MONITORING_ENABLED` | **false** (`=== 'true'`, "default false for safety") | Async monitoring scheduler | No-op scheduler; continuous monitoring off. |
| `ISSUER_PERSISTENCE_ENABLED` | env-gated | Issuer receipt persistence | In-memory / demo-only. |
| `DEA_LOOKUP_ENABLED`, `ACGME_ENABLED`, `HRSA_CONTEXT_ENABLED`, `INVESTIGATORS_ENABLED`, `ACADEMIC_TRUST_SCORE_ENABLED` | env-gated (default off) | Respective source/enrichment paths | Stub/UNKNOWN; source shows as gated, not checked. |

**Coverage honesty invariant:** sources are reported as `checked / gated / stale / unknown`; revoked fails closed. Disabling a source flag yields `UNCHECKED`/`UNKNOWN`, never a fabricated pass. Truth-contract banned strings still apply.

---

## 4. Test coverage snapshot

**Total test files** (`*.test.ts(x)` / `*.spec.ts(x)`, excluding node_modules/.next): **549**

| Area | Test files | Assessment |
|---|---|---|
| `apps/api/backend` | 314 | **Strongest coverage** — PSV, sources, identity, trust, credential materialization. |
| `apps/web` | 196 | **Strong** — copy/truth-contract guards, route-contract, issuer-verification transforms. |
| `apps/authz` | 4 | Thin. |
| `apps/mobile` | 3 | Thin. |
| `apps/verifier-api`, `apps/admin-api` | 1 each | **Effectively none.** |
| `apps/issuer-api`, `apps/marketing` | 0 | **None.** |
| Packages | ~29 total | Meaningful: `domain-common` (10), `domain-evidence` (4), `psv-adapters` (4), `trust-state` (3), `audit` (2). Most other packages: 0–1. |

**Caveat (from memory):** ~32 pre-existing vitest failures on `main` (2026-07-02); backend jest is **not** a CI PR gate. Coverage is concentrated in `web` + `api/backend`; stub service-apps and thin packages are largely untested.

---

## 5. Migrations state

Prisma migrations at `apps/api/backend/prisma/migrations/` — **19 migrations** (excluding `migration_lock.toml`).

- **Latest:** `20260706000000_start_activation_sidecar` (2026-07-06) — Start Activation Graph sidecar table `start_activations`, **no FK constraints** (`acceptanceId` is a string reference; safe to deploy without breaking existing relations).
- Prior: `20260513000001_add_prior_run_id_to_source_runs`, `20260513000000_add_run_id_to_source_runs`, `20260504000000_issuer_persistence_scaffold`.
- Timeline spans `20260315*` (intelligence/investigator/action-prediction engines) → `20260322*` (canonical schema S1–S5, truth engine, passkey ownership) → `20260418–0420*` (acceptance graph learning capsules, decision-capsule revocation) → `20260504/0513/0706`.
- **Orphan manual SQL: NONE.** No `manual_*.sql` and no stray `*.sql` outside `migrations/<name>/migration.sql`. Commit `18f39f754` (M0-6) resolved the orphan start-activation SQL into the proper migration.

Migrations auto-apply via Railway `preDeployCommand` (`migrate deploy`).

---

## 6. Recent feature work — the MATCHA stream

The last ~30 commits are dominated by the **MATCHA** intelligence-layer / Calm-Wave stream (2026-07-03 → 2026-07-05). MATCHA is the AI career-matching layer built on the existing engine (`MatchExplanation`, provenance-forward, no fabricated interview-probability or salary numbers per truth contract).

Chronological highlights (newest first):

- `2b6eda86a` (07-05) — **source-refresh events in the daily brief**.
- `5f87a3ed6` (07-04) — **public preview of the signed-in experience** at `/matcha/experience`.
- `b41bf776b` (07-04) — **daily brief + streak loop**; the Career Constellation "made yours" (personalized).
- `055487e25` (07-04) — **interactive Career Constellation** — travel your career through time (time-scrub, non-linear).
- `42908973a` (07-04) — **Calm Wave D56** — full public homepage + buyer pages.
- `20e2825d6` / `bb37cb337` (07-03) — **Calm Wave D56 redesign** — signed-in surfaces + public homepage (paper+ink+serif+mono `.mz` scoped layer).
- `6edae1a19` (07-03) — **employer discoverability** + Wave 9 polish.
- `16aae6172` (07-03) — **AI cover-letter generator** (real Claude call).
- `5d7e74550` / `22b4e947f` (07-03) — **employer candidate pool** + **clinician dashboard** (greeting, next actions, opportunity snapshot).
- `d26362b46` / `36b3a6bfd` (07-03) — **opportunity actions + honest livability**; **Personal/Professional/Place** match questions (BeginlyHealth reference model).
- `f43bbeb53` / `c73d984a6` (07-03) — **interactive Career Evidence Network graph** + MATCHA experience on the public homepage.
- `3ab03ffb6` (07-03) — honest web clinician surfaces for the MATCHA intelligence layer.

Earlier (pre-stream): `0dad066c0` domain-evidence projection stack (Waves 220–228, 240), `6f7209fef` Verified Clinician Career Packet (Wave 205).

Ops/hygiene on 2026-07-06 (HEAD three): `ee50fbf2a` worktree/branch inventory + prune, `18f39f754` orphan SQL resolution, `867b4811e` secret hygiene (untrack `.env.production`, gitleaks config).

---

## 7. Uncommitted working-tree state (work-in-flight)

`git status` shows **41 changed entries** — **17 modified**, ~23 untracked, 1 deleted. This is substantial in-flight state not yet on the branch tip.

**Modified core files (M):**
- Docs/config: `CLAUDE.md`, `DOCTRINE.md`, `MASTER_PROMPT.md`, `README.md`, `package.json`, `.claude/launch.json`.
- Product code: `apps/web/app/page.tsx` (homepage), `apps/web/app/holder/readiness/ReadinessSurface.tsx`, `apps/web/components/embeddable/TrustConsentModal.tsx`, `apps/web/components/layout/Navbar.tsx`, `apps/web/components/verifier/AuditProofViewer.tsx`.
- Worktree pointers (submodule-style `m`/`M`): `.claude/worktrees/*`, `.worktrees/*` — load-bearing worktree fleet, do not touch.
- Deleted: `.claude/scheduled_tasks.lock`.

**Untracked (??) — large new surfaces not yet committed:**
- App routes: `apps/web/app/admin/platform/` (Ops Center V1), `apps/web/app/api/admin/`, `apps/web/app/api/ops-engine/`, `apps/web/app/operations-engine/`, `apps/web/app/ops/engine/`, `apps/web/app/holder/applications/`, `apps/web/app/holder/opportunities/`.
- Components/libs: `apps/web/components/ops-engine/`, `apps/web/components/platform/`, `apps/web/lib/ops-engine/`, `apps/web/lib/platform/`, `apps/web/lib/readiness/`.
- Scripts: `scripts/check-public-claims.ts`, `scripts/deployment-integrity-check.ts` (the `check:claims`/integrity scripts — **not yet on main**, matches memory).
- Docs: `design-handoff/`, `docs/deployment/railway-migration.md`, `docs/launch/`, `docs/research/`, `docs/waves/`, `docs/archive/2026-H1/`, `docs/ops/sibling-repo-decisions-2026-07-06.md`, `docs/product/signed-in-clinician-qa.md`.
- Root artifacts: `VITALCV_MASTER_WAVE_PLAN_2026-07-06.md`, `VitalCV_Pitch_Deck_Enhanced.pptx`.

**Implication:** the entire **platform layer + ops-engine + Ops Center** surfaces and the public-claims/integrity scripts exist in the working tree but are **untracked** on this branch. They are real files on disk (and referenced in memory as landed on `main` via #458–#469) but appear here as uncommitted — verify against `origin/main` before assuming they are or aren't shipped. Do not diff against local `main` (stale per the worktree-fleet caveat); diff against `origin/main`.

---

## 8. Deployed-vs-local delta

- **Deployment target is Railway, not Vercel** (`docs/deployment/railway-migration.md`, last verified 2026-06-28). Zero `@vercel/*` packages in `pnpm-lock.yaml`; all Vercel couplings are soft (deploy-banner/observability env with fallbacks). Web runs as a standard Next Node server (`next start -p $PORT`); API + web both deploy via Railway. Migrations auto-apply via Railway `preDeployCommand`.
- **What cannot be verified from local without prod credentials:**
  - Which feature-flag env values are actually set in the running Railway environment (e.g. is `NEXT_PUBLIC_FEATURE_MATCHA_V2` on in prod? tracked default is `false`, memory says GA'd on).
  - Which source flags (`OIG_LEIE_ENABLED`, `PECOS_ENABLED`, `FSMB_ENABLED`, `REAL_NURSYS_ENABLED`, `MONITORING_ENABLED`) are enabled in prod and whether `FSMB_API_KEY`/`BACKEND_URL`/`RAILWAY_API_TOKEN` are wired.
  - Whether pending migrations have run against the prod DB (`migrate deploy` status).
  - Live route health / signed-in walkthroughs — Clerk CDN (`clerk.vitalcv.com`) bot-blocks automated browsers, so signed-in prod verification needs Chris or an allowlisted profile.
  - The health probe can read red immediately after a web deploy (in-memory snapshot vs throttled refresher) — a red probe is not proof of a broken deploy.

---

*Snapshot generated read-only via git/find/grep + file reads. Counts are point-in-time at HEAD `ee50fbf2a`, 2026-07-06.*

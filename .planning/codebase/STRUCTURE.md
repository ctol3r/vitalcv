# Codebase Structure

**Analysis Date:** 2026-05-18

## Directory Layout

```
vitalcv/
├── apps/
│   ├── web/                    # Next.js 15 App Router — primary frontend (port 3030)
│   │   ├── app/                # pages + layouts + api proxies
│   │   │   ├── api/            # reverse proxy to apps/api/backend
│   │   │   ├── trust/          # /trust doctrine page (separate from /trust-canon)
│   │   │   ├── passport/       # /passport/[id] readiness preview
│   │   │   ├── verify/         # /verify/[npi]
│   │   │   ├── receipt/        # /receipt/[receiptId]
│   │   │   ├── _archive/       # never-shipped legacy surfaces (preserved for reference)
│   │   │   └── …
│   │   ├── components/         # ~88 directories of React components
│   │   ├── lib/                # ~77 utility families (auth, trust, source-health, …)
│   │   ├── styles/             # Tailwind + scoped style files (e.g. trust.css)
│   │   ├── __tests__/          # vitest suites (flat) + source-health/ subdir
│   │   ├── tests/e2e/          # Playwright e2e (separate)
│   │   ├── next.config.mjs     # Sentry wrap, transpile workspace pkgs, security headers
│   │   ├── vitest.config.ts    # vitest config + STALE_TEST_FILES allowlist
│   │   ├── tsconfig.json       # path alias @/* → apps/web/.
│   │   └── package.json
│   ├── api/
│   │   ├── backend/            # Express + Prisma backend
│   │   │   ├── src/
│   │   │   │   ├── routes/     # 158 route files (employerActions.ts, …)
│   │   │   │   ├── services/   # 141 service files (entity/, audit/, billing/, …)
│   │   │   │   ├── middleware/ # 11 middleware (apiAuth, tenantGuard, rateLimiter, …)
│   │   │   │   ├── obs/        # logger.ts (structured JSON)
│   │   │   │   ├── utils/      # httpError, deterministic hashing, …
│   │   │   │   ├── app.ts      # Express bootstrap (~138 KB)
│   │   │   │   └── server.ts   # HTTP server entry
│   │   │   ├── prisma/
│   │   │   │   ├── schema.prisma    # primary persistence schema (~151 KB)
│   │   │   │   └── migrations/
│   │   │   └── package.json
│   │   └── package.json        # hardhat + ethereum tooling at this level
│   ├── marketing/              # separate Next.js marketing site
│   ├── issuer-api/             # credential-issuance endpoints
│   ├── verifier-api/           # external verification endpoints
│   ├── admin-api/              # admin operations
│   ├── authz/                  # authorization service
│   ├── status-api/             # system status / health checks
│   ├── sample-api/             # demo API for testing
│   ├── docs/                   # API documentation app
│   └── mobile/                 # React Native (inactive)
├── packages/
│   ├── trust-state/            # canonical source-coverage taxonomy + truth statuses
│   ├── shared/                 # general-purpose utilities
│   ├── domain-core/
│   ├── domain-common/
│   ├── domain-events/
│   ├── domain-authority/
│   ├── domain-identity/
│   ├── domain-provider/
│   ├── psv/                    # Primary Source Verification engine
│   ├── psv-adapters/           # NPPES / OIG / PECOS / state-board adapters
│   ├── poe-engine/             # proof-of-evidence computation
│   ├── issuer-sdk/             # external-issuer client SDK
│   ├── verifier-sdk/           # external-verifier client SDK
│   ├── wallet-sdk/             # credential wallet SDK (ships from dist/)
│   ├── embed-sdk/              # VitalCV.mount() widget
│   ├── ingest/                 # source data ingestion
│   ├── audit/                  # audit-trail recording
│   ├── haip-config/            # High-Assurance Issuer Profile config
│   ├── crs/                    # credential registry service
│   ├── command-registry/       # command-center registry
│   ├── graph-core/             # trust-graph core algorithms
│   ├── vc-formats-csdjwt/      # W3C VC + SD-JWT format support
│   ├── truth-enforcement/      # canonical truth enforcement
│   ├── source-adapters/        # external source adapters
│   └── sdk/                    # base SDK exports
├── services/                   # additional services (pnpm workspace)
├── blockchain/                 # contracts (solc 0.8.20), substrate pallets
├── core/                       # cross-cutting core libraries
├── compliance/                 # regulatory documentation
├── infra/                      # Infrastructure as Code (docker-compose, etc.)
├── k8s/                        # Kubernetes manifests
├── scripts/                    # build / deploy / runtime scripts
│   ├── runtime/                # canonical-runtime assertion + production-convergence verify
│   ├── migrations/             # DB migration runners
│   └── prisma-generate-locked.sh
├── docs/                       # architecture, ADRs, ops runbooks
├── .github/workflows/          # CI / CD workflows
├── .planning/                  # this folder (codebase map output)
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

## Directory Purposes

**`apps/`** — User-facing applications and HTTP service surfaces.
- `apps/web/` — primary Next.js 15 App Router. Hosts every clinician / employer / verifier / issuer / ops surface. API proxies to `apps/api/backend`.
- `apps/api/backend/` — Express server with Prisma. The only layer that owns the database.
- `apps/marketing/` — separate Next.js site. Per CLAUDE.md: "do not pull web changes into it".
- `apps/issuer-api/`, `apps/verifier-api/`, `apps/admin-api/` — specialised HTTP APIs for external parties.
- `apps/mobile/` — React Native client (inactive; CLAUDE.md: "do not modify in issuer waves").

**`packages/`** — Workspace packages, imported via `workspace:*` everywhere.
- The single source of truth for cross-app concepts. `packages/trust-state` is canonical; never duplicate its types in an app.
- `packages/wallet-sdk` ships from `dist/`; downstream consumers (apps/web, apps/issuer-api) require it to be prebuilt before their own build runs.

**`docs/`** — Architecture decisions, operational runbooks, doctrine, GTM, pilot specs. Notable subdirectories: `docs/adr/`, `docs/algorithms/`, `docs/audits/`, `docs/deployment/`, `docs/migrations/`, `docs/ops/`, `docs/plans/`, `docs/specs/`.

**`scripts/`** — Build and runtime tooling.
- `scripts/runtime/assert-canonical-runtime.ts` — invoked from every app's `dev` script; refuses to start if the env / port doesn't match the canonical contract.
- `scripts/prisma-generate-locked.sh` — invoked by backend / CI to generate the Prisma client deterministically.

**`.github/workflows/`** — CI workflows (`ci.yml`, `ci-preflight.yml`, `monorepo.yml`, `deploy-api.yml`, `deploy-demo.yml`, `openid-conformance.yml`, `a11y-gate.yml`, `source-health-probe.yml`).

**`blockchain/`, `core/`, `compliance/`, `infra/`, `k8s/`, `services/`** — Specialised infrastructure / integration surfaces. Most session work doesn't touch these.

## Key File Locations

**Entry points:**
- Web dev server: `apps/web/package.json` `dev` script → `scripts/runtime/assert-canonical-runtime.ts --role web --port 3030 -- pnpm exec next dev -p 3030`
- Backend server: `apps/api/backend/src/server.ts` → `apps/api/backend/src/app.ts` (Express bootstrap)
- Marketing: `apps/marketing/package.json`

**Configuration:**
- Root: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `.npmrc`
- Web: `apps/web/next.config.mjs`, `apps/web/tsconfig.json`, `apps/web/vitest.config.ts`, `apps/web/.eslintrc.cjs`
- Backend: `apps/api/backend/tsconfig.json`, `apps/api/backend/jest.config.js`, `apps/api/backend/src/config/env.ts`
- Deploy: `vercel.json`, `apps/web/vercel.json`, `apps/api/backend/vercel.json`, `railway.toml`, `.vercelignore`, `.railwayignore`

**Core logic:**
- Backend bootstrap: `apps/api/backend/src/app.ts`
- Canonical error class: `apps/api/backend/src/utils/httpError.ts`
- Structured logger: `apps/api/backend/src/obs/logger.ts`
- Tenant guard: `apps/api/backend/src/middleware/tenantGuard.ts`
- Auth: `apps/api/backend/src/middleware/apiAuth.ts`
- Web backend-URL resolver: `apps/web/lib/backend-url.ts`
- Canonical source-coverage taxonomy: `packages/trust-state/sourceCoverage.ts`
- Trust-state guard regex source: `apps/web/lib/trust/trust-container-view.ts`

**Persistence:**
- Schema: `apps/api/backend/prisma/schema.prisma` (~151 KB)
- Generated client: under `node_modules/.pnpm/@prisma+client@*/…` (re-generated by `scripts/prisma-generate-locked.sh`)
- Migrations: `apps/api/backend/prisma/migrations/`

**Testing:**
- Web vitest: `apps/web/vitest.config.ts` + `apps/web/__tests__/*.test.{ts,tsx}` (flat; ~355 files using `.test.ts(x)`)
- Web e2e: `apps/web/tests/e2e/` (Playwright)
- Backend Jest: `apps/api/backend/src/**/__tests__/*.test.ts` (co-located by feature) + `apps/api/backend/jest.config.js`
- Stale-test allowlist: `apps/web/vitest.config.ts` `STALE_TEST_FILES` array (9 entries)

**Documentation:**
- `CLAUDE.md` — operator-facing canonical doctrine (read first)
- `docs/ARCHITECTURE.md` — system overview
- `docs/ops/banned-strings-gate.md` — truth-contract enforcement plan
- `docs/ops/vercel-exit-emergency-plan.md` — production hosting migration plan (separate branch)
- `docs/ops/founder-demo-smoke-checklist.md` — 15-step pre-flight (separate branch)

## Naming Conventions

**Apps (kebab-case directories):**
- `apps/web/`, `apps/issuer-api/`, `apps/verifier-api/`, `apps/admin-api/`, `apps/marketing/`, `apps/mobile/`.

**Files in `apps/web/components/`:**
- **PascalCase** for single-component files: `AuditTimeline.tsx`, `AuthButton.tsx`, `LandingHero.tsx`.
- **kebab-case** for sub-directories: `clinician-profile/`, `employer-review/`, `source-health/`, `pilot-ops/`.

**Files in `apps/web/lib/`:**
- **kebab-case** consistently: `api.ts`, `backend-url.ts`, `credentialing-states.ts`, `employer-review-actions.ts`, plus directories like `source-health/`, `trust/`, `pilot-intake/`, `leads/`.

**Backend routes (`apps/api/backend/src/routes/`):**
- **camelCase** files: `employerActions.ts`, `employerNotifications.ts`, `auditDecision.ts`, `matcha.ts`.

**Backend services (`apps/api/backend/src/services/`):**
- **camelCase** files inside camelCase / kebab-case domain directories: `services/entity/employerReviewActions.ts`, `services/billing/stripeClient.ts`, `services/audit/replayEngine.ts`.

**Tests:**
- Dominant: `*.test.ts` and `*.test.tsx` (355 files).
- Rare: `*.spec.ts` (6 files).
- Web tests live in **flat** `apps/web/__tests__/`. The sole sub-directory is `apps/web/__tests__/source-health/`.
- Backend tests are **co-located** under each feature directory's `__tests__/`.

**App Router conventions** (`apps/web/app/`):
- Route segments: `page.tsx`, `layout.tsx`, `route.ts` (API).
- Dynamic segments: `[slug]/`, `[npi]/`, `[receiptId]/`, `[id]/`.
- Hidden segments: `_archive/` (the underscore prefix excludes it from routing).
- Route groups: `(group)/` — note: per current state, `(trust)` was renamed to `trust-canon` in PR #378 to avoid slug conflicts with existing pre-prefix routes.

**Path aliases** (`apps/web/tsconfig.json`):
- `@/*` → `apps/web/*`
- `@domain-common/*` → `packages/domain-common/*`
- Workspace packages imported as `@vitalcv/<package>`.

## Where to Add New Code

**New clinician-facing page** (e.g. `/clinician/my-certifications`):
1. `apps/web/app/clinician/my-certifications/page.tsx` — server-component page.
2. Optional client component: `apps/web/components/clinician/MyCertificationsPage.tsx` (PascalCase).
3. Shared utilities: `apps/web/lib/clinician-profile/myCertificationsState.ts`.
4. API proxy (if backend-backed): `apps/web/app/api/clinician/my-certifications/route.ts`.
5. Backend route: extend `apps/api/backend/src/routes/clinician.ts` or add a new route file + wire in `apps/api/backend/src/app.ts`.
6. Backend service: `apps/api/backend/src/services/clinician/myCertificationsService.ts`.
7. Prisma schema additions: `apps/api/backend/prisma/schema.prisma` + new migration.
8. Tests: `apps/web/__tests__/clinician-my-certifications.test.tsx` (web), `apps/api/backend/src/services/clinician/__tests__/myCertificationsService.test.ts` (backend).

**New employer-facing component** (no new route):
1. `apps/web/components/employer/<Name>.tsx`.
2. Optional state lib: `apps/web/lib/employers/<name>State.ts`.
3. Wire into the existing employer page that owns the surface.
4. Test: `apps/web/__tests__/<name>.test.tsx`.

**New backend service**:
1. `apps/api/backend/src/services/<domain>/<name>Service.ts`.
2. Expose via a new route file or extend the relevant existing route in `src/routes/`.
3. Register the route in `src/app.ts`.
4. Test: `apps/api/backend/src/services/<domain>/__tests__/<name>Service.test.ts`.

**New shared package**:
1. `packages/<package-name>/{src/index.ts, package.json, tsconfig.json}`.
2. `pnpm-workspace.yaml` already covers `packages/*` — no edit needed.
3. Consume via `import … from '@vitalcv/<package-name>'`.

**New trust-surface route** (e.g. extending the design canon):
- Mount under the **`apps/web/app/trust-canon/`** URL prefix to avoid colliding with existing `/passport`, `/verify`, `/receipt`, `/trust` segments. The route-group `(trust)` form will conflict with existing slug names on `origin/main`.

## Special Directories

**`apps/web/app/_archive/`** — Never-shipped legacy surfaces. 125 files across 6 archived wave folders. Excluded from Next.js routing by the leading underscore. **Per CLAUDE.md: do not modify.** Mentioned here only so a reader knows the directory exists; cleanup is a separate maintenance wave.

**`apps/web/__tests__/source-health/`** — Sub-directory for the source-health probe test suite. The only sub-directory inside the otherwise-flat web test tree.

**`scripts/runtime/`** — Runtime assertion + production-convergence verification.
- `scripts/runtime/assert-canonical-runtime.ts` — gates every dev server start.
- `scripts/runtime/verify-production-convergence.ts` — used for production-state validation.

**`.github/workflows/`** — Source of truth for every CI gate (build, lint, typecheck, test, OpenID conformance, a11y, source-health probe).

**`packages/wallet-sdk/dist/`** (generated) — Ships from `dist/`; downstream apps (`apps/web`, `apps/issuer-api`) require it prebuilt before their own build. CLAUDE.md documents the standard recipe: `pnpm turbo build --filter='@vitalcv/trust-state' --filter='@vitalcv/shared'` before `pnpm --filter @vitalcv/web build`.

---

*Structure analysis: 2026-05-18*
*Update when top-level layout changes (new app, new top-level package family, new workspace category).*

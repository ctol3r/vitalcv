# Railway Migration — Vercel → Railway as sole deployment target

**Status: RAILWAY IS CANONICAL.** Railway (project `inspiring-reflection`, environment `production`) is the declared production owner of `vitalcv.com` — services `vitalcv-web` (Next.js, built from `apps/web/Dockerfile`) and `delightful-essence` (backend API), plus Postgres. Every Vercel project on the VITALCV team is legacy: see `docs/deployment/vercel-legacy-inventory.md` for the per-project inventory and archive checklist. Deploy verification: `node scripts/deploy-smoke.mjs` runs on every deploy via `.github/workflows/release-verify.yml` (secretless, cache-busted) alongside the signed-in synthetic monitor.

Build-time environment contract for the web service (the 18c9311 incident): `docs/deployment/railway-web-build-env.md`.

_Last verified: 2026-07-16 (Wave 0.3 — production hardening)._

---

## 1. Hard-dependency check (explicit, per doctrine)

**There is NO production dependency that requires Vercel.**

- `pnpm-lock.yaml` contains **0** `@vercel/*` packages. No `@vercel/og`, `/kv`, `/blob`, `/analytics`, `/speed-insights`, no Edge-runtime-only APIs.
- The web app is a standard Next.js Node server. It already builds and runs via `next start -p $PORT` (verified: production server boots, `/api/health` → 200, `/operations-engine` → 200, `/ops/engine` → 307 to sign-in).
- All Vercel couplings in code are **soft** (deploy-banner / observability env vars with fallbacks) — see §3.

➡️ Migration is unblocked. No Vercel-only capability must be replaced.

## 2. Current Railway setup (already in place)

| Service | Config | Build | Start | Health |
|---|---|---|---|---|
| **api** (`@vitalcv/api`) | root `railway.toml` + `nixpacks.toml` + `apps/api/Dockerfile` | `pnpm turbo build` | `node …/server.js` (after `prisma migrate deploy`) | `/health` |
| **web** (`@vitalcv/web`) | `apps/web/railway.toml` + `apps/web/Dockerfile` | `pnpm turbo run build --filter @vitalcv/web` | `next start -p $PORT` | `/api/health` |

The web `Dockerfile` is multi-stage (deps → build → runtime), bakes `NEXT_PUBLIC_*` at build time, and exposes a `/api/health` HEALTHCHECK. `apps/web/railway.toml` is intentionally web-shaped (the root one is API-shaped and must not be inherited).

## 3. Vercel artifacts & soft couplings

### Config files to remove (legacy, main tree only — NOT the `.worktrees/**` or `.claude/worktrees/**` copies, which are load-bearing for other trees)
- `vercel.json` (root, `apps/web`, `apps/marketing`, `apps/api/backend`) — all trivial `{"framework":"nextjs"}`.
- `.vercelignore` (root)
- `.vercel/project.json` (root, `apps/web`, `apps/marketing`) — these link the repo to Vercel projects.
- `apps/web/.env.vercel.local` — pulled Vercel env snapshot.

### Soft code couplings to remap to Railway/GitHub env (none block deploy)
- `apps/web/lib/deployInfo.ts` — `VERCEL_ENV` / `VERCEL_URL` / `VERCEL_GIT_*` for the deploy banner. On Railway these are absent → banner shows `development`/`localhost`. Remap to `RAILWAY_GIT_COMMIT_SHA` / `RAILWAY_GIT_BRANCH` / `RAILWAY_ENVIRONMENT` (Railway injects these) and `VITALCV_ENV_LABEL`.
- `apps/web/lib/trust/passport-observability.ts` — same `VERCEL_*` set, null-safe. Remap likewise.
- `scripts/runtime/runtime-banner.ts` — already falls back to `VITALCV_ENV_LABEL` / `NODE_ENV`.
- `apps/api/backend/src/config/env.ts`, `app.ts`, `qa/runQaSuite.ts` — `VERCEL_URL` / `VERCEL` for git-sha + a QA skip; harmless on Railway (`VERCEL` unset).
- Tooling: `scripts/yc/publish.sh`, `scripts/env/check.mjs`, `scripts/deploy/lineage.mjs` — non-runtime.

### GitHub workflows referencing Vercel
- `deploy-demo.yml` (**removed** in the Vercel-deprecation PR), `monorepo.yml` (already Railway), `source-health-probe.yml` (comment updated). None performed the canonical deploy — the active Vercel deploy was the **Vercel GitHub App** (dashboard integration), which ran on PR #465. `deploy-api.yml` + `deploy-web.yml` are the Railway deploy/smoke-test workflows.

### Docs
- ~30 files under `docs/` mention Vercel — update opportunistically (low priority).

## 4. Required env (Railway) — the one real dependency for the ops-engine live console

The web `getBackendBase()` resolves `BACKEND_URL || NEXT_PUBLIC_API_BASE || …`. The Dockerfile bakes `NEXT_PUBLIC_API_BASE=http://localhost:4000` as the default build ARG, which would otherwise win server-side.

**On the Railway web service set:**
- `BACKEND_URL=https://api.vitalcv.com` (server-side, runtime — **takes precedence**; this is what makes `/ops/engine` read the real roster/ledger). _Verified locally: with `BACKEND_URL` set, `/api/health` reports `backend.url: https://api.vitalcv.com`._
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY` (auth)
- Build ARG `NEXT_PUBLIC_API_BASE=https://api.vitalcv.com` (so the client bundle also targets prod), or rely on `BACKEND_URL` for server reads.
- `VITALCV_ENV_LABEL=production`

**On the Railway api service:** `DATABASE_URL`, `SIGNING_KEY_JWK`, `CORS_ORIGIN`, `API_KEYS` (already required today).

## 5. Steps to make Railway the sole target

**Owner actions (Vercel dashboard — cannot be done from the repo):**
1. Disconnect the Vercel Git integration for `vcv-web` / `vitalcv` / marketing projects (stops PR previews + prod deploys from Vercel). _This is what surfaced as "Account is blocked" on #465 — once disconnected, the failing Vercel checks disappear._
2. Point the `vitalcv.com` domain at the Railway web service (DNS / Railway custom domain).

**Repo actions (safe to PR):**
3. Remove the legacy Vercel config files in §3 (main tree only).
4. Remap the soft `VERCEL_*` env reads in `deployInfo.ts` + `passport-observability.ts` to Railway/GitHub equivalents (keep `VERCEL_*` as secondary fallbacks for safety).
5. Set the §4 env vars on the Railway services.
6. (Optional) add a CI job that builds `apps/web/Dockerfile` so Railway-compat is gated on every PR.

## 6. Verification checklist

- [x] No `@vercel/*` packages (lockfile: 0 matches)
- [x] `pnpm turbo run build --filter @vitalcv/web` green
- [x] Production server boots (`next start`) — `/api/health` 200, routes serve, auth gates (307)
- [x] `BACKEND_URL` correctly targets the real backend server-side
- [x] Railway web config present (`apps/web/Dockerfile` + `railway.toml`, `/api/health`)
- [ ] Vercel Git integration disconnected (owner)
- [ ] `vitalcv.com` pointed at Railway web service (owner)
- [ ] Railway web env (`BACKEND_URL`, Clerk) set (owner)
- [ ] Docker image build gated in CI (optional)

## 7. Impact on the W1400 ops-engine work (PR #465)

Nothing in the live Operations Engine depends on Vercel. `/ops/engine` reads the backend via `getBackendBase()`; on Railway with `BACKEND_URL` set it reads the real roster/ledger. The failed Vercel preview on #465 is **not a blocker** — verify the live authed path on the **Railway web deployment** (or a Railway PR environment) instead of a Vercel preview.

## 8. Full pipeline verification (2026-06-29)

End-to-end audit of the Railway deploy pipeline. ✅ verified · 🔧 fixed in this PR · ⚠️ flagged.

| Item | Result |
|---|---|
| `railway.toml` (API) | ✅ build `pnpm turbo build`, `prisma migrate deploy` (preDeploy), start `…/register-workspace-paths.js …/dist/apps/api/backend/src/server.js`, health `/health` |
| `nixpacks.toml` | ✅ forces Nixpacks builder (canonical API path); start matches railway.toml |
| `apps/web/Dockerfile` | ✅ already correct on main — `NEXT_PUBLIC_API_BASE` defaults to `https://api.vitalcv.com`, `CMD ["pnpm","start"]` (binds `0.0.0.0`), copies `.next`/`public`/`prisma`/`lib/generated` |
| `apps/api/Dockerfile` | 🔧 CMD pointed at `dist/server.js` (wrong — tsc `rootDir` is the monorepo root, real path is `dist/apps/api/backend/src/server.js`) and lacked `register-workspace-paths.js`; build used bare `pnpm --filter` (missed workspace dep dist). Fixed to mirror Nixpacks (turbo build + canonical start). |
| Build commands | ✅ turbo builds workspace `^build` deps |
| Start commands | ✅ API canonical entrypoint verified; web `pnpm start -H 0.0.0.0 -p $PORT` |
| Health checks | ✅ API `/health` exists (`app.ts`), web `/api/health` exists; both unauthenticated |
| Migrations | ✅ 51 Prisma migrations; `prisma migrate deploy` runs in `preDeployCommand` |
| Static assets | ✅ Dockerfile copies `public/` + `.next/` |
| Image optimization | ✅ `images.unoptimized: true` → no `sharp` / no Vercel image optimizer needed |
| Clerk auth | ✅ `middleware.ts` (clerkMiddleware). ⚠️ requires `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` as a **build arg** (else the client SDK has an empty key) + `CLERK_SECRET_KEY` at runtime — documented in `railway-env.md` |
| API connectivity | ✅ `getBackendBase()` + `lib/backend-url.ts` resolve to `https://api.vitalcv.com` in prod (🔧 `backend-url.ts` `VERCEL` gate → `RAILWAY_ENVIRONMENT` first) |
| Production logging | ✅ structured single-line JSON to `console`/stdout (`obs/logger.ts`) — Railway captures stdout/stderr |
| Env vars | 🔧 `railway-env.md` now splits **build-time** (`NEXT_PUBLIC_*`) vs **runtime**, and flags that the **web** service also needs `DATABASE_URL` (`worklistRepo` / `issuerPersistenceWriter` query the web Prisma client at runtime) |

⚠️ **Flagged (not fixed — business logic, out of scope for this infra PR):** `apps/api/backend/src/services/verifier/verifierValidation.ts` writes a "scrapbook" JSON to the local filesystem (`SCRAPBOOK_DIR`). Railway filesystems are **ephemeral** — these artifacts are lost on redeploy. The write is wrapped in try/catch (`/* non-fatal */`) and the audit ledger remains the system of record, so this is low-severity, but if those bundles must persist, move them to object storage. Tracked for a separate (non-infra) change.

# Infrastructure Scorecard — Railway production

> Scored 2026-06-29 from verified facts (Railway API/CLI + live endpoints + repo).
> Brutally honest. **Every dimension below 9 has a remediation task.** Overall is
> not "production-grade" yet — it is "functional production with real gaps."

| Dimension | Score | One-line verdict |
|---|---:|---|
| Build reproducibility | **7** | Frozen lockfile + pinned pnpm, but Node version split (web 22 / API 20) and dual builders |
| Deployment reliability | **6** | Health-gated + auto-restart, but **1 replica/service** → downtime on every deploy |
| Operational maturity | **6** | Health/restart/rollback exist; no staging, no alerting |
| Disaster recovery | **4** | **Weakest.** DB backups unverified, no tested restore, single region |
| Security | **7** | Secrets off git, CORS scoped, Clerk/ES256; no rotation policy, prod demo flags |
| Configuration hygiene | **6** | Configs in VCS, but dual builders, drift, tracked `.env.production` |
| Observability | **5** | Structured logs + metrics; Sentry **off** on web, no alerting/uptime |
| Scalability | **4** | Single replica, single region, no autoscaling, single DB |
| Technical debt | **6** | Dual build systems, orphaned marketing app, legacy Vercel fallbacks |

**Average ≈ 5.7 / 10.** Live and serving (`vitalcv.com` + `api.vitalcv.com` healthy on Railway), but redundancy, DR, and observability are below production-grade.

---

## Detail & evidence

### Build reproducibility — 7
✅ `pnpm install --frozen-lockfile`, `packageManager: pnpm@10.6.1`, turbo, web multi-stage Dockerfile (Node 22), `prisma generate` in build.
❌ Web image = Node 22, API Nixpacks = `nodejs_20` — **version skew**. Two builders (Dockerfile vs Nixpacks). `NEXT_PUBLIC_*` baked per-build → bundles are env-specific.
→ **REM-1**.

### Deployment reliability — 6
✅ Health-gated rollout (120s timeout), `ON_FAILURE` restart (max 5), smoke-test workflows, all services `SUCCESS`.
❌ **`numReplicas: 1` on web + API + DB.** No overlapping replicas, `drainingSeconds` unset → each deploy/crash has a brief outage window. No HA.
→ **REM-2** (shared with Scalability).

### Operational maturity — 6
✅ Healthchecks, restart policy, deployment history + rollback, runbooks (now written), CLI access.
❌ No `staging` environment (deploys go straight to prod). No alerting/on-call. (Web health false-"degraded" probe bug — **fixed in this PR**.)
→ **REM-3**.

### Disaster recovery — 4
✅ Rebuild-from-`main` reproducible; deploy rollback verified (`canRedeploy: true`).
❌ **DB backups not verified enabled.** No rehearsed restore. Single region/replica. No out-of-band secrets backup (losing signing keys invalidates receipts).
→ **REM-4** (highest priority).

### Security — 7
✅ Secrets in Railway env, **not git**; `.env.production` is a commented template; `.gitignore` solid; `CORS_ORIGIN` scoped (not `*`); Clerk auth; ES256 receipts; API auth middleware returns 401 on protected routes.
❌ No documented secret-rotation policy. `DEMO_MODE` / `YC_DEMO_MODE` / `SYSTEM_FROZEN` set on the **prod** API — confirm intended. No secrets backup. Single env = no blast-radius isolation.
→ **REM-5**.

### Configuration hygiene — 6
✅ `railway.toml`, `nixpacks.toml`, Dockerfiles, `railway-env.md` all in VCS.
❌ Dual builders; `apps/api/Dockerfile` was **wrong** (fixed) and is unused by Railway; `apps/api/backend/.env.production` tracked (should be `.example`); effective web config lives in the dashboard while `apps/web/railway.toml` is in repo (source-of-truth drift); ~30 docs still mention Vercel.
→ **REM-6**.

### Observability — 5
✅ Structured single-line JSON logs → stdout (Railway captures); API `/health` exposes request/latency metrics; healthchecks.
❌ **Sentry disabled on web** (`NEXT_PUBLIC_SENTRY_DSN` unset). No centralized log aggregation, no alerting, no uptime/synthetic monitoring.
→ **REM-7**.

### Scalability — 4
✅ Stateless web/API behind Railway routing; managed Postgres.
❌ 1 replica/service, single region (`us-west2`), no autoscaling, no DB read-replica/pooling strategy documented.
→ **REM-2** (shared with Deployment reliability).

### Technical debt — 6
✅ Vercel deprecated cleanly; legacy `VERCEL_*` kept only as fallbacks.
❌ Two build systems to maintain; `apps/marketing` has **no deploy target** after its `vercel.json` removal (orphaned); ~30 Vercel doc mentions remain; `.env.production` naming.
→ **REM-8**.

---

## Remediation tasks (all dimensions < 9)

| ID | Title | Closes | Priority |
|---|---|---|---|
| REM-1 | Unify Node version + reconcile build systems | Build reproducibility, Config hygiene | High |
| REM-2 | Multi-replica + HA (web/API ≥ 2; DB plan) | Deployment reliability, Scalability | High |
| REM-3 | Add `staging` env + alerting/on-call | Operational maturity | Medium |
| REM-4 | DR: verify DB backups, rehearse restore, secrets backup | Disaster recovery | **Critical** |
| REM-5 | Secret-rotation policy + audit prod demo flags | Security | High |
| REM-6 | Config single-source-of-truth + `.env.production.example` | Config hygiene | Medium |
| REM-7 | Enable Sentry (web) + alerting + uptime monitoring | Observability | High |
| REM-8 | Resolve orphaned `apps/marketing` deploy target + Vercel doc sweep | Technical debt | Medium |

A dimension reaches **9+** only after its remediation lands and is verified.

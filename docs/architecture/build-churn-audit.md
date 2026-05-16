# Build Churn Audit

**Wave 1 deliverable.** Identifies duplicate triggers, unnecessary CI
runs, and expensive build steps that drive ongoing cost. Each finding
includes a concrete cost-reduction action.

## §1 — Workflow inventory

Nine workflows on `origin/main`:

| Workflow | Trigger | Cost driver | Verdict |
|---|---|---|---|
| `ci.yml` | push to `main`, `feature/**`, `fix/**`, `wave/**`, `chore/**` + PR to `main` | Full lint + typecheck + test + build per push | HIGH — duplicates monorepo.yml on main |
| `monorepo.yml` | push to `main`, `develop` (wide path set) | Full Turbo build per push | HIGH — duplicates ci.yml on main |
| `ci-preflight.yml` | PR + push to `main`/`develop` (api/authz/verifier paths) | Backend test DB + build | MED — backend-only, scoped |
| `a11y-gate.yml` | PR to `main` (web UI paths) | Playwright a11y tests | MED — PR-gated, scoped |
| `openid-conformance.yml` | PR to `main`/`phase/**` (authz/verifier paths) | Docker conformance suite — heavy | LOW frequency / HIGH cost-per-run |
| `deploy-api.yml` | push to `main` (api/packages/railway.toml paths) | Railway deploy | NECESSARY |
| `deploy-demo.yml` | `workflow_dispatch` only | None unless triggered | LOW |
| `deploy-health-probe.yml` | push to `main` + `workflow_dispatch` | Single probe run | LOW |
| `source-health-probe.yml` | **cron `*/15 * * * *`** (every 15 min, forever) | 96 runs/day; ~35,000/year | **HIGH — top single-line cost driver** |

## §2 — Top cost drivers (ranked)

### Driver 1 — `source-health-probe.yml` cron at 15-minute interval

35,040 runs/year. Each run is a small probe but the GitHub Actions
minute count + outbound HTTP volume add up.

**Cost reduction options**:

| Option | Savings | Trade-off |
|---|---|---|
| A: Drop to hourly (`0 * * * *`) | 24x reduction (1,460 runs/year) | Probe freshness drops from 15min to 60min |
| B: Drop to every 4 hours | 96x reduction (~2,200 runs/year) | Probe freshness drops to 4h |
| C: Remove entirely; rely on synthetic probes from outside (e.g., UptimeRobot free tier) | ~100% savings | Operator must manage probe externally |
| D: Add a `paths-ignore` or feature-flag-gated kill switch | Variable | Operator controls runtime |

**Recommendation**: Option A (hourly) immediately; Option C long-term once the operator wires an external uptime monitor.

### Driver 2 — `ci.yml` and `monorepo.yml` overlap on `main`

When a commit lands on `main` touching `apps/web/**`, BOTH workflows run a full build. This is a 2x amplification.

**Cost reduction options**:

| Option | Savings | Trade-off |
|---|---|---|
| A: Remove `main` from `ci.yml` push trigger (keep PR trigger) | 1x build per PR-to-main merge | `main` post-merge still validated by `monorepo.yml` |
| B: Remove web-app paths from `monorepo.yml`; let `ci.yml` own the web | 1x build per push | Workflow ownership clearer |
| C: Consolidate into a single workflow with conditional jobs | Variable | Refactor effort |

**Recommendation**: Option B (`monorepo.yml` drops `apps/web/**` + `packages/**` paths; `ci.yml` owns web).

### Driver 3 — Wave/feature branch builds

`ci.yml` runs on every push to `feature/**`, `fix/**`, `wave/**`, `chore/**`. With ~10 wave branches per week, this is ~10–30 builds/week of feature branch noise that never lands.

**Cost reduction options**:

| Option | Savings | Trade-off |
|---|---|---|
| A: Restrict push trigger to `main` only; keep PR trigger | ~80% reduction in CI runs | Branch-level smoke tests delayed until PR |
| B: Add `[skip ci]` convention for WIP commits | Author-controlled | Requires discipline |
| C: Keep `wave/**` and `feature/**`, drop `chore/**` and `fix/**` | ~30% reduction | Less coverage on smaller branches |

**Recommendation**: Option A. PR-only triggering is the standard low-cost posture.

### Driver 4 — Turbo cache effectiveness

Turbo cache lookup uses `TURBO_TOKEN` + `TURBO_TEAM` (set in `monorepo.yml` env). If the token is unset or scoped wrong, EVERY build re-runs from scratch.

**Cost reduction options**:

| Option | Action |
|---|---|
| A: Verify Turbo cache is hitting | Check `monorepo.yml` build output for "FULL TURBO" or "X cached" lines |
| B: Move cache to Vercel/GitHub-side instead of Turbo's hosted service | Set up GitHub Actions cache for `node_modules/.cache/turbo` |

**Recommendation**: Verify A first. If cache is hitting, no action. If not, Option B.

### Driver 5 — `openid-conformance.yml` heavy single-run

Docker compose + conformance suite. Each run is expensive. Currently
triggers on PR to `main`/`phase/**` for narrow paths.

**Cost reduction options**: already well-scoped; no action recommended unless conformance becomes a regular CI bottleneck.

## §3 — Build-step cost analysis

Inside `ci.yml` `web-quality` job:

| Step | Cost | Reducible? |
|---|---|---|
| `pnpm install --frozen-lockfile` | ~30s | Cached via `cache: 'pnpm'` ✓ |
| `pnpm turbo build --filter='!@vitalcv/web'` (prebuild deps) | ~30s | Cached via Turbo ✓ |
| Lint web app | ~10s | Could be split into a fast job |
| `pnpm --filter @vitalcv/web typecheck` | ~20s | TS incremental builds help |
| Test suite (Vitest) | ~30s | Could be sharded; ROI unclear at current scale |
| `pnpm turbo build --filter=@vitalcv/web` (final next build) | ~120s | The expensive one |

**Recommendation**: no per-step changes; the workflow is already lean. The savings come from reducing run frequency (Drivers 1–3).

## §4 — Preview deployment assumptions

The codebase currently assumes Vercel preview deploys per branch. On
the survival branch (Cloudflare-target), there is no per-branch
preview by default. If the team relies on preview URLs for review,
the workflow needs adjustment.

| Item | Vercel default | Cloudflare Pages default |
|---|---|---|
| Per-branch preview URL | Auto (every PR) | Auto (every push) |
| Preview env vars | Separate scope (Production / Preview / Development) | Single scope; can override per-branch via wrangler |
| Cost per preview | Counts against Vercel build minutes | Counts against Cloudflare build minutes (Free: 500/month) |

**Recommendation**: on Cloudflare Pages free tier (500 build min/month at this writing), assuming a 2-min build, that's ~250 builds/month. Sufficient for ~8 builds/day. To stay safe:
- Restrict workflow triggers to PR + main (per Driver 3).
- Disable per-PR Cloudflare Preview if the team doesn't use them.

## §5 — Recommended changes (concrete diffs)

Each block below is a copy-pastable change ready for a small PR:

### 5.1 — Reduce source-health-probe to hourly

In `.github/workflows/source-health-probe.yml`:

```diff
 on:
   schedule:
-    # Every 15 minutes.
-    - cron: "*/15 * * * *"
+    # Hourly (was every 15 min; reduced for survival-mode cost).
+    - cron: "0 * * * *"
   workflow_dispatch:
```

24x cost reduction. Probe freshness drops from 15min to 60min.

### 5.2 — Eliminate ci.yml ↔ monorepo.yml duplication on `main`

In `.github/workflows/monorepo.yml` `on.push.paths`, remove these lines (move ownership of web/packages to `ci.yml`):

```diff
 on:
   push:
     branches: [main, develop]
     paths:
       - 'apps/api/**'
       - 'apps/authz/**'
       - 'apps/marketing/**'
-      - 'apps/web/**'
       - 'apps/verifier-api/**'
       - 'apps/issuer-api/**'
       - 'apps/admin-api/**'
       - 'apps/status-api/**'
-      - 'packages/**'
       - 'scripts/**'
       - 'package.json'
       - 'pnpm-lock.yaml'
       - 'pnpm-workspace.yaml'
       - 'turbo.json'
       - '.github/workflows/monorepo.yml'
```

After this change, `monorepo.yml` covers api / marketing / scripts / root config; `ci.yml` covers web. No path overlap, no 2x amplification.

### 5.3 — Restrict ci.yml to PR-only for branches

In `.github/workflows/ci.yml`:

```diff
 on:
   push:
-    branches: [main, 'feature/**', 'fix/**', 'wave/**', 'chore/**']
+    branches: [main]
     paths:
       - 'apps/web/**'
       - 'packages/**'
       - 'package.json'
       - 'pnpm-lock.yaml'
       - 'pnpm-workspace.yaml'
       - 'turbo.json'
       - '.github/workflows/ci.yml'
   pull_request:
     branches: [main]
     paths:
       - 'apps/web/**'
       - 'packages/**'
       - 'package.json'
       - 'pnpm-lock.yaml'
       - 'pnpm-workspace.yaml'
       - 'turbo.json'
       - '.github/workflows/ci.yml'
```

Feature/wave branches still run CI via the PR trigger. Direct pushes to feature branches don't trigger CI.

## §6 — Estimated total reduction

| Action | Estimated savings (% of current CI minutes) |
|---|---|
| Driver 1 (hourly probe) | 22% |
| Driver 2 (remove duplicate `main` builds) | 30% |
| Driver 3 (PR-only feature branches) | 30% |
| Combined | ~70% reduction in CI minutes |

GitHub Actions free tier: 2,000 minutes/month. Current usage likely exceeds. Post-survival-mode: should fit comfortably under free tier.

## §7 — What this audit does NOT recommend

- Removing `deploy-api.yml` or `deploy-health-probe.yml` (these are launch-critical).
- Disabling `openid-conformance.yml` (already PR-scoped; low frequency).
- Disabling `a11y-gate.yml` (PR-scoped; provides real safety value).
- Eliminating the test step (high-ROI safety net).

The cuts target FREQUENCY and DUPLICATION, not coverage.

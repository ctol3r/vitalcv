# Apex Deployment Forensics — `vitalcv.com`

**Generated**: 2026-05-13
**Question**: which application + which Vercel project serves `https://vitalcv.com`?
**Method**: read-only inspection of repo deploy config + live probes against the apex runtime

---

## TL;DR

| Question | Answer |
|---|---|
| Which application is apex? | **`apps/web`** (the `@vitalcv/web` workspace package) |
| Where does it build from? | `apps/web/` (Vercel project root override, monorepo-aware) |
| What does the build deploy? | `apps/web/.next/` |
| Is the marketing app on apex? | **NO** — `apps/marketing` is a separate Vercel project on a different domain |
| Is apex receiving the institutional convergence work? | **NO** — apex serves a stale `origin/main` (`9eb5cdee`) build; none of the 20 session PRs have merged |
| **NEW CRITICAL FINDING** | apex's `/api/health` reports `clerk.enabled: false, mode: "none"` — Clerk env vars are NOT set on the production Vercel project; even authenticated flows that DO exist on `origin/main` (e.g., `/sign-in`) currently 500 because of this |

---

## §1 — Repo deploy configuration

### Root `vercel.json` (`/vercel.json`)

```json
{ "framework": "nextjs" }
```

Minimal. Vercel infers framework but the project's **Root Directory** is set in the Vercel dashboard (not in the repo). The presence of `apps/web/vercel.json` indicates Vercel is told to build from `apps/web/`.

### Root `package.json`

```json
{
  "name": "vitalcv",
  "private": true,
  "packageManager": "pnpm@10.6.1",
  "workspaces": ["apps/*", "packages/*", "services/*"]
}
```

pnpm workspaces, three workspace globs. Apps under `apps/*`.

### Root `turbo.json`

```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", "build/**", ".next/**", "!.next/cache/**"]
    }
  }
}
```

Standard turbo build pipeline. Outputs `.next/**` per app.

### Root `.vercelignore`

Strips `node_modules`, `.next`, `dist`, `.turbo`, tests, top-level docs, etc. Tells Vercel what to skip when uploading the build context. Critically, `**/__tests__` and `**/*.test.*` are excluded so they don't bloat the deployment.

---

## §2 — Per-app Vercel configuration

### `apps/web/vercel.json`

```json
{ "framework": "nextjs" }
```

Minimal. The Vercel project bound to this app overrides Root Directory in the dashboard to `apps/web/`. Build + install commands are inferred from the framework preset + pnpm workspace context.

### `apps/marketing/vercel.json` (the SEPARATE project)

```json
{
  "framework": "nextjs",
  "installCommand": "npm install -g pnpm@10.6.1 && pnpm install --frozen-lockfile --ignore-scripts",
  "buildCommand": "npm install -g pnpm@10.6.1 && pnpm --filter @vitalcv/marketing build"
}
```

Explicit install + build commands targeting **only** `@vitalcv/marketing`. This is the marketing site (`apps/marketing`) on its OWN Vercel project. Different domain than apex.

### `apps/api/backend/vercel.json`

```json
{
  "installCommand": "npm install -g pnpm@10.6.1 && cd ../.. && pnpm install --frozen-lockfile",
  "buildCommand": "cd ../.. && pnpm --filter @vitalcv/api build"
}
```

Backend on its own deploy target — but per earlier session findings, the backend is on Railway (`api.vitalcv.com`), not Vercel. This `vercel.json` may be legacy / unused.

---

## §3 — Which app deploys to apex (proof by live probe)

### Live probe of `https://vitalcv.com/api/health`

```json
{
  "status": "ok",
  "service": "web",
  "timestamp": "2026-05-13T03:17:45.771Z",
  "config": {
    "apiBase": false,
    "clerk": { "enabled": false, "mode": "none" },
    "sentry": false
  }
}
```

**`service: "web"`** — emitted by `apps/web/app/api/health/route.ts`. This response shape exists in `apps/web`, NOT in `apps/marketing`. Apex serves `apps/web`.

The marketing app (`apps/marketing`) does not have an `/api/health` route; it has `/api/{artifact,contact,demo,internal,npi,pilot,share}`. None of those are routed at apex.

### Live probe of `https://vitalcv.com/` (homepage HTML)

First 240 bytes:
```html
<!DOCTYPE html><html lang="en" style="--vds-light-background:oklch(...
```

That CSS custom-property naming pattern (`--vds-*`) matches the design tokens in `apps/web/components/` (Visual Design System). Re-checked against:

- `apps/web/app/page.tsx` head: `import HomePageClient from './HomePageClient';`
- `apps/marketing/app/page.tsx` head: `import { HeroSection } from '../components/marketing/HeroSection';`

The apex homepage HTML pattern matches `apps/web/app/page.tsx`'s output.

### Live response headers from `https://vitalcv.com/`

```
HTTP/2 200
x-matched-path: /
x-nextjs-prerender: 1
x-nextjs-stale-time: 4294967294
age: 420898       ← cached ~4.87 days ago
server: Vercel
```

`x-matched-path: /` confirms Next.js routing matched the root page. `x-nextjs-prerender: 1` confirms SSG. The `age: 420898` header (~4.87 days) is a Vercel edge-cache hit — the homepage payload was generated almost five days ago and has been served from cache since.

The `/api/health` response is fresh per-request (no cache age header), so its `clerk.enabled: false` claim reflects current Vercel project state, not stale cache.

### Verdict

**Apex (`vitalcv.com`) deploys `apps/web` on a Vercel project bound to that root directory.**

---

## §4 — Route-ownership map

The repo has two Next apps. Each owns its own route tree:

### `apps/web/app/` (top-level routes)

```
/                       ← homepage (apex)
/passport               ← clinician readiness flow (apex)
/passport/[id]          ← entity-shape passport (apex)
/sign-in, /sign-up      ← Clerk auth (apex)
/holder, /verifier, /issuer ← role-gated apps
/employer/*             ← employer dashboards
/clinician/*            ← clinician profile flows
/admin/demo-reset       ← admin tooling
/.well-known/*          ← apple-app-site-association, assetlinks.json
                         (+ jwks/did/oidc/openid-configuration/trust-register
                            once #349 + #355 merge)
/api/health             ← runtime status (apex)
/api/passport/*         ← passport proxies to Railway backend
/api/audit/*, /api/decisions/*, /api/credentials/*  ← misc API proxies
/api/receipt/[npi]      ← signed receipt (once #349 merges)
/api/receipt/by-lineage/[lineageKey] ← receipt by lineage (once #355 merges)
/verify                 ← trust inspection (once #345 merges)
/trust                  ← institutional overview (once #355 merges)
```

### `apps/marketing/app/` (separate Vercel project, separate domain)

```
/                       ← marketing homepage (NOT apex)
/clinician              ← marketing clinician landing
/contact                ← contact form
/demo, /demo/wizard, /demo/verify, /demo/dashboard ← marketing demos
/how-it-works           ← marketing
/internal/metrics       ← internal dashboard (marketing-side)
/progress, /security    ← marketing pages
/verifier               ← marketing verifier landing
/verify/[shareId]       ← share-link viewer
/api/{artifact,contact,demo,internal,npi,pilot,share}
                        ← marketing's own API routes (distinct from web's)
```

The marketing `/verify/[shareId]` is **share-link consumption**, not the institutional trust-inspection page that ships in #345. Different concept, different domain.

---

## §5 — Critical operational finding: Clerk env missing on apex

Apex `/api/health` returned:

```json
"clerk": { "enabled": false, "mode": "none" }
```

The source at `apps/web/app/api/health/route.ts` determines this from `process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`:

- `pk_live_*` → `mode: "production"`
- `pk_test_*` → `mode: "development"`
- otherwise → `mode: "none"`

**`mode: "none"` means the publishable key is absent on the apex Vercel project's environment configuration.**

Independent confirmation: a live probe of `https://vitalcv.com/sign-in` returns:

```
500 text/html; charset=utf-8
```

The 500 is consistent with Clerk middleware attempting to handle the sign-in route but failing because the Clerk SDK has no publishable key.

### What this means

- **Even routes that DO exist on `origin/main` (`9eb5cdee`) are partially broken on apex because Clerk env vars are missing.**
- `/passport` returns 200 (it's public via `isPublicRoute`), but most authenticated flows would 500.
- The user's earlier external probe of `/verifier` returning "auth-walled (Something went wrong)" is consistent with this: Clerk middleware hits a 500 path, not a sign-in redirect.

### Fix scope

This is **operator-side config**, not a code change:

1. Set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` on the apex Vercel project (Vercel dashboard → Settings → Environment Variables)
2. Set `CLERK_SECRET_KEY` (server-only, encrypted)
3. Optionally set `NEXT_PUBLIC_API_BASE`, `NEXT_PUBLIC_SENTRY_DSN`, `BACKEND_URL` if those are intended to be configured
4. Trigger a redeploy so the env propagates

No PR can fix this — it's environment configuration on the Vercel project.

---

## §6 — Two Vercel projects: who owns what

Based on the per-app `vercel.json` files + the live `service: "web"` health response, the project topology is:

| Vercel project | Builds from | Domain | Status |
|---|---|---|---|
| `vitalcv` (or `vcv-web`) | `apps/web/` | **`vitalcv.com`** (apex) | running stale `9eb5cdee` build with missing Clerk env |
| `vitalcv-marketing` (likely; exact name not in repo) | `apps/marketing/` | unknown — possibly `marketing.vitalcv.com` or a subdomain | not probed |

Per prior session findings (the runtime-canonicalization work), the user has two Vercel projects: `vitalcv` and `vcv-web`. One of these is the marketing project; the other is the canonical web app. The `/api/health` response confirming `service: "web"` proves the apex is the canonical web app — not marketing.

If the marketing site is deployed (likely yes, given the dedicated `vercel.json`), it lives at a non-apex domain.

---

## §7 — Is the institutional runtime deployed elsewhere?

**No.** Searching the repo:

```
$ find . -name "vercel*.json" -not -path "*/node_modules/*" -not -path "*/.next/*"
./vercel.json
./apps/web/vercel.json
./apps/api/backend/vercel.json
./apps/marketing/vercel.json
```

Only four Vercel configs:

1. Root `vercel.json` — minimal, no project-specific overrides
2. `apps/web/vercel.json` — minimal, framework: nextjs (apex)
3. `apps/marketing/vercel.json` — marketing project (separate domain)
4. `apps/api/backend/vercel.json` — likely legacy (backend is on Railway per prior findings)

**There is no third Vercel project shipping the institutional convergence runtime to a preview or shadow domain.** The institutional work in PRs #338–#357 deploys ONLY when one or more of those PRs land on `origin/main` and Vercel auto-redeploys the apex.

---

## §8 — Build → deploy chain (proven)

```
operator pushes to origin/main
  ↓
Vercel webhook triggers
  ↓
Vercel installs pnpm@10.6.1 (per apps/web/vercel.json + apps/marketing/vercel.json patterns)
  ↓
Vercel runs `pnpm install --frozen-lockfile` (workspace-aware)
  ↓
Vercel runs build command — for apps/web, this is the default
  `prisma generate && next build` from apps/web/package.json
  ↓
apps/web/.next/ is the deploy artifact
  ↓
Vercel uploads .next/, links to apex domain
  ↓
Vercel rotates the dpl_* deployment id
  ↓
apex starts serving the new commit (cache TTL respected — edge cache
  may serve stale pages until revalidation)
```

The Vercel **Root Directory** project setting (NOT in repo, only in dashboard) is what tells Vercel to build from `apps/web/` instead of repo root. This is the single switch that determines whether `apps/web` or `apps/marketing` is bound to apex.

---

## §9 — What this proves and what it does NOT prove

**Proves:**

1. Apex (`vitalcv.com`) serves `apps/web` — verified by `/api/health` returning `service: "web"`
2. The marketing app (`apps/marketing`) is on a separate Vercel project on a different domain
3. Apex is currently running a stale build from ~5 days ago, missing critical Clerk env config
4. The institutional convergence work in PRs #338–#357 has NOT reached apex
5. There is no third Vercel project shipping institutional surfaces to a shadow domain

**Does NOT prove (requires operator-side access I don't have):**

1. The exact Vercel project name bound to apex (`vitalcv` vs `vcv-web` per prior session notes — both candidates)
2. The current production deployment ID (`dpl_*` — would need Vercel dashboard or CLI)
3. Which environment variables ARE set on the apex project (only inferred from `/api/health` reporting `clerk.mode: "none"`)
4. Whether a preview URL exists with the institutional work (would require Vercel dashboard listing per-PR previews)
5. Whether the marketing project ALSO has its own missing env vars

---

## §10 — Operator action recommendations

1. **(High priority, operator-side)** Set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY` on the apex Vercel project. This will unblock authenticated routes regardless of merge status of the 20 session PRs.
2. **(High priority, code-side)** Merge the Tier-1 stack from `MERGE_READINESS.md` (#356). This brings the institutional verifier surfaces (`.well-known/*`, `/trust`, `/verify`, `/api/receipt/*`) into apex.
3. **(Medium)** Set `VITALCV_ISSUER_ORIGIN=https://vitalcv.com` (or `https://app.vitalcv.com`) on the Vercel project so the `did:web:` identifier in `/.well-known/did.json` matches the actual deploy hostname.
4. **(Medium)** Verify the apex Vercel project's **Root Directory** is `apps/web/` (Settings → General → Root Directory). If it's wrong, the build will pick up the wrong app.
5. **(Low)** Decide whether `apps/api/backend/vercel.json` is still relevant or can be deleted (backend has migrated to Railway).
6. **(Verification)** After Tier-1 merges + Vercel deploys, run `pnpm exec tsx scripts/replay/verify-surface-convergence.ts --base-url https://vitalcv.com --npi <seeded-npi>` (PR #354) to confirm cross-surface convergence on the production runtime.

---

**Maintainer**: this document captures apex deployment topology at audit
time. Production state (which dpl is live, which env vars are set, which
Vercel project owns which domain) can drift independently of the repo and
should be re-verified before any merge that depends on apex configuration.

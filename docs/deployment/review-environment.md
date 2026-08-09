# The review environment

**Purpose:** give a branch a real URL a human can click, *before* it merges.

Established 2026-08-08, after the UX-V1 production cutover shipped on
screenshots plus a reviewer's localhost. The founder visual gate
(`docs/ops/FOUNDER_VISUAL_GATE.md`) already demanded rendered evidence; what it
could not offer was a place to *use* the change. This closes that.

## What it is

One **persistent** Railway environment named `review`, in the same project as
production, running the same `vitalcv-web` service. It has a stable URL, and it
always reflects **the last ref deployed to it** — it is a shared workbench, not
a per-PR preview.

Deploy to it with the **Deploy Review Environment** workflow
(`.github/workflows/deploy-review.yml`), which takes a ref and an optional PR
number:

```bash
gh workflow run deploy-review.yml -f ref=my-branch -f pr=1234
```

The workflow provisions the environment and its domain on first run, so there
is no manual dashboard setup. It is `workflow_dispatch` only — nothing deploys
here automatically, because a shared environment that changes under you while
you are reviewing is worse than no environment.

## What it deliberately is not

| | Decision | Why |
|---|---|---|
| Database | **None.** No `DATABASE_URL`. | Write paths (issuer requests, receipt candidates) degrade instead of reaching production records. A review deploy must not be able to write real data. |
| Backend | **Reads through to `https://api.vitalcv.com`.** | The real NPI entry is the homepage's hero interaction — a review where it doesn't resolve is a much weaker review. NPI lookup is a public read of NPPES, so the blast radius is a read. |
| Auth | **No `CLERK_SECRET_KEY`.** | Signed-in surfaces are out of scope for a visual review. The middleware already no-ops without it (`CLERK_MIDDLEWARE_ENABLED`). |
| Indexing | **Refused at three layers.** | See below. This is the one that would silently hurt if wrong. |
| Lifecycle | **Persistent, one at a time.** | Matches the one-wave-at-a-time design cadence, and keeps a stable URL the founder can bookmark. Cost is one small container. |

## Indexing is refused, three ways

A review deployment is a second copy of the public marketing site on another
hostname. Left alone it would be crawlable, and a duplicate of vitalcv.com in
search results is an SEO problem no test would have caught.

The single source of truth is
`apps/web/lib/deployment/canonicalProduction.ts` — a deployment is canonical
production only when it says so itself via `RAILWAY_ENVIRONMENT` (or the legacy
`VERCEL_ENV`). **Never `NODE_ENV`**, which the review build also sets to
`production`, and never a hostname, which a custom domain would defeat.

Off canonical production:

1. `robots.txt` serves a blanket `Disallow: /` (`app/robots.ts`).
2. Every response carries `X-Robots-Tag: noindex, nofollow` (`middleware.ts`,
   set at the one point every response passes through). This is the half
   crawlers actually obey — `robots.txt` does not remove an already-known URL.
3. `/sitemap.xml` returns empty (`app/sitemap.ts`), so the route inventory is
   not advertised from a host that should advertise nothing.

The deploy workflow **asserts 1 and 2 after every deploy** rather than trusting
them. Covered by `apps/web/__tests__/review-environment-noindex.test.ts`, which
also fails if any file re-implements the canonical-production comparison
instead of importing it — that rule had grown four copies before it was
extracted.

## Safety rails in the workflow

- The production environment ID is pinned and explicitly **refused** as a
  target. A workflow invoked by hand with an arbitrary ref is one typo away
  from being a production deploy.
- The resolved review domain is asserted **not** to be `vitalcv.com`.
- Deployment success is asserted from the SHA the site **reports** at
  `/api/version`, never from an HTTP 200 — a healthy old container answers 200
  while serving the previous build.

## Required setup, in order

### 1. The environment must contain the web service

**Observed 2026-08-09: it does not.** The `review` environment
(`a6b02b32-0cff-45f1-9f3b-d1dba0c7298f`) exists but is **completely empty** —
zero services. It was created with Railway's *Empty Environment* option rather
than *Duplicate Environment*.

This matters more than the credential. Every mutation this workflow performs
addresses a **(serviceId, environmentId) pair** — variables, domain and deploy
alike — so an environment the service does not live in fails all three, no
matter how well-scoped the token is.

Fix: recreate `review` by **duplicating `production`** (Railway → environment
dropdown → New Environment → *Duplicate Environment* → source `production`),
then delete the services a visual review does not need. Duplicating is what
gives the environment an instance of the pinned `vitalcv-web` service; adding a
fresh service from GitHub instead would mint a **new service id** and break the
pin.

> **Duplicating also copies production's VARIABLES**, including `DATABASE_URL`
> and `CLERK_SECRET_KEY`. Clear both on the review service afterwards. This is
> not advisory: the workflow upserts a handful of variables *without*
> `replace`, so anything inherited survives untouched, and a review deployment
> holding production's `DATABASE_URL` can write to real records. The preflight
> **refuses to deploy** while either is set.

### 2. One credential — **currently blocked by a GitHub fault, not by you**

> **Read this before setting the secret again.** As of 2026-08-09 this
> repository has an **open GitHub secret-propagation fault**: secrets created
> since 2026-08-08 do not reach Actions jobs *regardless of tab, name or
> scope*, and a support ticket is open. `RAILWAY_API_TOKEN` was already set
> once and read as the empty string in CI — it is listed in the evidence table
> in [`clerk-rotation-2026-08.md`](clerk-rotation-2026-08.md) alongside
> `CLERK_SECRET_KEY_PROD` and `DATABASE_URL`, all reading length 0.
>
> Confirm the state before repeating the attempt:
>
> ```bash
> gh workflow run secret-visibility-probe.yml
> ```
>
> `PROBE_CANARY` is a five-character control value. **Reads 5** → propagation
> works, and a missing secret really is missing. **Reads 0** → the fault is
> open, and setting this secret again cannot work. Measured 2026-08-09: **0**,
> while pre-fault secrets read 64 and 19 in the same job.
>
> Two production monitors (`Release verify`, `Synthetic Reconcile`) are red on
> main for this same reason. That is correct behaviour — they are refusing to
> claim they verified something they could not read — and it is not a
> regression from any recent change.

Once propagation is working, set the credential as below.

Why the existing `RAILWAY_TOKEN` cannot serve: `RAILWAY_TOKEN` is a Railway **project** token,
and project tokens are scoped to a **single environment** — this one to
`production`. Three runs established that, in order:

1. `environmentCreate` → `Not Authorized` (project tokens cannot create
   environments).
2. The environment was then created by hand. Next run: the listing returned
   *only* `production`, so the step tried to create `review` again and Railway
   answered **`An environment with that name already exists`**.
3. Exists **and** invisible is conclusive — the token is environment-scoped.

So creating the environment by hand is not sufficient on its own: a token that
cannot see `review` also cannot set its variables, create its domain, or deploy
to it.

**Set ONE of these repository secrets** (Settings → Secrets and variables →
**Actions** — the Actions tab, not Dependabot, and repository-level rather than
environment-level, since this workflow declares no `environment:`):

- **`RAILWAY_REVIEW_TOKEN` — recommended.** In Railway, open the `review`
  environment → Settings → Tokens → create a **project token for that
  environment**. It can do everything this workflow needs and *cannot reach
  production at all*, which is worth having on a workflow that takes an
  arbitrary ref by hand. It is the same kind of credential as the existing
  `RAILWAY_TOKEN`.
- **`RAILWAY_API_TOKEN`** — Railway → Account Settings → Tokens. Broader: it
  can reach every environment, and it can also create the environment itself.

The workflow prefers `RAILWAY_REVIEW_TOKEN`, then `RAILWAY_API_TOKEN`.
`RAILWAY_TOKEN` is deliberately **not** a fallback for review work — it cannot
see this environment, and allowing it through only moves the failure three
steps later.

Verify the secret actually landed before re-running:

```bash
gh secret list -R ctol3r/vitalcv --app actions | grep RAILWAY
```

## Preflight

The first step after checkout is a **preflight** that performs every read-only
check at once — credential, project readability, environment resolution,
service presence, existing domain and its `targetPort`, and both
production-refusal assertions — and reports **all** failures before exiting.
It mutates nothing.

It exists because the mutating steps each exit on their first error, so a
misconfiguration cost one run (and one human round-trip) per problem. The first
four real runs found four separate issues that way.

## Known-correct API shapes

These were verified against Railway's published API docs after the first runs,
not assumed. Two were wrong:

| Call | Requirement | Status |
| --- | --- | --- |
| `variableCollectionUpsert` | `projectId`, `environmentId`, `serviceId`, `variables` | was correct |
| `serviceInstanceDeployV2` | `serviceId`, `environmentId`, `commitSha` | was correct |
| `serviceDomainCreate` | `environmentId`, `serviceId`, **`targetPort`** | **was missing `targetPort`** |
| `variableCollectionUpsert` | `skipDeploys` | **was unset, causing a racing deploy** |

**`targetPort`** is required, and a domain pointed at the wrong port is
Railway's documented cause of *"service domain created via API returns 404"* —
a healthy container behind a URL that answers nothing. It is set from
`REVIEW_TARGET_PORT` (3000, matching `EXPOSE 3000` and
`next start -p ${PORT:-3000}`), and the same value is written as the `PORT`
variable so the app listens exactly where the domain routes. The preflight
fails if an existing domain's `targetPort` disagrees.

**`skipDeploys: true`** matters because the variable upsert would otherwise
trigger its own deploy of whatever ref the service last used, racing the
exact-SHA deploy two steps later — two builds, and a window where the review
URL serves the wrong commit.

Everything after environment resolution is **still unexercised by a real run** —
no invocation has got past it. The shapes above are verified against the docs
and the preflight logic is proven against fixtures, but only a successful run
proves the mutations themselves.

## Cost

One small always-on container in the Railway project. If it is idle for long
stretches, enable app-sleep on the `review` environment's service instance in
the Railway dashboard; the first request after a sleep pays a cold start.

To stop paying for it entirely, delete the `review` environment in Railway. The
workflow recreates it on the next run, so deleting it costs nothing but the
next deploy's provisioning time.

## Relationship to production verification

The review environment does **not** replace post-merge production verification.
The sequence for a visual wave is:

1. Deploy the branch to review → founder looks at a real URL → GO / REVISE.
2. Merge the exact reviewed SHA.
3. Deploy production, assert the production SHA, capture vitalcv.com itself.

Step 3 stays mandatory. Review proves the design; only production proves the
deploy.

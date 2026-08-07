# VitalCV Deploy Canonicality

**Last verified:** 2026-07-21 against live production and the GitHub deployments API.

> **This file was rewritten on 2026-07-21.** Every prior version described a
> Vercel project (`vcv-web`) as canonical. That has not been true since Vercel was
> deprecated, and the stale version was still being read as current — the
> 2026-07-21 deep audit's Wave 0 opens by warning "do not assume repository
> documentation is current," and this file was the documentation it meant.
> Verified facts only below; each carries how it was checked.

## Where vitalcv.com is served from

**Railway**, not Vercel.

| Fact | Value | How verified |
| :--- | :--- | :--- |
| Host | Railway | `server: railway-hikari`, `x-railway-edge: sjc1` response headers |
| Project / environment | `inspiring-reflection / production` | GitHub deployments API `environment` field |
| Web service | `vitalcv-web` → `vitalcv.com` | commit-status context `inspiring-reflection - vitalcv-web`, description `Success - vitalcv.com` |
| API service | `delightful-essence` → `api.vitalcv.com` | commit-status context `inspiring-reflection - delightful-essence`, description `Success - api.vitalcv.com` |
| Trigger | push to `main` → automatic Railway deploy | deployments recorded within ~60s of each squash-merge to `main` |

There is no manual deploy step. A merge to `main` **is** the release. The Vercel
project links still present in the tree are dead weight and serve nothing;
`docs/deployment/railway-migration.md` covers the migration itself.

## Reading the release state

```bash
# What Railway most recently deployed, newest first
gh api repos/ctol3r/vitalcv/deployments \
  --jq '.[0:5][] | "\(.created_at)  \(.sha[0:9])  \(.environment)"'

# Whether a given commit deployed green to both services
gh api repos/ctol3r/vitalcv/commits/<sha>/status \
  --jq '.state, (.statuses[] | "\(.context): \(.description)")'
```

`/api/status` returns live continuity state (issuer, replay, runtime, source
lanes) but **does not publish a build SHA**, so it cannot answer "which commit is
live." Use the deployments API above for that.

## Verifying the deployed homepage is current

The homepage is ISR with `revalidate = 300` (`apps/web/app/page.tsx`). The
deployed cache header is the cheapest proof that a given build is live:

```bash
curl -sI https://vitalcv.com/ | grep -i cache-control
# expect: cache-control: s-maxage=300, stale-while-revalidate=31535700
```

`s-maxage=300` is the signal. A fully-static Next page ships `s-maxage=31536000`
instead, so seeing `300` proves the ISR bound is deployed.

### The stale-cache trap (root cause of a false audit finding)

Before `revalidate = 300` landed, the homepage shipped `s-maxage=31536000`.
Railway's edge busts on deploy, but **external** caches do not — so a reader
behind one could be served a pre-deploy homepage for up to a year.

This is not hypothetical. The 2026-07-21 deep audit's headline P0 was "the
deployed homepage is materially behind `main`," listing the old hero, the old
five-step story, and duplicate navigation as live. Re-checked against production
the same day, none of it was: the homepage served `Get hired faster.`, the
NPI-first subhead, and the four-chapter rail (`data-rail-pinned`,
`data-rail-chapter`, `data-rail-skip`), byte-identical across cache-busted
requests. The audit was written against a stale cached copy.

**When a report says production is behind, verify before acting on it:**

```bash
curl -s "https://vitalcv.com/?bust=$(date +%s%N)" | grep -o "Get hired faster"
```

Compare a cache-busted body against a plain one. If they match, production is
canonical and the report is stale — do not redeploy or rebuild to "fix" it.

## Route checks on client-gated surfaces (ruling, 2026-08-07)

Raw-HTML grep proves only what the server renders. A client-gated surface
serves its loading skeleton in the raw body regardless of production state:
`/onboarding` SSRs "Checking your workspace…" because
`apps/web/app/get-ready/GetReadySurface.tsx` initializes `phase='checking'`
and resolves the anonymous entry state only client-side, after
`GET /api/me/workspaces` returns 401 — so a raw-HTML assertion on its
entry-state copy is unsatisfiable by design (PR #1090's shepherd hit exactly
this and had to fall back ad hoc). The rule: post-deploy route checks on
client-gated surfaces must assert against the hydrated DOM — Playwright
against production — with raw-HTML grep reserved for server-rendered content.
Finding the SSR skeleton in the raw body counts only as proof the new bundle
is deployed, never as proof of the surface's real state.

## What this file cannot verify from the repo

Domain→service mapping and environment variables live in Railway's dashboard, not
in the tree. In particular several features are code-complete but inert until
their Railway variables are set (`CLERK_JWT_VERIFICATION` enforce, Sentry DSNs,
`CLAIM_DIGEST_HMAC_SECRET`). Code presence is not proof those are on.

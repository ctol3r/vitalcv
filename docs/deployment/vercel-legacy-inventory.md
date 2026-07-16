# Vercel legacy inventory (Wave 0.3 — 2026-07-16)

**Railway is the canonical production owner of `vitalcv.com`** (verified:
`/api/version` reports `platform: railway` with a live Railway deploymentId).
Nothing user-facing is served from Vercel. The VITALCV Vercel team (slug
`blockchaincv`, `team_V9t533j9uGEbBpXN51y7ZRz8`) still contains eight projects,
inventoried read-only via the Vercel API on 2026-07-16:

| Project | Created | Assessment | Recommended action |
| --- | --- | --- | --- |
| `vitalcv` | 2026-02-09 | Original web deploy target, pre-Railway | Archive |
| `vcv-web` | 2026-02-09 | Early duplicate of the web app | Archive |
| `vitalcv-staging` | 2026-02-14 | Legacy staging; Railway has no linked staging env here | Archive |
| `vitalcv-marketing` | 2026-02-27 | `apps/marketing` deploys; separate app, not `vitalcv.com` | Keep ONLY if marketing still ships from Vercel; otherwise archive |
| `web` | 2026-03-19 | Generic-named duplicate | Archive |
| `workspace` | 2026-03-20 | Scratch project | Archive |
| `vitalcv-consolidation-2` | 2026-04-14 | Consolidation experiment | Archive |
| `vitalcv-omega4f-trigger` | 2026-04-23 | Worktree-fleet trigger project (matches the local `vitalcv-omega4f-trigger` worktree) | Archive after confirming no automation posts to it |

## Why these stay untouched by automation

Archiving/renaming/disconnecting projects changes account access surfaces —
that is a dashboard action for a human with owner rights. The checklist:

1. In each project: Settings → confirm **no production domain** is attached
   (especially `vitalcv.com` / `www.vitalcv.com` aliases) before archiving.
2. Check Git integration — disconnect the GitHub repo link so pushes stop
   creating preview deployments (stale previews are a search/cache-freshness
   liability tracked for Wave 2.4).
3. Archive the project (Settings → Advanced → Archive).
4. `vitalcv-marketing`: decide whether `apps/marketing` remains on Vercel; if
   yes, mark it NON-CANONICAL for `vitalcv.com` in its project description.

Known Vercel background noise this explains: the permanent "Account blocked"
Vercel PR checks on GitHub (memory: G6 wave) come from these stale
integrations — disconnecting the Git links in step 2 removes them.

## Canonical references

- Production owner: Railway — `docs/deployment/railway-migration.md`
- Web build-env contract: `docs/deployment/railway-web-build-env.md`
- Post-deploy verification: `scripts/deploy-smoke.mjs` +
  `.github/workflows/release-verify.yml`

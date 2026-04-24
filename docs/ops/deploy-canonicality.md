# VitalCV Deploy Canonicality

Last updated: Wave LIVE-100 audit.

## Canonical repo root
`/Users/christoler/vitalcv` (Git repo `vitalcv`). Monorepo via pnpm workspaces: `apps/*`, `packages/*`, `services/*`.

## Canonical app path
`apps/web` (`@vitalcv/web`). This is the **canonical public shell** for vitalcv.com:

* Homepage (`apps/web/app/page.tsx` → `HomePageClient` → `HeroWithAuthPrompt` → `LiveTrustConsole`) — NPI-first entry. User enters a 10-digit NPI and sees a source-backed readiness preview.
* Pilot CTA (`apps/web/app/pilot/page.tsx` + client `PilotRequestForm`) — posts to `apps/web/app/api/pilot-request/route.ts` and renders a structured confirmation inline.
* Clinician passport (`apps/web/app/passport/[id]/page.tsx`, 11.1 kB) — clinician profile/passport entry.
* Employer review (`apps/web/app/review/[entityId]/`) — reviewer surface; wires the TrustContainerPanel and proof panel.
* Evidence-bearing pilot page (`apps/web/app/p/[slug]/page.tsx`) — `/p/norcal-pa-pilot-1` is the only live proof-slug, carries explicit limitations.
* Apply flow (`apps/web/app/apply/[bundleId]/page.tsx`) — candidate apply entry.

## Vercel project / domain mapping
Two `.vercel` links exist in the tree; canonical mapping is resolved at root:

| Link location | projectId | projectName | buildCommand | Role |
| :--- | :--- | :--- | :--- | :--- |
| `./.vercel/project.json` | `prj_TFcurSwwzG2TCvR9INCVcZlGPiDZ` | **`vcv-web`** | `pnpm turbo run build --filter=@vitalcv/web` | **Canonical.** The root-linked Vercel project that serves the canonical app; monorepo-aware build command filters to `@vitalcv/web`. |
| `apps/web/.vercel/project.json` | `prj_ycAjB1G2LNw4lE2JZ6p6l7b9mi1o` | `web` | (nested) | Secondary / legacy link. Present but not used by the root `vercel deploy`. Carry-over from an earlier deploy path. |
| `apps/marketing/.vercel/project.json` | `prj_Rsi0LSCEbf9QUzVnxEz1uCqmvgXo` | `vitalcv-marketing` | (nested) | **Legacy / non-canonical.** `apps/marketing` has its own Next.js app and its own Vercel project. Recent commits (`fix(seam): close marketing→web gap`, `fix(web,marketing): complete-state canon launch blockers + P0 seams`) explicitly route wedge traffic back to `apps/web`. This project is kept link-present but not the source of truth for vitalcv.com. |

Domain mapping itself (`vitalcv.com → vcv-web`) lives in Vercel's DNS/domain settings and is **not** checked into the repo. Verification must come from the Vercel CLI / Vercel dashboard (`vercel domains ls`, `vercel inspect vitalcv.com`) or the Claude Browser agent hitting the domain.

## Deploy command (canonical)
```sh
# From repo root, with root .vercel/project.json in place:
pnpm install --frozen-lockfile
pnpm turbo run build --filter=@vitalcv/web
# OR, trigger via Vercel:
vercel deploy --prod            # uses root project.json → vcv-web
```

## Legacy status of apps/marketing
* Has its own Next.js app, Prisma client build, and Vercel project (`vitalcv-marketing`).
* Recent git log shows marketing → web seam closure (commits 1a5bb290, f1604599) — canonical wedge routing now lives in `apps/web`.
* **Not proven live on vitalcv.com from inside the repo.** This file assumes `apps/web` is the production mapping for vitalcv.com per the root Vercel link. Claude Browser must confirm.

## Build health (Wave LIVE-100)
* `pnpm exec tsc --noEmit` (apps/web) → exit 0.
* `pnpm exec next build` (apps/web) → succeeds.
  * Homepage `/` → dynamic (`ƒ`) with NPI search-param support.
  * `/pilot` → 2.48 kB.
  * `/p/norcal-pa-pilot-1` → prerendered (`●`).
  * `/passport/[id]` → 11.1 kB.
  * `/review/[entityId]` → 21.9 kB.
  * `/apply/[bundleId]` → 4.16 kB.
* `pnpm exec vitest run` → 85 suites / 408 tests pass.

## What this repo cannot self-verify
The following gates can only be confirmed by Claude Browser (or the Vercel CLI with credentials), not from inside this terminal session:

1. `https://vitalcv.com/` returns HTTP 200.
2. The response is served by the `vcv-web` Vercel project (not `vitalcv-marketing`).
3. The hero visible at vitalcv.com matches the current `apps/web/app/HomePageClient.tsx` output.
4. The NPI entry box on the homepage accepts input and routes to the readiness view.
5. `/pilot` CTA submit hits `/api/pilot-request` and renders the structured confirmation.
6. Mobile viewport (390×844, 414×896) lays out without horizontal overflow.
7. No stale `apps/marketing` content is shadowing the canonical hero.

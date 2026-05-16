# Runtime Convergence Report

Canonical runtime: `vcv-web`

Legacy / stale runtime: `vitalcv`

Release SHA: `7f7ace10`

## Canonical deployment SHA

- The intended canonical commit is `7f7ace10`.
- `main` is already advanced to that SHA.
- The app code and release tests are aligned to that commit.

## Canonical runtime identity

- The canonical runtime target is `vcv-web`.
- The repo’s canonical Vercel project binding points to `vcv-web`.
- The browser-facing production domain is not yet serving that runtime.

## Stale runtime indicators

- The live homepage still serves the older “Stop starting over. Start ready.” surface.
- Live requests to `/api/runtime-health`, `/`, `/passport`, and `/onboarding` return `DEPLOYMENT_DISABLED`.
- That behavior matches a stale or disabled deployment path, not the canonical productized runtime.

## Deployment disablement indicators

- Production responses are returning `Payment required`.
- Production responses include `DEPLOYMENT_DISABLED`.
- The live site is not exposing the updated activation/productization experience.

## Runtime-health verification

- The local runtime-health route is short, calm, and canonical-aware.
- It distinguishes `Canonical production`, `Canonical preview`, `Legacy stale`, and `Deployment unavailable`.
- The live site is not currently serving that route successfully.

## Homepage verification

- The intended homepage is the calm NPI-first activation surface.
- The live homepage is still showing an older marketing experience.
- That means the production domain is not attached to the canonical runtime.

## Passport verification

- The intended passport is the decisive readiness snapshot.
- The live passport route is not serving the canonical snapshot experience.
- The runtime blocker is before the passport layer, at deployment routing.

## Onboarding verification

- The intended onboarding surface is the continuation path.
- The live onboarding route is not serving the canonical continuation experience.
- The blocker is not onboarding logic; it is deployment convergence.

## Stale-runtime / aliasing diagnosis

- The production domain is still being treated as if it belongs to the older runtime path.
- The canonical `vcv-web` runtime is not yet the live authority on the domain.
- Preview / stale distinction is not being reflected on the public site.

## Exact blocker

- The production domain is still bound to a stale or disabled runtime path instead of the canonical `vcv-web` deployment.

## Exact affected runtime

- Affected live runtime: `vitalcv`
- Intended runtime not yet live on domain: `vcv-web`

## Exact next action required

- Reattach the production domain to the canonical `vcv-web` deployment, then redeploy `main@7f7ace10` and confirm the live site no longer returns `DEPLOYMENT_DISABLED`.

## Stop conditions

- Stop if the production domain still resolves to the old marketing surface.
- Stop if `/api/runtime-health` still returns `DEPLOYMENT_DISABLED`.
- Stop if the live deployment SHA does not match `7f7ace10`.


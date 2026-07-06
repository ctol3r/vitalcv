# Canonical Runtime Recovery

Use this when production is serving `DEPLOYMENT_DISABLED`, `Payment required`, or stale `vitalcv` surfaces.

Canonical runtime: `vcv-web`

Stale runtime: `vitalcv`

Production branch: `main`

Release SHA: `7f7ace10`

Domain attachment target: `vcv-web`

## 1. Recover the canonical deployment

1. Confirm the release SHA is `7f7ace10`.
2. Confirm `main` is the production branch.
3. Confirm the production domain is attached to `vcv-web`.
4. Confirm the stale `vitalcv` deployment is not authoritative.
5. Redeploy `main@7f7ace10` to the canonical runtime.

## 2. Verify the deployment

1. Open `/api/runtime-health`.
2. Confirm the summary says `Canonical production` or `Canonical preview` as appropriate.
3. Confirm the runtime-health response does not mention `DEPLOYMENT_DISABLED`.
4. Open `/`.
5. Confirm the homepage is the calm NPI-first activation surface.
6. Open `/passport`.
7. Confirm the passport answers the readiness question quickly.
8. Open `/onboarding`.
9. Confirm onboarding reads as continuation, not setup.

## 3. Stop conditions

- Stop if the production domain still serves the old `vitalcv` surface.
- Stop if `/api/runtime-health` still returns `DEPLOYMENT_DISABLED`.
- Stop if the deployed SHA is not `7f7ace10`.
- Stop if the domain is attached to the wrong Vercel project.

## 4. Rollback conditions

- Roll back if the canonical runtime cannot be attached cleanly.
- Roll back if the live domain begins serving the wrong project.
- Roll back if smoke tests fail after redeploy.
- Roll back if the runtime-health response becomes unreadable or ambiguous.

## 5. Smoke sequence

1. Check `/api/runtime-health`.
2. Check `/`.
3. Check `/passport`.
4. Check `/onboarding`.
5. Confirm all three surfaces agree on the activation story.
6. Confirm the live runtime is `vcv-web`.


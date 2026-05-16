# Post-Deploy Verification

Use this after every production deployment.

Canonical runtime: `vcv-web`

Legacy / stale runtime: `vitalcv`

Release SHA: `7f7ace10`

## 1. Canonical runtime verification

- Confirm the live runtime is `vcv-web`.
- Confirm the deployed SHA matches the release SHA.
- Confirm the deployment is on `main`.

## 2. Stale runtime detection

- Confirm the site does not serve stale `vitalcv` content.
- Confirm no old alias is being treated as production.
- Confirm the live site does not return `DEPLOYMENT_DISABLED`.

## 3. Runtime-health verification

- Open `/api/runtime-health`.
- Confirm the response is short and readable.
- Confirm the deployment classification is clear.
- Confirm the response distinguishes canonical, preview, stale, or unavailable.

## 4. Homepage verification

- Open `/`.
- Confirm the homepage is the calm identity entry surface.
- Confirm the NPI entry is prominent and low friction.
- Confirm the page feels like first-value, not setup.

## 5. Passport verification

- Open `/passport`.
- Confirm the top passport region answers:
  - ready
  - waiting
  - next action
- Confirm the above-the-fold read is decisive.
- Confirm the page does not feel dossier-heavy.

## 6. Onboarding verification

- Open `/onboarding`.
- Confirm the page reads as continuation.
- Confirm the loading path feels like the same motion.
- Confirm there is no workflow-software tone.

## 7. Deployment-disabled detection

- Stop if `/api/runtime-health` returns `DEPLOYMENT_DISABLED`.
- Stop if the homepage shows the older stale runtime surface.
- Stop if passport or onboarding does not match the canonical activation story.

## 8. Smoke-test routes

- `/`
- `/passport`
- `/onboarding`
- `/api/runtime-health`

## 9. Rollback stop conditions

- Roll back if the domain points to the wrong project.
- Roll back if the deployed SHA is not the intended release SHA.
- Roll back if runtime-health becomes ambiguous.
- Roll back if smoke routes do not agree with the canonical runtime.


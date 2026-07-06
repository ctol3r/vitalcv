# Deployment Convergence Checklist

Use this checklist for every release that is meant to reach the canonical VitalCV runtime.

Canonical Vercel runtime: `vcv-web`

Legacy / stale project: `vitalcv`

## 1. Canonical runtime verification

- Confirm the release commit is on `main`.
- Confirm the deployed commit matches the intended release SHA.
- Confirm the deployment is serving from `vcv-web`.
- Confirm no stale `vitalcv` deployment is being treated as canonical.

## 2. Domain verification

- Confirm the production domain resolves to the canonical runtime.
- Confirm there is no split-brain behavior between preview and production.
- Confirm any preview alias is labeled as preview, not production.

## 3. Deployment SHA verification

- Confirm the live deployment SHA matches the release SHA.
- Confirm the deployed SHA is the current `main` head when the release is intentional.
- Confirm the release SHA is documented in the handoff.

## 4. Stale-runtime checks

- Confirm no stale `vitalcv` deployment is being surfaced to users as live.
- Confirm old deployment aliases are not being treated as authoritative.
- Confirm the runtime-health response does not describe a stale deployment as canonical.

## 5. Runtime-health checks

- Confirm `/api/runtime-health` returns a readable deployment state.
- Confirm the runtime-health summary names canonical, preview, stale, or unavailable clearly.
- Confirm the runtime-health wording stays short and operational.

## 6. Homepage verification

- Confirm `/` opens as the calm identity entry surface.
- Confirm the first screen asks for NPI without extra friction.
- Confirm the homepage copy stays short, direct, and trustworthy.

## 7. Passport verification

- Confirm `/passport` answers the readiness question quickly.
- Confirm the top passport region shows posture, readiness, and next step first.
- Confirm the above-the-fold summary is decisive without extra explanation.

## 8. Onboarding continuity verification

- Confirm `/onboarding` reads as continuation, not setup.
- Confirm loading states feel like the same path, not a new process.
- Confirm the transition from homepage to passport to onboarding stays calm and continuous.

## 9. Post-deploy smoke tests

- Open `/` and confirm the homepage renders.
- Open `/passport` and confirm the passport surface renders.
- Open `/onboarding` and confirm the continuation surface renders.
- Call `/api/runtime-health` and confirm the deployment state is readable.
- Confirm the live site is not serving `DEPLOYMENT_DISABLED`.

## 10. Release stop conditions

- Stop if the live site returns `DEPLOYMENT_DISABLED`.
- Stop if the live deployment SHA does not match the intended release SHA.
- Stop if the canonical runtime is not `vcv-web`.
- Stop if the production domain is serving stale `vitalcv` content.
- Stop if runtime-health cannot distinguish canonical, preview, and stale state cleanly.

## 11. Pass criteria

- The canonical branch is `main`.
- The deployed SHA matches the intended release SHA.
- The live runtime is `vcv-web`.
- The runtime-health endpoint is readable and calm.
- The homepage, passport, and onboarding surfaces all agree on the activation story.


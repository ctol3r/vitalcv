# Public Relaunch Blockers

Current state:
- Static-first build passes.
- Public homepage and signup surfaces are launchable in their current form.
- Passport and onboarding still depend on the minimal dynamic runtime by design.
- Canonical production target remains `vcv-web`.

## What is ready

- `GET /` is static and serves the public NPI entry wedge.
- `GET /signup` is static and now reads as a calm account-creation surface.
- `GET /sign-up/[[...sign-up]]` is the Clerk signup path.
- `GET /passport` is the operational trust snapshot surface.
- `GET /onboarding` is the activation continuation surface.
- `GET /clinician/onboarding` is the clinician profile continuation surface.

## What still blocks a confident public relaunch

1. Live deployment verification is still the final gate.
   - The canonical runtime must be confirmed live on `vcv-web`.
   - The live domain must not serve the stale or disabled runtime path.

2. The launch wedge is only partially static.
   - `/passport` remains dynamic because it hydrates live trust state.
   - `/onboarding` remains dynamic because it continues the activation flow.
   - That is acceptable for launch, but it must be explicitly understood.

3. Mobile onboarding needs a final smoke pass.
   - The public wedge is usable on desktop.
   - A phone-width pass is still required before broad outreach.

4. Employer demo surfaces still need a quick verification pass.
   - `/pilot` should stay readable and honest.
   - `/review` and adjacent employer paths should be treated as decision surfaces, not marketing surfaces.

5. Public copy should stay compact.
   - The homepage now uses a single NPI entry path and lighter secondary CTAs.
   - Avoid adding any new explanatory sections before launch.

## Non-blockers

- Dynamic employer/operator pages outside the public wedge.
- Static-first Cloudflare build support.
- Runtime-health operator labels.
- Passport wording polish already applied.

## Launch stop condition

Do not announce relaunch until:

- `vcv-web` is live on the production domain.
- `/` loads cleanly.
- `/passport` loads cleanly.
- `/onboarding` loads cleanly.
- `signup` flow completes on a phone-width check.
- employer demo copy is readable in under 20 seconds.

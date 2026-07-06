# Live Signup Audit

Goal: confirm that a brand-new clinician can land on VitalCV, sign up, enter an NPI, see a passport, and continue onboarding without confusion.

## What works now

- The homepage gives a direct NPI-first entry point.
- The primary CTA moves the user into passport generation.
- The sign-up foundation page is a simple, legible Clerk entry point.
- The onboarding continuation page clearly routes back into the main path.
- The passport summary now presents a calm readiness signal instead of a dashboard-style explanation.

## Launch path

1. Land on `/`
2. Enter NPI
3. Reach `/passport?npi=...`
4. Continue to `/onboarding`
5. Continue into `/clinician/onboarding`
6. Return to passport when needed

## What is still dynamic

- Passport hydration
- Readiness scoring
- Clerk sign-up and session handling
- Employer review
- issuer-facing explanation and verification surfaces

## What can confuse a first-time clinician

- `/passport` is still live and dynamic, so slow source calls can delay the first reward moment.
- `/onboarding` is a continuation page, not the full profile editor.
- Some secondary homepage CTAs point to broader product areas, not the core signup wedge.
- The product still contains many legacy surfaces that are not part of the first user path.

## Mobile check

- The homepage input flow is responsive and stacked for narrow screens.
- The primary NPI form remains the main mobile action.
- Passport and onboarding still need live device verification before public relaunch.

## Public-launch verdict

The clinician signup path is understandable and coherent, but the public relaunch still depends on static cutover verification and live device smoke tests before it should be treated as fully ready.

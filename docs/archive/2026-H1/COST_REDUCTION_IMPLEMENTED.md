# Cost Reduction Implemented

This pass tightened the low-cost public wedge without changing the product architecture.

## Implemented

### Static-first rendering

Public routes now render statically where they are safe to do so:
- `/`
- `/signup`
- `/sign-up/[[...sign-up]]`
- `/pilot`
- `/contact`
- `/get-ready`
- `/clinician/onboarding`
- `/onboarding/success`

### Runtime work reduced

- The homepage remains static and only hydrates the NPI entry interaction.
- Public signup and pilot/demo pages no longer require server rendering.
- Clerk auth is skipped during static-first builds in the root layout.
- The shared backend base resolver now avoids localhost fallbacks in deployed runtimes.
- `/employer/worklist` stays dynamic by design so the DB-backed worklist does not contaminate the static wedge.

### Hydration kept only where needed

- `/passport` remains dynamic because it hydrates live trust state.
- `/onboarding` remains dynamic because it continues the activation flow.
- `/holder` remains dynamic because it depends on the signed-in workspace profile.

## Verified build result

The build now classifies the key launch surfaces as:
- static: homepage, signup, employer demo, contact, get-ready, clinician onboarding, onboarding success
- dynamic by design: passport, onboarding, holder, review, ops, authenticated workspaces

## Cost impact

- More of the public launch wedge can be cached and served cheaply.
- Less request-time work is required for the first visit.
- The remaining dynamic work is concentrated only where user state actually matters.

## Remaining cost work

- Keep public marketing and signup surfaces static unless a real request-time dependency appears.
- Avoid reintroducing server-side auth on the public wedge.
- Leave passport and onboarding dynamic until their live runtime needs are replaced with a cheaper boundary.

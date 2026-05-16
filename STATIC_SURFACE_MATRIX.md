# Static Surface Matrix

This matrix classifies the current VitalCV frontend by deployment behavior for a static-first cutover.

Legend:
- **Fully static now**: can ship as plain static HTML with no request-time data dependency.
- **Static with client hydration**: ships static shell, then hydrates client-side for interaction.
- **Minimally dynamic**: needs request-time data or auth, but should stay narrow.
- **Dangerous / high-risk runtime**: too coupled to backend, auth, or operator state for the launch cutover.

## Fully static now

These routes are already emitted as static output in the current build:

- `/`
- `/signup`
- `/sign-up/[[...sign-up]]`
- `/sign-in/[[...sign-in]]`
- `/robots.txt`
- `/sitemap.xml`
- `/manifest.webmanifest`
- `/icon.svg`
- `/twitter-image`
- `/opengraph-image`
- `/.well-known/openid-configuration`
- `/.well-known/openid-credential-issuer`

## Static with client hydration

These routes can stay cheap if we keep them as thin shells that hydrate on the client, or as pre-rendered SSG surfaces:

- `/p/[slug]`
- `/get-ready`
- `/privacy`
- `/terms`
- `/contact`
- `/support`
- `/pricing`
- `/docs`
- `/legal/cookies`
- `/legal/dpa`
- `/for/cvo`
- `/for/payer`
- `/for/staffing-exchange`
- `/clinician/onboarding`

## Minimally dynamic

These routes need request-time data but should remain narrow and launch-focused:

- `/onboarding`
- `/onboarding/fetching`
- `/onboarding/identity`
- `/onboarding/readiness`
- `/onboarding/success`
- `/passport`
- `/passport/[id]`
- `/review`
- `/review/request`
- `/review/[entityId]`
- `/employer/review/[applicationId]`
- `/verify`
- `/verify/guide`
- `/verify/[npi]`
- `/verify/receipt/[receiptId]`
- `/receipt/[receiptId]`
- `/dossier/[receiptId]`
- `/trust`
- `/trust/graph`
- `/trust/schema`
- `/trust/doctrine`
- `/ops`
- `/ops/survivability`
- `/investigate/[npi]`
- `/holder`
- `/holder/home`
- `/holder/readiness`
- `/pilot`
- `/analytics-foundation`
- `/account/recovery`

## Dangerous / high-risk runtime

These routes are too close to backend, auth, or operator flows to treat as part of the static launch wedge:

- `/admin/demo-reset`
- `/employer/dashboard`
- `/employer/worklist`
- any `/holder/*` or `/employer/*` surface that assumes logged-in state before the public launch is stable
- `/api/*` routes that power runtime mutation, ingestion, persistence, or operator tools
- archived routes under `/_archive/**`
- any route that still needs `localhost` assumptions or Vercel-only deployment semantics

## Cutover reading

For launch, the only truly cheap public path is:

- homepage
- signup entry
- onboarding continuation shell
- trust explanation pages
- legal/support/docs pages

Everything else should either:

- remain minimally dynamic, or
- stay out of the static cutover until the backend cost and reliability story is proven.

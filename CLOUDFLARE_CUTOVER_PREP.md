# Cloudflare Cutover Prep

This is the deployment preparation set for a static-first cutover.

## Assumptions

- Web runtime: `vcv-web`
- Static host: Cloudflare Pages
- Pages project root: `apps/web`
- Build command: `pnpm --dir apps/web build:cloudflare`
- Pages output: `.vercel/output/static`
- Runtime compatibility: `nodejs_compat`
- API origin: `https://api.vitalcv.com`

## Static-first compatibility rules

- The homepage must not depend on server-side auth reads.
- Public marketing and onboarding shells should render without request-time backend calls.
- Passport and review flows may remain minimally dynamic.
- Any production deployment should assume the browser can hydrate from a static shell.

## Cutover checklist

1. Verify the static surfaces render from the Pages build output.
2. Verify Clerk sign-up pages still hydrate correctly.
3. Verify the homepage, onboarding, and signup surfaces do not require Vercel.
4. Verify dynamic routes still resolve their backend origin explicitly.
5. Verify no deployed code falls back to `localhost`.
6. Verify the deploy target is Cloudflare Pages and not a stale Vercel runtime.
7. Verify the public domain and preview URL agree on canonical behavior.

## Stop conditions

Do not cut over if:

- the homepage throws on static render
- Clerk hydration breaks
- passport or onboarding lose the next-step path
- any public page still relies on a hidden localhost default
- the static build cannot complete cleanly

## What “ready” means

The cutover is ready when the public shell is cheap to serve, the dynamic boundary is small, and the user still gets a believable activation path without infrastructure explanation.

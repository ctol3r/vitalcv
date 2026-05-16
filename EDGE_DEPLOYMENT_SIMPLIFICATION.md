# Edge Deployment Simplification

Goal: make the relaunch deployable on Cloudflare with the smallest practical runtime surface.

## 1. SSR minimized

The public wedge now avoids request-time rendering where it is safe to do so.

Static-safe routes:
- `/`
- `/signup`
- `/sign-up/[[...sign-up]]`
- `/pilot`
- `/contact`
- `/get-ready`
- `/clinician/onboarding`
- `/onboarding/success`

Routes that remain dynamic by design:
- `/passport`
- `/onboarding`
- `/holder`
- employer review and operator surfaces

## 2. More routes are static-safe

The public relaunch surface now uses static rendering for:
- homepage conversion
- signup
- employer demo
- contact intake
- get-ready entry
- clinician onboarding
- onboarding success handoff

That keeps the highest-traffic marketing and entry routes cheap to serve.

## 3. Runtime assumptions reduced

Removed from the edge-facing launch wedge:
- localhost fallback for deployed backend resolution
- unnecessary global command palette on static-first builds
- unnecessary toaster mount on static-first builds
- motion dependency from the onboarding loading step

## 4. Vercel coupling reduced

The shared deployment resolver now treats Cloudflare Pages or production mode as the deployed path and no longer depends on Vercel environment fields for its primary backend decision.

Runtime-health output now reports deployment state in generic edge terms instead of Vercel-specific labels.

## 5. Build output simplified

The production build now makes the static/dynamic split explicit and reproducible.

Observed static output:
- `/`
- `/signup`
- `/sign-up/[[...sign-up]]`
- `/pilot`
- `/contact`
- `/get-ready`
- `/clinician/onboarding`
- `/onboarding/success`

## 6. Cloudflare edge fit

The app is now better aligned to Cloudflare edge deployment because:
- the public wedge is static-first
- the backend base resolves to the survival API endpoint in production-like deployments
- the remaining dynamic routes are the ones that truly need live state

## Current stop condition

Do not widen the deployment surface further until the live domain is confirmed on the canonical `vcv-web` runtime and the public wedge smoke tests pass.

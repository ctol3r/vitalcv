# Survival Deployment Architecture

VitalCV is being compressed into a launchable, low-cost deployment model.

## Deployment target

- Canonical web runtime: `vcv-web`
- Static host: Cloudflare Pages
- Cloudflare Pages project root: `apps/web`
- Backend origin: Railway API at `https://api.vitalcv.com`
- Auth: Clerk
- Cloudflare build command: `npx @cloudflare/next-on-pages@1`

## What stays static

These surfaces should ship as static-first or mostly static pages:

- Homepage: `/`
- Signup foundation: `/signup`, `/sign-up`
- Onboarding guidance: `/onboarding`, `/clinician/onboarding`
- Informational trust pages: `/trust`, `/trust/schema`, `/trust/doctrine`
- Legal pages: `/legal/*`
- Public docs and support copy

Static-first means the page should render without waiting on live backend work to explain the product.

## What stays dynamic

These surfaces still need live requests:

- Passport generation: `/passport`, `/passport/[id]`
- Employer review: `/review/*`, `/employer/review/*`
- Issuer explanation and verification surfaces
- Clerk sign-in/sign-up callbacks
- Backend proxy routes that fetch source-backed data

## What can be mocked temporarily

These can be kept lightweight or simulated while the platform launches:

- Analytics and funnel reports
- Internal dashboards
- Graph visualizations
- Bulk export and replay inspection paths
- Non-essential demo surfaces
- Long-tail operator pages that do not unlock the clinician or employer journey

## What can be deferred

- Enterprise-scale reporting
- Multi-tenant admin tooling beyond the launch wedge
- Deep replay archaeology
- Secondary visualization systems
- Optional source integrations that are not required for the first launch

## What can be removed entirely

- Vercel-only deployment assumptions
- localhost fallback assumptions in deployed config
- Duplicate runtime narratives
- Prototype-style dashboard energy on public pages
- Anything that makes the user ask which runtime is canonical

## Static-first launch rule

The launchable product must work when the public shell is served from Cloudflare Pages and the live data path is routed to the API origin.

If a feature needs the backend to explain the product, it is not launch-critical. It belongs in dynamic surfaces or should be deferred.

# Cost Survival Audit

This audit is about keeping VitalCV financially survivable while it launches.

## Main cost risks

- Vercel hosting for the primary web runtime
- Unnecessary preview deployments
- SSR for pages that do not need it
- Duplicate public surfaces that say the same thing
- Long-lived runtime assumptions that require extra orchestration
- Heavy internal dashboards on the public launch path

## Cost containment strategy

### 1. Move the web shell to Cloudflare Pages

The public web experience should be served from Cloudflare Pages instead of Vercel.

That gives:

- cheaper static delivery
- lower baseline hosting cost
- simpler operational footprint
- a better fit for the public marketing and activation surfaces

### 2. Keep the API focused

The API should stay on the leanest viable origin.

Only keep backend work that unlocks:

- clinician signup
- passport generation
- employer review
- issuer explanation

### 3. Avoid expensive runtime work unless it earns revenue

Do not keep paying for:

- page-level SSR when static markup is enough
- preview-only behavior that does not help launch
- dashboard surfaces that do not help conversion
- image or asset processing that adds cost without changing trust

### 4. Prefer one canonical path

Every extra deployment path adds hidden cost:

- more support burden
- more drift risk
- more failed assumptions

One canonical runtime is cheaper to operate than three almost-right ones.

## What should be static by default

- Homepage
- Sign-up entry
- Onboarding guidance
- Legal and trust explanation pages
- Docs and support pages

## What should remain dynamic

- Passport hydration
- Employer review decisions
- Issuer explanation surfaces
- Authenticated account flows
- API endpoints that actually change state

## What should be deferred

- Enterprise analytics
- Deep system-health dashboards
- Multi-tenant expansion
- Experimental graph views
- Secondary workflow surfaces

## Budget guardrails

- No new infrastructure unless it directly unlocks launch
- No new preview-only tools unless they replace a more expensive path
- No dynamic rendering unless a static shell cannot do the job
- No duplicate public pages

If a feature does not help a clinician sign up or an employer make a decision, it is not a survival priority.

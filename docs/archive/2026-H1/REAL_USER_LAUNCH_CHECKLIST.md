# Real User Launch Checklist

VitalCV is launchable when the following are true.

## Before inviting clinicians

- [ ] The homepage loads from the canonical `vcv-web` deployment.
- [ ] The homepage clearly explains the value in one pass.
- [ ] The sign-up path works end-to-end.
- [ ] A clinician can enter an NPI and reach a passport.
- [ ] The passport gives a calm, readable trust snapshot.
- [ ] No `localhost`, `DEPLOYMENT_DISABLED`, or payment-gated runtime text appears.

## Before sending employer demos

- [ ] `/passport/[id]` opens on the live domain.
- [ ] Employer review surfaces load without surprise errors.
- [ ] The decision language is clear: proceed, review, waiting on sources.
- [ ] Source-backed states are readable without explanation.
- [ ] Any degraded state is honest and calm.

## Before talking to issuers

- [ ] Issuer explanation pages are present and accurate.
- [ ] The issuer path does not claim unsupported integrations.
- [ ] The product clearly separates verified, pending, and degraded states.
- [ ] The flow does not depend on hidden operator intervention.

## Before public marketing

- [ ] The canonical production runtime is live on `vcv-web`.
- [ ] The domain does not point at a stale runtime.
- [ ] The live site has passed smoke checks for homepage, passport, onboarding, and runtime health.
- [ ] The app no longer depends on Vercel-only assumptions.
- [ ] The cost model is understood and sustainable for the founder.

## Stop conditions

Do not launch publicly if any of the following are still true:

- `DEPLOYMENT_DISABLED` appears on the live site
- the canonical deployment is not the one serving the domain
- the homepage or passport still reads like a prototype
- a clinician cannot sign up and see a real next step
- an employer cannot read the trust posture quickly
- the live app still falls back to localhost in production

## Launchable enough

VitalCV is launchable enough when:

- clinicians can enter
- employers can review
- issuers can understand the surface
- the runtime is cheap enough to sustain
- the product feels calm and trustworthy

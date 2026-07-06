# Minimal Backend Boundary

This is the smallest dynamic runtime VitalCV should keep while the static-first cutover is in progress.

## Keep dynamic

### 1. Clerk auth

Needed for:

- sign-in
- sign-up
- session detection
- authenticated handoff for protected flows

### 2. NPI lookup

Needed for:

- identity resolution
- passport generation
- the first meaningful trust snapshot

### 3. Passport persistence

Needed for:

- saving or reloading the current passport state
- keeping employer-readable evidence available
- preserving the current trust snapshot when a user returns

### 4. Onboarding persistence

Needed for:

- saving entered profile information
- continuing the activation path
- preventing users from starting over

### 5. Readiness scoring

Needed for:

- showing whether the user can move forward
- keeping the employer view readable
- separating ready, pending, and degraded states

## Can be mocked temporarily

- analytics and funnel reporting
- detailed operator dashboards
- replay archaeology
- graph visualization
- non-essential demos
- deep trust-history browsing

## Can be deferred

- broader issuer tooling
- network expansion pages
- heavy multi-tenant controls
- advanced operator panels
- optional exports that do not block launch

## Can be removed from the launch wedge

- backend dependencies in public marketing copy
- localhost fallbacks in production paths
- duplicate legacy runtime assumptions
- any feature that exists only to make the system look larger

## Boundary rule

If a feature does not help a clinician sign up, a passport load, or an employer make a decision, it is not part of the minimal backend boundary.

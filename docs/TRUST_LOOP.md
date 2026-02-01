# Trust Loop: Issue → Hold → Present → Accept

**MVP STATUS:** The MVP implements Issue (mock NPI lookup + PSV policy evaluation) and Accept (canonical path enforcement). Hold/Present wallet flows are out of scope.

## Trust Loop Overview

1. **Issue** — Evidence is evaluated and a recognition event is created.
2. **Hold** — Holder stores credentials (not implemented in MVP).
3. **Present** — Holder presents credentials to an employer (not implemented in MVP).
4. **Accept** — Employer validates the canonical path and policy outcome.

## MVP Implementation

### Issue
- Mock NPI lookup endpoint: `apps/api/backend/src/app.ts` (`/lookup/npi/:npi`).
- PSV policy evaluation: `packages/domain-common/psvPolicy.ts`.
- Canonical event types: `packages/domain-common/employmentContracts.ts`.

### Accept
- Canonical path guards: `packages/domain-common/employmentGuards.ts`.
- OIDC4VP demo enforcement: `apps/api/backend/src/app.ts` and `apps/verifier-api/src/oidc4vp/routes.ts`.

## What the Demo Proves

- Canonical path enforcement rejects invalid sequences.
- PSV policy decisions are deterministic with ordered reasons.
- Demo UX is minimal and appears only at blocking moments.

## What the Demo Does Not Prove

- Live primary source integrations.
- Cryptographic credential issuance or DID binding.
- Wallet storage or presentation protocols.
- Production revocation registry.


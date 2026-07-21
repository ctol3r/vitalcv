# Header-trust ratchet (S5)

Gate: `.github/workflows/header-trust-gate.yml`
Script: `scripts/check-header-trust-ratchet.ts`
Baseline: `apps/api/backend/header-trust-baseline.json` (33 files at introduction)

## What it enforces

A backend source file under `apps/api/backend/src` may not read
`x-clerk-user-id`, `x-user-role`, or `x-org-id` unless it is already on the
reviewed baseline. The baseline may shrink; it may not grow.

## What it does not enforce

**It does not prove the backend has stopped trusting headers.** It has not.

G1 (#589) shipped deliberately as a *rewrite* rather than a removal:
`middleware/verifiedIdentity.ts` verifies the Clerk session JWT and then
overwrites `x-clerk-user-id` with the verified subject before routes run. The 33
files on the baseline therefore read verified data — **but only while that
middleware runs in front of them**. That conditional is the whole risk, and this
gate exists to stop the conditional from spreading.

Two idioms are matched as reads:

```
req.headers['x-clerk-user-id']        // 51 sites
getHeader(req, 'x-clerk-user-id')     // 2 sites
```

Mentions that do *not* trust the header are deliberately allowed: error strings
(`Missing x-clerk-user-id`), JSDoc auth notes, and
`attributionSource: 'x-clerk-user-id'`. Banning the words outright would punish
the code that documents the boundary.

## Deferred assertion — do this when G2 flips

S5 as briefed also asks the gate to assert `VERIFIER_RBAC_ENFORCED` defaults
true in production config. **That is not shipped here**, because it fails today:
the flag is still `false` pending the S2 shadow-log review, and a gate that is
red on day one gets ignored or disabled.

Add it in the same PR that flips G2. Note there are **two** flags, not one, and
both must flip:

- `VERIFIER_RBAC_ENFORCED` — `apps/api/backend/src/config/env.ts:165`
- `VERIFIER_RBAC_MODE` — `apps/api/backend/src/middleware/orgRoleGuard.ts:51`

`apps/web/__tests__/verifier/foundation-sweep-7.test.ts:88` pins `false` and must
change in that same PR.

## Retiring the baseline

The end state is a baseline of one: `middleware/verifiedIdentity.ts`, the single
component allowed to decide who the caller is. Every other entry is a file whose
correctness depends on middleware ordering. Shrinking the list means replacing a
header read with the subject `verifiedIdentity` already resolved.

To refresh after a genuine reduction:

```bash
node --experimental-strip-types scripts/check-header-trust-ratchet.ts --update
```

Adding a file to the baseline is a reviewed exception and needs a reason in the
PR body — not a rubber stamp.

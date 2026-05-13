# Canonical Trust Route Map

**Status — read this first.**

This document describes the **target** canonical-path topology for VitalCV's
institutional verifier surfaces. As of the latest `origin/main` HEAD, **only
two of the rows below correspond to handlers that have actually shipped**
(`/api/.well-known/jwks.json` legacy mirror and the OS-association manifests).
The remaining canonical paths are mounted by handlers that live on the
following unmerged PRs:

- `wave/verify-runtime-w9` (#345) — `/verify`
- `wave/well-known-surfaces-w9` (#349) — `/.well-known/{jwks,did,openid-credential-issuer,trust-register}.json`, `/api/receipt/[npi]`
- `wave/verifier-continuity-completion` (#355) — `/.well-known/openid-configuration`, `/trust`, `/api/receipt/by-lineage/[lineageKey]`

Until those PRs merge into `main` AND the apex Vercel project redeploys with
the required env vars (see §"Operator promotion checklist"), an external
verifier hitting any of the canonical paths below other than the legacy
mirror will receive 404 from production.

The corresponding pinning tests (`apps/web/__tests__/well-known-surfaces.test.ts`,
`apps/web/__tests__/verifier-continuity-completion.test.ts`) and companion
forensics docs (`docs/architecture/apex-deployment-forensics.md`,
`docs/architecture/build-artifact-verification.md`) also ship on those
unmerged PRs — they are not on `origin/main` either.

This document is the **single source of truth for the route contract** the
unmerged PRs converge on. Any change to the contract MUST update both this
document AND the corresponding test assertion in the PR that owns the
handler.

## Route table (target topology)

The "Lives on" column attributes each handler to the branch where the file
currently exists. Rows marked "origin/main" already ship today; all others
require the named PR to merge.

| Canonical path | Handler module | Method | Content-Type | Auth | Lives on |
|---|---|---|---|---|---|
| `/.well-known/jwks.json` | `apps/web/app/.well-known/jwks.json/route.ts` | GET | `application/jwk-set+json` | public | #349 (not yet on main) |
| `/.well-known/did.json` | `apps/web/app/.well-known/did.json/route.ts` | GET | `application/did+json` | public | #349 (not yet on main) |
| `/.well-known/openid-credential-issuer` | `apps/web/app/.well-known/openid-credential-issuer/route.ts` | GET | `application/json` | public | #349 (not yet on main) |
| `/.well-known/openid-configuration` | `apps/web/app/.well-known/openid-configuration/route.ts` | GET | `application/json` | public | #355 (not yet on main) |
| `/.well-known/trust-register` | `apps/web/app/.well-known/trust-register/route.ts` | GET | `application/json` | public | #349 (not yet on main) |
| `/trust` | `apps/web/app/trust/page.tsx` | GET (server component) | `text/html` | public | #355 (not yet on main) |
| `/verify` | `apps/web/app/verify/page.tsx` | GET (server component) | `text/html` | public | #345 (not yet on main) |
| `/api/receipt/[npi]` | `apps/web/app/api/receipt/[npi]/route.ts` | GET | `application/jwt` | public | #349 (not yet on main) |
| `/api/receipt/by-lineage/[lineageKey]` | `apps/web/app/api/receipt/by-lineage/[lineageKey]/route.ts` | GET | `application/jwt` | public | #355 (not yet on main) |

**Legacy mirror that DOES ship on `origin/main` today**:
`apps/web/app/api/.well-known/jwks.json/route.ts` returns a JWK set under the
namespaced path `/api/.well-known/jwks.json`. This is kept as a back-compat
surface for internal callers; it is NOT the path institutional verifiers
should consume (which expect the bare `/.well-known/jwks.json` root per
RFC 8615). Note that the current legacy handler emits `Content-Type:
application/json` rather than the RFC-correct `application/jwk-set+json` —
the canonical handler on #349 corrects this.

## Why a "canonical" path matters

External verifiers expect well-known surfaces at the **bare RFC root**, not
under a `/api/` prefix:

- RFC 8615 (well-known URIs) reserves `/.well-known/` at the host root
- W3C DID Core `did:web:<host>` resolves to `https://<host>/.well-known/did.json`
- OID4VCI requires `<credential_issuer>/.well-known/openid-credential-issuer`
- OIDC Discovery 1.0 requires `<issuer>/.well-known/openid-configuration`

If a verifier hits a 404 at one of these canonical paths, it cannot resolve the
issuer at all — there is no "fall back to a namespaced location" step in any of
these specs. The institutional convergence work targets the runtime that
already serves apex, with handlers mounted at these exact paths so external
verification succeeds without operator coordination.

## App Router ownership

All nine routes live in `apps/web/app/...`. The marketing app
(`apps/marketing`) has no `/.well-known/*`, no `/trust`, no `/api/receipt/*`,
and its `/verify/[shareId]` share-link viewer runs on a separate Vercel
project at a different domain — there is no path collision on apex.

`apps/web/lib/auth/roles.ts` `PUBLIC_ROUTE_PATTERNS` includes:

- `/^\/\.well-known(\/.*)?$/`
- `/^\/api(\/.*)?$/` (receipts are public; auth-required API surfaces have
  their own per-handler guards)
- `/^\/verify(\/.*)?$/`
- `/^\/trust(\/.*)?$/`

No SPA fallback is involved — every route above resolves to a real handler
file under `apps/web/app/`. The Next build artifact verification doc
(`docs/architecture/build-artifact-verification.md`) shows each route compiled
into `.next/server/app/` with the expected handler signature.

## Cross-surface coherence (load-bearing invariant)

The four primary discovery surfaces — JWKS, DID document, OID4VCI metadata,
trust-register — MUST agree on:

- Issuer DID (`did:web:<host>`)
- Active signing kid
- JWKS URI (`<host>/.well-known/jwks.json`)
- DID document URI (`<host>/.well-known/did.json`)

This is enforced by the cross-surface coherence test in
`well-known-surfaces.test.ts` and re-asserted for the OIDC discovery surface in
`verifier-continuity-completion.test.ts`. A diff that changes one surface
without updating the others will fail CI before merge.

## Content-Type contract is non-negotiable

External verifier middleware (e.g., generic OIDC clients) MIME-sniff before
parsing. `application/jwk-set+json` and `application/did+json` are the IANA
registered media types — substituting `application/json` would still parse for
some clients but break stricter ones (and break content negotiation in
proxies). The test suite pins each surface to its exact Content-Type via
`expect(res.headers.get('content-type')).toMatch(...)`.

## Caching

All public discovery surfaces use `public, max-age=3600, stale-while-revalidate=86400`.
This is intentional: external verifiers will cache for an hour, and the
stale-while-revalidate window keeps the surface reachable during deploys.
Receipt endpoints (`/api/receipt/*`) are NOT cached on the CDN — each receipt
is per-NPI and per-checkedAt, so caching would serve stale signed material.

## Operator promotion checklist

For apex to actually serve these routes, the Vercel project must be configured
with:

- `VITALCV_ISSUER_ORIGIN=https://vitalcv.com`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY` (any non-empty value
  to satisfy middleware preview-fallback — even unused for these public routes,
  the middleware throws if absent in non-preview mode)
- ES256 signing material consumed by `getPublicKeyJwk()` /
  `getSigningPrivateKey()` in `apps/web/lib/crypto/receiptIssuer.ts`

Per `docs/architecture/apex-deployment-forensics.md` §5, the apex
`clerk.enabled: false` state at audit time was the only operator-side gap
blocking these surfaces from going live. The handlers themselves are public
and require no Clerk session.

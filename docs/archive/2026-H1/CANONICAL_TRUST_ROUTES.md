# Canonical Trust Routes
Generated: 2026-05-13T18:22:00Z
Probe: 2026-05-13T18:11:26Z (all 200, confirmed)

---

## Phase 3 Verdict: ALL 6 CANONICAL ROUTES LIVE

No 404s. No SPA fallbacks on JSON. App Router owns all routes.

---

## Route Status

| Route | HTTP | Content-Type | SPA Fallback | Cache |
|---|---|---|---|---|
| `/.well-known/jwks.json` | 200 | application/json | None | max-age=3600, swr=86400 |
| `/.well-known/did.json` | 200 | application/json | None | max-age=3600, swr=86400 |
| `/.well-known/openid-credential-issuer` | 200 | application/json | None | max-age=3600 |
| `/.well-known/openid-configuration` | 200 | application/json | None | max-age=3600 |
| `/trust` | 200 | text/html (SSR) | N/A | Next.js default |
| `/verify` | 200 | text/html (SSR) | N/A | Next.js default |

Additional live routes:
| `/.well-known/trust.json` | 200 | application/json | None | max-age=300, swr=60 |
| `/.well-known/trust-register` | 200 | application/json | None | max-age=300, swr=60 |
| `/trust/doctrine` | 200 | text/html (SSR) | N/A | — |

---

## Payload Verification

### `/.well-known/jwks.json`
- `keys[0].kid`: `vcv-es256-dev` (stable, not ephemeral)
- `keys[0].alg`: `ES256`
- `keys[0].kty`: `EC`

### `/.well-known/did.json`
- `id`: `did:web:vitalcv.com`
- `verificationMethod[0].type`: `JsonWebKey2020`
- `service`: 3 entries — `CredentialIssuer`, `ReceiptVerifier`, `OID4VCIIssuer`

### `/.well-known/openid-credential-issuer`
- `issuer`: `https://vitalcv.com`
- `credential_issuer`: `https://vitalcv.com`
- `jwks_uri`: `https://vitalcv.com/.well-known/jwks.json`

### `/.well-known/trust-register`
- `doctrine.anonymous_reads`: `public`
- `doctrine.anonymous_writes`: `rejected`
- `doctrine.signed_issuance`: `attributable`

---

## No 404 Cascade

Next.js `not-found.tsx` exists for unmatched routes. All `.well-known/` routes are explicitly mounted as App Router `route.ts` files — no rewrite fallback needed.

---

## External Reachability

Local: ✅ All verified from `localhost:3030`
Production (Vercel): Not yet verified — Vercel CLI not installed, production URL unknown.
Required for full external validation: `npm i -g vercel && vercel ls`

**SUCCESS: All 6 institutional discovery routes live, correct, and owned by App Router.**

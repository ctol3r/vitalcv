# Protocol Surface Integrity Audit

Authoritative audit of VitalCV's public protocol discovery surfaces.
Documents the integrity guarantees each route provides today, what is
intentionally unsupported, and what is parked for future waves.

This document is binding for `feat/protocol-integrity-hardening`. New
protocol surfaces must extend the same envelope before merging.

## Scope

| Surface | Status |
|---|---|
| `GET /.well-known/did.json` | implemented · discovery surface |
| `GET /.well-known/openid-credential-issuer` | implemented · discovery surface |
| `GET /.well-known/jwks.json` | existing (pre-this-wave) · ES256 public key |
| `GET /api/resolve-npi` | implemented (PR #392) · live NPPES resolver |

## Integrity envelope (binding)

Every protocol response from `apps/web/lib/protocol/protocolIntegrity.ts`
ships:

| Property | Implementation |
|---|---|
| Canonical body | `canonicalSerialize(value)` — lexically sorted object keys, positional array order |
| Strong ETag | `computeETag(canonicalJson)` — first 16 hex of SHA-256 over canonical bytes |
| 304 handling | `ifNoneMatchMatches` — `If-None-Match` matched against strong, weak (`W/`), and wildcard (`*`) forms |
| Vary | `Host, X-Forwarded-Host, Accept` — prevents cache poisoning across hosts |
| Cache-Control | `public, max-age=3600, stale-while-revalidate=86400` |
| Content-Type | per-route exact MIME type |

## `did.json` audit

| Field | Source / contract |
|---|---|
| `@context` | `["https://www.w3.org/ns/did/v1", "https://w3id.org/security/suites/jws-2020/v1"]` — verbatim |
| `id` / `controller` | `did:web:<canonicalizeHost(headers)>`; ports percent-encoded as `%3A` |
| `verificationMethod[0].type` | `JsonWebKey2020` (W3C-defined) |
| `verificationMethod[0].publicKeyJwk` | Ed25519 OKP key from `lib/crypto/ed25519IssuerKey.ts` — dev ephemeral; prod via `VCV_ED25519_PRIVATE_JWK` |
| `authentication` / `assertionMethod` | Both reference the single verification method id |
| `service[].KeyStore` | Points at `${origin}/.well-known/jwks.json` |
| `service[].OID4VCIIssuer` | Points at `${origin}/.well-known/openid-credential-issuer` |
| `Content-Type` | `application/did+json; charset=utf-8` per DID-Core |

### Determinism

Two requests under identical host resolution produce byte-identical
response bodies (validated by 61-test protocol suite). ETag is the
SHA-256 of those canonical bytes; identical input → identical ETag.

## `openid-credential-issuer` audit

| Field | Source / contract |
|---|---|
| `credential_issuer` | `${origin}` |
| `authorization_servers` | `[${origin}]` |
| `credential_endpoint` | `${origin}/api/credentials/issue` (discovery declaration — endpoint not exercised by this surface) |
| `jwks_uri` | `${origin}/.well-known/jwks.json` |
| `proof_types_supported.jwt.proof_signing_alg_values_supported` | `["EdDSA", "ES256"]` — matches the published verification keys |
| `credential_configurations_supported.VitalCVCredential.format` | `jwt_vc_json` |
| `cryptographic_binding_methods_supported` | `["did:web"]` |
| `credential_signing_alg_values_supported` | `["EdDSA", "ES256"]` |
| `credentialSubject` | `npi`, `taxonomyCode`, `activeState` (NPPES-public fields only) |
| `issuer_did` | Cross-reference to the DID document for verifier convenience |
| `Content-Type` | `application/json; charset=utf-8` |

### Determinism

Same as did.json — sorted-key canonical body, ETag derived from canonical bytes.

## `resolve-npi` audit (PR #392, unchanged in this wave)

| Property | Contract |
|---|---|
| Input validation | NPI regex `^\d{10}$` + ISO/IEC 7812 Luhn checksum |
| Upstream | `https://npiregistry.cms.hhs.gov/api/?number={npi}&version=2.1` |
| Cache | 5-minute TTL on positive results; in-memory Map; `X-Cache: HIT/MISS` |
| Rate-limit | 30 req/min per IP; `Retry-After` on 429 |
| Error tokens | Closed set: `invalid_npi_format`, `invalid_npi_checksum`, `npi_not_found`, `rate_limited`, `upstream_unavailable`, `upstream_unreachable` |
| Output | Minimal DTO: `{ firstName, lastName, credential, primaryTaxonomy, activeState }` |

## `issuerHost` resolution audit

| Source | Order |
|---|---|
| `VCV_ISSUER_HOST` env | 1st — operator override |
| `X-Forwarded-Host` first hop | 2nd — proxy/tunnel |
| `Host` header | 3rd — direct |
| `DEFAULT_ISSUER_HOST = 'vitalcv.com'` | 4th — fallback |

All candidates pass through `canonicalizeHost`:

- ASCII-only (Unicode rejected — IDN spoofing prevention)
- No path / query / fragment / scheme separator
- 0 or 1 colons; if 1, numeric port 1–65535
- Whitespace / control characters rejected
- Max 253 chars (RFC 1035)
- Lowercased on the host portion (RFC 3986 case-insensitive)
- Leading-dash hostnames rejected (HOST_PATTERN requires alphanumeric first char)

The canonicalizer returns `null` for any non-conforming candidate; the
resolver falls through to the next source. The default host is never
"widened" by a malicious upstream header.

## Ed25519 key semantics

The DID document Ed25519 identity key is **separate** from the receipt-
signing ES256 key:

| Key | Purpose | Location |
|---|---|---|
| Ed25519 | DID document identity (`verificationMethod`) | `lib/crypto/ed25519IssuerKey.ts` |
| ES256 | Receipt signing | `lib/crypto/receiptIssuer.ts` |

A DID may legitimately publish multiple verification methods of
different types. Receipt verification happens against the JWKS;
identity assertion happens against the DID document. Both are real
implementations; neither is fake.

In dev / preview, both keys are dev-ephemeral (regenerated on process
restart). In production, both are pinned via env (`VCV_ED25519_PRIVATE_JWK`
and `RECEIPT_PRIVATE_KEY_JWK` respectively).

## Cache semantics

| Surface | Cache-Control | ETag | Vary |
|---|---|---|---|
| did.json | `public, max-age=3600, stale-while-revalidate=86400` | strong, 16-hex | `Host, X-Forwarded-Host, Accept` |
| openid-credential-issuer | same | strong, 16-hex | same |
| jwks.json | `public, max-age=3600, stale-while-revalidate=86400` (existing) | not yet ETag-instrumented | n/a — existing route |
| resolve-npi | `public, max-age=300, stale-while-revalidate=600` | n/a — short-lived data | n/a |

`Vary: Host, X-Forwarded-Host` ensures that a shared CDN cache will
not serve a different host's DID document to a tunnel client.

## Compliance posture

### Compliant

- W3C DID-Core 1.0 document shape (binding fields, context, types)
- W3C JWS-2020 verification method type (`JsonWebKey2020`)
- did-method-web identifier syntax (port percent-encoding)
- OpenID4VCI 1.0 issuer metadata shape (`credential_issuer`, `credential_endpoint`, `jwks_uri`, `credential_configurations_supported`)
- RFC 9110 conditional GET (ETag + If-None-Match → 304)
- RFC 1035 host length limit
- RFC 3986 host case-insensitivity (canonical lowercase)

### Intentionally unsupported

- **RFC 8785 (JSON Canonicalization Scheme)** — the lightweight sorted-key canonicalization is sufficient for our ASCII-only finite-number payloads; full JCS would add complexity without integrity benefit.
- **Production VC issuance flow** — the OID4VCI metadata is a discovery declaration only. Pilot engagements remain institution-owned for the issuance step.
- **Production wallet interoperability** — declared support (EdDSA / ES256 / jwt_vc_json) does not assert that a particular wallet has been tested end-to-end.
- **Federation** — no `dereference` / `federation_endpoints` / cross-issuer trust framework is implemented.

### Future-wave

- **JWS-signed did.json** — sign the canonical document with the receipt-issuer key so verifiers can detect tampering without DNS trust.
- **Status List 2021 endpoint** — `/.well-known/status-list/...` for credential revocation. Not in this wave; tracked in pilot-roadmap.
- **DID rotation / co-signed transition** — multi-key transition events for production deployments.

### Intentionally omitted

- **`certified` / `verified by W3C` language** anywhere in responses or copy
- **Marketing claims about "universal interoperability"**
- **Fabricated SLAs in metadata**

## Test coverage

`apps/web/__tests__/protocol-integrity-hardening.test.ts` — 61 tests
across 9 describe blocks:

1. `canonicalSerialize` — sort stability, recursion, primitives (4)
2. `computeETag` — format, determinism, mutation sensitivity (3)
3. `ifNoneMatchMatches` — strong/weak/wildcard/csv/null/mismatch (6)
4. `canonicalizeHost · acceptance` — 8 acceptance cases
5. `canonicalizeHost · rejection` — 10 rejection categories
6. `canonicalizeHost · port handling` — boundaries (3)
7. `hostToDidWeb` — plain + port percent-encoding (2)
8. `resolveIssuerHost` — precedence + canonicalization + injection defense (10)
9. `buildCanonicalJsonResponse` — 200, 304, byte-identical (3)
10. `did.json route` — 7 integrity assertions
11. `openid-credential-issuer route` — 5 integrity assertions

## Truth-contract grep

No banned phrases in any touched file. No new "compliant", "certified",
"production-ready federation", "verified by W3C", "OpenID certified",
or "universal interoperability" language introduced.

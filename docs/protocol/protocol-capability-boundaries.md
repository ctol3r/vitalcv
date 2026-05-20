# Protocol Capability Boundaries

Standards-facing companion to `docs/ops/operational-capability-boundaries.md`
(PR #391). Where the operational doc defines what VitalCV does
operationally, this document defines what VitalCV's **protocol layer**
exposes, declares, accepts, and intentionally does not.

The five-state taxonomy is reused for clarity:

| Status | Meaning |
|---|---|
| `implemented` | wired end-to-end in shipping code |
| `discoverable` | declared in our metadata; consumable by external verifiers |
| `interoperable` | tested end-to-end with at least one external implementation |
| `future-state` | on the protocol roadmap; not yet exposed |
| `unsupported` | explicitly not in scope |

## Status table

### Implemented

| Capability | Evidence |
|---|---|
| W3C DID-Core 1.0 document at `/.well-known/did.json` | `apps/web/app/.well-known/did.json/route.ts` |
| OID4VCI 1.0 issuer metadata at `/.well-known/openid-credential-issuer` | `apps/web/app/.well-known/openid-credential-issuer/route.ts` |
| Ed25519 verification method (`JsonWebKey2020` / OKP) | `apps/web/lib/crypto/ed25519IssuerKey.ts` |
| ES256 receipt signing JWK at `/.well-known/jwks.json` | `apps/web/lib/crypto/receiptIssuer.ts` |
| Per-request canonical host resolution | `apps/web/lib/discovery/issuerHost.ts` |
| Deterministic JSON canonicalization (sorted keys) | `apps/web/lib/protocol/protocolIntegrity.ts` |
| Strong ETag + RFC 9110 conditional GET | same |
| `Vary: Host, X-Forwarded-Host` cache-poisoning defense | same |
| Live NPPES NPI resolver (typed DTO + cache + rate-limit) | PR #392 |

### Discoverable

| Capability | Where declared |
|---|---|
| `credentials_supported: VitalCVCredential` | OID4VCI metadata |
| `format: jwt_vc_json` | OID4VCI metadata |
| `cryptographic_binding_methods_supported: ["did:web"]` | OID4VCI metadata |
| `credential_signing_alg_values_supported: ["EdDSA", "ES256"]` | OID4VCI metadata |
| `proof_types_supported.jwt.proof_signing_alg_values_supported: ["EdDSA", "ES256"]` | OID4VCI metadata |
| `credentialSubject: { npi, taxonomyCode, activeState }` | OID4VCI metadata |
| Ed25519 verification method id | DID document |
| Service endpoints (`KeyStore`, `OID4VCIIssuer`) | DID document |

**Declared** does not mean **operated**. Declaration is a discovery
surface for consumers who want to know what VitalCV intends to support;
production end-to-end exercise of these declarations is institution-
owned during pilot engagements.

### Interoperable

| Capability | Tested with |
|---|---|
| did:web resolution via `did-method-web` resolver | not yet tested end-to-end with an external resolver — local unit tests only |
| OID4VCI metadata fetch by a wallet | not yet tested end-to-end — local unit tests only |

The honest current posture is **pilot-stage interoperability**. The
metadata is structurally compliant; specific external implementations
have not been validated. Plan: validate against the published OID4VCI
1.0 conformance suite as a future wave; not blocking on this wave.

### Future-state

| Capability | Horizon |
|---|---|
| JWS-signed did.json (tamper-evident document) | next protocol wave |
| StatusList2021 revocation endpoint | future pilot horizon |
| DID rotation / co-signed transition events | future pilot horizon |
| `credential_offer` endpoint (OID4VCI issuance flow) | post-pilot |
| Production wallet conformance testing | post-pilot |
| Federation / cross-issuer trust framework | post-pilot |

### Unsupported

The platform's protocol layer does NOT:

- Implement the OID4VCI issuance flow (`/credentials` endpoint is declared but not yet operated)
- Implement the OAuth 2.0 / OIDC authorization-server flow for credential issuance
- Make federation claims; there is no cross-issuer trust list
- Implement universal-resolver-style multi-method DID resolution (only `did:web` is exposed)
- Provide "certified" status of any kind — neither W3C, OpenID Foundation, nor any third-party body has certified the discovery surface

## Posture statements (binding)

When external materials reference VitalCV's protocol layer, they MUST
use **only** the language below. Banned terms in §6 are non-negotiable.

### Standards-language normalization (use these)

- "Discovery surface"
- "Issuer metadata"
- "Verification method"
- "Proof capability"
- "Declared support"
- "Planned interoperability"
- "Pilot-stage interoperability"
- "Source-confirmed federal-registry resolution"

### Banned (never use)

- "Fully compliant"
- "Certified" (we are not certified by any body)
- "Production-ready federation"
- "Universal interoperability"
- "Verified by W3C"
- "OpenID certified"
- "Industry-standard guarantees"
- "Military-grade encryption"

## How to add a new protocol declaration

1. Determine the appropriate status row in the table above.
2. If `implemented`, supply an evidence path into a shipped PR.
3. If `discoverable`, ship the declaration in the metadata route and
   add a test asserting its presence in the canonical response.
4. If `future-state`, do NOT add the declaration to a response body —
   document it here only.
5. Open a PR that updates this doc plus the metadata route in one diff.

## Truth contract

This document inherits the project-wide CLAUDE.md truth-contract banned
phrases. The "standards-language normalization" list above is the
positive specification of acceptable protocol-layer vocabulary.

Any PR that adds protocol copy in violation of this doc's "Banned"
list MUST be rejected at Codex audit.

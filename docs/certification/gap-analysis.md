# OpenID Conformance Gap Analysis

> **Generated:** 2025-02-12
> **Target Certifications:** OpenID4VCI 1.0 (Issuer) · OpenID4VP 1.0 (Wallet/Verifier) · HAIP 1.0
> **Repository:** VitalCV monorepo (`phase/trust-safety-signals`)

---

## 1. Executive Summary

VitalCV has a **mature OAuth 2.0 Authorization Server** (`apps/authz/`) with DPoP (RFC 9449), PAR, mTLS, JTI replay protection, and sender-constrained token binding — roughly 60% of the HAIP security surface. However, **no OpenID4VCI or OpenID4VP protocol flows exist**, and the well-known metadata endpoints required for conformance testing are absent. The verifier endpoint (`apps/verifier-api/`) is a stub that returns `{ verified: true }` without cryptographic validation.

**Effort estimate:** The existing authz primitives (DPoP, PAR, token binding) are production-grade. The gaps are primarily **metadata endpoints**, **PKCE**, **credential issuance flow**, and **VP signature verification**.

---

## 2. Inventory: Existing Infrastructure

### 2.1 Authorization Server (`apps/authz/src/index.ts` — 845 lines)

| Capability | Status | Notes |
|---|---|---|
| DPoP middleware (RFC 9449) | ✅ Complete | Validates typ, alg, kid, htu, htm, iat (60s skew), jti |
| Algorithm allowlist | ✅ Complete | ES256, EdDSA only — HAIP-compliant |
| JTI replay cache | ✅ Complete | In-memory Map, 60s TTL, one-shot enforcement |
| PAR endpoint (`POST /par`) | ✅ Complete | 60s expiry, request_uri generation |
| PAR enforcement for high-risk scopes | ✅ Complete | `credential:issue:*`, `credential:batch`, `credential:deferred` |
| Token endpoint (`POST /token`) | ✅ Complete | Pre-authorized code, authorization code (via PAR), refresh token grants |
| cnf.jkt token binding | ✅ Complete | Access tokens embed `cnf.jkt` when DPoP used |
| Refresh token rotation | ✅ Complete | Rotate-on-use, sender-constrained |
| mTLS middleware | ✅ Complete | Optional for confidential clients, configurable via env |
| Credential endpoint guard | ✅ Complete | Rejects bearer-only tokens, requires DPoP or mTLS |
| Pre-authorized code generation | ✅ Complete | `POST /pre-authorized-code` with scope limiting |

### 2.2 Token Service (`apps/authz/src/services/tokenService.ts` — 261 lines)

| Capability | Status | Notes |
|---|---|---|
| ES256 signing (jose library) | ✅ Complete | `generateKeyPair('ES256')` |
| Access token with cnf.jkt | ✅ Complete | Embedded when DPoP proof provided |
| Refresh token sender-constraint | ✅ Complete | Requires cnfJkt OR clientCert fingerprint |
| Token revocation | ✅ Complete | `revokeRefreshToken()` |
| Expired token cleanup | ✅ Complete | `cleanupExpiredTokens()` |

### 2.3 Verifier API (`apps/verifier-api/src/oidc4vp/routes.ts` — 61 lines)

| Capability | Status | Notes |
|---|---|---|
| VP submission endpoint | ⚠️ Stub | `POST /oidc4vp/presentation` — no signature verification |
| Canonical path enforcement | ✅ Complete | VitalCV domain logic validated |
| vp_token presence check | ✅ Complete | Returns 400 if missing |
| VP JWT/JWS signature verification | ❌ Missing | Returns `{ verified: true }` unconditionally |
| Presentation definition support | ❌ Missing | No `presentation_definition` or `presentation_definition_uri` |

### 2.4 Supporting Infrastructure

| Component | Status | Location |
|---|---|---|
| DID resolution (did:web, did:key, did:ethr) | ✅ Complete | `apps/api/backend/src/did/universal_did_resolver.ts` |
| StatusList2021 (revocation) | ✅ Complete | `apps/status-api/src/routes/statusList.ts` |
| SD-JWT credential format | ❌ Empty | `packages/vc-formats-csdjwt/src/index.ts` exports `{}` |
| Docker-compose | ❌ Placeholder | `apps/api/docker-compose.yml` is a comment only |

### 2.5 Test Coverage

| Test File | Coverage |
|---|---|
| `apps/authz/src/__tests__/dpopJosePolicy.test.ts` | DPoP alg/typ/kid validation |
| `apps/authz/src/__tests__/dpop-jose-policy.test.ts` | Additional DPoP edge cases |
| `apps/authz/src/__tests__/parEnforcement.test.ts` | PAR requirement enforcement |
| `apps/authz/src/services/__tests__/tokenService.test.ts` | Token issuance, rotation, revocation |

---

## 3. Gap Analysis by Specification

### 3.1 OpenID4VCI 1.0 (Credential Issuance)

| Requirement | Spec Reference | Status | Gap Description |
|---|---|---|---|
| **Issuer Metadata** | §10.2 | ❌ **CRITICAL** | No `GET /.well-known/openid-credential-issuer` endpoint |
| **Authorization Server Metadata** | §10.1 | ❌ **CRITICAL** | No `GET /.well-known/openid-configuration` or `/.well-known/oauth-authorization-server` |
| **Credential endpoint** | §7 | ⚠️ Partial | Guard exists but returns static response; no actual credential issuance |
| **c_nonce challenge-response** | §7.2.1 | ❌ **CRITICAL** | No nonce issuance, no proof-of-possession verification on credential request |
| **Credential offer** | §4 | ❌ Missing | No credential offer generation (`openid-credential-offer://`) |
| **PKCE (S256)** | §5.1.1 | ❌ **CRITICAL** | No `code_challenge` / `code_verifier` support in token endpoint |
| **Batch credential endpoint** | §8 | ❌ Missing | Not required for basic conformance |
| **Deferred credential endpoint** | §9 | ❌ Missing | Not required for basic conformance |
| **Notification endpoint** | §10.3 | ❌ Missing | Not required for basic conformance |
| **Pre-authorized code flow** | §4.1 | ✅ Complete | `POST /pre-authorized-code` + token exchange works |
| **PAR for high-risk scopes** | HAIP | ✅ Complete | `credential:issue:*` scopes require PAR |
| **DPoP token binding** | RFC 9449 | ✅ Complete | cnf.jkt embedded in access tokens |

### 3.2 OpenID4VP 1.0 (Verifiable Presentations)

| Requirement | Spec Reference | Status | Gap Description |
|---|---|---|---|
| **Authorization request** | §5 | ❌ Missing | No `GET /authorize` with `response_type=vp_token` |
| **Presentation definition** | §5.1 | ❌ Missing | No presentation_definition support |
| **VP token validation** | §6 | ❌ **CRITICAL** | Stub returns verified:true without cryptographic check |
| **Response mode** | §6.2 | ❌ Missing | No `direct_post` response mode |
| **Nonce management** | §5.4 | ❌ Missing | No nonce issued in authorization request |
| **Verifier metadata** | §9 | ❌ Missing | No `/.well-known/openid-configuration` for verifier |
| **VP format support** | §7 | ❌ Missing | No jwt_vp, ldp_vp, or sd-jwt format handling |
| **Cross-device flow** | §8 | ❌ Missing | Not required for basic conformance |

### 3.3 HAIP 1.0 (High Assurance Interoperability Profile)

| Requirement | HAIP Reference | Status | Gap Description |
|---|---|---|---|
| **Algorithm whitelist: ES256, EdDSA** | §4.1 | ✅ Complete | `ALLOWED_ALGORITHMS = ['ES256', 'EdDSA']` in authz |
| **DPoP required for wallets** | §4.2 | ✅ Complete | `dpopMiddleware` enforces for wallet client type |
| **PKCE S256 required** | §4.3 | ❌ **CRITICAL** | No code_challenge support anywhere |
| **PAR required** | §4.4 | ⚠️ Partial | Required for `credential:issue:*` but not globally enforced |
| **Sender-constrained tokens** | §4.5 | ✅ Complete | cnf.jkt (DPoP) or mTLS certificate binding |
| **Refresh token rotation** | §4.6 | ✅ Complete | Rotate-on-use pattern |
| **Central configuration** | — | ❌ Missing | Config scattered across env vars, no unified HAIP config |
| **SD-JWT credential format** | §5.1 | ❌ Missing | Empty package at `packages/vc-formats-csdjwt/` |

---

## 4. Persistence Gaps (Conformance Suite Blocking)

The conformance suite requires multi-step protocol flows. These stores are **in-memory** and will lose state if the service restarts mid-test:

| Store | Location | Risk |
|---|---|---|
| Pre-authorized codes | `apps/authz/src/index.ts` Map | Lost on restart |
| PAR requests | `apps/authz/src/index.ts` Map | Lost on restart |
| JTI replay cache | `apps/authz/src/index.ts` Map | Lost on restart |
| Refresh tokens | `apps/authz/src/services/tokenService.ts` Map | Lost on restart |
| Status list entries | `apps/status-api/src/routes/statusList.ts` Map | Lost on restart |
| Signing key | `apps/authz/src/services/tokenService.ts` variable | Regenerated on restart |

**Mitigation for conformance testing:** These are acceptable for CI-gated testing (single container, no restarts). For production certification, migrate to Redis or PostgreSQL.

---

## 5. Priority Matrix

### P0 — Conformance Suite Blockers (must fix before CI can run)

1. **Well-known metadata endpoints** — Without these, the conformance suite cannot discover the issuer/verifier
2. **PKCE S256** — HAIP hard requirement; conformance suite will reject authorization flows without it
3. **c_nonce challenge-response** — Required for credential issuance key proofing
4. **VP JWT signature verification** — Conformance suite sends real VPs that must be cryptographically validated

### P1 — Required for Certification Pass

5. **OpenID4VP authorization request flow** — `response_type=vp_token`, `direct_post` response mode
6. **Presentation definition support** — Conformance suite sends specific presentation definitions
7. **Credential issuance flow** — Actual VC generation (SD-JWT or JWT)
8. **Central HAIP enforcement config** — Single source of truth for algorithm/protocol constraints

### P2 — Polish for Full Compliance

9. **Global PAR enforcement** (currently only for high-risk scopes)
10. **SD-JWT implementation** (credential format)
11. **Credential offer protocol** (`openid-credential-offer://`)
12. **Docker-compose for CI** (boot all services)

---

## 6. Files to Create / Modify

### New Files

| File | Purpose |
|---|---|
| `packages/haip-config/src/index.ts` | Central HAIP enforcement configuration |
| `packages/haip-config/src/types.ts` | TypeScript types for HAIP config |
| `packages/haip-config/package.json` | Package manifest |
| `packages/haip-config/tsconfig.json` | TypeScript config |
| `.github/workflows/openid-conformance.yml` | CI workflow for conformance suite |
| `docker-compose.conformance.yml` | Docker composition for conformance testing |

### Modified Files

| File | Changes |
|---|---|
| `apps/authz/src/index.ts` | Import HAIP config; add PKCE support; add well-known endpoints |
| `apps/verifier-api/src/oidc4vp/routes.ts` | Add VP signature verification; presentation_definition |
| `pnpm-workspace.yaml` | Add `packages/haip-config` |
| `turbo.json` | Add haip-config to pipeline |

---

## 7. Testing Strategy

### Unit Tests (existing, extend)
- `apps/authz/src/__tests__/` — Add PKCE S256 validation tests
- `apps/verifier-api/` — Add VP signature verification tests

### Integration Tests (new)
- Metadata endpoint discovery tests
- Full pre-authorized code → token → credential flow
- VP submission with real JWT signatures

### Conformance Suite (new CI workflow)
- OpenID Foundation conformance suite Docker containers
- Automated against `apps/authz/` and `apps/verifier-api/`
- PR-gating: fail if any conformance test fails

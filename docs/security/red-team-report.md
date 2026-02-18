# VitalCV Security Red-Team Simulation Report

**Date:** 2026-02-16  
**Scope:** backend API, proof engine, lifecycle controls, federation controls, issuance path, and startup guards.

## Simulation method
- Attack cases are mapped to direct code-level simulations and rejection checks.
- Unit tests and runtime guards are the primary enforceable evidence.
- Observability is validated through structured failures (`event` payloads) and explicit deny responses.

## 1) Tampered Merkle proof
- **Attempt:** Submit a claim proof with a modified `leafHash`.
- **Reject point:** `verifyClaimProof` recomputes path root and returns `false` when hashes do not match.
- **Defense:** `apps/api/backend/src/services/selectiveProofEngine.ts` (`verifyClaimProof`).
- **Failure signal:** no root match; proof endpoint returns non-success in `verify` flow and logs `proof_generation_error` when generated paths fail.

## 2) Forged issuer DID
- **Attempt:** Request verification/issuance checks with `iss: did:web:attacker...`.
- **Reject point:** `evaluateHaipNoDowngrade` checks DID equality to configured DID.
- **Defense:** `apps/api/backend/src/utils/haip.ts` and `apps/api/backend/src/services/runtimeGuards.ts`.
- **Failure signal:** endpoint-level rejection or validation error with violation listing.

## 3) Modified JWS payload
- **Attempt:** Alter JWS payload while keeping signature chain unchanged.
- **Reject point:** `validateVitalVC` (issuer API) requires payload verification through `jwtVerify`; signature and claim constraints must match.
- **Defense:** `apps/issuer-api/src/services/vcIssuer.ts` (`validateVitalVC`, `parseJwsPayloadObject`), plus strict ES256 checks in issuance/validation flows.
- **Failure signal:** `jwtVerify` or VC claim validation error; VC validation fails before persistence.

## 4) Revoked credential reactivation attempt
- **Attempt:** Re-invoke lifecycle transitions on revoked credential.
- **Reject point:** `revokeCredential` / `reinstateCredential` enforce explicit guardrails and trust path checks.
- **Defense:** `apps/api/backend/src/services/revocationService.ts`.
- **Failure signal:** `cannot reinstate revoked credential` / strict cross-check failures when required.

## 5) Cross-tenant artifact access
- **Attempt:** Access another tenant’s artifact without explicit federation rights.
- **Reject point:** trust resolution returns `null` unless same tenant, super-admin, or approved federation relation.
- **Defense:** `apps/api/backend/src/utils/federation.ts` (`resolveCrossOrgTrustLevel`) and middleware org-context checks.
- **Failure signal:** 403 from routes in `apps/api/backend/src/app.ts`.

## 6) Federation bypass
- **Attempt:** Forge federation context to gain access.
- **Reject point:** `resolveCrossOrgTrustLevel` validates request org and target org with explicit source function.
- **Defense:** shared federation utility; route checks call shared function with same input discipline.
- **Failure signal:** deny result (`null`), resulting in 403/empty response as appropriate.

## 7) HAIP downgrade attack
- **Attempt:** Downgrade algorithm, token type, or PKCE/PAR/DPoP posture.
- **Reject point:** `evaluateHaipNoDowngrade` and runtime guard checks reject any non-enforced posture.
- **Defense:** `apps/api/backend/src/utils/haip.ts`, `apps/api/backend/src/services/runtimeGuards.ts`.
- **Failure signal:** `HAIP no-downgrade violation` path returns violations array; startup throws when production guard fails.

## 8) Expired → verified transition bypass
- **Attempt:** Submit expired artifact and force lifecycle upgrade.
- **Reject point:** `computeCredentialState` evaluates time-based expiry before status fallback and returns `EXPIRED`.
- **Defense:** `apps/api/backend/src/services/credentialStatusEngine.ts` and transition callers.
- **Failure signal:** state mismatch during cross-check and status checks.

## 9) Transparency log deletion attempt
- **Attempt:** Remove audit trail entries to hide historical transitions.
- **Reject point:** API surface has read-only retrieval for artifact transparency (`/api/transparency/:artifactId`) and write paths are strictly append-only from service-level calls.
- **Defense:** `apps/api/backend/src/services/transparencyLedger.ts`, `apps/api/backend/src/services/transparencyLog.ts`, `apps/api/backend/src/services/monitoring`.
- **Failure signal:** endpoint returns 404/forbidden/empty; no delete endpoint for verifier/public workflow.

## 10) Strict mode disabled in production
- **Attempt:** Start API with `NODE_ENV=production` and `STRICT_TRANSITION_MODE=false`.
- **Reject point:** startup guard throws and blocks initialization.
- **Defense:** `apps/api/backend/src/services/runtimeGuards.ts` and `apps/api/backend/src/app.ts` startup wiring.
- **Failure signal:** startup error `STRICT_TRANSITION_MODE must be true in production`, logged as `runtime_guards_result`.

## Conclusion
All simulated attacks are rejected by deterministic rule checks or signed-verification gates in the current design.  
No cryptographic downgrade or tenant boundary bypass path is present without a valid policy path.

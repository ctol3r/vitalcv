# Code Gap Analysis
**Audit Date:** 2026-04-22
**Scope:** External non-worktree directories vs canonical repo

---

## Summary

| Source | TypeScript Files | Unique Code? | Risk |
|---|---|---|---|
| `~/backend/` | 467 `.ts` files | YES — OID4VCI/OID4VP route implementations | MEDIUM |
| `~/substrate/` | Rust pallets | YES — `pallet-did` + test infrastructure | HIGH |
| `~/vitalcv-backend/` | BATCH docs only (no `.ts`) | NO — documentation only | LOW |

---

## Gap 1: `~/backend/` — Pre-Monorepo OID4VCI/OID4VP Implementation

### What it contains
- Full OID4VCI routes: `credential.ts`, `credential-offer.ts`, `token.ts`, `metadata.ts`, `jwks.ts`, `register.ts`, `admin.ts`
- Full OID4VP routes: `presentation-request.ts`, `presentation-result.ts`, `session.ts`
- PSV routes: `verify.ts`, `license.ts`
- Crypto routes: `dev.ts`
- 467 TypeScript files total across `apps/`, `backend/`, `components/`, `policies/`

### How it relates to canonical repo
The canonical `apps/issuer-api/` has OID4VCI routes too (`credential.ts`, `metadata.ts`), but `~/backend/` appears to have a more complete implementation including OID4VP session management and the `register.ts` / `credential-offer.ts` endpoints that may not be in `issuer-api`.

**Canonical `apps/issuer-api/` routes present:**
- `oidc4vci/credential.ts` ✅
- `oidc4vci/metadata.ts` ✅
- `wallet.ts`, `did.ts`, `internal.ts` ✅

**Routes in `~/backend/` NOT confirmed in canonical:**
- `oidc4vci/credential-offer.ts` — credential offer endpoint
- `oidc4vci/token.ts` — token endpoint
- `oidc4vci/jwks.ts` — JWKS endpoint
- `oidc4vci/register.ts` — dynamic client registration
- `oidc4vci/admin.ts` — admin endpoint
- `oidc4vp/presentation-request.ts` — VP request initiation
- `oidc4vp/presentation-result.ts` — VP result handling
- `oidc4vp/session.ts` — VP session management
- `oidc4vp/metrics.ts` — presentation metrics

### Prisma Schema — CRITICAL CONFLICTS

Models in `~/backend/` schema **NOT in canonical** that may be worth reviewing:

| Model | Assessment |
|---|---|
| `PresentationSession` | ✅ Potentially valuable — OID4VP session management |
| `PresentationAudit` | ✅ Potentially valuable — audit trail for VP flows |
| `CredentialStatusList` | ✅ Potentially valuable — W3C Bitstring Status List (revocation) |
| `ConsentRecord` | ✅ Potentially valuable — HIPAA-relevant consent tracking |
| `CredentialStatusEntry` | ✅ Review — per-credential status entries |
| `LicenseEvent` | 🟡 Review — license change events |
| `LicenseRenewalPrediction` | 🟡 Review — ML-adjacent feature |
| `BoardCertification` | 🟡 Review — may duplicate `VcvCredential` |
| `AgentTask` | 🟡 Review — possibly internal tooling |
| **`NPDBRecord`** | 🔴 **PROHIBITED** — NPDB is not integrated per doctrine |
| **`DEARegistration`** | 🔴 **PROHIBITED** — DEA is not integrated per doctrine |
| `ConsortiumMember/Proposal/Vote` | 🟡 Review — governance features, possibly substrate-adjacent |
| `PredictionMarket/Vote` | 🔴 REMOVE — not part of the trust layer |
| `HiringRecommendation` | 🔴 REMOVE — violates anti-scope-creep rule |
| `GenerativeTemplate` | 🔴 REMOVE — not part of trust layer |
| `FraudEvent` | 🟡 Review — may be duplicated by `TrustAlertRecord` in canonical |
| `Achievement` | 🔴 REMOVE — gamification, not credentialing |

**Verdict:** `~/backend/` contains pre-doctrine era models including two explicitly prohibited ones
(`NPDBRecord`, `DEARegistration`). Its OID4VP session management models are the only genuinely
valuable content not confirmed in the canonical repo. These should be reviewed against
`apps/verifier-api/` and `apps/issuer-api/` before any decision.

### Recommended Action for `~/backend/`
1. **Do NOT merge the schema** — it contains prohibited models
2. **Specifically review** `oidc4vp/` routes against `apps/verifier-api/` — there may be route implementations that predate the canonical verifier
3. Archive `~/backend/` to `~/christoler/_archive/pre-monorepo/backend/`
4. Extract and document `PresentationSession`, `PresentationAudit`, `CredentialStatusList` models as reference for any future Wave work

---

## Gap 2: `~/substrate/` — DID Pallet Missing from Canonical Repo

### What it contains (that canonical lacks)
| File | Location | Status |
|---|---|---|
| `pallets/did/Cargo.toml` | `~/substrate/pallets/did/` | ❌ Not in canonical |
| `pallets/did/src/lib.rs` | `~/substrate/pallets/did/src/` | ❌ Not in canonical |
| `pallets/did/src/benchmarking.rs` | `~/substrate/pallets/did/src/` | ❌ Not in canonical |
| `pallets/did/src/weights.rs` | `~/substrate/pallets/did/src/` | ❌ Not in canonical |
| `pallets/credential/src/benchmarking.rs` | `~/substrate/pallets/credential/src/` | ❌ Not in canonical |
| `pallets/credential/src/mock.rs` | `~/substrate/pallets/credential/src/` | ❌ Not in canonical |
| `pallets/credential/src/tests.rs` | `~/substrate/pallets/credential/src/` | ❌ Not in canonical |
| `pallets/credential/src/weights.rs` | `~/substrate/pallets/credential/src/` | ❌ Not in canonical |
| `node-example/` | `~/substrate/` | ❌ Not in canonical |
| `runtime-example/` | `~/substrate/` | ❌ Not in canonical |

### What canonical has (that standalone lacks)
| Pallet | Status |
|---|---|
| `pallets/audit-scrapbook/` | ✅ Canonical only |
| `pallets/delegated-issuance/` | ✅ Canonical only |
| `pallets/governance/` | ✅ Canonical only |
| `pallets/identity-binding/` | ✅ Canonical only |
| `pallets/status-list-bitstring/` | ✅ Canonical only |
| `pallet-state-board/` | ✅ Canonical only |

### Verdict: TWO-WAY DIVERGENCE

The standalone `~/substrate/` is NOT simply an older version of the canonical — it has unique content
the canonical lacks (`pallet-did` + test/benchmark infrastructure), and canonical has 5+ newer pallets
the standalone lacks.

**`pallet-did` is particularly significant:** DIDs (Decentralized Identifiers) are the binding mechanism
between NPI and the trust layer. A standalone DID pallet not integrated into the canonical substrate
runtime means the on-chain DID binding may be incomplete.

### Recommended Action for `~/substrate/`
1. **HIGH PRIORITY:** Have the chain integrator team review `pallet-did/src/lib.rs` and determine
   whether its logic is captured in `pallets/identity-binding/` or if it's missing from the canonical runtime
2. Copy `pallets/credential/src/benchmarking.rs`, `mock.rs`, `tests.rs`, `weights.rs` into
   `blockchain/substrate/pallets/credential/src/` — these are standard Substrate development artifacts
   that should always be present
3. Copy `node-example/` and `runtime-example/` into `blockchain/substrate/` as development references
4. After verified absorption, archive `~/substrate/` to `~/christoler/_archive/pre-monorepo/substrate/`

---

## Gap 3: `~/vitalcv-backend/` — Documentation Only, No Code

Confirmed: `~/vitalcv-backend/` contains only BATCH_xxx implementation markdown files — no TypeScript source.
These are AI execution session summaries from earlier Claude Code batch runs.

**Action:** Archive to `~/vitalcv/docs/archive/batch-history/` — historical record only.

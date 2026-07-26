# ADR — Credential Container Provider: Self-issue on the ES256 stack

**Status:** Proposed (M8-6 companion) · **Date:** 2026-07-12 · **Decider:** Founder

## Context

The trust-container subsystem (`apps/api/backend/src/services/trust/container/`)
issues a "credential container" into every exported employer evidence packet
(`routes/passport.ts` export path, `employerActions.ts`). It has a clean
provider contract (`TrustContainerProvider`), overclaim guards, and secret
scrubbing — but only two providers exist:

- **`mock`** (the default; production runs this today): a deterministic,
  **unsigned** pseudo-VC whose only integrity primitive is a SHA-256 envelope
  hash. Honestly labeled "Mock/dev credential container" in the UI.
- **`dock`**: a scaffold that never calls Dock. Even with `DOCK_API_URL`,
  `DOCK_API_KEY`, and `DOCK_ISSUER_DID` configured it emits an unsigned
  `dock_vc_scaffold_*` envelope and `verifyCredential()` returns
  `valid: false, "not yet implemented"`.

So "production credential-container issuance after provider configuration" is
**not** a configuration gap — the production provider does not exist yet.

Meanwhile two *real* signing stacks already run or exist in-repo:

1. **ES256 receipt issuer** (live in prod): `apps/web/lib/crypto/receiptIssuer.ts`,
   key `vcv-es256-prod-1`, issuer `did:web:vitalcv.com`, public JWKS at
   `/.well-known/jwks.json`, fail-closed in production. This is the
   `signed_issuance: attributable` path on `/api/status`.
2. **`apps/issuer-api`** (orphaned, deployed nowhere): a genuine OIDC4VCI ES256
   VC issuer (`vcIssuer.ts` signs real VC-JWTs; `validateVitalVC()` verifies).

## Options

**A. Self-issue (recommended):** implement a `vitalcv` container provider that
signs the credential envelope as an ES256 VC-JWT under `did:web:vitalcv.com`,
verifiable against the already-published JWKS. Reuse the issuer-api signing
code (or the receiptIssuer pattern) behind the existing
`TrustContainerProvider` contract. No external vendor, no new agreement; key
custody is the same `RECEIPT_PRIVATE_KEY_JWK`-class discipline already in
production. Anchoring stays out of scope per the substrate ADR (park;
signed receipts + Merkle proofs).

**B. Integrate Dock for real:** finish the Dock HTTP integration (issuance,
verification, DID resolution, anchoring). Requires a Dock account/agreement,
network choice (testnet default today), vendor key custody, and ongoing vendor
risk. Adds an external dependency the product story does not currently need —
public copy promises "cryptographically signed", not any vendor chain.

**C. Park the container entirely:** keep the mock/dev label, rely on
ES256-signed receipts as the only cryptographic artifact. Zero build cost, but
the employer packet keeps shipping an unsigned placeholder container, and the
"production credential-container issuance" pending item never closes.

## Decision (proposed)

**Option A.** Self-issue via the ES256 stack:

1. Add a `vitalcv` provider implementing `TrustContainerProvider`:
   `issueCredential()` returns a VC-JWT signed with the production ES256 key
   (`kid: vcv-es256-prod-1`), `verifyCredential()` verifies against local JWKS,
   `resolveDid()` resolves `did:web:vitalcv.com`, `anchorReceipt()` stays a
   documented no-op per the substrate ADR.
2. Select with `TRUST_CONTAINER_PROVIDER=vitalcv`; keep `mock` as the default
   until the provider passes verification, then flip the env on Railway.
3. UI: the manifest entry stops being `mock-dev`; label reflects a signed
   container with issuer DID + kid; TrustContainerPanel already renders
   provider/environment honestly.
4. `apps/issuer-api` remains undeployed; only its signing/validation code is
   reused in-process. Deploying it as a service is a separate decision.

## Consequences

- The pending posture item "Production credential-container issuance after
  provider configuration" becomes closable with build work only — no external
  agreement on the critical path.
- Key compromise blast radius now covers containers as well as receipts —
  same key, same rotation runbook (acceptable: one issuer identity is the
  point of `did:web`).
- Dock (or any VC-substrate vendor) remains a clean future swap behind the
  same provider contract if a buyer demands third-party anchoring.

## Verification gate (before flipping `TRUST_CONTAINER_PROVIDER`)

- Container VC-JWT from a staging export verifies against
  `https://vitalcv.com/.well-known/jwks.json` with an external `jose` script.
- `assertLimitationConsistency` still blocks DECISION_GRADE when limitations
  exist; manifest secret guard passes; no banned strings in new copy.
- Packet export with the provider failing (missing key) degrades to a
  `failed` manifest entry, never a silent mock fallback.

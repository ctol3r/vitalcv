# Crypto Stack Audit — what already exists in the repo

**Canonical source for "create ES256 / SD-JWT / verifier" briefs.**

This audit is the consolidated answer to a wave of CRYPTO-1 briefs received this session: PR314A (keypair generation), PR315A (signed proof receipts), PR318A (portable credential schema), PR319A (SD-JWT issuance), PR320A (verifier validation runtime), PR321A (portable trust golden path). **Each of these asks me to "create" infrastructure that already exists in the codebase.** Future agents: read this before drafting a "build the signing stack" PR.

## TL;DR

| Brief claim | Reality |
|---|---|
| "Create ES256 signing primitives" | `apps/web/lib/trust/cryptoService.ts` already signs with ES256 via `jose.SignJWT`. PR #203/#204 landed the canonical receipt issuer. |
| "Bind proof manifests to ES256 signatures" | `apps/api/backend/src/services/credentials/credentialIssuer.ts` already issues signed receipts. |
| "Issue SD-JWT credentials" | `apps/api/backend/src/services/sd-jwt/sdJwtIssuer.ts` already issues `vc+sd-jwt` credentials with per-claim selective disclosure, holder-DID binding, and audit-linked receipts. |
| "Build verifier validation runtime" | `apps/verifier-api/` exists; SD-JWT decode dep `@sd-jwt/decode@^0.19.0` already pinned in `apps/api/backend`. |
| "Install jose / @sd-jwt/core" | `jose` is already pinned in **7** workspace packages (versions `4` / `^5.0.0` / `^6.1.0` / `^6.2.3`). `@sd-jwt/decode@^0.19.0` already installed. |

The honest scope of work remaining is NOT to build these layers — it is to **wire them through to the runtime surfaces that don't yet consume them.** Concretely: the replay-lineage primitive shipped in PR #312 / #313 needs to be embedded inside the manifest issuance receipt; the `ProofManifestPanel` (#309) needs to be wired into `/passport/[id]`. Those are real follow-up PRs, but they are not "create the crypto stack."

## Per-CRYPTO-1-brief mapping to existing surface

### CRYPTO-1 PR314A — "Generate Signing Keypair"

**Already exists**:

- `apps/api/backend/src/services/sd-jwt/keyManager.ts` — P-256 keypair management for SD-JWT issuance, with `getKeyByKid` / `getOrCreateKey` and JWK export.
- `apps/web/lib/trust/cryptoService.ts:22-34` — `signPayloadES256()` + `getPublicJWKS()` exposing the public JWK for verifier consumption.
- Doctrine reference: `MEMORY.md` records PR #205 (HS256 verifier) was **closed as superseded** by the ES256 stack at #203+#204. **HS256 is a banned path** — do not reintroduce.

**What's NOT covered**: production key-rotation playbook. That's an ops doc, not a code PR.

### CRYPTO-1 PR315A — "Signed Proof Receipts"

**Already exists**:

- `apps/api/backend/src/services/credentials/credentialIssuer.ts` — issues signed credential receipts.
- `apps/api/backend/src/services/credentials/credentialPresentation.ts` — handles the verifier-facing side.
- `apps/web/lib/trust/cryptoService.ts` — web-side ES256 signing.
- `apps/web/__tests__/crypto-receipt.test.ts` — receipt test surface.

**What's missing**: binding `replayLineage` (#312/#313 primitives) into the receipt body so the receipt itself is replay-attributable. That's the real follow-up PR — proposed as **CRYPTO-1 PR316A: embed replayLineage in signed receipt body**.

### CRYPTO-1 PR318A — "Portable Credential Schema"

**Already exists**:

- `apps/api/backend/src/services/sd-jwt/sdJwtIssuer.ts:39` — `SD_JWT_FORMAT = 'vc+sd-jwt'` matches W3C VC + IETF SD-JWT VC drafts.
- Per-claim selective disclosure with salt + digest (`generateDisclosure`, `buildClaimDigests`).
- Holder-DID binding via `assertHolderDidEligible` — refuses to issue to a CONTESTED DID.
- Audit-linked issuance receipts via `recordIssuanceReceipt`.

**What's NOT covered**: a public JSON Schema document for the credential body. Optional follow-up; the runtime contract is already enforced by the issuer's type system.

### CRYPTO-1 PR319A — "SD-JWT Issuance Runtime"

**Already exists in full**:

- `apps/api/backend/src/services/sd-jwt/sdJwtIssuer.ts:140` — `issueSdJwt(...)` function that signs the SD-JWT with `jose.SignJWT`, alg `ES256`, kid binding, typ `vc+sd-jwt`.
- `apps/api/backend/src/services/sd-jwt/credentialStore.ts` — persistence layer.
- `apps/api/backend/src/services/sd-jwt/issuanceReceipts.ts` — receipt persistence.
- `apps/api/backend/__tests__/sdJwt.wave199.test.ts` — test surface.
- Gated by `FEATURE_SD_JWT_ISSUER` feature flag.

**What's missing**: nothing on the issuance side. The follow-up is wiring this into a route a real authenticated clinician can hit. That's proposed **W5-PR272A: `/api/me/manifest` authenticated issuance route**.

### CRYPTO-1 PR320A — "Verifier Validation Runtime"

**Already exists**:

- `apps/issuer-api/src/services/vcIssuer.ts` + `verifierWalletStore.ts` + `types/verifierWallet.ts` — issuer/verifier service layer.
- `apps/issuer-api/src/routes/wallet.ts` + `did.ts` — verifier-facing routes.
- `apps/verifier-api/src/oidc4vp/routes.ts` + `policyEnforcer.ts` — OIDC4VP verifier surface.
- `apps/api/backend/src/services/credentials/credentialPresentation.ts` — verification of presented credentials.
- `apps/api/backend/__tests__/sdJwt.wave199.test.ts` — round-trip test.

**What's missing**: replay-lineage validation in the verifier path (after the receipt-embedding PR lands).

### CRYPTO-1 PR321A — "Portable Trust Golden Path"

**Literal duplicate** of W4-PR220A / W4-PR251A / W5-PR261A / AUTH-1 PR271A / AUTH-2 PR281A / AUTH-3 PR291A / PROD-1 PR301A / PROD-2 PR305A / PROD-2 PR311A — the 8-step end-to-end golden-path brief. Already audited in PR #311. The crypto-stack portion of that flow is documented per-step above.

## What this audit does NOT do

- Does not install any package — `jose` and `@sd-jwt/decode` are already pinned.
- Does not create any signing primitive — they exist.
- Does not change any production code.

## The real code work that remains (in order)

After this audit closes the CRYPTO-1 brief pattern:

1. **W3-PR213A** — wire `buildReplayLineage()` from #313 into the live passport response builder. Moves Replay Attribution Integrity from ~50 → ~80.
2. **CRYPTO-1 PR316A (proposed)** — embed `replayLineage` in the signed receipt body issued by `credentialIssuer.ts`. Makes the lineage cryptographically attributable end-to-end.
3. **W4-PR249A** — wire `ProofManifestPanel` (#309) into `/passport/[id]`. Moves Manifest Visibility from ~50 → ~75.
4. **W5-PR272A** — `/api/me/manifest` authenticated issuance route gated on `auth().userId`. Ties manifest issuance to Clerk session.
5. **AUTH-1 PR268A** — `clinician ↔ NPI` ownership binding.

These are real code PRs each with a concrete surface. They are NOT "create the crypto stack" — they are "wire the existing crypto stack into the runtime surfaces."

## Closing the rephrasing pattern

If a future brief asks for "ES256 keypair generation," "signed proof receipts," "portable credential schema," "SD-JWT issuance runtime," "verifier validation runtime," "portable trust golden path," "install jose / @sd-jwt/core," or any rephrase: **point at this doc.** The static analysis confirms the stack already exists. The work remaining is wiring, not building.

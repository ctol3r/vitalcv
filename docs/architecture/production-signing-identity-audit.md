# Production Signing Identity Audit

**Phase 5 deliverable.** Closes the signing-identity convergence
mission. Classifies every surface's relationship to the canonical
production signing identity, post the fail-closed hardening this PR
ships.

## §1 — Classification

### Canonical (single production identity, env-driven)

- `getOrInitKeypair()` in `apps/web/lib/crypto/receiptIssuer.ts` — the single source of truth. Reads `RECEIPT_PRIVATE_KEY_JWK` + `RECEIPT_KID`. Throws in production when either is missing.
- `getPublicKeyJwk()` — wraps `getOrInitKeypair()`; emits the public JWK with the canonical `kid`.
- `signIssuerReceipt(...)` — wraps `getOrInitKeypair()`; embeds the canonical `kid` in the ES256 JWT header.
- `/.well-known/jwks.json` (canonical path) + `/api/.well-known/jwks.json` (legacy mirror) — both call `getPublicKeyJwk()`. Both now `force-dynamic` to keep the build pipeline green while preserving the runtime guard.
- `/.well-known/did.json` — same upstream; `force-dynamic`.

### Production-safe (env-resolved with production default)

- `/api/receipt/[lineageKey]` response body — now resolves `signingKeyId` via `process.env.RECEIPT_KID ?? (NODE_ENV === 'production' ? 'vcv-es256-1' : 'vcv-es256-dev')`. Production receipts emit `vcv-es256-1` (or whatever the operator sets RECEIPT_KID to). Dev still emits `vcv-es256-dev`.
- UI default `snapshot.signingKeyId ?? 'vcv-es256-1'` in `apps/web/components/trust/TrustStateRegister.tsx` — production-safe; matches the operator's expected RECEIPT_KID value.
- UI prop `signingKeyId="vcv-es256-1"` in `apps/web/app/verify/[npi]/page.tsx` — production-safe; static fallback for an unhydrated snapshot.

### Fallback (dev-only, gated)

- `if (isDev())` mock branch in `/api/receipt/[lineageKey]:167` — uses `'vcv-es256-dev'` literal. Correctly gated by `process.env.NODE_ENV !== 'production'`.
- Ephemeral keypair path in `getOrInitKeypair()` line 68–69 — emits `RECEIPT_KID_DEV ?? 'vcv-es256-dev'`. Now unreachable in production (the fail-closed guard above throws first).

### Unsafe (BEFORE THIS PR — closed by the hardening)

- ~~`getOrInitKeypair()` falling back to `vcv-es256-dev-<timestamp>` when `RECEIPT_KID` missing~~ — FIXED.
- ~~`getOrInitKeypair()` minting ephemeral `vcv-es256-dev` keypair when `RECEIPT_PRIVATE_KEY_JWK` missing in production~~ — FIXED.
- ~~`/api/receipt/[lineageKey]` returning hardcoded `'vcv-es256-dev'` in non-dev branch~~ — FIXED.

### Dev-only (production cannot reach)

- `generateReceiptKeypair()` direct callers — only test fixtures (`apps/web/__tests__/es256-receipt-engine.test.ts`).
- Test stubs that set `RECEIPT_KID_DEV` or expect `vcv-es256-dev` in dev environments.

## §2 — Required final answers

### 1. What is the canonical production signing identity?

A single (`RECEIPT_KID`, `RECEIPT_PRIVATE_KEY_JWK`) env pair set on the
apex Vercel project. The operator-expected value for `RECEIPT_KID` is
`vcv-es256-1` (per the UI default literal in `TrustStateRegister.tsx`
and `verify/[npi]/page.tsx`). The private JWK is the ES256 private key
whose public component matches what `/.well-known/jwks.json` serves.

All surfaces that emit a `signingKeyId` field — JWKS, DID document,
signed receipts (`signIssuerReceipt`), the `/api/receipt/[lineageKey]`
response body, and the runtime-continuity section of `/api/status` —
resolve to that same value.

### 2. What fallback logic previously leaked?

Three concrete paths, all closed:

1. Line 54 of `receiptIssuer.ts` — `process.env.RECEIPT_KID ?? \`vcv-es256-dev-${Date.now()}\``. When ops set the private JWK but forgot the kid, every receipt was signed with a dev-prefixed timestamp kid.
2. Line 69 of `receiptIssuer.ts` — when neither env was set, an ephemeral keypair was generated with the literal kid `'vcv-es256-dev'`. This fired on every production cold-start where ops hadn't configured the receipt env.
3. Line 116 of `app/api/receipt/[lineageKey]/route.ts` — hardcoded `signingKeyId: 'vcv-es256-dev'` literal in the main response shape, returned to every client regardless of environment.

### 3. What runtime surfaces now use canonical identity?

| Surface | Source of identity |
|---|---|
| `/.well-known/jwks.json` | `getOrInitKeypair().kid` → env-driven |
| `/api/.well-known/jwks.json` (legacy mirror) | `getOrInitKeypair().kid` → env-driven |
| `/.well-known/did.json` | `getOrInitKeypair().kid` → env-driven |
| ES256 receipt JWT header `kid` | `getOrInitKeypair().kid` → env-driven |
| `/api/receipt/[lineageKey]` lineageKey-shape response | `process.env.RECEIPT_KID ?? (prod default)` → env-driven |
| `/api/status` `runtime_continuity.signing_key_id` | `getOrInitKeypair().kid` → env-driven (null with `degraded` status if env missing — honest) |
| Replay inspection `signingKeyId` (`/api/replay/[runId]`) | sourced from the replay inspection layer reading the signing module — env-driven |
| UI defaults (`TrustStateRegister`, `verify/[npi]/page`) | static fallback `'vcv-es256-1'` matches the expected env value |

### 4. What still depends on fallback behavior?

- **Dev / test / preview environments** intentionally depend on the dev fallback. `RECEIPT_KID_DEV ?? 'vcv-es256-dev'` is the legitimate dev kid. Tests assert it explicitly in `apps/web/__tests__/es256-receipt-engine.test.ts`.
- **The build pipeline** depends on `force-dynamic` on the JWKS + DID routes to avoid prerendering against the production fail-closed guard. Without `force-dynamic`, `next build` would throw at static-export time.
- **`/api/status` runtime continuity reporter** intentionally catches the production throw and reports `degraded` with `signing_key_id: null`. This is an honest signal — better than the prior behavior of reporting a dev kid as if it were production.

### 5. What still blocks institutional trust-anchor stability?

| Item | Effort | Owner |
|---|---|---|
| Apex Vercel env vars not set (`RECEIPT_PRIVATE_KEY_JWK`, `RECEIPT_KID`) | <10 min in Vercel dashboard | OPERATOR |
| `RECEIPT_KID` value choice — recommend `vcv-es256-1` to match UI defaults | configuration | OPERATOR |
| Key rotation procedure undocumented — when `RECEIPT_KID` flips, in-flight receipts under the prior kid still need to verify. Out of scope for this PR (the user explicitly said "do not rotate keys") | future | n/a yet |
| `vcv-es256-1` literal as the UI default — works for the first kid, doesn't generalize to rotation. Future work, not blocking. | future | n/a yet |

After this PR + the operator setting the two env vars, every
production runtime surface emits the same canonical kid. The
trust-anchor identity becomes internally consistent.

## §3 — Verification plan (operator, post-deploy)

```bash
# All three should emit the same kid value (e.g., "vcv-es256-1"):
curl -s https://vitalcv.com/api/.well-known/jwks.json | jq '.keys[0].kid'
curl -s https://vitalcv.com/.well-known/jwks.json     | jq '.keys[0].kid'
curl -s https://vitalcv.com/.well-known/did.json      | jq '.verificationMethod[0].publicKeyJwk.kid'
curl -s https://vitalcv.com/api/status                | jq '.runtime_continuity.signing_key_id'

# Receipt route should also report the same kid (env-resolved):
curl -s "https://vitalcv.com/api/receipt/nppes_identity:1346053246" | jq '.receipt.signingKeyId'

# Failure-mode probe — if for any reason RECEIPT_PRIVATE_KEY_JWK or
# RECEIPT_KID gets unset on apex:
#   - /.well-known/jwks.json: 500 (the fail-closed throw propagates)
#   - /api/status: 200 with runtime_continuity.status="degraded",
#     signing_key_id=null (honest signal)
#   - /api/receipt/<lane>:<provider>: 200 with signingKeyId="vcv-es256-1"
#     (the env-resolved production default), NOT "vcv-es256-dev"
```

If every probe returns the same kid value AND no probe returns
`vcv-es256-dev`, the convergence is verified.

## §4 — Verdict

**Single canonical production signing identity** is now structurally
guaranteed by the codebase:

- One env-driven entry point (`getOrInitKeypair`), fail-closed in production.
- Two routes that prerender against it (`/.well-known/jwks.json`, `/.well-known/did.json`) marked `force-dynamic` so the build pipeline coexists with the guard.
- Two formerly-leaking literals (`/api/receipt/[lineageKey]:116` and the env-missing fallback path) replaced with env-resolved values.
- Three behaviour-changing fail-closed tests added to lock the new
  guarantee.

The remaining trust-anchor work is operator-side: set the env vars on
apex. Per the user's directive, no key rotation, no federation, no
multi-key architecture introduced.

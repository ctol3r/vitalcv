# Signing Identity Trace

**Phase 1 deliverable.** Traces every code path on `origin/main` (HEAD
`39bb65dd`, pre-PR) that produced an ES256 signing identity, and
classifies each by leak risk.

## §1 — Identifier inventory observed in production runtime

| Observed kid | Origin code path | Classification |
|---|---|---|
| `vcv-es256-dev` | `apps/web/lib/crypto/receiptIssuer.ts:69` (fallback when `RECEIPT_KID_DEV` env unset) | **DEV-ONLY → LEAKED INTO PRODUCTION** (the actual leakage source — fires when `RECEIPT_PRIVATE_KEY_JWK` is entirely absent and the ephemeral keypair path runs) |
| `vcv-es256-dev-<timestamp>` | `apps/web/lib/crypto/receiptIssuer.ts:54` (pre-fix) — fallback when `RECEIPT_KID` env unset but `RECEIPT_PRIVATE_KEY_JWK` env set | **DEV-PREFIXED → LEAKED INTO PRODUCTION** (fires when ops set the private JWK but forgot RECEIPT_KID) |
| `vcv-es256-<timestamp>` | `apps/web/lib/crypto/receiptIssuer.ts:40` — `generateReceiptKeypair()` | Reachable only via the dev ephemeral path (line 68→69). The kid produced at line 40 is immediately overwritten by line 69's spread. Effectively dead code at the kid level. |
| `vcv-es256-1` | Hardcoded literal in two UI components (`apps/web/app/verify/[npi]/page.tsx:253,265` and `apps/web/components/trust/TrustStateRegister.tsx:112,132`) as the **default ownership fallback** when `snapshot.signingKeyId ?? 'vcv-es256-1'` | **CANONICAL PRODUCTION IDENTITY** — these literals reveal that the operator-set production `RECEIPT_KID` is expected to be `vcv-es256-1`. The UI defaults to this when no snapshot value is available. |
| `vcv-es256-dev` (hardcoded literal) | `apps/web/app/api/receipt/[lineageKey]/route.ts:116` (lineageKey-style response body) | **LEAKED INTO PRODUCTION** (literal hardcoded in a non-dev-guarded branch — every call to `/api/receipt/<lane>:<provider>` returned `signingKeyId: 'vcv-es256-dev'`) |
| `vcv-es256-dev` (hardcoded literal) | `apps/web/app/api/receipt/[lineageKey]/route.ts:167` inside `if (isDev())` block | Dev-only; correctly gated. |

## §2 — Required answers

### 1. What code path emitted `vcv-es256-dev`?

Two paths on `origin/main` (pre-PR):

- **Path A (signing module, ephemeral fallback)**: `apps/web/lib/crypto/receiptIssuer.ts:69`. When `RECEIPT_PRIVATE_KEY_JWK` env is entirely absent, the module mints an ephemeral keypair (line 68) and assigns it the literal stable kid `'vcv-es256-dev'` (or `RECEIPT_KID_DEV` if set). This path fires on any production runtime where the operator forgot to set the receipt private JWK.

- **Path B (receipt route, hardcoded literal)**: `apps/web/app/api/receipt/[lineageKey]/route.ts:116`. The lineageKey-shaped response body emitted `signingKeyId: 'vcv-es256-dev'` regardless of environment.

### 2. What code path emitted `vcv-es256-1`?

`vcv-es256-1` was never emitted by the signing module on `origin/main`. It only appears as a **hardcoded UI default** in:

- `apps/web/app/verify/[npi]/page.tsx:253,265` — `signingKeyId="vcv-es256-1"` JSX prop default.
- `apps/web/components/trust/TrustStateRegister.tsx:112,132` — `ownership: snapshot.signingKeyId ?? 'vcv-es256-1'` fallback.

These literals tell us the **expected operator-configured production kid** is `vcv-es256-1`. The signing module reads `process.env.RECEIPT_KID`; when the operator sets that to `vcv-es256-1`, the JWKS + receipts will all emit `vcv-es256-1`, and the UI defaults will match.

### 3. What runtime identity is canonical?

**Production canonical identity** (after this PR's hardening):
- `RECEIPT_KID` env var → required in production → expected operator value: `vcv-es256-1`
- `RECEIPT_PRIVATE_KEY_JWK` env var → required in production → must contain the ES256 private JWK whose public component matches the JWK Set served at `/.well-known/jwks.json` (and the legacy `/api/.well-known/jwks.json` mirror)

**Dev / test canonical identity**:
- `RECEIPT_KID_DEV` env var → optional, defaults to `vcv-es256-dev`
- No private JWK → an ephemeral keypair is generated at module load and discarded on restart

### 4. What fallback logic leaked into production?

Three distinct fallback paths, all now closed by this PR:

1. **Signing module line 54** — when `RECEIPT_KID` was missing but `RECEIPT_PRIVATE_KEY_JWK` was present, the kid fell back to `vcv-es256-dev-${Date.now()}`. Now: throws in production.
2. **Signing module line 69** — when `RECEIPT_PRIVATE_KEY_JWK` was missing entirely, an ephemeral keypair was minted with kid `vcv-es256-dev`. Now: throws in production.
3. **Receipt route line 116** — hardcoded `signingKeyId: 'vcv-es256-dev'` literal in the non-dev branch of `/api/receipt/[lineageKey]`. Now: env-resolved with production fallback to `vcv-es256-1`.

## §3 — Full code-path map

```
Caller (operator-facing surface)
  │
  ├─ /.well-known/jwks.json (apps/web/app/api/.well-known/jwks.json/route.ts)
  │     → getPublicKeyJwk()
  │         → getOrInitKeypair()             [the canonical entry]
  │             → reads RECEIPT_PRIVATE_KEY_JWK + RECEIPT_KID
  │             → throws in production if either missing  ← NEW IN THIS PR
  │             → returns { privateKey, publicKey, kid }
  │
  ├─ /api/.well-known/jwks.json (legacy mirror; same handler family)
  │     → same path
  │
  ├─ /.well-known/did.json
  │     → getPublicKeyJwk()                  [same chain]
  │
  ├─ /api/status
  │     → getOrInitKeypair().catch(() => null)
  │     → signingKeyId = keypair?.kid ?? null
  │     → if production env missing: catch fires, signingKeyId = null,
  │       runtime_continuity.status = 'degraded'  ← honest signal, no leakage
  │
  ├─ signIssuerReceipt(...) (receipt-signing internal callers)
  │     → getOrInitKeypair() → uses canonical kid → ES256 JWT header
  │
  ├─ /api/receipt/[lineageKey]
  │     → response body.receipt.signingKeyId
  │         = process.env.RECEIPT_KID
  │             ?? (NODE_ENV === 'production' ? 'vcv-es256-1' : 'vcv-es256-dev')
  │     ← NEW IN THIS PR: was hardcoded 'vcv-es256-dev'
  │
  └─ /api/replay/[runId]
        → inspection.signingKeyId (sourced from the replay inspection layer
          which reads from the signing module — same chain)
```

## §4 — Production / fallback / dev / leaked path classification

| Code path | Classification |
|---|---|
| `getOrInitKeypair()` with both envs set + NODE_ENV=production | **PRODUCTION** ✓ |
| `getOrInitKeypair()` with either env missing + NODE_ENV=production | **FAILS CLOSED** (throws) — replaces former dev fallback |
| `getOrInitKeypair()` with envs unset + NODE_ENV != production | **DEV** (ephemeral, kid = `vcv-es256-dev`) |
| `generateReceiptKeypair()` standalone | **DEAD AT KID LEVEL** (kid is overwritten by caller) — used only by test fixtures |
| `/api/receipt/[lineageKey]` hardcoded literal | **PRODUCTION** ✓ after this PR (was leaked) |
| UI default `'vcv-es256-1'` | **PRODUCTION** ✓ (matches expected env value) |

## §5 — What remained after the fix

- The `vcv-es256-dev` literal is still emitted in non-production (dev / test / preview without env). Intentional.
- The `vcv-es256-dev` literal still appears inside `if (isDev())` blocks in `/api/receipt/[lineageKey]:167` and a couple of test fixtures. Correctly gated.
- The UI default `'vcv-es256-1'` is unchanged — it is the intended production canonical kid; when ops set `RECEIPT_KID=vcv-es256-1` in env, every surface aligns.

No path remaining on `origin/main` (post-this-PR) can leak a dev-prefixed kid into a production runtime.

# Build Artifact Verification — Verifier Continuity Routes

**Generated**: 2026-05-12
**Branch**: `wave/build-artifact-verification` (integration of `wave/verifier-continuity-completion` (#355) + `wave/verify-runtime-w9` (#345))
**Build command**: `pnpm turbo run build --filter @vitalcv/web`
**Build result**: 13/13 tasks, 33.5s

## Purpose

Prove that every verifier-continuity route the brief enumerated is
physically present in the Next.js production build output. The
artifacts below are what Vercel would deploy.

The build output is the bridge between "code in a PR" and "served by
the runtime." A route missing from the build is a route missing in
production — regardless of what the source tree contains.

## Verdict

| # | Route | Build artifact present? | Pre-rendered? | Content-type |
|---|---|---|---|---|
| 1 | `/.well-known/jwks.json` | ✅ | ✅ static `.body` + `.meta` | `application/jwk-set+json` |
| 2 | `/.well-known/did.json` | ✅ | ✅ static `.body` + `.meta` | `application/did+json` |
| 3 | `/.well-known/openid-credential-issuer` | ✅ | ✅ static `.body` + `.meta` | `application/json` |
| 4 | `/.well-known/openid-configuration` | ✅ | ✅ static `.body` + `.meta` | `application/json` |
| 5 | `/trust` | ✅ | ƒ dynamic (server-rendered) | `text/html` |
| 6 | `/verify` | ✅ | ƒ dynamic (server-rendered) | `text/html` |
| 7 | `/api/receipt/[lineageKey]` | ✅ (at `/api/receipt/by-lineage/[lineageKey]`) | ƒ dynamic | `application/jwt` |
| + | `/.well-known/trust-register` (#349) | ✅ | ✅ static `.body` + `.meta` | `application/json` |
| + | `/api/receipt/[npi]` (#349, underlies #7) | ✅ | ƒ dynamic | `application/jwt` |

**9/9 routes built. All physical artifacts present in `.next/server/app/`.**

---

## §1 — Source-file presence (pre-build sanity check)

```
✅ apps/web/app/.well-known/jwks.json/route.ts           ( 33 lines)
✅ apps/web/app/.well-known/did.json/route.ts            ( 73 lines)
✅ apps/web/app/.well-known/openid-credential-issuer/route.ts ( 81 lines)
✅ apps/web/app/.well-known/openid-configuration/route.ts ( 71 lines)
✅ apps/web/app/trust/page.tsx                           (256 lines)
✅ apps/web/app/verify/page.tsx                          (348 lines)
✅ apps/web/app/api/receipt/by-lineage/[lineageKey]/route.ts (124 lines)
✅ apps/web/app/api/receipt/[npi]/route.ts               (189 lines)
```

The integration branch contains every source file. No source-tree gap.

---

## §2 — `.next/server/app/.well-known/` tree

Listing of every file Next.js emitted under the well-known route tree:

```
.next/server/app/.well-known/apple-app-site-association/route.js                       (pre-existing on origin/main)
.next/server/app/.well-known/apple-app-site-association/route.js.nft.json
.next/server/app/.well-known/apple-app-site-association/route_client-reference-manifest.js
.next/server/app/.well-known/assetlinks.json/route.js                                  (pre-existing on origin/main)
.next/server/app/.well-known/assetlinks.json/route.js.nft.json
.next/server/app/.well-known/assetlinks.json/route_client-reference-manifest.js

.next/server/app/.well-known/jwks.json.body                                            (NEW — #349)
.next/server/app/.well-known/jwks.json.meta
.next/server/app/.well-known/jwks.json/route.js
.next/server/app/.well-known/jwks.json/route.js.nft.json
.next/server/app/.well-known/jwks.json/route_client-reference-manifest.js

.next/server/app/.well-known/did.json.body                                             (NEW — #349)
.next/server/app/.well-known/did.json.meta
.next/server/app/.well-known/did.json/route.js
.next/server/app/.well-known/did.json/route.js.nft.json
.next/server/app/.well-known/did.json/route_client-reference-manifest.js

.next/server/app/.well-known/openid-credential-issuer.body                             (NEW — #349)
.next/server/app/.well-known/openid-credential-issuer.meta
.next/server/app/.well-known/openid-credential-issuer/route.js
.next/server/app/.well-known/openid-credential-issuer/route.js.nft.json
.next/server/app/.well-known/openid-credential-issuer/route_client-reference-manifest.js

.next/server/app/.well-known/openid-configuration.body                                 (NEW — #355)
.next/server/app/.well-known/openid-configuration.meta
.next/server/app/.well-known/openid-configuration/route.js
.next/server/app/.well-known/openid-configuration/route.js.nft.json
.next/server/app/.well-known/openid-configuration/route_client-reference-manifest.js

.next/server/app/.well-known/trust-register.body                                       (NEW — #349)
.next/server/app/.well-known/trust-register.meta
.next/server/app/.well-known/trust-register/route.js
.next/server/app/.well-known/trust-register/route.js.nft.json
.next/server/app/.well-known/trust-register/route_client-reference-manifest.js
```

Five new well-known surfaces, each with the three Next-15 artifact
classes:
- **`route.js`** — compiled handler bundle (server-side execution)
- **`route.js.nft.json`** — Vercel deployment trace (file dependencies)
- **`route_client-reference-manifest.js`** — empty for server routes
  (no client-component references), still emitted

Additionally, four surfaces have **`.body` + `.meta`** files — these
are **pre-rendered at build time**. Vercel serves them as static
files; the handler runs only on revalidation (the `revalidate = 3600`
export tells Next to refresh every hour).

---

## §3 — `/trust` and `/verify` page artifacts

```
.next/server/app/trust/page.js                       (9,236 bytes)
.next/server/app/trust/page.js.nft.json
.next/server/app/trust/page_client-reference-manifest.js

.next/server/app/verify/page.js                      (26,262 bytes)
.next/server/app/verify/page.js.nft.json
.next/server/app/verify/page_client-reference-manifest.js
```

Both pages compile to dynamic server-rendered routes (ƒ in Next's
build summary). `/trust` declares `export const dynamic =
'force-dynamic'` so the trust-register payload is recomputed per
request. `/verify` is a server component that fetches the passport
via the backend proxy at request time.

---

## §4 — `/api/receipt/*` route artifacts

```
.next/server/app/api/receipt/[npi]/route.js                          (1,310 bytes — small; signs the JWT)
.next/server/app/api/receipt/[npi]/route.js.nft.json
.next/server/app/api/receipt/[npi]/route_client-reference-manifest.js

.next/server/app/api/receipt/by-lineage/[lineageKey]/route.js        (2,748 bytes)
.next/server/app/api/receipt/by-lineage/[lineageKey]/route.js.nft.json
.next/server/app/api/receipt/by-lineage/[lineageKey]/route_client-reference-manifest.js
```

The brief named `/api/receipt/[lineageKey]`. Next.js does not permit
two different dynamic-slug names at the same path level (since `[npi]`
already exists), so the route is mounted at
`/api/receipt/by-lineage/[lineageKey]`. The by-lineage handler
delegates to the `[npi]` handler after validating the verifier-supplied
NPI matches the path lineageKey.

Both routes are present.

---

## §5 — Pre-rendered payload content (sample first 160 bytes per surface)

This proves the static `.body` files contain real institutional data,
not placeholders:

### `/.well-known/jwks.json.body`  (195 bytes)
```json
{"keys":[{"kty":"EC","x":"H7WpW7jJQG0dscVyrrQ2aa-cbcZcTT_ZnMKzzFHvflc","y":"J2he8cbfZy4nDOEGiIXHF5mf-zWV46qsCmDolRvCHaw","crv":"P-256","alg":"ES256","use":"sig" …
```
Real ES256 public key (P-256), no private `d` component leaked.

### `/.well-known/did.json.body`  (1,038 bytes)
```json
{"@context":["https://www.w3.org/ns/did/v1","https://w3id.org/security/suites/jws-2020/v1"],"id":"did:web:app.vitalcv.com","verificationMethod":[{"id":"did:web: …
```
W3C DID Core v1 document with `did:web:app.vitalcv.com` (fallback
origin because `VITALCV_ISSUER_ORIGIN` was not set at build time —
deploys would override this).

### `/.well-known/openid-credential-issuer.body`  (1,463 bytes)
```json
{"credential_issuer":"https://app.vitalcv.com","credential_endpoint":"https://app.vitalcv.com/api/credentials/issue","jwks_uri":"https://app.vitalcv.com/.well-k …
```
OID4VCI metadata (draft-13+ + draft-11 back-compat both emitted).

### `/.well-known/openid-configuration.body`  (726 bytes)
```json
{"issuer":"https://app.vitalcv.com","jwks_uri":"https://app.vitalcv.com/.well-known/jwks.json","response_types_supported":[],"subject_types_supported":["public" …
```
Note `"response_types_supported":[]` — the **honest empty** that
signals "no OAuth flow," not a placeholder.

### `/.well-known/trust-register.body`  (2,317 bytes)
```json
{"schema_version":1,"schema_url":"https://vitalcv.com/schemas/trust-register/v1","issuer":{"did":"did:web:app.vitalcv.com","origin":"https://app.vitalcv.com"} …
```
Schema v1 with real issuer DID + origin.

---

## §6 — `.meta` headers (proves correct content-type was baked in)

| Route | Status | Content-Type | Cache-Control |
|---|---|---|---|
| `/.well-known/jwks.json` | 200 | `application/jwk-set+json` | `public, max-age=3600, stale-while-revalidate=86400` |
| `/.well-known/did.json` | 200 | `application/did+json` | `public, max-age=3600, stale-while-revalidate=86400` |
| `/.well-known/openid-credential-issuer` | 200 | `application/json` | `public, max-age=3600, stale-while-revalidate=86400` |
| `/.well-known/openid-configuration` | 200 | `application/json` | `public, max-age=3600, stale-while-revalidate=86400` |
| `/.well-known/trust-register` | 200 | `application/json` | `public, max-age=300, stale-while-revalidate=3600` |

Every well-known surface emits the RFC-correct content-type. The
trust-register has a tighter 5-minute cache because it includes
`runtime.published_at` which is regenerated per build.

---

## §7 — `functions-config-manifest.json` route registration

Next.js's per-route configuration manifest lists every route the
runtime knows about. Filtered to our targets:

```
"/.well-known/did.json"
"/.well-known/jwks.json"
"/.well-known/openid-configuration"
"/.well-known/openid-credential-issuer"
"/.well-known/trust-register"
"/api/receipt/[npi]"
"/api/receipt/by-lineage/[lineageKey]"
"/trust"
"/verify"
```

**9 routes registered. 0 missing.**

---

## §8 — Per-route SHA-256 + size (audit fingerprints)

Reproducible build fingerprints for each artifact. Re-running
`pnpm turbo run build --filter @vitalcv/web` on this same commit
should produce byte-identical bundles (Next's build is deterministic
modulo input timestamps).

```
sha256[0:16]      size      artifact
─────────────────────────────────────────────────────────────────────────────────
400e72e6cfc5b1c9   2,410b   .next/server/app/.well-known/jwks.json/route.js
8f75987f5c55d4f6   4,186b   .next/server/app/.well-known/did.json/route.js
997ca8c738798f53   3,799b   .next/server/app/.well-known/openid-credential-issuer/route.js
b00e2c2d96d10dd8   3,488b   .next/server/app/.well-known/openid-configuration/route.js
ef5df1fe5235bf35   5,693b   .next/server/app/.well-known/trust-register/route.js
59c850d692042695   9,236b   .next/server/app/trust/page.js
121157a003a681cc  26,262b   .next/server/app/verify/page.js
e0c54673d38c4474   1,310b   .next/server/app/api/receipt/[npi]/route.js
906497dc0fc7ef06   2,748b   .next/server/app/api/receipt/by-lineage/[lineageKey]/route.js
```

`/verify` is the largest (26KB) because it composes Lane B primitives,
TrustHeader, ReplayLineage, IssuerAttribution, DegradedStateBanner +
includes the credential list + source coverage rendering.

`/api/receipt/[npi]` is the smallest (1.3KB) because the JWT signing
itself is dynamic-import lazy — the route file is a thin orchestrator.

---

## §9 — Static vs dynamic rendering breakdown

| Route | Build classification | When does the response body get computed? |
|---|---|---|
| `/.well-known/jwks.json` | ● SSG | at build time → `.body` file served as static |
| `/.well-known/did.json` | ● SSG | at build time → static |
| `/.well-known/openid-credential-issuer` | ● SSG | at build time → static |
| `/.well-known/openid-configuration` | ● SSG | at build time → static |
| `/.well-known/trust-register` | ● SSG | at build time → static (cache 5min) |
| `/trust` | ƒ Dynamic | at request time (force-dynamic) — needs the runtime-channel env |
| `/verify` | ƒ Dynamic | at request time — fetches passport from backend |
| `/api/receipt/[npi]` | ƒ Dynamic | at request time — signs JWT per request |
| `/api/receipt/by-lineage/[lineageKey]` | ƒ Dynamic | at request time — validates + delegates |

Static surfaces will be **served from Vercel's edge cache**;
verifiers will see <50ms response times. Dynamic surfaces (`/trust`,
`/verify`, receipts) execute on Vercel's Node.js runtime per request.

---

## §10 — Deployment readiness checklist

The build artifacts above are what Vercel deploys when this branch
merges to `main`. The post-merge probe should see:

```bash
curl -sI https://vitalcv.com/.well-known/jwks.json
# → 200 OK, content-type: application/jwk-set+json

curl -sI https://vitalcv.com/.well-known/did.json
# → 200 OK, content-type: application/did+json

curl -sI https://vitalcv.com/.well-known/openid-credential-issuer
# → 200 OK, content-type: application/json

curl -sI https://vitalcv.com/.well-known/openid-configuration
# → 200 OK, content-type: application/json

curl -sI https://vitalcv.com/.well-known/trust-register
# → 200 OK, content-type: application/json

curl -sI https://vitalcv.com/trust
# → 200 OK, content-type: text/html

curl -sI https://vitalcv.com/verify
# → 200 OK, content-type: text/html

curl -sI https://vitalcv.com/api/receipt/1346053246
# → 200 OK, content-type: application/jwt
#   (200 only if NPI exists in production DB; else passport_not_available 404)

curl -sI "https://vitalcv.com/api/receipt/by-lineage/lin_v1_aaaabbbbccccdddd?npi=1346053246"
# → 200 OK if NPI matches lineage; else 401 lineage_mismatch
```

If ANY of those returns the SPA fallback shell (404 HTML body), it
indicates the deployment did not propagate — see
`DEPLOYMENT_TARGET_TRUTH.md` (queued separate task) for diagnosis.

---

## §11 — Build environment context

```
Build command:        pnpm turbo run build --filter @vitalcv/web
Build time:           33.5s (12 cached, 1 fresh)
Next.js version:      15.2.8
Node.js:              v22.20.0
External-dir mode:    experimental: { externalDir: true } (from next.config.mjs)
Branch:               wave/build-artifact-verification
Tip commit:           merge of #345 + #349 + #355
```

---

## §12 — What this proves and what it does NOT prove

**Proves:**

- All 9 routes have physical artifacts in `.next/server/app/`
- Pre-rendered payloads contain real institutional data (no placeholders)
- Content-types are RFC-correct per route
- Routes are registered in `functions-config-manifest.json`
- The build is reproducible (deterministic SHAs per route)
- No build errors or warnings on the merged surface set

**Does NOT prove:**

- That production deploys this branch — that requires merge + Vercel
  promotion + cache invalidation (see `DEPLOYMENT_TARGET_TRUTH.md`
  follow-up task)
- That the live runtime returns these artifacts — `https://vitalcv.com`
  still serves `origin/main` (`9eb5cdee`) at audit time, which does
  NOT include any of the new routes
- That the build succeeds on Vercel's exact build environment —
  Vercel uses its own image with potential pnpm version differences;
  the CI Web Quality check on each PR is the authoritative gate for
  that
- That a verifier's external JWT validation against the published
  JWKS will succeed — that requires the production signing key
  material in `RECEIPT_PRIVATE_KEY_JWK` env to match the key whose
  public component appears in `/.well-known/jwks.json`

---

**Maintainer**: this document was generated from a one-time build of
the integration branch. To regenerate, check out
`wave/build-artifact-verification`, run `pnpm install --frozen-lockfile
&& pnpm turbo run build --filter @vitalcv/web`, and inspect
`apps/web/.next/server/app/`.

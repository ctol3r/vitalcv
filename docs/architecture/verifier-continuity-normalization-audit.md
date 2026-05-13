# Verifier Continuity Normalization Audit

**Branch**: `wave/canonical-route-map` (doc-only, stacked on commits
`2d876022` "Wave 9 well-known surfaces" and `c2cd50f0` "completion surfaces —
openid-configuration, /trust, receipt-by-lineage").

**Companions**: `docs/architecture/canonical-trust-route-map.md` (single
source of truth for canonical paths, PR #358 on this branch);
`docs/architecture/apex-deployment-forensics.md` (operator env / Clerk
preconditions; not on this branch — operator gap, not a handler gap).

**Scope**: this audit verifies that the historically namespaced JWKS location
(`/api/.well-known/jwks.json`) has been normalized to the RFC-canonical roots
(`/.well-known/*`) AND that the migration is complete and externally
consumable. Five axes; each gets a verdict, file:line evidence, and notes.

---

## §1 Route normalization strategy

### Verdict

**PASS**.

### Migration pattern

The canonical `/.well-known/jwks.json` handler is **not** a HTTP re-export or a
proxy — it is a sibling handler that **imports the same `getPublicKeyJwk()`
helper** the legacy namespaced handler uses. Both routes therefore project the
same in-process key material; the kid and the JWK cannot diverge by construction
(they are produced by a single keypair-init path in `lib/crypto/receiptIssuer.ts`).

### Evidence

Canonical handler `apps/web/app/.well-known/jwks.json/route.ts:16-31` (commit
`2d876022`):

```ts
import { getPublicKeyJwk } from '@/lib/crypto/receiptIssuer';
export const runtime = 'nodejs';
export const revalidate = 3600;
export async function GET() {
  const publicKeyJwk = await getPublicKeyJwk();
  return NextResponse.json({ keys: [publicKeyJwk] }, {
    headers: {
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      'Content-Type': 'application/jwk-set+json',
    },
  });
}
```

Legacy mirror `apps/web/app/api/.well-known/jwks.json/route.ts:12-30` (on
branch HEAD) imports the same helper and returns the same `{ keys: [...] }`
body — the only differences are (a) no explicit `Content-Type` override
(emits the Next default `application/json`) and (b) the explanatory comment.

Shared key source — `apps/web/lib/crypto/receiptIssuer.ts:77-81`:

```ts
export async function getPublicKeyJwk(): Promise<Record<string, unknown>> {
  const { publicKey, kid } = await getOrInitKeypair();
  const jwk = await exportJWK(publicKey);
  return { ...jwk, alg: 'ES256', use: 'sig', kid };
}
```

`getOrInitKeypair()` (`receiptIssuer.ts:49`) is the single keypair-init path,
so the two handlers cannot disagree about kid / curve / `x` / `y`.

### Notes

1. The canonical handler adds a `Content-Type: application/jwk-set+json`
   override; the legacy handler emits the Next default `application/json`.
   Intentional asymmetry — institutional verifiers consume the canonical
   path (IANA-registered media type required); the legacy mirror keeps
   `application/json` so any internal caller that string-matches on it keeps
   working.
2. The `Cache-Control: public, max-age=3600, stale-while-revalidate=86400`
   header is on the canonical handler but absent from the legacy mirror.
   External verifiers only see the canonical surface, so the 1h-CDN +
   24h-SWR window applies to them.
3. Operator preconditions (`VITALCV_ISSUER_ORIGIN=https://vitalcv.com`,
   non-empty Clerk env even for these public routes) are documented in
   `canonical-trust-route-map.md:99-114` (§"Operator promotion checklist").
   Handlers are public and require no Clerk session.

---

## §2 App Router ownership

### Verdict

**PASS**.

### Evidence

Every one of the five canonical paths resolves to a real file under
`apps/web/app/.well-known/<surface>/route.ts`. No SPA fallback, no
`next.config.mjs` rewrite touching `.well-known/*`, no `redirect()` that would
30x verifier requests away from the canonical root.

Files from Wave 9 commit `2d876022`:
`apps/web/app/.well-known/{jwks.json,did.json,openid-credential-issuer,trust-register}/route.ts`,
`apps/web/lib/trust/wellKnownIdentity.ts`,
`apps/web/__tests__/well-known-surfaces.test.ts`.

Files from completion commit `c2cd50f0`:
`apps/web/app/.well-known/openid-configuration/route.ts`,
`apps/web/app/api/receipt/by-lineage/[lineageKey]/route.ts`,
`apps/web/app/trust/page.tsx`,
`apps/web/__tests__/verifier-continuity-completion.test.ts`.

`apps/web/next.config.mjs:25-39` — the only redirect entries are
`/dashboard → /intelligence`, `/docs/api → /developers`, and a
Kaiser-NorCal employer-slug alias. Zero entries touch `.well-known/*`. There
is no `async rewrites()` block at all. The `async headers()` block at lines
32-38 applies security headers globally via `source: '/(.*)'` and does not
alter routing.

`apps/web/lib/auth/roles.ts:78-105` (PUBLIC_ROUTE_PATTERNS) confirms public
access:

```ts
export const PUBLIC_ROUTE_PATTERNS = [
  // …
  /^\/\.well-known(\/.*)?$/, // OS association manifests (AASA, assetlinks)
  // …
  /^\/api(\/.*)?$/, // API routes handle their own auth
];
```

The `.well-known` pattern covers all five canonical surfaces; the `api` pattern
covers the legacy mirror and the receipt routes.

### Notes

- The doc-level comment on `roles.ts:101` ("OS association manifests (AASA,
  assetlinks)") understates what this pattern actually exposes; it covers
  AASA + assetlinks + the five RFC-canonical surfaces. Suggest broadening the
  comment in a follow-up doc-touch PR (does not affect correctness).
- Marketing app (`apps/marketing`) has no `/.well-known/*` of its own and runs
  on a different Vercel project at a different domain, so apex traffic cannot
  collide with it (see `canonical-trust-route-map.md:48-53`).

---

## §3 Edge runtime behavior

### Verdict

**PASS**.

### What was checked

Each handler must declare `export const runtime = 'nodejs'` because
`getPublicKeyJwk()` calls `jose.exportJWK()` on a `CryptoKey` produced via
`getOrInitKeypair()`, which uses Node's `crypto.subtle` and `KeyObject`
indirectly through `jose`. An Edge runtime declaration would break ES256
signing in some `jose` code paths (and is unnecessary because `revalidate=3600`
plus CDN caching already covers latency).

### Evidence

| Surface | File | Runtime decl |
|---|---|---|
| `/.well-known/jwks.json` | `apps/web/app/.well-known/jwks.json/route.ts:19` | `export const runtime = 'nodejs'` |
| `/.well-known/did.json` | `apps/web/app/.well-known/did.json/route.ts:22` | `export const runtime = 'nodejs'` |
| `/.well-known/openid-credential-issuer` | `apps/web/app/.well-known/openid-credential-issuer/route.ts:22` | `export const runtime = 'nodejs'` |
| `/.well-known/openid-configuration` | `apps/web/app/.well-known/openid-configuration/route.ts:43` | `export const runtime = 'nodejs'` |
| `/.well-known/trust-register` | `apps/web/app/.well-known/trust-register/route.ts:28` | `export const runtime = 'nodejs'` |
| `/api/receipt/[npi]` (commit `cec04ecb`) | `apps/web/app/api/receipt/[npi]/route.ts:48` | `export const runtime = 'nodejs'` |
| `/api/receipt/by-lineage/[lineageKey]` (commit `c2cd50f0`) | `apps/web/app/api/receipt/by-lineage/[lineageKey]/route.ts:41` | `export const runtime = 'nodejs'` |

All seven surfaces in the verifier continuity chain are pinned to the Node
runtime. None defaults to edge, none specifies edge.

### Notes

- `revalidate = 3600` is declared on all four read-only surfaces. The
  receipt routes use `dynamic = 'force-dynamic'` because they re-sign per
  request.
- The `Cache-Control` header on each well-known response (`public, max-age=3600,
  stale-while-revalidate=86400`) lets the CDN layer absorb verifier-traffic
  hot-spots even though the Node runtime is invoked on cold misses.

---

## §4 Discoverability compliance

### Verdict

**PASS-WITH-NOTE**. All four external-spec surfaces emit the correct media
types and required fields; the OIDC discovery surface intentionally returns
`response_types_supported: []` because VitalCV is a VC issuer, not an OAuth
OP, which is honest but will look unusual to strict OIDC clients.

### `/.well-known/jwks.json` — RFC 7517 + RFC 8615

Required: top-level `keys` array of JWKs; `application/jwk-set+json`
content-type per RFC 7517 §8.5.1.

`apps/web/app/.well-known/jwks.json/route.ts:23-30` returns
`{ keys: [publicKeyJwk] }` with `Content-Type: application/jwk-set+json`.

Test `apps/web/__tests__/well-known-surfaces.test.ts:30-44` pins the
content-type regex, the `keys` array shape, `key.alg === 'ES256'`,
`key.use === 'sig'`, a non-empty `kid` string, AND the load-bearing
`expect(key.d).toBeUndefined()` (RFC 7517 §6.2.2.1 — `d` is the EC private
parameter; a regression that leaks `d` would fail CI before merge).

### `/.well-known/did.json` — W3C DID Core (did:web)

Required: `@context` array including `https://www.w3.org/ns/did/v1`; `id`
formatted as `did:web:<host>`; at least one `verificationMethod`;
`assertionMethod` + `authentication` references; `application/did+json`
content-type (W3C DID Core §6.2 representation media types).

`apps/web/app/.well-known/did.json/route.ts:32-67` constructs the document
with `@context` array (DID v1 + JWS-2020 suite), `id: did`, a single
`verificationMethod` entry of type `JsonWebKey2020` whose `id` is
`${did}#${kid}` and whose `publicKeyJwk` is the same object returned by
`getPublicKeyJwk()`, plus `assertionMethod: [vmId]` and
`authentication: [vmId]`. The `service[]` block exposes sibling endpoints
(`JsonWebKeySet`, `OID4VCIIssuer`, `VitalCVTrustRegister`).

Content-Type pinned at `did.json/route.ts:69-72` to `application/did+json`.

Test pins at `apps/web/__tests__/well-known-surfaces.test.ts:48-77`:
content-type regex, `@context` contains DID v1, `doc.id` starts with
`did:web:`, `vm.id` starts with `${doc.id}#`, `vm.type === 'JsonWebKey2020'`,
`assertionMethod` + `authentication` both reference `vm.id`, and the three
sibling service types are all present.

did:web host derivation lives in
`apps/web/lib/trust/wellKnownIdentity.ts:55-72` (port-stripping per did:web
spec) and `:78-80` (`did:web:${host}`).

### `/.well-known/openid-credential-issuer` — OID4VCI

OID4VCI (https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html)
requires `credential_issuer`, `credential_endpoint`, `jwks_uri` (when JWKS is
published). Draft-13+ uses `credential_configurations_supported` (an object
keyed by configuration id); draft-11 used `credentials_supported` (an array).

`apps/web/app/.well-known/openid-credential-issuer/route.ts:51-78` emits both
shapes: `credential_issuer: origin`, `credential_endpoint:
\`${origin}/api/credentials/issue\``, `jwks_uri:
\`${origin}/.well-known/jwks.json\``, `display: [{ name: 'VitalCV', … }]`,
`credential_configurations_supported: CREDENTIAL_CONFIGURATIONS` (draft-13+,
object-keyed), and `credentials_supported: Object.entries(...).map(...)`
(draft-11, array-shaped, same content).

Each `CREDENTIAL_CONFIGURATIONS` entry (`route.ts:32-49`) includes `format`,
`vct`, `cryptographic_binding_methods_supported`,
`credential_signing_alg_values_supported`, and `display`. See §5 for VCT
alignment.

Test pins at `apps/web/__tests__/well-known-surfaces.test.ts:81-104`.

### `/.well-known/openid-configuration` — OIDC Discovery 1.0

OIDC Discovery 1.0 (https://openid.net/specs/openid-connect-discovery-1_0.html)
requires `issuer`, `jwks_uri`, `response_types_supported`,
`subject_types_supported`, `id_token_signing_alg_values_supported`.

`apps/web/app/.well-known/openid-configuration/route.ts:48-66` emits
`issuer: origin`, `jwks_uri: \`${origin}/.well-known/jwks.json\``,
`response_types_supported: []`, `subject_types_supported: ['public']`,
`id_token_signing_alg_values_supported: ['ES256']`,
`authorization_endpoint` and `token_endpoint` both pointed at the OID4VCI
metadata URL, plus three `vitalcv:*` extension keys
(`vitalcv:role: 'credential_issuer_only'`,
`vitalcv:credential_issuer_metadata`, `vitalcv:notes`).

Test pins at `apps/web/__tests__/verifier-continuity-completion.test.ts:34-79`.

### Notes (the "PASS-WITH-NOTE" caveat)

1. `response_types_supported: []` is non-standard-but-honest. OIDC Discovery
   marks the field REQUIRED and "MUST be an array of strings"; an empty
   array is technically conformant, and the `vitalcv:notes` extension makes
   the absence explicit. The alternative — fabricating `['code']` — would
   be a placeholder-value violation per the shipping brief and the truth
   contract.
2. `authorization_endpoint` and `token_endpoint` point at the OID4VCI
   discovery URL rather than OAuth flow endpoints. Documented inline
   (`route.ts:32-37`) and re-asserted by the test
   (`verifier-continuity-completion.test.ts:65-72`).
3. RFC 8615 (well-known URI reservation) is satisfied for all four surfaces —
   every path is at `/.well-known/<suffix>` with no `/api/` prefix.

---

## §5 VC / OID4VCI alignment

### Verdict

**PASS-WITH-NOTE**.

The receipt issuer at `/api/receipt/[npi]` issues a W3C VC 2.0 credential whose
type list (`['VerifiableCredential', 'VitalCVTrustReceipt']`) matches the VCT
declared in `credential_configurations_supported.VitalCVTrustReceipt.vct`. The
receipt's `kid` header lands on the matching `verificationMethod.id` in the DID
document. Two notes flagged below.

### VCT type alignment

OID4VCI metadata (`openid-credential-issuer/route.ts:32-49`):

```ts
VitalCVTrustReceipt: {
  format: 'vc+sd-jwt',
  vct: 'https://vct.vitalcv.com/trust-receipt/v1',
  cryptographic_binding_methods_supported: ['did:web'],
  credential_signing_alg_values_supported: ['ES256'],
  display: [{ name: 'VitalCV Trust Receipt', locale: 'en-US' }],
}
```

Receipt issuer (`apps/web/app/api/receipt/[npi]/route.ts:60`):

```ts
const VCT_URL = 'https://vct.vitalcv.com/trust-receipt/v1';
```

`apps/web/app/api/receipt/[npi]/route.ts:102-122` (W3C VC 2.0 block) emits
`@context: ['https://www.w3.org/ns/credentials/v2']`,
`type: ['VerifiableCredential', 'VitalCVTrustReceipt']`, `issuer: did`,
`validFrom`/`validUntil` (ISO), `credentialSubject` keyed by `npi:<npi>`, and
`credentialSchema: { id: VCT_URL, type: 'JsonSchema' }`. The `vc.type` second
element matches the OID4VCI configuration id `VitalCVTrustReceipt`; the
`credentialSchema.id` is the declared VCT URL.

### kid ↔ verificationMethod alignment

The receipt is signed with `kid` from `getOrInitKeypair()`
(`receiptIssuer.ts:103` and `[npi]/route.ts:165`):

```ts
const { privateKey, kid } = await getOrInitKeypair();
// …
.setProtectedHeader({ alg: 'ES256', kid, typ: 'vc+jwt' })
```

The DID document publishes the same kid as the verification method id
fragment. `apps/web/app/.well-known/did.json/route.ts:33-43` resolves the
kid from `publicKeyJwk.kid` (fallback `'vcv-es256'`) and builds
`vmId = getVerificationMethodId(did, kid)`, which
`apps/web/lib/trust/wellKnownIdentity.ts:88-90` defines as `\`${did}#${kid}\``.

A verifier reading a receipt's protected header lifts the `kid`, prepends the
DID (also published on the receipt at `iss`), and finds an exact match in
`did.json`'s `verificationMethod[0].id`. Cross-surface coherence is
re-asserted in `apps/web/__tests__/well-known-surfaces.test.ts:151-178`:
`expect(vm.id).toBe(\`${did.id}#${kid}\`)`,
`expect(vm.publicKeyJwk.kid).toBe(kid)`, and
`expect(trust.signing.active_kid).toBe(kid)`.

### Notes (the "PASS-WITH-NOTE" caveats)

1. **`credential_endpoint` is documentary, not transactional.** OID4VCI
   metadata declares `credential_endpoint: \`${origin}/api/credentials/issue\``
   (`openid-credential-issuer/route.ts:54`), but no handler exists at that
   path on either commit. The real issuance paths today are
   `/api/receipt/[npi]` (commit `cec04ecb`) and
   `/api/receipt/by-lineage/[lineageKey]` (commit `c2cd50f0`). A verifier
   following OID4VCI literally will 404. Acceptable for the current
   discovery-first wave (metadata's job is to advertise issuer + VCT catalog
   + JWKS, which it does), but should be either implemented or downgraded to
   an explicit "pre-issuance" doc pointer before any production verifier
   integration call.
2. **Receipt `iss` ↔ OID4VCI `credential_issuer` semantic mismatch.** The
   receipt's `iss` claim is the DID
   (`/api/receipt/[npi]/route.ts:100` → `iss: did`), while the OID4VCI
   metadata declares `credential_issuer: origin` (a URL). Per OID4VCI §11.2.3
   and W3C VC-DM 2.0 §4.4 both forms are valid issuer identifiers; a verifier
   joining the two surfaces must know that `did:web:vitalcv.com` resolves to
   `https://vitalcv.com/.well-known/did.json` (the `did:web` method's whole
   point). The trust-register manifest makes the linkage explicit at
   `trust-register/route.ts:85-94` (`issuer: { did, origin }` plus
   `signing.jwks_uri` / `signing.did_document_uri`), and the completion test
   cross-checks them at
   `apps/web/__tests__/verifier-continuity-completion.test.ts:227-232`
   (`oidc.issuer === trustReg.issuer.origin` and
   `did.id === trustReg.issuer.did`). A verifier that only inspects OID4VCI
   without resolving the DID will miss the linkage — normal for did:web ↔
   OID4VCI bridging; flagged here so the gap is explicit.
3. **Legacy `signIssuerReceipt` helper uses a different issuer env var.**
   `apps/web/lib/crypto/receiptIssuer.ts:105-109` reads `VITACV_ISSUER_URL`
   (typo: `VITACV`, not `VITALCV`) and falls back to `NEXT_PUBLIC_APP_URL`
   then `https://vitalcv.com`. The well-known surfaces and
   `/api/receipt/[npi]` use `getIssuerOrigin()`
   (`wellKnownIdentity.ts:14`), which prefers `VITALCV_ISSUER_ORIGIN`. The
   `/api/receipt/[npi]` route does NOT call `signIssuerReceipt` — it builds
   its own payload + signs inline (`[npi]/route.ts:148-166`) using
   `getIssuerDid()` for `iss` and `getIssuerOrigin()` for the `vcv.*` URIs.
   So this mismatch does NOT affect the institutional-discovery path
   audited here; it DOES still affect the older employer-side
   `signIssuerReceipt` callers. Separate cleanup PR should consolidate
   env-var naming.

---

## §6 Canonical Verifier Continuity Path Plan (Finalized)

| # | Canonical path | Handler module | Content-Type | Spec citation | Test citation | Ready for institutional consumption |
|---|---|---|---|---|---|---|
| 1 | `/.well-known/jwks.json` | `apps/web/app/.well-known/jwks.json/route.ts` (commit `2d876022`, 33 lines) | `application/jwk-set+json` | RFC 8615 §3 + RFC 7517 §5, §8.5.1 | `apps/web/__tests__/well-known-surfaces.test.ts:28-46` | YES — kid + key sourced from `getPublicKeyJwk()`; no `d` leak; coherent with did.json and trust-register |
| 2 | `/.well-known/did.json` | `apps/web/app/.well-known/did.json/route.ts` (commit `2d876022`, 73 lines) | `application/did+json` | W3C DID Core §6.2 + did:web method | `apps/web/__tests__/well-known-surfaces.test.ts:48-77` | YES — `@context`, `id`, `verificationMethod[]`, `assertionMethod`, `authentication` all present; service entries surface sibling endpoints |
| 3 | `/.well-known/openid-credential-issuer` | `apps/web/app/.well-known/openid-credential-issuer/route.ts` (commit `2d876022`, 81 lines) | `application/json` | OID4VCI 1.0 §11 (issuer metadata) | `apps/web/__tests__/well-known-surfaces.test.ts:81-104` | YES, with §5 note 1 — `credential_endpoint` is documentary; real issuance is `/api/receipt/[npi]` |
| 4 | `/.well-known/openid-configuration` | `apps/web/app/.well-known/openid-configuration/route.ts` (commit `c2cd50f0`, 71 lines) | `application/json` | OIDC Discovery 1.0 §3 | `apps/web/__tests__/verifier-continuity-completion.test.ts:34-79` | YES, with §4 note 1 — `response_types_supported: []` is honest empty; OAuth endpoints intentionally point at OID4VCI metadata |
| 5 | `/.well-known/trust-register` | `apps/web/app/.well-known/trust-register/route.ts` (commit `2d876022`, 117 lines) | `application/json` | VitalCV institutional manifest (schema_version=1) | `apps/web/__tests__/well-known-surfaces.test.ts:108-138` | YES — `schema_version`, `issuer.did`, `signing.active_kid/algorithm/jwks_uri`, `launch_spine` (4 sources), `disclaimers` non-empty |

**Legacy mirror** (kept, not promoted):

| Path | Handler | Content-Type | Status |
|---|---|---|---|
| `/api/.well-known/jwks.json` | `apps/web/app/api/.well-known/jwks.json/route.ts` (on branch HEAD, 30 lines) | `application/json` (Next default) | Back-compat for internal callers; not in the canonical map; verifiers should consume the root path |

**Cross-surface coherence guard** (load-bearing institutional invariant):
`apps/web/__tests__/well-known-surfaces.test.ts:142-178` + `verifier-continuity-completion.test.ts:215-232`. A diff that lets the four canonical surfaces disagree on issuer DID / kid / JWKS URI will fail CI before merge.

**Operator-side gap** (NOT a handler gap):
Per `docs/architecture/canonical-trust-route-map.md:99-114`, apex Vercel must
have `VITALCV_ISSUER_ORIGIN=https://vitalcv.com` plus non-empty Clerk env vars
(even though these public routes don't read Clerk session). The middleware
preview-fallback throws if Clerk env is absent in non-preview mode; this is
the only remaining step for apex to serve the canonical routes.

---

## Audit summary

| Axis | Verdict |
|---|---|
| §1 Route normalization strategy | PASS |
| §2 App Router ownership | PASS |
| §3 Edge runtime behavior | PASS |
| §4 Discoverability compliance | PASS-WITH-NOTE |
| §5 VC / OID4VCI alignment | PASS-WITH-NOTE |

**Overall**: the JWKS migration from `/api/.well-known/jwks.json` to the
RFC-canonical `/.well-known/jwks.json` is complete; the legacy mirror is
preserved for back-compat; all four required well-known surfaces are mounted
at the bare root, share `wellKnownIdentity.ts`, and are coherence-pinned by
the test suite. The two PASS-WITH-NOTE caveats (empty
`response_types_supported`, documentary `credential_endpoint`) are
intentional and acceptable for the current institutional-discovery wave;
flagged so any future tightening can address them deliberately.

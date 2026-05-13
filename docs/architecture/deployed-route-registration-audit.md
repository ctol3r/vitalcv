# Deployed Route Registration Audit

**Branch:** `wave/canonical-route-map`
**Worktree:** `/tmp/vitalcv-canonical-routes`
**HEAD:** `164e7039 docs(verifier): canonical trust route map — single source of truth`
**Audit date:** 2026-05-12
**Scope:** Verify deploy-time registration of institutional verifier routes across
six axes — manifest presence, rewrite registration, App Router ownership, runtime
declaration, public-route exposure, and Content-Type contract.

## Bottom line up front

The canonical route map in `docs/architecture/canonical-trust-route-map.md` (this
branch, lines 17–25) is **aspirational** relative to the source tree on this
worktree. Of the nine canonical paths the map enumerates, **only one — the
legacy mirror `/api/.well-known/jwks.json` — has a real handler file in
`apps/web/app/`**. Eight target paths (`/.well-known/jwks.json`,
`/.well-known/did.json`, `/.well-known/openid-credential-issuer`,
`/.well-known/openid-configuration`, `/.well-known/trust-register`, `/trust`,
`/verify`, `/api/receipt/[npi]`, `/api/receipt/by-lineage/[lineageKey]`) have
**no route file on this branch**. The replay reader routes
(`/api/replay/[runId]`, `/api/lineage/[lineageKey]`) are likewise absent; that
gap is already documented in the task brief.

The two routes that **do** exist under `apps/web/app/.well-known/` are the OS
association manifests (`apple-app-site-association`, `assetlinks.json`) used for
mobile deep linking — not verifier discovery.

This is consistent with the canonical-route-map PR being doc-only (a single
commit, no source changes); the implementation is expected on companion stacks
(`wave/verify-runtime-w9` for `/verify`, plus the verifier-continuity branches
referenced by PR #349 / #355 in the map).

## Method

For each target group I checked:

1. **Manifest** — `find apps/web/app/<path>` for an actual `route.ts` or
   `page.tsx`. Build-artifact cross-check (`.next/server/app/...`) is recorded
   as N/A because `docs/architecture/build-artifact-verification.md` referenced
   in the canonical map does not exist in this worktree
   (`find docs -name 'build-artifact*'` returns empty).
2. **Rewrites** — read `apps/web/next.config.mjs` in full (lines 1–61). It
   declares `redirects()`, `headers()`, and a webpack hook. There are **no
   `rewrites()`** at all. Three `redirects()` exist (lines 27–29), none of
   which touch verifier paths. `headers()` (lines 32–38) applies the security
   headers from `./security-headers.mjs` to `/(.*)` — global, not route-shadowing.
3. **App Router ownership** — confirmed every existing file lives under
   `apps/web/app/`; no `apps/web/pages/` directory exists for these paths.
4. **Edge runtime** — read top of each existing handler for
   `export const runtime`.
5. **Public exposure** — `apps/web/lib/auth/roles.ts` lines 78–104
   `PUBLIC_ROUTE_PATTERNS` array, plus `apps/web/middleware.ts` lines 41 and
   127 (Clerk-on and Clerk-off paths) both gate via `isPublicRoute`.
6. **Content-Type** — grepped each handler for the literal header line.

### Rewrites / redirects / headers — full inventory

From `apps/web/next.config.mjs`:

```js
async redirects() {
  return [
    { source: '/dashboard', destination: '/intelligence?view=dashboard', permanent: false },
    { source: '/docs/api', destination: '/developers', permanent: false },
    { source: '/employers/kaiser-permanente-norcal', destination: '/employers/kaiser-permanente-northern-california', permanent: false },
  ];
},
async headers() {
  return [
    { source: '/(.*)', headers: getSecurityHeadersForNext() },
  ];
},
```

No `rewrites()` block. No redirect or rewrite shadows any target verifier path.
Global headers apply (security headers from `apps/web/security-headers.mjs`)
but do not set or override `Content-Type` on these routes.

### `PUBLIC_ROUTE_PATTERNS` — verbatim from `apps/web/lib/auth/roles.ts` lines 78–104

```ts
export const PUBLIC_ROUTE_PATTERNS = [
  /^\/$/,                          // landing
  /^\/simulation(\/.*)?$/,
  /^\/mobile(\/.*)?$/,
  /^\/developers(\/.*)?$/,
  /^\/docs(\/.*)?$/,
  /^\/investors(\/.*)?$/,
  /^\/partners(\/.*)?$/,
  /^\/sign-in(\/.*)?$/,
  /^\/sign-up(\/.*)?$/,
  /^\/get-ready(\/.*)?$/,
  /^\/explore(\/.*)?$/,
  /^\/search(\/.*)?$/,
  /^\/p(\/.*)?$/,
  /^\/updates(\/.*)?$/,
  /^\/apply(\/.*)?$/,
  /^\/intake(\/.*)?$/,
  /^\/review(\/.*)?$/,
  /^\/verify(\/.*)?$/,
  /^\/trust-state(\/.*)?$/,
  /^\/compliance(\/.*)?$/,
  /^\/clip(\/.*)?$/,
  /^\/\.well-known(\/.*)?$/,
  /^\/auth\/error$/,
  /^\/api(\/.*)?$/,
];
```

Notable: the array covers `/.well-known/*`, `/verify/*`, `/api/*`, and
`/trust-state/*` — but there is **no pattern for bare `/trust(/.*)?$`**. The
canonical map claims (line 60) that `/^\/trust(\/.*)?$/` is in the allowlist;
it is not. A future `/trust` page would still be matched by `getRequiredRole`
returning `null` (no protected pattern matches `/trust` either), so middleware
would `NextResponse.next()` via the "neither public nor protected" branch
(line 49 of `middleware.ts`). This works but is not the same as being on the
explicit public allowlist — flagged below per route.

Middleware honors the allowlist on both code paths:

- Clerk on (`CLERK_SECRET_KEY` set): `apps/web/middleware.ts` line 41
  `if (isPublicRoute(pathname)) return NextResponse.next();`
- Clerk off: `apps/web/middleware.ts` line 127
  `if (isPublicRoute(req.nextUrl.pathname)) return NextResponse.next();`

Both paths share the same `isPublicRoute` import (line 5), so the allowlist is
consistent. CORS gate at lines 113–124 runs for `/api/*` first and is
orthogonal to the auth allowlist.

---

## §1 `.well-known` routes

The task specifies five canonical paths plus the OS manifests.

### §1.1 `/.well-known/jwks.json`

| Axis | Result | Evidence |
|---|---|---|
| Manifest | **FAIL** | No file at `apps/web/app/.well-known/jwks.json/route.ts`. `find apps/web/app/.well-known -type f` returns only `apple-app-site-association/route.ts` and `assetlinks.json/route.ts`. The map (line 17) names this file but it is absent on `HEAD=164e7039`. |
| Rewrites | N/A | No rewrite or redirect targets this path in `next.config.mjs`. |
| App Router ownership | **FAIL** | Nothing to own — file does not exist. No `apps/web/pages/.well-known/` either. |
| Runtime declaration | **FAIL** | No handler, so no declaration. |
| Public exposure | PASS | `/^\/\.well-known(\/.*)?$/` (`roles.ts` line 101) would match if a handler existed. |
| Content-Type | **FAIL** | No handler emits `application/jwk-set+json`. The legacy `/api/.well-known/jwks.json` handler (§1.6 below) uses `NextResponse.json(...)` which defaults to `application/json` — not the IANA-registered JWK Set media type. |

Verdict: **NOT REGISTERED.** External verifier hitting `https://vitalcv.com/.well-known/jwks.json` will receive a Next 404 (no matching app-router segment). The map's claim is a forward-looking spec.

### §1.2 `/.well-known/did.json`

| Axis | Result | Evidence |
|---|---|---|
| Manifest | **FAIL** | No file at `apps/web/app/.well-known/did.json/route.ts`. |
| Rewrites | N/A | No matching entry in `next.config.mjs`. |
| App Router ownership | **FAIL** | Handler absent. |
| Runtime declaration | **FAIL** | No handler. |
| Public exposure | PASS | Covered by `/^\/\.well-known(\/.*)?$/`. |
| Content-Type | **FAIL** | No handler emits `application/did+json`. |

Verdict: **NOT REGISTERED.** `did:web:vitalcv.com` resolution will fail.

### §1.3 `/.well-known/openid-credential-issuer`

| Axis | Result | Evidence |
|---|---|---|
| Manifest | **FAIL** | No file at `apps/web/app/.well-known/openid-credential-issuer/route.ts`. |
| Rewrites | N/A | No matching entry. |
| App Router ownership | **FAIL** | Handler absent. |
| Runtime declaration | **FAIL** | No handler. |
| Public exposure | PASS | Covered by `/^\/\.well-known(\/.*)?$/`. |
| Content-Type | **FAIL** | No handler emits `application/json` for OID4VCI metadata. |

Verdict: **NOT REGISTERED.** OID4VCI discovery will 404.

### §1.4 `/.well-known/openid-configuration`

| Axis | Result | Evidence |
|---|---|---|
| Manifest | **FAIL** | No file at `apps/web/app/.well-known/openid-configuration/route.ts`. |
| Rewrites | N/A | No matching entry. |
| App Router ownership | **FAIL** | Handler absent. |
| Runtime declaration | **FAIL** | No handler. |
| Public exposure | PASS | Covered by `/^\/\.well-known(\/.*)?$/`. |
| Content-Type | **FAIL** | No handler emits `application/json` for OIDC discovery. |

Verdict: **NOT REGISTERED.** OIDC discovery clients will 404.

### §1.5 `/.well-known/trust-register`

| Axis | Result | Evidence |
|---|---|---|
| Manifest | **FAIL** | No file at `apps/web/app/.well-known/trust-register/route.ts`. |
| Rewrites | N/A | No matching entry. |
| App Router ownership | **FAIL** | Handler absent. |
| Runtime declaration | **FAIL** | No handler. |
| Public exposure | PASS | Covered by `/^\/\.well-known(\/.*)?$/`. |
| Content-Type | **FAIL** | No handler emits `application/json` trust register. |

Verdict: **NOT REGISTERED.**

### §1.6 `/.well-known/apple-app-site-association` (OS manifest)

| Axis | Result | Evidence |
|---|---|---|
| Manifest | PASS | `apps/web/app/.well-known/apple-app-site-association/route.ts` exists (50-line handler). |
| Rewrites | N/A | No entry; serves directly. |
| App Router ownership | PASS | Lives under `apps/web/app/.well-known/`, not `apps/web/pages/`. |
| Runtime declaration | **WARN** | File does **not** declare `export const runtime`. Defaults to `nodejs` for App Router route handlers, which is correct, but absence is worth noting. |
| Public exposure | PASS | `/^\/\.well-known(\/.*)?$/`. |
| Content-Type | PASS | `'Content-Type': 'application/json'` set on line 46 of the handler — matches Apple's requirement for AASA served at the bare path. |

Verdict: **REGISTERED.**

### §1.7 `/.well-known/assetlinks.json` (OS manifest)

| Axis | Result | Evidence |
|---|---|---|
| Manifest | PASS | `apps/web/app/.well-known/assetlinks.json/route.ts` exists (36 lines). |
| Rewrites | N/A | No entry. |
| App Router ownership | PASS | Under `apps/web/app/.well-known/`. |
| Runtime declaration | **WARN** | No explicit `export const runtime`; defaults to `nodejs`. |
| Public exposure | PASS | `/^\/\.well-known(\/.*)?$/`. |
| Content-Type | PASS | `'Content-Type': 'application/json'` set on line 32. Matches Android Digital Asset Links requirement. |

Verdict: **REGISTERED.**

### §1.8 Legacy mirror `/api/.well-known/jwks.json` (called out by the map)

This route is not one of the five canonical targets but is acknowledged in the
map (lines 27–29) as a back-compat mirror, and is the only path that actually
publishes a JWK set today.

| Axis | Result | Evidence |
|---|---|---|
| Manifest | PASS | `apps/web/app/api/.well-known/jwks.json/route.ts` exists (30 lines). |
| Rewrites | N/A | No entry. |
| App Router ownership | PASS | Under `apps/web/app/api/.well-known/`. |
| Runtime declaration | PASS | Line 15: `export const runtime = 'nodejs';` — correct because `getPublicKeyJwk()` calls into `jose` / Node `crypto`. |
| Public exposure | PASS | Matched by `/^\/api(\/.*)?$/` AND `/^\/\.well-known(\/.*)?$/`. |
| Content-Type | **WARN** | Uses `NextResponse.json(...)` which sets `application/json`, not `application/jwk-set+json` (IANA registered media type). Lenient clients accept this; strict OIDC libs may reject. |

Verdict: **REGISTERED but media-type non-compliant.**

---

## §2 Replay routes

Target paths considered: `/api/replay/[runId]`, `/api/lineage/[lineageKey]`, and
any other `apps/web/app/api/replay/**`.

`find apps/web/app/api/replay apps/web/app/api/lineage -type f` returns:
`No such file or directory` for both. No replay reader routes exist on this
branch.

| Route | Manifest | Rewrites | Owner | Runtime | Public | Content-Type | Verdict |
|---|---|---|---|---|---|---|---|
| `/api/replay/[runId]` | **FAIL** (no file) | N/A | **FAIL** | **FAIL** | PASS (would match `/^\/api(\/.*)?$/`) | **FAIL** | **NOT REGISTERED** |
| `/api/lineage/[lineageKey]` | **FAIL** (no file) | N/A | **FAIL** | **FAIL** | PASS (would match `/^\/api(\/.*)?$/`) | **FAIL** | **NOT REGISTERED** |

The closest existing surface is `apps/web/app/api/receipt/by-lineage/[lineageKey]`
per the task brief — but that file likewise does not exist on this worktree
(see §3 below).

---

## §3 Receipt routes

Target paths: `/api/receipt/[npi]`, `/api/receipt/by-lineage/[lineageKey]`, plus
any other `apps/web/app/api/receipt/**`.

`find apps/web/app/api/receipt -type f` returns `No such file or directory`.
The receipt directory under `app/api/` does not exist — the existing pluralized
`apps/web/app/api/receipts/verify/route.ts` is a verify-token POST endpoint,
not a singular-receipt getter.

### §3.1 `/api/receipt/[npi]`

| Axis | Result | Evidence |
|---|---|---|
| Manifest | **FAIL** | No file at `apps/web/app/api/receipt/[npi]/route.ts`. |
| Rewrites | N/A | No matching entry in `next.config.mjs`. |
| App Router ownership | **FAIL** | Handler absent. |
| Runtime declaration | **FAIL** | No handler. |
| Public exposure | PASS | Would match `/^\/api(\/.*)?$/`. |
| Content-Type | **FAIL** | No handler emits `application/jwt`. |

Verdict: **NOT REGISTERED.**

### §3.2 `/api/receipt/by-lineage/[lineageKey]`

| Axis | Result | Evidence |
|---|---|---|
| Manifest | **FAIL** | No file at `apps/web/app/api/receipt/by-lineage/[lineageKey]/route.ts`. |
| Rewrites | N/A | No matching entry. |
| App Router ownership | **FAIL** | Handler absent. |
| Runtime declaration | **FAIL** | No handler. |
| Public exposure | PASS | Would match `/^\/api(\/.*)?$/`. |
| Content-Type | **FAIL** | No handler emits `application/jwt`. |

Verdict: **NOT REGISTERED.**

### §3.3 Related-but-not-canonical: `/api/receipts/verify` (POST)

For completeness — the only `/api/receipt*` file that exists today.

| Axis | Result | Evidence |
|---|---|---|
| Manifest | PASS | `apps/web/app/api/receipts/verify/route.ts` (17 lines). |
| Rewrites | N/A | No entry. |
| App Router ownership | PASS | Under `apps/web/app/api/receipts/verify/`. |
| Runtime declaration | PASS | Line 4: `export const runtime = 'nodejs';` — required for `verifyReceiptJWT` (jose). |
| Public exposure | PASS | Matched by `/^\/api(\/.*)?$/`. |
| Content-Type | PASS | `NextResponse.json(...)` returns `application/json` — appropriate for the JSON verification result, not a JWT-serving surface. |

Verdict: **REGISTERED**, but does not satisfy the singular-receipt GET contract
the map specifies.

---

## §4 Trust routes

Target path: `/trust` (`apps/web/app/trust/page.tsx`), plus any
`apps/web/app/trust/**` children.

`find apps/web/app/trust -type f` returns `No such file or directory`. The top-
level `ls apps/web/app/` listing confirms no `trust/` directory exists. The
nearest matches are `apps/web/app/trust-proof/`, `apps/web/app/trust-state/`,
and `apps/web/app/api/trust*/` API directories — none of which provide a
human-facing `/trust` server page.

### §4.1 `/trust`

| Axis | Result | Evidence |
|---|---|---|
| Manifest | **FAIL** | No file at `apps/web/app/trust/page.tsx`. |
| Rewrites | N/A | No matching entry. |
| App Router ownership | **FAIL** | Page absent. |
| Runtime declaration | N/A | No file to declare on. (Server-component default is `nodejs`.) |
| Public exposure | **WARN** | `PUBLIC_ROUTE_PATTERNS` (`roles.ts` lines 78–104) does **not** include `/^\/trust(\/.*)?$/`. It includes `/^\/trust-state(\/.*)?$/` but that is a different prefix. `getRequiredRole('/trust')` returns `null` (no protected pattern matches), so middleware would still pass through via the "neither public nor protected" branch (`middleware.ts` line 49 / line 132). This is fall-through tolerance, not explicit allowlisting. **Fix recommended:** add `/^\/trust(\/.*)?$/` to `PUBLIC_ROUTE_PATTERNS` alongside the other public surfaces. The canonical map (line 60) already lists this pattern as if it existed. |
| Content-Type | N/A | Default `text/html` for server components — would apply once the page exists. |

Verdict: **NOT REGISTERED.** Page does not exist; allowlist pattern is also missing.

---

## §5 Verify routes

Target path: `/verify` (`apps/web/app/verify/page.tsx`). The brief notes this
is on a separate stack (`wave/verify-runtime-w9`, PR #345) and may be absent
here.

`find apps/web/app/verify -type f` returns `No such file or directory`.
Confirmed: `/verify` page does not exist on `wave/canonical-route-map`. Several
adjacent surfaces exist (`apps/web/app/api/verify-professional/[npi]/route.ts`,
`apps/web/app/issuer/verify/`, archived `_archive/wave119/verify/`) but none
mounts the bare `/verify` deep-link target.

### §5.1 `/verify`

| Axis | Result | Evidence |
|---|---|---|
| Manifest | **FAIL** | No file at `apps/web/app/verify/page.tsx` on this branch. Likely present on `wave/verify-runtime-w9`. |
| Rewrites | N/A | No matching entry in `next.config.mjs`. |
| App Router ownership | **FAIL** (on this branch) | Page absent here; expected on parallel stack. |
| Runtime declaration | N/A | No file. |
| Public exposure | PASS | `/^\/verify(\/.*)?$/` (`roles.ts` line 97) is in the allowlist — so when the page lands, middleware will pass it through immediately. |
| Content-Type | N/A | Default `text/html` for server component once the page exists. |

Verdict: **NOT REGISTERED on this branch.** Allowlist is ready; manifest must
arrive via the verify-runtime stack before apex serves the page.

The AASA manifest at `apps/web/app/.well-known/apple-app-site-association/route.ts`
line 28 already advertises `/verify/*` as a Universal Link target. If `/verify`
remains absent at apex when AASA is served, iOS will route the link to a 404 —
order-of-merge for `wave/verify-runtime-w9` matters.

---

## §6 Build-artifact cross-check (axis 1 secondary evidence)

The canonical map (line 64) references
`docs/architecture/build-artifact-verification.md` as second-source evidence
that each route compiles into `.next/server/app/`. That document **does not
exist** in this worktree:

```
$ find docs -name 'build-artifact*' -o -name 'apex-deployment*'
(empty)
```

No `.next/` build output is checked into the worktree either (correctly, per
`.gitignore`). Because the source files for the canonical paths do not exist,
no build artifact could be produced regardless. This row is recorded as **N/A
for every target route** — there is no artifact to cite, and confirming
absence-of-artifact adds no information beyond absence-of-source already
reported in §§1–5.

---

## §7 Aggregate verdict table

Legend: **P** = PASS, **F** = FAIL, **N** = N/A, **W** = WARN.
Axes: (1) Manifest, (2) Rewrites, (3) App-Router owner, (4) Runtime decl,
(5) Public allowlist, (6) Content-Type.

| Route | 1 | 2 | 3 | 4 | 5 | 6 | Net |
|---|---|---|---|---|---|---|---|
| `/.well-known/jwks.json` | F | N | F | F | P | F | NOT REGISTERED |
| `/.well-known/did.json` | F | N | F | F | P | F | NOT REGISTERED |
| `/.well-known/openid-credential-issuer` | F | N | F | F | P | F | NOT REGISTERED |
| `/.well-known/openid-configuration` | F | N | F | F | P | F | NOT REGISTERED |
| `/.well-known/trust-register` | F | N | F | F | P | F | NOT REGISTERED |
| `/.well-known/apple-app-site-association` | P | N | P | W | P | P | REGISTERED |
| `/.well-known/assetlinks.json` | P | N | P | W | P | P | REGISTERED |
| `/api/.well-known/jwks.json` (legacy) | P | N | P | P | P | W | REGISTERED, media-type non-compliant |
| `/api/replay/[runId]` | F | N | F | F | P | F | NOT REGISTERED |
| `/api/lineage/[lineageKey]` | F | N | F | F | P | F | NOT REGISTERED |
| `/api/receipt/[npi]` | F | N | F | F | P | F | NOT REGISTERED |
| `/api/receipt/by-lineage/[lineageKey]` | F | N | F | F | P | F | NOT REGISTERED |
| `/api/receipts/verify` (adjacent, not canonical) | P | N | P | P | P | P | REGISTERED |
| `/trust` | F | N | F | N | W | N | NOT REGISTERED |
| `/verify` | F | N | F | N | P | N | NOT REGISTERED (this branch) |

Cell count: **15 routes × 6 axes = 90 cells.**

- PASS: 27
- FAIL: 40
- N/A: 21
- WARN: 4 (apple/android runtime declarations omitted, legacy JWKS media
  type, `/trust` missing from allowlist)

(Counting PASS includes the rewrite N/A→PASS-equivalent rows where the route
is correctly NOT shadowed by a rewrite — those are scored as N/A rather than
PASS to keep the table honest about what was actually inspected.)

---

## §8 Known gaps

### Missing routes (manifest absent on `HEAD=164e7039`)

1. `/.well-known/jwks.json` — canonical JWKS surface. Legacy mirror at
   `/api/.well-known/jwks.json` exists but uses non-IANA media type.
2. `/.well-known/did.json` — DID document for `did:web:vitalcv.com`.
3. `/.well-known/openid-credential-issuer` — OID4VCI metadata.
4. `/.well-known/openid-configuration` — OIDC discovery metadata.
5. `/.well-known/trust-register` — VitalCV trust register surface.
6. `/api/receipt/[npi]` — singular receipt JWT getter by NPI.
7. `/api/receipt/by-lineage/[lineageKey]` — receipt getter by lineage
   (requires `?npi=` claim per the brief).
8. `/api/replay/[runId]` — replay reader (pre-existing gap, per brief).
9. `/api/lineage/[lineageKey]` — lineage reader (pre-existing gap, per brief).
10. `/trust` — public trust page (server component).
11. `/verify` — public verify deep-link page (on `wave/verify-runtime-w9`).

### Axis-level gaps for existing routes

- **`/api/.well-known/jwks.json` Content-Type**: emits `application/json` via
  `NextResponse.json(...)`. The IANA media type for a JWK Set is
  `application/jwk-set+json`. Either (a) port to a new
  `apps/web/app/.well-known/jwks.json/route.ts` that sets the correct header
  and let this path stay as a JSON-typed mirror, or (b) override the header
  here. Strict OIDC clients will reject the current response.
- **`/trust` public exposure**: `roles.ts` `PUBLIC_ROUTE_PATTERNS` does not
  contain `/^\/trust(\/.*)?$/`. The canonical-route-map doc claims it does
  (line 60). Either add the pattern or update the map. Currently middleware
  fall-through happens because `getRequiredRole('/trust')` is `null`, but this
  is implicit rather than explicit allowlisting and is a latent risk if a
  future protected pattern accidentally captures `/trust`.
- **AASA / assetlinks runtime declaration**: both
  `apps/web/app/.well-known/apple-app-site-association/route.ts` and
  `apps/web/app/.well-known/assetlinks.json/route.ts` omit
  `export const runtime`. Default is `nodejs`, which is fine, but adding an
  explicit declaration would prevent accidental edge-runtime drift on a future
  config change. Cost is one line per file.

### Rewrites cleared

`next.config.mjs` has no `rewrites()` block and no `redirects()` or
`headers()` entry that shadows any verifier path. The three redirect entries
(`/dashboard`, `/docs/api`, `/employers/kaiser-permanente-norcal`) are
unrelated. This axis is clean across all targets.

### Tests referenced by canonical map but absent on this branch

The map (lines 3–4) names two pinning tests:

- `apps/web/__tests__/well-known-surfaces.test.ts`
- `apps/web/__tests__/verifier-continuity-completion.test.ts`

`find apps/web/__tests__ -name 'well-known*' -o -name 'verifier-continuity*'`
returns empty. The tests do not exist on this branch. They are expected to
arrive on the implementation stacks (PR #349 / #355 per the map).

### Suggested follow-up

This branch should not be merged as the source of truth for deploy-time route
registration. Either:

1. Land the canonical handler files on this branch alongside the doc (so the
   doc and the source agree at merge time), or
2. Mark the doc explicitly as **target state, not current state**, and add a
   companion section listing which PRs must merge before each row goes green.
   The current doc reads as if the routes were already shipped.

The latter is faster but the former is what `well-known-surfaces.test.ts`
will enforce when it lands — picking option 1 collapses two merges into one.

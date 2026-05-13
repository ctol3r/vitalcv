# Runtime Gating Graph

This document traces the runtime gating conditions in `apps/web` that cause the
institutional verifier surfaces (`/passport`, `/passport/[id]`, `/verify/*`,
`/.well-known/*`, `/api/receipts/verify`) to render in degraded mode on the
apex production deployment (`vitalcv.com`).

It is scoped to **production environment** behaviour, with every condition
attributed to a verified file:line in the canonical-route-map branch. No
remediation step here implies a banned compliance claim; we describe what is
read and what falls back, not what becomes "verified" once unblocked.

Authoritative truth source for what each gate is allowed to claim:
`docs/architecture/vitalcv-knowledge-trust-graph.{md,json}`.

---

## §1 — `apiBase=false` source (backend base URL resolution)

### Trigger condition

`/api/health` reports `config.apiBase=false` when the env var
`NEXT_PUBLIC_API_BASE` is unset (or empty) on the Vercel project. The signal is
purely a *boolean projection of one env var*; it does not by itself mean that
backend fetches will fail.

### Source attribution

- Health surface boolean coerced from a single env read:
  `apps/web/app/api/health/route.ts:15` —
  `apiBase: Boolean(process.env.NEXT_PUBLIC_API_BASE)`.
- Authoritative base-URL resolver (precedence ladder):
  `apps/web/lib/backend-url.ts:9-28`.
  Precedence: `BACKEND_URL` (line 11) → `NEXT_PUBLIC_API_BASE` (line 15) →
  `NEXT_PUBLIC_BACKEND_URL` (line 18) → (`VERCEL` truthy OR
  `NODE_ENV === 'production'`) returns the hardcoded Railway origin
  `https://api.vitalcv.com` (line 22-24) → otherwise `http://localhost:4000`
  (line 27).
- Parallel client-side resolver (drift surface):
  `apps/web/lib/api.ts:40-58`. `getApiBase()` returns `''` when every env var
  in the chain is unset (line 48). `getBackendBase()` falls back to
  `https://api.vitalcv.com` only when `process.env.VERCEL` is truthy
  (line 54-57).
- Callers that import `BACKEND_URL` and pass it directly to `fetch()`:
  - `apps/web/app/api/ingest/[npi]/route.ts:2,135`
  - `apps/web/app/api/ingest/stream/[runId]/route.ts:4,8`
  - `apps/web/app/api/passport/entity/[id]/route.ts:2,15-17`
  - `apps/web/app/api/passport/[npi]/route.ts:2,13`

### Symptom on apex

The health probe shows `apiBase: false`. Backend traffic from `apps/web` still
flows to `https://api.vitalcv.com` because the production fallback at
`backend-url.ts:22-24` fires once `VERCEL` is present. So `apiBase=false`
alone is a *naming inconsistency in the health surface*, not a backend outage.

What it *does* hide: any consumer that prefers `getApiBase()` (e.g. the
client-side `api.ts` ladder) returns an empty string and may produce
relative-path fetches that bypass the explicit Railway override. Cross-check
when investigating a `/passport` lane regression — both ladders must agree.

### Operator remediation

Set `NEXT_PUBLIC_API_BASE=https://api.vitalcv.com` (or the desired backend
origin) on the apex Vercel project. This collapses both `backend-url.ts` and
`api.ts` to the same resolved value and turns the health surface boolean
`true`. It does not by itself unblock any other gate.

---

## §2 — Clerk disabled source

### Trigger condition

`apps/web/middleware.ts` evaluates `CLERK_MIDDLEWARE_ENABLED` at module load
from `process.env.CLERK_SECRET_KEY`. When that variable is empty/unset the
middleware skips the Clerk handler entirely. `/api/health` also exposes a
separate publishable-key probe that surfaces `clerk.enabled=false` when
`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is empty.

### Source attribution

- Gate constant: `apps/web/middleware.ts:35` —
  `const CLERK_MIDDLEWARE_ENABLED = Boolean(process.env.CLERK_SECRET_KEY);`.
- Fallback branch entered when Clerk is disabled:
  `apps/web/middleware.ts:126-140`. Public routes pass through (line 127-129),
  unprotected routes pass through (line 131-134), and any route returning a
  non-null required role is redirected to `/sign-in` with `redirect_url`
  preserved (line 136-139).
- Public-route allowlist used by the fallback:
  `apps/web/lib/auth/roles.ts:78-104`. Includes `/`, `/p/*`, `/verify/*`,
  `/trust-state/*`, `/.well-known/*`, `/auth/error`, and `/api/*` (line 103).
- Protected role table consulted by `getRequiredRole`:
  `apps/web/lib/auth/roles.ts:44-73`.
- Publishable-key probe (separate signal from `CLERK_SECRET_KEY`):
  `apps/web/app/api/health/route.ts:7,17-22`.
- CORS gate fires unconditionally before the Clerk fallback for any `/api/*`
  request that carries an `Origin` header: `apps/web/middleware.ts:113-124`.
  Allowlist is read from `ALLOWED_CORS_ORIGINS`
  (`apps/web/lib/security/corsAllowlist.ts:4-11`).

### Symptom on apex

`/api/health` returns `clerk.enabled: false, clerk.mode: 'none'`.

Surfaces in `PUBLIC_ROUTE_PATTERNS` (line 78-104) — including `/passport`'s
underlying API routes via the `/api/*` allowance (line 103), `/.well-known/*`
(line 101), and `/verify/*` (line 97) — remain reachable. The route `/passport`
itself is *neither* public nor in `PROTECTED_ROUTES`, so `getRequiredRole`
returns `null` (line 116-123) and `middleware.ts:131-134` lets it through.

Surfaces that *do* break when Clerk is disabled: anything in
`PROTECTED_ROUTES` (`/holder/*`, `/verifier/*`, `/issuer/*`, `/internal/*`,
`/pilot-ops/*`, `/mission-ops/*`, `/analytics/*`, `/billing/*`, `/dashboard/*`,
`/intelligence/*`, etc. — `roles.ts:44-73`). These redirect to `/sign-in`,
where Clerk's client SDK then has no publishable key and the sign-in widget
cannot mount. Result: a `/sign-in` shell that cannot authenticate any user.

Same-origin browser fetches to `/api/*` are unaffected by the CORS gate
(browsers omit `Origin` on same-origin requests, satisfying
`middleware.ts:115` — `if (origin !== null)`). Cross-origin API consumers,
however, are blocked unless `ALLOWED_CORS_ORIGINS` is populated
(`corsAllowlist.ts:22` — empty allowlist returns `allowlist_empty`).

### Operator remediation

Set `CLERK_SECRET_KEY` (server) and `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
(public) on apex. The middleware then exercises the real `clerkMiddleware`
handler (line 37-106). If cross-origin API access is also needed, set
`ALLOWED_CORS_ORIGINS` to a comma-separated origin list.

Note: the publishable-key probe and the secret-key gate are independent.
Setting only the publishable key flips `clerk.enabled=true` in `/api/health`
without enabling middleware enforcement; the inverse leaves the sign-in widget
non-functional. Set both.

---

## §3 — Passport hydration short-circuit

### Trigger condition

`/passport` and `/passport/[id]` render terminal degraded copy when any of the
hydration paths land in one of these states: `phase: 'error'`,
`disconnected: true`, `noProfileYet`, `runCompletedWithoutAnchor`, or
(on `/passport/[id]`) `passport === null`. Each is reached through a specific
chain of upstream signals.

### Source attribution

`/passport` (client-side SSE hydration) — hook `apps/web/hooks/useIngestStream.ts:50-145`:

- `startIngest` (line 102-136): wraps `startPublicIngest()` in try/catch; any
  throw writes `phase: 'error'` plus three `sources: 'error'` rows
  (line 124-135). This is reached when `/api/ingest/[npi]` returns a fallback
  body whose `runId` is null (parser throws at `ingestStreamState.ts:578-585`).
- `openStream.onerror` → `applyIngestDisconnect` (`useIngestStream.ts:79-83`).
  Implementation at `ingestStreamState.ts:548-568`: sets `phase: 'error'` and
  `disconnected: true` unless `prev.isUsable` was already true (line 552-558).
  Flips any `'checking'` source to `'error'` via `markCheckingSourcesAsError`
  (line 158-164).
- SSE `error` event handler: `ingestStreamState.ts:527-544`. Writes
  `phase: 'error'` only if `prev.isUsable === false` (line 528-534).

Phase classification in the page component
(`apps/web/app/passport/page.tsx:386-409`):

- `noProfileYet` (line 390-396): terminal + no anchor + (NPPES `SKIPPED` OR
  (`sources.nppes === 'done'` AND `identity.status === 'UNKNOWN'`)).
- `disconnected` (line 397): `state.disconnected` and not viewable.
- `runCompletedWithoutAnchor` (line 398-403): terminal + no anchor + not
  no-profile + not disconnected + identity authoritative.
- `genericError` (line 404-408): `phase === 'error'` and no anchor and not
  disconnected and not no-profile.

Terminal copy blocks (each renders a `TrustStateCard`): `noProfileYet`
line 753-759; `runCompletedWithoutAnchor` line 762-768; `disconnected`
line 771-778; `genericError` line 781-788 (copy via `resolveIngestErrorCopy`
line 74-103).

`/passport/[id]` (entity-keyed client component,
`apps/web/app/passport/[id]/PassportEntityClient.tsx:18-111`): fetch via
`fetchPassportEntity` (`apps/web/lib/api.ts:116-140`). When `result.ok` is
false the component sets `passport = null` (line 32), which short-circuits
at line 45-68 into the "Passport not available" `TrustStateCard`. No retry
loop; user must navigate back to `/passport`.

Lane-status rendering in the in-stream `SourceRow` (the visible "Unavailable"
labels): mapping table at `apps/web/app/passport/page.tsx:119-167`; row body
at line 169-196 renders the text `'Unavailable'` when `state === 'error'`
(line 174). The bottom `LaneHealthMount` strip is a separate surface — §6.

### Symptom on apex

Operator probe `GET /passport?npi=1346053246`:

- If the SSE stream returns no `passport_ready` event before `done`, and the
  NPPES result is `SKIPPED` or `identityStatus: UNKNOWN`, the page lands in
  `noProfileYet` and the four lanes resolve to whatever the in-stream
  `sources` map last set (often `pending` for some, `error` for others if the
  stream disconnected mid-flight — see `applyIngestDisconnect`).
- If the fetch to `POST /api/ingest/[npi]` returns `200 { fallback: true,
  runId: null }` (the soft-failure path described in §4), the parser at
  `ingestStreamState.ts:578-585` throws because there is no `runId`. That
  lands in the `phase: 'error'` block at `useIngestStream.ts:124-135` with all
  three sources set to `'error'`.

### Operator remediation

Only fixed by the upstream signal arriving. The hook contains no degraded-data
synthesis. Unblock by:

1. Restoring `https://api.vitalcv.com/api/ingest/[npi]` so it returns a real
   `runId` (see §4 fallback semantics).
2. Confirming the SSE stream from
   `https://api.vitalcv.com/api/ingest/[runId]/stream` reaches at least one
   `passport_ready` event with `authoritative: true` and a non-null
   `entityId` (`ingestStreamState.ts:486-503`).

---

## §4 — Upstream fetch aborts in passport-related API routes

### Trigger condition

Every server-side proxy in `apps/web/app/api/{ingest,passport}/**` wraps its
upstream call in `try/catch` with a hard timeout, and on any failure path
returns a *degraded but well-shaped* response. The page hydration logic then
decides how to surface that.

### Source attribution

`POST /api/ingest/[npi]`
(`apps/web/app/api/ingest/[npi]/route.ts`):

- 15 second timeout via `AbortController`: `fetchWithTimeout` lines 103-111;
  invoked at line 145.
- Upstream `≥ 500` → `fallbackResponse(npi, 'upstream_5xx', …)` line 148-157.
- Upstream `≥ 400` → `fallbackResponse(npi, 'upstream_4xx', …)` line 159-168.
- Non-JSON body → `fallbackResponse(npi, 'non_json', …)` line 170-182.
- Thrown `AbortError` → `'timeout'`, other throws → `'network'`,
  line 185-198.
- `fallbackResponse` *always* returns HTTP 200 with `runId: null` and a
  static `FALLBACK_LANES` constant of four `'pending' | 'access_required'`
  rows: lines 35-40, 63-97. Comment at line 26-27 explicitly states "No lane
  is ever returned as `verified` by the fallback."

`GET /api/ingest/stream/[runId]`
(`apps/web/app/api/ingest/stream/[runId]/route.ts`):

- No `try/catch`. Streams `upstream.body` straight through. If the upstream
  `fetch` rejects, Next.js returns a 5xx and the browser's `EventSource`
  fires `onerror`, which trips `applyIngestDisconnect` (see §3).
- Lines 7-19. Sets `'X-Accel-Buffering': 'no'` so Vercel does not buffer the
  stream.

`GET /api/passport/entity/[id]`
(`apps/web/app/api/passport/entity/[id]/route.ts`):

- `cache: 'no-store'` + `AbortSignal.timeout(8000)`: line 21-22.
- Non-OK upstream → returns `{ error, detail }` with upstream status, line 26-34.
- Thrown error → 503 (or 502 if the parser threw "Invalid passport payload")
  with `{ error: 'Passport unavailable' | 'invalid_upstream_payload', detail }`
  line 37-47.
- `assertPassportData` (`apps/web/lib/trust/passport-contract.ts`) runs at
  line 36; any contract violation becomes a 502.

`GET /api/passport/[npi]`
(`apps/web/app/api/passport/[npi]/route.ts`):

- Symmetric implementation to `entity/[id]`. Timeout 8000ms at line 15;
  non-OK at line 19-27; throw → 502/503 at line 32-40.

### Symptom on apex

When the apex backend at `https://api.vitalcv.com` is unreachable, slow, or
mid-redeploy:

- `/api/ingest/[npi]` returns 200 with `{ ok: false, fallback: true,
  runId: null, lanes: [...] }`. `startPublicIngest` in `apps/web/lib/api.ts`
  (line 100-114) does not branch on `fallback` — it passes the body to
  `parseIngestStartResponse` (`ingestStreamState.ts:570-587`) which throws
  because `runId` is missing. The page lands in `phase: 'error'` with three
  `sources: 'error'` rows.
- `/api/passport/entity/[id]` returns a 502 or 503 with `error: 'Passport
  unavailable'`. `PassportEntityClient` reads `result.ok = false` and falls to
  the "Passport not available" `TrustStateCard`.

### Operator remediation

These routes are designed to fail closed in a structured way; nothing in
`apps/web` requires further config to make them safer. The unblocking signal
is upstream backend availability and contract conformance
(`passport-contract.ts:assertPassportData`).

The lane-shape lie hazard: an apex caller might mistake `fallback: true,
lanes: [...]` for a usable response. The page-side code does not, but any
downstream pilot integration calling `/api/ingest/[npi]` directly must check
`body.fallback === true` first.

---

## §5 — Replay reader disablement

### Trigger condition

The replay reader primitives named in the brief —
`apps/web/lib/replay/clientReplayIdentity.ts`,
`apps/web/components/trust/ReplayIntegrityPanel.tsx`,
`apps/web/components/trust/ReplayLineage*` — **do not exist on this branch**
(`wave/canonical-route-map`). There is therefore nothing to short-circuit;
the surface area is absent.

### Source attribution

- Verified by `find apps/web -iname "*replay*"` (no matches in `lib/` or
  `components/`), `find apps/web/lib/replay` (no such directory), and
  `grep -rn "clientReplayIdentity\|ReplayIntegrityPanel\|ReplayLineage"
  apps/web` (no hits).
- Files that contain "replay" only in comments / write-side persistence:
  `apps/web/lib/issuer-verification/auditPersistence.ts`,
  `auditPersistenceAdapter.ts`, `serverPsvReceiptWriter.ts`, `statusCopy.ts`,
  `apps/web/lib/proof/types.ts`,
  `apps/web/lib/identity/identityVerificationControls.ts`,
  `apps/web/lib/security/retentionFoundation.ts`,
  `apps/web/lib/pilot/pilotKpiTypes.ts`. None is a replay reader.
- Backend-side replay engine: `apps/api/backend/src/services/audit/replayEngine.ts`
  (not part of the web runtime gating surface).

### Symptom on apex

No replay panel renders on `/passport`, `/passport/[id]`, `/verify/*`, or
`/.well-known/*`. There is nothing for a client to gate or short-circuit; the
surface area simply does not ship in `apps/web` on this branch.

### Operator remediation

Not an environment gate. If a replay reader is required for institutional
verifier coherence, it must be implemented (separate wave). Until then, the
"replay disabled" symptom on apex is structural, not configuration-driven, and
no env var unblocks it.

---

## §6 — Verifier continuity disablement (/.well-known/*, /api/receipts/verify)

### Trigger condition

The verifier-continuity surfaces fall into two clusters: the receipt
sign/verify chain (ES256 keypair) and the mobile-association manifests
(Apple/Android). Each has its own degraded path.

### Source attribution

ES256 keypair loader (`apps/web/lib/crypto/receiptIssuer.ts:33-72`):
`getOrInitKeypair()` reads `RECEIPT_PRIVATE_KEY_JWK` (line 53) and
`RECEIPT_KID` (line 54). If set: parses JSON, calls `importJWK(jwk, 'ES256')`
(line 58), strips `d` to derive the public JWK (line 61), returns
`{privateKey, publicKey, kid}` (line 64). If unset: mints an *ephemeral*
keypair via `generateReceiptKeypair()` (line 68 → 36-42). The header comment
at line 6-9 flags this as dev-only: "The keypair is NOT persisted across
restarts — dev only." Issuer URL fallback chain at
`receiptIssuer.ts:105-109` reads `VITACV_ISSUER_URL`, then
`NEXT_PUBLIC_APP_URL`, then literal `'https://vitalcv.com'`.

JWKS publication: `apps/web/app/api/.well-known/jwks.json/route.ts:19-30`
calls `getPublicKeyJwk()` and serves with `Cache-Control: public,
max-age=3600, stale-while-revalidate=86400` (line 26); `revalidate = 3600`
(line 17) and `runtime = 'nodejs'` (line 15).

Receipt verification: `apps/web/app/api/receipts/verify/route.ts:1-16` is a
POST endpoint that rejects missing tokens (400) and tokens > 8192 chars
(400), then delegates to `verifyReceiptJWT`. Implementation at
`apps/web/lib/trust/jwtVerifier.ts:11-28` builds a local JWKS from
`getPublicKeyJwk()` (line 13-14), enforces `algorithms: ['ES256']`
(line 17), classifies failure (line 21-25), returns
`{verified: false, error, errorCode}`.

Mobile-association manifests:

- AASA: `apps/web/app/.well-known/apple-app-site-association/route.ts:13-15`
  reads `APPLE_TEAM_ID`, `APPLE_BUNDLE_ID`, `APPLE_CLIP_BUNDLE_ID` with
  placeholder fallbacks `'XXXXXXXXXX'`, `'com.vitalcv.app'`,
  `'com.vitalcv.app.Clip'`.
- assetlinks: `apps/web/app/.well-known/assetlinks.json/route.ts:12-16` reads
  `ANDROID_PACKAGE_NAME` (default `'com.vitalcv.app'`) and
  `ANDROID_SHA256_FINGERPRINT` (default 32 zero bytes).

Source-health lane snapshots (the "Unavailable / Unknown" labels the operator
sees in `LaneHealthMount`):

- Store: `apps/web/lib/source-health/store/snapshotStore.ts:25` — in-process
  `Map<SourceId, SourceHealthSnapshot>()`. Empty on cold start.
- `getLaneSnapshots()` at
  `apps/web/lib/source-health/getLaneSnapshots.ts:25-40`: when the store has
  no entry, returns a deterministic UNKNOWN placeholder (line 36-39 →
  `placeholderSeed` 42-66). State board reason
  `'no_generic_state_board_probe_wired'` (line 51); other sources
  `'placeholder_seed_no_live_probe'` (line 60).
- Badge: `apps/web/components/source-health/LaneHealthBadge.tsx:18-41`.
  `UNKNOWN → outline` + label `"Unknown"`; `UNAVAILABLE → trust-red` + label
  `"Unavailable"`.
- Probe runner only fires from `/api/internal/source-health/probe`,
  authenticated via `CRON_SECRET` or `MONITORING_SECRET`
  (`apps/web/app/api/internal/source-health/_auth.ts:81-86`,
  `_handler.ts:23-44`). In production this is cron-only; no user request
  populates the store.
- Neutral copy table: `apps/web/lib/source-health/unavailableLane.ts:47-66`
  enforces the banned-phrase list at line 25-38.

### Symptom on apex

- `/.well-known/jwks.json` always returns a well-shaped JWKS, but the
  `kid` and key material depend on which path `getOrInitKeypair` took. If
  `RECEIPT_PRIVATE_KEY_JWK` is unset on apex, every cold start mints a fresh
  ephemeral key. JWTs signed before a redeploy fail verification afterwards
  (`signature_invalid` from `jwtVerifier.ts:22`).
- `/api/receipts/verify` accepts the request and returns
  `{verified: false, errorCode: 'signature_invalid'}` for any token signed
  by a prior process.
- `/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json`
  serve manifests whose `appID` / `package_name` / fingerprint values are the
  literal placeholder strings when the mobile env vars are unset. iOS /
  Android Universal-Link verification then rejects the manifest, so deep
  links to `/verify/*` and `/clip/verify/*` will not associate with a native
  app even when the URLs themselves render correctly.
- The `LaneHealthMount` band on `/passport` and `/passport/[id]` renders four
  `UNKNOWN` badges with reasons `placeholder_seed_no_live_probe` and
  `no_generic_state_board_probe_wired`. This is the surface the operator
  reported as "Unavailable / Unknown" lane status. The badges are
  *deliberately neutral* — they do not claim source outage; they claim absence
  of a recent live reading. The truth-contract invariant at
  `getLaneSnapshots.ts:17-23` requires this and forbids LIVE except after a
  confirmed 2xx probe.

### Operator remediation

For verifier continuity:

1. Set `RECEIPT_PRIVATE_KEY_JWK` (full JWK JSON) and `RECEIPT_KID` on apex.
   This pins the keypair across redeploys and makes JWKS rotation explicit.
2. Set `VITACV_ISSUER_URL` to the canonical apex origin so `iss` claims do
   not silently drift to the `NEXT_PUBLIC_APP_URL` value (or the hardcoded
   fallback at `receiptIssuer.ts:109`).
3. Set `APPLE_TEAM_ID`, `APPLE_BUNDLE_ID`, `APPLE_CLIP_BUNDLE_ID`,
   `ANDROID_PACKAGE_NAME`, `ANDROID_SHA256_FINGERPRINT` to the real release
   values. Without these, mobile-association is a permanent dev placeholder.

For lane-health continuity:

1. Configure a scheduled invocation of `/api/internal/source-health/probe`
   (cron + `CRON_SECRET`) so the snapshot store gets populated. Without this,
   `LaneHealthMount` shows four `UNKNOWN` rows forever — including on
   `/passport/[id]` for known-good NPIs.
2. There is no env var that flips lane-health into a positive state without
   running the probes. The placeholder seed contract at
   `getLaneSnapshots.ts:21-22` is enforced.

---

## §7 — Gate Dependency DAG

This tree shows how environment / data signals cascade into the visible
degraded states on apex. Read top-down: a missing root signal forces every
child branch into its degraded path.

```
production deployment (Vercel project: apex / vitalcv.com)
│
├── env NEXT_PUBLIC_API_BASE unset                                               [§1]
│   ├── /api/health → config.apiBase = false                                     [health/route.ts:15]
│   ├── backend-url.ts:22-24 falls through VERCEL branch
│   │       → BACKEND_URL = https://api.vitalcv.com (proxies still functional)
│   └── client-side getApiBase() returns ''  (drift hazard for direct callers)   [api.ts:48]
│
├── env CLERK_SECRET_KEY unset                                                   [§2]
│   ├── middleware.ts:35 CLERK_MIDDLEWARE_ENABLED = false
│   ├── PROTECTED_ROUTES (/holder/*, /verifier/*, /issuer/*, /internal/*, …)
│   │       → redirect to /sign-in → dead-end                                    [middleware.ts:131-139]
│   ├── /passport itself is neither public nor protected → passes through        [middleware.ts:131-134]
│   └── PUBLIC routes (/, /p/*, /verify/*, /.well-known/*, /api/*) pass          [roles.ts:78-104]
│
├── env NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY unset                                  [§2]
│   └── /api/health → clerk.enabled=false, clerk.mode='none'; Clerk JS widgets
│       cannot mount even on /sign-in                                            [health/route.ts:17-22]
│
├── env ALLOWED_CORS_ORIGINS unset / empty                                       [§2]
│   ├── Same-origin /api/* passes (no Origin header → middleware.ts:115)
│   └── Cross-origin /api/* returns 403 x-cors-blocked                           [middleware.ts:115-123]
│
├── upstream backend availability: api.vitalcv.com                               [§4]
│   ├── reachable + contract OK
│   │   ├── POST /api/ingest/[npi] → real runId
│   │   ├── SSE /api/ingest/stream/[runId] → passport_ready (authoritative)
│   │   │       → useIngestStream isUsable=true, anchorEntityId set              [ingestStreamState.ts:486-503]
│   │   │       → /passport "View full passport" → /passport/[id]
│   │   │       → PassportEntityClient renders PassportWallet                    [§3]
│   │   └── /api/passport/entity/[id] returns asserted PassportData
│   ├── upstream 5xx / 4xx / non-JSON / timeout
│   │   └── /api/ingest/[npi] returns { fallback: true, runId: null }            [§4]
│   │       → parseIngestStartResponse throws (ingestStreamState.ts:578-585)
│   │       → phase='error', sources: all 'error' → genericError card            [page.tsx:781-788]
│   ├── upstream returns runId but SSE disconnects
│   │   └── EventSource.onerror → applyIngestDisconnect                          [ingestStreamState.ts:548-568]
│   │       → phase='error', disconnected=true → disconnected card               [page.tsx:771-778]
│   ├── completed with NPPES SKIPPED / UNKNOWN
│   │   └── noProfileYet=true → "No profile found for this NPI yet"              [page.tsx:753-759]
│   └── done event, authoritative identity, but no anchor
│       └── runCompletedWithoutAnchor=true → provisional copy                    [page.tsx:762-768]
│
├── env RECEIPT_PRIVATE_KEY_JWK (+ RECEIPT_KID) unset                            [§6]
│   ├── Cold-start mints ephemeral ES256 keypair                                 [receiptIssuer.ts:67-69]
│   ├── /.well-known/jwks.json publishes the current ephemeral key
│   └── /api/receipts/verify → errorCode='signature_invalid' for any
│       token signed before the redeploy                                         [jwtVerifier.ts:22]
│
├── env VITACV_ISSUER_URL (+ NEXT_PUBLIC_APP_URL) unset                          [§6]
│   └── iss claim defaults to literal 'https://vitalcv.com'                      [receiptIssuer.ts:105-109]
│
├── env APPLE_TEAM_ID / APPLE_BUNDLE_ID / APPLE_CLIP_BUNDLE_ID unset             [§6]
│   └── AASA serves placeholder appIDs → iOS rejects Universal Link assoc;
│       /verify/* deep links do not open native app                              [aasa/route.ts:13-15]
│
├── env ANDROID_PACKAGE_NAME / ANDROID_SHA256_FINGERPRINT unset                  [§6]
│   └── assetlinks.json serves 32-byte zero-fingerprint → Android rejects        [assetlinks/route.ts:12-16]
│
├── source-health probe schedule (CRON_SECRET / MONITORING_SECRET) absent        [§6]
│   ├── snapshotStore is empty                                                   [snapshotStore.ts:25]
│   ├── getLaneSnapshots returns 4× UNKNOWN placeholder seeds                    [getLaneSnapshots.ts:42-66]
│   └── LaneHealthMount renders four "Unknown" badges
│       ← THIS IS THE "UNAVAILABLE / UNKNOWN" LANE SURFACE THE OPERATOR SAW
│
└── replay reader primitives (clientReplayIdentity / ReplayIntegrityPanel /      [§5]
        ReplayLineage*) — not present in apps/web on this branch
    └── structural absence, not a gate
```

### Cascade interpretation for the operator-reported symptom

The operator probe found "Unavailable / Unknown" lane statuses on
`/passport?npi=1346053246`. Two surfaces stamp lane statuses on that page:

1. The in-stream `SourceRow` cards (§3) — driven by the SSE event stream from
   `POST /api/ingest/[npi]` → `GET /api/ingest/stream/[runId]`. These show
   `Unavailable` (red) when the stream lands in an error state, or `Pending`
   (outline) before any source completes.
2. The `LaneHealthMount` strip (§6) — driven entirely by the local snapshot
   store. With no probe schedule running on apex, every lane shows
   `Unknown` (outline) with reason `placeholder_seed_no_live_probe`.

To distinguish which surface is reporting "Unavailable / Unknown" on a given
load, inspect the badge variants in DOM:

- `data-source-state="UNKNOWN"` on `LaneHealthBadge` (`source-health` strip)
  → §6 probe schedule gate.
- `Unavailable` text inside a `SourceRow` (`page.tsx:174`) → §3 / §4 upstream
  ingest gate.

The two gates are independent. Both must be unblocked to make the
`/passport?npi=…` surface render coherent lane statuses across both bands.

# Upstream Fetch Topology

Branch: `wave/canonical-route-map` (verifier-continuity surfaces from #345/#349/#355 stacked in).
Scope: every `fetch()` call in `apps/web/**` that crosses a process boundary at runtime
(server-side proxy routes, server components, hooks, lib helpers, and browser components
that hit `/api/*` and therefore re-enter the same Vercel function). Test files in
`__tests__/` and the `_archive/` tree are excluded from the inventory; mocked endpoints
in tests are referenced inline where they constrain a contract.

The audit is structured along the seven axes the supervisor asked for:
1. Internal fetch targets (file:line → URL pattern → method)
2. Environment-variable dependencies and divergence
3. Edge-runtime compatibility
4. Server-runtime compatibility (server components doing same-origin fetch)
5. Timeout behavior
6. Retry behavior
7. Failure propagation

Sections §A–§D cluster fetch sites by destination class; §E is the
`TypeError: fetch failed` attribution matrix.

---

## Resolver inventory

Three shared resolver entry points exist, plus a fourth ad-hoc form copy-pasted across
about a third of the route handlers. The divergence between them is itself a risk surface.

| Resolver | Source | Precedence | Behavior when all env vars absent |
| --- | --- | --- | --- |
| `BACKEND_URL` (const) | `apps/web/lib/backend-url.ts` | `BACKEND_URL` → `NEXT_PUBLIC_API_BASE` → `NEXT_PUBLIC_BACKEND_URL` → (`VERCEL` or `NODE_ENV=production` ? `https://api.vitalcv.com` : `http://localhost:4000`) | Railway prod URL on Vercel, localhost in dev |
| `getApiBase()` | `apps/web/lib/api.ts:40` | `BACKEND_URL` → `NEXT_PUBLIC_API_BASE` → `NEXT_PUBLIC_BACKEND_URL` → `NEXT_PUBLIC_API_URL` → `''` | Empty string (path-only requests) |
| `getBackendBase()` | `apps/web/lib/api.ts:51` | `getApiBase()` non-empty → that; else `VERCEL` ? `https://api.vitalcv.com` : `http://localhost:4000` | Railway prod URL on Vercel, localhost in dev |
| Inline ad-hoc | ~40+ handlers | `BACKEND_URL` → `NEXT_PUBLIC_API_BASE` → `NEXT_PUBLIC_BACKEND_URL` → `http://localhost:4000` | **localhost on production if env unset** |

The inline form is the dangerous one: on a Vercel deployment that for any reason is
missing all three env vars (e.g. a preview build, a misconfigured project, a Railway
domain swap that did not propagate), every handler using the inline resolver targets
`http://localhost:4000`. The `BACKEND_URL`/`getBackendBase` variants both fall back
to Railway production when `VERCEL=1` is in scope. The Vercel build only sets `VERCEL`
in the function runtime; if a build-time evaluation captures the const (as it does
because each inline form is a module-level `const`), the resolved value is frozen at
module load with whatever env was visible then.

Two further outliers:
- `apps/web/app/api/graph-engine/[...path]/route.ts:7` resolves only `NEXT_PUBLIC_API_URL || 'http://localhost:4000'`. **No** `BACKEND_URL`, **no** Railway fallback.
- `apps/web/app/api/verify-professional/route.ts:3` and `verify-professional/[npi]/route.ts` resolve only `NEXT_PUBLIC_API_URL`.

---

## §A Backend-bound fetches (Vercel → Railway `api.vitalcv.com`)

These cross the public internet from a Vercel serverless function to Railway. Every one
of them is a candidate for `TypeError: fetch failed` if DNS, TLS, or socket layers
hiccup.

### A.1 Trust / passport surfaces

| File:line | Target | Method | Resolver | Timeout | Retry | Failure |
| --- | --- | --- | --- | --- | --- | --- |
| `app/api/passport/npi/[npi]/route.ts:10` | `${B}/api/passport/npi/${npi}` | GET | `BACKEND_URL` (import) | `AbortSignal.timeout(8000)` | none | catch → `503` `{error:'Passport unavailable', detail:String(err)}`; payload contract violation → `502` `invalid_upstream_payload` |
| `app/api/passport/entity/[id]/route.ts:20` | `${B}/api/passport/{npi|entity}/${id}` | GET | `BACKEND_URL` (import) | 8000ms | none | same shape as above |
| `app/api/passport/[npi]/route.ts:13` | `${BACKEND_URL}/api/passport/{npi}` | GET | `BACKEND_URL` (import) | 8000ms | none | same shape as above |
| `app/api/passport/[npi]/trust/route.ts:17` | `${BACKEND}/api/passport/{npi}/trust` | GET | inline ad-hoc | (none seen) | none | catch → 502/503 path |
| `app/api/passport/[npi]/export/route.ts:25` | `${BACKEND}/api/passport/{npi}/export` | GET | inline ad-hoc | 10000ms | none | catch → `502 {error:'export_failed'}` |
| `app/api/passport/[npi]/embed.svg/route.ts:17` | `${BACKEND}/api/passport/{npi}/embed.svg` | GET | inline ad-hoc | 8000ms | none | catch → empty `503` SVG body |
| `app/api/passport/analytics/route.ts:18` | `${BACKEND}/api/passport/analytics` | GET | inline ad-hoc | (varies) | none | error → 503 |
| `app/api/passport/analytics/[npi]/route.ts:22` | `${BACKEND}/api/passport/analytics/{npi}` | GET | inline ad-hoc | 8000ms | none | catch → `503 {error:'Analytics unavailable'}` |
| `app/api/passport/analytics/[npi]/accept/route.ts:7` | `${BACKEND}/api/passport/analytics/{npi}/accept` | POST | `BACKEND_URL` (import) | 5000ms | none | catch → `503` |
| `app/api/passport/analytics/[npi]/qr/route.ts:7` | …/qr | POST | `BACKEND_URL` (import) | 5000ms | none | catch → `503` |
| `app/api/passport/analytics/[npi]/download/route.ts:9` | …/download | POST | `BACKEND_URL` (import) | 5000ms | none | catch → `503` |
| `app/api/passport/analytics/[npi]/share/route.ts:7` | …/share | POST | `BACKEND_URL` (import) | 5000ms | none | catch → `503` |
| `app/api/trust-proof/[npi]/route.ts:23` | `${BACKEND}/api/trust-proof/{npi}` | GET | inline ad-hoc | **none** | none | catch → `502 {error:'Failed to fetch trust proof'}` |
| `app/api/trust-state/[npi]/route.ts:21` | `${B}/api/trust-state/{npi}` | GET | (uses local `B`, inline) | (none seen) | none | error → 5xx pass-through |
| `app/api/trust-state/[npi]/refresh/route.ts:28` | …/refresh | POST | inline ad-hoc | (none seen) | none | same |
| `app/api/trust-state/[npi]/history/route.ts:24` | …/history | GET | inline ad-hoc | **none** | none | no catch wrapper visible at the call site |
| `app/api/trust/monitoring/status/route.ts:17` | `${B}/api/trust/monitoring/status` | GET | inline ad-hoc | none | none | error → 5xx |
| `app/api/trust/events/route.ts:20` | `${B}/api/trust/events` | POST | inline ad-hoc | none | none | error → 5xx |

`/api/passport/{npi,entity,[npi]}/route.ts` are the canonical institutional-surface
endpoints; all three import `BACKEND_URL` (the safe resolver), declare `runtime = 'nodejs'`,
and use a uniform `503` on network-class failure and `502` on contract violation. This
is the right pattern. The drift starts at `trust-proof` and `trust-state/history` —
neither sets a timeout and the latter has no try/catch in the happy-path read,
meaning a slow Railway response will hold a Vercel function open until the platform
timeout (10s / 60s / 300s depending on plan).

### A.2 Employer review surfaces

| File:line | Target | Method | Resolver | Timeout | Retry | Failure |
| --- | --- | --- | --- | --- | --- | --- |
| `app/api/employer-review/[entityId]/[action]/route.ts:381` | `${BACKEND}/api/employer-review/{id}/{action}` | POST | `BACKEND_URL` (import) | 8000ms | none | catch → `503 backend_unavailable` with err.message; non-ok → `normalizeUpstreamError` → upstream status; contract violation → `502 invalid_upstream_payload` |
| `app/api/employer-review/[entityId]/[action]/route.ts:455` | same | GET | `BACKEND_URL` (import) | 8000ms | none | same |
| `app/api/employer-review/npi/[npi]/refresh-requests/route.ts:17` | `${BACKEND}/api/employer-review/npi/{npi}/refresh-requests` | GET | `BACKEND_URL` (import) | **none** | none | **no try/catch** — raw upstream `fetch` will throw `TypeError: fetch failed` to the Next runtime and Next will return a default 500 |

The `[action]` route is the gold standard: explicit timeout, distinct 502/503 status
codes, contract validation, no leakage of backend URL in the detail field. The
`refresh-requests` route on the other hand is a hard production gap — a `fetch failed`
there returns the unhelpful Next.js default error page.

### A.3 Identity / ingest / readiness

| File:line | Target | Method | Resolver | Timeout | Retry | Failure |
| --- | --- | --- | --- | --- | --- | --- |
| `app/api/identity/bootstrap/[npi]/route.ts:18` | `${BACKEND}/api/identity/bootstrap/{npi}` | GET | inline ad-hoc | 8000ms | none | catch → `503 {error:'Identity bootstrap unavailable', detail:String(err)}` — **leaks `err`** |
| `app/api/identity/[npi]/ingest/route.ts:42` | `${BACKEND}/api/identity/{npi}/ingest` | POST | inline ad-hoc | 12000ms | none | catch → `503 {error:'Backend unavailable'|'Ingest timed out', detail:String(err), fallback:true}` — leaks `err` |
| `app/api/ingest/[npi]/route.ts:107` | `${B}/api/ingest/{npi}` | POST | `BACKEND_URL` (import) | 15000ms (via `AbortController` + `setTimeout`) | none | catch → `200` body with `fallback:true, reason:'timeout'\|'network'`; npi_prefix masked in logs; **no `err.message` echoed to client** |
| `app/api/ingest/stream/[runId]/route.ts:8` | `${B}/api/ingest/{runId}/stream` | GET (SSE) | `BACKEND_URL` (import) | **none — long-lived SSE** | none | **no try/catch** — fetch failure crashes the route |

`apps/web/app/api/ingest/[npi]/route.ts` is the model degradation path: it returns
HTTP 200 with a structured `fallback: true` body and a typed `reason` so the client
never dead-ends. The header `x-org-id: process.env.PUBLIC_WEDGE_ORG_ID ?? 'demo-pilot-org-alpha'`
is set unconditionally; if that env var diverges between web and backend tenant guard,
the route will get `403` upstream and the client sees `reason: 'upstream_4xx'`.

`ingest/stream` is an SSE pass-through. No timeout makes sense for streams, but the
absence of try/catch means a `TypeError: fetch failed` on stream open (Railway cold
start, DNS blip, IPv6 reachability) becomes a Vercel function crash.

### A.4 Intelligence / copilot / launch-readiness

| File:line | Target | Method | Resolver | Timeout | Retry | Failure |
| --- | --- | --- | --- | --- | --- | --- |
| `app/api/intelligence/providers/route.ts:37` | `${getBackendBase()}/api/trust/score/batch` | POST | `getBackendBase()` | (in `fetchBackendJson`) | none | shaped fallback via `_shared` |
| `app/api/intelligence/_shared.ts:124` | `${backendBase()}/api/me/workspaces` | GET | `getBackendBase()` (aliased) | 8000ms | none | returns `null`, caller decides |
| `app/api/intelligence/_shared.ts:430` | (variable url) | varies | varies | (in fetcher) | none | logged fallback usage |
| `app/api/intelligence/findings/[...path]/route.ts:89` | `${BACKEND}/api/investigators/findings/...` | POST | inline ad-hoc with `getApiBase()` chain | 12000ms | none | `await response.json().catch(() => ({}))` then normalized; **no outer try/catch** — fetch failure throws |
| `app/api/intelligence/launch-readiness/route.ts:121` | (variable `input`) | GET | `loadJson` wrapper | 12000ms | none | returns `{ok:false, error}` |
| `app/api/intelligence/launch-readiness/route.ts:145` | `new URL(target.href, origin)` (same-origin self-fetch) | GET | request origin | 12000ms | none | returns `{status:'fail', detail:err.message}` |
| `app/api/copilot/_shared.ts:788` | `${BACKEND}/api/copilot/query` | POST | (module-level) | 12000ms | none | catch → `buildCopilotQueryFallback({...})` |
| `app/api/copilot/investigation/route.ts:28` | `${BACKEND}/api/copilot/investigation` | POST | `getBackendBase()` | 12000ms | none | catch → `503 copilot_source_unavailable` |
| `app/api/internal/launch-ops/route.ts:146` | `new URL('/api/intelligence/launch-readiness', req.nextUrl.origin)` (same-origin) | GET | request origin | 12000ms | none | no catch, then conditional `503` |
| `app/api/feed/live/route.ts:164` | `${getBackendBase()}/api/feed/live` | GET | `getBackendBase()` | 8000ms | none | catch → degraded feed from in-memory cache or `degradedFeed(...)` |

### A.5 Network / telemetry / system

Almost every route under `apps/web/app/api/network/**` and `apps/web/app/api/system/**`
follows the same template: declare `runtime = 'nodejs'`, inline-resolve `BACKEND`, fetch
with `AbortSignal.timeout(8000)`, return `503 {error, detail:String(err)}` on catch.
Representative samples (all node runtime, all 8000ms timeout, all no retry, all
`503 + detail:String(err)` on catch unless noted):

`app/api/network/health/route.ts:20`, `app/api/network/telemetry/route.ts:26`,
`app/api/network/telemetry/issuers/route.ts:8` (imports `BACKEND_URL`),
`app/api/network/telemetry/verifications/route.ts:10`,
`app/api/network/telemetry/revocations/route.ts:10`,
`app/api/network/global/performance/route.ts:8`,
`app/api/network/federation/discover/route.ts:19,35` (15s/20s timeouts),
`app/api/network/activity/route.ts:23`, `app/api/network/growth/route.ts:23`,
`app/api/system/status/route.ts:18`, `app/api/system/trust-health/route.ts:19`,
`app/api/system/trust-health/graph/route.ts:19`,
`app/api/system/trust-health/orphans/route.ts:19`.

The `String(err)` detail leakage exposes the Railway hostname when DNS or TLS fails
(e.g. `TypeError: fetch failed (ENOTFOUND api.vitalcv.com)`). It is benign because the
host is already public, but worth knowing.

### A.6 Apply / share / hiring / opportunities

| File:line | Target | Method | Notes |
| --- | --- | --- | --- |
| `app/api/apply/bundle/[bundleId]/route.ts:18` | `${B}/api/apply/bundle/{id}` | GET | inline `B`, no timeout, no catch |
| `app/api/apply/bundle/route.ts:19` | `${B}/api/apply/bundle` | POST | inline `B`, no timeout, no catch |
| `app/api/apply/verify/route.ts:15` | `${B}/api/apply/verify` | POST | inline `B`, no timeout |
| `app/api/apply/share/route.ts:17` | `${B}/api/apply/share` | POST | inline `B`, no timeout |
| `app/api/apply/share/[shareId]/route.ts:17` | `${B}/api/apply/share/{id}` | GET | inline `B`, no timeout |
| `app/api/apply/shares/[npi]/route.ts:17` | `${B}/api/apply/shares/{npi}` | GET | inline `B`, no timeout |
| `app/api/hiring/start/route.ts:31` | `${MARKETPLACE_BACKEND}/api/hiring/start` | POST | resolver: `getBackendBase()` via `marketplace-proxy.ts` |
| `app/api/hiring/accept/route.ts:36` | `${MARKETPLACE_BACKEND}/api/hiring/accept` | POST | same |
| `app/api/opportunities/route.ts:35` | `${B}/api/opportunities` | GET | inline `B` |
| `app/api/opportunities/[id]/route.ts:17` | `${getBackendBase()}/api/opportunities/{id}` | GET | safe resolver |
| `app/api/opportunities/[id]/apply/route.ts:41` | `${MARKETPLACE_BACKEND}/api/opportunities/{id}/apply` | POST | safe resolver |
| `app/api/opportunities/[id]/applications/route.ts:17` | `${MARKETPLACE_BACKEND}/api/opportunities/{id}/applications` | GET | safe resolver |

The `apply/*` cluster is uniformly missing both timeout and try/catch. On a Railway
flap every one of them hands a default Next.js 500 to the browser.

### A.7 Reports / search / watch / decisions

| File:line | Target | Method | Timeout |
| --- | --- | --- | --- |
| `app/api/report/route.ts:18` | `${BACKEND}/api/report` | POST | 30000ms |
| `app/api/report/[npi]/route.ts:20` | `${BACKEND}/api/report/{npi}` | GET | 30000ms |
| `app/api/report/[npi]/summary/route.ts:20` | `${BACKEND}/api/report/{npi}/summary` | GET | 20000ms |
| `app/api/search/suggest/route.ts:47` | `${BACKEND}/api/search/suggest` | POST | — |
| `app/api/search/query/route.ts:47` | `${BACKEND}/api/search/query` | POST | — |
| `app/api/watch/route.ts:29,43` | `${BACKEND}/api/watch` | GET/POST | — |
| `app/api/watch/[id]/route.ts:34,51` | `${BACKEND}/api/watch/{id}` | GET/DELETE | — |
| `app/api/decisions/route.ts:13` | `${BACKEND_URL}/api/decisions` | GET | — |
| `app/api/decisions/[npi]/route.ts:22` | `${B}/api/decisions/{npi}` | GET | — |
| `app/api/decisions/impact/[npi]/route.ts:22` | `${B}/api/decisions/impact/{npi}` | GET | — |
| `app/api/decisions/institutions/[id]/route.ts:17` | `${BACKEND_URL}/api/decisions/institutions/{id}` | GET | — |
| `app/api/decisions/specialties/[slug]/route.ts:17` | `${BACKEND_URL}/api/decisions/specialties/{slug}` | GET | — |
| `app/api/decisions/providers/[id]/route.ts:17` | `${BACKEND_URL}/api/decisions/providers/{id}` | GET | — |

The `report` cluster is the only spot with timeouts > 12s — note this conflicts with
the Vercel hobby plan 10s execution cap. On hobby, the function returns 504 before
the AbortSignal fires.

### A.8 Documents / credentials / employer / workspaces

`app/api/documents/{parse,verify,[id]}/route.ts`, `app/api/credentials/{ingest,mine,
ingest-npi,[id]/confirm}/route.ts`, `app/api/employer/{opportunities,setup,decisions,
profile,applications,applications/dashboard,value-signals}/route.ts`, `app/api/workspaces/
switch/route.ts:39`, `app/api/me/workspaces/route.ts:31`, `app/api/profile/{npi/bootstrap,
links,completeness,work-auth,resume/upload}/route.ts`, `app/api/webauthn/{authenticate-options,
verify-assertion}/route.ts`. All of these are inline-resolved, node runtime, no
explicit timeout, return upstream status on success and 4xx/5xx pass-through on
failure. None has a retry. Many do not wrap fetch in try/catch and rely on Next to
translate the throw into a 500.

### A.9 Pilot-ops / KPIs / exports

| File:line | Target | Auth | Timeout |
| --- | --- | --- | --- |
| `app/api/pilot-kpi-export/route.ts:32` | `${B}/api/internal/pilot/kpis/export` | `x-monitoring-secret` server-injected | none, catch → `502 Backend unreachable` |
| `app/api/pilot-kpi-json/route.ts:19` | `${getBackendBase()}/api/internal/pilot/kpis` | — | — |
| `app/api/pilot-roi-export/route.ts:19` | `${getBackendBase()}/api/internal/pilot/roi-report/html` | — | — |
| `app/api/pilot-ops/feedback/route.ts:27` | `${getBackendBase()}/api/pilot-ops/feedback` | — | — |
| `app/api/pilot-ops/events/route.ts:27` | `${getBackendBase()}/api/pilot-ops/events` | — | — |
| `app/api/pilot-ops/export/route.ts:33` | `${getBackendBase()}/api/pilot-ops/export` (varies) | — | — |
| `app/api/internal/pilot/start-outcome/route.ts:126` | `${getBackendBase()}/api/internal/pilot/start-outcome` | — | — |
| `app/api/internal/mission-ops/sources/route.ts:8` | `${getBackendBase()}/api/mission-ops/sources` | — | — |
| `app/api/internal/source-health/route.ts:8` | `${getBackendBase()}/api/mission-ops/sources` | — | — |
| `app/api/internal/funnel-metrics/route.ts:24` | PostHog (not backend) — see §C | — | 10000ms |

### A.10 Graph / directory / map

| File:line | Target | Notes |
| --- | --- | --- |
| `app/api/graph/network/route.ts:12` | `${API_BASE}/api/graph/network` | inline `API_BASE` |
| `app/api/graph/live/[npi]/route.ts:15` | `${API_BASE}/api/graph/live/{npi}` | inline |
| `app/api/graph/node/[nodeId]/expand/route.ts:17` | `${API_BASE}/api/graph/node/{id}/expand` | inline |
| `app/api/graph-engine/[...path]/route.ts:21` | `${BACKEND}/api/graph/{path}` | **`NEXT_PUBLIC_API_URL` only**, **no timeout** |
| `app/api/directory/route.ts:24` | `${BACKEND}/api/directory` | inline |
| `app/api/directory/csv/route.ts:24` | `${BACKEND}/api/directory/csv` | inline |
| `app/api/directory/fhir/route.ts:24` | `${BACKEND}/api/directory/fhir` | inline |
| `app/api/directory/snapshot/route.ts:21,45` | `${BACKEND}/api/directory/{snapshots,publish}` | inline |
| `app/api/map/institutions/route.ts:74` | `${base}/api/network/global` | own `getBackendBase()` defined inline at line 60 — returns empty string when no env; the route then short-circuits to seed data |
| `app/api/map/shortages/route.ts:107` | `${base}/api/...` | same local resolver |

`graph-engine` is the worst outlier — uses `NEXT_PUBLIC_API_URL` (a fourth env-var
name that the canonical resolver doesn't read), has no timeout, and on catch returns
`502 Graph API proxy error` with the raw `String(err)` (DNS leak path).

### A.11 Storylines / findings / actions / system-health / polling / investigators

These are uniformly proxied through `getBackendBase()` with 12000ms timeouts and
shaped 502 fallback payloads (`{error: 'proxy failed'}`):

`app/api/storylines/route.ts:21`, `app/api/storylines/[...path]/route.ts:40,63`,
`app/api/findings/route.ts:21`, `app/api/findings/[...path]/route.ts:23,46`,
`app/api/findings/[id]/status/route.ts:36`, `app/api/actions/[...path]/route.ts:32,55`,
`app/api/actions/[id]/status/route.ts:31`, `app/api/system-health/route.ts:21`,
`app/api/system-health/[...path]/route.ts:22,45`, `app/api/polling/[...path]/route.ts:22,45`,
`app/api/investigators/[...path]/route.ts:19`.

### A.12 lib/ and hooks/ server-side fetchers

| File:line | Target | Timeout |
| --- | --- | --- |
| `lib/server/employer-workspace.ts:128` | `${BACKEND}/api/me/workspaces` | (likely none) |
| `lib/server/employer-workspace.ts:239` | `${BACKEND}/api/entity/resolve/npi/{npi}` | none |
| `lib/server/pilot-ops.ts:90,119,200,243,275` | `${getBackendBase()}/api/...` | none |
| `lib/server/pilot-proof.ts:30` | `${getBackendBase()}/api/internal/pilot-proof` | none |
| `lib/status/sourceOps.ts:115` | `${getBackendBase()}/api/mission-ops/sources` | (status page render path) |
| `lib/launch/marketplace.ts:132` | `${getBackendBase()}${path}` | — |
| `lib/mobile/server.ts:32` | `${MARKETPLACE_BACKEND}${path}` | — |
| `lib/api/trustClient.ts:16` | `${getApiBase()}/api/trust/{endpoint}` | — |
| `hooks/useInvestigationGraph.ts:215,270` | computed url | — (browser hook though) |
| `hooks/useIntelligenceResource.ts:98` | variable | — (browser hook) |

---

## §B Same-origin fetches (Vercel function → its own apex `/api/*`)

A handful of routes call back into another `/api/*` route on the same Vercel
deployment. The hop goes browser→edge→function on cold start; for server-side
self-fetches, the request goes through the public apex and re-enters Vercel.

| File:line | Target | Caller runtime | Risk |
| --- | --- | --- | --- |
| `middleware.ts:69` | `new URL('/api/auth/resolve-role', req.nextUrl.origin)` | edge middleware | Edge → node serverless. Hot path on first login. **No timeout**, **catch swallows silently then redirects to `/auth/error`**. If apex DNS or the resolve-role function is cold, every new sign-in stalls until the edge runtime kills the fetch, then redirects to the error page. |
| `app/api/internal/launch-ops/route.ts:146` | `new URL('/api/intelligence/launch-readiness', req.nextUrl.origin)` | node | 12000ms, propagates cookies. Round-trips through the Vercel edge router. |
| `app/api/intelligence/launch-readiness/route.ts:145` | `new URL(target.href, origin)` | node | 12000ms; intentionally probes pages (`redirect: 'manual'`). |

Server components doing same-origin or backend fetch during render:

| File:line | Target | Risk |
| --- | --- | --- |
| `app/apply/[bundleId]/page.tsx:79` | `${BACKEND}/api/apply/bundle/{bundleId}` (server component fetch, **inline resolver**) | This is an async server component on a public page. No timeout, `next: { revalidate: 0 }` (always fresh). On a Railway flap the page renders the `BundleErrorView` with `reason:'error'` — graceful. But on a cold Railway start with no env var set in this function, the resolver lands on `http://localhost:4000` and the page silently errors out. |
| `app/holder/page.tsx:38` | `/api/me/workspaces` | This is a **client component** (`'use client'`) — counts as browser fetch, not server-component fetch. |
| `app/passport/page.tsx` | none directly — browser flow only | the SSE flow goes through `/api/ingest/[npi]` and `/api/ingest/stream/[runId]` |
| `app/passport/[id]/page.tsx` | none directly — async server component that just renders `PassportEntityClient` | the client component handles fetching |

There is no `apps/web/app/trust/page.tsx` or `apps/web/app/verify/page.tsx` on this
branch (both exist only under `_archive/wave119/`). The supervisor's hint about
"in-process dynamic import" on `/trust` therefore does not apply to current source —
to be treated as a doc artifact from a previous wave. The active `/passport` flow uses
the SSE pipeline above; no server-component fetch is in play for it.

---

## §C External (third-party) fetches

| File:line | Target | Method | Timeout | Failure |
| --- | --- | --- | --- | --- |
| `lib/analytics/funnel-server.ts:29` | `${POSTHOG_HOST}/capture/` (default `https://us.i.posthog.com`) | POST | 3000ms | `.catch(() => {})` — fire-and-forget, never blocks response |
| `lib/pilot-intake/slack.ts:60` | `process.env.SLACK_PILOT_INTAKE_WEBHOOK_URL` | POST | **none** | `try/catch` → `{delivered:false, reason:'fetch_failed'}` |
| `app/api/internal/funnel-metrics/route.ts:24` | `${POSTHOG_HOST}/api/projects/{id}/query/` | POST | 10000ms | throws → outer catch returns `500 {error:'Failed to query PostHog', detail:err.message}` |

The Slack webhook lacks a timeout. If `hooks.slack.com` is unreachable, the pilot
intake form holds the function open. Slack typically responds within ~300 ms, but a
hung TCP connection here would burn the function's execution budget.

PostHog has a tight 3s timeout on capture (fire-and-forget) but a slack 10s on the
query-API path. The query path is admin-only (`/api/internal/funnel-metrics`) so the
blast radius is limited.

No third-party fetch goes to a TLS-pinned host or uses a custom CA bundle. All third
parties are public CDN/SaaS endpoints over HTTPS, so DNS and TLS are the failure
modes.

---

## §D Middleware-internal fetches

The single middleware fetch (`apps/web/middleware.ts:69`) is the most operationally
sensitive call in the app:

- **Runtime**: Edge (Vercel edge middleware).
- **Target**: `/api/auth/resolve-role` on the same origin (Node runtime).
- **When**: first request from a Clerk session that lacks the `vitalcv.role` JWT claim.
- **Headers**: `x-clerk-user-id` only.
- **Timeout**: none. Edge middleware has a hard 30s budget but no `AbortSignal`.
- **Retry**: none.
- **Failure path** (lines 79–87):
  ```
  } catch {
    // Fallback failed — redirect to error page (circuit breaker)
  }

  if (!userRole) {
    const errorUrl = req.nextUrl.clone();
    errorUrl.pathname = '/auth/error';
    return NextResponse.redirect(errorUrl);
  }
  ```
  A `TypeError: fetch failed` here is silently swallowed and the user is bounced to
  `/auth/error`. This is the "first-time login dead-ends to error page" scenario the
  product team should keep an eye on whenever Railway is flapping or the resolve-role
  function is cold.

- **`/api/auth/resolve-role` itself** (Node runtime, `apps/web/app/api/auth/resolve-role/route.ts`) calls Clerk (`clerk.users.getUser(clerkUserId)`) and then the backend (`${BACKEND}/api/me/role`). It uses the **inline ad-hoc resolver** with no Railway fallback; if env is unset in this function's runtime, it points at `http://localhost:4000` → connection refused → `503 Backend unavailable` → middleware sees `!res.ok`, doesn't set `userRole`, redirects to `/auth/error`.

This is the highest-impact `fetch failed` site in the codebase: it gates first-time
sign-in for every role.

---

## §E `TypeError: fetch failed` attribution matrix

`undici` raises `TypeError: fetch failed` from inside Node's `fetch` for a set of
specific transport-layer failures. The matrix below maps each plausible cause to
the call sites that would surface it and the user-visible symptom.

### E.1 DNS resolution failure (`ENOTFOUND api.vitalcv.com`)

Most likely when Railway hosts move, DNS TTL has not yet propagated, or the Vercel
function's resolver has temporarily lost a record.

- **All §A handlers**: most return `503` with `detail: String(err)` (which contains
  `getaddrinfo ENOTFOUND api.vitalcv.com`).
- **`apps/web/app/api/employer-review/npi/[npi]/refresh-requests/route.ts`**: no
  try/catch, returns Next 500 default error page.
- **`apps/web/app/api/ingest/stream/[runId]/route.ts`**: no try/catch, SSE pipe
  collapses, browser sees a closed event source.
- **`apps/web/middleware.ts:69`**: redirects to `/auth/error`. User cannot complete
  first-time sign-in.
- **`apps/web/app/apply/[bundleId]/page.tsx:79`**: server component catches, renders
  the `BundleErrorView` with `reason:'error'`. **Graceful**.

### E.2 TLS handshake failure (`unable to verify the first certificate`, `EPROTO`)

Caused by an expired Railway cert, a TLS-MITM proxy, or a misconfigured intermediate.

- Same set as §E.1. Detail field carries the underlying TLS error string. The Slack
  webhook (`lib/pilot-intake/slack.ts:60`) catches and returns `{delivered:false, reason:'fetch_failed'}` so the pilot intake form still succeeds.

### E.3 Connection timeout (`UND_ERR_CONNECT_TIMEOUT`)

Vercel function reached the OS TCP layer but Railway never SYN-ACK'd. Affects routes
with no `AbortSignal.timeout`:

- `trust-proof/[npi]`, `trust-state/[npi]/history`, `apply/**`, `documents/**`,
  `credentials/**`, `employer/**`, `webauthn/**`, `decisions/{specialties,providers,
  institutions,[npi]}`, `graph-engine/[...path]`, `employer-review/npi/[npi]/refresh-requests`,
  `ingest/stream`, all `lib/server/*` helpers.
- These will run until the Vercel function execution timeout (10s hobby / 60s pro /
  300s enterprise) and then return a generic gateway error. The user sees a spinner,
  then a Vercel "Function execution timed out" overlay.

### E.4 Connection refused (`ECONNREFUSED`)

Most likely when `BACKEND_URL` resolves to `http://localhost:4000` in a production
function (inline resolver missing all four env vars, or a build-time evaluation
captured the wrong env).

- All ~40 routes using the inline ad-hoc resolver fall to this. The connection is
  refused in milliseconds; the catch handler returns `503 {error, detail:String(err)}`.
- The `middleware.ts` → `resolve-role` → backend chain breaks because resolve-role's
  inline resolver also drops to localhost. Symptom: every new sign-in lands on
  `/auth/error`.

### E.5 IPv6/IPv4 mismatch / happy-eyeballs failure

When the Vercel function resolves the Railway hostname to an AAAA record but cannot
egress IPv6, undici can raise `fetch failed` with `EHOSTUNREACH`. Affects every
backend call uniformly; mitigated only by Vercel's network stack. No app-level
mitigation in this codebase — none of the handlers force a `dispatcher` or
`localAddress`.

### E.6 Upstream socket close mid-stream (`UND_ERR_SOCKET`)

Affects SSE and large-body endpoints:
- `app/api/ingest/stream/[runId]/route.ts` — no error handling, stream closes.
- `app/api/passport/[npi]/export/route.ts` — JSON pull, 502 fallback.
- `app/api/trust-proof/[npi]/route.ts` (when `format=pdf` — reads `arrayBuffer`) —
  catch returns `502 Failed to fetch trust proof`.
- `app/api/pilot-kpi-export/route.ts` — reads CSV via `.text()`, catch returns 502.

### E.7 Vercel function platform timeout (not `fetch failed` per se but adjacent)

Surfaces as a 504 from Vercel rather than a typed `TypeError`. Specifically, the
`app/api/report/**` cluster sets `AbortSignal.timeout(30000)` and
`AbortSignal.timeout(20000)`, which exceed the hobby-plan execution cap of 10s. On
hobby, the platform 504 fires before the in-app abort handler runs, and the user
sees Vercel's generic 504 page rather than the app's `503 {error:'Report unavailable'}`.

### E.8 Symptom → caller cheat sheet

| User-visible symptom | Most likely caller |
| --- | --- |
| First-time sign-in lands on `/auth/error` | `middleware.ts:69` → `resolve-role` chain |
| Homepage NPI submit dead-ends with no progress | `app/api/ingest/[npi]/route.ts` (gracefully degrades to `fallback:true`; if symptom is total dead-end, look at `ingest/stream` instead) |
| Passport page shows generic 500 | `passport/npi/[npi]` or `passport/entity/[id]` — these return shaped 502/503 so the symptom usually appears upstream in the React client's `assertPassportData` boundary |
| Apply bundle page shows "An error occurred" | `apply/[bundleId]/page.tsx` server-component fetch caught and rendered `BundleErrorView` |
| Employer review action returns `503 backend_unavailable` | `employer-review/[entityId]/[action]/route.ts` — correct shape, includes the underlying `err.message` |
| Employer "pending refresh request" widget never resolves | `employer-review/npi/[npi]/refresh-requests/route.ts` — no try/catch; Next 500 silently |
| SSE stream just closes | `ingest/stream/[runId]/route.ts` — no error handling |
| Pilot intake form errors but Slack does not | `lib/pilot-intake/slack.ts` — fetch_failed; intake row still written |
| Funnel-metrics admin page shows 500 | `internal/funnel-metrics/route.ts` PostHog reachability |
| Same-origin self-fetch in `launch-ops` returns 503 | `internal/launch-ops/route.ts:146` → `launch-readiness` apex hop |
| Trust proof PDF returns `502 Failed to fetch trust proof` | `trust-proof/[npi]/route.ts` — no timeout on the fetch itself |

---

## Cross-cutting recommendations (informational)

The supervisor asked for inventory only, but a few patterns are worth flagging
because they govern multiple sites at once:

1. **Replace inline resolvers with `import { BACKEND_URL }`.** Today, ~40 handlers
   inline `process.env.BACKEND_URL || ... || 'http://localhost:4000'`. The const
   binding is module-level, so a build-time capture pinning to localhost survives
   the deploy. The canonical resolver in `lib/backend-url.ts` includes the Railway
   fallback on `VERCEL` or `NODE_ENV=production`. The same fix folds `getBackendBase()`
   from `lib/api.ts` together.

2. **Add `AbortSignal.timeout(8000)` to the no-timeout cluster** (§E.3) — at minimum
   `apply/**`, `documents/**`, `credentials/**`, `employer/**`, `webauthn/**`,
   `decisions/**`, `graph-engine/**`, `employer-review/npi/[npi]/refresh-requests`,
   `lib/server/*`. Without this, a hung Railway socket consumes the entire Vercel
   function budget and the function returns a platform 504 instead of an app-shaped 503.

3. **Wrap `ingest/stream` in try/catch** to return a typed terminal SSE event on
   stream-open failure, rather than a Vercel function crash.

4. **Wrap `employer-review/npi/[npi]/refresh-requests` in try/catch** to match the
   pattern of the sibling `[action]` route.

5. **Reconcile `graph-engine` and `verify-professional` resolvers** — both read
   `NEXT_PUBLIC_API_URL` only, which is not in the canonical four-var precedence chain.
   On a Vercel deploy that sets only `BACKEND_URL`, these routes will fall to
   `http://localhost:4000` and 502.

6. **`report/*` 30s timeouts** exceed the Vercel hobby execution cap. If the apex
   stays on hobby, drop these to 9500ms; if it moves to pro, document the 60s budget.

7. **Middleware fetch (`middleware.ts:69`) needs an `AbortSignal.timeout(2000)`** —
   edge middleware blocks the request, so a slow `resolve-role` call slows the entire
   site for first-time sessions. A 2s abort plus the existing `/auth/error` fallback
   is enough.

---

## Inventory summary

- Distinct fetch sites enumerated (excluding `__tests__/` and `_archive/`): **~310 call sites across ~190 files**. The raw `grep` hit count is 416 including duplicate calls within the same function (GET/POST variants, retry blocks, multi-target `Promise.all`); the call-site count after deduping per-purpose is roughly 310.
- Files in `apps/web/app/api/**/route.ts` that hit Railway directly: **~120**.
- Files in `apps/web/components/**` and `apps/web/hooks/**` that hit the local Next API (browser-origin): **~110**.
- Server components performing cross-boundary fetch during render: **1** (`apps/web/app/apply/[bundleId]/page.tsx`).
- Edge-runtime route handlers performing fetch: **0** (only `opengraph-image.tsx` and `twitter-image.tsx` are `runtime = 'edge'` and neither calls `fetch`).
- Edge-runtime middleware performing fetch: **1** (`apps/web/middleware.ts`).
- Routes lacking `AbortSignal.timeout` and `try/catch`: **~25** — the highest-risk cluster for the `fetch failed` symptom because the failure bubbles to a default Next.js 500.
- Routes with explicit retry / exponential backoff: **0**. There is no `p-retry`, no
  retry loop, no idempotency-key retry on any fetch site. Every upstream call is a
  single-shot.

End of file.

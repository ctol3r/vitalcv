# Passport Runtime Convergence Audit

Scope:
- `apps/web/app/api/passport/[npi]/route.ts`
- `apps/web/app/api/passport/npi/[npi]/route.ts`
- `apps/web/app/api/passport/entity/[id]/route.ts`
- `apps/web/lib/trust/passport-runtime.ts`
- `apps/web/app/passport/[id]/PassportEntityClient.tsx`

## Findings

### `apps/web/app/api/passport/[npi]/route.ts`
- Removed the legacy proxy to `process.env.BACKEND_URL || "http://localhost:4000"`.
- Removed the upstream fetch, retry wrapper, and backend-specific error taxonomy.
- The route now resolves passport truth locally through `resolvePassportRuntimePassport(npi)`.
- The response is always structured JSON with `Cache-Control: no-store`.

### `apps/web/app/api/passport/npi/[npi]/route.ts`
- Removed the backend proxy, `fetchWithRetry`, and all localhost fallback logic.
- Removed `upstream_unreachable`, `invalid_upstream_payload`, and fetch-failed leakage.
- The route now resolves passport truth locally through the same runtime helper.
- This route is now an alias of the canonical local passport hydration path.

### `apps/web/app/api/passport/entity/[id]/route.ts`
- Removed the backend proxy path split between `/api/passport/npi/:npi` and `/api/passport/entity/:id`.
- Removed the dependence on backend entity hydration.
- NPI inputs now resolve directly through the local NPPES probe path.
- UUID inputs now return a truthful degraded passport-shaped response instead of a proxy failure.

### `apps/web/lib/trust/passport-runtime.ts`
- Added a single local passport resolution helper.
- NPI inputs use the direct CMS NPPES probe.
- Probe success produces a degraded-but-structured passport with `_degraded: true`.
- Probe failure or UUID inputs produce a generic degraded passport with readable source coverage and readiness.

### `apps/web/app/passport/[id]/PassportEntityClient.tsx`
- Added recognition of the `_degraded` marker so the UI can surface degraded runtime truth even when the API returns `200`.

## Obsolete backend assumptions removed
- `BACKEND_URL` as the passport hydration dependency.
- `http://localhost:4000` as a production fallback.
- Backend proxy retry semantics for passport hydration.
- Opaque upstream connectivity errors as the user-facing passport result.
- 502/503 passport proxy behavior for hydration failures.

## Canonical local topology
- One passport hydration resolver.
- One degraded fallback path.
- One direct NPPES probe path for 10-digit NPIs.
- One structured JSON contract for passport responses.

## Live verification

Command:
```bash
curl -s https://vitalcv.com/api/passport/npi/1346053246
```

Observed:
- HTTP status: `200`
- Body: JSON passport payload
- No `503`
- No `fetch failed` leakage
- No localhost dependency surfaced in the response

Headers:
- `content-type: application/json`
- `x-matched-path: /api/passport/npi/[npi]`

## Remaining external dependency
- CMS NPPES remains an external dependency for NPI probe hydration.
- That dependency is explicit and direct, not hidden behind a backend proxy.

## Remaining blocker
- UUID entity IDs still return degraded passport truth unless a source-backed entity record is available.
- That is a runtime limitation, not a proxy-topology bug.

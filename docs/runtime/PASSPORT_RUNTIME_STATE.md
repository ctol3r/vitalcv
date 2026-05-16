# Passport Runtime State

## 1. What obsolete backend assumptions were removed?
- The passport routes no longer depend on `process.env.BACKEND_URL || "http://localhost:4000"`.
- The routes no longer proxy through the legacy backend for passport hydration.
- The routes no longer use backend retry wrappers or backend-specific upstream failure statuses.
- The routes no longer expose `upstream_unreachable`, `invalid_upstream_payload`, or generic fetch-failed topology errors as the passport result.

## 2. What passport functionality is now self-contained?
- `/api/passport/[npi]` resolves passport truth locally.
- `/api/passport/npi/[npi]` resolves the same local passport truth through the canonical NPI path.
- `/api/passport/entity/[id]` resolves locally for both NPIs and UUIDs.
- 10-digit NPIs are probed directly against CMS NPPES.
- The App Router now emits structured PassportData-shaped JSON without a backend proxy.
- The client can read the `_degraded` marker and surface degraded runtime truth.

## 3. What degraded truths remain?
- If the NPPES probe fails, the route returns a generic degraded passport instead of a transport error.
- If the identifier is a UUID rather than a 10-digit NPI, the route returns a truthful degraded passport shape.
- The degraded passport makes the missing verification state explicit through readiness, trust posture, and source coverage.

## 4. What external dependencies still exist?
- CMS NPPES remains the only external source dependency in this passport hydration path.
- The live deployment still depends on the public internet to reach NPPES for NPI probing.
- No legacy backend runtime is required for these passport routes.

## 5. What still blocks full runtime hydration?
- UUID lookups do not yet have a source-backed entity hydration path inside the App Router.
- A fully hydrated passport still requires source verification data that is not available in the degraded path.
- If NPPES is unreachable, the route remains truthful but degraded.

## Verification

- Local route spec: `3/3` tests passing.
- Live endpoint: `https://vitalcv.com/api/passport/npi/1346053246` returned `200` with JSON and `content-type: application/json`.

## Current verdict
- Passport runtime is now institutionally coherent and self-contained at the route level.
- Passport hydration is still degraded by design when source verification is incomplete or unavailable.

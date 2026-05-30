# Clerk Auth Gate Diagnostics

Timestamp: 2026-05-30 16:32 PDT (America/Los_Angeles)

## Scope

Docs-only diagnostic plan for the authenticated SSE smoke blockage. This does not change Clerk config, middleware, secrets, product code, or API behavior.

## Evidence

- Browser remains unauthenticated during the smoke attempt.
- Top navigation shows `Sign In`, not an authenticated user/avatar state.
- `window.Clerk` was unavailable or not hydrated in the observed browser tab.
- `POST /api/ingest/1699264564` returned HTTP 403 with `x-cors-blocked: 1`.
- No `runId` was issued.
- No SSE stream opened.

## Diagnostic Checklist

1. Confirm whether `ClerkProvider` mounts for `/passport` and the public passport shell.
2. Confirm sign-in routes work on `https://vitalcv-web-production.up.railway.app`.
3. Confirm `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is configured for the `vitalcv-web` Railway production environment.
4. Confirm the active session cookie is scoped to the domain being tested.
5. Check whether custom domain vs Railway domain is causing cookie mismatch.
6. Confirm whether middleware protects `/api/ingest/[npi]`.
7. Confirm whether same-origin `POST /api/ingest/1699264564` passes through the expected middleware path.
8. Investigate why `x-cors-blocked: 1` appears on a same-origin ingest request.
9. Separate API health CORS behavior from web proxy health behavior; do not infer one from the other.
10. Decide whether the canonical smoke target should be the Railway URL or the custom domain.

## Manual Test

1. Sign in on `https://vitalcv-web-production.up.railway.app`.
2. Confirm the top nav shows authenticated user state.
3. Confirm `window.Clerk` is present/hydrated without printing secrets or session tokens.
4. Hard refresh `/passport?npi=1699264564`.
5. Re-run `POST /api/ingest/1699264564`.
6. Record whether a `runId` is issued.
7. If a `runId` exists, open the SSE stream and record source status only; do not expose cookies, bearer tokens, or PII.

## Next Code Task

Only after review/approval:

- Add an auth-state diagnostic banner in non-production or operator mode only.
- Consider a safe `/api/auth/session-debug` endpoint only if approved later. It must not expose cookies, tokens, secrets, raw Clerk session payloads, or PII.

## Current Decision

The live SSE smoke remains blocked by auth/session state, not by confirmed NPPES source behavior. Do not raise Source Integrations or claim live source validation until an authenticated smoke emits a `runId` and SSE source statuses.

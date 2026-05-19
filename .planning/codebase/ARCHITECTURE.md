# Architecture

**Analysis Date:** 2026-05-18

## Pattern Overview

**Overall:** Healthcare-credentialing pnpm + Turbo monorepo. A Next.js 15 App Router web frontend (`apps/web`) acts as a thin proxy + UI shell over an Express + Prisma backend (`apps/api/backend`). Specialised service apps (issuer, verifier, admin) and shared workspace packages (`packages/trust-state`, `packages/psv`, `packages/poe-engine`, `packages/audit`, etc.) provide canonical domain primitives.

**Key Characteristics:**
- pnpm workspace spanning `apps/`, `packages/`, `services/`, `blockchain/` (`pnpm-workspace.yaml`)
- Strict TypeScript everywhere — no untyped files in the diff scope
- Web layer is **stateless** — every request that needs state proxies to the backend
- Backend writes are **always paired with an `AuditEvent`** inside the same Prisma transaction — see the explicit "no action can succeed silently" contract at the top of `apps/api/backend/src/routes/employerActions.ts`
- W3C VC / OID4VCI / DID-resolver compatible — `did-resolver`, `ethr-did-resolver`, `key-did-resolver`, `web-did-resolver` all wired
- Multi-tenant — `apps/api/backend/src/middleware/tenantGuard.ts` enforces per-org isolation

## Layers

**Web layer (`apps/web`)**
- Purpose: render every user-facing surface (clinician, employer, verifier, issuer, ops); proxy every backend call.
- Contains: route group `app/*` (pages, layouts), API proxies `app/api/*/route.ts`, ~88 component directories under `components/`, ~77 utility families under `lib/`, vitest suites under `__tests__/`.
- Depends on: `@clerk/nextjs`, every `@vitalcv/*` workspace package, Radix UI, Tailwind 4, `lucide-react`.
- Used by: end users (browser); the layer never calls Prisma directly — all persistence flows through the backend.
- Entry point: `pnpm --filter @vitalcv/web dev` (port 3030 pinned by `scripts/runtime/assert-canonical-runtime.ts`).

**Backend layer (`apps/api/backend`)**
- Purpose: HTTP API. Owns Prisma, source-coverage probes, credential issuance / verification, decision capsules, billing, OID4VCI / OID4VP, federation, analytics.
- Contains: 158 route files under `src/routes/`, 141 service files under `src/services/`, 11 middleware files under `src/middleware/`, `src/obs/logger.ts` (structured JSON logger), `src/utils/httpError.ts` (`HttpError` class with status→code mapping), Express app initialisation in `src/app.ts` (~138 KB), server startup in `src/server.ts`.
- Depends on: `express`, `@prisma/client`, `jose` (JWS), `@opentelemetry/*`, every relevant `@vitalcv/*` package, `ethers`, the DID resolver suite.
- Used by: every web proxy; external partners via the `API_KEYS` (SHA-256 hashed) middleware in `src/middleware/apiAuth.ts`.

**Shared packages layer (`packages/*`)**
- Purpose: canonical domain models, SDKs, source adapters.
- Notable members:
  - `packages/trust-state/sourceCoverage.ts` — `LAUNCH_SPINE_SOURCE_IDS`, `CanonicalSourceCoverageState`, `CanonicalTruthStatus` — the single source of truth for lane vocabulary.
  - `packages/psv/`, `packages/psv-adapters/` — Primary Source Verification engine + concrete adapters (NPPES, OIG/LEIE, PECOS, state boards).
  - `packages/poe-engine/` — proof-of-evidence computation.
  - `packages/audit/` — audit-trail recording (used in tandem with the backend's `AuditEvent` Prisma model).
  - `packages/issuer-sdk/`, `packages/verifier-sdk/`, `packages/wallet-sdk/`, `packages/embed-sdk/` — client libraries; `wallet-sdk` ships from `dist/` and must be prebuilt before web `next build`.
  - `packages/domain-core/`, `packages/domain-common/`, `packages/domain-events/`, `packages/domain-authority/`, `packages/domain-identity/`, `packages/domain-provider/` — DDD-style domain primitives.
- Depends on: nothing app-specific.
- Used by: every app and every other package.

**Specialised app surfaces:**
- `apps/issuer-api` — credential-issuance endpoints for external issuers.
- `apps/verifier-api` — verification endpoints for external verifiers.
- `apps/admin-api` — administrative operations.
- `apps/marketing` — separate Next.js marketing site (CLAUDE.md note: "do not pull web changes into it").
- `apps/mobile` — React Native (out of scope for active development).
- `apps/authz`, `apps/status-api`, `apps/sample-api` — authorization, health checks, demo API.

## Data Flow

**Worked example — employer "accept" action:**

1. **UI** — operator clicks Accept in `apps/web/components/review/ReviewClient.tsx`.
2. **Web proxy** — POST to `/api/employer-review/<entityId>/accept`, handled by `apps/web/app/api/employer-review/[entityId]/[action]/route.ts`. The route:
   - Confirms `action ∈ AUTHENTICATED_MUTATION_ACTIONS` (which includes `accept`).
   - Calls Clerk's `auth()` for user id.
   - Validates / sanitises the body via `parseAcceptBody`.
   - Forwards to `${BACKEND_URL}/api/employer-review/<entityId>/accept` with `x-clerk-user-id` and `x-correlation-id` headers.
   - Normalises the response via `normalizeEmployerReviewActionResponse(payload, 'accept')` so the UI only sees the canonical contract.
3. **Backend route** — `apps/api/backend/src/routes/employerActions.ts` `POST /api/employer-review/:entityId/accept`:
   - `requireClerkUserId(req)` → 401 if missing.
   - `resolveEmployerReviewSubject(entityId)` (in `apps/api/backend/src/services/entity/employerReviewActions.ts`) → 404 if no NPI.
   - Duplicate-acceptance guard (existing `EmployerAcceptance` row → 409 + `writeDeniedEmployerReviewMutation`).
   - Decision-posture gate: `buildPassport(entityId)` → reject if `BLOCKED`.
   - `recordEmployerReviewAcceptance({...})` — the single Prisma transaction that writes (a) `EmployerAcceptance`, (b) `AuditEvent` of type `EMPLOYER_REVIEW_ACCEPTED`, (c) the runtime-trust metadata snapshot.
   - **Invariant:** the AuditEvent is committed BEFORE `res.status(201).json(...)`.
4. **SEAL signal (fire-and-forget)** — `captureEmployerDecision(...)` posts the trust-snapshot for downstream analytics. Failure here never affects the 201.
5. **Learning signal (fire-and-forget)** — `captureDecisionSignal(...)` + `recomputeMatchBoosts().catch(() => {})`.
6. **Response** — backend returns `{ ok: true, state: { acceptanceId, auditEventId, timestamp, … } }`; the web proxy normalises and returns the same shape to the client.

**State management:** stateless web. Backend session state lives in Prisma (Postgres). One in-memory cache lives in `apps/api/backend/src/middleware/apiAuth.ts` for API-key validation (Redis fallback is referenced but not deployed).

## Key Abstractions

**Services** (`apps/api/backend/src/services/`):
- One subdirectory per domain (audit, actions, billing, credentials, decisions, employers, entity, integrity, multi-tenant, network, providers, runtime, source-health, etc.).
- Example: `apps/api/backend/src/services/entity/employerReviewActions.ts` exposes `recordEmployerReviewAcceptance`, `recordEmployerReviewRefreshRequest`, `recordEmployerReviewRouting`, `loadEmployerReviewStatus`, `loadEmployerAcceptanceHistory`.

**HttpError** (`apps/api/backend/src/utils/httpError.ts`):
- Routes throw `new HttpError(status, message)`. A global error middleware translates `status` → canonical error `code` (e.g. 400 → `BAD_REQUEST`, 401 → `UNAUTHORIZED`, 429 → `RATE_LIMITED`).

**Web proxy contract** (`apps/web/app/api/employer-review/[entityId]/[action]/route.ts`):
- Separates the surface set: `AUTHENTICATED_MUTATION_ACTIONS`, `PUBLIC_MUTATION_ACTIONS`, `PUBLIC_READ_ACTIONS`, `AUTHENTICATED_READ_ACTIONS`. Each action has a per-action body parser (`parseAcceptBody`, `parseRefreshBody`, …) that fails fast with a 400 before the backend is even contacted.

**Source-coverage taxonomy** (`packages/trust-state/sourceCoverage.ts`):
- Single source of truth for `CanonicalSourceCoverageState` (`checked` / `stale` / `pending` / `gated` / `unavailable` / `accessRequired` / `reviewRequired` / `notDecisionGrade` / `previewOnly`), `CanonicalTruthStatus` (`VERIFIED` / `CLEAR` / `ENROLLED` / `PENDING` / `REVIEW_REQUIRED` / `UNAVAILABLE` / `ACCESS_REQUIRED` / `NOT_DECISION_GRADE`), and `LAUNCH_SPINE_SOURCE_IDS = ['NPPES_API', 'OIG_LEIE', 'PECOS_PUBLIC', 'STATE_BOARD']`.

**Issuer-verification chain** (`apps/web/lib/issuer-verification/`):
- Per CLAUDE.md, the `receiptCandidate.ts` and `policyReview.ts` modules are **pure transforms**: no fetches, no Prisma writes. They power the demo review surfaces under `apps/web/app/issuer/review/[requestId]/page.tsx` and `apps/web/app/issuer/policy-review/[requestId]/page.tsx`.
- `ReceiptCandidate.decisionGrade` is the literal `false`; `proofTier` is the literal `'receipt_candidate'`. Promotion to a `PSVReceipt` is a gated wave.

**Truth contract** (`CLAUDE.md`):
- A banned-string list (e.g. `automatically verified`, `HIPAA compliant`, `SOC 2 certified`) is enforced on every public surface. Multiple runtime guards (`apps/web/lib/trust/trust-container-view.ts`, `apps/web/lib/source-health/unavailableLane.ts`) carry the list as regex patterns at runtime.

## Entry Points

| Entry | Trigger | Responsibility |
|---|---|---|
| `apps/web` dev server | `pnpm --filter @vitalcv/web dev` | runtime-assert (`scripts/runtime/assert-canonical-runtime.ts`) → `next dev -p 3030` |
| `apps/api/backend` server | `ts-node src/server.ts` | Express bootstrap, register routes from `src/app.ts`, OpenTelemetry init |
| `apps/marketing` | `pnpm --filter @vitalcv/marketing dev` | separate Next.js app for the marketing site |
| CI builds | `pnpm turbo run build --filter @vitalcv/web` | Turbo graph; prebuilds `@vitalcv/trust-state` + `@vitalcv/shared` dist before the web build |

## Error Handling

**Strategy:** structured errors at every boundary.

- **Backend** — every route uses `asyncHandler(fn)` (defined in `apps/api/backend/src/routes/employerActions.ts` and reused across files) so async exceptions reach the global error middleware. The middleware normalises every payload to `{ error: { code, message } }`. `HttpError` is the canonical thrown class.
- **Web proxy** — `normalizeUpstreamError(status, payload, fallbackError, fallbackDescription)` ensures upstream JSON or non-JSON failures both produce a `{ error, error_description }` shape with a deterministic fallback. `503 backend_unavailable` covers network failures.
- **Defensive timeouts** — the proxy uses `AbortSignal.timeout(8_000)` so a hung backend never holds the user's browser hostage.
- **Audit-before-2xx** — `apps/api/backend/src/routes/employerActions.ts` documents the invariant at the top of the file: "every mutating action writes an AuditEvent row in a transaction BEFORE returning 2xx".
- **Truth-contract refusals** — `apps/web/lib/issuer-verification/policyReview.ts` (gates `accept_candidate`); `apps/web/lib/source-health/unavailableLane.ts` (refuses to mark an unreachable lane as decision-grade).

## Cross-Cutting Concerns

**Auth:**
- Web: Clerk session cookie → `auth()` in server components / route handlers.
- Backend: API-key (SHA-256 hashed) via `apps/api/backend/src/middleware/apiAuth.ts`, plus `x-clerk-user-id` propagation from the web proxy.

**Multi-tenancy:**
- `apps/api/backend/src/middleware/tenantGuard.ts` documents the read-allowlist (intelligence + investigation surfaces) and enforces org-context for everything else.

**Logging:**
- Backend: `apps/api/backend/src/obs/logger.ts` exports `log(level, event, fields)` — single-line structured JSON. Used everywhere; `console.log` is not the pattern.
- Web: no app-level logger; errors flow to Sentry.

**Validation:**
- Backend: Zod schemas in `apps/api/backend/src/config/env.ts`; `express-validator` for request bodies; ad-hoc type-guards (`isRecord`, `isStringArray`) in each route.
- Web proxies: per-action body parsers with allow-key-listing (see `validateAllowedKeys` in `apps/web/app/api/employer-review/[entityId]/[action]/route.ts`).

**CORS / rate limiting:**
- CORS configured in `apps/api/backend/src/app.ts`; must not be `*` in production (env-checked).
- Rate limiter middleware in `apps/api/backend/src/middleware/rateLimiter.ts` + `rateLimitFactory.ts` (per-key, configurable). Default `TRUST_STATE_RATE_LIMIT_PER_MINUTE=120`.

**Observability:**
- Sentry on both sides.
- OpenTelemetry SDK on backend for distributed tracing.
- `obs/logger.ts` structured logs power post-mortem analysis.

---

*Architecture analysis: 2026-05-18*
*Update when major patterns change (new tenancy model, new persistence layer, breaking auth change).*

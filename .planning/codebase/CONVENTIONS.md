# Coding Conventions

**Analysis Date:** 2026-05-18

## Naming Patterns

**Files:**
- **Components**: PascalCase for single-component files in `apps/web/components/` (e.g. `apps/web/components/AuditTimeline.tsx`, `apps/web/components/review/ReviewClient.tsx`). Subdirectories use kebab-case (e.g. `apps/web/components/clinician-profile/`).
- **Lib modules**: kebab-case throughout `apps/web/lib/` (e.g. `apps/web/lib/api.ts`, `apps/web/lib/backend-url.ts`, `apps/web/lib/credentialing-states.ts`, `apps/web/lib/employer-review-actions.ts`).
- **App Router**: Next.js conventions — `page.tsx`, `layout.tsx`, `route.ts`. Dynamic segments use `[slug]` brackets (e.g. `apps/web/app/passport/[id]/page.tsx`).
- **Backend routes**: camelCase files in `apps/api/backend/src/routes/` (e.g. `employerActions.ts`, `employerNotifications.ts`, `auditDecision.ts`).
- **Backend services**: camelCase files in domain subdirectories (e.g. `apps/api/backend/src/services/entity/employerReviewActions.ts`, `apps/api/backend/src/services/billing/stripeClient.ts`).
- **Tests**: dominant `.test.ts` / `.test.tsx` (~355 files). `.spec.ts` is rare (~6 files) and effectively legacy. Web tests are **flat** under `apps/web/__tests__/`; backend tests are **co-located** under each `__tests__/` subdirectory.

**Functions / variables:**
- **camelCase** is the default everywhere (e.g. `normalizeApiBase()`, `recordEmployerReviewAcceptance()`, `buildTimeToStartEstimate()`).
- **PascalCase** for React components and type constructors (e.g. `PolicyReviewPage`, `EmployerReviewActions`).
- **No underscore-prefix** for private members; module-level scoping is the encapsulation primitive.
- **Factory functions** explicit and verbose: `makeResponse()`, `createRequest()`, `buildActionResponse()` (frequent in test files).

**Types:**
- **No `I`-prefix** on interfaces — used directly (`interface OutcomeStateChange`, `interface EmployerReviewActionState`, `interface ClinicianProofPayload`).
- **Type aliases** for unions, not interfaces (`type EmployerReviewActionIntent = 'accept' | 'refresh' | 'review' | 'reject'`).
- **PascalCase** for both interfaces and aliases. UPPER_CASE for const arrays exported as canon (e.g. `CANONICAL_SOURCE_COVERAGE_STATES`, `LAUNCH_SPINE_SOURCE_IDS` in `packages/trust-state/sourceCoverage.ts`).

## Code Style

**Formatting:**
- Single quotes for strings (observed across `apps/web/lib/api.ts`, `apps/api/backend/src/routes/employerActions.ts`, every test file).
- Semicolons present.
- No `.prettierrc` at root — formatting is observed-via-consistency rather than tool-enforced. Most files match a Prettier-default-2-space style.

**Linting:**
- Root: `.eslintrc.cjs` is a documented stub (`"STUB: Minimal ESLint config for monorepo lint scripts. TODO: Replace with project-specific rulesets."`). `rules: {}` — no enforced rules at the root level.
- Web: `apps/web/.eslintrc.cjs` extends `next/core-web-vitals`. Notable disables: `@next/next/no-img-element`, `react-hooks/exhaustive-deps`. **Notable enforce**: `no-restricted-syntax` blocks hex-color literals inside `apps/web/design-system/components/**/*.tsx` (forces design-token usage).
- Run: `pnpm lint` (turbo dispatch), `pnpm --filter @vitalcv/web lint` (web only).

## Import Organization

**Order (observed):**
1. External packages (`react`, `next/*`, `jose`, `vitest`, etc.)
2. Workspace packages (`@vitalcv/*`)
3. Path-alias imports (`@/lib/*`, `@/components/*`)
4. Relative imports (`./`, `../`)
5. Type-only imports (`import type { … }`) — typically at the end of each group

**Blank line between groups** is the dominant pattern.

**Path aliases** (`apps/web/tsconfig.json`):
- `@/*` → `apps/web/*`
- `@domain-common/*` → `packages/domain-common/*`

Example from `apps/web/__tests__/issuer-policy-review-page-persist.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/issuer-verification/issuerPersistenceWriter', () => ({…}));

import PolicyReviewPage from '../app/issuer/policy-review/[requestId]/page';
```

## Error Handling

**Backend** (`apps/api/backend/`):
- `HttpError` class from `apps/api/backend/src/utils/httpError.ts`. Routes throw `new HttpError(status, message)`. A global error middleware (registered in `src/app.ts`) translates to `{ error: { code, message } }`.
- `asyncHandler(fn)` wrapper from `apps/api/backend/src/routes/employerActions.ts` (and reused) so async exceptions reach the middleware.
- Every mutating route writes an `AuditEvent` row inside the same `prisma.$transaction` BEFORE returning 2xx. Documented at the top of `apps/api/backend/src/routes/employerActions.ts`.

**Web proxies** (`apps/web/app/api/`):
- `normalizeUpstreamError(status, payload, fallbackError, fallbackDescription)` ensures upstream JSON or non-JSON failures both produce a `{ error, error_description }` envelope (see `apps/web/app/api/employer-review/[entityId]/[action]/route.ts`).
- Network failures map to `503 backend_unavailable`.
- Proxies use `AbortSignal.timeout(8_000)` so a hung backend can't lock the client.

**Web libs**:
- Graceful null fallbacks in JSON parsing — `apps/web/lib/api.ts`:

  ```typescript
  async function readJsonBody<T>(response: Response): Promise<T | null> {
    try { return await response.json() as T; }
    catch { return null; }
  }
  ```

## Logging

**Backend:**
- Single canonical logger: `apps/api/backend/src/obs/logger.ts` exports `log(level, event, fields)`.
- Pattern: structured single-line JSON. `level ∈ {info, warn, error}`. `event` is a short snake_case identifier (`employer_review_accepted`, `employer_review_mutation_denied`, `start_outcome_capture_failed`, etc.). `fields` is a plain object — no PII, only ids + classifications.
- Example from `apps/api/backend/src/routes/employerActions.ts`:

  ```typescript
  log('info', 'employer_review_accepted', {
    acceptanceId: state.persistence.acceptanceId,
    auditEventId: state.auditEventId,
    entityId,
    employerId,
    npi_prefix: subject.clinicianNpi.slice(0, 4) + '····',
  });
  ```

- **`console.log` is not the pattern** — every backend write goes through `log()`.

**Web:**
- No app-level logger; runtime errors flow to Sentry via `@sentry/nextjs`.
- Selected routes (`apps/web/app/api/leads/route.ts` etc.) call `console.info(JSON.stringify({…}))` for paper-trail audit when no destination is configured.

## Comments / JSDoc

- **File headers** carry JSDoc-style intent blocks. Example pattern from `apps/api/backend/src/routes/employerActions.ts`:

  ```typescript
  /**
   * employerActions.ts — M2: Accept with Confidence
   *
   * Employer-facing action routes for the review/[entityId] workflow.
   * Auth: Clerk session header (x-clerk-user-id). No API key required.
   *
   * AUDIT CONTRACT
   * ─────────────
   * Every mutating action writes an AuditEvent row in a transaction BEFORE
   * returning 2xx. No action can succeed silently.
   */
  ```

- **Section dividers** via box-drawing characters in long files: `// ── Section name ───────────…`.
- **JSDoc for utilities + middleware** (`apps/api/backend/src/middleware/tenantGuard.ts`, `apps/api/backend/src/services/audit/replayEngine.ts`).
- **TODO format**: free-form, mostly without owner attribution. e.g. `// TODO: In production, persist to database` in `apps/admin-api/src/auth/middleware/aal-guard-enhanced.ts`.

## Function Design

- **Small, focused utilities** — most lib helpers are 3–10 lines (`normalizeApiBase`, `stripProtocol`, `isDemoPath` in `apps/web/lib/api.ts`).
- **Options-object parameters** for anything with 4+ inputs. Example from `apps/api/backend/src/services/entity/employerReviewActions.ts`:

  ```typescript
  export async function recordEmployerReviewAcceptance(input: {
    entityId: string;
    employerId: string;
    clinicianNpi: string;
    correlationId: string;
    organizationContextId?: string;
    bundleId?: string;
    role?: string;
    facility?: string;
    notes?: string;
    acceptanceScope?: string;
    acceptanceReason?: string;
  }): Promise<EmployerReviewActionState> { … }
  ```

- **Route handlers are lean** — validate → call service → return typed response. Example from `apps/web/app/api/receipts/verify/route.ts` is ~16 lines total.
- **Backend services do the heavy lifting** — orchestrating Prisma writes inside `$transaction` blocks, emitting domain events.

## Module Design

- **Named exports** are dominant in libs and services.
- **Default exports** only for Next.js page / layout / route components (App Router convention: `export default function PassportPage(...)` in `apps/web/app/passport/[id]/page.tsx`).
- **Named + default coexist** in route handlers: `export async function POST(...)` alongside `export const runtime = 'nodejs'` and `export const dynamic = 'force-dynamic'`.
- **Barrel files** are rare. Workspace packages typically expose `src/index.ts` as the entry; apps import specific submodules rather than through a barrel.

## Truth contract (cross-cutting)

- The banned-string list in `CLAUDE.md` (`automatically verified`, `HIPAA compliant`, `SOC 2 certified`, `legally accepted`, `risk transferred`, `complete credentialing`, etc.) **must not appear** in public copy.
- Runtime guards encode the list at runtime: `apps/web/lib/trust/trust-container-view.ts`, `apps/web/lib/source-health/unavailableLane.ts`, `apps/web/lib/publicSafety.ts`.
- Test enforcement: every truth-contract test (e.g. `apps/web/__tests__/foundation-sweep-3.test.ts`, `apps/web/__tests__/banned-verified-label.test.ts`) imports the list and asserts absence in rendered HTML.
- No status label may be the bare word `Verified`. Use compound labels (`Source-verified`, `Source-backed`, `NPPES-confirmed`, `issuer-confirmed`) instead.

---

*Convention analysis: 2026-05-18*
*Update when style enforcement (root ESLint, Prettier, CI gates) materially changes.*

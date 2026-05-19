# Testing Patterns

**Analysis Date:** 2026-05-18

## Test Framework

**Web** (`apps/web`):
- **Vitest 4.0.18** — `apps/web/vitest.config.ts`, `apps/web/package.json`.
- Environment: `environment: 'node'`, `globals: true` (per `vitest.config.ts`).
- Setup file: `./test/setup.ts`.

**Backend** (`apps/api/backend`):
- **Jest 29** — `apps/api/backend/jest.config.js`.
- Preset: `ts-jest`. `testEnvironment: 'node'`. `maxWorkers: 1` (sequential — avoids race conditions on the shared Postgres test database).

**End-to-end** (`apps/web`):
- **Playwright 1.58.2** — `apps/web/tests/e2e/` (kept separate from the unit-test tree).

**Assertions:**
- Vitest: built-in `expect` (matchers: `toBe`, `toEqual`, `toContain`, `toThrow`, `toHaveBeenCalledWith`, `toMatch`, …).
- Jest: same surface via Jest's `expect`.

## Run Commands

```bash
# Web — all tests (turbo dispatch)
pnpm --filter @vitalcv/web test

# Web — targeted file
pnpm --filter @vitalcv/web exec vitest run __tests__/<file>.test.ts

# Web — watch
pnpm --filter @vitalcv/web exec vitest

# Web — e2e (Playwright)
pnpm --filter @vitalcv/web test:e2e

# Backend — Jest with DB setup wrapper
cd apps/api/backend && bash ../../../scripts/backend-test-db.sh

# Whole repo (turbo)
pnpm test
```

## Test File Organization

**Web** — **flat** `apps/web/__tests__/` directory.
- Examples: `apps/web/__tests__/employer-review-proxy.test.ts`, `apps/web/__tests__/source-health-panel.test.tsx`, `apps/web/__tests__/banned-strings-script.test.ts`.
- Sole sub-directory: `apps/web/__tests__/source-health/` for the source-probe suite.

**Backend** — **co-located** under each feature directory's `__tests__/`.
- Examples: `apps/api/backend/src/middleware/__tests__/tenantGuard.test.ts`, `apps/api/backend/src/services/entity/__tests__/employerReviewActions.test.ts`, `apps/api/backend/src/core/events/__tests__/eventBus.test.ts`.

**Naming dominance:**
- `*.test.ts` / `*.test.tsx` — **355 files** repo-wide.
- `*.spec.ts` — only **6 files** (effectively legacy).

## Test Structure

**Standard `describe` / `it` shape.** Example from `apps/web/__tests__/issuer-policy-review-page-persist.test.ts`:

```typescript
describe('issuer policy-review page — persistence wiring', () => {
  beforeEach(() => { /* reset mocks */ });

  it('renders disabled banner and recordedBy=demo when writer reports disabled', async () => {
    writeMock.mockResolvedValueOnce({ status: 'disabled', recordedBy: 'demo' });
    const html = await renderPage();
    expect(html).toContain('data-testid="persistence-banner"');
  });
});
```

**Patterns observed:**
- Section dividers via box-drawing characters: `// ─── normalizeOrigin ────────…`.
- Setup via `beforeEach`; teardown via `afterEach`. `beforeAll` is rare.
- Async tests use plain `async`/`await`.
- SSR component testing via `renderToStaticMarkup(<Component …/>)` from `react-dom/server`. This is the dominant React test shape — no jsdom / testing-library overhead.

## Mocking

**Vitest module mocks** (`apps/web`):
- `vi.mock(modulePath, factory)` at the **top of the test file** (hoisted). Example from `apps/web/__tests__/employer-review-proxy.test.ts`:

  ```typescript
  vi.mock('server-only', () => ({}));        // neutralise the server-only marker
  vi.mock('@clerk/nextjs/server', () => ({ auth: authMock }));
  ```

- `vi.stubGlobal('fetch', fetchMock)` for global API mocks.
- `vi.fn().mockResolvedValue(...)` / `.mockResolvedValueOnce(...)` / `.mockReset()` for per-test control.

**Jest mocks** (`apps/api/backend`):
- `jest.fn()` + `.mockResolvedValueOnce(...)` / `.mockReturnValue(...)`.
- Factory helpers per file (e.g. `createRequest`, `createResponse` in `apps/api/backend/src/middleware/__tests__/tenantGuard.test.ts`).

**What gets mocked:**
- `server-only` (vitest cannot evaluate it).
- Clerk session helpers (`@clerk/nextjs/server`).
- The Slack-delivery / external-service modules (so tests don't make HTTP calls).
- `fetch` for proxy contract tests.
- Prisma is **not** mocked at the unit-test layer in most files; backend tests run against a real test database.

**What stays real:**
- Pure transforms (`apps/web/lib/issuer-verification/receiptCandidate.ts`, `apps/web/lib/issuer-verification/policyReview.ts`, `apps/web/lib/trust/*` helpers).
- Type helpers, formatters.

## Fixtures & Factories

- **Inline factory functions per test file** — no shared fixture library. Example from `apps/web/__tests__/employer-review-proxy.test.ts`:

  ```typescript
  function buildActionResponse(action: 'accept' | 'refresh' | 'review') {
    return {
      ok: true,
      state: {
        action,
        entityId: 'entity-1',
        clinicianNpi: '1234567890',
        auditEventId: `audit-${action}-1`,
        timestamp: '2026-03-23T19:00:00.000Z',
        …
      },
    };
  }
  ```

- **Demo personas** in `apps/web/app/demo/_seed.ts` carry `isSyntheticNpi: true` + a `— DEMO` displayName marker; tests assert these labels are present in rendered HTML.
- **Stable base timestamps** in fixture builders (e.g. `apps/web/lib/trust/demoData.ts` uses a `BASE_NOW` constant) so SSR-render tests are deterministic.

## Test Types

**Unit (95%+):** function behaviour, edge cases, error paths. Most files in `apps/web/__tests__/` are unit tests of pure transforms or thin SSR renders.

**Integration:** SSR render tests via `renderToStaticMarkup()` verify page wiring with mocked backend calls. Examples: `apps/web/__tests__/issuer-policy-review-page-persist.test.ts`, `apps/web/__tests__/employer-review-proxy.test.ts`.

**End-to-end:** Playwright in `apps/web/tests/e2e/` — kept separate from the unit-test tree. Excluded from the vitest run via `exclude: ['tests/e2e/**', …]` in `apps/web/vitest.config.ts`.

**Contract / SSR-mirror tests:** A few suites mirror the production JSX shape so they can assert it without mounting the live component. Example: `apps/web/__tests__/source-health-remediation-render.test.tsx` mirrors the panel's hint-row JSX so the lineage + tone contract is asserted without spinning up the fetching shell.

**Truth-contract tests:** Repo-wide banned-string assertions live in suites like `apps/web/__tests__/foundation-sweep-3.test.ts`, `apps/web/__tests__/foundation-sweep-6-analytics-status.test.ts`, `apps/web/__tests__/banned-verified-label.test.ts`, `apps/web/__tests__/passport-copy-truth.test.ts`. They scan rendered DOM and / or source files for the banned-list literals.

## Stale-test exclusions

`apps/web/vitest.config.ts` carries a documented `STALE_TEST_FILES` allowlist (lines 11–21). Each entry has an inline comment explaining why the test is skipped:

```typescript
const STALE_TEST_FILES = [
  '__tests__/billing-page.test.tsx',                  // /app/billing/page missing on main
  '__tests__/employer-request-context.test.tsx',      // /app/review/** missing on main
  '__tests__/employer-workspace-bootstrap.test.tsx',  // /app/review/** missing on main
  '__tests__/live-path-regression.test.tsx',          // @/app/interview/InterviewClient missing
  '__tests__/passport-page.test.tsx',                 // PilotProofPage module-load errors
  '__tests__/pilot-ops-page.test.tsx',                // /app/pilot-ops/page missing on main
  '__tests__/pricing-model.test.ts',                  // @vitalcv/shared/pricing subpath not exported
  '__tests__/public-docs-route-contract.test.tsx',    // /app/docs/page + /app/developers/page missing
  '__tests__/postrelease-truth-cleanup.test.tsx',     // imports deleted pages; asserts legacy nav copy
];
```

**Policy:** skip rather than delete — when the target pages return, the tests can be restored. See `CONCERNS.md` for the coverage-gap impact.

## Coverage

- **No threshold enforcement** in the configs reviewed. `turbo.json` declares `outputs: ["coverage/**"]` for the test task so reports survive cache rounds, but no `--coverage` flag is set in base commands.
- Backend `test:scale` script explicitly opts out via `--no-coverage`.
- Practical coverage posture is "high signal on critical paths, no enforced floor."

## Common Patterns

**Async test:**

```typescript
it('persists a JSONL row and returns leadId on success', async () => {
  const res = await POST(makeRequest(validBody, { 'x-forwarded-for': '203.0.113.42' }));
  expect(res.status).toBe(200);
  const json = await res.json();
  expect(json.leadId).toMatch(/^[0-9a-f-]{36}$/);
});
```

**Error testing:**

```typescript
it('throws on invalid input', () => {
  expect(() => parse(null)).toThrow('Cannot parse null');
});

it('rejects on backend timeout', async () => {
  await expect(POST(req)).rejects.toThrow('backend_unavailable');
});
```

**Snapshot tests:** not used — explicit assertions are preferred.

---

*Testing analysis: 2026-05-18*
*Update when the test framework majors (vitest 5, Jest 30) or when the STALE_TEST_FILES allowlist materially changes.*

# TECH_DEBT

Canonical list of known technical debt for the YC MVP. Keep this in sync with
`RELEASE_NOTES.md` and `FINAL_AUDIT.md` as items are addressed.

## Production Blockers

- Environment validation is incomplete at startup (JWT_SECRET, CORS_ORIGIN,
  INFURA_PROJECT_ID, WORLD_ID_PEPPER, revocation registry endpoint). Centralized
  validation module is missing.
- ShareStore is in-memory only (`apps/web/app/api/_golden-path/shareStore.ts`);
  data is lost on restart.
- Observability is missing (metrics, tracing, error tracking, audit logging).

## Security / Trust

- Verifier identity is not validated; token URL grants access.
- Revocation records are mocked; no registry integration.
- Issuer VC compliance checks and signature verification not implemented.

## Testing / Quality

- issuer-api has 19 failing tests (dpopGuard, allowedSinksEnforcer).
- Domain packages lack runtime tests; golden-path E2E tests are missing.
- Integration layer uses `any` types in `apps/web/lib/*.ts`.

## Build / Typecheck

- `@vitalcv/plugin-sdk` fails typecheck (rootDir/module resolution errors).
- `@chai-vc/logging-core` fails typecheck (Error type conversion).

## Dependencies

- Admin API relies on `@prisma/client` but lacked the matching `prisma` CLI for local builds.
  Added `prisma@5.7.1` to `apps/admin-api/package.json` to keep schema generation aligned.

## Documentation Gaps

- API reference documentation
- Third-party integration guide
- Operator runbook
- Architecture decision records (ADRs)

### Recently Added (2026-01-30)

✅ **Canonical Documentation:**
- `docs/VITALCV_OVERVIEW.md` - System overview, problem space, current state
- `docs/CRED0_DOCTRINE.md` - Trust reset philosophy, issued vs inferred trust
- `docs/MVP_SCOPE.md` - YC demo boundaries, what's in/out
- `docs/TRUST_LOOP.md` - Issue→Hold→Present→Accept cycle, roles, proofs

## Source References

- `RELEASE_NOTES.md` (2026-01-25)
- `FINAL_AUDIT.md` (2026-01-25)

# Technical Debt & Architecture Log

## Antigravity Enforcement

- [ ] **PSV Integrations**: The current PSV implementation (`apps/web/lib/psv-integrations.ts`) is a **demo simulation**.
  - **Current**: Returns deterministic PASS/RESTRICTED statuses based on NPI presence.
  - **Required**: Implement real `OIG_LEIE` (CSV download/search), `SAM_EXCLUSIONS` (API), and `CMS_PPEF` connectors in `packages/psv-pipeline` or `services/psv`.
- [ ] **Verifier API**: `apps/verifier-api` is a minimal express app enforcing `canonicalPath`. It lacks persistence for Rejection/Revocation events.
- [ ] **State Boards**: Integration with state board crawlers (ProviderTrust, etc.) is mocked as "RESTRICTED".
- [ ] **Identity**: `onboarding/page.tsx` relies on `api/clinician/npi-sync` which calls a backend service. Ensure that backend service (`apps/api/backend`) is fully implemented with real NPPES lookup.

## Known Limitations (MVP)

- **World ID**: Removed from MVP scope to strictly enforce "NPI -> Recognition" flow first.
- **Blockchain**: `blockchain/` folder exists but substrate node integration is not fully wired into `apps/api`.
- **Authentication**: Usage of `AuthGuard` is minimal; production needs robust session management (NextAuth or Clerk).

## Recently Fixed (2026-01-30)

✅ **EMP-1/EMP-3: PSV Requirement Enforcement**
- Added `psvReportId` field to `EmployerAcceptance` interface (employmentContracts.ts:160)
- Added validation in `assertEmployerAcceptanceValid()` (employmentGuards.ts:315-322)
- Prevents acceptance without PSV verification (NCQA CR1 + CMS CoP compliance)
- All tests passing (104 tests, 100% coverage)

✅ **UX-1: Anxiety-Inducing Language Softened**
- Onboarding error messages changed from punitive to helpful
- "Verification Blocked" → "Verification needed"
- "Cannot proceed" → "We will help you get started"
- apps/web/app/onboarding/page.tsx:66,89,140,163

✅ **Web Build Compliance**
- Fixed string escaping syntax error in onboarding page
- Added Suspense boundaries for useSearchParams() in verify and home pages
- Next.js 15 production build now passes successfully

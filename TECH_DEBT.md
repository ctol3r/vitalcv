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

## Documentation Gaps

- API reference documentation
- Third-party integration guide
- Operator runbook
- Architecture decision records (ADRs)

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

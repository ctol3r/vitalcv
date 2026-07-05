# Re-baseline — 2026-07-04 (Wave 0, god-mode plan)

**Baseline commit:** `f7bdbe158` (origin/main tip at verification time)
**Method:** every blocker claim in `docs/research/god-mode-research-report.md` §1 and the Wave 0 brief was verified against the tree on disk — not against older docs. Evidence paths below are the proof, not assertions.
**Canonical open list:** `docs/ops/launch-blockers.md` (created by this wave). `docs/LAUNCH_GATE.md` (2026-03-28) is now a historical snapshot.

## Confirmed resolved (do NOT re-work these)

| Old blocker | Evidence on `f7bdbe158` |
|---|---|
| Marketing→web seam broken | `apps/marketing/app/clinician/page.tsx` redirects to the live `/passport` flow (NPI passthrough included) |
| Hero/HomeSections banned-string copy | 0 live-copy hits for `hire instantly` / `zero-trust ledger` / `blockchain-anchored` / `HIPAA compliant` / `SOC 2 certified`; only ban-list definitions match (`apps/web/lib/source-health/unavailableLane.ts`, `apps/web/lib/trust/trust-container-view.ts`) |
| `apps/mobile` empty | Built: `src/services/{LocalCredentialStore,OfflinePresentationEngine,OID4VPHandler,NotificationService,WalletSyncService,ReadinessService,HandoffService}.ts` + `__tests__` |
| Passport fixture-backed | Backend-proxied: `apps/web/app/api/passport/[npi]/route.ts` → `resolvePassportRuntimePassport` |
| Employer accept not audit-first | `apps/api/backend/src/routes/employerActions.ts` writes `AuditEvent` in-transaction before 2xx; duplicate-guarded; BLOCKED fails closed |
| No CSP / security headers | `apps/web/security-headers.mjs` ships HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, Content-Security-Policy (+ `__tests__/security-headers.test.ts`); Clerk custom-domain CSP fixed in PR #536 |
| No env validation | Web: `apps/web/lib/env.ts` (SEC-ENV-1 typed contract). Backend: `apps/api/backend/src/config/env.ts` + `envValidation.ts` (Zod) |
| Nursys throws when flagged on | `apps/api/backend/src/services/nursysAdapter.ts` is an honest gated stub: returns NOT_AVAILABLE, never fabricates, no throw path in the default flow |
| No ASVS scorecard | `docs/security/asvs-scorecard.md` exists (L1, evidence-cited). L2 mapping remains open |

## Corrected premises (the plan docs were stale here)

1. **The 7 "dist-only" packages do not exist.** `packages/{audit-receipts,claims,vitalindex,rate-limiter,runtime-mode,idempotency,conflict-resolution}` are absent from `origin/main`. All 28 real packages have sources. See `docs/architecture/package-status.md`. Nothing may depend on the phantom seven.
2. **`apps/router` does not exist** on `origin/main` (git tracks no files there). No disposition needed.
3. **`apps/status-api` is not empty.** It is a real minimal Express service for VC revocation status (StatusList2021), a workspace member (`@vitalcv/status-api`). It is the predecessor of Wave E (Bitstring Status List). See its README.
4. **`apps/lib` is load-bearing.** `apps/web/components/clinician/OfflineRadar.tsx` imports `apps/lib/credentials/blePresentation.ts` via a cross-app relative path. Do not delete without removing that import. See its README.
5. **Verifier RBAC flag lives in the web app**, not `apps/verifier-api`: `apps/web/lib/verifier/orgRolesFoundation.ts` pins `rbacEnforced: false` (literal, honest foundation — same pattern as the signup foundation).
6. **Wave A is already in flight** on a parallel lane: gate PR 1/4 merged (#538, profession selector), 2/4 open (#539, attestation + audit + persistence). Wave 0 deliberately touched no signup surface.

## NPPES V1→V2 cutover verdict (urgent check — PASSED)

- Every runtime NPPES endpoint constant targets **API v2.1**: `apps/api/backend/src/modules/identity/nppes.service.ts`, `apps/api/backend/src/engine/adapters/nppesAdapter.ts`, `apps/api/backend/adapters/NppesAdapter.ts` (legacy path, still live — imported by `psvOrchestrator`, `PsvOrchestrator`, `verifyRoute`). Web-side probes/diagnostics also pin v2.1.
- **Zero V1 references** anywhere in `apps/`, `packages/`, `scripts/` (negative scan for `version=1` / V1 dissemination names).
- Bulk files: `sourceCatalog.ts` `NPPES_BULK` entry already points at the V2 file surface (`download.cms.gov/nppes/NPI_Files.html`). Note: there is **no bulk-file downloader implementation** — runtime NPI enrichment is API-only today. Bulk ingestion remains a phase-1 open item, not a pilot blocker.
- **Runtime assertion added** (this wave): `apps/api/backend/src/services/identity/nppesApiVersion.ts` imports the three real endpoint constants and refuses boot if any is not pinned to v2.1; logs `nppes_api_version` on success. Wired into **both** entrypoints: `index.ts` `startServer()` (dev/local) and `server.ts` `bootstrapApp()` — the production entry per `railway.toml` `startCommand`, added in a follow-up fix after the first deploy proved container health but not assertion execution.

## Local-only artifacts noted

`docs/research/vitalcv-research-pdf-index.md` (a Dropbox PDF catalog) remains deliberately uncommitted — it indexes personal filesystem paths. The god-mode report and the clinician signup brief are committed alongside this re-baseline for provenance.

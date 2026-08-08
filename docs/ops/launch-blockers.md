# Launch blockers — canonical open list

**Status date:** 2026-07-11 · **Baseline:** `f7bdbe158` (origin/main)
**Provenance:** re-baselined on-disk by Wave 0; see `docs/ops/REBASELINE-2026-07-04.md` for what was verified-resolved and which older premises were corrected. `docs/LAUNCH_GATE.md` (2026-03-28) is historical.

This file lists **only genuinely-open items**, each with its owning wave from the god-mode plan (`docs/research/god-mode-research-report.md`). When an item closes, move it to the resolved table in the re-baseline doc of the closing wave — do not leave ghosts here.

## Open blockers

| # | Item | Evidence it is open | Owning wave |
|---|---|---|---|
| 2 | Verifier org-role RBAC enforcement | `apps/web/lib/verifier/orgRolesFoundation.ts` pins `rbacEnforced: false` (literal); no role checks on mutating verifier routes | B |
| 6 | STATE_BOARD / FSMB physician-licensure lane | Gated, no live adapter behind `STATE_BOARD_ENABLED`; license claims must stay `gated`, never `checked` | C |
| 7 | SAM.gov exclusions adapter | Honest gated adapter landed (`services/samGovAdapter.ts`, `SAM_GOV_ENABLED` default false); live API key + fetcher wiring outstanding — coverage stays `gated`/`accessRequired`, OIG/LEIE remains the only live exclusion source | C |
| 8 | Nursys institutional access | Adapter is an honest gated stub (`nursysAdapter.ts`) — real E-Notify agreement + fetcher wiring outstanding; must stay `gated`/`accessRequired`. The separate fabricating registry stub (`adapters/nursysStubAdapter.ts`) now **fails closed in production** (gap G13, closed): share verify, audit bundles, and monitoring refuse to persist or present stub results and return `SOURCE_ACCESS_REQUIRED`; the unmounted wave2a `/api/v2/verify` module was deleted | C |
| 9 | Continuous monitoring not enabled | Wave 245 scheduler exists (`services/async/monitoringScheduler.ts`, `MONITORING_ENABLED` default false); NCQA-cadence re-checks not running | D |
| 10 | NPPES bulk-file ingestion | Catalog declares V2 bulk surface; no downloader implementation — runtime enrichment is API-v2.1-only (asserted at boot) | C/D (phase 1, not a pilot blocker) |
| 12 | Compliance proof-pack surfaces | JC survey-ready export, NIST 800-63-4 IAL mapping doc, passkey/DPoP AAL2 path — none present | F |
| 13 | Certifications (SOC 2 Type II / HITRUST / NCQA accreditation) | Business-level procurement blocker; copy stays "aligned", never "certified" | GTM (not a code wave) |
| 14 | **Live revocation registry is non-functional — a revoked credential reads "not revoked"** | Three independent breaks in `apps/api/backend`, all verified against `main` @ `b1507c28c` on 2026-08-07. **(a) `model StatusListState` does not exist** — absent from `prisma/schema.prisma` and from every migration, so `prisma.statusListState` is `undefined` and `ensureState()` throws on *every* path: `getStatusListCredential()`, `setRevoked()`, `assignStatusIndex()`, `isRevoked()`. `// @ts-nocheck` on line 1 of `services/ledger/statusListManager.ts` is why the compiler never said so. **(b) `GraphCascader.setRevocationBit` never flips a bit** — it only increments `version` to bust caches; it never decodes, sets, or re-encodes the bitstring. `setRevoked(artifactId)` is the real flip and `continuousMonitor` calls it; the cascader does not and should delegate. **(c) The list is not publicly reachable** — `/api/credentials/status-list` is missing from `shouldSkipTenantContext` in `middleware/tenantGuard.ts`; live probe returns `401 organization_context_required` to exactly the unauthenticated verifiers its own docblock names as the audience. **The 401 masks (a)** — from outside you cannot tell a guarded route from a crashing one. Net effect: the registry has never served a list and no bit has ever been flipped; the `credentialStatus` on every issued VC is a promise nothing honors. Fix = migration + tenant-guard skip-list entry + cascader delegation; removing `@ts-nocheck` is a separate PR. CI will not catch (a) — `backend-tests.yml` builds its DB with `prisma db push` from schema.prisma, so a missing model surfaces only if a test exercises the path, and none do. | E |

**Closed 2026-08-07:** item **#11** (revocation registry on Bitstring Status List + VC 2.0 pinning).
Both stated conditions are met: `apps/status-api` was ported from StatusList2021 to W3C VC 2.0
`BitstringStatusList` and its verifier now **fails closed** — every failure mode (unfetchable,
malformed, wrong format, purpose mismatch, expired list, out-of-range index) returns `unverifiable`
with a typed code, replacing a predecessor path that returned *not-revoked* on decode failure
(PR #1120, `950300c11`; 62/62 tests incl. a 22-fixture sweep proving no failure reads as
not-revoked). Demo credentials now issue a spec-correct `BitstringStatusListEntry` against a
reserved status bit instead of borrowing a real artifact's bit (PR #1124, `b1507c28c`).
`apps/api/backend` was already Bitstring/VC 2.0 from Wave 40.
**Scope note — read this before treating #11 as progress on revocation.** #11 was written against
`apps/status-api`, and that is exactly what was fixed. But `apps/status-api` has **no `Dockerfile`
and no `railway.toml`**, appears in no deploy workflow, and **is not deployed** — it is referenced
only by `monorepo.yml` for build/test. The live `/api/credentials/status-list` is served by
`apps/api/backend/src/routes/statusList.ts`, a different implementation, and that one is **broken
three ways** — see open item #14. So #11 closing means *the format and the verifier are now correct
in a service nothing runs*. It does **not** mean revocation works; end-to-end, it does not work at
all today.

**Closed since baseline:** items #1 (self-serve signup gate — OTP delivery live via Resend, tiers enforced by PR #622), #3 (prod auth/Google OAuth — verified live 2026-07-11), #4 (signup e2e — PR #595), and #5 (OWASP ASVS **L2** mapping) — closed 2026-07-05 by `docs/security/ASVS-scorecard-2026-07.md` (Wave B task 6; 151 rows, evidence-cited, gap register G1–G13). The security gaps it surfaces stay tracked as items #2/#4 above and in the scorecard's gap register. Item numbers are stable; closed numbers are not reused.

## Standing guardrails (apply to every closing PR)

Audit-first mutations · Recognition→Acceptance→Start preserved · revoked/expired/missing fails closed · zero PHI on-chain · no `prisma migrate` without founder approval · banned-string discipline per `CLAUDE.md` (no bare `Verified` label; attested ≠ source-checked; never claim NPDB/DEA/ABMS/SAM until live).

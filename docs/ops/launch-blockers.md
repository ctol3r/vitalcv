# Launch blockers — canonical open list

**Status date:** 2026-07-05 · **Baseline:** `f7bdbe158` (origin/main)
**Provenance:** re-baselined on-disk by Wave 0; see `docs/ops/REBASELINE-2026-07-04.md` for what was verified-resolved and which older premises were corrected. `docs/LAUNCH_GATE.md` (2026-03-28) is historical.

This file lists **only genuinely-open items**, each with its owning wave from the god-mode plan (`docs/research/god-mode-research-report.md`). When an item closes, move it to the resolved table in the re-baseline doc of the closing wave — do not leave ghosts here.

## Open blockers

| # | Item | Evidence it is open | Owning wave |
|---|---|---|---|
| 1 | Self-serve clinician signup gate completion — NPI confirm screen, identity-binding factor (work-email OTP), attestation flow, wallet provisioning | `apps/web/lib/commercial/selfServeSignupFoundation.ts` pins `accountCreationProductionReady: false`, `identityProofingComplete: false`; gate PRs 1/4 merged (#538), 2/4 open (#539), 3/4–4/4 unstarted | A (in flight) |
| 2 | Verifier org-role RBAC enforcement | `apps/web/lib/verifier/orgRolesFoundation.ts` pins `rbacEnforced: false` (literal); no role checks on mutating verifier routes | B |
| 3 | Prod auth / Google OAuth verification on Clerk | Unverified in Clerk prod config; sign-in CSP fixed (#536) but OAuth provider state unconfirmed; needs `.env.example` documentation | B |
| 4 | E2E signup happy-path + fail-closed test | No e2e covering role→NPI→confirm→attest→wallet, nor a BLOCKED-passport-cannot-be-accepted case | B (gates A's acceptance) |
| 6 | STATE_BOARD / FSMB physician-licensure lane | Gated, no live adapter behind `STATE_BOARD_ENABLED`; license claims must stay `gated`, never `checked` | C |
| 7 | SAM.gov exclusions adapter | Absent; OIG/LEIE is the only live exclusion source | C |
| 8 | Nursys institutional access | Adapter is an honest gated stub (`nursysAdapter.ts`) — real E-Notify agreement + fetcher wiring outstanding; must stay `gated`/`accessRequired` | C |
| 9 | Continuous monitoring not enabled | Wave 245 scheduler exists (`services/async/monitoringScheduler.ts`, `MONITORING_ENABLED` default false); NCQA-cadence re-checks not running | D |
| 10 | NPPES bulk-file ingestion | Catalog declares V2 bulk surface; no downloader implementation — runtime enrichment is API-v2.1-only (asserted at boot) | C/D (phase 1, not a pilot blocker) |
| 11 | Revocation registry on Bitstring Status List + VC 2.0 pinning | `apps/status-api` implements StatusList2021 (predecessor); VC 2.0 Bitstring alignment + verifier fail-closed tests outstanding | E |
| 12 | Compliance proof-pack surfaces | JC survey-ready export, NIST 800-63-4 IAL mapping doc, passkey/DPoP AAL2 path — none present | F |
| 13 | Certifications (SOC 2 Type II / HITRUST / NCQA accreditation) | Business-level procurement blocker; copy stays "aligned", never "certified" | GTM (not a code wave) |

**Closed since baseline:** item #5 (OWASP ASVS **L2** mapping) — closed 2026-07-05 by `docs/security/ASVS-scorecard-2026-07.md` (Wave B task 6; 151 rows, evidence-cited, gap register G1–G12). The security gaps it surfaces stay tracked as items #2/#4 above and in the scorecard's gap register. Item numbers are stable; closed numbers are not reused.

## Standing guardrails (apply to every closing PR)

Audit-first mutations · Recognition→Acceptance→Start preserved · revoked/expired/missing fails closed · zero PHI on-chain · no `prisma migrate` without founder approval · banned-string discipline per `CLAUDE.md` (no bare `Verified` label; attested ≠ source-checked; never claim NPDB/DEA/ABMS/SAM until live).

# VitalCV Full Scope Completion Board

Last updated: **2026-07-04 (BOARD-RECONCILE-1, docs-only)** (top tables reconciled to `origin/main` after 100 merges landed since the 2026-05-28 header — PRs #436–#544 plus late-merged #279; blockers section now defers to `docs/ops/launch-blockers.md`)
Latest PRs (all on `main`): 🚢 #535 `329bf7964` (MATCHA GA, feature default-on), 🚢 #536 `ccef8a656` (Clerk custom-domain CSP — sign-in P0 fix), 🚢 #537 `f44fb229a`, 🚢 #538 `f7bdbe158` + 🚢 #539 `9d7b00f87` + 🚢 #542 `f11df24ff` (clinician signup gate PRs 1–3 of 4), 🚢 #541 `d1dbe7960` (Wave 0 re-baseline + NPPES v2.1 boot assertion), 🚢 #544 `0a90df985` (employer-review RBAC gate, shadow-first). Full #436–#544 window ledger: see **BOARD-RECONCILE-1** section at the end of this file.
Source branch (this update): `claude/intelligent-goldberg-581ec7`

`main` head: `0a90df9856f4397b8c809d1d9ef15453d29207c3`
Deploy target: **Railway** — Vercel deprecated 2026-06-28 (#466 `dca85c5ac`; `docs/deployment/railway-migration.md`). Live checks at this update: `api.vitalcv.com/health` returns `git_sha:"0a90df985…"` (= `main` tip, 0 error requests); `vitalcv.com/api/version` responds 200 (#508 release monitoring endpoint).

## Standing rule

Update this board after every wave. Even a docs-only wave should bump the **Last updated** field and any state transitions for in-flight PRs. Move percentages only on **merge / deploy / live validation** — not on PR existence.

## Current blockers — canonical list is `docs/ops/launch-blockers.md`

As of 2026-07-04 the open-blocker list lives in **`docs/ops/launch-blockers.md`** (created by Wave 0, #541 `d1dbe7960`), with the verified-resolved history in `docs/ops/REBASELINE-2026-07-04.md`. This board no longer maintains its own blocker list. Dispositions of the six items the 2026-05-27 list carried:

1. ✅ PR #423 redeploy to `delightful-essence` — resolved 2026-05-27 (recorded in the appendix history below).
2. ➡️ Authenticated SSE smoke for NPI 1699264564 — never run as specced. The concern it guarded (live NPPES truth-state behind auth) has since been exercised by live source-backed readiness replacing the demo snapshot (#468 `8f68ef004`), the signed-in QA arc (`docs/product/signed-in-clinician-qa.md` + P0 fixes #503 `e1efaf04b`, #507 `d57196d71`, #536 `ccef8a656`), and synthetic post-deploy verification (#508 `042c44469`). The canonical list carries no open item for it.
3. ✅ PR #422 — merged `801100c7f` 2026-05-27 (recorded in appendix history).
4. ➡️ NPPES source operational reliability — folded into launch-blockers #9 (continuous monitoring off by default) and #10 (no bulk-file ingestion); NPPES API v2.1 pinning is now boot-asserted (#541 `d1dbe7960`).
5. ✅ Failing scheduled probe workflows — workflow set has been rebuilt since: phantom gates and placeholder deploy steps removed (#473 `2622def4c`), deploy verification is webhook-driven (#508 `042c44469`).
6. ✅ Vercel account block — mooted; Vercel deprecated, Railway canonical (#466 `dca85c5ac`).

## Next highest-leverage bottleneck

**Self-serve clinician signup gate completion (launch-blockers #1, Wave A)** — gate PRs 1–3 of 4 are merged (#538 `f7bdbe158` profession selector, #539 `9d7b00f87` attestation + audit, #542 `f11df24ff` email-OTP possession factor); wallet provisioning (4/4), the `accountCreationProductionReady` literal flip, and the e2e happy-path + fail-closed test (launch-blockers #4) remain. Two adjacent flag-flips are staged behind it: the issuer persistence writer is merged but default-off (`ISSUER_PERSISTENCE_ENABLED`), and employer-review RBAC is merged shadow-first (#544 `0a90df985`, `rbacEnforced` literal still `false`). TRUST-PERSIST-1 — the previous headline blocker here — landed its writer + surface wiring back in Wave B (#255–#258, reconciled into the tables below), and three 2026-07-04 Prisma migrations now await founder-gated `migrate deploy`.

## Full-Scope Coverage Rule

Every wave report and board update must include every board area and status.
Focus areas may be highlighted, but non-focused areas must remain visible.
For non-focused rows, `After Wave %` must equal `Current %` and `Detail / Action Per Area` must say `No action this wave.`

## Scoring Rules

- **Current %** = honest current state, evidenced by code on `origin/main`. Moves only on merge + verification.
- **After Wave %** = Current % for rows with no action this wave. Only rows with merged evidence in this wave may differ.
- **No score moves on unmerged work.** A PR open or in review is not a delta.
- **Parent categories cannot hide low child rows.** Section roll-ups are computed from child rows, not asserted.
- **No row above 90% without implementation evidence**, all five required where relevant:
  - code merged to `main`
  - tests
  - user-facing route/UI
  - truth/compliance copy review
  - accessibility/mobile consideration

A row that fails any required-evidence check is capped at **75%** regardless of internal completeness.

## Status Lexicon

The Completion Board uses exact percentages plus emoji phase labels only. The phase is **derived from** Current %, never asserted independently.

| % Range | Status Emoji | Status Name |
|---:|---|---|
| 0% | 🧊 | Planned |
| 1–24% | 🌱 | Seed |
| 25–49% | 🧱 | Foundation |
| 50–69% | 🛠️ | Buildout |
| 70–89% | 🚀 | Hardening |
| 90–99% | ✅ | Target Zone |
| 100% | 🏁 | Complete |

Forbidden qualitative labels (must never appear in a Status cell or any wave delta report):

- very low / low / not started / partial / high / almost done / near complete / strong / near target / above target

## Required Table Schema

Every section uses this schema:

| Area | Current % | After Wave % | Detail / Action Per Area | Status |
|---|---:|---:|---|---|

- **Current %** = honest current state, evidenced by code on `origin/main`. Moves only on merge + verification.
- **After Wave % = Current %** for all rows not touched by the active wave. Only rows with merged evidence in this wave may differ.
- **Detail / Action Per Area** = what was done (evidence) or "No action this wave."
- **Status** = emoji phase derived from Current %. Never asserted independently.

---

## 🧠 Trust Engine / Issuer Infrastructure

| Area | Current % | After Wave % | Detail / Action Per Area | Status |
|---|---:|---:|---|---|
| Issuer request / router | 80 | 80 | No action this wave. Routes + tests on main (#167). | 🚀 Hardening |
| Partner route model | 75 | 75 | No action this wave. Partner router + tests (#167). | 🚀 Hardening |
| Issuer response intake | 70 | 70 | No action this wave. Intake surface + tests (#168). | 🚀 Hardening |
| Receipt candidate | 85 | 85 | No action this wave. `receiptCandidate.ts` + literal `decisionGrade:false`/`proofTier:'receipt_candidate'` tests on main. | 🚀 Hardening |
| Policy review decision | 85 | 85 | No action this wave. `policyReview.ts` 5-gate flow + tests. | 🚀 Hardening |
| PSV receipt promotion | 70 | 80 | Reconciled from Wave B ledger: writer wired into `/issuer/psv-receipt` (#258 `5d28a95d3`), flag-gated. | 🚀 Hardening |
| Reuse / revocation / supersession boundary | 75 | 80 | Reconciled from Wave A ledger: constraint tamper detection + cross-tenant reuse block (#235 `b61d60da6`). | 🚀 Hardening |
| Consent / manual send / timeline | 70 | 70 | No action this wave. Consent + timeline (#174). | 🚀 Hardening |
| Audit persistence boundary | 75 | 75 | No action this wave. (#175) `auditPersistence.ts` + tests. | 🚀 Hardening |
| Persistence adapter decision | 75 | 75 | No action this wave. (#176). | 🚀 Hardening |
| Backend writer boundary | 75 | 75 | No action this wave. (#180) `serverPsvReceiptWriter.ts` defensive downgrade + tests; deferred default writer only. | 🚀 Hardening |
| Domain / core PSV receipt contract alignment | 80 | 80 | No action this wave. (#178) `packages/domain-core/psvReceipts.ts` + frozen mapper tests. | 🚀 Hardening |
| Source health classifier | 65 | 75 | Reconciled from Wave A/H ledgers: post-deploy probe (#252 `08781510c`) + public `/status` panel (#261 `71a9d0682`) on the #186/#187 base. | 🚀 Hardening |

---

## 🧑‍⚕️ Live Clinician Product

| Area | Current % | After Wave % | Detail / Action Per Area | Status |
|---|---:|---:|---|---|
| Signup / account creation | 10 | 45 | `/get-ready` NPI binding (#475 `804e66a69`); gate PRs 1–3/4 (#538 `f7bdbe158`, #539 `9d7b00f87`, #542 `f11df24ff`). `accountCreationProductionReady` still `false` — capped. | 🧱 Foundation |
| Login / account recovery | 10 | 35 | Sign-in unbroken in prod via Clerk-domain CSP (#536 `ccef8a656`); role resolution P0s fixed (#503 `e1efaf04b`, #507 `d57196d71`); takeover block (#504 `1d996c49a`). No recovery flow; prod OAuth unconfirmed (launch-blockers #3). | 🧱 Foundation |
| NPI check | 65 | 75 | NPPES v2.1 pinning boot-asserted, zero V1 refs (#541 `d1dbe7960`); `/get-ready` binding flow (#475 `804e66a69`). | 🚀 Hardening |
| Rich clinician profile shell | 75 | 80 | Live profile on real workspace + passport data (#476 `73ea7baf4`); editing depth with provenance + save states (#496 `84ecd6bcc`). | 🚀 Hardening |
| Identity / contact / locations | 55 | 65 | Provenance-honest identity surface (#495 `3dcc3c598`); profile editing depth (#496 `84ecd6bcc`). Still self-attested, no verified binding. | 🛠️ Buildout |
| Medical school | 25 | 25 | No action this wave. Free-text capture; no source verification. | 🧱 Foundation |
| Residency | 25 | 25 | No action this wave. Free-text capture; no source verification. | 🧱 Foundation |
| Fellowship | 25 | 25 | No action this wave. Free-text capture; no source verification. | 🧱 Foundation |
| Training programs | 20 | 30 | Training evidence modeled in the organization graph (#447 `aa3b8b825`). No source verification. | 🧱 Foundation |
| Specialty / subspecialty | 30 | 30 | No action this wave. Capture + NPPES inference only. | 🧱 Foundation |
| Current employer | 25 | 25 | No action this wave. User-entered, no employer-side verification. | 🧱 Foundation |
| Employer history | 20 | 20 | No action this wave. User-entered only. | 🌱 Seed |
| Affiliations | 20 | 28 | Clinician organization graph (#447 `aa3b8b825`). User-entered basis unchanged. | 🧱 Foundation |
| Work history | 20 | 20 | No action this wave. User-entered only. | 🌱 Seed |
| Research / publications | 15 | 15 | No action this wave. Section exists, no live source binding. | 🌱 Seed |
| PubMed layer | 30 | 30 | No action this wave. `pubmedCandidatesVerifiedByDefault: false` (#FOUNDATION-SWEEP-5). | 🧱 Foundation |
| LinkedIn-style profile layer | 28 | 28 | No action this wave. `verifiesCredentials: false` (#FOUNDATION-SWEEP-5). | 🧱 Foundation |
| Doximity-style profile layer | 26 | 26 | No action this wave. `verifiesCredentials: false` (#FOUNDATION-SWEEP-5). | 🧱 Foundation |
| Career goals / preferences | 25 | 55 | Personal/Professional/Place match questions (#519 `222fe1ffb`); DB-persisted preferences keyed by user (#534 `5838348ca`, migration awaits `migrate deploy`); Career Compass (#533 `bbf5c4c71`). | 🛠️ Buildout |
| Career intelligence layer (MATCHA) | 0 | 55 | New row (BOARD-RECONCILE-1). Engine + web surfaces (#518 `6e8e0a7dc`), honest livability (#520 `8953ccda3`), deterministic simulator (#532 `5c23ce2fb`), GA default-on (#535 `329bf7964`, `features.ts`). Truth-contract refusals: no interview-probability or salary claims. | 🛠️ Buildout |
| Profile completion score | 40 | 50 | Completeness guidance tied to provenance tiers in the editing flow (#496 `84ecd6bcc`) on the PR-C base. | 🛠️ Buildout |
| Clinician-facing value dashboard | 30 | 65 | Product-loop holder home (#516 `16fee8520`); clinician dashboard (#521 `7f219a552`); Career Scoreboard (#531 `449bdbae1`); daily brief + streak (#529 `532c81fab`). | 🛠️ Buildout |

---

## 📱 Mobile + Device Experience

| Area | Current % | After Wave % | Detail / Action Per Area | Status |
|---|---:|---:|---|---|
| Mobile web / PWA | 42 | 42 | No action this wave (settled at PR-F #214 value). PWA installability + offline shell still unconfirmed. | 🧱 Foundation |
| Native iOS app | 25 | 30 | Wallet service layer + tests exist in `apps/mobile` (REBASELINE-confirmed on-disk, #541 `d1dbe7960`). No store app; `isLive: false`. | 🧱 Foundation |
| Native Android app | 25 | 30 | Same `apps/mobile` service layer evidence (#541 `d1dbe7960`). No store app; `isLive: false`. | 🧱 Foundation |
| Mobile document capture | 25 | 25 | No action this wave. Native camera not enabled (#FOUNDATION-SWEEP-3). | 🧱 Foundation |
| Device trust / App Attest / Play Integrity | 0 | 0 | No action this wave. None shipped. | 🧊 Planned |
| Biometric gating | 25 | 25 | No action this wave. `biometricGatingLive: false` (#FOUNDATION-SWEEP-4). | 🧱 Foundation |
| Push notification readiness | 0 | 10 | `NotificationService.ts` in `apps/mobile` (REBASELINE-confirmed, #541 `d1dbe7960`); nothing shipped to devices. | 🌱 Seed |
| Offline / degraded-state handling | 25 | 32 | `OfflinePresentationEngine` + BLE `OfflineRadar` path on main (REBASELINE §4, #541 `d1dbe7960`) atop 5xx fallbacks; `offlineSyncImplemented: false`. | 🧱 Foundation |

---

## 🔐 Identity + Security

| Area | Current % | After Wave % | Detail / Action Per Area | Status |
|---|---:|---:|---|---|
| Government ID verification | 25 | 25 | No action this wave. `governmentIdLive: false`, `vendorSelected: false` (#FOUNDATION-SWEEP-4). | 🧱 Foundation |
| Selfie / liveness | 25 | 25 | No action this wave. `selfieLivenessLive: false` (#FOUNDATION-SWEEP-4). | 🧱 Foundation |
| Clinician-to-NPI binding | 28 | 50 | `/get-ready` binding (#475 `804e66a69`); profession selector (#538 `f7bdbe158`); attestation + audit (#539 `9d7b00f87`); email-OTP possession factor (#542 `f11df24ff`). `identityProofingComplete` still `false` — capped. | 🛠️ Buildout |
| Identity proofing policy | 25 | 35 | Attestation flow (#539 `9d7b00f87`) + work-email OTP trust anchor (#542 `f11df24ff`) added to the live set; still no IAL2/IAL3. | 🧱 Foundation |
| Account recovery | 25 | 25 | No action this wave. All 5 methods `isLive: false`; no production recovery flow (#FOUNDATION-SWEEP-3). | 🧱 Foundation |
| Session security | 20 | 35 | Header-driven account-takeover blocked in `ensureWorkspaceUser` (#504 `1d996c49a`); tenant-guard role-resolution fix (#503 `e1efaf04b`); Clerk custom-domain CSP (#536 `ccef8a656`). | 🧱 Foundation |
| OWASP ASVS baseline | 15 | 40 | Reconciled: ASVS L1 scorecard published at `docs/security/asvs-scorecard.md` (#227 `52e0a111c`), on main today. L2 mapping open (launch-blockers #5). | 🧱 Foundation |
| Security headers / secure defaults | 35 | 75 | Reconciled: strict header baseline CSP/HSTS/XCTO/Referrer/Permissions + tests (#226 `a27d4d522`, `apps/web/security-headers.mjs`); Clerk-domain CSP gap closed (#536 `ccef8a656`). | 🚀 Hardening |
| Data classification | 33 | 33 | No action this wave (settled at ENTERPRISE-VANGUARD-6A value). `redactionLive: false`. | 🧱 Foundation |
| Retention / redaction | 25 | 25 | No action this wave (settled at ENTERPRISE-VANGUARD-6A value). `retentionEnforced: false`. | 🧱 Foundation |
| Secrets / env handling | 30 | 70 | Reconciled: typed env contract w/ build-time validation (#228 `e2a241117`, `apps/web/lib/env.ts`); backend Zod env (`envValidation.ts`, REBASELINE-confirmed). | 🚀 Hardening |

---

## ♿ Accessibility

| Area | Current % | After Wave % | Detail / Action Per Area | Status |
|---|---:|---:|---|---|
| WCAG 2.2 AA baseline | 25 | 60 | Reconciled: a11y baseline assertions (#229 `5cee8879d`) + axe-core gate on hero routes (#232 `92af696f8`), running in CI (`.github/workflows/a11y-gate.yml`). Scope is hero routes; known-violations register kept (`docs/security/a11y-known-violations.md`). | 🛠️ Buildout |
| Keyboard navigation | 25 | 25 | No action this wave. No audited focus traps. | 🧱 Foundation |
| Screen reader labels | 25 | 25 | No action this wave. `aria-labelledby` on identity surface only (#FOUNDATION-SWEEP-2). | 🧱 Foundation |
| Touch targets | 30 | 30 | No action this wave. No 44×44 audit. | 🧱 Foundation |
| Error-state accessibility | 15 | 15 | No action this wave. Error UIs not audited for screen readers. | 🌱 Seed |
| Contrast | 35 | 45 | Axe gate includes contrast checks on hero routes (#232 `92af696f8`) atop PR-E tokens; no full-surface contrast audit. | 🧱 Foundation |
| Reduced motion | 25 | 25 | No action this wave. Not audited end-to-end (#FOUNDATION-SWEEP-2). | 🧱 Foundation |
| Form accessibility | 15 | 15 | No action this wave. No labeled-region audit. | 🌱 Seed |
| Mobile accessibility | 15 | 22 | Wallet credential a11y labels (#445 `187b24378`); a11y loading states on ecosystem surfaces (#452 `2280cb53e`). No labeled-region audit. | 🌱 Seed |

---

## 📤 Upload / Import / Export

| Area | Current % | After Wave % | Detail / Action Per Area | Status |
|---|---:|---:|---|---|
| CV upload | 25 | 25 | No action this wave. Binary CV upload not wired. | 🧱 Foundation |
| Document upload | 32 | 32 | No action this wave. `entry_only` status (#FOUNDATION-SWEEP-2). | 🧱 Foundation |
| Drag/drop upload UX | 15 | 15 | No action this wave. No confirmed DnD surface. | 🌱 Seed |
| LinkedIn import | 25 | 25 | No action this wave. `linkedin_profile` `isLive: false` (#FOUNDATION-SWEEP-5). | 🧱 Foundation |
| Doximity import | 25 | 25 | No action this wave. `doximity_profile` `isLive: false` (#FOUNDATION-SWEEP-5). | 🧱 Foundation |
| PubMed import | 30 | 30 | No action this wave. `productionReady: false` (#FOUNDATION-SWEEP-5). | 🧱 Foundation |
| CSV / roster import | 30 | 30 | No action this wave. Roster management is manual. | 🧱 Foundation |
| Export bundle | 25 | 35 | Career Packet in the Career Evidence stack (#444 `c8df66f93`) + export-packet route/tests. | 🧱 Foundation |
| Shareable passport | 35 | 55 | Recognition share panel → `/verify/[npi]` (#487 `2f967fb02`); public verifier surface restored with redacted trust-proof (#490 `ddf9c0141`); Wallet share/prove action (#511 `1b4038232`). | 🛠️ Buildout |
| Proof pack export | 20 | 20 | No action this wave. JC survey-ready export absent (launch-blockers #12). | 🌱 Seed |
| Import error handling | 25 | 25 | No action this wave. 8 `ImportErrorKind` values (#FOUNDATION-SWEEP-2). | 🧱 Foundation |
| Import provenance labels | 40 | 40 | No action this wave. 5-tier provenance vocab enforced (Wave GOD-3S). | 🧱 Foundation |

---

## 🕸️ Knowledge Trust Graph

| Area | Current % | After Wave % | Detail / Action Per Area | Status |
|---|---:|---:|---|---|
| Data model | 75 | 80 | Canonical Professional Knowledge Graph — one graph, no duplicate state (#460 `4f790c128`). | 🚀 Hardening |
| Claim / source / receipt navigation | 60 | 60 | No action this wave. TrustGraph panel mounts on `/passport/[id]`. | 🛠️ Buildout |
| Roam/Obsidian-style visual graph UX | 22 | 55 | Interactive Career Constellation with time scrub (#528 `c227c2b87`); personalized via daily brief loop (#529 `532c81fab`). | 🛠️ Buildout |
| Graph search | 10 | 25 | Ecosystem search surface (#448 `781998c1b`). | 🧱 Foundation |
| Graph filtering | 10 | 20 | Time-scrub filtering on the constellation (#528 `c227c2b87`); no facet filters. | 🌱 Seed |
| Graph export | 30 | 30 | No action this wave. Underlying JSON exportable; no UI export. | 🧱 Foundation |
| Clinician-facing graph explanation | 35 | 45 | Explainable reasoning layer (#461 `0540001b4`); constellation legend (#528 `c227c2b87`). | 🧱 Foundation |
| Verifier-facing graph explanation | 30 | 30 | No action this wave. Static explainer. | 🧱 Foundation |
| Graph-to-proof-pack path | 20 | 20 | No action this wave. Not connected end-to-end. | 🌱 Seed |

---

## 🏥 Verifier / Employer Product

| Area | Current % | After Wave % | Detail / Action Per Area | Status |
|---|---:|---:|---|---|
| Employer review | 60 | 70 | Audit-first in-transaction accept, BLOCKED fails closed (REBASELINE-confirmed); employer-notes leak fixed in public read (#498 `81722c1dd`); RBAC gate shadow-first (#544 `0a90df985`). | 🚀 Hardening |
| Request review | 55 | 55 | No action this wave. Route-contract covered (#497 `5dde02695`). | 🛠️ Buildout |
| Verifier worklist | 48 | 60 | Reconciled: DB-backed reads via `worklistRepo.ts` `prisma.receiptCandidate` (#253 `8e5b6f40d`); vocabulary foundation in `worklist.ts` still pins `dbBackedWorklist: false` (stale literal, tracked). | 🛠️ Buildout |
| Evidence inspection | 50 | 50 | No action this wave. Receipt candidate viewer. | 🛠️ Buildout |
| Reuse decision UX | 65 | 65 | No action this wave (settled at FOUNDATION-SWEEP-7 value). `crossTenantReuseImplemented: false`. | 🛠️ Buildout |
| Policy decision UX | 75 | 75 | No action this wave (settled at FOUNDATION-SWEEP-7 value). `automatedPolicyEngine: false`. | 🚀 Hardening |
| Exportable proof pack | 25 | 25 | No action this wave. Not bundled. | 🧱 Foundation |
| Team / org roles | 28 | 40 | Server-side RBAC gate on employer-review mutations, shadow-first (#544 `0a90df985`); `rbacEnforced` literal still `false` — enforce-mode flip is launch-blockers #2. | 🧱 Foundation |
| Review status tracking | 60 | 60 | No action this wave (settled at FOUNDATION-SWEEP-7 value). `productionWorkflowLive: false`. | 🛠️ Buildout |
| Employer CTA / conversion path | 40 | 55 | Employer candidate pool (#522 `412b5c262`); employer discoverability (#524 `6e9ab7a72`); Calm Wave buyer pages (#527 `c053c96d0`). | 🛠️ Buildout |

---

## 🏛️ Backend / Persistence / API

| Area | Current % | After Wave % | Detail / Action Per Area | Status |
|---|---:|---:|---|---|
| Domain PSV receipt contract | 85 | 85 | No action this wave. (#178) frozen mapper tests. | 🚀 Hardening |
| Server writer confirmation boundary | 80 | 80 | No action this wave. (#180) defensive downgrade + tests. | 🚀 Hardening |
| Real persistence writer | 5 | 70 | Reconciled from Wave A/B ledgers: Prisma scaffold w/ truth-contract CHECKs (#221 `ded7a0e1a`); flagged writer (#255 `3dfac77cc`); wired into 3 issuer surfaces (#256 `daf11c0dd`, #257 `184e94fe8`, #258 `5d28a95d3`). `ISSUER_PERSISTENCE_ENABLED` default-off. | 🚀 Hardening |
| Audit replay | 18 | 30 | Audit-first employer actions write `AuditEvent` in-transaction (REBASELINE-confirmed); attestation audit events (#539 `9d7b00f87`). | 🧱 Foundation |
| Export API | 15 | 25 | Versioned API contract + webhook core + typed SDK (#451 `6a1b484b0`). | 🧱 Foundation |
| Backend test coverage | 42 | 55 | Reconciled +22 tests (#421 `fe9c6f9c1`, #423 `9f272c80c`); golden-path contract suites (#497 `5dde02695`); pure `otpCore` tests (#542 `f11df24ff`). | 🛠️ Buildout |
| API route hardening | 32 | 65 | Reconciled: CORS allowlist + API key foundation (#234 `e92396d62`), tenant-isolation 403s (#421 `fe9c6f9c1`); new: UUID 404-gates on public dynamic routes (#500 `095e29ba5`, #501 `0215b1f2c`), takeover block (#504 `1d996c49a`). | 🛠️ Buildout |
| Repository adapter | 70 | 70 | No action this wave. (#176/#177) decision boundaries. | 🚀 Hardening |
| Database migration readiness | 5 | 45 | Prisma migrations on main incl. the 2026-07-04 trio — matcha_preferences (#534 `5838348ca`), clinician_attestation (#539 `9d7b00f87`), email_otp_identity_binding (#542 `f11df24ff`); Railway Postgres runtime. The trio awaits founder-gated `migrate deploy`. | 🧱 Foundation |

---

## 🚀 Commercial Launch Readiness

| Area | Current % | After Wave % | Detail / Action Per Area | Status |
|---|---:|---:|---|---|
| Pricing/paywall | 28 | 28 | Percentage held; note refreshed: dead subscription billing code deleted (#502 `63d1db05a`); `collectsPayment` still `false`. | 🧱 Foundation |
| Self-serve signup | 32 | 45 | Gate PRs 1–3/4 merged (#538 `f7bdbe158`, #539 `9d7b00f87`, #542 `f11df24ff`); production-readiness literals still `false` — completion is launch-blockers #1. | 🧱 Foundation |
| Onboarding | 38 | 55 | `/get-ready` canonical binding entry (#475 `804e66a69`); MATCHA match questions (#519 `222fe1ffb`); Calm Wave signed-in onboarding (#526 `403c478af`). | 🛠️ Buildout |
| Support / admin | 25 | 40 | `/admin/platform` Ops Center V1 — Deployment Integrity Check + Founder Dashboard (#469 `9c4c49c8d`). `staffed: false` unchanged. | 🧱 Foundation |
| Pilot ops | 50 | 50 | No action this wave. No funnel instrumentation. | 🛠️ Buildout |
| Analytics | 40 | 40 | No action this wave. No vendor wired (#FOUNDATION-SWEEP-6B). | 🧱 Foundation |
| Docs / status page | 55 | 65 | Durable release monitoring + `/api/version` (#508 `042c44469`, endpoint live); HIPAA architecture evidence + SOC 2 readiness map (#279 `87b4f5a0a`). | 🛠️ Buildout |
| Legal pages | 60 | 70 | Reconciled from Wave A ledger: DPA template + cookie policy pages + footer wiring (#242 `91f162b57`) atop `/privacy` + `/terms`. | 🚀 Hardening |
| Sales / pilot collateral | 25 | 45 | Reconciled Wave H: pilot intake (#259 `f63b222f1`), persona pages (#260 `404cd8bd0`), pricing CTAs (#262 `c24ef7451`); new: buyer pages (#527 `c053c96d0`), buyer audiences (#515 `fa068e989`), demo tenant (#453 `e3a2d8381`). | 🧱 Foundation |
| Demo data / reset flow | 28 | 40 | Decision-grade demo tenant + `/demo` (#453 `e3a2d8381`); demo activation/dossier pages 404-gated behind demo ids (#478 `e339fecb4`). | 🧱 Foundation |

---

## 🧪 Quality / CI / Release

| Area | Current % | After Wave % | Detail / Action Per Area | Status |
|---|---:|---:|---|---|
| Web quality | 85 | 85 | No action this wave. TypeScript + ESLint enforced on build (#196 BUILD-CHAIN-1). | 🚀 Hardening |
| Monorepo CI/CD | 65 | 70 | Web excluded from postgres-less test lane (#471 `d35ce5950`); Railway web deploys restored (#472 `24a0ed7a1`); phantom gates + placeholder deploy steps removed (#473 `2622def4c`). | 🚀 Hardening |
| Railway deploy preflight | 40 | 65 | Railway canonical (#466 `dca85c5ac`); Docker deps stage installs full workspace graph (#470 `2280251b2`); startCommand override fix (#472 `24a0ed7a1`); Deployment Integrity Check (#469 `9c4c49c8d`). | 🛠️ Buildout |
| Web deploy health (Railway) | 60 | 65 | Row renamed from "Vercel deploy health" — Vercel deprecated (#466 `dca85c5ac`; `docs/deployment/railway-migration.md`). Synthetic post-deploy verification → GH commit status (#508 `042c44469`); `vitalcv.com/api/version` live (200). | 🛠️ Buildout |
| Regression test coverage | 55 | 70 | 4-layer golden-path route contract incl. negative controls (#497 `5dde02695`); holder route contract — every golden-path href must resolve (#482 `9fda87cf8`). | 🚀 Hardening |
| Route map coverage | 30 | 65 | Auto-discovered link scan + repo-wide namespace sweep honoring `next.config` rewrites (#497 `5dde02695`); published inventory `docs/product/golden-path-route-inventory.md`. | 🛠️ Buildout |
| Smoke tests | 55 | 65 | Railway-webhook synthetic-clinician deploy verification (#508 `042c44469`); self-auditing Deployment Integrity Check (#469 `9c4c49c8d`). | 🛠️ Buildout |
| Release checklist | 20 | 45 | Release-manager routine — the standard verified merge loop (#492 `a2d03cac2`); `docs/deployment/release-monitoring.md`. | 🧱 Foundation |

> **BUILD-CHAIN-1 evidence note (#196):** added deterministic web build commands (`build:web`, `build:web:direct`, `build:check-chain`), build-chain documentation (`docs/ops/vitalcv-build-chain.md`), and an executable build-chain check script (`scripts/check-web-build-chain.sh`). The canonical local web build path is now `pnpm run build:web` (or `pnpm turbo run build --filter @vitalcv/web`). `@vitalcv/shared` TS6059 remains tracked separately in **issue #195**.

---

## Wave Delta Format

Every wave report must use this schema for each row:

| Area | Current % | After Wave % | Detail / Action Per Area | Status |
|---|---:|---:|---|---|
| Example | 20 | 35 | Code + tests + route + copy merged in this wave (PR #NNN). | 🧱 Foundation |

- **After Wave %** = Current % for rows with no action this wave; proposed new % for rows with merged evidence.
- Numbers move only after merge + verification; the emoji phase is derived from After Wave %.

## Future Wave Reporting Rule

Every future wave must report each affected row with:

- exact Current %
- exact After Wave % (= Current % for untouched rows)
- Detail / Action Per Area: evidence summary ≤120 chars, or "No action this wave."
- Status: emoji phase derived from After Wave %

Do not use qualitative maturity words ("very low", "low", "not started", "partial", "high", "almost done", "near complete", "strong", "near target", "above target") in place of percentages or the emoji phase. Numbers move on merge + verification only; the emoji phase is **derived from** the percentage, never asserted independently. Work-state nuance (merged-on-main, boundary-only, deferred, concept) lives in **Detail / Action Per Area**, not in Status.

## Low-Score-First Attack Order

Re-derived 2026-07-04 from the reconciled table lows plus the `docs/ops/launch-blockers.md` wave order:

1. Signup gate 4/4 + e2e happy-path/fail-closed test (launch-blockers #1/#4)
2. RBAC enforce-mode flip + prod OAuth confirmation (launch-blockers #2/#3)
3. Device trust / push notification readiness (0–10%)
4. Account recovery + gov ID / liveness (25%)
5. Proof-pack export path (20–25%; feeds launch-blockers #12)
6. Research / publications + PubMed live binding (15–30%)
7. Form / error-state accessibility (15%)
8. Graph search / filtering (20–25%)
9. Native app shipping (30%)
10. Pricing / paywall (28%)

## Notes on this revision

- Replaces the prior board's headline "100% wedge usability / 99% pilot-ready / 66% overall" framing. That framing rolled live-URL non-crashing into completion; the new schema treats route stability as one row of one section, not a system score.
- Trust-engine rows are the only ones permitted to sit in the 70–85 band; they have merged code on `main` (PRs #166–#180) and tests, but each is still capped below 90 because **real persistence is deferred** (#180), so the proof-of-action chain is incomplete end-to-end.
- Live clinician product, identity proofing, accessibility, mobile, and import/export rows are conservatively scored per the brief.
- All Expected/Actual Wave Deltas were +0 in the prior framework PR — that PR was docs-only.
- BOARD-SCHEMA-3 (this revision): normalizes every section table to the 5-column schema (Area, Current %, After Wave %, Detail / Action Per Area, Status); adds Full-Scope Coverage Rule; preserves all canonical areas and statuses.
- BOARD-RECONCILE-1 (2026-07-04, docs-only): re-syncs the section tables to `origin/main` `0a90df985` — applies the board's own recorded-but-never-applied pre-2026-05-28 wave deltas plus the #436–#544 merge window; renames "Vercel deploy health" → "Web deploy health (Railway)"; adds one row (Career intelligence layer (MATCHA)); replaces the local blockers list with a pointer to `docs/ops/launch-blockers.md`. Full ledger in the BOARD-RECONCILE-1 section at the end of this file.

## RELIABILITY-2 board delta (PR #187 evidence)

RELIABILITY-1 (#186) and RELIABILITY-2 (#187) shipped `SourceHealthState`, `LaneHealthBadge`, `unavailableLane`, the snapshot store, `runAllProbes`, internal `/api/internal/source-health/probe` and `/snapshots` routes, the scheduled `source-health-probe.yml` workflow, and the source-health test suite (88/88). This board delta records that evidence on existing full-scope rows and adds one new row (`Source health classifier`) under Trust Engine — without reviving old aggregate roll-up rows (`Drift + Monitoring`, `Source Spine`, `Truth / Enforcement`, `Enterprise-Ready Completion`, `Overall VitalCV Completion`), which were intentionally retired by the full-scope schema.

## PR-C + PR-E Rescue board delta (post #207 and #209 merge)

**PR-C (#207, commit ac58f6df)** — rescue/clinician-profile-foundation → merged to main.
* `apps/web/lib/clinician-profile/profileTypes.ts` (163 lines): `ClinicianProfile` type with provenance + confidence axis per field.
* `apps/web/lib/clinician-profile/profileCompletion.ts` (253 lines): weighted completeness score; three source tiers (`source-backed` / `self-attested` / `imported-candidate`); 22-test vitest suite.
* Routes added: `/clinician/profile`, `/clinician/graph`, `/clinician/onboarding`, `/clinician/import` — all shell-only, no production auth gate.
* Rows moved: `Rich clinician profile shell` 55→75, `Identity/contact/locations` 35→55, `Profile completion score` 20→40, `Clinician-facing value dashboard` 10→30.

**PR-E (#209, commit e1687cc2)** — rescue/design-system-v2-foundation → merged to main.
* Design-system v2 foundation: `design-system/tokens/colors.ts`, `design-system/tokens/typography.ts`, themes (dark, light, graphite, midnight), `design-system/components/index.ts`, `design-system/docs/catalog.ts`.
* `apps/web/styles/themes/index.css` + `apps/web/styles/typography.css` — canonical style entry points.
* `apps/web/app/globals.css` — aligned to token-backed values.
* Row moved: `Contrast` 30→35 (tokens on main; no axe audit yet).
* Font swap (Geist) reverted in this rescue to keep PR-E additive; font migration deferred to app-shell (PR-F).

## PR-F Rescue board delta (post #214 merge)

**PR-F (#214, commit bae32c90)** — rescue/app-shell-font-migration → merged to main.
* `apps/web/app/layout.tsx`: Geist + Geist_Mono via `next/font/google`; wires `--font-geist`/`--font-geist-mono`/`--font-body`/`--font-sans`/`--font-heading`/`--font-mono` CSS variables at the body level (Bundle B17). JetBrains Mono and the marketing sans stack kept as fallbacks.
* `apps/web/app/HomePageClient.tsx`: editorial homepage port (Bundle B26) using `LaneStateBadge` + `TrustTierBadge` from PR-E; NPI submit routes to `/passport?npi=`; copy line "readiness to employer action in 1.8 min".
* Row moved: `Mobile web / PWA` 35→42 (responsive shell + Geist font system at layout level; installability + offline shell still not verified).
* Rows held: `Contrast` stays 35 (no axe-based contrast audit added in PR-F); `Web quality` stays 85 (no new CI gate); `Vercel deploy health` stays 60 (no deploy procedure change).
* `typographyTokens.fontSans` (lib) intentionally unchanged — `theme-tokens.test.ts` still asserts Nunito Sans on the lib side; layout-level CSS vars override at runtime. Lib-level token migration is a future PR with a paired test update.

## Wave A — Code Red merge burndown (2026-05-05)

11 PRs merged to main between `5d530f13` and `91f162b5`. Three PRs deferred (#237, #240, #247) due to unrelated backend test drift or schema-conflict resolution that requires its own PR. PR #243 (verifier RBAC) auto-conflicted on the last merge of the script and is queued for rebase.

### Per-row Current % deltas (evidenced by code on `origin/main`)

| Row | Before | After | Evidence |
|---|---:|---:|---|
| Real persistence writer (Trust Engine) | 5 | 30 | #221 — Prisma scaffold for IssuerRequest + ReceiptCandidate with truth-contract CHECK constraints (decisionGrade=FALSE, proofTier='receipt_candidate', recordedBy enum). Writer not wired yet (Wave B). |
| Source health classifier (Trust Engine) | 65 | 75 | #252 — post-deploy source-health probe workflow + script + test. |
| Reuse / revocation / supersession boundary (Trust Engine) | 75 | 80 | #235 — `classifyConstraintViolation` (Postgres 23514 → tamper_detected) + `checkCrossTenantReuseBlock` consent helpers. |
| Verifier worklist / decision UX | 60 | 80 | #253 — replaces foundation array with DB-backed `getWorklist()` reads from ReceiptCandidate; `REVIEW_STATE_MAP` keyed by canonical `ReceiptCandidateReviewState`. |
| WCAG 2.2 AA baseline | 50 | 80 | #229 + #232 — foundation a11y assertions + axe-core gate on hero routes. |
| Security headers | 25 | 75 | #226 — strict response-header baseline (CSP/HSTS/X-Content-Type-Options/Referrer-Policy/Permissions-Policy). |
| Secrets / env handling | 40 | 70 | #228 — typed env contract with build-time validation. |
| API route hardening | 35 | 60 | #234 — CORS allowlist + API key foundation. |
| OWASP ASVS L1 baseline | 0 | 40 | #227 — published ASVS L1 scorecard at `docs/security/asvs-scorecard.md`. |
| Legal pages | 30 | 70 | #242 — DPA template + cookie policy pages with footer wiring. |

### Section roll-ups (derived)

* 🧠 Trust Engine / Issuer Infrastructure: ~78 → ~85
* 🧑‍⚕️ Live Clinician Product: held (no Wave A action on clinician-facing rows)
* 🛂 Verifier / Employer: ~67 → ~74
* 📊 Intelligence / UX: ~64 → ~70 (a11y gate landed)
* 🏛 Enterprise / Compliance: ~42 → ~58 (security headers + env + CORS + ASVS + legal)

### Deferred (require own follow-up PR, not in this delta)

* **#237** db-migration baseline — Prisma migrate gate now passes after dropping `--shadow-database-url`, but Railway Deploy Preflight still blocked by a real backend test drift (`employerActions.test.ts` expects `reviewHref: "/review/{entity}?contextId={ctx}&bundleId={bundle}"` while the route returns `"/review/undefined"`). That's a backend route bug, not a docs/CI bug.
* **#247** policy decision persistence — `apps/web/prisma/schema.prisma` had a conflict with the canonical-types comment that #253 added; resolution requires its own PR rather than mid-rebase fix-forward.
* **#240** cross-tenant reuse block — Web Quality CI failure that needs the same kind of test/copy alignment #253 needed; left as a follow-up.
* **#243** verifier RBAC — auto-conflicted as the 7th PR in the merge script (after #242 touched footer/middleware-adjacent files); needs a rebase + re-merge.

### Verification artifacts

* `git log origin/main 5d530f13..91f162b5` — 11 commits, all squash-merges with PR numbers.
* No row above 90% claimed in this delta.
* No banned phrases introduced (every PR's diff was Codex-audited or its CI ran banned-strings checks).
* Truth contract preserved: `ReceiptCandidate.decisionGrade` is still the literal `false` and `proofTier` is still the literal `'receipt_candidate'` everywhere they appear.

## Waves B/D/E/F/H — Code Red continuation (2026-05-05 → 2026-05-07)

14 PRs merged to main between `a35747bd` (post Wave A board delta #254) and
`39e00696` (post Wave E Phase 2 Dossier #273). This brings the full Code Red
loop to a structural close: every issuer surface persists candidates behind a
feature flag, the GTM funnel is closed, and **all 6 missing design surfaces
from the Claude Design zip have foundations on main**.

### Wave B Phase 2-3c — Persistence cutover (4 PRs)

ReceiptCandidate writer landed and wired into 3 of 4 issuer surfaces. Default
behavior unchanged (`ISSUER_PERSISTENCE_ENABLED` unset in prod); flipping the
flag in production env causes those pages to write real audit rows on visit
without a redeploy.

| PR | Surface | Effect |
|---|---|---|
| #255 | writer module | feature-flagged ReceiptCandidate writer with strict no-crash invariant + 6-test suite |
| #256 | `/issuer/review/[requestId]` | dynamic-import + try/catch wrapped writer call; persistence-status banner system (4 outcome states) |
| #257 | `/issuer/policy-review/[requestId]` | same wiring; dry-run UX preserved |
| #258 | `/issuer/psv-receipt/[requestId]` | same wiring; PSV promotion literals untouched |

`/issuer/psv-reuse/[receiptId]` is intentionally NOT wired — it operates on
PSVReceipt + PSVReceiptReuseDecision (different entities, different writers).
A follow-up phase adds those.

### Wave H — GTM funnel (4 PRs)

Buyer journey closed end-to-end: lands → reads persona page → picks plan →
clicks pilot CTA → fills intake form → submission posts to Slack (or stdout).

| PR | Surface | Effect |
|---|---|---|
| #259 | `/contact` + `/api/pilot-intake` | real intake form, Slack hand-off when env URL set, 33 tests |
| #260 | `/for/cvo` `/for/payer` `/for/staffing-exchange` | 3 persona landing pages + form preselect via `?persona=` |
| #261 | `/status` | public source-health panel (NPPES/OIG/PECOS/state-board) wired to in-memory snapshot store from #187/#252; honest empty-state |
| #262 | `/pricing` | per-plan CTAs routing to `/contact?persona=...`; optional Cal.com booking embed gated on `NEXT_PUBLIC_CALENDLY_URL` (host-allowlisted to cal.com / calendly.com) |

### Waves D/E/F — Design surfaces (6 PRs, all 6 surfaces)

Every Claude Design surface now has a foundation on main. Each renders a demo
banner so a viewer cannot mistake the surface for a real production state. Real
DB reads, OCR, classification engines, EdDSA signing, and live action endpoints
are explicitly Phase 2 work per surface — Phase 1 establishes the route, the
data shape, the truth-contract enforcement, and the test coverage.

| PR | Surface | Route |
|---|---|---|
| #263 | File | `/file/[fileId]` — 8-section TOC + sticky sidebar + IntersectionObserver |
| #265 | ROI | `/roi` — KPI strip + DTS table + blocker funnel + compliance grid + financial impact |
| #268 | Inbox | `/inbox` — document list + extractions with provenance + suggestions + provenance legend |
| #270 | Activation | `/activation/[caseId]` — burn-down + critical path + privileges + payer matrix + onboarding + handoffs |
| #271 | Autopilot | `/autopilot` — trust score (composite + factors) + renewal radar + NBA queue + portability map + drift monitor |
| #273 | Dossier | `/dossier/[receiptId]` — 11-row custody ledger + receipt envelope + reg mapping + 3 export options |

### Per-row Current % deltas (evidenced by code on `origin/main`)

| Row | Before | After | Evidence |
|---|---:|---:|---|
| Real persistence writer (Trust Engine) | 30 | 70 | #255 (writer) + #256/#257/#258 (3 of 4 issuer surfaces wired) |
| Issuer review surface | 80 | 90 | #256 — persistence banner system + strict no-crash dynamic import |
| Policy review surface | 85 | 90 | #257 — same wiring |
| PSV receipt promotion surface | 70 | 80 | #258 — underlying ReceiptCandidate persisted |
| Contact / pilot intake | 0 | 80 | #259 — form + POST + Slack wrapper, 33 tests |
| Persona-routed landing pages | 30 | 75 | #260 — 3 persona pages + form preselect |
| Public status surface | 60 | 85 | #261 — source-health panel wired to snapshot store |
| Pricing surface | 50 | 75 | #262 — per-plan CTAs + booking embed |
| Credentialing file packet (UI) | 0 | 30 | #263 — foundation shell, all 8 sections |
| Executive ROI dashboard (UI) | 0 | 30 | #265 — foundation shell, KPI/DTS/funnel/grid/financial |
| AI Knowledge Inbox (UI) | 0 | 25 | #268 — foundation shell, 5 docs, provenance legend |
| Start-Activation Console (UI) | 0 | 30 | #270 — foundation shell, 4 stages + 5 priv + 8 payers + 10 tasks |
| Career Autopilot (UI) | 0 | 25 | #271 — foundation shell, 9 renewals + NBA + portability + drift |
| Cryptographic Proof Dossier (UI) | 0 | 25 | #273 — foundation shell, 11-row ledger + envelope + reg mapping |

### Section roll-ups (derived)

* 🧠 Trust Engine / Issuer Infrastructure: ~85 → ~90 (writer landed + 3 surfaces wired)
* 🧑‍⚕️ Live Clinician Product: held (no clinician-facing rows touched in this window)
* 🛂 Verifier / Employer: ~74 → ~78 (Activation Console foundation + persistence wiring)
* 📊 Intelligence / UX: ~70 → ~85 (5 net-new design surfaces foundationed: File, ROI, Inbox, Autopilot, Dossier)
* 🏛 Enterprise / Compliance: ~58 → ~62 (Dossier reg mapping + ROI compliance alignment grid)
* 🛒 Commercial / GTM: ~40 → ~80 (Wave H closed the buyer funnel)

### Truth-contract enforcement during this delta

A standing rename pattern emerged across the design-surface foundations: the
design source's strongest provenance label is the bare word **"Verified"**
(or **"VERIFIED"** in the Dossier). CLAUDE.md bans bare "Verified" status
labels. Every surface that imported a "verified" provenance from the design
source renames it to **"Source-confirmed"** with a typed key like
`source_confirmed`. Tests on each surface assert no status meta uses bare
"Verified" / "VERIFIED" and the rendered HTML contains zero bare
`>Verified<` or `>VERIFIED<` tags.

A second standing pattern: specific upstream vendor names that the design
source uses to make examples concrete (NPPES, OIG/LEIE, SAM.gov, NPDB,
AAMC, NCCPA, CA DCA, DEA, CAQH, Aetna, UnitedHealthcare, Anthem, Kaiser,
Cigna, Cedar, etc.) are all **vendor-gated** in our reality and have NO
real integration. Each design surface PR replaces those names with
vendor-neutral controls ("home-state professional licensing board",
"federal controlled-substance authority", "issuing certification board",
"Commercial Carrier 1..5", etc.) so a viewer cannot read the demo as
implying a real integration. Tests assert vendor-name absence with
word-boundary regex to prevent false positives like `sam` matching inside
"same day".

### Test coverage added in this delta

| PR | Test count |
|---|---:|
| #255 | 6 (writer module) |
| #256 | 6 (issuer review wiring) |
| #257 | 7 (policy review wiring) |
| #258 | 6 (psv receipt wiring) |
| #259 | 33 (validate + slack + route) |
| #260 | 17 (persona pages + form preselect) |
| #261 | 7 (source-health public panel) |
| #262 | 15 (pricing CTAs + booking embed) |
| #263 | 17 (file foundation) |
| #265 | 27 (ROI foundation) |
| #268 | 23 (inbox foundation) |
| #270 | 27 (activation foundation) |
| #271 | 26 (autopilot foundation) |
| #273 | 28 (dossier foundation) |
| **Total** | **245 new test cases** |

### Verification artifacts

* `git log origin/main a35747bd..39e00696` — 14 squash-merges with PR numbers.
* Every PR was end-to-end verified against a local `next start` build (auth-
  gated issuer surfaces relied on unit tests since auth blocks browser entry).
* No row above 90% claimed in this delta.
* No banned phrases introduced — every PR's diff was Codex-audited (3-pass:
  implementation / diff safety / banned strings).
* Truth contract preserved across all 14 PRs: `ReceiptCandidate.decisionGrade`
  is still the literal `false`, `proofTier` is still the literal
  `'receipt_candidate'`, and no file under `apps/web/lib/issuer-verification/`
  was touched by any of the design-surface PRs.

### Deferred / not in scope

* **Wave B Phase 3d** — `PolicyReviewDecision` schema + writer + POST handler.
  The PolicyReviewDecision Prisma model from the original deferred PR #247
  still needs its own follow-up PR; the policy-review page in #257 only
  persists the underlying ReceiptCandidate.
* **Wave B Phase 3e** — `/issuer/psv-reuse/[receiptId]` writer wiring.
  Operates on PSVReceipt + PSVReceiptReuseDecision (different entities).
* **Phase 2 work per design surface** — interactive upload (Inbox), real DB
  reads (Activation/Autopilot), real EdDSA signing + signed-PDF export
  (Dossier), SVG sparkline charts (ROI/Activation/Autopilot), accept-into-
  profile flow (Inbox suggestions), real action endpoints (Autopilot NBA).
* **Wave A leftovers** — #237 (DB migrate), #240 (cross-tenant reuse), #243
  (verifier RBAC), #247 (policy decision persistence) all still open.
* **Wave G** — enterprise architecture hardening (HIPAA / SOC2 docs / PWA /
  CI gates) not yet started.

## Wave Batch 2026-05-26 — diagnosis / repair / transplant (no merges)

This batch produced four open PRs and **landed nothing on `main`**. Per the standing rule "Do not inflate progress because a PR exists", percentages do not move; the wave is recorded as state transitions on in-flight PRs and as a known-unknown bump to two waves-left counts where Codex surfaced new remediation work.

### Status legend (used in the alternate 15-dimension view below)

`planned` → `PR opened` → `merged` → `deployed` → `validated live` → `generating business traction`.

### 15-dimension view (high-end waves-left only)

| Dimension | % | Waves left | Status of latest in-flight work |
|---|---:|---:|---|
| Product Truth Contract | 46% | 14 | PR opened (#420 against wave-10a; #423 draft against main) |
| Core Credentialing Workflow | 29% | 26 | planned (untouched this wave) |
| Source Integrations / PSV | 18% | 40 | planned (emission semantics moved on #420/#423; no new source integration) |
| Backend / API Reliability | 24% | **32** (+2) | PR opened (#421, #423); Codex UNSAFE on #421 added known remediation work |
| Database / Persistence Layer | 16% | 40 | planned (untouched) |
| Trust / Proof / Receipts | 31% | **29** (+1) | PR opened (#421, #423); Codex hash-binding finding adds remediation work |
| Frontend UX / Role Journeys | 35% | 24 | merged + deployed (prior waves; #b89d9801) |
| Sign-up / Auth / Onboarding | 22% | 28 | planned (PR #420 onboarding nudge excluded — main already clean) |
| Interoperability / Standards | 26% | 34 | planned (untouched) |
| Demo / Sales Conversion | 24% | 32 | planned (untouched) |
| Deployment / DevOps | 23% | **31** (+1) | PR opened (#421); delightful-essence still stale at PR #359-era; Vercel account block adds path |
| Testing / CI / Quality Gates | 29% | 28 | PR opened (#422); upstream API build is the actual CI red — not the vitest rule |
| Self-Improving System / Agents | 13% | 50 | planned (untouched) |
| Business / GTM / Revenue Engine | 17% | 50 | planned (untouched) |
| **Overall Billion-Dollar Readiness** | **24%** | **404** (+4) | nothing landed; aggregate waves-left bumped for newly-surfaced remediation |

### Per-row Current % deltas (canonical schema)

Hard rule: **no row moves on unmerged work.** This wave produced no merges to `main`, so every affected row's Current % stays where it was. The board records this wave only as a metadata bump.

| Area | Current % | After Wave % | Detail / Action Per Area | Status |
|---|---:|---:|---|---|
| Real persistence writer (Trust Engine) | 70 | 70 | No action this wave. | 🚀 Hardening |
| Source health classifier (Trust Engine) | 75 | 75 | No action this wave. | 🚀 Hardening |
| API route hardening (Backend) | 60 | 60 | No action this wave. PR #421 module restoration would lift this once landed; Codex UNSAFE keeps it where it is. | 🛠️ Buildout |
| Backend test coverage (Backend) | 42 | 42 | No action this wave. PR #423 adds 2 regression tests but is not merged. | 🧱 Foundation |
| Database migration readiness (Backend) | 5 | 5 | No action this wave. | 🌱 Seed |
| Railway deploy preflight (CI/Release) | 40 | 40 | No action this wave. `delightful-essence` remains stale at PR #359-era; PR #421 build-repair has not landed; Codex UNSAFE blocks progress. | 🧱 Foundation |
| Vercel deploy health (CI/Release) | 60 | 60 | No action this wave. Account block surfaces failing-required-looking statuses on every open PR; not formally gating because branch protection is empty. | 🛠️ Buildout |
| Web quality (CI/Release) | 85 | 85 | No action this wave. PR #422 fixes vitest discovery (Playwright spec exclusion) but CI is downstream-red on the API build until PR #421 lands. | 🚀 Hardening |
| Monorepo CI/CD (CI/Release) | 65 | 65 | No action this wave. Codex SAFE gate held (PR #421 correctly refused merge on UNSAFE verdict). | 🛠️ Buildout |

### Per-PR state transitions

| PR | Title | Highest state reached | Block reason |
|---|---|---|---|
| #420 | preserve NPPES identity success when source payload is intact | PR opened | Vercel checks failing (account block, operator-side); base wave-10a/docs-status doesn't deploy delightful-essence |
| #421 | repair Railway build module resolution | PR opened | Codex UNSAFE on three findings; needs remediation commit + re-audit |
| #422 | exclude Playwright specs from Vitest web quality run | PR opened | Web Quality CI red until #421's helpers land |
| #423 (draft) | align NPPES source_complete truth state on main | PR opened (draft) | Build red until #421's helpers land; not yet Codex-audited |

### Deferred / not in scope (carry-forwards still open)

Same items as Waves B/D/E/F/H section above (Wave B Phase 3d/3e, Phase 2 design-surface work, Wave A leftovers #237/#240/#243/#247, Wave G enterprise hardening). None addressed this wave.

### Next recommended wave (afternoon half, superseded — see evening half below)

`fix/api-railway-build-gap-codex-remediation` — author the three minimal patches Codex requested on PR #421:

1. `multi-tenant/tenantIsolation.ts` — close the open-by-default path for tenant-owned capsules (either by forwarding `requesterTenantId` at every audit-replay call site, or by requiring an explicit internal/system caller flag).
2. `runtimeTrustCohesion.ts::buildRuntimeReplayMetadata` — recompute hashes when a `tenantId` is supplied; only reuse stored hashes with `tenantBound: true` when the stored hash is known to be tenant-bound.
3. `config/loadDotenv.ts` — resolve `.env` from the package root via package metadata or compiled-layout detection, not via fragile `__dirname/../..`.

Re-run Codex three-audit. If SAFE: merge PR #421 → rebase #422 → Codex → merge #422 → mark #423 ready → rebase → Codex → merge #423. Then `delightful-essence` redeploys, SSE smoke confirms NPPES SUCCESS / OIG-PECOS FAILED for NPI 1699264564.

## Wave Batch 2026-05-26 evening — PR #421 + PR #423 MERGED

The evening half of the 2026-05-26 batch closed the merge cascade. Codex was unavailable due to ChatGPT account quota; operator authorized a Local Claude Code audit substitute (no merge-protection hook bypass — the operator explicitly redirected the gate). Both PR #421 and PR #423 cleared local SAFE verdicts and were squash-merged to `main`. `delightful-essence` auto-redeployed from `main` and is now live on PR #421 (`/health` confirms `git_sha:"fe9c6f9c1"`). PR #423's redeploy is in flight.

### Confirmed completed facts (evening half)

- ✅ PR #421 remediation pushed (`8e9aabe55`): three Codex findings fixed (tenant isolation default-closed via new `RequesterAuthority`; tenant-bound replay hashes always recomputed; loadDotenv resolves backend root by `package.json` name in both source and compiled layouts) + 20 focused regression tests.
- ✅ Local Claude Code audit on `8e9aabe55` → SAFE (clean merge sim; security checklist passes; truth/deploy scan clean; build 15/15; tsc clean; lint clean; tests 20/20).
- ✅ PR #421 squash-merged to `main` as `fe9c6f9c12381cb49a9786cb1ff45918e2450cf0` (2026-05-26 20:45:09Z).
- ✅ `pnpm turbo run build --filter @vitalcv/api --force` green on `main` (15/15 PASS, 0 cached, ~15s) — the 7 `TS2307` errors that kept `delightful-essence` stale for ~2 weeks are gone.
- ✅ `api.vitalcv.com/health` returns `status:"ok"`, `git_branch:"main"`, `git_sha:"fe9c6f9c1…"` — PR #421 is **deployed live**.
- ✅ PR #423 rebased onto post-#421 main (head `221dba07b`), validated (build 15/15, ingestOrchestrator 6/6 incl. 2 NPPES regressions, tsc clean, lint clean), `gh pr ready 423` flipped draft → ready.
- ✅ Local Claude Code audit on rebased PR #423 → SAFE on all 11 checklist items (NPPES-only promotion gate, no other source promoted, no migration / env / Railway / DNS / secret mutation, no banned phrases in product copy, banned-phrase docs use only as negative checklist items, build green, focused tests green, merge sim clean).
- ✅ PR #423 squash-merged to `main` as `9f272c80ce842366a4ee43274b6584668c0a9e0c` (2026-05-26 20:53:43Z).
- ✅ `docs/ops/merge-ledger.md` + `docs/ops/api-main-build-smoke.md` updated to record both merges, both audits, the local-substitute pattern, and the operator instruction set.

### NOT yet validated live (carry-forwards)

- ⏳ PR #423 redeploy to `delightful-essence` (Railway should auto-build; `/health` still shows #421 SHA as of last poll at 20:54Z).
- ⏳ Authenticated SSE smoke for NPI 1699264564 — required to confirm NPPES `source_complete` `"status":"SUCCESS"` and OIG/PECOS still `"status":"FAILED"`. Until this passes, NPPES truth-state is **merged + deployed but not validated live**.

### Per-row Current % deltas (evidenced by merges + live deploy)

| Area | Before | After | Δ | Evidence |
|---|---:|---:|---:|---|
| Real persistence writer (Trust Engine) | 70 | 70 | — | No action this wave. TRUST-PERSIST-1 remains the largest board blocker. |
| API route hardening (Backend) | 60 | 70 | +10 | PR #421 merged + deployed; `replayDecision` routes forward tenant scope; `TenantIsolationError` → 403 with violation code. |
| Backend test coverage (Backend) | 42 | 47 | +5 | 20 new focused tests (tenantIsolation/runtimeTrustCohesion/loadDotenv) + 2 new NPPES regression tests merged to `main`. |
| Railway deploy preflight (CI/Release) | 40 | 60 | +20 | `delightful-essence` redeployed from `main` for the first time in ~2 weeks; `/health` returns 200 with modern `git_sha`. |
| Web quality (CI/Release) | 85 | 85 | — | No action this wave. PR #422 still open; dependency now cleared (CI can be re-run). |
| Monorepo CI/CD (CI/Release) | 65 | 65 | — | Merge-protection gate was substituted by Local Claude Code audit this wave at operator instruction; original gate unchanged. |

### 15-dimension view (per operator baseline)

| Dimension | % | Waves left | Δ | Highest state reached | Evidence |
|---|---:|---:|---:|---|---|
| Product Truth Contract | 47 | 13 | +1 / −1 | merged | PR #423 backend NPPES truth-state correction merged as `9f272c80c`. **Not yet validated live** (SSE smoke pending). |
| Core Credentialing Workflow | 29 | 26 | — | planned | No action this wave. |
| Source Integrations / PSV | 18 | 40 | — | merged (emission only) | NPPES emission semantics tightened via #423; no new PSV integration. |
| Backend / API Reliability | 28 | 29 | +4 / −3 | **deployed live** | PR #421 merged + deployed; 3 Codex correctness fixes; 20 regression tests; `/health` confirms; module-resolution gap closed. |
| Database / Persistence Layer | 16 | 40 | — | planned | No action this wave. **Now the largest single board blocker.** |
| Trust / Proof / Receipts | 33 | 27 | +2 / −2 | **deployed live** | Tenant isolation hardened + hash recompute on tenant-bound replays (#421); deployed live in `delightful-essence`. |
| Frontend UX / Role Journeys | 35 | 24 | — | merged + deployed | No action this wave (prior waves landed). |
| Sign-up / Auth / Onboarding | 22 | 28 | — | planned | No action this wave. |
| Interoperability / Standards | 26 | 34 | — | planned | No action this wave. |
| Demo / Sales Conversion | 24 | 32 | — | planned | No action this wave. |
| Deployment / DevOps | 28 | 28 | +5 / −3 | **deployed live** | `delightful-essence` cleared from PR #359-era stale state; `/health` confirms modern git_sha; 2-week deployment gap resolved. |
| Testing / CI / Quality Gates | 31 | 26 | +2 / −2 | merged | 22 new tests landed on `main` (3 Codex regression files + 2 NPPES regressions). |
| Self-Improving System / Agents | 13 | 50 | — | planned | No action this wave. |
| Business / GTM / Revenue Engine | 17 | 50 | — | planned | No action this wave. |
| **Overall Billion-Dollar Readiness** | **25** | **397** | **+1 / −7** | mixed | Weighted aggregate. Five sub-rows moved on merge+deploy; the rest unchanged. |

### Per-PR state transitions (evening half)

| PR | State | Note |
|---|---|---|
| #420 | open | Deployment path is now via #423 (transplant); #420 itself can stay open against `wave-10a/docs-status` or be closed as superseded — operator call. |
| #421 | **MERGED** `fe9c6f9c1`, **DEPLOYED** to `delightful-essence` | Local audit SAFE; Codex unavailable, operator-authorized substitute. |
| #422 | open | Dependency on #421 cleared; CI can be re-triggered, audited, merged. |
| #423 | **MERGED** `9f272c80c` | Deploy queued; SSE smoke pending. |
| #424 | open | Tracking docs PR; extended this wave with updated ledgers. |

### Next recommended wave (post-evening-half — superseded by 2026-05-27 update below)

1. **Poll `https://api.vitalcv.com/health` until `git_sha` flips to `9f272c80c…`** (or trigger Railway manual redeploy in `inspiring-reflection` if Railway is sleeping).
2. **Run authenticated SSE smoke for NPI 1699264564** — this is the live validation that will move Product Truth Contract from "merged" to "validated live".
3. **PR #422 reactivation** — re-trigger Web Quality CI now that `main` builds; if green, run local audit + merge.
4. **Open TRUST-PERSIST-1 scoping wave** — Database / Persistence Layer at 16% / 40 waves is now the largest single board bottleneck.

## Convergence update 2026-05-27 — PR #423 confirmed deployed live; SSE smoke still pending

### Confirmed completed facts (since evening half)

- ✅ `api.vitalcv.com/health` polled 2026-05-27 03:18Z: `status:"ok"`, `git_branch:"main"`, `git_sha:"9f272c80ce842366a4ee43274b6584668c0a9e0c"`. PR #423 is deployed live on `delightful-essence`.
- ✅ Operator-safe authenticated SSE smoke runbook drafted (`docs/ops/authenticated-sse-smoke-runbook.md`) — no credentials surfaced, browser-first path.
- ✅ NPPES source-health next-wave spec drafted (`docs/ops/nppes-source-health-next-wave.md`) — 8-task observability moat, no truth-state behavior change.
- ✅ Main-branch convergence snapshot drafted (`docs/ops/main-convergence-snapshot.md`) — split-branch reality recorded (`delightful-essence` watches `main`; `vitalcv-web` watches `wave-10a/docs-status`).

### Still pending live validation

- ⏳ **Authenticated SSE smoke** for NPI 1699264564 against `api.vitalcv.com`. Until this fires, NPPES truth-state is "deployed" but not "validated live". The smoke is an operator-side step (signed-in browser); no agent can run it without surfacing credentials.
- ⏳ **OIG / LEIE / PECOS / STATE_BOARD / FSMB / NURSYS** are not connected to live upstream services. PR #423 explicitly does **not** promote them; they remain `FAILED`.
- ⏳ **NPPES source operational reliability** — separate observability moat (Wave D's spec).

### 15-dimension view (operator baseline 2026-05-27 — applied)

| Dimension | % | Waves left | Δ vs prior | Highest state reached | Why this number |
|---|---:|---:|---|---|---|
| Product Truth Contract | **48** | **12** | +1 % / −1 wave | merged + deployed | PR #423 deployed live (`/health` confirms `git_sha`); behavior not yet validated via authenticated SSE smoke. Move beyond 48% gated on smoke result. |
| Core Credentialing Workflow | **30** | **25** | +1 % / −1 wave | planned | Minor uplift on aggregate hardening; no specific credentialing surface changed this wave. |
| Source Integrations / PSV | **18** | **40** | — | planned | **Held at 18%** per operator instruction. SSE smoke unconfirmed; do not raise until live NPPES SUCCESS is observed. |
| Backend / API Reliability | **30** | **26** | +1 % / −1 wave (post-Browser-verify) | **deployed live** | PR #421 + #423 both confirmed live by Browser (Wave 21). 12 requests / 0 errors / p90 73ms / fresh container. Railway active row subject contains `(#423)`; PR #421 deployment in REMOVED state (correctly superseded). |
| Database / Persistence Layer | **16** | **40** | — | planned | Unchanged. **Largest single board blocker.** |
| Trust / Proof / Receipts | **32** | **27** | −1 % vs prior (corrected) | merged + deployed | Pulled back 1% from prior 33% (over-credited tenant isolation without live truth-state SSE proof). Tenant isolation is deployed live; replay receipts behavior not yet exercised against live SSE. |
| Frontend UX / Role Journeys | **35** | **24** | — | merged + deployed | No action this wave. |
| Sign-up / Auth / Onboarding | **22** | **28** | — | planned | **Held at 22%** per operator instruction. |
| Interoperability / Standards | **26** | **34** | — | planned | No action this wave. |
| Demo / Sales Conversion | **24** | **32** | — | planned | **Held at 24%** per operator instruction. No GTM movement. |
| Deployment / DevOps | **29** | **25** | +1 % / −1 wave (post-Browser-verify) | **deployed live** | Browser-side independent verification (Wave 21) of Railway active deployment subject + cache-busted `/health` probe — both signals agree on `(#423)` / `9f272c80c…`. Railway pipeline now demonstrably handles main-watching auto-redeploy cleanly across 3 consecutive merges (#421 → #423, with #422 not impacting API). |
| Testing / CI / Quality Gates | **31** | **26** | +1 % vs new baseline / −1 wave | merged | PR #422 (vitest exclude) merged as `801100c7f` on 2026-05-27 03:28:22Z. Playwright/Vitest collision is gone on `main`; 5–6 pre-existing `__tests__/` failures now surfaced — opens a triage wave but not a regression. 22 + 1 (one-line CI config) tests/configs landed. |
| Self-Improving System / Agents | **14** | **49** | +1 % / −1 wave | planned | Local Claude Code audit pattern hardened across two PRs (#421 + #423); the substitute gate worked. |
| Business / GTM / Revenue Engine | **17** | **50** | — | planned | No action this wave. |
| **Overall Billion-Dollar Readiness** | **27** | **392** | +1 % / −2 waves (post-Browser-verify) | mixed | Weighted aggregate; Browser-confirmed deployment moves Backend/API + Deployment/DevOps; still capped by SSE smoke pending. |

## 2026-05-27 evening — visual-system Phase 1 deltas (PR #425 + PR #426 opened)

Per operator rules: design docs alone raise UX/Design **slightly only if implementation-ready**; UI implementation raises UX **only when committed and tested**. Source Integrations / Auth / Business / GTM held pending live behavior validation.

| Dimension | % | Waves left | Δ this batch | Highest state | Why |
|---|---:|---:|---:|---|---|
| Product Truth Contract | **48** | **12** | — | merged + deployed | No new SSE evidence (AUTH BLOCKED held). Wave G's banned-strings regression test strengthens the contract but does not move the % alone. |
| Core Credentialing Workflow | **30** | **25** | — | planned | No workflow change. |
| Source Integrations / PSV | **18** | **40** | — | planned | **Held** per operator instruction — SSE smoke not yet validated live. |
| Backend / API Reliability | **30** | **26** | — | deployed live | No backend touched. |
| Database / Persistence Layer | **16** | **40** | — | planned | Unchanged. Still the largest single board blocker. |
| Trust / Proof / Receipts | **33** | **26** | +1 % / −1 wave | merged (chip foundation) | TruthStateChip is the canonical visual that surfaces trust/proof signals; PR #425 ships the foundation, committed + tested 19/19. Bumped 1 percentage point per operator rule for "TruthStateChip merged/tested: Trust/Proof +1". |
| Frontend UX / Role Journeys | **37** | **22** | +2 % / −2 waves | merged (chip foundation) + docs | PR #425 chip foundation merged-readiness + tested (19/19 pass). PR #426 design system docs (6 files, implementation-ready spec). Operator rule allows +1 for visual docs + +1 for TruthStateChip merged/tested. |
| Sign-up / Auth / Onboarding | **22** | **28** | — | planned | **Held** per operator instruction — Wave J not yet implemented. |
| Interoperability / Standards | **27** | **33** | +1 % / −1 wave | docs (implementation-ready) | Visual docs include receipt-document layout for `/status` Connector Matrix and `/trust/attribution` register, both interop-facing. Operator rule allows +1 for visual docs only when implementation-ready (Wave K is scoped with concrete recipe). |
| Demo / Sales Conversion | **24** | **32** | — | planned | **Held** per operator instruction — homepage / role-doors / persona surface upgrades pending. |
| Deployment / DevOps | **29** | **25** | — | deployed live | No deploy change this batch. |
| Testing / CI / Quality Gates | **32** | **25** | +1 % / −1 wave | merged | 19 new vitest cases for chip (banned-strings regex, variant pinning, source-label aria contract, timestamp hidden `<time>`, full legend round-trip). All pass. |
| Self-Improving System / Agents | **14** | **49** | — | planned | No agents work. |
| Business / GTM / Revenue Engine | **17** | **50** | — | planned | **Held** per operator instruction — no GTM movement this batch. |
| **Overall Billion-Dollar Readiness** | **28** | **388** | +1 % / −4 waves | mixed | Weighted aggregate; reflects the +2 on Frontend UX, +1 on Trust/Proof, +1 on Testing/CI, +1 on Interop. Still capped by SSE smoke pending and Database/Persistence stagnation. |

### Per-PR state transitions (this batch)

| PR | State | Note |
|---|---|---|
| #425 | 🚢 MERGED `a368a1ffb` | Wave G — TruthStateChip + Legend + 19 tests. Local audit SAFE on 2026-05-26 22:23 PDT; merged 22:24 PDT. |
| #426 | 🚢 MERGED `a88e014e4` | Wave M — 6 design docs. Local audit SAFE on 2026-05-26 22:24 PDT; merged 22:25 PDT. |
| #424 | 🚢 MERGED `50942ad1e` | Tracking — 8 docs in `docs/ops/`. Local audit SAFE on 2026-05-26 22:25 PDT; merged 22:26 PDT. |

### Carry-overs (full list)

See `docs/ops/wave-ledger.md` "Carry-overs to next batch" — most notable: PR #425 + PR #426 audit + merge; Wave H (Passport) is the next coding wave once #425 lands; authenticated SSE smoke remains the largest single move on Product Truth Contract.

### Next highest-leverage bottleneck (re-affirmed)

**Database / Persistence Layer (16% / 40 waves)** — TRUST-PERSIST-1 cutover. The visual system upgrade does not move this dimension at all; it remains the largest single board blocker.

**Closest-to-done bottleneck:** authenticated SSE smoke for NPI 1699264564 (operator browser session required). One operator action moves Product Truth Contract → "validated live" and unlocks Source Integrations / PSV from its 18% hold.

### Per-PR state transitions (since evening half)

| PR | State | Note |
|---|---|---|
| #420 | open | Superseded by #423 transplant; operator decision whether to close. |
| #421 | **MERGED + DEPLOYED LIVE** | `git_sha` confirmed on `/health`. |
| #422 | **MERGED** `801100c7f` | Local audit SAFE on 2026-05-27; merged at 03:28Z. |
| #423 | **MERGED + DEPLOYED LIVE (Browser-confirmed Wave 21)** | Railway active row subject contains `(#423)`, `/health` SHA matches, 12 req / 0 err / p90 73ms. Behavior validation (SSE smoke) still pending. |
| #424 | open | Tracking PR; this update lives on its branch. |

### Next recommended wave

1. **Operator runs `docs/ops/authenticated-sse-smoke-runbook.md`** against `api.vitalcv.com` for NPI 1699264564. Two-minute task; gates Product Truth Contract → "validated live".
2. ~~PR #422 audit + merge~~ ✅ **DONE** — merged as `801100c7f` on 2026-05-27 03:28Z.
3. **Open `fix/nppes-source-health-observability`** as the next coding wave — Wave D's task 1 (adapter trace logging) + task 3 (NPPES failure taxonomy) bundled as the smallest combined increment.
4. **TRUST-PERSIST-1 scoping** — Database / Persistence Layer at 16% / 40 waves is the largest single board bottleneck; still open.
5. **`__tests__/` drift cleanup wave** — 5–6 pre-existing Vitest failures now surfaced on `main` after PR #422 made the CI path actually reachable. Worth opening a triage wave: `wave1-external-pilot-flow`, `status-page-compliance-evidence`, `foundation-sweep-6-analytics-status`, `foundation-sweep-6-commercial`, `passport-ingest-page`, `review-page-contract`. Not regressions caused by PR #422.

## 2026-05-26 22:26 PDT — visual-system Phase 1 cascade MERGED

🚢 #425 + 🚢 #426 + 🚢 #424 all merged through local Claude Code audit gate (Codex disabled per operator instruction). Post-cascade `main` is `50942ad1e`. No deployment redeploy required — these are frontend + docs-only changes; `delightful-essence` API stays at `9f272c80c…`.

### Confirmed completed facts (cascade)

- 🧪 PR #425 audit (Wave A): SAFE. 5 files, +770/0; 19/19 vitest pass; tsc clean; build 13/13; lint clean; banned-copy scan clean (all hits in negative-example sections).
- 🚢 PR #425 merged as `a368a1ffb` at 2026-05-26 22:24 PDT (05:24Z).
- 🧪 PR #426 audit: SAFE. 6 docs files; merge sim clean against post-#425 main; banned phrases only in "avoid"/"risk" enumeration per operator allowance.
- 🚢 PR #426 merged as `a88e014e4` at 2026-05-26 22:25 PDT (05:25Z).
- 🧪 PR #424 audit: SAFE. 8 docs files in `docs/ops/`; merge sim clean against post-#426 main; banned phrases only in pre-existing files documenting banned lists.
- 🚢 PR #424 merged as `50942ad1e` at 2026-05-26 22:26 PDT (05:26Z).

### Per-row Current % deltas (post-cascade)

Operator rule recap: percentages only move on "completed, committed, tested, merged or validated work". PR #425 + #426 merges were already counted as "merged/tested" in the prior evening-half move. The cascade merging into main does not retroactively unlock further movement — those PRs' percentage credit was already booked at "open + tested" per the operator-supplied "TruthStateChip merged/tested" and "Visual docs only" rules.

Verdict: **no further percentage moves from the cascade alone.** Baseline holds.

| Dimension | % | Waves left | Δ vs prior | State emoji | Note |
|---|---:|---:|---|---|---|
| Product Truth Contract | **48** | **12** | — | 🚢 merged + deployed; 🔴 SSE blocked | Banned-phrase contract now enforced by chip tests in `main` CI. Same numeric position. |
| Core Credentialing Workflow | **30** | **25** | — | 🟡 planned | No workflow change. |
| Source Integrations / PSV | **18** | **40** | — | 🔴 SSE-blocked | Held per rule — SSE behavior unvalidated. |
| Backend / API Reliability | **30** | **26** | — | 🚢 deployed live | No backend touched in this cascade. |
| Database / Persistence Layer | **16** | **40** | — | 🟡 planned | Largest single bottleneck. |
| Trust / Proof / Receipts | **33** | **26** | — | 🚢 merged | Chip foundation already credited. |
| Frontend UX / Role Journeys | **37** | **22** | — | 🎨 🚢 merged | Cascade lands the bookings made when PRs opened. |
| Sign-up / Auth / Onboarding | **22** | **28** | — | 🟡 planned | Held — Wave J not implemented. |
| Interoperability / Standards | **27** | **33** | — | 🎨 merged | Visual docs landed. |
| Demo / Sales Conversion | **24** | **32** | — | 🟡 planned | Held — no GTM movement. |
| Deployment / DevOps | **29** | **25** | — | 🚢 deployed live | No deploy change. |
| Testing / CI / Quality Gates | **32** | **25** | — | 🧪 merged | 19 chip regression tests now on `main`. |
| Self-Improving System / Agents | **15** | **48** | +1 % / −1 wave | 🤖 🚢 SOP merged | PR #428 (Agent Operating SOP) merged 2026-05-27 04:26 PDT as `97971b578`. Three SOP docs codify the semi-autonomous wave execution pattern, 20-task wave batch template, AI tool routing matrix. Per operator rule "Agent SOP merged: Self-Improving Agents +1". |
| Business / GTM / Revenue Engine | **17** | **50** | — | 🟡 planned | Held. |
| **Overall Billion-Dollar Readiness** | **28** | **388** | — | 🧱 mixed | No retroactive aggregate move. |

### Next highest-leverage bottleneck (unchanged)

**Database / Persistence Layer (16% / 40 waves)** — TRUST-PERSIST-1 cutover; largest single board blocker.

**Closest-to-done bottleneck** (still): authenticated SSE smoke for NPI 1699264564 — one operator action gates Product Truth Contract → "validated live" and unlocks Source Integrations / PSV from its 18% hold.

### Carry-overs for next batch

- 🟡 Authenticated SSE smoke (operator-only).
- 🎨 Wave H — Passport calm-degradation integration. **Now unblocked** by #425 + #426 on `main`. Recommended next coding wave.
- 🎨 Wave I — Homepage NPI-first + role doors. Can ship in parallel with Wave J.
- 🔐 Wave J — Sign-in / sign-up calm disclosure card.
- 🎨 Wave K — `/status` + `/trust/attribution` receipt registers.
- 🧱 `fix/nppes-source-health-observability` — observability moat (Wave D's task 1 + task 3 bundle).
- 🧱 Web `/api/health` `backend.status:"degraded"` classifier inspection.
- 🧱 `__tests__/` drift cleanup (5–6 pre-existing failures surfaced by PR #422).
- 🧱 `_archive/` sweep (delete dead routes carrying legacy banned phrases).
- Operator: `CRON_SECRET` config to fix failing scheduled workflows.

### Wave-ledger note

Waves 26 (PR #425 audit), 27 (PR #425 merge), 28 (PR #426 audit + merge), 29 (PR #424 audit + merge) — appended to `docs/ops/wave-ledger.md` in this batch.

## 2026-05-27 04:27 PDT — Agent Operating SOP landed

🚢 PR #428 (`docs(ops): define VitalCV agent operating SOP`) merged as `97971b5780e7ccb0f58af19a5062796cc7f930a6` at 2026-05-27 11:26:55Z (= 04:26 PDT). Three new docs codify the semi-autonomous wave execution pattern for every AI tool that touches VitalCV:

- `docs/ops/agent-operating-sop.md` — the doctrine (10 sections).
- `docs/ops/wave-batch-template.md` — the 20-task wave batch template + per-task audit checklist + 5-class verdict taxonomy + worked example.
- `docs/ops/ai-tool-routing.md` — tool routing matrix with per-task table, hard prohibitions per tool, default ordering when ambiguous, Codex re-enable procedure.

### Per-row delta (post-#428)

| Dimension | % | Waves left | Δ | State | Note |
|---|---:|---:|---|---|---|
| Self-Improving System / Agents | **15** | **48** | +1 % / −1 wave | 🤖 🚢 merged | SOP codifies the local-audit-as-merge-gate pattern that produced 3 SAFE verdicts last batch. |
| Overall Billion-Dollar Readiness | **28** | **387** | — % / −1 wave | 🧱 mixed | Aggregate; Self-Improving Agents +1 closes 1 wave. |

All other dimensions unchanged — the SOP is a meta-doc, not a product surface; no product-truth-contract, deploy, or persistence move.

### `main` head after #428

```
97971b578 docs(ops): define VitalCV agent operating SOP (#428)
50942ad1e docs(ops): wave batch 2026-05-26 — merge ledger, main build smoke, completion board (#424)
a88e014e4 docs(design): define VitalCV visual system and screen language (#426)
a368a1ffb feat(web): add TruthStateChip + TruthStateLegend visual foundation (#425)
801100c7f fix(test): exclude Playwright specs from Vitest web quality run (#422)
9f272c80c fix(api): align NPPES source_complete truth state on main (#423)
fe9c6f9c1 fix(api): repair Railway build module resolution (#421)
```

### Next Direction (post-#428)

A) **Wave H — Passport calm-degradation integration** (`feat/passport-calm-degradation`). Now unblocked by #425 + #426 on `main`. Recipe in `docs/design/screen-composition-spec.md` lines 33–66.
B) **Authenticated SSE smoke for NPI 1699264564** (operator-only, per `docs/ops/authenticated-sse-smoke-runbook.md`). Gates Product Truth Contract → "validated live"; releases the 18% hold on Source Integrations / PSV.
C) **Wave I — Homepage NPI-first + role doors** (`feat/home-npi-role-doors`). Can ship in parallel with Wave J (zero shared files).
D) **Operator hygiene** — configure `CRON_SECRET` repo secret to fix the two failing scheduled health-probe workflows; optional `_archive/` sweep to remove legacy banned-phrase routes.
E) **Continue to next task / next wave batch.**

## 2026-05-28 21:46 PDT — Wave H → K visual-system cascade MERGED

Four PRs through Local Claude Code audit (Codex disabled per operator instruction). Same pattern that produced 4 SAFE verdicts the prior turn: one focused implementation per turn, full validation, audit, merge.

### Confirmed completed facts

- 🚢 🎨 **PR #429** `feat(web): calm degraded passport truth states` merged as `5b0e78c7e` (2026-05-27 04:56 PDT). Local audit SAFE; 12 vitest cases; build 13/13. Adds `PassportTruthStateBanner` (degraded header + 5-row legend + institution review boundary); replaces "Checking in the background" skeleton-style line with canonical system-condition copy.
- 🚢 🎨 **PR #430** `feat(web): make homepage NPI-first with role doors` merged as `f7b5b367a` (2026-05-27 05:09 PDT). Local audit SAFE; 11 vitest cases; build 13/13. Hero "Look up an NPI." + 4 role doors (Verifier/Clinician/Employer/Issuer) + 3-col proof strip + trust footer row.
- 🚢 🔐 **PR #434** `feat(web): clarify auth gate with calm sign-in surfaces` merged as `3f5afc622` (2026-05-28 21:33 PDT). Local audit SAFE; 14 vitest cases; build 13/13. New `AuthDisclosureCard` wraps Clerk `<SignIn />` and `<SignUp />` with canonical disclosure copy + trust footer; sign-up's prior emerald/zinc Clerk appearance overrides dropped.
- 🚢 🎨 **PR #435** `feat(web): render status and attribution as receipt registers` merged as `e7b4e7e6c` (2026-05-28 21:40 PDT). Local audit SAFE; 16 vitest cases; build 13/13. New `ConnectorMatrix` (6 rows) on `/status` + new `/trust/attribution` page with `TrustAttributionRegister` (9 rows); canonical disclaimer surfaced; OIG/LEIE/PECOS/FSMB/Nursys all `connector-not-live`; state board `access-required`.

### Per-row Current % deltas (post-cascade)

Per operator-supplied rules for this batch:

- **Passport visual upgrade merged + tested:** Core Workflow +1, Frontend UX +1.
- **Homepage role doors merged + tested:** Frontend UX +1, Demo/Sales +1.
- **Auth disclosure merged + tested:** Auth/Onboarding +1.
- **Status/Attribution merged + tested:** Trust/Proof +1, Interop +1.

| Dimension | Before | After | Δ | State | Why |
|---|---:|---:|---|---|---|
| Product Truth Contract | 48 / 12 | **48 / 12** | — | 🚢 deployed; 🔴 SSE blocked | No new SSE evidence. Held. |
| Core Credentialing Workflow | 30 / 25 | **31 / 24** | +1 % / −1 wave | 🚢 merged | Passport calm degradation (#429) lands the canonical truth-state vocabulary on the hottest unauthenticated surface. |
| Source Integrations / PSV | 18 / 40 | **18 / 40** | — | 🔴 SSE-blocked | Held per rule — SSE behavior unvalidated. |
| Backend / API Reliability | 30 / 26 | **30 / 26** | — | 🚢 deployed live | No backend touched in this cascade. |
| Database / Persistence Layer | 16 / 40 | **16 / 40** | — | 🟡 planned | Unchanged. Still largest single board blocker. |
| Trust / Proof / Receipts | 33 / 26 | **34 / 25** | +1 % / −1 wave | 🚢 merged | Status Connector Matrix + per-field Attribution Register (#435) make trust attribution publicly inspectable. |
| Frontend UX / Role Journeys | 37 / 22 | **39 / 20** | +2 % / −2 waves | 🎨 🚢 merged | Passport (#429) + Homepage (#430) both shipped tested. |
| Sign-up / Auth / Onboarding | 22 / 28 | **23 / 27** | +1 % / −1 wave | 🔐 🚢 merged | Auth calm disclosure (#434) — the Auth-rule exception is satisfied (real UI/flow change). |
| Interoperability / Standards | 27 / 33 | **28 / 32** | +1 % / −1 wave | 🚢 merged | `/trust/attribution` receipt register (#435) makes per-field source attribution machine-readable from `/status`'s well-known endpoints. |
| Demo / Sales Conversion | 24 / 32 | **25 / 31** | +1 % / −1 wave | 🚢 merged | Homepage NPI-first + role doors (#430) — operator rule explicitly allows +1 here. |
| Deployment / DevOps | 29 / 25 | **29 / 25** | — | 🚢 deployed live | No deploy change. |
| Testing / CI / Quality Gates | 32 / 25 | **33 / 24** | +1 % / −1 wave | 🧪 🚢 merged | 53 new vitest cases landed across this cascade (12+11+14+16). |
| Self-Improving System / Agents | 15 / 48 | **15 / 48** | — | 🟡 planned | No SOP / agent work this batch. |
| Business / GTM / Revenue Engine | 17 / 50 | **17 / 50** | — | 🟡 planned | Held per rule — no pilot work. |
| **Overall Billion-Dollar Readiness** | **28 / 387** | **29 / 380** | +1 % / −7 waves | 🧱 mixed | Weighted aggregate. Seven sub-row wave-closures. Still capped by SSE smoke pending and Database/Persistence stagnation. |

### Per-PR state transitions (this batch)

| PR | State | Note |
|---|---|---|
| #429 | 🚢 MERGED `5b0e78c7e` | Wave H — Passport calm-degradation. |
| #430 | 🚢 MERGED `f7b5b367a` | Wave I — Homepage NPI-first + role doors. |
| #432 | 🚢 MERGED `5a6ac229f` | Truth-contract copy restore (other-agent flow). Not credited to operator-rule Δ list. |
| #433 | 🚢 MERGED `f9049d258` | /passport completed-without-anchor + /status restore (other-agent flow). Not credited to operator-rule Δ list. |
| #434 | 🚢 MERGED `3f5afc622` | Wave J — Auth calm disclosure. |
| #435 | 🚢 MERGED `e7b4e7e6c` | Wave K — Status Connector Matrix + /trust/attribution receipt register. |

### Next highest-leverage bottleneck (unchanged)

**Database / Persistence Layer (16% / 40 waves)** — TRUST-PERSIST-1 cutover; largest single board blocker.

**Closest-to-done bottleneck** (still): authenticated SSE smoke for NPI 1699264564 — one operator action gates Product Truth Contract → "validated live" and unlocks Source Integrations / PSV from its 18% hold.

### Carry-overs for next batch

- 🟡 Authenticated SSE smoke (operator-only).
- 🌐 Browser visual QA of the merged Homepage / Passport / Auth / Status / Attribution surfaces.
- 🧱 `fix/nppes-source-health-observability` — next coding wave (Wave D's task 1 + task 3 bundle).
- 🧱 Web `/api/health` `backend.status:"degraded"` classifier inspection.
- 🧱 `_archive/` sweep (delete dead routes carrying legacy banned phrases in grep scans).
- Operator: `CRON_SECRET` config to fix failing scheduled workflows.
- 🧱 `__tests__/` drift cleanup (5–6 pre-existing failures surfaced by PR #422).

### Next Direction

A) **Authenticated SSE smoke** for NPI 1699264564 (operator-only). Biggest single percentage move; gates Product Truth Contract → "validated live".
B) **Browser visual QA** of the freshly-merged Homepage / Passport / Auth / Status / Attribution surfaces. Closes the design-quality feedback loop on what just shipped.
C) **`fix/nppes-source-health-observability`** — first coding wave outside the visual-system arc; observability moat for NPPES (Wave D task 1 + task 3 bundle).
D) **TRUST-PERSIST-1 scoping** — Database / Persistence Layer at 16% / 40 waves is the largest single board bottleneck.
E) **Continue to next task / next wave batch.**

## 2026-07-04 — BOARD-RECONCILE-1 (docs-only): tables re-synced to `origin/main`

The board header had been frozen at 2026-05-28 (`main` head `97971b578`, ledger stop #435) while `main` advanced to `0a90df9856f4397b8c809d1d9ef15453d29207c3` (#544). This wave is **docs-only** — no product code — and moves numbers strictly per the standing rule: merged evidence only, PR # + SHA cited per row, no row above 90.

**Evidence window:** `git log e7b4e7e6c..0a90df985` = 100 commits, PRs #436–#544 plus late-merged #279. Every SHA below resolved from `origin/main` at reconcile time. Live checks: `api.vitalcv.com/health` → `git_sha:"0a90df985…"` (main tip); `vitalcv.com/api/version` → 200.

Two evidence classes were applied:

### Class R — the board's own recorded-but-unapplied deltas (pre-2026-05-28)

The Wave A / B/D/E/F/H appendix ledgers (2026-05-05 → 05-07, above) recorded these moves, but the BOARD-SCHEMA-3 top tables were never re-synced — leaving contradictions like "No published ASVS scorecard" while `docs/security/asvs-scorecard.md` sat on `main` since #227. Applied now:

| Row | Before | After | Evidence |
|---|---:|---:|---|
| OWASP ASVS baseline | 15 | 40 | #227 `52e0a111c` — L1 scorecard at `docs/security/asvs-scorecard.md` (on main today; REBASELINE-confirmed). L2 open (launch-blockers #5). |
| Security headers / secure defaults | 35 | 75 | #226 `a27d4d522` header baseline + tests; #536 `ccef8a656` closed the Clerk-domain CSP gap it missed. |
| Secrets / env handling | 30 | 70 | #228 `e2a241117` typed env contract; backend Zod env REBASELINE-confirmed. |
| WCAG 2.2 AA baseline | 25 | 60 | #229 `5cee8879d` + #232 `92af696f8`; `.github/workflows/a11y-gate.yml` in CI. Held below the ledger's 80: gate scope is hero routes; known-violations register open. |
| Contrast | 35 | 45 | #232 `92af696f8` axe contrast checks on hero routes. |
| Real persistence writer | 5 | 70 | #221 `ded7a0e1a`; #255 `3dfac77cc`; #256 `daf11c0dd`; #257 `184e94fe8`; #258 `5d28a95d3`. Flag default-off (`issuerPersistenceWriter.ts`). |
| PSV receipt promotion | 70 | 80 | #258 `5d28a95d3` (per Wave B ledger). |
| Reuse / revocation / supersession boundary | 75 | 80 | #235 `b61d60da6` (per Wave A ledger). |
| Source health classifier | 65 | 75 | #252 `08781510c`; #261 `71a9d0682` (per Wave A/H ledgers). |
| Verifier worklist | 48 | 60 | #253 `8e5b6f40d` — DB-backed reads confirmed in `worklistRepo.ts` (`prisma.receiptCandidate.findMany`); `worklist.ts` vocabulary literal `dbBackedWorklist: false` is stale and tracked. |
| Legal pages | 60 | 70 | #242 `91f162b57` DPA + cookie policy + footer. |
| API route hardening (R portion) | 32 | — | #234 `e92396d62`; #421 `fe9c6f9c1` (combined with Class N below → 65). |
| Backend test coverage (R portion) | 42 | — | #421 `fe9c6f9c1` (+20), #423 `9f272c80c` (+2) (combined with Class N below → 55). |
| Sales / pilot collateral (R portion) | 25 | — | #259 `f63b222f1`; #260 `404cd8bd0`; #262 `c24ef7451` (combined with Class N below → 45). |

### Class N — the #436–#544 window

| Row | Before | After | Evidence |
|---|---:|---:|---|
| Signup / account creation | 10 | 45 | #475 `804e66a69`; #538 `f7bdbe158`; #539 `9d7b00f87`; #542 `f11df24ff`. `accountCreationProductionReady: false` caps it. |
| Login / account recovery | 10 | 35 | #536 `ccef8a656`; #503 `e1efaf04b`; #507 `d57196d71`; #504 `1d996c49a`. No recovery flow; OAuth unconfirmed (launch-blockers #3). |
| NPI check | 65 | 75 | #541 `d1dbe7960` NPPES v2.1 boot assertion; #475 `804e66a69`. |
| Rich clinician profile shell | 75 | 80 | #476 `73ea7baf4`; #496 `84ecd6bcc`. |
| Identity / contact / locations | 55 | 65 | #495 `3dcc3c598`; #496 `84ecd6bcc`. |
| Training programs | 20 | 30 | #447 `aa3b8b825`. |
| Affiliations | 20 | 28 | #447 `aa3b8b825`. |
| Career goals / preferences | 25 | 55 | #519 `222fe1ffb`; #534 `5838348ca` (migration pending deploy); #533 `bbf5c4c71`. |
| Career intelligence layer (MATCHA) | — (new row) | 55 | #518 `6e8e0a7dc`; #520 `8953ccda3`; #532 `5c23ce2fb`; #535 `329bf7964` (GA default-on in `features.ts`). Truth-contract refusals preserved. |
| Profile completion score | 40 | 50 | #496 `84ecd6bcc`. |
| Clinician-facing value dashboard | 30 | 65 | #516 `16fee8520`; #521 `7f219a552`; #531 `449bdbae1`; #529 `532c81fab`. |
| Native iOS app / Native Android app | 25 / 25 | 30 / 30 | `apps/mobile` wallet service layer + tests, REBASELINE-confirmed on-disk (#541 `d1dbe7960`). No store app. |
| Push notification readiness | 0 | 10 | `NotificationService.ts` in `apps/mobile` (#541 `d1dbe7960` verification). |
| Offline / degraded-state handling | 25 | 32 | `OfflinePresentationEngine` + BLE `OfflineRadar` (REBASELINE §4, #541 `d1dbe7960`). |
| Clinician-to-NPI binding | 28 | 50 | #475 `804e66a69`; #538 `f7bdbe158`; #539 `9d7b00f87`; #542 `f11df24ff`. `identityProofingComplete: false` caps it. |
| Identity proofing policy | 25 | 35 | #539 `9d7b00f87`; #542 `f11df24ff`. |
| Session security | 20 | 35 | #504 `1d996c49a`; #503 `e1efaf04b`; #536 `ccef8a656`. |
| Mobile accessibility | 15 | 22 | #445 `187b24378`; #452 `2280cb53e`. |
| Export bundle | 25 | 35 | #444 `c8df66f93` Career Packet + export-packet route/tests. |
| Shareable passport | 35 | 55 | #487 `2f967fb02`; #490 `ddf9c0141`; #511 `1b4038232`. |
| Knowledge graph data model | 75 | 80 | #460 `4f790c128`. |
| Roam/Obsidian-style visual graph UX | 22 | 55 | #528 `c227c2b87`; #529 `532c81fab`. |
| Graph search | 10 | 25 | #448 `781998c1b`. |
| Graph filtering | 10 | 20 | #528 `c227c2b87` (time scrub only). |
| Clinician-facing graph explanation | 35 | 45 | #461 `0540001b4`; #528 `c227c2b87`. |
| Employer review | 60 | 70 | REBASELINE-confirmed audit-first accept; #498 `81722c1dd`; #544 `0a90df985`. |
| Team / org roles | 28 | 40 | #544 `0a90df985` shadow-first RBAC gate; `rbacEnforced: false` still pinned (launch-blockers #2). |
| Employer CTA / conversion path | 40 | 55 | #522 `412b5c262`; #524 `6e9ab7a72`; #527 `c053c96d0`. |
| Audit replay | 18 | 30 | REBASELINE-confirmed in-transaction `AuditEvent`; #539 `9d7b00f87`. |
| Export API | 15 | 25 | #451 `6a1b484b0`. |
| Backend test coverage | 42 | 55 | Class R + #497 `5dde02695`; #542 `f11df24ff` (otpCore). |
| API route hardening | 32 | 65 | Class R + #500 `095e29ba5`; #501 `0215b1f2c`; #504 `1d996c49a`. |
| Database migration readiness | 5 | 45 | Migrations on main incl. 2026-07-04 trio (#534 `5838348ca`, #539 `9d7b00f87`, #542 `f11df24ff`); Railway Postgres runtime. `migrate deploy` for the trio is founder-gated. |
| Self-serve signup | 32 | 45 | #538 `f7bdbe158`; #539 `9d7b00f87`; #542 `f11df24ff`. Literals still `false`. |
| Onboarding | 38 | 55 | #475 `804e66a69`; #519 `222fe1ffb`; #526 `403c478af`. |
| Support / admin | 25 | 40 | #469 `9c4c49c8d` Ops Center V1. |
| Docs / status page | 55 | 65 | #508 `042c44469`; #279 `87b4f5a0a`. |
| Sales / pilot collateral | 25 | 45 | Class R + #527 `c053c96d0`; #515 `fa068e989`; #453 `e3a2d8381`. |
| Demo data / reset flow | 28 | 40 | #453 `e3a2d8381`; #478 `e339fecb4`. |
| Monorepo CI/CD | 65 | 70 | #471 `d35ce5950`; #472 `24a0ed7a1`; #473 `2622def4c`. |
| Railway deploy preflight | 40 | 65 | #466 `dca85c5ac`; #470 `2280251b2`; #472 `24a0ed7a1`; #469 `9c4c49c8d`. |
| Web deploy health (Railway) | 60 | 65 | Renamed row (was "Vercel deploy health"); #466 `dca85c5ac`; #508 `042c44469`; `/api/version` live. |
| Regression test coverage | 55 | 70 | #497 `5dde02695`; #482 `9fda87cf8`. |
| Route map coverage | 30 | 65 | #497 `5dde02695`; `docs/product/golden-path-route-inventory.md`. |
| Smoke tests | 55 | 65 | #508 `042c44469`; #469 `9c4c49c8d`. |
| Release checklist | 20 | 45 | #492 `a2d03cac2`; `docs/deployment/release-monitoring.md`. |

### Normalizations, renames, structure

- **Settled values normalized:** rows whose displayed transition belonged to an older wave (e.g. Data classification 20→33, Retention 10→25, Verifier worklist 30→48, Reuse decision 50→65, Policy decision 60→75, Team/org roles 10→28, Review status 45→60, Docs/status 45→55, Mobile web/PWA 35→42) now show the settled value as Current %; the transitions remain recorded in the appendix history above.
- **Row renamed:** "Vercel deploy health" → "Web deploy health (Railway)" — Vercel deprecated 2026-06-28 (#466 `dca85c5ac`; `docs/deployment/railway-migration.md`).
- **Row added:** "Career intelligence layer (MATCHA)" under Live Clinician Product (precedent: RELIABILITY-2 added Source health classifier).
- **Blockers section replaced** with a pointer to `docs/ops/launch-blockers.md` (canonical open list, Wave 0 #541 `d1dbe7960`) + dispositions of the six 2026-05-27 items. Resolved history: `docs/ops/REBASELINE-2026-07-04.md`.
- **Pricing/paywall** percentage held; detail text refreshed with #502 `63d1db05a` (dead billing code deleted) — a text correction, not a score move.

### Deliberately NOT moved (evidence insufficient or literals still pinned)

Medical school / Residency / Fellowship / Specialty / employer-history rows (no source verification landed); Gov ID / Selfie / Account recovery (`isLive: false` literals); Device trust (nothing shipped); Pricing/paywall (`collectsPayment: false`); Pilot ops / Analytics (no instrumentation or vendor); Proof pack export (launch-blockers #12 open); Web quality (no new CI gate class); every Trust Engine row not listed in Class R. Platform-layer PRs #454–#464 beyond those cited (org OS, growth, solutions, Trust Exchange/Cloud, Configurable Platform, Operations Engine) added capability surfaces that have **no corresponding board row**; they are intentionally not force-mapped onto existing rows.

### Integrity statement

- Docs-only: this wave touches `docs/ops/vitalcv-completion-board.md` and nothing else.
- Every moved row cites merged PR # + SHA resolvable on `origin/main`; no row moved on open PRs (#540, #543 and the signup gate 4/4 are not counted).
- No row above 90. Honest-foundation literals that remain `false` (`rbacEnforced`, `accountCreationProductionReady`, `identityProofingComplete`, `collectsPayment`, `dbBackedWorklist` vocabulary) are quoted in the row details and cap their rows.
- Phase emoji re-derived from After Wave % per the Status Lexicon; no qualitative labels introduced.

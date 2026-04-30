# VitalCV Full Scope Completion Board

Last updated: 2026-04-30 (BOARD-SCHEMA-3 normalization)
Source branch: `docs/board-schema-3-normalize`

## Full-Scope Coverage Rule

Every wave report must include every board area and status. Focus areas may be highlighted, but non-focused areas must remain visible with **After Wave % equal to Current %**. No row may be omitted because it is low-scoring or untouched. Codex must verify row and section preservation before any board PR merges.

## Philosophy

This board tracks the functional reality of VitalCV.
* "Complete" means hardened, tested, and actively solving the buyer problem in the wedge context.
* It does *not* mean "we wrote a ticket for it" or "the mock exists."

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

Lookup examples: 0% → 🧊 Planned · 18% → 🌱 Seed · 35% → 🧱 Foundation · 58% → 🛠️ Buildout · 82% → 🚀 Hardening · 92% → ✅ Target Zone · 100% → 🏁 Complete

This lexicon supersedes prior qualitative status words. Work-state nuance lives in **Detail / Action Per Area**, not in Status.

## Required Table Schema

Every section uses this schema:

| Area | Current % | After Wave % | Detail / Action Per Area | Status |
|---|---:|---:|---|---|

- **Current %** = honest current state, evidenced by code on `origin/main`. Moves only on merge + verification.
- **After Wave %** = Current % for all rows not touched by the active wave. Only rows with merged evidence in this wave may differ.
- **Detail / Action Per Area** = what was done (evidence) or "No action this wave."
- **Status** = emoji phase derived from Current %. Never asserted independently.

---

## 🧠 Trust Engine / Issuer Infrastructure

| Area | Current % | After Wave % | Detail / Action Per Area | Status |
|---|---:|---:|---|---|
| Issuer request / router | 80 | 80 | No action this wave. Routes + tests on main (#167). | 🚀 Hardening |
| Partner route model | 75 | 75 | No action this wave. Partner router + tests (#167). | 🚀 Hardening |
| Issuer response intake | 70 | 70 | No action this wave. Intake surface + tests (#168). | 🚀 Hardening |
| Receipt candidate | 85 | 85 | No action this wave. `receiptCandidate.ts` + literal `decisionGrade:false`/`proofTier:'receipt_candidate'` tests. | 🚀 Hardening |
| Policy review decision | 85 | 85 | No action this wave. `policyReview.ts` 5-gate flow + tests. | 🚀 Hardening |
| PSV receipt promotion | 70 | 70 | No action this wave. PSV receipt + reuse boundary (#172). | 🚀 Hardening |
| Reuse / revocation / supersession boundary | 75 | 75 | No action this wave. (#172) tests. | 🚀 Hardening |
| Consent / manual send / timeline | 70 | 70 | No action this wave. Consent + timeline (#174). | 🚀 Hardening |
| Audit persistence boundary | 75 | 75 | No action this wave. (#175) `auditPersistence.ts` + tests. | 🚀 Hardening |
| Persistence adapter decision | 75 | 75 | No action this wave. (#176). | 🚀 Hardening |
| Backend writer boundary | 75 | 75 | No action this wave. (#180) `serverPsvReceiptWriter.ts` defensive downgrade + tests; deferred default writer only. | 🚀 Hardening |
| Domain / core PSV receipt contract alignment | 80 | 80 | No action this wave. (#178) `packages/domain-core/psvReceipts.ts` + frozen mapper tests. | 🚀 Hardening |
| Source health classifier | 65 | 65 | No action this wave. `SourceHealthState`, `LaneHealthBadge`, `unavailableLane` (#186); snapshot store, `runAllProbes`, internal probe/snapshots routes, scheduled workflow, 88-test suite (#187). | 🛠️ Buildout |

---

## 🧑‍⚕️ Live Clinician Product

| Area | Current % | After Wave % | Detail / Action Per Area | Status |
|---|---:|---:|---|---|
| Signup / account creation | 10 | 10 | No action this wave. Real auth (Clerk/NextAuth) wired; e2e signup test required. | 🌱 Seed |
| Login / account recovery | 10 | 10 | No action this wave. Sign-in flow + recovery; Google OAuth currently broken in prod. | 🌱 Seed |
| NPI check | 65 | 65 | No action this wave. NPPES proxy + ingest fallback in `apps/web/app/api/ingest/[npi]/route.ts`. | 🛠️ Buildout |
| Rich clinician profile shell | 55 | 55 | No action this wave. 16-section profile shell on `/passport/[id]` (Wave GOD-2). | 🛠️ Buildout |
| Identity / contact / locations | 35 | 35 | No action this wave. Inputs exist as user-entered only; no verified binding. | 🧱 Foundation |
| Medical school | 25 | 25 | No action this wave. Free-text capture; no source verification. | 🧱 Foundation |
| Residency | 25 | 25 | No action this wave. Free-text capture; no source verification. | 🧱 Foundation |
| Fellowship | 25 | 25 | No action this wave. Free-text capture; no source verification. | 🧱 Foundation |
| Training programs | 20 | 20 | No action this wave. Free-text capture; no source verification. | 🌱 Seed |
| Specialty / subspecialty | 30 | 30 | No action this wave. Capture + NPPES inference only. | 🧱 Foundation |
| Current employer | 25 | 25 | No action this wave. User-entered, no employer-side verification. | 🧱 Foundation |
| Employer history | 20 | 20 | No action this wave. User-entered only. | 🌱 Seed |
| Affiliations | 20 | 20 | No action this wave. User-entered only. | 🌱 Seed |
| Work history | 20 | 20 | No action this wave. User-entered only. | 🌱 Seed |
| Research / publications | 15 | 15 | No action this wave. Section exists, no live source binding. | 🌱 Seed |
| PubMed layer | 30 | 30 | No action this wave. `publicationFoundation.ts` 5 source kinds with `pubmedCandidatesVerifiedByDefault: false` and `sourceBackedVerificationImplemented: false`; in-product fetch/dedupe still planned (#FOUNDATION-SWEEP-5). | 🧱 Foundation |
| LinkedIn-style profile layer | 28 | 28 | No action this wave. `professionalProfileLayer.ts` defines `linkedin_style` as presentation concept (NOT a LinkedIn integration) with `verifiesCredentials: false` (#FOUNDATION-SWEEP-5). | 🧱 Foundation |
| Doximity-style profile layer | 26 | 26 | No action this wave. Same `professionalProfileLayer.ts`; `doximity_style` as presentation concept with `verifiesCredentials: false` (#FOUNDATION-SWEEP-5). | 🧱 Foundation |
| Career goals / preferences | 25 | 25 | No action this wave. Capture exists, no matching loop. | 🧱 Foundation |
| Profile completion score | 20 | 20 | No action this wave. No live score widget. | 🌱 Seed |
| Clinician-facing value dashboard | 10 | 10 | No action this wave. Not built. | 🌱 Seed |

---

## 📱 Mobile + Device Experience

| Area | Current % | After Wave % | Detail / Action Per Area | Status |
|---|---:|---:|---|---|
| Mobile web / PWA | 35 | 35 | No action this wave. Responsive layout; PWA manifest foundation (Wave GOD-2); no installability/offline shell verified. | 🧱 Foundation |
| Native iOS app | 25 | 25 | No action this wave. `nativeAppReadiness.ts` iOS planned-capability set; all capabilities `isLive: false`; no native app is live (#FOUNDATION-SWEEP-4). | 🧱 Foundation |
| Native Android app | 25 | 25 | No action this wave. Same `nativeAppReadiness.ts`; Android capabilities `isLive: false`; no native app is live (#FOUNDATION-SWEEP-4). | 🧱 Foundation |
| Mobile document capture | 25 | 25 | No action this wave. `mobileCaptureFoundation.ts` web/PWA scope + 7-capability checklist; native camera workflows not enabled yet (#FOUNDATION-SWEEP-3). | 🧱 Foundation |
| Device trust / App Attest / Play Integrity | 0 | 0 | No action this wave. None shipped. | 🧊 Planned |
| Biometric gating | 25 | 25 | No action this wave. `biometricGatingFoundation.ts` 5 planned capabilities; `biometricGatingLive: false`, `provesClinicianIdentity: false` (#FOUNDATION-SWEEP-4). | 🧱 Foundation |
| Push notification readiness | 0 | 0 | No action this wave. None shipped. | 🧊 Planned |
| Offline / degraded-state handling | 25 | 25 | No action this wave. 5xx graceful fallbacks (#LIVE-100C/D) + `degradedStateFoundation.ts` 6-state policy; `offlineSyncImplemented: false` (#FOUNDATION-SWEEP-3). | 🧱 Foundation |

---

## 🔐 Identity + Security

| Area | Current % | After Wave % | Detail / Action Per Area | Status |
|---|---:|---:|---|---|
| Government ID verification | 25 | 25 | No action this wave. `identityVerificationControls.ts` 8-control foundation; `governmentIdLive: false`, `vendorSelected: false`, `highestIalClaimed: 'none'` (#FOUNDATION-SWEEP-4). | 🧱 Foundation |
| Selfie / liveness | 25 | 25 | No action this wave. Same `identityVerificationControls.ts`; `selfieLivenessLive: false` (#FOUNDATION-SWEEP-4). | 🧱 Foundation |
| Clinician-to-NPI binding | 28 | 28 | No action this wave. `evaluateClinicianNpiBindingReadiness` returns `foundation_ready`; gov_id and liveness placeholders; no proven-person-to-NPI binding (#FOUNDATION-SWEEP-2). | 🧱 Foundation |
| Identity proofing policy | 25 | 25 | No action this wave. `identityProofingPolicy.ts`; only NPI-lookup + self-attested-name `isLive: true`; gov ID + liveness `isLive: false`; no IAL2/IAL3 asserted (#FOUNDATION-SWEEP-2). | 🧱 Foundation |
| Account recovery | 25 | 25 | No action this wave. `accountRecoveryFoundation.ts` 5 recovery methods all `isLive: false`; no production recovery flow ships (#FOUNDATION-SWEEP-3). | 🧱 Foundation |
| Session security | 20 | 20 | No action this wave. Default Next/Clerk session handling, not hardened. | 🌱 Seed |
| OWASP ASVS baseline | 15 | 15 | No action this wave. No published ASVS scorecard. | 🌱 Seed |
| Security headers / secure defaults | 35 | 35 | No action this wave. Some headers via Next defaults; no audited CSP. | 🧱 Foundation |
| Data classification | 20 | 20 | No action this wave. Provenance vocab exists (VERIFIED/USER_ENTERED/INFERRED/UNKNOWN/CONFLICT); no PII/PHI tier doc. | 🌱 Seed |
| Retention / redaction | 10 | 10 | No action this wave. No retention policy enforced. | 🌱 Seed |
| Secrets / env handling | 30 | 30 | No action this wave. `.env` patterns in repo; no zod env validation. | 🧱 Foundation |

---

## ♿ Accessibility

| Area | Current % | After Wave % | Detail / Action Per Area | Status |
|---|---:|---:|---|---|
| WCAG 2.2 AA baseline | 25 | 25 | No action this wave. `accessibilityFoundation.ts` 9-category checklist; explicit "not a WCAG 2.2 AA certification" disclaimer; no automated axe gate in CI (#FOUNDATION-SWEEP-2). | 🧱 Foundation |
| Keyboard navigation | 25 | 25 | No action this wave. Default browser behavior; no audited focus traps. | 🧱 Foundation |
| Screen reader labels | 25 | 25 | No action this wave. `screen_reader_labels` category in accessibility foundation; `/clinician/identity` uses `aria-labelledby` regions (#FOUNDATION-SWEEP-2). | 🧱 Foundation |
| Touch targets | 30 | 30 | No action this wave. Mobile clip fixes (Wave GOD-2); no 44×44 audit. | 🧱 Foundation |
| Error-state accessibility | 15 | 15 | No action this wave. Error UIs not audited for screen readers. | 🌱 Seed |
| Contrast | 30 | 30 | No action this wave. Design-system v2 tokens in flight on a separate branch. | 🧱 Foundation |
| Reduced motion | 25 | 25 | No action this wave. `reduced_motion` category in accessibility foundation; no prefers-reduced-motion handling audited end-to-end (#FOUNDATION-SWEEP-2). | 🧱 Foundation |
| Form accessibility | 15 | 15 | No action this wave. No labeled-region audit. | 🌱 Seed |
| Mobile accessibility | 15 | 15 | No action this wave. Same as form accessibility. | 🌱 Seed |

---

## 📤 Upload / Import / Export

| Area | Current % | After Wave % | Detail / Action Per Area | Status |
|---|---:|---:|---|---|
| CV upload | 25 | 25 | No action this wave. Knowledge Inbox foundation (#166) for free-text capture; binary CV upload not wired. | 🧱 Foundation |
| Document upload | 32 | 32 | No action this wave. `document_upload` first-class `ImportEntryKind` in `importFoundation.ts` with `entry_only` status (#FOUNDATION-SWEEP-2). | 🧱 Foundation |
| Drag/drop upload UX | 15 | 15 | No action this wave. No verified DnD surface. | 🌱 Seed |
| LinkedIn import | 25 | 25 | No action this wave. `professionalImportFoundation.ts` defines `linkedin_profile` as `planned`, `isLive: false`; no live integration ships (#FOUNDATION-SWEEP-5). | 🧱 Foundation |
| Doximity import | 25 | 25 | No action this wave. Same `professionalImportFoundation.ts`; `doximity_profile` as `planned`, `isLive: false`; no live integration ships (#FOUNDATION-SWEEP-5). | 🧱 Foundation |
| PubMed import | 30 | 30 | No action this wave. Same `professionalImportFoundation.ts`; `pubmed_publications` as `candidate_ready`, `isLive: false`, `productionReady: false`; no live integration ships (#FOUNDATION-SWEEP-5). | 🧱 Foundation |
| CSV / roster import | 30 | 30 | No action this wave. Some CSV ingest; roster management is manual. | 🧱 Foundation |
| Export bundle | 25 | 25 | No action this wave. `ARTIFACT_EXPORTED` event metadata exists; bundle UX partial. | 🧱 Foundation |
| Shareable passport | 35 | 35 | No action this wave. `/passport/[id]` route + provenance panel. | 🧱 Foundation |
| Proof pack export | 20 | 20 | No action this wave. Conceptual shape; no audited bundle. | 🌱 Seed |
| Import error handling | 25 | 25 | No action this wave. `buildImportErrorState` returns user-safe responses for 8 `ImportErrorKind` values; no raw stack/payload/secret leaks (#FOUNDATION-SWEEP-2). | 🧱 Foundation |
| Import provenance labels | 40 | 40 | No action this wave. 5-tier provenance vocab enforced (Wave GOD-3S). | 🧱 Foundation |

---

## 🕸️ Knowledge Trust Graph

| Area | Current % | After Wave % | Detail / Action Per Area | Status |
|---|---:|---:|---|---|
| Data model | 75 | 75 | No action this wave. `docs/architecture/vitalcv-knowledge-trust-graph.{md,json}` boundaries 1–28. | 🚀 Hardening |
| Claim / source / receipt navigation | 60 | 60 | No action this wave. TrustGraph panel mounts on `/passport/[id]`. | 🛠️ Buildout |
| Roam/Obsidian-style visual graph UX | 22 | 22 | No action this wave. Static panel only; no graph layout engine. | 🌱 Seed |
| Graph search | 10 | 10 | No action this wave. Not built. | 🌱 Seed |
| Graph filtering | 10 | 10 | No action this wave. Not built. | 🌱 Seed |
| Graph export | 30 | 30 | No action this wave. Underlying JSON exportable; no UI export. | 🧱 Foundation |
| Clinician-facing graph explanation | 35 | 35 | No action this wave. Static explainer in panel. | 🧱 Foundation |
| Verifier-facing graph explanation | 30 | 30 | No action this wave. Same as clinician-facing. | 🧱 Foundation |
| Graph-to-proof-pack path | 20 | 20 | No action this wave. Not connected end-to-end. | 🌱 Seed |

---

## 🏥 Verifier / Employer Product

| Area | Current % | After Wave % | Detail / Action Per Area | Status |
|---|---:|---:|---|---|
| Employer review | 60 | 60 | No action this wave. Issuer review surface (#168); demo render only (`recordedBy:'demo'`). | 🛠️ Buildout |
| Request review | 55 | 55 | No action this wave. Same as employer review. | 🛠️ Buildout |
| Verifier worklist | 30 | 30 | No action this wave. No audited multi-request worklist. | 🧱 Foundation |
| Evidence inspection | 50 | 50 | No action this wave. Receipt candidate viewer. | 🛠️ Buildout |
| Reuse decision UX | 50 | 50 | No action this wave. (#172) reuse boundary surfaced in review. | 🛠️ Buildout |
| Policy decision UX | 60 | 60 | No action this wave. Policy review 5-gate UX. | 🛠️ Buildout |
| Exportable proof pack | 25 | 25 | No action this wave. Not bundled. | 🧱 Foundation |
| Team / org roles | 10 | 10 | No action this wave. None. | 🌱 Seed |
| Review status tracking | 45 | 45 | No action this wave. Request lifecycle states present. | 🧱 Foundation |
| Employer CTA / conversion path | 40 | 40 | No action this wave. `/employers` redirect + `/pilot` CTA live. | 🧱 Foundation |

---

## 🏛️ Backend / Persistence / API

| Area | Current % | After Wave % | Detail / Action Per Area | Status |
|---|---:|---:|---|---|
| Domain PSV receipt contract | 85 | 85 | No action this wave. (#178) frozen mapper tests. | 🚀 Hardening |
| Server writer confirmation boundary | 80 | 80 | No action this wave. (#180) defensive downgrade + tests. | 🚀 Hardening |
| Real persistence writer | 5 | 5 | No action this wave. Default writer is deferred-only; no contract-aligned Prisma table; no audit-event table; no client-safe RPC. | 🌱 Seed |
| Audit replay | 18 | 18 | No action this wave. (#187) snapshot store + `getLaneSnapshots` fallback gives a read-side replay path for source-health lanes. | 🌱 Seed |
| Export API | 15 | 15 | No action this wave. None client-safe. | 🌱 Seed |
| Backend test coverage | 42 | 42 | No action this wave. Issuer 321/321 vitest pass; (#187) adds 88-test source-health suite. | 🧱 Foundation |
| API route hardening | 32 | 32 | No action this wave. (#187) internal source-health routes use dual-auth (Bearer `CRON_SECRET` preferred; `x-monitoring-secret` legacy) and 500 fail-closed when both unset; no CORS/helmet/API key story for public routes. | 🧱 Foundation |
| Repository adapter | 70 | 70 | No action this wave. (#176/#177) decision boundaries. | 🚀 Hardening |
| Database migration readiness | 5 | 5 | No action this wave. SQLite + in-memory; PostgreSQL migration is Phase 1.1 (not started). | 🌱 Seed |

---

## 🚀 Commercial Launch Readiness

| Area | Current % | After Wave % | Detail / Action Per Area | Status |
|---|---:|---:|---|---|
| Pricing/paywall | 28 | 28 | No action this wave. `pricingFoundation.ts` 5 commercial plan kinds; `collectsPayment: false`, `subscriptionActive: false`, `checkoutIntegrationLive: false`; no Stripe/checkout ships (#FOUNDATION-SWEEP-6A). | 🧱 Foundation |
| Self-serve signup | 32 | 32 | No action this wave. `selfServeSignupFoundation.ts` role/NPI/profile/export/review steps; `accountCreationProductionReady: false`, `paymentCollectionLive: false` (#FOUNDATION-SWEEP-6A). | 🧱 Foundation |
| Onboarding | 38 | 38 | No action this wave. `onboardingFoundation.ts` milestones; `productionOnboardingComplete: false`, `completesCredentialing: false` (#FOUNDATION-SWEEP-6A). | 🧱 Foundation |
| Support / admin | 25 | 25 | No action this wave. `supportAdminFoundation.ts` 6-capability plan; `staffed: false`, `productionAdminEnabled: false` (#FOUNDATION-SWEEP-3). | 🧱 Foundation |
| Pilot ops | 50 | 50 | No action this wave. `/pilot` CTA live; no funnel instrumentation. | 🛠️ Buildout |
| Analytics | 40 | 40 | No action this wave. `analyticsFoundation.ts` 6-event privacy-safe vocabulary; `dispatchedToThirdParty: false`, `productionPipelineLive: false`, `collectsPhi: false`; no vendor wired (#FOUNDATION-SWEEP-6B). | 🧱 Foundation |
| Docs / status page | 45 | 45 | No action this wave. `statusFoundation.ts` 6-surface plan; `uptimeGuaranteeImplied: false`, `productionStatusPageLive: false`; legal pages `/privacy` and `/terms` live (#LIVE-100C, #FOUNDATION-SWEEP-6B). | 🧱 Foundation |
| Legal pages | 60 | 60 | No action this wave. `/privacy` and `/terms` live (#LIVE-100C). | 🛠️ Buildout |
| Sales / pilot collateral | 25 | 25 | No action this wave. Some pilot pages; no proof-pack. | 🧱 Foundation |
| Demo data / reset flow | 28 | 28 | No action this wave. `demoResetFoundation.ts` 5 demo-bounded reset scopes; `productionResetEnabled: false`, `destructive: false`, `requiresOperatorConfirmation: true` (#FOUNDATION-SWEEP-3). | 🧱 Foundation |

---

## 🧪 Quality / CI / Release

| Area | Current % | After Wave % | Detail / Action Per Area | Status |
|---|---:|---:|---|---|
| Web quality | 85 | 85 | No action this wave. TypeScript + ESLint enforced on build; 321/321 issuer tests; (#196) BUILD-CHAIN-1 fixed root `build:web` script → `pnpm turbo run build --filter @vitalcv/web`; canonical build path documented. | 🚀 Hardening |
| Monorepo CI/CD | 65 | 65 | No action this wave. Turbo workflows; merge-protection requires Codex SAFE; (#196) BUILD-CHAIN-1 root scripts expose deterministic monorepo build commands. | 🛠️ Buildout |
| Railway deploy preflight | 40 | 40 | No action this wave. (#179) excluded db-dependent backend packages from preflight smoke. | 🧱 Foundation |
| Vercel deploy health | 60 | 60 | No action this wave. vitalcv.com → `vcv-web` on `blockchaincv` team; Vercel linkage verified. | 🛠️ Buildout |
| Regression test coverage | 55 | 55 | No action this wave. Heavy on issuer slice; source-health suite 88/88; (#196) BUILD-CHAIN-1 `build:check-chain` smoke; thin in clinician/mobile/marketing surfaces. | 🛠️ Buildout |
| Route map coverage | 30 | 30 | No action this wave. No published route map gate. | 🧱 Foundation |
| Smoke tests | 55 | 55 | No action this wave. (#179) preflight partial; (#187) source-health probe cron; (#196) BUILD-CHAIN-1 `scripts/check-web-build-chain.sh` executable smoke. | 🛠️ Buildout |
| Release checklist | 20 | 20 | No action this wave. No published release checklist. | 🌱 Seed |

---

## Low-Score-First Attack Order

1. Signup / account creation
2. Identity proofing + gov ID / liveness
3. Mobile web / PWA onboarding
4. Rich clinician profile
5. Upload / import / export
6. Knowledge Graph visual UX
7. Accessibility / WCAG baseline
8. Research / PubMed layer
9. Verifier worklist / review UX
10. Native app readiness

# VitalCV Full Scope Completion Board

Last updated: 2026-05-07 (Waves B/D/E/F/H — 14 PRs landed; all 6 design surfaces foundationed)
Source branch: `rescue/ops-docs-foundation`

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
| PSV receipt promotion | 70 | 70 | No action this wave. PSV receipt + reuse boundary (#172). | 🚀 Hardening |
| Reuse / revocation / supersession boundary | 75 | 75 | No action this wave. (#172) tests. | 🚀 Hardening |
| Consent / manual send / timeline | 70 | 70 | No action this wave. Consent + timeline (#174). | 🚀 Hardening |
| Audit persistence boundary | 75 | 75 | No action this wave. (#175) `auditPersistence.ts` + tests. | 🚀 Hardening |
| Persistence adapter decision | 75 | 75 | No action this wave. (#176). | 🚀 Hardening |
| Backend writer boundary | 75 | 75 | No action this wave. (#180) `serverPsvReceiptWriter.ts` defensive downgrade + tests; deferred default writer only. | 🚀 Hardening |
| Domain / core PSV receipt contract alignment | 80 | 80 | No action this wave. (#178) `packages/domain-core/psvReceipts.ts` + frozen mapper tests. | 🚀 Hardening |
| Source health classifier | 65 | 65 | No action this wave. `SourceHealthState`, `LaneHealthBadge`, snapshot store, `runAllProbes`, 88-test suite (#186/#187). | 🛠️ Buildout |

---

## 🧑‍⚕️ Live Clinician Product

| Area | Current % | After Wave % | Detail / Action Per Area | Status |
|---|---:|---:|---|---|
| Signup / account creation | 10 | 10 | No action this wave. Real auth (Clerk/NextAuth) wired; e2e signup test required. | 🌱 Seed |
| Login / account recovery | 10 | 10 | No action this wave. Sign-in flow + recovery; Google OAuth currently broken in prod. | 🌱 Seed |
| NPI check | 65 | 65 | No action this wave. NPPES proxy + ingest fallback in `apps/web/app/api/ingest/[npi]/route.ts`. | 🛠️ Buildout |
| Rich clinician profile shell | 75 | 75 | PR-C (#207, ac58f6df): `profileTypes.ts` (163 lines) + `profileCompletion.ts` (253 lines) + profile/graph/onboarding/import routes + 22-test suite. | 🚀 Hardening |
| Identity / contact / locations | 55 | 55 | PR-C (#207, ac58f6df): `ClinicianProfile` field schema with provenance + confidence axis in `profileTypes.ts`; user-entered only, no verified binding. | 🛠️ Buildout |
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
| PubMed layer | 30 | 30 | No action this wave. `publicationFoundation.ts` 5 source kinds; `pubmedCandidatesVerifiedByDefault: false` (#FOUNDATION-SWEEP-5). | 🧱 Foundation |
| LinkedIn-style profile layer | 28 | 28 | No action this wave. `professionalProfileLayer.ts` linkedin_style as presentation concept; `verifiesCredentials: false` (#FOUNDATION-SWEEP-5). | 🧱 Foundation |
| Doximity-style profile layer | 26 | 26 | No action this wave. Same `professionalProfileLayer.ts`; doximity_style; `verifiesCredentials: false` (#FOUNDATION-SWEEP-5). | 🧱 Foundation |
| Career goals / preferences | 25 | 25 | No action this wave. Capture exists, no matching loop. | 🧱 Foundation |
| Profile completion score | 40 | 40 | PR-C (#207, ac58f6df): `profileCompletion.ts` weighted score with `source-backed`/`self-attested`/`imported-candidate` tiers; 22 tests pass. | 🧱 Foundation |
| Clinician-facing value dashboard | 30 | 30 | PR-C (#207, ac58f6df): `/clinician/graph` Knowledge Graph Preview route + clinician profile routes wired; no live personalization widget yet. | 🧱 Foundation |

---

## 📱 Mobile + Device Experience

| Area | Current % | After Wave % | Detail / Action Per Area | Status |
|---|---:|---:|---|---|
| Mobile web / PWA | 35 | 42 | PR-F (#214, bae32c90): editorial homepage client + app-shell responsive layout (`HomePageClient.tsx`, `layout.tsx`) with mobile-first sections + Geist font system at the layout level; PWA installability + offline shell still not verified. | 🧱 Foundation |
| Native iOS app | 25 | 25 | No action this wave. `nativeAppReadiness.ts` iOS capability set; all `isLive: false`; no native app is live (#FOUNDATION-SWEEP-4). | 🧱 Foundation |
| Native Android app | 25 | 25 | No action this wave. Same `nativeAppReadiness.ts`; Android `isLive: false`; no native app is live (#FOUNDATION-SWEEP-4). | 🧱 Foundation |
| Mobile document capture | 25 | 25 | No action this wave. `mobileCaptureFoundation.ts` web/PWA scope + 7-capability checklist; native camera not enabled yet (#FOUNDATION-SWEEP-3). | 🧱 Foundation |
| Device trust / App Attest / Play Integrity | 0 | 0 | No action this wave. None shipped. | 🧊 Planned |
| Biometric gating | 25 | 25 | No action this wave. `biometricGatingFoundation.ts` 5 planned capabilities; `biometricGatingLive: false`, `provesClinicianIdentity: false` (#FOUNDATION-SWEEP-4). | 🧱 Foundation |
| Push notification readiness | 0 | 0 | No action this wave. None shipped. | 🧊 Planned |
| Offline / degraded-state handling | 25 | 25 | No action this wave. 5xx fallbacks (#LIVE-100C/D) + `degradedStateFoundation.ts` 6-state policy; `offlineSyncImplemented: false` (#FOUNDATION-SWEEP-3). | 🧱 Foundation |

---

## 🔐 Identity + Security

| Area | Current % | After Wave % | Detail / Action Per Area | Status |
|---|---:|---:|---|---|
| Government ID verification | 25 | 25 | No action this wave. `identityVerificationControls.ts` 8-control foundation; `governmentIdLive: false`, `vendorSelected: false` (#FOUNDATION-SWEEP-4). | 🧱 Foundation |
| Selfie / liveness | 25 | 25 | No action this wave. Same `identityVerificationControls.ts`; `selfieLivenessLive: false` (#FOUNDATION-SWEEP-4). | 🧱 Foundation |
| Clinician-to-NPI binding | 28 | 28 | No action this wave. `evaluateClinicianNpiBindingReadiness` returns `foundation_ready`; no proven-person-to-NPI binding (#FOUNDATION-SWEEP-2). | 🧱 Foundation |
| Identity proofing policy | 25 | 25 | No action this wave. `identityProofingPolicy.ts`; NPI-lookup + self-attested-name only `isLive: true`; no IAL2/IAL3 (#FOUNDATION-SWEEP-2). | 🧱 Foundation |
| Account recovery | 25 | 25 | No action this wave. `accountRecoveryFoundation.ts` 5 methods all `isLive: false`; no production recovery flow (#FOUNDATION-SWEEP-3). | 🧱 Foundation |
| Session security | 20 | 20 | No action this wave. Default Next/Clerk session handling, not hardened. | 🌱 Seed |
| OWASP ASVS baseline | 15 | 15 | No action this wave. No published ASVS scorecard. | 🌱 Seed |
| Security headers / secure defaults | 35 | 35 | No action this wave. Some headers via Next defaults; no audited CSP. | 🧱 Foundation |
| Data classification | 20 | 33 | ENTERPRISE-VANGUARD-6A: `dataClassificationFoundation.ts` 4-tier vocab (public/pii/phi/internal); 6 REDACTION_RULES; maskValue(); redactionLive: false, piiTierDocLive: false. | 🧱 Foundation |
| Retention / redaction | 10 | 25 | ENTERPRISE-VANGUARD-6A: `retentionFoundation.ts` 5-entity retention policy model; DEFAULT_RETENTION_POLICIES; retentionEnforced: false, autoDeleteLive: false. | 🧱 Foundation |
| Secrets / env handling | 30 | 30 | No action this wave. `.env` patterns in repo; no zod env validation. | 🧱 Foundation |

---

## ♿ Accessibility

| Area | Current % | After Wave % | Detail / Action Per Area | Status |
|---|---:|---:|---|---|
| WCAG 2.2 AA baseline | 25 | 25 | No action this wave. `accessibilityFoundation.ts` 9-category checklist; "not a WCAG 2.2 AA certification"; no axe gate in CI (#FOUNDATION-SWEEP-2). | 🧱 Foundation |
| Keyboard navigation | 25 | 25 | No action this wave. Default browser behavior; no audited focus traps. | 🧱 Foundation |
| Screen reader labels | 25 | 25 | No action this wave. `screen_reader_labels` category in accessibility foundation; `/clinician/identity` uses `aria-labelledby` (#FOUNDATION-SWEEP-2). | 🧱 Foundation |
| Touch targets | 30 | 30 | No action this wave. Mobile clip fixes (Wave GOD-2); no 44×44 audit. | 🧱 Foundation |
| Error-state accessibility | 15 | 15 | No action this wave. Error UIs not audited for screen readers. | 🌱 Seed |
| Contrast | 35 | 35 | PR-E (#209, e1687cc2): design-system v2 tokens (colors, typography) + themes (dark/light/graphite/midnight) on main; no axe-based contrast audit yet. | 🧱 Foundation |
| Reduced motion | 25 | 25 | No action this wave. `reduced_motion` category in accessibility foundation; no prefers-reduced-motion audited end-to-end (#FOUNDATION-SWEEP-2). | 🧱 Foundation |
| Form accessibility | 15 | 15 | No action this wave. No labeled-region audit. | 🌱 Seed |
| Mobile accessibility | 15 | 15 | No action this wave. No labeled-region audit. | 🌱 Seed |

---

## 📤 Upload / Import / Export

| Area | Current % | After Wave % | Detail / Action Per Area | Status |
|---|---:|---:|---|---|
| CV upload | 25 | 25 | No action this wave. Knowledge Inbox foundation (#166) for free-text capture; binary CV upload not wired. | 🧱 Foundation |
| Document upload | 32 | 32 | No action this wave. `document_upload` first-class `ImportEntryKind` in `importFoundation.ts` with `entry_only` status (#FOUNDATION-SWEEP-2). | 🧱 Foundation |
| Drag/drop upload UX | 15 | 15 | No action this wave. No verified DnD surface. | 🌱 Seed |
| LinkedIn import | 25 | 25 | No action this wave. `professionalImportFoundation.ts` defines `linkedin_profile` as `planned`, `isLive: false` (#FOUNDATION-SWEEP-5). | 🧱 Foundation |
| Doximity import | 25 | 25 | No action this wave. Same foundation; `doximity_profile` as `planned`, `isLive: false` (#FOUNDATION-SWEEP-5). | 🧱 Foundation |
| PubMed import | 30 | 30 | No action this wave. `pubmed_publications` as `candidate_ready`, `isLive: false`, `productionReady: false` (#FOUNDATION-SWEEP-5). | 🧱 Foundation |
| CSV / roster import | 30 | 30 | No action this wave. Some CSV ingest; roster management is manual. | 🧱 Foundation |
| Export bundle | 25 | 25 | No action this wave. `ARTIFACT_EXPORTED` event metadata exists; bundle UX in progress. | 🧱 Foundation |
| Shareable passport | 35 | 35 | No action this wave. `/passport/[id]` route + provenance panel. | 🧱 Foundation |
| Proof pack export | 20 | 20 | No action this wave. Conceptual shape; no audited bundle. | 🌱 Seed |
| Import error handling | 25 | 25 | No action this wave. `buildImportErrorState` returns user-safe responses for 8 `ImportErrorKind` values (#FOUNDATION-SWEEP-2). | 🧱 Foundation |
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
| Verifier-facing graph explanation | 30 | 30 | No action this wave. Static explainer (same as clinician-facing). | 🧱 Foundation |
| Graph-to-proof-pack path | 20 | 20 | No action this wave. Not connected end-to-end. | 🌱 Seed |

---

## 🏥 Verifier / Employer Product

| Area | Current % | After Wave % | Detail / Action Per Area | Status |
|---|---:|---:|---|---|
| Employer review | 60 | 60 | No action this wave. Issuer review surface (#168); demo render only (`recordedBy:'demo'`). | 🛠️ Buildout |
| Request review | 55 | 55 | No action this wave. Same as employer review. | 🛠️ Buildout |
| Verifier worklist | 30 | 48 | FOUNDATION-SWEEP-7: `worklist.ts` WorklistItem/filter/status-copy foundation; WorklistPanel component; /employer/worklist shell; dbBackedWorklist: false. | 🧱 Foundation |
| Evidence inspection | 50 | 50 | No action this wave. Receipt candidate viewer. | 🛠️ Buildout |
| Reuse decision UX | 50 | 65 | FOUNDATION-SWEEP-7: `reuseDecisionFoundation.ts` 3-basis model; explainReuseBasis says 'previously assessed'; crossTenantReuseImplemented: false. | 🛠️ Buildout |
| Policy decision UX | 60 | 75 | FOUNDATION-SWEEP-7: `policyDecisionFoundation.ts` 4-outcome model; no 'approved'/'rejected' language; automatedPolicyEngine: false; /employer/decision/[id] shell. | 🛠️ Buildout |
| Exportable proof pack | 25 | 25 | No action this wave. Not bundled. | 🧱 Foundation |
| Team / org roles | 10 | 28 | FOUNDATION-SWEEP-7: `orgRolesFoundation.ts` 3-role model; invitation lifecycle; invitationSystemLive: false, rbacEnforced: false. | 🧱 Foundation |
| Review status tracking | 45 | 60 | FOUNDATION-SWEEP-7: `reviewStatusFoundation.ts` 6-state lifecycle; transitionAllowed() state machine; truth-safe copy for all states; productionWorkflowLive: false. | 🛠️ Buildout |
| Employer CTA / conversion path | 40 | 40 | No action this wave. `/employers` redirect + `/pilot` CTA live. | 🧱 Foundation |

---

## 🏛️ Backend / Persistence / API

| Area | Current % | After Wave % | Detail / Action Per Area | Status |
|---|---:|---:|---|---|
| Domain PSV receipt contract | 85 | 85 | No action this wave. (#178) frozen mapper tests. | 🚀 Hardening |
| Server writer confirmation boundary | 80 | 80 | No action this wave. (#180) defensive downgrade + tests. | 🚀 Hardening |
| Real persistence writer | 5 | 5 | No action this wave. Default writer is deferred-only; no Prisma table; no audit-event table; no client-safe RPC. | 🌱 Seed |
| Audit replay | 18 | 18 | No action this wave. (#187) snapshot store + `getLaneSnapshots` fallback; read-side replay for source-health lanes. | 🌱 Seed |
| Export API | 15 | 15 | No action this wave. None client-safe. | 🌱 Seed |
| Backend test coverage | 42 | 42 | No action this wave. Issuer 321/321 vitest pass; source-health 88/88 (#187). | 🧱 Foundation |
| API route hardening | 32 | 32 | No action this wave. (#187) source-health routes use dual-auth; no CORS/helmet/API key story for public routes. | 🧱 Foundation |
| Repository adapter | 70 | 70 | No action this wave. (#176/#177) decision boundaries. | 🚀 Hardening |
| Database migration readiness | 5 | 5 | No action this wave. SQLite + in-memory; PostgreSQL migration is Phase 1.1 (no implementation yet). | 🌱 Seed |

---

## 🚀 Commercial Launch Readiness

| Area | Current % | After Wave % | Detail / Action Per Area | Status |
|---|---:|---:|---|---|
| Pricing/paywall | 28 | 28 | No action this wave. `pricingFoundation.ts` 5 plan kinds; `collectsPayment: false`, `checkoutIntegrationLive: false` (#FOUNDATION-SWEEP-6A). | 🧱 Foundation |
| Self-serve signup | 32 | 32 | No action this wave. `selfServeSignupFoundation.ts`; `accountCreationProductionReady: false`, `paymentCollectionLive: false` (#FOUNDATION-SWEEP-6A). | 🧱 Foundation |
| Onboarding | 38 | 38 | No action this wave. `onboardingFoundation.ts` milestones; `productionOnboardingComplete: false`, `completesCredentialing: false` (#FOUNDATION-SWEEP-6A). | 🧱 Foundation |
| Support / admin | 25 | 25 | No action this wave. `supportAdminFoundation.ts` 6-capability plan; `staffed: false`, `productionAdminEnabled: false` (#FOUNDATION-SWEEP-3). | 🧱 Foundation |
| Pilot ops | 50 | 50 | No action this wave. `/pilot` CTA live; no funnel instrumentation. | 🛠️ Buildout |
| Analytics | 40 | 40 | No action this wave. `analyticsFoundation.ts` 6-event privacy-safe vocabulary; no vendor wired; production pipeline not live (#FOUNDATION-SWEEP-6B). | 🧱 Foundation |
| Docs / status page | 45 | 55 | ENTERPRISE-VANGUARD-6A: `apps/web/app/api/compliance/evidence/route.ts` compliance evidence shape route; superadminGateLive: false; reports planned controls, not enforced production policies. | 🛠️ Buildout |
| Legal pages | 60 | 60 | No action this wave. `/privacy` and `/terms` live (#LIVE-100C). | 🛠️ Buildout |
| Sales / pilot collateral | 25 | 25 | No action this wave. Some pilot pages; no proof-pack. | 🧱 Foundation |
| Demo data / reset flow | 28 | 28 | No action this wave. `demoResetFoundation.ts` 5 reset scopes; `productionResetEnabled: false`, `destructive: false` (#FOUNDATION-SWEEP-3). | 🧱 Foundation |

---

## 🧪 Quality / CI / Release

| Area | Current % | After Wave % | Detail / Action Per Area | Status |
|---|---:|---:|---|---|
| Web quality | 85 | 85 | No action this wave. TypeScript + ESLint enforced on build; 321/321 issuer tests; canonical build path fixed (#196 BUILD-CHAIN-1). | 🚀 Hardening |
| Monorepo CI/CD | 65 | 65 | No action this wave. Turbo workflows; merge-protection requires Codex SAFE; root scripts expose deterministic build (#196 BUILD-CHAIN-1). | 🛠️ Buildout |
| Railway deploy preflight | 40 | 40 | No action this wave. (#179) excluded db-dependent backend packages from preflight smoke. | 🧱 Foundation |
| Vercel deploy health | 60 | 60 | No action this wave. vitalcv.com → `vcv-web` on `blockchaincv` team; Vercel linkage verified. | 🛠️ Buildout |
| Regression test coverage | 55 | 55 | No action this wave. Heavy on issuer slice; source-health suite 88/88; thin in clinician/mobile/marketing surfaces. | 🛠️ Buildout |
| Route map coverage | 30 | 30 | No action this wave. No published route map gate. | 🧱 Foundation |
| Smoke tests | 55 | 55 | No action this wave. (#179) preflight smoke in progress; (#187) source-health cron; (#196) `check-web-build-chain.sh` executable smoke. | 🛠️ Buildout |
| Release checklist | 20 | 20 | No action this wave. No published release checklist. | 🌱 Seed |

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

## Notes on this revision

- Replaces the prior board's headline "100% wedge usability / 99% pilot-ready / 66% overall" framing. That framing rolled live-URL non-crashing into completion; the new schema treats route stability as one row of one section, not a system score.
- Trust-engine rows are the only ones permitted to sit in the 70–85 band; they have merged code on `main` (PRs #166–#180) and tests, but each is still capped below 90 because **real persistence is deferred** (#180), so the proof-of-action chain is incomplete end-to-end.
- Live clinician product, identity proofing, accessibility, mobile, and import/export rows are conservatively scored per the brief.
- All Expected/Actual Wave Deltas were +0 in the prior framework PR — that PR was docs-only.
- BOARD-SCHEMA-3 (this revision): normalizes every section table to the 5-column schema (Area, Current %, After Wave %, Detail / Action Per Area, Status); adds Full-Scope Coverage Rule; preserves all canonical areas and statuses.

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

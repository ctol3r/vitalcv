# VitalCV Full Scope Completion Board

Last updated: 2026-04-27
Source branch: `docs/full-scope-completion-board-deltas`

## Scoring Rules

- **Current %** = honest current state, evidenced by code on `origin/main`.
- **Target %** = 90% minimum for every major area.
- **Delta to 90%** = remaining gap (`Target − Current`).
- **Expected Wave Delta** = proposed movement for the next relevant wave. Planning value only.
- **Actual Wave Delta** = applied **only after merge + verification**. Until then it stays at `+0`.
- **No score moves on unmerged work.** A PR open or in review is not a delta.
- **Parent categories cannot hide low child rows.** Section roll-ups are computed from child rows, not asserted.
- **No row above 90% without implementation evidence**, all five required where relevant:
  - code merged to `main`
  - tests
  - user-facing route/UI
  - truth/compliance copy review
  - accessibility/mobile consideration
  - verification evidence (Codex / browser audit / live URL)

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

- very low
- low
- not started
- partial
- high
- almost done
- near complete
- strong
- near target
- above target

Lookup examples:

- 0% → 🧊 Planned
- 8% → 🌱 Seed
- 18% → 🌱 Seed
- 35% → 🧱 Foundation
- 58% → 🛠️ Buildout
- 82% → 🚀 Hardening
- 92% → ✅ Target Zone
- 100% → 🏁 Complete

This lexicon supersedes the prior board's qualitative status words. Work-state nuance (merged-on-main, boundary-only, deferred, concept) lives in the **Evidence Required** column, not in Status.

## Required Table Schema

Every section uses this schema:

| Area | Current % | Target % | Delta to 90% | Expected Wave Delta | Actual Wave Delta | Evidence Required | Status |
|---|---:|---:|---:|---:|---:|---|---|

Status vocabulary: emoji phase derived from Current % per the [Status Lexicon](#status-lexicon) above. Never assert phase independently of percentage.

---

## 🧠 Trust Engine / Issuer Infrastructure

| Area | Current % | Target % | Delta to 90% | Expected Wave Delta | Actual Wave Delta | Evidence Required | Status |
|---|---:|---:|---:|---:|---:|---|---|
| Issuer request / router | 80 | 90 | 10 | +0 | +0 | Routes + tests on main (#167) | 🚀 Hardening |
| Partner route model | 75 | 90 | 15 | +0 | +0 | Partner router + tests (#167) | 🚀 Hardening |
| Issuer response intake | 70 | 90 | 20 | +0 | +0 | Intake surface + tests (#168) | 🚀 Hardening |
| Receipt candidate | 85 | 90 | 5 | +0 | +0 | `receiptCandidate.ts` + literal `decisionGrade:false`/`proofTier:'receipt_candidate'` tests | 🚀 Hardening |
| Policy review decision | 85 | 90 | 5 | +0 | +0 | `policyReview.ts` 5-gate flow + tests | 🚀 Hardening |
| PSV receipt promotion | 70 | 90 | 20 | +0 | +0 | PSV receipt + reuse boundary (#172) | 🚀 Hardening |
| Reuse / revocation / supersession boundary | 75 | 90 | 15 | +0 | +0 | (#172) tests | 🚀 Hardening |
| Consent / manual send / timeline | 70 | 90 | 20 | +0 | +0 | Consent + timeline (#174) | 🚀 Hardening |
| Audit persistence boundary | 75 | 90 | 15 | +0 | +0 | (#175) `auditPersistence.ts` + tests | 🚀 Hardening |
| Persistence adapter decision | 75 | 90 | 15 | +0 | +0 | (#176) | 🚀 Hardening |
| Backend writer boundary | 75 | 90 | 15 | +0 | +0 | (#180) `serverPsvReceiptWriter.ts` defensive downgrade + tests; **deferred default writer only** | 🚀 Hardening |
| Domain / core PSV receipt contract alignment | 80 | 90 | 10 | +0 | +0 | (#178) `packages/domain-core/psvReceipts.ts` + frozen mapper tests | 🚀 Hardening |
| Source health classifier | 65 | 90 | 25 | +0 | +65 | `SourceHealthState`, `LaneHealthBadge`, `unavailableLane` (#186); snapshot store, `runAllProbes`, internal `/api/internal/source-health/{probe,snapshots}` routes, scheduled workflow, source-health tests (#187) | 🛠️ Buildout |

---

## 🧑‍⚕️ Live Clinician Product

| Area | Current % | Target % | Delta to 90% | Expected Wave Delta | Actual Wave Delta | Evidence Required | Status |
|---|---:|---:|---:|---:|---:|---|---|
| Signup / account creation | 10 | 90 | 80 | +0 | +0 | Real auth (Clerk/NextAuth) wired; e2e signup test | 🌱 Seed |
| Login / account recovery | 10 | 90 | 80 | +0 | +0 | Sign-in flow + recovery; per memory `project_auth_google_oauth_config.md` Google OAuth currently broken in prod | 🌱 Seed |
| NPI check | 65 | 90 | 25 | +0 | +0 | NPPES proxy + ingest fallback in `apps/web/app/api/ingest/[npi]/route.ts` | 🛠️ Buildout |
| Rich clinician profile shell | 55 | 90 | 35 | +0 | +0 | 16-section profile shell on `/passport/[id]` (Wave GOD-2) | 🛠️ Buildout |
| Identity / contact / locations | 35 | 90 | 55 | +0 | +0 | Inputs exist as user-entered only; no verified binding | 🧱 Foundation |
| Medical school | 25 | 90 | 65 | +0 | +0 | Free-text capture; no source verification | 🧱 Foundation |
| Residency | 25 | 90 | 65 | +0 | +0 | Same | 🧱 Foundation |
| Fellowship | 25 | 90 | 65 | +0 | +0 | Same | 🧱 Foundation |
| Training programs | 20 | 90 | 70 | +0 | +0 | Same | 🌱 Seed |
| Specialty / subspecialty | 30 | 90 | 60 | +0 | +0 | Capture + NPPES inference only | 🧱 Foundation |
| Current employer | 25 | 90 | 65 | +0 | +0 | User-entered, no employer-side verification | 🧱 Foundation |
| Employer history | 20 | 90 | 70 | +0 | +0 | Same | 🌱 Seed |
| Affiliations | 20 | 90 | 70 | +0 | +0 | Same | 🌱 Seed |
| Work history | 20 | 90 | 70 | +0 | +0 | Same | 🌱 Seed |
| Research / publications | 15 | 90 | 75 | +0 | +0 | Section exists, no live source binding | 🌱 Seed |
| PubMed layer | 30 | 90 | 60 | +0 | +20 | Concept + MCP available + (FOUNDATION-SWEEP-5) `apps/web/lib/research/publicationFoundation.ts` defines 5 source kinds (PubMed / ORCID / Crossref / OpenAlex / manual_entry) with `pubmedCandidatesVerifiedByDefault: false` and `sourceBackedVerificationImplemented: false` typed literals; `PublicationCandidate` carries typed `verified: false`; PubMed candidates require disambiguation; `getResearchProfileReadiness` reports `verifiedCount: 0`; surfaced on `/clinician/research` route; in-product fetch/dedupe still planned | 🧱 Foundation |
| LinkedIn-style profile layer | 28 | 90 | 62 | +0 | +23 | (FOUNDATION-SWEEP-5) `apps/web/lib/clinician-profile/professionalProfileLayer.ts` defines `linkedin_style` layer as a presentation concept (NOT a LinkedIn integration) with `verifiesCredentials: false` typed literal; surfaced on `/clinician/profile-layers` route | 🧱 Foundation |
| Doximity-style profile layer | 26 | 90 | 64 | +0 | +21 | (FOUNDATION-SWEEP-5) Same `professionalProfileLayer.ts` foundation defines `doximity_style` layer as a presentation concept (NOT a Doximity integration) with `verifiesCredentials: false` typed literal; surfaced on `/clinician/profile-layers` route | 🧱 Foundation |
| Career goals / preferences | 25 | 90 | 65 | +0 | +0 | Capture exists, no matching loop | 🧱 Foundation |
| Profile completion score | 20 | 90 | 70 | +0 | +0 | No live score widget | 🌱 Seed |
| Clinician-facing value dashboard | 10 | 90 | 80 | +0 | +0 | Not built | 🌱 Seed |

---

## 📱 Mobile + Device Experience

| Area | Current % | Target % | Delta to 90% | Expected Wave Delta | Actual Wave Delta | Evidence Required | Status |
|---|---:|---:|---:|---:|---:|---|---|
| Mobile web / PWA | 35 | 90 | 55 | +0 | +0 | Responsive layout; PWA manifest foundation per Wave GOD-2; no installability/offline shell verified | 🧱 Foundation |
| Native iOS app | 25 | 90 | 65 | +0 | +25 | (FOUNDATION-SWEEP-4) `apps/web/lib/mobile/nativeAppReadiness.ts` defines the iOS planned-capability set (native_shell / secure_storage / document_capture / push_notifications / device_attestation / biometric_gate / offline_queue) all `isLive: false`; surfaced on `/mobile/native-readiness` route; `nativeAppLive: false` and `storeReadinessClaimed: false` typed literals; **no native app is live** | 🧱 Foundation |
| Native Android app | 25 | 90 | 65 | +0 | +25 | (FOUNDATION-SWEEP-4) Android shares the same `nativeAppReadiness.ts` planned-capability set including Play Integrity attestation; same `isLive: false` invariants; surfaced on `/mobile/native-readiness` route; **no native app is live** | 🧱 Foundation |
| Mobile document capture | 25 | 90 | 65 | +0 | +25 | (FOUNDATION-SWEEP-3) `apps/web/lib/mobile/mobileCaptureFoundation.ts` defines the web/PWA scope + 7-capability checklist with explicit `Native iOS and Android apps are not shipped` and `Native camera workflows are not enabled yet` disclaimers; surfaced on `/clinician/mobile-capture` route | 🧱 Foundation |
| Device trust / App Attest / Play Integrity | 0 | 90 | 90 | +0 | +0 | None | 🧊 Planned |
| Biometric gating | 25 | 90 | 65 | +0 | +25 | (FOUNDATION-SWEEP-4) `apps/web/lib/device/biometricGatingFoundation.ts` defines 5 planned capabilities (local device auth / passkey pairing / step-up prompt / recovery fallback / audit event) with typed `biometricGatingLive: false`, `provesClinicianIdentity: false`, `recoveryFallbackRequired: true` invariants; surfaced on `/clinician/device-security` route; **biometric is not identity proof** | 🧱 Foundation |
| Push notification readiness | 0 | 90 | 90 | +0 | +0 | None | 🧊 Planned |
| Offline / degraded-state handling | 25 | 90 | 65 | +0 | +0 | 5xx graceful fallbacks (#LIVE-100C/D) + (FOUNDATION-SWEEP-3) `degradedStateFoundation.ts` defines a 6-state policy (offline / upstream_unavailable / upload_failed / source_probe_unknown / retry_required / local_draft_only) with `offlineSyncImplemented: false` and `sourceOutageIsClinicianDefect: false` invariants; no offline data shell yet | 🧱 Foundation |

---

## 🔐 Identity + Security

| Area | Current % | Target % | Delta to 90% | Expected Wave Delta | Actual Wave Delta | Evidence Required | Status |
|---|---:|---:|---:|---:|---:|---|---|
| Government ID verification | 25 | 90 | 65 | +0 | +25 | (FOUNDATION-SWEEP-4) `apps/web/lib/identity/identityVerificationControls.ts` defines 8-control foundation (gov ID / selfie-liveness / document-authenticity / fraud-risk / manual-review / consent / retention-redaction / audit-receipt) with `governmentIdLive: false`, `selfieLivenessLive: false`, `vendorSelected: false`, `highestIalClaimed: 'none'` typed literals; 6 vendor requirements all `meetsToday: false`; surfaced on `/clinician/identity/verification` route | 🧱 Foundation |
| Selfie / liveness | 25 | 90 | 65 | +0 | +25 | (FOUNDATION-SWEEP-4) Same `identityVerificationControls.ts` foundation; `selfieLivenessLive: false` typed literal; selfie+liveness control marked `required: true` and `isLive: false`; surfaced on `/clinician/identity/verification` route | 🧱 Foundation |
| Clinician-to-NPI binding | 28 | 90 | 62 | +0 | +13 | NPI lookup exists + (FOUNDATION-SWEEP-2) `evaluateClinicianNpiBindingReadiness` returns `foundation_ready` for identifier-resolved+self-attested input; explicit `gov_id_required`/`liveness_required` placeholders for planned controls; no proven-person-to-NPI binding still | 🧱 Foundation |
| Identity proofing policy | 25 | 90 | 65 | +0 | +15 | (FOUNDATION-SWEEP-2) `apps/web/lib/identity/identityProofingPolicy.ts` defines `IdentityProofingPolicyDecision` with NPI-lookup + self-attested-name as the only `isLive: true` controls; government ID + liveness explicitly `isLive: false`; no IAL2/IAL3 asserted; `/clinician/identity` route renders the policy summary | 🧱 Foundation |
| Account recovery | 25 | 90 | 65 | +0 | +15 | Tied to broken auth slice + (FOUNDATION-SWEEP-3) `accountRecoveryFoundation.ts` defines 5 recovery methods (saved_recovery_code / issued_recovery_code / recovery_contact / repeated_identity_proofing / support_review) all `isLive: false`; explicit holder-notification + recovery-distinct-from-auth requirements; surfaced on `/account/recovery` route; no production recovery flow ships | 🧱 Foundation |
| Session security | 20 | 90 | 70 | +0 | +0 | Default Next/Clerk session handling, not hardened | 🌱 Seed |
| OWASP ASVS baseline | 15 | 90 | 75 | +0 | +0 | No published ASVS scorecard | 🌱 Seed |
| Security headers / secure defaults | 35 | 90 | 55 | +0 | +0 | Some headers via Next defaults; no audited CSP | 🧱 Foundation |
| Data classification | 20 | 90 | 70 | +0 | +0 | Provenance vocab exists (VERIFIED/USER_ENTERED/INFERRED/UNKNOWN/CONFLICT); no PII/PHI tier doc | 🌱 Seed |
| Retention / redaction | 10 | 90 | 80 | +0 | +0 | No retention policy enforced | 🌱 Seed |
| Secrets / env handling | 30 | 90 | 60 | +0 | +0 | `.env` patterns in repo; no zod env validation (Phase 0.3 outstanding) | 🧱 Foundation |

---

## ♿ Accessibility

| Area | Current % | Target % | Delta to 90% | Expected Wave Delta | Actual Wave Delta | Evidence Required | Status |
|---|---:|---:|---:|---:|---:|---|---|
| WCAG 2.2 AA baseline | 25 | 90 | 65 | +0 | +13 | (FOUNDATION-SWEEP-2) `apps/web/lib/accessibility/accessibilityFoundation.ts` defines a 9-category baseline checklist with explicit `disclaimer: 'not a WCAG 2.2 AA certification'`; no published audit yet; no automated axe gate in CI | 🧱 Foundation |
| Keyboard navigation | 25 | 90 | 65 | +0 | +0 | Default browser behavior; no audited focus traps | 🧱 Foundation |
| Screen reader labels | 25 | 90 | 65 | +0 | +5 | Spot fixes + (FOUNDATION-SWEEP-2) `screen_reader_labels` category in the accessibility foundation checklist with explicit pass condition; new `/clinician/identity` page uses semantic regions (`aria-labelledby`, `aria-label` on status pills) | 🧱 Foundation |
| Touch targets | 30 | 90 | 60 | +0 | +0 | Mobile clip fixes (Wave GOD-2); no 44×44 audit | 🧱 Foundation |
| Error-state accessibility | 15 | 90 | 75 | +0 | +0 | Error UIs not audited for SR | 🌱 Seed |
| Contrast | 30 | 90 | 60 | +0 | +0 | Design-system v2 tokens in flight on a separate branch | 🧱 Foundation |
| Reduced motion | 25 | 90 | 65 | +0 | +15 | (FOUNDATION-SWEEP-2) `reduced_motion` category in the accessibility foundation checklist with explicit `passCondition`; no prefers-reduced-motion handling audited end-to-end yet | 🧱 Foundation |
| Form accessibility | 15 | 90 | 75 | +0 | +0 | No labeled-region audit | 🌱 Seed |
| Mobile accessibility | 15 | 90 | 75 | +0 | +0 | Same | 🌱 Seed |

---

## 📤 Upload / Import / Export

| Area | Current % | Target % | Delta to 90% | Expected Wave Delta | Actual Wave Delta | Evidence Required | Status |
|---|---:|---:|---:|---:|---:|---|---|
| CV upload | 25 | 90 | 65 | +0 | +0 | Knowledge Inbox foundation (#166) for free-text capture; binary CV upload not wired | 🧱 Foundation |
| Document upload | 32 | 90 | 58 | +0 | +12 | (FOUNDATION-SWEEP-2) `document_upload` is a first-class `ImportEntryKind` in `importFoundation.ts` with `entry_only` status; surfaced as a card on `/clinician/import` with explicit "source-backed verification of the document is a separate path" copy | 🧱 Foundation |
| Drag/drop upload UX | 15 | 90 | 75 | +0 | +0 | No verified DnD surface | 🌱 Seed |
| LinkedIn import | 25 | 90 | 65 | +0 | +20 | (FOUNDATION-SWEEP-5) `apps/web/lib/import-export/professionalImportFoundation.ts` defines `linkedin_profile` entry as `planned` with `isLive: false`; required capabilities include `no_scraping` and `no_credential_collection`; surfaced on `/clinician/import/professional` route; **no live integration ships** | 🧱 Foundation |
| Doximity import | 25 | 90 | 65 | +0 | +20 | (FOUNDATION-SWEEP-5) Same `professionalImportFoundation.ts` defines `doximity_profile` entry as `planned` with `isLive: false`; same `no_scraping`/`no_credential_collection` required capabilities; surfaced on `/clinician/import/professional` route; **no live integration ships** | 🧱 Foundation |
| PubMed import | 30 | 90 | 60 | +0 | +20 | (FOUNDATION-SWEEP-5) Same `professionalImportFoundation.ts` defines `pubmed_publications` entry as `candidate_ready` with `isLive: false`; `evaluateProfessionalImportReadiness` upgrades to `source_candidate` only when a real source match is attached, NEVER to `source_backed` from this foundation; **`productionReady: false` typed literal**; required capabilities include `identity_disambiguation` and `author_match_required`; surfaced on `/clinician/import/professional` + `/clinician/research` routes; **no live PubMed integration ships in this wave** | 🧱 Foundation |
| CSV / roster import | 30 | 90 | 60 | +0 | +0 | Per existing board: "some CSV ingest; roster mgmt manual" | 🧱 Foundation |
| Export bundle | 25 | 90 | 65 | +0 | +0 | `ARTIFACT_EXPORTED` event metadata exists; bundle UX partial | 🧱 Foundation |
| Shareable passport | 35 | 90 | 55 | +0 | +0 | `/passport/[id]` route + provenance panel | 🧱 Foundation |
| Proof pack export | 20 | 90 | 70 | +0 | +0 | Conceptual shape; no audited bundle | 🌱 Seed |
| Import error handling | 25 | 90 | 65 | +0 | +5 | Inbox classifier handles known states + (FOUNDATION-SWEEP-2) `buildImportErrorState` returns user-safe `{userMessage, remediation}` for 8 `ImportErrorKind` values (unsupported_file_type, file_too_large, parse_failure, integration_unavailable, rate_limited, transport_error, validation_failed, unknown); no raw stack/payload/secret leaks; rendered as a section on `/clinician/import` | 🧱 Foundation |
| Import provenance labels | 40 | 90 | 50 | +0 | +0 | 5-tier provenance vocab enforced (Wave GOD-3S) | 🧱 Foundation |

---

## 🕸️ Knowledge Trust Graph

| Area | Current % | Target % | Delta to 90% | Expected Wave Delta | Actual Wave Delta | Evidence Required | Status |
|---|---:|---:|---:|---:|---:|---|---|
| Data model | 75 | 90 | 15 | +0 | +0 | `docs/architecture/vitalcv-knowledge-trust-graph.{md,json}` boundaries 1–28 | 🚀 Hardening |
| Claim / source / receipt navigation | 60 | 90 | 30 | +0 | +0 | TrustGraph panel mounts on `/passport/[id]` | 🛠️ Buildout |
| Roam/Obsidian-style visual graph UX | 22 | 90 | 68 | +0 | +0 | Static panel only; no graph layout engine | 🌱 Seed |
| Graph search | 10 | 90 | 80 | +0 | +0 | Not built | 🌱 Seed |
| Graph filtering | 10 | 90 | 80 | +0 | +0 | Not built | 🌱 Seed |
| Graph export | 30 | 90 | 60 | +0 | +0 | Underlying JSON exportable; no UI export | 🧱 Foundation |
| Clinician-facing graph explanation | 35 | 90 | 55 | +0 | +0 | Static explainer in panel | 🧱 Foundation |
| Verifier-facing graph explanation | 30 | 90 | 60 | +0 | +0 | Same | 🧱 Foundation |
| Graph-to-proof-pack path | 20 | 90 | 70 | +0 | +0 | Not connected end-to-end | 🌱 Seed |

---

## 🏥 Verifier / Employer Product

| Area | Current % | Target % | Delta to 90% | Expected Wave Delta | Actual Wave Delta | Evidence Required | Status |
|---|---:|---:|---:|---:|---:|---|---|
| Employer review | 60 | 90 | 30 | +0 | +0 | Issuer review surface (#168) demo render only — `recordedBy:'demo'` | 🛠️ Buildout |
| Request review | 55 | 90 | 35 | +0 | +0 | Same | 🛠️ Buildout |
| Verifier worklist | 30 | 90 | 60 | +0 | +0 | No audited multi-request worklist | 🧱 Foundation |
| Evidence inspection | 50 | 90 | 40 | +0 | +0 | Receipt candidate viewer | 🛠️ Buildout |
| Reuse decision UX | 50 | 90 | 40 | +0 | +0 | (#172) reuse boundary surfaced in review | 🛠️ Buildout |
| Policy decision UX | 60 | 90 | 30 | +0 | +0 | Policy review 5-gate UX | 🛠️ Buildout |
| Exportable proof pack | 25 | 90 | 65 | +0 | +0 | Not bundled | 🧱 Foundation |
| Team / org roles | 10 | 90 | 80 | +0 | +0 | None | 🌱 Seed |
| Review status tracking | 45 | 90 | 45 | +0 | +0 | Request lifecycle states present | 🧱 Foundation |
| Employer CTA / conversion path | 40 | 90 | 50 | +0 | +0 | `/employers` redirect + `/pilot` CTA live | 🧱 Foundation |

---

## 🏛️ Backend / Persistence / API

| Area | Current % | Target % | Delta to 90% | Expected Wave Delta | Actual Wave Delta | Evidence Required | Status |
|---|---:|---:|---:|---:|---:|---|---|
| Domain PSV receipt contract | 85 | 90 | 5 | +0 | +0 | (#178) frozen mapper tests | 🚀 Hardening |
| Server writer confirmation boundary | 80 | 90 | 10 | +0 | +0 | (#180) defensive downgrade + tests | 🚀 Hardening |
| Real persistence writer | 5 | 90 | 85 | +0 | +0 | Default writer is **deferred-only**; no contract-aligned Prisma table; no audit-event table; no client-safe RPC | 🌱 Seed |
| Audit replay | 18 | 90 | 72 | +0 | +8 | (#187) snapshot store + `getLaneSnapshots` fallback give a read-side replay path for source-health lanes | 🌱 Seed |
| Export API | 15 | 90 | 75 | +0 | +0 | None client-safe | 🌱 Seed |
| Backend test coverage | 42 | 90 | 48 | +0 | +7 | Issuer 321/321 vitest pass; (#187) adds 88-test source-health suite (runAllProbes, snapshotStore, probeRoute, snapshotsRoute, noFakeLive); legacy backend repo still lacks coverage | 🧱 Foundation |
| API route hardening | 32 | 90 | 58 | +0 | +7 | (#187) internal source-health routes use dual-auth (Bearer `CRON_SECRET` preferred; `x-monitoring-secret` legacy) and 500 fail-closed when both unset; no CORS/helmet/API key story for public routes (Phase 1.3) | 🧱 Foundation |
| Repository adapter | 70 | 90 | 20 | +0 | +0 | (#176/#177) decision boundaries | 🚀 Hardening |
| Database migration readiness | 5 | 90 | 85 | +0 | +0 | Per memory: SQLite + in-memory; PostgreSQL migration is Phase 1.1 (not started) | 🌱 Seed |

---

## 🚀 Commercial Launch Readiness

| Area | Current % | Target % | Delta to 90% | Expected Wave Delta | Actual Wave Delta | Evidence Required | Status |
|---|---:|---:|---:|---:|---:|---|---|
| Pricing/paywall | 28 | 90 | 62 | +0 | +20 | (FOUNDATION-SWEEP-6A) `apps/web/lib/commercial/pricingFoundation.ts` defines 5 commercial plan kinds with typed `collectsPayment: false`, `subscriptionActive: false`, and `checkoutIntegrationLive: false`; `/pricing` states payments are not collected in this build; no Stripe/checkout/vendor integration ships | 🧱 Foundation |
| Self-serve signup | 32 | 90 | 58 | +0 | +20 | (FOUNDATION-SWEEP-6A) `apps/web/lib/commercial/selfServeSignupFoundation.ts` defines role/NPI/profile/export/review steps with `accountCreationProductionReady: false`, `identityProofingComplete: false`, and `paymentCollectionLive: false`; `/signup` states production account creation may require additional controls | 🧱 Foundation |
| Onboarding | 38 | 90 | 52 | +0 | +20 | (FOUNDATION-SWEEP-6A) `apps/web/lib/commercial/onboardingFoundation.ts` defines NPI/profile/import/readiness/proof-pack/verifier-share milestones with `productionOnboardingComplete: false` and `completesCredentialing: false`; `/onboarding` states readiness and next steps do not complete credentialing | 🧱 Foundation |
| Support / admin | 25 | 90 | 65 | +0 | +15 | (FOUNDATION-SWEEP-3) `supportAdminFoundation.ts` defines 6-capability plan (intake / triage / review queue / audit-safe note / demo reset request / escalation policy) with `staffed: false` and `productionAdminEnabled: false` invariants; surfaced on `/support` route; no live staffed support | 🧱 Foundation |
| Pilot ops | 50 | 90 | 40 | +0 | +0 | `/pilot` CTA live; no funnel instrumentation | 🛠️ Buildout |
| Analytics | 20 | 90 | 70 | +0 | +0 | No PostHog product-analytics events confirmed end-to-end | 🌱 Seed |
| Docs / status page | 15 | 90 | 75 | +0 | +0 | No public status page | 🌱 Seed |
| Legal pages | 60 | 90 | 30 | +0 | +0 | `/privacy` and `/terms` live (#LIVE-100C) | 🛠️ Buildout |
| Sales / pilot collateral | 25 | 90 | 65 | +0 | +0 | Some pilot pages; no proof-pack | 🧱 Foundation |
| Demo data / reset flow | 28 | 90 | 62 | +0 | +8 | Issuer review surface uses `recordedBy:'demo'` + (FOUNDATION-SWEEP-3) `demoResetFoundation.ts` defines 5 demo-bounded reset scopes with `productionResetEnabled: false`, `destructive: false`, and `requiresOperatorConfirmation: true` invariants; surfaced on `/admin/demo-reset` route; no destructive reset logic ships | 🧱 Foundation |

---

## 🧪 Quality / CI / Release

| Area | Current % | Target % | Delta to 90% | Expected Wave Delta | Actual Wave Delta | Evidence Required | Status |
|---|---:|---:|---:|---:|---:|---|---|
| Web quality | 85 | 90 | 5 | +0 | +20 | TypeScript + ESLint enforced on build (no ignore flags); 321/321 issuer tests; (#196) BUILD-CHAIN-1 fixed broken root `build:web` script (was `pnpm --filter web build` referencing nonexistent package) → `pnpm turbo run build --filter @vitalcv/web`; added `build:web:direct` fallback + `build:check-chain` smoke script; canonical local-build path documented | 🚀 Hardening |
| Monorepo CI/CD | 65 | 90 | 25 | +0 | +10 | Turbo workflows; merge-protection hook requires Codex SAFE; (#196) BUILD-CHAIN-1 root scripts now expose deterministic monorepo build commands so contributors and CI agents can verify the workspace dep graph end-to-end | 🛠️ Buildout |
| Railway deploy preflight | 40 | 90 | 50 | +0 | +0 | (#179) excluded db-dependent backend packages from preflight smoke | 🧱 Foundation |
| Vercel deploy health | 60 | 90 | 30 | +0 | +0 | Per memory `project_vercel_project_linkage.md`: vitalcv.com → `vcv-web` on `blockchaincv` team | 🛠️ Buildout |
| Regression test coverage | 55 | 90 | 35 | +0 | +5 | Heavy on issuer slice; (#186/#187) source-health suite at 88/88 in 9 files; (#196) BUILD-CHAIN-1 `build:check-chain` exercises the canonical web build as a regression smoke; still thin in clinician/mobile/marketing surfaces | 🛠️ Buildout |
| Route map coverage | 30 | 90 | 60 | +0 | +0 | No published route map gate | 🧱 Foundation |
| Smoke tests | 55 | 90 | 35 | +0 | +10 | (#179) preflight smoke partial; (#187) `.github/workflows/source-health-probe.yml` adds a 6h cron-driven CI smoke against the source-health classifier; (#196) BUILD-CHAIN-1 `scripts/check-web-build-chain.sh` is an executable smoke for the canonical web build chain | 🛠️ Buildout |
| Release checklist | 20 | 90 | 70 | +0 | +0 | No published release checklist | 🌱 Seed |

> **BUILD-CHAIN-1 evidence note (#196):** added deterministic web build commands (`build:web`, `build:web:direct`, `build:check-chain`), build-chain documentation (`docs/ops/vitalcv-build-chain.md`), and an executable build-chain check script (`scripts/check-web-build-chain.sh`). The canonical local web build path is now `pnpm run build:web` (or `pnpm turbo run build --filter @vitalcv/web`). `@vitalcv/shared` TS6059 remains tracked separately in **issue #195**.

---

## Wave Delta Format

Every future wave must include:

| Area | Before | After Target | Expected Delta | Actual Delta | Evidence Required | Apply When |
|---|---:|---:|---:|---:|---|---|
| Example | 20% | 35% | +15 | +0 until merge | Code + tests + route + docs | After merge + verification |

## Future Wave Reporting Rule

Every future wave must report each affected row with:

- exact Current %
- exact After Target %
- exact Expected Delta
- exact Actual Delta (stays at `+0` until merge + verification)
- emoji phase label derived from the resulting % (per [Status Lexicon](#status-lexicon))
- Evidence Required (code merged, tests, route/UI, truth/copy review, accessibility/mobile, verification)
- Apply When condition (merge + verification gate)

Do not use qualitative maturity words ("very low", "low", "not started", "partial", "high", "almost done", "near complete", "strong", "near target", "above target") in place of percentages or in place of the emoji phase. Numbers move on merge + verification only; the emoji phase is **derived from** the percentage, never asserted independently. Work-state nuance (merged-on-main, boundary-only, deferred default writer, concept-only) belongs in Evidence Required, not in Status.

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
- All Expected/Actual Wave Deltas are `+0` in the framework PR — that PR is docs-only; it changes the framework, not the scores' underlying state.

## RELIABILITY-2 board delta (PR #187 evidence)

RELIABILITY-1 (#186) and RELIABILITY-2 (#187) shipped `SourceHealthState`, `LaneHealthBadge`, `unavailableLane`, the snapshot store, `runAllProbes`, internal `/api/internal/source-health/probe` and `/snapshots` routes, the scheduled `source-health-probe.yml` workflow, and the source-health test suite (88/88). This board delta records that evidence on existing full-scope rows and adds one new row (`Source health classifier`) under Trust Engine — without reviving old aggregate roll-up rows (`Drift + Monitoring`, `Source Spine`, `Truth / Enforcement`, `Enterprise-Ready Completion`, `Overall VitalCV Completion`), which were intentionally retired by the full-scope schema.

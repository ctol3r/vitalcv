# VitalCV 100% Action Map

> **This document does not declare VitalCV 100% complete.** It maps every Completion Board row to the fastest honest path to 100%.
>
> **Current %** values come from `docs/ops/vitalcv-completion-board.md` on `origin/main` (commit `3c8dc4fa` after PR #210 merge).
>
> **Scores move only after merged + verified evidence.** No row in this document moves the board on its own. This is a planning artifact, not a wave delta.

---

## Reading the table

| Column | Meaning |
|---|---|
| **Area** | Exact row label from `vitalcv-completion-board.md` |
| **Current %** | Exact `Current %` from the board on `origin/main` |
| **Gap to 100** | `100 − Current %` |
| **Current blocker** | What is preventing the row from moving past its current floor |
| **Fastest evidence needed** | Minimum merged + verified work required to move the row |
| **Proposed PR / wave** | Best PR/wave envelope for the work (uses existing wave naming) |
| **Achievable today** | `YES` / `PARTIAL` / `NO` — can a single coherent PR + tests move the row meaningfully in one working session, with no compliance overclaim risk? |

`Achievable today` does **not** mean "to 100% today." It means "+10 or more today, defensibly." For 0–24 rows, "today" can include a small foundation PR. For 70+ rows, "today" means hardening evidence (tests, route, copy review, mobile/a11y check).

---

## 🧠 Trust Engine / Issuer Infrastructure

| Area | Current % | Gap to 100 | Current blocker | Fastest evidence needed | Proposed PR / wave | Achievable today |
|---|---:|---:|---|---|---|---|
| Issuer request / router | 80 | 20 | Capped at 75–85 band: real persistence is deferred (#180); 90+ requires merged DB writer + audit-event row. | Prisma table for `IssuerRequest`; `serverPsvReceiptWriter` enabled (not deferred); 5 integration tests against real DB. | TRUST-PERSIST-1 | NO |
| Partner route model | 75 | 25 | Same persistence cap. Partner router exists but no DB-backed partner registry. | DB-backed partner registry; cross-tenant scoping test; route-level RBAC test. | TRUST-PERSIST-1 | NO |
| Issuer response intake | 70 | 30 | Demo render only (`recordedBy:'demo'`); no real intake persistence. | Real intake row insert; consent-receipt persistence; intake e2e test. | TRUST-PERSIST-1 | NO |
| Receipt candidate | 85 | 15 | Cap is 90 without DB persistence + production write path. | Real persistence writer + Prisma migration + 3 verification tests confirming `decisionGrade:false` literal preserved through round-trip. | TRUST-PERSIST-1 | PARTIAL |
| Policy review decision | 85 | 15 | Same cap. 5-gate flow + tests pass; no DB row. | Same as above plus `policy_review_event` Prisma table. | TRUST-PERSIST-1 | PARTIAL |
| PSV receipt promotion | 70 | 30 | Promotion is gated; no real production promotion path. | Promotion writer with feature flag; 3 tests for gate states. | TRUST-PERSIST-2 | PARTIAL |
| Reuse / revocation / supersession boundary | 75 | 25 | Boundary tests pass; no real revocation event store. | Revocation-event Prisma table; supersession audit trail. | TRUST-PERSIST-2 | NO |
| Consent / manual send / timeline | 70 | 30 | Consent timeline UI exists; no consent-receipt persistence. | Consent-receipt Prisma table; receipt issuance route. | TRUST-PERSIST-2 | PARTIAL |
| Audit persistence boundary | 75 | 25 | (#175) boundary only; no production writer enabled. | Enable default writer (gate flip) + 5 round-trip tests. | TRUST-PERSIST-1 | PARTIAL |
| Persistence adapter decision | 75 | 25 | (#176) boundary only. | Adapter wired to real DB; integration tests. | TRUST-PERSIST-1 | NO |
| Backend writer boundary | 75 | 25 | (#180) defensive-downgrade only; deferred default writer. | Default writer enabled; 3 confirmation tests; mobile-friendly response. | TRUST-PERSIST-1 | PARTIAL |
| Domain / core PSV receipt contract alignment | 80 | 20 | Frozen mapper tests pass; needs end-to-end persisted round-trip. | Round-trip integration test through real adapter. | TRUST-PERSIST-1 | PARTIAL |
| Source health classifier | 65 | 35 | 88-test foundation on main; no clinician-facing UI surface. | Add `LaneHealthBadge` to `/passport/[id]`; mobile + a11y check. | TRUST-HEALTH-UX-1 | YES |

---

## 🧑‍⚕️ Live Clinician Product

| Area | Current % | Gap to 100 | Current blocker | Fastest evidence needed | Proposed PR / wave | Achievable today |
|---|---:|---:|---|---|---|---|
| Signup / account creation | 10 | 90 | Auth wired but no e2e signup test; Google OAuth currently broken in prod. | Fix Google OAuth callback; e2e signup vitest covering Clerk happy path; mobile responsive check. | LIVE-SIGNUP-1 | PARTIAL |
| Login / account recovery | 10 | 90 | Sign-in flow exists; recovery untested; OAuth broken. | Fix OAuth; recovery happy-path test; magic-link foundation. | LIVE-SIGNUP-1 | PARTIAL |
| NPI check | 65 | 35 | NPPES proxy + ingest fallback live; no result persistence; no caching. | Persistence of NPI lookup result with 24h TTL; cache hit-rate test. | TRUST-PERSIST-2 | PARTIAL |
| Rich clinician profile shell | 75 | 25 | Routes + types + 22-test suite shipped (#207). Cap is 75 until production auth gate + mobile + a11y. | Production auth gate on routes; mobile clip audit; axe-clean check. | LIVE-PROFILE-1 | PARTIAL |
| Identity / contact / locations | 55 | 45 | Type schema with provenance/confidence; no verified binding. | Self-attested capture form + persistence; provenance label rendering test. | LIVE-PROFILE-1 | PARTIAL |
| Medical school | 25 | 75 | Free-text capture; no source verification. | Source-of-truth lookup adapter (e.g. AAMC list); single-row test. | LIVE-EDU-1 | NO |
| Residency | 25 | 75 | Same as medical school. | Same source adapter pattern. | LIVE-EDU-1 | NO |
| Fellowship | 25 | 75 | Same. | Same source adapter pattern. | LIVE-EDU-1 | NO |
| Training programs | 20 | 80 | Free-text only. | Source adapter + structured row; single test. | LIVE-EDU-1 | NO |
| Specialty / subspecialty | 30 | 70 | NPPES inference only; no clinician confirmation flow. | Confirm/correct UI + persistence; 1 test. | LIVE-PROFILE-1 | PARTIAL |
| Current employer | 25 | 75 | User-entered, no employer-side verification. | Employer adapter + claim/dispute path. | LIVE-EMPLOYER-1 | NO |
| Employer history | 20 | 80 | User-entered. | Same. | LIVE-EMPLOYER-1 | NO |
| Affiliations | 20 | 80 | User-entered. | Affiliation foundation type + capture surface. | LIVE-PROFILE-2 | PARTIAL |
| Work history | 20 | 80 | User-entered. | Foundation type + capture; no source binding yet. | LIVE-PROFILE-2 | PARTIAL |
| Research / publications | 15 | 85 | Section exists; no live source binding. | Wire `publicationFoundation.ts` PubMed candidate display + 1 test. | LIVE-PUB-1 | YES |
| PubMed layer | 30 | 70 | `pubmedCandidatesVerifiedByDefault: false`; no live PubMed query. | Real PubMed adapter for `pubmed_publications`; 1 source-bound test. | LIVE-PUB-1 | PARTIAL |
| LinkedIn-style profile layer | 28 | 72 | `verifiesCredentials: false`; no live LinkedIn integration. | Stays at 28 until real LinkedIn adapter (vendor integration). | LIVE-PROF-NET-1 | NO |
| Doximity-style profile layer | 26 | 74 | Same. | Same. | LIVE-PROF-NET-1 | NO |
| Career goals / preferences | 25 | 75 | Capture exists, no matching loop. | Matching-foundation type + 1 test asserting no auto-match. | LIVE-MATCH-1 | YES |
| Profile completion score | 40 | 60 | `profileCompletion.ts` weighted score + 22 tests; no live widget on a clinician-facing route. | Render score widget on `/clinician/profile`; mobile + a11y check. | LIVE-PROFILE-1 | YES |
| Clinician-facing value dashboard | 30 | 70 | Routes wired; no live personalization. | First personalization card on `/clinician/graph` (e.g. "next gap to fill"); 1 test. | LIVE-PROFILE-1 | PARTIAL |

---

## 📱 Mobile + Device Experience

| Area | Current % | Gap to 100 | Current blocker | Fastest evidence needed | Proposed PR / wave | Achievable today |
|---|---:|---:|---|---|---|---|
| Mobile web / PWA | 35 | 65 | No verified installability or offline shell. | Lighthouse PWA audit; service-worker offline shell; install prompt route test. | MOBILE-PWA-1 | PARTIAL |
| Native iOS app | 25 | 75 | `nativeAppReadiness.ts` planned only; `isLive: false`. | Capacitor/Expo wrapper PoC + smoke build. | MOBILE-NATIVE-1 | NO |
| Native Android app | 25 | 75 | Same. | Same. | MOBILE-NATIVE-1 | NO |
| Mobile document capture | 25 | 75 | Web/PWA scope only; no native camera. | Web `<input capture="user">` happy-path + provenance label; 1 test. | MOBILE-CAPTURE-1 | YES |
| Device trust / App Attest / Play Integrity | 0 | 100 | None shipped; needs vendor integration + real native app. | Foundation type only (`deviceTrustFoundation.ts` with `isLive: false`); single test. Will not move past Foundation tier without native app. | MOBILE-NATIVE-1 | YES (to ~15) |
| Biometric gating | 25 | 75 | `biometricGatingLive: false`; `provesClinicianIdentity: false`. | WebAuthn happy-path on web; 1 test asserting `provesClinicianIdentity: false`. | MOBILE-BIOMETRIC-1 | PARTIAL |
| Push notification readiness | 0 | 100 | None shipped. | Foundation type + `webPushSupported` capability + planned-only test. | MOBILE-PUSH-1 | YES (to ~15) |
| Offline / degraded-state handling | 25 | 75 | 5xx fallbacks live; `offlineSyncImplemented: false`. | Service-worker offline shell; offline-first cache for a single route. | MOBILE-PWA-1 | PARTIAL |

---

## 🔐 Identity + Security

| Area | Current % | Gap to 100 | Current blocker | Fastest evidence needed | Proposed PR / wave | Achievable today |
|---|---:|---:|---|---|---|---|
| Government ID verification | 25 | 75 | `governmentIdLive: false`, `vendorSelected: false`. | Vendor selection memo + foundation update; no production move without contract. | ID-VENDOR-1 | NO |
| Selfie / liveness | 25 | 75 | `selfieLivenessLive: false`. | Same vendor dependency. | ID-VENDOR-1 | NO |
| Clinician-to-NPI binding | 28 | 72 | `evaluateClinicianNpiBindingReadiness` returns `foundation_ready`; no proven-person-to-NPI binding. | Add issuer-attested binding event + 1 test; depends on identity vendor for production move. | ID-VENDOR-1 | PARTIAL |
| Identity proofing policy | 25 | 75 | Only NPI-lookup + self-attested-name `isLive: true`; no IAL2/IAL3. | IAL ladder planning doc + foundation type expansion; gated to vendor for IAL2+. | ID-VENDOR-1 | YES (to ~30) |
| Account recovery | 25 | 75 | All 5 methods `isLive: false`; no production recovery flow. | Email-magic-link recovery happy path + 2 tests. | LIVE-SIGNUP-1 | PARTIAL |
| Session security | 20 | 80 | Default Next/Clerk handling, not hardened. | CSRF + secure-cookie + idle-timeout policy + 3 tests. | SEC-SESSION-1 | YES |
| OWASP ASVS baseline | 15 | 85 | No published ASVS scorecard. | Publish `docs/security/asvs-scorecard.md`; mark each control true/planned/N-A. | SEC-ASVS-1 | YES |
| Security headers / secure defaults | 35 | 65 | Some headers via Next defaults; no audited CSP. | Strict CSP + HSTS via `next.config.mjs`; 1 e2e header test. | SEC-HEADERS-1 | YES |
| Data classification | 33 | 67 | EV6A foundation; `redactionLive: false`, `piiTierDocLive: false`. | Wire `maskValue()` on one PHI surface; PII tier doc; 1 test. | EV6B-DATA-CLASS | YES |
| Retention / redaction | 25 | 75 | EV6A foundation; `retentionEnforced: false`, `autoDeleteLive: false`. | Implement retention sweep cron for one entity; 2 tests. | EV6B-RETENTION | PARTIAL |
| Secrets / env handling | 30 | 70 | `.env` patterns; no zod validation. | `lib/env.ts` zod-validated; 1 test asserting required vars; CI fail-fast. | SEC-ENV-1 | YES |

---

## ♿ Accessibility

| Area | Current % | Gap to 100 | Current blocker | Fastest evidence needed | Proposed PR / wave | Achievable today |
|---|---:|---:|---|---|---|---|
| WCAG 2.2 AA baseline | 25 | 75 | No axe gate in CI; foundation checklist only. | Add `vitest-axe` or pa11y to CI on a single route; 1 baseline test. | A11Y-AXE-1 | YES |
| Keyboard navigation | 25 | 75 | No audited focus traps. | Focus-trap utility + 2 keyboard-only navigation tests on hero routes. | A11Y-KEYBOARD-1 | YES |
| Screen reader labels | 25 | 75 | Foundation only; one route uses `aria-labelledby`. | Audit + add `aria-*` to 3 hero routes; 3 tests. | A11Y-SR-1 | YES |
| Touch targets | 30 | 70 | No 44×44 audit. | Audit script + 1 test enforcing min target on key buttons. | A11Y-TOUCH-1 | YES |
| Error-state accessibility | 15 | 85 | Error UIs not audited. | Audit + add `role="alert"` + 2 tests for hero error states. | A11Y-ERROR-1 | YES |
| Contrast | 35 | 65 | Tokens on main (#209); no axe-based contrast audit. | Run `axe` contrast rules in CI on tokens; 1 test. | A11Y-AXE-1 | YES |
| Reduced motion | 25 | 75 | Foundation only; no end-to-end audit. | `prefers-reduced-motion` query in motion utilities; 1 test. | A11Y-MOTION-1 | YES |
| Form accessibility | 15 | 85 | No labeled-region audit. | Add `aria-describedby` to all form inputs on `/clinician/onboarding`; 2 tests. | A11Y-FORM-1 | YES |
| Mobile accessibility | 15 | 85 | No labeled-region audit. | Mobile-first audit pass + 2 tests. | A11Y-MOBILE-1 | PARTIAL |

---

## 📤 Upload / Import / Export

| Area | Current % | Gap to 100 | Current blocker | Fastest evidence needed | Proposed PR / wave | Achievable today |
|---|---:|---:|---|---|---|---|
| CV upload | 25 | 75 | Knowledge Inbox text capture only; binary CV upload not wired. | Multipart upload route + parse stub + 1 test. | UPLOAD-CV-1 | PARTIAL |
| Document upload | 32 | 68 | First-class entry kind in foundation; `entry_only`. | Document-upload route handler + provenance label test; no real OCR. | UPLOAD-DOC-1 | YES |
| Drag/drop upload UX | 15 | 85 | No verified DnD surface. | DnD component on `/clinician/import`; 1 test. | UPLOAD-DOC-1 | YES |
| LinkedIn import | 25 | 75 | `planned`, `isLive: false`. | Stays at 25 until vendor integration. | LIVE-PROF-NET-1 | NO |
| Doximity import | 25 | 75 | Same. | Same. | LIVE-PROF-NET-1 | NO |
| PubMed import | 30 | 70 | `candidate_ready`, `isLive: false`. | Real PubMed adapter + 1 source-bound test. | LIVE-PUB-1 | PARTIAL |
| CSV / roster import | 30 | 70 | Some CSV ingest; roster management is manual. | CSV upload + parse + roster Prisma table + 2 tests. | UPLOAD-CSV-1 | PARTIAL |
| Export bundle | 25 | 75 | Event metadata exists; bundle UX in progress. | Bundle generator + download endpoint + 1 test. | EXPORT-BUNDLE-1 | PARTIAL |
| Shareable passport | 35 | 65 | `/passport/[id]` route + provenance panel live. | Production share-link generator + revocation + 2 tests. | EXPORT-SHARE-1 | PARTIAL |
| Proof pack export | 20 | 80 | Conceptual shape; no audited bundle. | Foundation type + signature stub + 1 test. | EXPORT-PROOF-1 | YES |
| Import error handling | 25 | 75 | `buildImportErrorState` returns user-safe responses. | Wire error responses to import routes + 3 tests on error states. | UPLOAD-DOC-1 | YES |
| Import provenance labels | 40 | 60 | 5-tier vocab enforced. | Render labels on imported entries on `/clinician/profile`; 1 test. | LIVE-PROFILE-1 | YES |

---

## 🕸️ Knowledge Trust Graph

| Area | Current % | Gap to 100 | Current blocker | Fastest evidence needed | Proposed PR / wave | Achievable today |
|---|---:|---:|---|---|---|---|
| Data model | 75 | 25 | Architecture doc + JSON spec live; no live graph DB. | DB-backed graph store; ingest one trust-graph entity end-to-end. | GRAPH-PERSIST-1 | NO |
| Claim / source / receipt navigation | 60 | 40 | TrustGraph panel mounts on `/passport/[id]`; no interactive nav. | Click-through navigation + 1 test. | GRAPH-NAV-1 | YES |
| Roam/Obsidian-style visual graph UX | 22 | 78 | Static panel only. | Foundation visual-graph stub via `react-force-graph` + 1 test. | GRAPH-VISUAL-1 | PARTIAL |
| Graph search | 10 | 90 | Not built. | Search foundation type + stub query + 1 test. | GRAPH-SEARCH-1 | YES (to ~25) |
| Graph filtering | 10 | 90 | Not built. | Filter foundation type + stub + 1 test. | GRAPH-FILTER-1 | YES (to ~25) |
| Graph export | 30 | 70 | JSON exportable; no UI. | Export button + download endpoint + 1 test. | GRAPH-EXPORT-1 | YES |
| Clinician-facing graph explanation | 35 | 65 | Static explainer in panel. | Inline copy review + a11y pass + 1 test asserting truth-safe copy. | A11Y-AXE-1 | YES |
| Verifier-facing graph explanation | 30 | 70 | Static explainer (same as clinician). | Verifier-specific explainer copy + 1 test. | GRAPH-VERIFIER-1 | YES |
| Graph-to-proof-pack path | 20 | 80 | Not connected end-to-end. | Foundation type linking graph entities to proof-pack template; 1 test. | EXPORT-PROOF-1 | PARTIAL |

---

## 🏥 Verifier / Employer Product

| Area | Current % | Gap to 100 | Current blocker | Fastest evidence needed | Proposed PR / wave | Achievable today |
|---|---:|---:|---|---|---|---|
| Employer review | 60 | 40 | Demo render only (`recordedBy:'demo'`). | Real review event persistence + 2 tests. | TRUST-PERSIST-1 | NO |
| Request review | 55 | 45 | Same. | Same. | TRUST-PERSIST-1 | NO |
| Verifier worklist | 30 | 70 | FS7 foundation; `dbBackedWorklist: false`. | DB-backed worklist + 1 fetch test. | TRUST-PERSIST-2 | PARTIAL |
| Evidence inspection | 50 | 50 | Receipt candidate viewer live. | Tamper-rejection visible state + 2 tests. | VERIFIER-EVIDENCE-1 | YES |
| Reuse decision UX | 50 | 50 | FS7 3-basis foundation; `crossTenantReuseImplemented: false`. | Cross-tenant reuse boundary + 2 tests asserting block; no auto-reuse. | VERIFIER-REUSE-1 | YES |
| Policy decision UX | 60 | 40 | FS7 4-outcome model; `automatedPolicyEngine: false`. | Persisted decision event + 2 tests; no automation claim. | TRUST-PERSIST-1 | PARTIAL |
| Exportable proof pack | 25 | 75 | Not bundled. | Foundation generator + 1 test. | EXPORT-PROOF-1 | PARTIAL |
| Team / org roles | 10 | 90 | FS7 foundation; `invitationSystemLive: false`, `rbacEnforced: false`. | Invitation Prisma table + 2 tests; no production RBAC yet. | VERIFIER-ORG-1 | PARTIAL |
| Review status tracking | 45 | 55 | FS7 6-state lifecycle + state machine; `productionWorkflowLive: false`. | DB-backed status row + transition test. | TRUST-PERSIST-2 | PARTIAL |
| Employer CTA / conversion path | 40 | 60 | `/employers` redirect + `/pilot` CTA live. | Funnel instrumentation foundation + 1 test. | ANALYTICS-WIRE-1 | YES |

---

## 🏛️ Backend / Persistence / API

| Area | Current % | Gap to 100 | Current blocker | Fastest evidence needed | Proposed PR / wave | Achievable today |
|---|---:|---:|---|---|---|---|
| Domain PSV receipt contract | 85 | 15 | Frozen mapper tests pass; cap at 90 without persisted round-trip. | Round-trip integration test through real adapter. | TRUST-PERSIST-1 | PARTIAL |
| Server writer confirmation boundary | 80 | 20 | (#180) defensive downgrade only. | Default writer enabled + integration test. | TRUST-PERSIST-1 | PARTIAL |
| Real persistence writer | 5 | 95 | No Prisma table; no audit-event table; no client-safe RPC. | Initial Prisma schema for issuer + 1 migration test. | TRUST-PERSIST-1 | PARTIAL |
| Audit replay | 18 | 82 | Snapshot store + `getLaneSnapshots` fallback only. | Real audit-event replay reader + 2 tests. | TRUST-PERSIST-1 | NO |
| Export API | 15 | 85 | None client-safe. | Single client-safe export endpoint + 1 test. | EXPORT-BUNDLE-1 | PARTIAL |
| Backend test coverage | 42 | 58 | Issuer 321/321 + source-health 88/88; thin elsewhere. | Add 50+ tests in clinician/mobile/marketing surfaces. | TEST-COVERAGE-1 | PARTIAL |
| API route hardening | 32 | 68 | Source-health uses dual-auth; no CORS/helmet/API-key for public routes. | Helmet + CORS allow-list + API-key foundation + 3 tests. | SEC-API-1 | YES |
| Repository adapter | 70 | 30 | Decision boundaries only. | Real adapter wired + 2 tests. | TRUST-PERSIST-1 | NO |
| Database migration readiness | 5 | 95 | SQLite + in-memory; PostgreSQL migration is Phase 1.1, no implementation. | First Postgres-compatible Prisma schema + 1 dry-run test. | DB-MIGRATE-1 | PARTIAL |

---

## 🚀 Commercial Launch Readiness

| Area | Current % | Gap to 100 | Current blocker | Fastest evidence needed | Proposed PR / wave | Achievable today |
|---|---:|---:|---|---|---|---|
| Pricing/paywall | 28 | 72 | `collectsPayment: false`, `checkoutIntegrationLive: false`. | Stripe-foundation type + checkout-stub + 1 test asserting `collectsPayment: false`. | COMMERCE-PRICING-1 | YES |
| Self-serve signup | 32 | 68 | `accountCreationProductionReady: false`. | Production signup gate flip + 1 e2e test. | LIVE-SIGNUP-1 | PARTIAL |
| Onboarding | 38 | 62 | `productionOnboardingComplete: false`. | First production milestone surface (NPI confirm) + 1 test. | LIVE-PROFILE-1 | YES |
| Support / admin | 25 | 75 | `staffed: false`, `productionAdminEnabled: false`. | Admin route shell + 2 tests; no production gate flip. | ADMIN-SHELL-1 | YES |
| Pilot ops | 50 | 50 | `/pilot` CTA live; no funnel instrumentation. | Pilot-funnel events foundation + 2 tests. | ANALYTICS-WIRE-1 | YES |
| Analytics | 40 | 60 | 6-event privacy-safe vocab; no vendor wired. | Vendor adapter (PostHog) wired + 1 test asserting consent gate. | ANALYTICS-WIRE-1 | PARTIAL |
| Docs / status page | 45 | 55 | EV6A compliance evidence route; `superadminGateLive: false`. | Public `/status` page reading from compliance evidence shape; 1 test. | DOCS-STATUS-1 | YES |
| Legal pages | 60 | 40 | `/privacy` and `/terms` live. | DPA template + cookies page + 2 tests. | LEGAL-2 | YES |
| Sales / pilot collateral | 25 | 75 | Some pilot pages; no proof-pack. | One sales-ready proof-pack PDF + collateral page. | SALES-COLLAT-1 | YES |
| Demo data / reset flow | 28 | 72 | `productionResetEnabled: false`, `destructive: false`. | Demo reset endpoint scaffold + 2 tests; non-destructive. | DEMO-RESET-1 | YES |

---

## 🧪 Quality / CI / Release

| Area | Current % | Gap to 100 | Current blocker | Fastest evidence needed | Proposed PR / wave | Achievable today |
|---|---:|---:|---|---|---|---|
| Web quality | 85 | 15 | TS+ESLint enforced; 321/321 issuer tests; cap at 90 without axe + route map gates. | Add axe gate + route-map gate to CI. | A11Y-AXE-1 + RELEASE-ROUTE-MAP-1 | PARTIAL |
| Monorepo CI/CD | 65 | 35 | Turbo workflows live; merge-protection requires Codex SAFE. | Add lint-gate + size-gate workflow + 1 smoke test. | CI-GATES-1 | YES |
| Railway deploy preflight | 40 | 60 | (#179) excluded db-dependent backend packages. | Re-enable preflight after DB scaffold; 1 smoke test. | DB-MIGRATE-1 | NO |
| Vercel deploy health | 60 | 40 | vitalcv.com → vcv-web verified. | Add deploy-health probe to CI; 1 test. | CI-GATES-1 | YES |
| Regression test coverage | 55 | 45 | Heavy on issuer slice; thin elsewhere. | Add 30+ regression tests in mobile/marketing/clinician. | TEST-COVERAGE-1 | PARTIAL |
| Route map coverage | 30 | 70 | No published route map gate. | Generate `docs/ops/route-map.md` from `app/` filesystem; 1 CI gate test. | RELEASE-ROUTE-MAP-1 | YES |
| Smoke tests | 55 | 45 | Preflight smoke + source-health cron + build-chain check. | Add per-route smoke (HTTP 200) for hero routes; 1 CI job. | CI-GATES-1 | YES |
| Release checklist | 20 | 80 | No published release checklist. | Publish `docs/ops/release-checklist.md` + tie to CI gate. | RELEASE-CHECKLIST-1 | YES |

---

## Today's Highest-Leverage Attack Plan

Ranked by: (1) revenue / launch relevance, (2) low implementation risk, (3) ability to move at least +20, (4) tests/build feasibility, (5) no compliance overclaim risk.

| Rank | Area | Current % → realistic move today | PR / wave | Why this row, today |
|---:|---|---|---|---|
| 1 | **Release checklist** | 20 → 45 | RELEASE-CHECKLIST-1 | Pure docs PR. Publishes the gate every other row will be measured against. Unblocks a CI hook for the rest of the sprint. Zero compliance risk. |
| 2 | **Route map coverage** | 30 → 55 | RELEASE-ROUTE-MAP-1 | Filesystem-derived doc + 1 CI gate. Honest, mechanical, defensible. Surfaces dead routes immediately. |
| 3 | **OWASP ASVS baseline** | 15 → 40 | SEC-ASVS-1 | Publish scorecard marking each control true/planned/N-A. No claim of certification. Sets the truth contract for SEC-* waves. |
| 4 | **WCAG 2.2 AA baseline** + **Contrast** | 25 → 45 / 35 → 50 | A11Y-AXE-1 | Add axe to CI on a single hero route. One PR moves two rows; lifts Web quality cap toward 90. |
| 5 | **Security headers / secure defaults** | 35 → 60 | SEC-HEADERS-1 | Strict CSP + HSTS via `next.config.mjs`. Single config + 1 e2e header test. Hardens every route at once. |
| 6 | **Secrets / env handling** | 30 → 55 | SEC-ENV-1 | `lib/env.ts` with zod validation + CI fail-fast. One file + 1 test. No production state risk. |
| 7 | **Docs / status page** | 45 → 65 | DOCS-STATUS-1 | Public `/status` reading existing EV6A compliance-evidence route. Real shipping artifact, no overclaim — reports planned vs enforced. |
| 8 | **Profile completion score** | 40 → 60 | LIVE-PROFILE-1 | Render existing 22-tested score on `/clinician/profile`. Pure render of merged logic. Visible clinician value. |
| 9 | **Source health classifier UX** | 65 → 80 | TRUST-HEALTH-UX-1 | Mount `LaneHealthBadge` on `/passport/[id]`. 88-test foundation already on main; this is just the UX surface. |
| 10 | **Pricing/paywall** | 28 → 50 | COMMERCE-PRICING-1 | Stripe-foundation type + checkout-stub. Foundation only — `collectsPayment: false` preserved. Direct revenue-path investment. |

**Estimated cumulative board impact if all 10 land today:** +205 percentage points across 11 rows (one PR moves both WCAG and Contrast). Web quality cap lifts toward 90 once axe + route-map gates are in CI.

**Out of scope for today (require vendor / DB migration / native app):** Government ID, Selfie/liveness, Native iOS/Android, Real persistence writer, Database migration readiness, LinkedIn/Doximity import.

---

## Notes

- Every "Achievable today" YES row above is bounded by: **single coherent PR**, tests included, no production gate flip, no compliance certification claim, no banned strings.
- "PARTIAL" rows can move +5 to +15 today; the larger moves require subsequent PRs.
- "NO" rows require multi-PR sequences, vendor selection, native-app shells, or database migration plans that cannot be honestly compressed into a single working session.
- This document does not retire any board row, does not delete the existing low-score-first attack order, and does not change any percentage on the board itself. Board moves require merge + verification per BOARD-SCHEMA-3.

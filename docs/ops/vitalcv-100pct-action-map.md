# VitalCV 100% Action Map

Generated: 2026-05-03
Basis: origin/main 3c8dc4fa (post PR-C #207 / PR-E #209 / PR-G #210)
Board source: docs/ops/vitalcv-completion-board.md

This map identifies the exact gap between current state and 100% for every completion board row.
Scores do not change here; this is a planning document only.

---

## 🧠 Trust Engine / Issuer Infrastructure

| Area | Current % | Gap | Exact Blocker | Fastest Evidence Needed | Proposed Wave/PR | Today? |
|---|---:|---:|---|---|---|---|
| Issuer request / router | 80 | 20 | Real persistence deferred; no end-to-end write verified on main; no CSP/CORS audit | Wire real issuer write path + integration test confirming DB round-trip; add route-level auth + CORS headers | code: issuer-persistence-wire | NO |
| Partner route model | 75 | 25 | Same deferred persistence + no partner-auth gate or tenant-scoped enforcement | Partner auth gate + tenant isolation test + persistence adapter binding | code: partner-route-auth | NO |
| Issuer response intake | 70 | 30 | Intake surface lacks real write; no e2e test from intake → DB record | Wire intake→persistence with vitest integration test; add field-validation error path | code: intake-persistence-e2e | PARTIAL |
| Receipt candidate | 85 | 15 | `decisionGrade:false`/`proofTier:'receipt_candidate'` — promotion to `proofTier:'verified'` path not wired; no DB-backed state transition | Add `receipt_candidate→verified` promotion test + real state-machine write; merge as single focused PR | code: receipt-promotion-path | PARTIAL |
| Policy review decision | 85 | 15 | 5-gate flow tests pass but no real DB-backed gate evaluation; auto-approve/reject path missing | Wire gate evaluation to persistence; add decision-written + audit-event tests | code: policy-review-db-gate | PARTIAL |
| PSV receipt promotion | 70 | 30 | PSV receipt not connected to verified persistence; reuse boundary untested end-to-end | PSV receipt write integration test + reuse boundary round-trip test | code: psv-receipt-write | NO |
| Reuse / revocation / supersession boundary | 75 | 25 | Boundary tests exist but no live revocation/supersession write path on DB | Add revocation + supersession DB write tests; confirm state machine no-op on re-check | code: revoke-supersede-write | NO |
| Consent / manual send / timeline | 70 | 30 | Consent not persisted; timeline events not written to DB; no clinician-facing confirmation UI | Persist consent record + timeline event; add clinician confirmation route | code: consent-timeline-persist | NO |
| Audit persistence boundary | 75 | 25 | `auditPersistence.ts` boundary exists; no real Prisma write behind it | Implement Prisma audit table + insert test; verify via API route smoke | code: audit-db-write | NO |
| Persistence adapter decision | 75 | 25 | Adapter decision boundary only; no concrete adapter selected/wired beyond in-memory | Select adapter (Prisma PostgreSQL); wire + test a single entity create/read cycle | code: persistence-adapter-impl | NO |
| Backend writer boundary | 75 | 25 | Defensive downgrade in place; default writer is deferred-only; no real server write | Replace deferred writer with Prisma write + rollback test | code: backend-writer-impl | NO |
| Domain / core PSV receipt contract alignment | 80 | 20 | Frozen mapper tests pass; no live DB-backed round-trip proving the mapper serializes correctly | Add serialization round-trip test writing to in-memory DB; confirm domain → DB → domain cycle | code: psv-contract-roundtrip | PARTIAL |
| Source health classifier | 65 | 35 | 88-test suite passes; no persistent snapshot DB; probe results not stored across restarts; no alerting | Wire snapshot store to DB; add probe-failure alerting config; integration test probe→snapshot→read | code: source-health-db-persist | NO |

---

## 🧑‍⚕️ Live Clinician Product

| Area | Current % | Gap | Exact Blocker | Fastest Evidence Needed | Proposed Wave/PR | Today? |
|---|---:|---:|---|---|---|---|
| Signup / account creation | 10 | 90 | Clerk already wired in main (`@clerk/nextjs` in package.json, `ClerkProvider` mounted in `apps/web/app/layout.tsx`, `/sign-up` route at `app/sign-up/[[...sign-up]]/page.tsx`); NextAuth is not in use; gap is production env keys + e2e test | Add e2e signup + email-verification test via Playwright; confirm `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` in production env; smoke-test session persistence | code: clinician-auth-signup | NO |
| Login / account recovery | 10 | 90 | Google OAuth broken in prod; no verified login flow; no recovery mechanism live | Fix OAuth config; add login + "forgot password" e2e test; confirm session persists | code: clinician-auth-login | NO |
| NPI check | 65 | 35 | NPPES proxy functional; ingest fallback exists; no binding of NPI result to clinician account; no test proving NPI→profile write | Add NPI-check→profile-bind integration test; wire result to ClinicianProfile.npi with source=nppes | code: clinician-npi-binding | PARTIAL |
| Rich clinician profile shell | 75 | 25 | Shell routes up; no production auth gate; no verified end-to-end read of persisted profile; no mobile audit | Add auth gate to `/clinician/profile`; add persisted-profile read test; accessibility + mobile check | code: clinician-profile-auth-gate | PARTIAL |
| Identity / contact / locations | 55 | 45 | Fields captured; no verified source backing; no address validation; no location de-dup logic | Wire verified identity source (NPI or ID verification vendor); add source-backed field promotion test | code: identity-source-bind | NO |
| Medical school | 25 | 75 | Free-text only; no source (AAMC/ACGME) verification; no graduation-year validation | Integrate AAMC data or manual PSV workflow; add school-verification submission route + test | code: medical-school-verification | NO |
| Residency | 25 | 75 | Free-text only; no ACGME/AMA verification; no date-range validation | ACGME verification stub + submission test; wire to issuer request flow | code: residency-verification | NO |
| Fellowship | 25 | 75 | Free-text only; no ACGME verification; no specialty cross-check | Fellowship verification submission route + issuer flow stub + test | code: fellowship-verification | NO |
| Training programs | 20 | 80 | Free-text only; no program directory lookup; no completion verification | Training program directory stub + submission + test | code: training-program-verify | NO |
| Specialty / subspecialty | 30 | 70 | NPPES inference only; no board certification check; no ABM/ABMS lookup | Wire ABMS specialty lookup or manual PSV route; add specialty source-bind test | code: specialty-board-verify | NO |
| Current employer | 25 | 75 | User-entered; no employer-side verification; no employer record in DB | Add employer verification request route; wire to issuer flow; test employer→profile binding | code: employer-verify-bind | NO |
| Employer history | 20 | 80 | User-entered only; no date-range overlap check; no reference verification | Employer history submission + date-overlap validation + issuer request stub + test | code: employer-history-verify | NO |
| Affiliations | 20 | 80 | User-entered only; no hospital/group affiliation source check | Affiliation verification request route + test | code: affiliation-verify | NO |
| Work history | 20 | 80 | User-entered only; no source check; no gap-analysis logic | Work history submission + gap analysis + source request flow + test | code: work-history-verify | NO |
| Research / publications | 15 | 85 | Section exists; no PubMed or ORCID binding; no citation count | Wire PubMed candidate-fetch to clinician profile; add publication source-bind test | code: research-pubmed-bind | NO |
| PubMed layer | 30 | 70 | `pubmedCandidatesVerifiedByDefault:false`; no live PubMed API call; no author-disambiguation | Implement PubMed API fetch + author disambiguation heuristic + test | code: pubmed-live-fetch | NO |
| LinkedIn-style profile layer | 28 | 72 | `verifiesCredentials:false`; LinkedIn OAuth not wired; no authorized import integration live | LinkedIn OAuth authorized import route (no scraping — foundation contract forbids scraping/credential collection); import→profile field binding + test | code: linkedin-import-live | NO |
| Doximity-style profile layer | 26 | 74 | Same as LinkedIn; Doximity OAuth not wired; `verifiesCredentials:false` | Doximity authorized OAuth import route (no scraping — foundation contract forbids scraping/credential collection); profile field binding + test | code: doximity-import-live | NO |
| Career goals / preferences | 25 | 75 | Capture exists; no matching algorithm; no employer-preference push | Build basic preference→job-type matching logic + test; wire to employer feed | code: career-pref-matching | NO |
| Profile completion score | 40 | 60 | Weighted score working; no real source-backed field count; score not surfaced in UI with refresh | Wire score to DB-backed profile read; add UI widget on `/clinician/profile`; e2e score-update test | code: profile-score-ui-live | NO |
| Clinician-facing value dashboard | 30 | 70 | Graph route wired; no live personalization; static explainer only; no real credential status widget | Build credential-status widget pulling from live profile; add knowledge-graph traversal for top credentials | code: clinician-dashboard-live | NO |

---

## 📱 Mobile + Device Experience

| Area | Current % | Gap | Exact Blocker | Fastest Evidence Needed | Proposed Wave/PR | Today? |
|---|---:|---:|---|---|---|---|
| Mobile web / PWA | 35 | 65 | PWA manifest present; no offline shell; no installability test; no service worker verified | Add service worker + offline fallback page; run Lighthouse PWA audit; fix all installability blockers | code: pwa-offline-shell | NO |
| Native iOS app | 25 | 75 | `isLive:false`; no Xcode project; no App Store account; no native shell | Create React Native or Swift shell app; wire login; submit TestFlight build | code: native-ios-shell | NO |
| Native Android app | 25 | 75 | `isLive:false`; no Android project; no Play Store account; no native shell | Create React Native or Android shell; wire login; submit internal track build | code: native-android-shell | NO |
| Mobile document capture | 25 | 75 | Web/PWA scope only; native camera not enabled; no HEIC/JPEG upload path | Add native camera access via PWA MediaDevices API; wire to document upload route; test on mobile | code: mobile-doc-capture | NO |
| Device trust / App Attest / Play Integrity | 0 | 100 | Not started; no vendor selected; requires native app to exist first | Build native iOS/Android shell first; then integrate App Attest + Play Integrity APIs | code: device-trust-attest | NO |
| Biometric gating | 25 | 75 | `biometricGatingLive:false`; native app required; WebAuthn not wired | Add WebAuthn passkey registration + assertion in web; native biometric after native app | code: biometric-webauthn | NO |
| Push notification readiness | 0 | 100 | Not started; no FCM/APNs setup; no notification service | Set up FCM for web push + APNs for iOS; wire to backend event triggers | code: push-notifications | NO |
| Offline / degraded-state handling | 25 | 75 | `offlineSyncImplemented:false`; 5xx fallbacks exist; no queue-and-sync logic | Implement offline action queue + sync-on-reconnect; test degraded → recovery flow | code: offline-sync | NO |

---

## 🔐 Identity + Security

| Area | Current % | Gap | Exact Blocker | Fastest Evidence Needed | Proposed Wave/PR | Today? |
|---|---:|---:|---|---|---|---|
| Government ID verification | 25 | 75 | `governmentIdLive:false`; no vendor selected (Persona/Jumio/Onfido); no ID upload flow | Select vendor; wire ID upload endpoint; add verification webhook handler + test | code: govt-id-verify-vendor | NO |
| Selfie / liveness | 25 | 75 | `selfieLivenessLive:false`; no liveness SDK integrated; depends on same vendor | Integrate liveness SDK (same vendor as govt-ID); wire selfie capture + result webhook | code: selfie-liveness-sdk | NO |
| Clinician-to-NPI binding | 28 | 72 | `foundation_ready` only; no proven identity-to-NPI chain; no assertion record persisted | After govt-ID step: assert clinician identity matches NPI enumerated name; persist binding record | code: clinician-npi-binding | NO |
| Identity proofing policy | 25 | 75 | `isLive:true` only for NPI-lookup + self-attested-name; no IAL2/IAL3 achieved; no policy decision record | Implement IAL2 flow (govt-ID + liveness + NPI match); write policy decision record; add test | code: identity-ial2-flow | NO |
| Account recovery | 25 | 75 | All 5 recovery methods `isLive:false`; no SMS/email recovery live in production | Wire at minimum email-link recovery via Clerk; add recovery e2e test | code: account-recovery-email | NO |
| Session security | 20 | 80 | Default Next/Clerk sessions; no CSRF hardening; no session rotation; no idle timeout | Add session rotation + idle timeout + CSRF token; write security test suite | code: session-security-harden | NO |
| OWASP ASVS baseline | 15 | 85 | No ASVS scorecard published; no Level 1 controls documented or tested | Run automated ASVS Level 1 scan; publish scorecard; fix critical gaps; merge scan script | code: asvs-baseline-scan | NO |
| Security headers / secure defaults | 35 | 65 | No audited CSP; missing HSTS, X-Frame-Options enforcement; no automated header test | Add CSP + HSTS + X-Frame-Options to `next.config`; wire helmet; add header audit CI step | code: security-headers-csp | PARTIAL |
| Data classification | 20 | 80 | `redactionLive:false`; `piiTierDocLive:false`; vocab defined but not enforced at API boundary | Wire `maskValue()` at all API response boundaries for PII/PHI fields; add enforcement test | code: data-class-enforce | NO |
| Retention / redaction | 10 | 90 | `retentionEnforced:false`; `autoDeleteLive:false`; no scheduled delete job | Implement scheduled retention job for each entity type; add delete-confirmation test | code: retention-auto-delete | NO |
| Secrets / env handling | 30 | 70 | `.env` patterns in repo; no Zod env validation; no secrets rotation policy | Add `env.mjs` Zod schema for all env vars; wire to app startup; fail-fast on missing vars | code: env-zod-validation | PARTIAL |

---

## ♿ Accessibility

| Area | Current % | Gap | Exact Blocker | Fastest Evidence Needed | Proposed Wave/PR | Today? |
|---|---:|---:|---|---|---|---|
| WCAG 2.2 AA baseline | 25 | 75 | No axe gate in CI; foundation checklist not enforced; no audit results on main | Add axe-core CI step; fix all Critical/Serious violations on key routes; merge gate | code: a11y-axe-ci-gate | PARTIAL |
| Keyboard navigation | 25 | 75 | Default browser behavior only; no focus-trap audit; modals/dialogs not keyboard-safe | Audit all modals + dialogs; add focus-trap via `@radix-ui`; write keyboard nav tests | code: keyboard-nav-audit | NO |
| Screen reader labels | 25 | 75 | `aria-labelledby` on one route; no systematic audit; no NVDA/VoiceOver test record | Add `aria-label` / `aria-describedby` to all interactive elements; run VoiceOver smoke | code: screen-reader-audit | NO |
| Touch targets | 30 | 70 | Mobile clip fixes applied; no 44×44 audit; no Lighthouse mobile score published | Run 44×44 touch-target audit across all primary flows; fix violations; merge CI check | code: touch-target-audit | PARTIAL |
| Error-state accessibility | 15 | 85 | Error UIs not audited; no role=alert on inline errors; no screen-reader test | Add `role=alert` to all error messages; audit error UIs; write axe test per error state | code: error-state-a11y | NO |
| Contrast | 35 | 65 | Design-system v2 tokens on main; no axe-based contrast audit; themes not all verified | Run axe contrast audit against all 4 themes; fix failures; add contrast CI step | code: contrast-axe-audit | PARTIAL |
| Reduced motion | 25 | 75 | `prefers-reduced-motion` category in foundation; no end-to-end enforcement; animations not conditionalized | Wrap all CSS transitions in `prefers-reduced-motion` media query; add visual regression test | code: reduced-motion-enforce | NO |
| Form accessibility | 15 | 85 | No labeled-region audit; inputs lack explicit label associations; no error-message linkage | Add `<label htmlFor>` to every form field; wire `aria-describedby` for errors; axe test suite | code: form-a11y-labels | NO |
| Mobile accessibility | 15 | 85 | No labeled-region audit on mobile; no mobile screen-reader (TalkBack/VoiceOver) test record | Run VoiceOver + TalkBack smoke on all primary flows; fix violations; document test record | code: mobile-a11y-smoke | NO |

---

## 📤 Upload / Import / Export

| Area | Current % | Gap | Exact Blocker | Fastest Evidence Needed | Proposed Wave/PR | Today? |
|---|---:|---:|---|---|---|---|
| CV upload | 25 | 75 | Binary CV upload not wired; no file-type validation; no CV parse → profile field mapping | Wire multipart upload endpoint; add PDF/DOCX parser; map extracted fields to `ClinicianProfile`; test | code: cv-upload-parse | NO |
| Document upload | 32 | 68 | `entry_only` status; no verified storage path; no virus scan; no file-type allow-list | Wire S3/Vercel Blob upload; add allow-list + virus scan; return signed URL; integration test | code: doc-upload-storage | NO |
| Drag/drop upload UX | 15 | 85 | No verified DnD surface; no progress indicator; no multi-file queue | Add `react-dropzone` DnD surface; wire to document upload endpoint; add e2e upload test | code: dnd-upload-ux | PARTIAL |
| LinkedIn import | 25 | 75 | `isLive:false`; LinkedIn OAuth app not registered; no import route | Register LinkedIn OAuth app; implement `/api/import/linkedin` route + profile field mapping + test | code: linkedin-import-live | NO |
| Doximity import | 25 | 75 | `isLive:false`; Doximity OAuth not wired; no import route | Register Doximity OAuth app; implement `/api/import/doximity` route + mapping + test | code: doximity-import-live | NO |
| PubMed import | 30 | 70 | `productionReady:false`; PubMed API key not configured; no author-match logic | Wire PubMed Entrez API; add author-disambiguation; persist publications to profile; test | code: pubmed-import-live | NO |
| CSV / roster import | 30 | 70 | CSV ingest partial; roster management manual; no column-mapping UI; no validation errors | Add column-mapping config + validation error surface; wire bulk upsert to DB; test 500-row CSV | code: csv-roster-import | NO |
| Export bundle | 25 | 75 | `ARTIFACT_EXPORTED` event metadata exists; no ZIP bundle generation; no signed download URL | Implement bundle generation (credential records + receipts + provenance → ZIP); signed URL; test | code: export-bundle-gen | NO |
| Shareable passport | 35 | 65 | `/passport/[id]` route up; no auth gate for public vs. private; no revocation; no expiry | Add passport access policy (share token + expiry + revoke); wire DB; public render test | code: passport-access-policy | PARTIAL |
| Proof pack export | 20 | 80 | Conceptual shape only; no audited bundle; no verifier-safe serialization | Define proof-pack JSON schema; implement serialization + signature; verifier-parse test | code: proof-pack-schema | NO |
| Import error handling | 25 | 75 | `buildImportErrorState` returns 8 error kinds; no user-facing error UI; no retry path | Wire error state to UI toast/inline error; add retry mechanism; test all 8 error kinds in UI | code: import-error-ui | PARTIAL |
| Import provenance labels | 40 | 60 | 5-tier vocab enforced; not surfaced to clinician in UI; no provenance badge component | Build provenance badge component per field; wire to profile UI; visual snapshot test | code: provenance-badge-ui | PARTIAL |

---

## 🕸️ Knowledge Trust Graph

| Area | Current % | Gap | Exact Blocker | Fastest Evidence Needed | Proposed Wave/PR | Today? |
|---|---:|---:|---|---|---|---|
| Data model | 75 | 25 | Boundaries 1–28 documented; no live graph DB; no edge-query API | Wire graph query API against real data model; add query test for claim→source→receipt path | code: graph-query-api | NO |
| Claim / source / receipt navigation | 60 | 40 | TrustGraph panel mounts; no deep-link per node; no expand/collapse; no live data | Add node deep-link + expand/collapse; wire to live receipt data; integration test | code: graph-nav-live | NO |
| Roam/Obsidian-style visual graph UX | 22 | 78 | Static panel only; no graph layout engine (D3/Cytoscape); no drag/zoom | Integrate D3-force or Cytoscape layout; render live nodes + edges; zoom/drag test | code: graph-layout-engine | NO |
| Graph search | 10 | 90 | Not built; no index; no query route | Build graph search index (node type + label); add `/api/graph/search` route + test | code: graph-search-index | NO |
| Graph filtering | 10 | 90 | Not built; no filter state; no UI | Add filter state (source type, date, tier); wire to graph panel; test filter reduces nodes | code: graph-filter-ui | NO |
| Graph export | 30 | 70 | Underlying JSON exportable; no UI export trigger; no format options (JSON/CSV/PNG) | Add export button to graph panel; implement JSON + PNG export; test both paths | code: graph-export-ui | PARTIAL |
| Clinician-facing graph explanation | 35 | 65 | Static explainer; no interactive tooltips; no contextual help per node type | Add node-type tooltips + contextual help panel; wire to graph layout; test all node types | code: graph-clinician-explain | PARTIAL |
| Verifier-facing graph explanation | 30 | 70 | Same static explainer as clinician-facing; needs verifier-specific framing + risk language | Create verifier-specific explanation panel with risk/tier language; add route guard; test | code: graph-verifier-explain | PARTIAL |
| Graph-to-proof-pack path | 20 | 80 | Not connected end-to-end; no "export this claim as proof" action | Add "Export proof" CTA on each graph node; wire to proof-pack generator; e2e test | code: graph-proof-pack-link | NO |

---

## 🏥 Verifier / Employer Product

| Area | Current % | Gap | Exact Blocker | Fastest Evidence Needed | Proposed Wave/PR | Today? |
|---|---:|---:|---|---|---|---|
| Employer review | 60 | 40 | Demo render only (`recordedBy:'demo'`); no real receipt data; no auth gate for employer | Replace demo data with live receipt reads; add employer auth gate; test real-data render | code: employer-review-live | NO |
| Request review | 55 | 45 | Same as employer review; no request submission from employer side | Add employer request submission form; wire to issuer request flow; test end-to-end | code: employer-request-submit | NO |
| Verifier worklist | 30 | 70 | `dbBackedWorklist:false`; WorklistPanel component exists but reads no real data | Wire WorklistPanel to DB query; add filter + sort; integration test with real worklist items | code: worklist-db-wire | PARTIAL |
| Evidence inspection | 50 | 50 | Receipt candidate viewer up; no PSV-grade evidence link; no document preview | Link PSV receipt to evidence panel; add document preview (signed URL); test all evidence types | code: evidence-psv-link | NO |
| Reuse decision UX | 50 | 50 | `crossTenantReuseImplemented:false`; basis model defined; no cross-tenant check | Implement cross-tenant reuse check + consent gate; test approval + rejection paths | code: reuse-cross-tenant | NO |
| Policy decision UX | 60 | 40 | `automatedPolicyEngine:false`; 4-outcome model defined; no approval/rejection write | Wire policy decision write to DB; add outcome notification to clinician; test approve/reject | code: policy-decision-write | PARTIAL |
| Exportable proof pack | 25 | 75 | Not bundled; no employer-specific proof format | Build employer-facing proof pack (PDF or signed JSON); add download route; test | code: employer-proof-pack | NO |
| Team / org roles | 10 | 90 | `invitationSystemLive:false`; `rbacEnforced:false`; 3-role model defined | Implement invitation flow + email; wire RBAC middleware to all employer routes; test all 3 roles | code: org-rbac-enforce | NO |
| Review status tracking | 45 | 55 | `productionWorkflowLive:false`; state machine defined; no live DB-backed transitions | Wire state machine transitions to DB; add status change events; clinician notification test | code: review-status-db | PARTIAL |
| Employer CTA / conversion path | 40 | 60 | `/employers` + `/pilot` CTAs live; no lead capture form; no funnel instrumentation | Add lead capture form (email + role + org); wire to CRM/email; add conversion event; test | code: employer-lead-capture | PARTIAL |

---

## 🏛️ Backend / Persistence / API

| Area | Current % | Gap | Exact Blocker | Fastest Evidence Needed | Proposed Wave/PR | Today? |
|---|---:|---:|---|---|---|---|
| Domain PSV receipt contract | 85 | 15 | Frozen mapper tests pass; no live round-trip through real DB; no version migration tested | Add DB round-trip integration test for PSV receipt mapper; test schema migration v0→v1 | code: psv-contract-db-test | PARTIAL |
| Server writer confirmation boundary | 80 | 20 | Defensive downgrade tests pass; deferred writer still active; no successful real write confirmed | Replace deferred writer with Prisma write; confirm write + read back in integration test | code: server-writer-prisma | PARTIAL |
| Real persistence writer | 5 | 95 | No Prisma table; no audit-event table; no client-safe RPC; SQLite/in-memory only | Write dry-run migration SQL under `docs/migrations/`; get explicit approval before any migration execution; then implement Prisma create/read for issuer receipt with tests | code: prisma-core-schema | NO |
| Audit replay | 18 | 82 | Snapshot store + `getLaneSnapshots` for source-health only; no general audit replay API | Build general audit replay API (entity + event type filters); add time-travel query; test | code: audit-replay-api | NO |
| Export API | 15 | 85 | No client-safe export API; no auth gate; no rate limiting | Build `/api/export` route with JWT gate + rate limit; return signed bundle URL; test | code: export-api-endpoint | NO |
| Backend test coverage | 42 | 58 | Issuer 321/321 + source-health 88/88; clinician/mobile/marketing surfaces thin | Add vitest suites for clinician profile, identity, employer, and import modules; reach ≥80% | code: backend-test-expansion | PARTIAL |
| API route hardening | 32 | 68 | Dual-auth on source-health routes only; no CORS policy; no API key story; no rate limiting | Add CORS config + API key middleware + rate limiter to all public routes; test attack vectors | code: api-route-hardening | PARTIAL |
| Repository adapter | 70 | 30 | Decision boundaries merged; no concrete PostgreSQL adapter behind them; adapter is in-memory | Implement PostgreSQL Prisma adapter; wire to all repository boundaries; integration test | code: repo-adapter-postgres | NO |
| Database migration readiness | 5 | 95 | SQLite + in-memory only; no PostgreSQL schema; no migration tooling configured | (1) Write dry-run SQL doc under `docs/migrations/` for review; (2) get explicit approval; (3) `cd apps/api/backend && npx prisma migrate dev --schema prisma/schema.prisma --name <description>` to generate the real migration under `apps/api/backend/prisma/migrations/`; (4) provision PostgreSQL in Railway; (5) apply via `cd apps/api/backend && npx prisma migrate deploy --schema prisma/schema.prisma`; smoke test in CI | code: db-migration-postgres | NO |

---

## 🚀 Commercial Launch Readiness

| Area | Current % | Gap | Exact Blocker | Fastest Evidence Needed | Proposed Wave/PR | Today? |
|---|---:|---:|---|---|---|---|
| Pricing/paywall | 28 | 72 | `collectsPayment:false`; no Stripe integration; no plan enforcement | Integrate Stripe Checkout for at least one paid plan; wire entitlement check to feature gate; test | code: stripe-checkout | NO |
| Self-serve signup | 32 | 68 | `accountCreationProductionReady:false`; no payment collection; no post-signup onboarding flow | Wire signup → payment → onboarding funnel end-to-end; add e2e test for full new-user journey | code: self-serve-funnel | NO |
| Onboarding | 38 | 62 | `productionOnboardingComplete:false`; `completesCredentialing:false`; milestone list exists but no guided flow | Build guided onboarding stepper (NPI→profile→credentials→passport); add completion test | code: onboarding-stepper | PARTIAL |
| Support / admin | 25 | 75 | `staffed:false`; `productionAdminEnabled:false`; no helpdesk integration | Add Intercom or similar widget; wire admin dashboard for user lookup + issue logging; test | code: support-helpdesk | NO |
| Pilot ops | 50 | 50 | `/pilot` CTA live; no funnel instrumentation; no pilot cohort tracking | Add pilot lead table; instrument CTA clicks + conversion; build internal pilot dashboard | code: pilot-funnel-track | NO |
| Analytics | 40 | 60 | `analyticsFoundation.ts` 6-event vocab defined; no vendor wired (PostHog/Segment/Amplitude) | Select vendor; wire 6 core events; verify event delivery in dev; production pipeline test | code: analytics-vendor-wire | PARTIAL |
| Docs / status page | 45 | 55 | Compliance evidence shape route exists; `superadminGateLive:false`; no public status page | Add public status page (Statuspage.io or self-hosted); expose at `/status`; uptime monitor | code: status-page-live | PARTIAL |
| Legal pages | 60 | 40 | `/privacy` + `/terms` live; no DPA; no HIPAA BAA; no cookie consent banner | Add HIPAA BAA template + DPA; wire cookie consent (OneTrust or similar); legal review sign-off | code: legal-hipaa-baa | NO |
| Sales / pilot collateral | 25 | 75 | Some pilot pages; no proof-pack; no case study; no ROI calculator | Build proof-pack PDF generator; add ROI calculator page; draft one case study; design review | code: sales-collateral | NO |
| Demo data / reset flow | 28 | 72 | `productionResetEnabled:false`; 5 reset scopes defined; no live reset endpoint | Implement reset endpoint behind admin gate; wire all 5 scope types; add demo seed fixtures; test | code: demo-reset-endpoint | PARTIAL |

---

## 🧪 Quality / CI / Release

| Area | Current % | Gap | Exact Blocker | Fastest Evidence Needed | Proposed Wave/PR | Today? |
|---|---:|---:|---|---|---|---|
| Web quality | 85 | 15 | TypeScript + ESLint enforced; `@vitalcv/shared` TS6059 tracked separately (#195); no e2e smoke in CI | Resolve TS6059 in shared package; add Playwright e2e smoke to CI; merge green build | code: web-quality-e2e-ci | PARTIAL |
| Monorepo CI/CD | 65 | 35 | Turbo workflows up; no deploy preview per PR; no rollback automation; merge-protect requires manual SAFE | Add Vercel preview deploy per PR; add automated rollback on health-check failure; test | code: ci-preview-deploy | PARTIAL |
| Railway deploy preflight | 40 | 60 | DB-dependent packages excluded; no health-check endpoint; no deploy gating on test pass | Add `/api/health` endpoint; gate Railway deploy on passing health-check; add deploy test | code: railway-health-gate | PARTIAL |
| Vercel deploy health | 60 | 40 | vitalcv.com verified on `vcv-web`; no deploy preview gate; no performance budget | Add Lighthouse CI budget step; gate deploy on LCP < 2.5 s; performance regression test | code: vercel-perf-budget | PARTIAL |
| Regression test coverage | 55 | 45 | Issuer + source-health suites strong; clinician/mobile/marketing thin | Expand test coverage to clinician profile, employer, import modules; reach ≥80% across all | code: regression-expand | PARTIAL |
| Route map coverage | 30 | 70 | No published route map gate; routes added without audit | Generate route map from Next.js app dir; add CI step that fails on unregistered routes; test | code: route-map-ci | PARTIAL |
| Smoke tests | 55 | 45 | Preflight smoke + source-health cron + build-chain check exist; no full-app happy-path smoke | Add Playwright happy-path smoke: signup → NPI check → profile → passport view; run in CI | code: smoke-e2e-full | PARTIAL |
| Release checklist | 20 | 80 | No published checklist; no release runbook; no version-tag automation | Write release checklist + runbook; add semantic-release config; test tag-on-merge-to-main | docs: release-checklist-runbook | YES |

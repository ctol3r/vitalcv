# VitalCV → 100% Enterprise-Complete: Master Task Map

**Status date:** 2026-07-05 · **Audited baseline:** `origin/main @ 1bceea184` (not the stale local branch)
**Method:** 7 parallel domain audits with file-level evidence, cross-checked against `docs/ops/launch-blockers.md` (13 open items), `docs/security/ASVS-scorecard-2026-07.md` (gap register G1–G12), the reconciled completion board (BOARD-RECONCILE-1), god-mode wave plan (A–J), and Wave Bundle II (K–T; K/L/M/Q merged, N/O/P/R/S/T open). Contested agent findings were re-verified on disk before inclusion.
**Rule inherited from the gap-analysis doctrine:** classify P0 (enterprise-launch-blocking), P1 (high risk — required for enterprise GA), P2 (hardening/optimization). Each task: evidence → what to do → done-when → owner. No fixes are implemented here.

**Owner legend:** `Builder` = Claude Code Terminal wave · `Chris` = founder decision / dashboard config / procurement · `Vendor` = third-party procurement dependency · `External` = outside firm (auditor, pen test) · Codex verification applies per the tiered merge policy (Codex rate-limited until ~2026-08-03; Tier 2 items queue).

---

## Definition of "100% enterprise-complete"

A hospital / CVO / payer / staffing org can: buy (contract + BAA + billing), onboard a team (org, invitations, roles enforced), run production workloads (durable audit, multi-instance-safe, monitored, recoverable), pass security review (no header-trust identity, RBAC on, SCA/SAST in CI, pen-tested), pass compliance review (privacy rights, retention, WCAG AA, SOC 2 program underway), and trust the evidence (live + honestly-gated sources, continuous monitoring on, signed revocation, e2e-proven fail-closed paths) — with every public claim still truth-contract honest.

**Roll-up: 108 tasks — 23 P0 · 40 P1 · 45 P2** across 14 domains (A–N).

### What is already real (anchor — don't rebuild)
NPPES v2.1 (boot-asserted) · OIG/LEIE · PECOS · CA physician+PA boards · Open Payments/OpenAlex/PubMed/ClinicalTrials enrichment lanes — **live**. ES256 receipt issuer fail-closed in prod + JWKS route. W3C Bitstring status-list model (proof signature stubbed). Trust-state/CRS deterministic + frozen tests. Employer review queue + batch actions audit-first (#560). ReadinessSnapshot share-once/reuse-many (#562, fail-closed revoked=410). Matcha engine mounted + opportunity actions persisted (#559). PilotLead capture + `/admin/leads` (#561). Holder hub surfaces on real workspace/passport data. Route-contract test wall (145 assertions). Strict security headers + CORS default-deny. Mobile wallet services built + tested. Clerk CSP sign-in fix. Golden-path copy guards.

---

## A. Identity, AuthN/AuthZ & Tenancy — the #1 systemic blocker

- **[P0] A1 — Kill header-trust identity (ASVS G1).** Backend accepts `x-clerk-user-id`, `x-user-role` (incl. `super-admin`), `x-org-id` from any caller: `authMiddleware.ts:4-11` sets `isAuthenticated=true` on header presence; `tenantGuard.ts:153-167,176-182` grants super-admin from an untrusted header; `organizationContext.ts:20-40` takes org from header/query. **Do:** verify Clerk session JWTs on the backend (JWKS) or signed service-to-service tokens minted by web; delete role/org header trust everywhere. Parked [PR #506](https://github.com/christoler/vitalcv/pull/506) (transport-auth for `/api/me/role`) is the pattern seed — land or supersede it, then extend to all identity-bearing routes. **Done when:** a forged `x-user-role: super-admin` request is rejected with a test proving it; zero backend code paths derive identity from unauthenticated headers. Owner: Builder + Chris (backend env rollout). *Everything marked "role-gated" below inherits this fix.*
- **[P0] A2 — Turn RBAC on (ASVS G2 / blocker #2).** Enforcement is shadow-mode: `config/env.ts:151-159` (`VERIFIER_RBAC_ENFORCED` default false), `employerActions.ts:206-211` logs-not-blocks, `orgRolesFoundation.ts:17` `rbacEnforced: false` literal. **Do:** review shadow-deny telemetry, flip flag + literal, extend the `employerActionRbac.ts` pure decision core (currently employer-review mutations only, ASVS 1.4.4) to every mutating verifier/org route. **Done when:** non-permitted role mutation is blocked + audited, with tests per route class. Owner: Builder; flag flip Chris.
- **[P0] A3 — Employer org lifecycle: invitations, members, roles.** `invitationSystemLive: false` (`orgRolesFoundation.ts:16`); no `/employer/members` or role-assignment UI; org creation exists only via `upsertOrgProfile` (`opportunities.ts:89-100`). **Do:** invitation issue/accept/revoke (email + expiring token), member list/remove UI, role assignment surface, org-admin bootstrap flow. **Done when:** an employer admin invites 2 teammates with different roles and A2 enforces them end-to-end. Owner: Builder (depends A1, A2, F3 email).
- **[P0] A4 — MFA step-up on admin + sensitive ops (ASVS G9).** `/admin/leads`, `/admin/platform`, `/admin/demo-reset`, `/api/admin/platform` gate on `sessionClaims.vitalcv.role === 'ADMIN'` only (`app/admin/leads/page.tsx:39`, `app/api/admin/platform/route.ts:18`). **Do:** require Clerk AAL2/MFA for `/admin/*` and re-auth for credential/packet exports; enable + verify factors in Clerk prod dashboard. **Done when:** admin routes demand a second factor; documented in `.env.example`/runbook. Owner: Builder + Chris (Clerk dashboard).
- **[P0] A5 — Verify prod OAuth + Clerk config (blocker #3).** Google OAuth state, password policy, factor config live only in the Clerk dashboard — unverifiable in repo. **Do:** verify/enable in prod, add a signed-in smoke that exercises OAuth, document required Clerk settings. **Done when:** OAuth sign-in verified on vitalcv.com + documented. Owner: Chris (+ Builder smoke). *Note: Clerk CDN bot-blocks automated browsers — synthetic checks must use API/curl-level probes or an allowlisted profile.*
- **[P0] A6 — SEAL training-set export has no real auth.** `GET /api/seal/training-set` is gated by `SEAL_TRAINING_EXPORT_ENABLED` env flag only (+ spoofable header identity per G1). **Do:** require admin-grade authn (post-A1) or internal token; audit each export. Owner: Builder.
- **[P1] A7 — Tenant-guard skip-list audit.** 127 exempt route prefixes (`tenantGuard.ts:46-130`) include mutating paths (`/api/matcha`, `/api/ingest/*`, `/api/apply/*`). **Do:** produce a read/write matrix per prefix; remove or explicitly auth each mutating exemption. **Done when:** matrix committed + tests pin the guard behavior. Owner: Builder.
- **[P1] A8 — Retire the fail-open wave-125 auth module (ASVS G10).** `middleware/apiAuth.ts:41-53,106,207-212` in-memory keys/sessions, allows unauthenticated context. Three parallel authn modules coexist (ASVS 1.1.6/1.2.3). **Do:** consolidate to one vetted mechanism; delete or DB-back `apiAuth.ts`. Owner: Builder.
- **[P1] A9 — Account recovery goes live.** All 5 methods `isLive: false` (`accountRecoveryFoundation.ts:85-195`); no flow beyond Clerk defaults. **Do:** pick ≥1 method (recovery codes or verified-email reset + support-review fallback), implement, keep the "recovery ≠ session re-auth" invariant. Owner: Builder + Chris (policy).
- **[P1] A10 — Session hardening + CSRF decision.** Role cookie 15-min TTL is fine (`roleCookie.ts:32`); no idle/absolute session policy, no logout-everywhere, no CSRF synchronizer layer (mitigations today: CORS default-deny + SameSite=lax). **Do:** set Clerk session lifetimes, add re-auth for sensitive ops (overlaps A4), either add CSRF tokens on cookie-authed mutations or document why CORS+SameSite suffices per route class. Owner: Builder.
- **[P2] A11 — Clerk webhooks (if adopted) must verify svix signatures.** No consumer exists today — keep it that way or verify signatures on day one. Owner: Builder.

## B. Application Security Hardening

- **[P0] B1 — Supply-chain pipeline (ASVS G8 / 1.14.3).** No dependency audit, no dependabot/renovate, no SAST, no SBOM, no SRI, in any of the verified workflows (`.github/workflows/` full listing). **Do:** add `pnpm audit --prod` gate + `dependabot.yml` + semgrep (SAST) + SBOM generation (syft/CycloneDX) + gitleaks secret-scan; add SRI or self-host external scripts. **Done when:** CI fails on known-vuln deps and the SBOM ships per release. Owner: Builder.
- **[P1] B2 — Real request validation (ASVS G7).** `middleware/validateRequest.ts:1-11` is an explicit no-op; zod in only 8 backend modules; **0 zod imports across ~251 web `app/api/**/route.ts` files**. **Do:** implement the middleware; schema-validate all mutating backend routes first, then web API routes (prioritize apply/share, employer actions, matcha, profile, snapshot). Owner: Builder.
- **[P1] B3 — Distributed rate limiting + trust proxy (ASVS G3).** In-memory counters, `req.ip` with no `app.set('trust proxy')` (`publicSafety.ts:15-16,55-68`) — behind Railway's proxy all anonymous traffic can share one bucket and counters reset per deploy/instance. **Do:** set trust proxy, move limits to Redis/Postgres, key by forwarded-for + route class, cover `/verify/[npi]`, acceptance-history, `/api/snapshot/:id`. Owner: Builder.
- **[P1] B4 — Salt/HMAC public claim digests (ASVS G4).** `routes/public.ts:162-171` publishes raw SHA-256 `claimHashes`; low-entropy payloads are dictionary-testable. **Do:** HMAC with server secret (or per-snapshot salt), migrate existing exposures, add a dictionary-attack regression test. Owner: Builder.
- **[P1] B5 — Non-root containers (ASVS G11).** No `USER` directive in `apps/api/Dockerfile:28-39` or `apps/web/Dockerfile:37-63`. **Do:** add unprivileged user + read-only filesystem where possible. Owner: Builder.
- **[P1] B6 — PII-at-rest posture.** Zero field-level encryption in `schema.prisma`; `DATABASE_URL` TLS mode not pinned in repo; classification vocabulary exists but unenforced. **Do:** founder decision — field-level encryption for NPI/email/phone vs. documented compensating controls; pin `sslmode=require`; record in security docs. Owner: Chris decision + Builder.
- **[P1] B7 — Key management + rotation.** `RECEIPT_PRIVATE_KEY_JWK` (and `VCV_PRIVATE_KEY`) live only as Railway env values; kid static in prod; **no documented rotation and no escrow — key loss invalidates every issued receipt** (`receiptIssuer.ts:19-53`, disaster-recovery draft flags it). **Do:** secure offline escrow now (P0-adjacent), write rotation runbook (dual-kid overlap window), evaluate KMS. Owner: Chris + Builder.
- **[P1] B8 — External penetration test before enterprise GA.** Self-assessments exist (ASVS L1+L2, red-team sim); no third-party test. **Do:** engage firm post-A1/A2/B1, remediate criticals, keep the letter for buyer security reviews. Owner: External + Chris.
- **[P2] B9 — Malware-scan uploads (ASVS G12).** `routes/documents.ts:26-28` buffers uploads with no AV pass. Add ClamAV/vendor scan + enforce size/type limits (ASVS 12.1.1). Owner: Builder.
- **[P2] B10 — `dangerouslySetInnerHTML` audit.** Four sites: `JsonLd.tsx:8`, `ApiSandbox.tsx:128`, `MatchaConstellation.tsx:356`, `EcosystemMap.tsx:85`. Sanitize or justify each with a comment + test. Owner: Builder.
- **[P2] B11 — Widget/iframe CSP.** When H1 restores `/widget/apply`, scope `frame-ancestors` to an embedder allowlist; postMessage origin checks. Owner: Builder (with H1).

## C. Data Layer & Persistence

- **[P0] C1 — Durable audit ledger.** `services/audit/auditLedger.ts:87-151` is **in-memory** (restart loses it; multi-instance splits it) while some routes write Prisma `AuditEvent` directly — two audit truths. **Do:** one durable write path (Postgres `AuditEvent`) behind the ledger API, keep hash-per-entry, backfill the routes that skip audit (e.g. `POST /api/matcha/intent` writes none). **Done when:** every mutating route writes a durable AuditEvent; restart/replay test passes. Owner: Builder. *This is the "audit-first" doctrine actually holding in production.*
- **[P0] C2 — Eliminate per-process state (9 stores).** Inventory (backend audit): `rateLimiter.ts:16` counters · `matcha.ts:100` `intentStore` (**unbounded Map — memory leak, TODO "Wave 190+ migrate to DB"**) · `eventQueue.ts:25` (drops oldest silently at 10k) · `PsvVerificationCache` · onboarding flows · copilot conversations · nursys etag cache · 2 TTL caches. **Do:** move each to Redis/Postgres or explicitly pin + enforce single-instance deployment with a documented constraint. **Done when:** a 2-replica deploy passes a consistency smoke; no unbounded Maps remain. Owner: Builder.
- **[P0] C3 — Prod schema verification for the 7 new migrations.** `20260704000000_matcha_preferences` → `20260705150000_readiness_snapshots` auto-apply via `railway.toml:7` `preDeployCommand` (startup fallback in `server.ts:166-217`); two stray `manual_start_activation_*.sql` files sit un-namespaced in `prisma/migrations/`. **Do:** verify all 7 applied in prod + dependent features live (matcha prefs, OTP binding, attestation, self-attested profile, opportunity actions, leads, snapshots); resolve or relocate the manual SQL files; add a migration-drift check to release-verify. Owner: Builder + Chris (prod check).
- **[P1] C4 — Idempotency on mutating POSTs.** `IdempotentResponse` table exists (`schema.prisma:215-225`) but only the identity pipeline uses it; `/api/matcha/intent`, opportunity-action, employer-action, snapshot-issue, apply/share all dupe-write on client retry. **Do:** Idempotency-Key header + route-layer enforcement on the five paths above. Owner: Builder.
- **[P1] C5 — DB-level invariants for new tables.** New migrations lack CHECK constraints (truth-contract literals), PilotLead↔AuditEvent FK, and ReadinessSnapshot immutability (an UPDATE would succeed silently; contentHash has no integrity verification on read). **Do:** constraint migration + hash-verify on serve + immutability trigger or revoked UPDATE grant. Owner: Builder.
- **[P1] C6 — Data-subject rights + retention enforcement.** No clinician full-export, no account-deletion/right-to-erasure endpoint, no org offboarding export; `retentionFoundation` literals `retentionEnforced: false`, `autoDeleteLive: false`; PsvReceipt `ttlSeconds` never checked; RefreshToken cleanup absent. **Do:** export + delete endpoints (audit-safe: tombstone vs. hard-delete decision for audit rows), scheduled retention jobs. Owner: Builder + Chris (retention policy decision).
- **[P0] C7 — Backups + restore drill + key escrow.** Railway Postgres backup schedule/retention unverified; restore never rehearsed; RTO/RPO only drafted (`docs/.../disaster-recovery.md:31-56`); signing-key backup missing (see B7). **Do:** confirm/enable backups, execute one restore drill against a scratch env, ratify RTO/RPO, escrow keys. **Done when:** a documented, dated, successful restore exists. Owner: Chris + Builder.
- **[P2] C8 — Pagination + N+1 fixes.** `publicProfile.ts:100-170` unbounded `findMany` + per-artifact claims; matcha opportunities and queue lists unpaged; hardcoded `MAX_EVENTS=5` style caps. **Do:** cursor pagination on list endpoints; `select` discipline on hot reads. Owner: Builder.
- **[P2] C9 — OpenAPI sync + versioning policy.** `openapi.ts` misses ≥6 newer routes (snapshot, employer-action, matcha opportunities, public profile, audit stream); no versioning strategy. **Do:** regenerate/extend spec, publish versioning + deprecation policy (enterprise integrators need this). Owner: Builder.
- **[P2] C10 — Prisma pool tuning.** Bare `new PrismaClient()` (`graphql/prisma_client.ts:8`); no pool/timeout config for prod concurrency. Owner: Builder.
- **[P2] C11 — Dead/misleading code cleanup.** `services/billing/billingEngine.ts` is a `@ts-nocheck` stub (hardcoded prices, unmounted — chip task_fce68130); 41 `@ts-nocheck` files; 43 skipped tests; 7 reportedly-phantom dist-only packages. **Do:** delete or replace billing stub (with L1), burn down `@ts-nocheck`, audit phantom packages. Owner: Builder.

## D. Trust Engine: Sources & Monitoring

- **[P0] D1 — STATE_BOARD/FSMB physician-licensure lane (blocker #6).** Gated stub — no live adapter behind `STATE_BOARD_ENABLED`; CA boards are the only live state lanes. **Do:** procure FSMB DocInfo subscription (Vendor/Chris), implement fetcher + parser + fail-closed tests; license claims stay `gated` until live. Owner: Chris/Vendor → Builder.
- **[P0] D2 — SAM.gov exclusions live (blocker #7).** Honest gated adapter landed (`samGovAdapter.ts`, default off); needs `SAM_GOV_API_KEY` + real fetcher; checks currently return `EXCLUSION_CHECK_NOT_AVAILABLE`. **Do:** obtain key (Chris), wire fetcher, staging parity vs OIG results, flip flag. Owner: Chris → Builder.
- **[P0] D3 — Nursys E-Notify (blocker #8).** `sourceRegistry.ts:28` throws "Real Nursys adapter not implemented" if flagged on. **Do:** sign NCSBN E-Notify agreement (Chris/Vendor), implement adapter, keep `gated`/`accessRequired` until then. Owner: Chris/Vendor → Builder.
- **[P0] D4 — Continuous monitoring GA (blocker #9).** Scheduler real but default-off (`monitoringScheduler.ts:75-88`, 6h cron); drift/decay logic partial; no NCQA-cadence re-checks (license expiry + exclusions monthly); no "monitoring active" badge; alert dispatch stubbed (`continuousMonitor.ts` null notification provider — ties F3). **Do:** finish drift evaluation, define + enforce per-lane re-check cadence, enable `MONITORING_ENABLED` in prod with runbook, surface honest freshness/monitoring state in passport UI, wire alerts. **Done when:** a seeded license-expiry flips coverage to `stale`, notifies, and fails closed on the review surface. Owner: Builder + Chris (enable).
- **[P1] D5 — NPPES bulk-file ingestion (blocker #10).** Catalog declares `NPPES_BULK`; no downloader; runtime is API-v2.1-only (boot-asserted). **Do:** weekly bulk download + delta ingest for universe-scale enrichment. Phase-gated: not a pilot blocker, is an enterprise-scale one. Owner: Builder.
- **[P1] D6 — Cross-source divergence enforcement.** The 7-rule divergence design (god-mode H) exists on paper; CRS penalty enforcement unverified. **Do:** implement divergence detection into CRS with tests + surfaced explanation. Owner: Builder.
- **[P2] D7 — Staleness SLA surfacing.** Wave M computes freshness overlays read-time; ensure per-claim last-checked + regenerate affordance render on snapshot/passport surfaces (never present stale as current). Owner: Builder.
- **[P2] D8 — Real OCR behind flag (Wave O).** `documentPipeline.ts` is keyword/regex with **hardcoded 0.85–0.90 confidence scores** (dishonest-looking); no vision model. **Do:** wire `OCR_PROVIDER` vendor path, keep regex fallback, fix stub confidences, guarantee extraction never promotes a claim to `checked`. Owner: Builder.

## E. Credentials, Crypto & Standards

- **[P0] E1 — Sign the status list for real (blocker #11).** `statusListManager.ts:84` DataIntegrityProof `proofValue` is a placeholder — verifiers cannot validate revocation authenticity. **Do:** real Ed25519/ES256 proof generation + verifier-side validation + fail-closed tests incl. mobile offline revocation. Owner: Builder.
- **[P1] E2 — NIST 800-63-4 mapping + passkey/DPoP AAL2 (blocker #12).** DPoP header check exists, payload validation/replay stubbed (`haip-config`, `security/dpopReplayTable.ts`); passkey/WebAuthn 0%. **Do:** IAL mapping doc, complete DPoP, add passkey path for AAL2 claims. Owner: Builder.
- **[P1] E3 — Decide the standalone services' fate.** `issuer-api` (no issuance route beyond `/health`/`/readyz`), `verifier-api`, `status-api` are deployable but have **zero inbound calls from web/backend** (status-list logic that matters lives in backend `statusListManager.ts`). **Do:** founder decision — integrate (wire consumers, add OID4VCI issuance) or fold into backend and retire the apps. Owner: Chris decision → Builder.
- **[P1] E4 — Identity-proofing vendor for clinician↔NPI binding.** Email-OTP possession factor is live; gov-ID/liveness all `isLive: false` (`identityVerificationControls.ts`); binding readiness stuck at `foundation_ready`. **Do:** select vendor (Persona/Onfido/Stripe Identity — needs DPA/BAA review), integrate as an IAL2-track step in the signup gate. Owner: Chris/Vendor → Builder (feeds F1, E2).
- **[P2] E5 — Zero-PHI-on-chain guardrail test.** Chain integration is a deliberate 5-line disabled stub (`blockchain_integration.ts`); no automated test enforces the doctrine if it's ever re-enabled. Add the test now, cheap insurance. Owner: Builder.
- **[P2] E6 — Real signed proof-pack/dossier export.** `/dossier` data is `isDemo: true` with stub hashes/sigs; employer packet endpoint (`employerActions.ts:76-93`) exports unsigned ZIP/JSON. **Do:** EdDSA-sign exports, wire `AuditProofViewer` to real data, JC survey-ready export shape (with K4). Owner: Builder.

## F. Clinician Product Completion

- **[P0] F1 — Finish the signup gate 4/4 (blocker #1).** 1–3/4 merged (#538/#539/#542); `accountCreationProductionReady: false`, `identityProofingComplete: false` (`selfServeSignupFoundation.ts:26-27`); wallet-provisioning step outstanding; student/no-NPI lane is open draft [PR #543](https://github.com/christoler/vitalcv/pull/543). **Do:** ship wallet provisioning, land/close #543, flip literals only when the whole path is real. **Done when:** a new clinician self-serves role→NPI→attest→OTP→wallet with zero operator help. Owner: Builder.
- **[P0] F2 — E2E suite as a CI gate (blocker #4 / ASVS G5).** No playwright/cypress anywhere (verified). **Do:** Playwright against a local prod build: signup happy path, **BLOCKED-passport-cannot-be-accepted fail-closed case**, share→/verify loop, employer accept→recognition. Wire as PR gate. Owner: Builder. *This gates F1's acceptance.*
- **[P1] F3 — Transactional email/notifications infrastructure.** No provider in any package.json (Resend/SES/Postmark absent); `employerNotifications.ts` is an in-memory map; `continuousMonitor` notification provider is null; acceptance/expiry/invite emails unsendable. **Do:** pick vendor (+ DPA), wire OTP/acceptance/expiry/invites + preference model, persist notifications. Owner: Chris (vendor) → Builder. *Blocks A3 invitations + D4 alerts.*
- **[P1] F4 — De-demo credential presentation.** `CredentialPresentationActions.tsx:28-140` ships `DEMO_CREDENTIALS`/`DEMO_CLAIM_FIELDS`; wallet fetch unimplemented. **Do:** back with real wallet credentials or remove from prod surfaces until real (honest-copy risk). Owner: Builder.
- **[P2] F5 — PWA completion.** `manifest.ts` exists; no service worker/offline shell; installability unverified. Owner: Builder.
- **[P2] F6 — Resume/document storage decision.** Resume is URL-only (no blob storage exists); imports (PubMed/LinkedIn/Doximity) remain `isLive: false` candidates. **Do:** choose blob store (S3/R2) + validation + AV (B9), or keep URL-only and say so in UI copy; align import copy with reality. Owner: Chris decision → Builder.
- **[P2] F7 — `/apply/[bundleId]` invalid-id 500→404.** Known tracked gap from the route-contract work. Owner: Builder.
- **[P2] F8 — AI-label enforcement test.** Cover-letter/matcha disclosure labels ("AI-generated", "Based on observed patterns") are convention, not test-enforced; add serializer-level assertions + the "AI can't write trust-state" guardrail test (with M5). Owner: Builder.
- **[P2] F9 — i18n posture.** English-only, hardcoded. Document as a GA constraint or adopt a framework later; enterprise buyers will ask. Owner: Chris decision.

## G. Employer/Verifier Product & Network

- **[P0] G1 — Production verifier worklist.** `worklist.ts:37` `dbBackedWorklist: false`, `productionWorkflowLive: false`, no live `/employer/worklist` surface — while #253-era DB-backed `getWorklist()` reads exist. **Do:** reconcile the two, ship the production worklist + 6-state review lifecycle + polling, flip literals. **Done when:** a verifier org triages real candidates without touching demo shells. Owner: Builder (depends A1/A2/A3).
- **[P1] G2 — Issuer persistence GA.** `ISSUER_PERSISTENCE_ENABLED` default-off; `/issuer/psv-reuse` writer **unwired** (pure transform only); `recordedBy: 'demo'` fallback everywhere; demo disclaimers exist in code comments/copy (verified) but the persistence path is off. **Do:** enable in prod post-A1, wire psv-reuse + PolicyReviewDecision writers, keep demo banners for demo mode only. Owner: Builder + Chris (flag).
- **[P1] G3 — Acceptance-history endpoint hardening.** NPI-keyed public read: notes-leak fixed (#498) but no rate limiting (B3) and digests unsalted (B4); scope tests thin. Owner: Builder (with B3/B4).
- **[P1] G4 — Cross-tenant reuse with consent (Wave T prereq).** `crossTenantReuseImplemented: false`; `checkCrossTenantReuseBlock` exists with tests but single-tenant only. **Do:** deny/allow matrix, consent gates, zero cross-tenant leakage tests; then the Wave T network-signal spike. Owner: Builder (after A1/A2).
- **[P2] G5 — Head-start "days saved" honesty check.** Computation lives across `velocityEngine.ts`/`impact.ts`/`roiReportService.ts`; verify inputs are real, label as observed-pattern where inferred, surface on the queue (Wave L badge shipped). Owner: Builder.
- **[P2] G6 — Employer-visible KPI/ROI view.** `computePilotKpis` is internal-only (X-Monitoring-Secret). Decide the scoped employer-facing subset + illustrative-labeling rules. Owner: Chris decision → Builder.
- **[P2] G7 — SEAL insight surfaces (Wave P).** Capture is real + append-only (tests exist); zero read surfaces. Build scoped read-only aggregates with advisory labels + append-only invariant test. Owner: Builder.
- **[P2] G8 — Queue UX persistence.** Filter/sort preferences on the Wave L queue aren't persisted. Owner: Builder.

## H. Embed, Distribution & Mobile

- **[P1] H1 — Restore `/widget/apply` (Wave N).** `packages/embed-sdk/src/index.ts:151` mounts an iframe to a route that only exists in `_archive/wave119` — **every SDK embed 404s today**. **Do:** rebuild the route on the active apply flow, verify postMessage handshake, implement referenced-but-missing `card.json` + `embed.svg` consumers, CSP per B11. Owner: Builder.
- **[P1] H2 — Mobile wallet productionization (Wave R).** Services + tests built (`LocalCredentialStore`, `OfflinePresentationEngine`, `OID4VPHandler`, `NotificationService`, `WalletSyncService`); `app.json` wired; **no `eas.json`**, no documented build, wallet-sdk RN bundling unproven, issuer endpoint wiring unverified. **Do:** EAS config + README + env wiring + issue→store→present→verify smoke + TestFlight build proof. Owner: Builder.
- **[P2] H3 — Offline revocation fail-closed on mobile.** Untested today (ties E1). Owner: Builder.

## I. Infrastructure, CI/CD & Release

- **[P0] I1 — Backend tests become a PR gate.** 238 test files; `ci.yml` runs web only; `monorepo.yml:86-98` excludes backend ("database unavailable, false failures"); smoke runs on push-to-main only. **Do:** postgres service container in CI + `prisma generate` step + placeholder `DATABASE_URL` for pure suites (known harness gotchas), un-exclude backend, make it required. Owner: Builder.
- **[P0] I2 — Public-claims/banned-strings CI gate.** `scripts/check-public-claims.ts` **is not on main** — it exists only as an untracked local file in the working tree; no workflow enforces the banned-strings matrix (`vitalcv-public-claims-matrix.md`) beyond per-page vitest pins. **Do:** commit the script, wire as a PR gate over rendered public surfaces, extend copy-guard tests to all public pages. Owner: Builder. *This is the automated backstop for the recurring "copy-polish drops truth-contract strings" failure mode.*
- **[P1] I3 — Deploy verification hardening.** `deployment-integrity-check.ts` runs manually/post-deploy only; `deploy-health-probe.yml:22-34` sleeps a flat 60s (race — red probes after every web deploy, chip task_0f7ab303); in-memory source-health snapshot store compounds it (C2). **Do:** gate probes on Railway deploy-settled status, schedule integrity checks, de-flake. Owner: Builder.
- **[P1] I4 — Finish release monitoring (#508).** `release-verify.yml` returns neutral "pending" without `CLERK_SECRET_KEY`/`RAILWAY_API_TOKEN`/webhook wiring; Ops Center deployment-integrity panel needs `RAILWAY_API_TOKEN` too. **Do:** set secrets + Railway webhook (Chris), verify commit-status lands red/green, runbook it. Owner: Chris + Builder.
- **[P1] I5 — Env fail-fast in prod.** Web `lib/env.ts:265-270` logs-but-never-throws in production (stale container keeps serving with missing secrets); `YC_DEMO_MODE` prod guard logs to console.error only. **Do:** hard-fail on missing critical secrets at boot; structured-log the demo-mode guard. Owner: Builder.
- **[P1] I6 — Kill-switch matrix.** Flags scattered across client (`NEXT_PUBLIC_FEATURE_MATCHA_V2=true`, `WORKSPACES=true`) and server (`SYSTEM_FROZEN`, `MONITORING_ENABLED`, `VERIFIER_RBAC_ENFORCED`, `ISSUER_PERSISTENCE_ENABLED`, `SAM_GOV/NURSYS/STATE_BOARD`, `LOW_FRICTION_MODE`, `YC_DEMO_MODE`); no single doc of default/owner/rollback per flag; client-side flags have no runtime kill. **Do:** one flag registry doc + emergency-disable runbook. Owner: Builder + Chris.
- **[P2] I7 — `.dockerignore` hardening.** Images can ingest `.claude/` (217-line settings), `design-handoff/`, archives, pitch decks. Owner: Builder.
- **[P2] I8 — Performance gates.** `images.unoptimized: true` in next.config; no bundle-size gate; no Lighthouse CI (LCP budget); no CDN story. Owner: Builder.
- **[P2] I9 — Load testing.** None (k6/artillery absent). Golden path + public verify endpoints under load; capacity targets documented. Owner: Builder.
- **[P2] I10 — Resilience posture.** Single-region us-west2; no failover plan; document accepted risk or plan multi-region for enterprise SLAs. Owner: Chris decision.
- **[P2] I11 — Build-chain issues #194/#195.** `@vitalcv/shared` TS6059 + bare `pnpm --filter web build` failure without turbo prebuild. Owner: Builder.

## J. Observability & Operations

- **[P1] J1 — Backend error tracking + trace correlation.** Sentry is web-only + DSN-gated; backend has `@sentry/node` in errorHandler but no prod DSN story; **no request/correlation IDs across web→backend** — a user session cannot be traced. **Do:** wire backend Sentry + X-Request-ID propagation + release tagging. Owner: Builder.
- **[P1] J2 — Metrics + alerting.** No request-rate/latency/error dashboards, no alert rules (5xx spike, probe fail, source GATED transitions — Wave S). **Do:** minimal metrics layer + Slack alert routing + GATED alerts in `sourceOpsService.ts`. Owner: Builder.
- **[P2] J3 — External uptime checks.** None. Add curl-level checks for vitalcv.com, api `/health`, a sample `/verify` (Clerk CDN blocks browser bots — avoid browser-based synthetics). Owner: Builder.
- **[P2] J4 — Log retention + PII-in-logs sweep.** Railway-managed transport unverifiable; redaction rules not live. Document retention; sweep hot paths for PII logging. Owner: Builder.
- **[P2] J5 — Pilot ops spine (Wave S remainder).** Operator remediation hints, absolute ISO timestamps on hover, diagnostics polling, 4-level spine status surfacing. Owner: Builder.
- **[P2] J6 — Ops Center phases 2–4.** Platform Health → Business Health → Founder Control per roadmap; depends I4 token. Owner: Builder.
- **[P2] J7 — Incident response reality check.** Runbooks/INCIDENTS.md exist but DR steps never rehearsed (ties C7); define pilot-tier on-call/escalation honestly. Owner: Chris + Builder.

## K. Compliance, Legal & Privacy

- **[P0] K1 — HIPAA BAA + subprocessor stack.** DPA template exists (`/legal/dpa`, marked non-binding); **no BAA template anywhere**; no subprocessor list; vendor compliance posture (Clerk, Railway, Anthropic, future email/identity vendors) undocumented. Healthcare buyers cannot close without this. **Do:** counsel-reviewed BAA, subprocessor page, vendor BAA/DPA matrix. Owner: Chris (counsel) + Builder (pages).
- **[P1] K2 — SOC 2 Type II program start (blocker #13).** Business procurement, not code: pick auditor, scope Type I→II, stand up evidence collection (soc2-readiness-map exists as self-assessment). Interim artifact: security whitepaper + pen-test letter (B8). Copy stays "aligned", never "certified". Owner: Chris + External.
- **[P1] K3 — Privacy engineering to done.** No CMP/consent banner (cookie policy exists and still names Vercel — stale); analytics vendor unwired (`analyticsFoundation` honest literals); data-subject rights = C6; retention = C6; redaction enforcement `redactionLive: false`. **Do:** CMP, refresh cookie/privacy pages, wire consent-gated analytics or ship without analytics deliberately. Owner: Builder + Chris.
- **[P1] K4 — Compliance proof-pack surfaces (blocker #12).** JC survey-ready export, NIST 800-63-4 IAL mapping doc, AAL2 path — none present (ties E2/E6). Owner: Builder.
- **[P2] K5 — Trust-center basics.** `security.txt`, accessibility statement, honest trust/security page ("aligned, not certified"), uptime/status commitments. Owner: Builder.
- **[P2] K6 — Legal page currency.** DPA counsel review (template dated 2026-05-01), terms coverage of AI features + marketplace + snapshots, cookie inventory refresh. Owner: Chris (counsel) + Builder.
- **[P2] K7 — NCQA/CVO alignment collateral.** Honest mapping of product controls to CVO certification elements for buyer diligence (pairs with D4). Owner: Builder + Chris.

## L. Commercial: Billing, Support, GTM

- **[P1] L1 — Payment collection.** Stripe absent from every package.json; `pricingFoundation.ts:28-30` `collectsPayment/subscriptionActive/checkoutIntegrationLive` all false; no entitlement/plan gating anywhere. **Do:** founder pricing/packaging decision → invoicing-first or Stripe checkout → entitlement checks on employer features → flip literals when true. Owner: Chris decision → Builder.
- **[P1] L2 — Support operations.** `supportAdminFoundation.ts:39-40` `staffed: false`, `productionAdminEnabled: false`; no helpdesk/inbox, no SLA doc, no admin user-lookup tooling. **Do:** support channel + response-time commitment + minimal admin lookup (auth per A4). Owner: Chris + Builder.
- **[P2] L3 — Funnel instrumentation.** No CTA event tracking, no pilot-stage cohort tracking, leads flow to Slack+DB but no CRM handoff. Depends K3 consent. Owner: Builder.
- **[P2] L4 — Sales collateral automation.** ROI calculator, case-study template, pilot proof-pack generation (docs exist as strategy only). Owner: Builder + Chris.
- **[P2] L5 — Demo environment.** Seeded fixtures + reset flow (`demoResetFoundation` non-destructive; keep it that way). Owner: Builder.

## M. Quality: Testing & Accessibility

- **[P0] M1 — Main goes green.** 32 pre-existing vitest failures on main (2026-07-02 count) + quarantined suites (postrelease-truth-cleanup, live-path-regression, homepage e2e) sitting in vitest config exclusions. **Do:** fix or consciously delete each; zero quarantine; failing main is incompatible with enterprise release discipline. Owner: Builder.
- **[P1] M2 — Backend suite health.** 43 skipped tests triage; error-path coverage on hot routes; ties I1. Owner: Builder.
- **[P1] M3 — WCAG 2.2 AA program.** Axe gate covers hero routes only; known contrast violation accepted (`a11y-known-violations.md`, DS-contrast-1 pending); no keyboard/focus-trap audit, no screen-reader smoke, `prefers-reduced-motion` unwired, no 44×44 touch-target audit. **Do:** extend axe gate to golden path + admin, run manual keyboard/SR passes, fix violations, publish statement (K5). Federal/healthcare buyers require this. Owner: Builder.
- **[P2] M4 — Trust-integrity guardrail tests.** Missing per audit: CRS score reproducibility; AI-output-cannot-write-trust-state; mobile offline revocation fail-closed; zero-PHI-on-chain (E5). Owner: Builder.
- **[P2] M5 — API contract tests.** Schemathesis/dredd against the synced OpenAPI (after C9). Owner: Builder.
- **[P2] M6 — Visual regression.** Screenshot suite over the D57 design-system surfaces to protect the ported visual system. Owner: Builder.

## N. Process, Governance & Repo Hygiene

- **[P1] N1 — Open-PR triage.** ~30 stale drafts (#394–#443 era) still open; [#465](https://github.com/christoler/vitalcv/pull/465) (ops-engine live), [#506](https://github.com/christoler/vitalcv/pull/506) (ties A1), [#543](https://github.com/christoler/vitalcv/pull/543) (ties F1) need land-or-close decisions. Owner: Chris + Builder.
- **[P2] N2 — Board + blocker hygiene cadence.** Keep BOARD-RECONCILE discipline (top-tables edited in place); launch-blockers ghost rule enforced each closing wave. Owner: Builder (docs waves).
- **[P2] N3 — Docs currency sweep.** This audit caught the stale-branch trap (local `launch-blockers.md` was the May version); add "superseded by" headers to 2026-05 ops docs; keep REBASELINE per wave. Owner: Builder.
- **[P2] N4 — Repo artifact hygiene.** Pitch decks (`VitalCV_Pitch_Deck_Enhanced.pptx` in root of working tree), `design-handoff/` bundle, worktree fleet sprawl — decide what belongs in-repo vs. external storage (ties I7). Owner: Chris decision.
- **[P2] N5 — Merge-verification posture during Codex blackout.** Codex rate-limited until ~2026-08-03; tiered merge policy (Fable self-merges Tier 0/1, Codex Tier 2, Chris Tier 3) is the operative rule — queue Tier-2 verifications for the reset, don't bypass. Owner: Chris (policy holder).

---

## Critical path & sequencing

```
NOW (unblocks everything):        I1 backend CI gate · I2 claims gate · M1 main green · C3 prod schema verify
SECURITY SPINE (serialized):      A1 header-trust → A2 RBAC on → A3 org lifecycle → G1 worklist → G2 issuer GA → G4 cross-tenant
                                  (B1 SCA/SAST · B3 rate limits · B4 digest salting run parallel to the spine)
GOLDEN-PATH PROOF:                F1 signup 4/4 → F2 Playwright e2e (gates the literal flips)
DATA DURABILITY:                  C1 durable audit → C2 kill in-memory state → C4 idempotency → C7 backup/restore drill + key escrow
SOURCE TRUTH (procurement-led):   D1 FSMB · D2 SAM key · D3 Nursys agreement  → adapters → D4 monitoring GA
STANDARDS:                        E1 signed status list → E2 DPoP/passkey · E4 identity vendor
BUYER-FACING (parallel):          K1 BAA · K2 SOC2 start · L1 billing decision · L2 support · F3 email vendor · M3 WCAG
DISTRIBUTION (independent):       H1 widget · H2 mobile build
```

**Procurement queue for Chris (start immediately — longest lead times):** FSMB DocInfo (D1) · SAM.gov API key (D2) · NCSBN E-Notify (D3) · identity-proofing vendor (E4) · transactional-email vendor (F3) · Stripe/billing decision (L1) · SOC 2 auditor (K2) · pen-test firm (B8) · BAA counsel (K1) · Railway backup verification + key escrow (C7/B7).

## Enterprise gate checklist (the literal "are we 100%?" test)

1. All 23 P0s closed with cited evidence (merge + prod verification each).
2. All 12 canonical launch blockers in `docs/ops/launch-blockers.md` moved to the resolved table.
3. ASVS gap register G1–G12 fully closed; V4/V13/V14 re-scored; no Gap rows remain.
4. Foundation honesty literals flipped **by implementation, never by edit**: `accountCreationProductionReady`, `identityProofingComplete`, `rbacEnforced`, `invitationSystemLive`, `dbBackedWorklist`, `productionWorkflowLive`, `crossTenantReuseImplemented`, `collectsPayment`, `retentionEnforced`, `redactionLive`, `staffed`.
5. E2E suite green in CI including fail-closed cases; main at zero known-failing/quarantined tests.
6. One executed restore drill + escrowed signing keys on record.
7. BAA + subprocessor list published; SOC 2 engagement letter signed; pen-test report remediated.
8. Copy still passes the banned-strings gate on every public surface — "aligned", never "certified"; coverage-honest everywhere.

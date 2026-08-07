# Open-PR disposition — 2026-08-02

Owner: platform security · Snapshot: 2026-08-02 14:55 UTC · **258 open PRs**

Every open PR is dispositioned below. Nothing in this document closes anything
by itself — execution is a separate, deliberate step (appendix), so this stays
reviewable before anything outward-facing happens.

## Policy

A PR merges only under the merge gate: the **full required check set green plus
real verification** of the change. For a PR that has sat unmerged while `main`
absorbed hundreds of commits, the cost of re-validating usually exceeds
re-cutting the same intent from current `main` — and several old trees predate
load-bearing doctrine (truth-contract copy bans, the three-group role model,
Calm Wave ALL-LIGHT, ADR 0006's authz gate), so merging them would *reintroduce
settled-away behavior*. Age tiers:

- **Tier S (stale, created before 2026-06-01): 225 PRs → close as superseded.**
  These span 2025-12 through 2026-05 — between 2.5 and 8 months old, from
  before the truth-contract overhaul, the Career Evidence Network doctrine and
  the current deploy topology. The standard receipt comment (appendix) points
  at this document; any still-wanted intent gets re-cut small from `main`.
- **Tier R (recent, 2026-06-01 onward): 33 PRs → individually dispositioned.**

## Tier R — individual dispositions (33)

| PR | Created | Disposition | Rationale |
|---|---|---|---|
| #506 | 2026-07-03 | **Close — superseded** | Title itself says "DO NOT MERGE until backend env rollout". The `/api/me/role` auth path was rebuilt after #507/#542/#549 landed; a 4-week-stale trimmed variant of a superseded gate is not re-mergeable. Anything still wanted re-cuts from current `main`. |
| #573–#577 | 2026-07-06 | **Merge individually after green** | Dependabot GitHub-Actions bumps (checkout v7, setup-node v7, upload-artifact v7, github-script v9, pnpm/action-setup v6). Real upkeep — runners are already warning about the Node-20 deprecation these clear. Rebase each, wait for the full required set, merge one at a time. |
| #582 | 2026-07-06 | **Close — superseded by #1031** | expo-notifications 0.29→57 crosses Expo SDK lines (52→56-era). #1031 moves `apps/mobile` to SDK 53 with the SDK-correct `~0.31.5` via `expo install --fix`. |
| #748 | 2026-07-18 | **Founder call — likely close** | G4 backlinks work; G3 merged as #743 and ADR 0006 (#804) since re-scoped the public backlinks endpoint behind an authz/consent gate. If the G4 tree predates ADR 0006's gate it must not merge as-is. Re-validate against the ADR or close and re-cut. |
| #809 | 2026-07-21 | **Close — superseded by #1032** | Same axios range, #1032 (today, active lane) goes further (1.19.0) and carries the advisory receipt. |
| #844 | 2026-07-25 | **Merge after green** | `apps/marketing` is a separate app (doctrine: never pull web changes into it) — #1029 did not cover its Next; this dependabot bump is the marketing-side counterpart. |
| #845, #852, #853, #854, #855, #857, #860, #872, #879 | 2026-07-25/26 | **Merge individually after green** | Routine dependabot version bumps (postcss, vite, otel, form-data, multer, turbo, babel plugin, flatted, ajv). Watch #855 multer (backend upload path — needs Backend Tests green) and #857 turbo (build orchestrator — needs full suite green). |
| #891 | 2026-07-26 | **Merge after green** | flask 3.0.3→3.1.3 in `apps/api/bug-bounty` (isolated Python service, no JS CI coverage — exercise by hand per merge gate before merging). |
| #968 | 2026-07-29 | **Keep — active** | Dark-surface removal, consistent with the ALL-LIGHT ruling. Needs design-lint + film-regression eyes before merge. |
| #970 | 2026-07-29 | **Keep — active** | Public opportunities search board restore; demand-side lane. |
| #971 | 2026-07-29 | **Keep — active** | Backend QA against ephemeral DB — complements this PR's Backend-Tests promotion. |
| #977 | 2026-07-30 | **Keep — active** | start-mission Phase 1 persistence/projections; current wave work. |
| #978 | 2026-07-30 | **Keep — draft** | Explicitly draft (ParRequest Apply Intents). |
| #985 | 2026-07-31 | **Keep — active** | Glass-eyebrow design fix (Living Trust UX: glass on chrome). |
| #986 | 2026-07-31 | **Keep — active** | Continuity memory docs for Jul 30–31. |
| #1003 | 2026-08-02 | **Keep — active** | YC demo runbook correction (docs). |
| #1024 | 2026-08-02 | **Keep — active** | Design-system components wave (today). |
| #1030 | 2026-08-02 | **Keep — active** | Cinematic experience authority doc (today, parallel lane). |
| #1031 | 2026-08-02 | **Keep — this program (PR 1b)** | tar GHSA-23hp-3jrh-7fpw remediation via Expo SDK 53; merging under the full required set. |
| #1032 | 2026-08-02 | **Keep — active** | axios 1.19.0 advisory clear (today, parallel lane); supersedes #809. |
| #1033 | 2026-08-02 | **Keep — active** | Production convergence receipt doc (today, parallel lane). |


## Tier S — close as superseded (225)

Criteria, not per-PR archaeology: created before 2026-06-01 (most touched files
that have since been rewritten or removed), no pushes since creation month,
authored during wave series whose outcomes are already on `main` in later form
(replay identity, verifier discovery, launch/demo spine, institutional trust
surfaces, May merge-orchestration meta-PRs). Spot-checks during this audit
(#345 /verify surface — shipped canonically since; #370 banned-phrase CI —
live as `check-public-claims`; #356/#399 merge-readiness meta-docs about a
May-era PR stack) all confirmed supersession.

| PR | Created | Title |
|---|---|---|
| #1 | 2025-12-23 | feat: WAVE 5 — MATCHA engine and match audit logging |
| #2 | 2025-12-27 | Add Ed25519-signed VC issuance and verification audit logging |
| #4 | 2025-12-27 | Add MATCHA Lite matching API and Job Matches UI |
| #5 | 2025-12-27 | Add application report flow and credential packet view |
| #6 | 2025-12-27 | Verifier: DID-based signature verification, revocation checks, signed receipts, and QR endpoint |
| #7 | 2025-12-27 | Add World ID gating and automated credential lifecycle sweep |
| #8 | 2025-12-27 | Add pulse and discover persistence services |
| #9 | 2025-12-27 | Add compliance evidence pack API |
| #10 | 2025-12-27 | Add employer risk evaluation endpoint |
| #11 | 2025-12-27 | Add issuer registry models and service |
| #12 | 2025-12-27 | Add notification orchestrator for actionable events |
| #13 | 2025-12-27 | Add lifecycle renewal task modeling and calendar export |
| #14 | 2025-12-27 | Add ATS readiness adapters for Greenhouse and Workday |
| #15 | 2025-12-27 | Add trust graph edge capture and API surfaces |
| #16 | 2025-12-27 | Add renewal guidance service and lifecycle pulse hooks |
| #17 | 2025-12-27 | Enforce trusted issuer checks and OIDC4VP presentation intake |
| #18 | 2025-12-27 | Add ON readiness endpoints, status UI panel, and deploy/PR guardrails |
| #19 | 2025-12-27 | Add compliance export endpoint, issuance policy registry, and profile CTA |
| #20 | 2025-12-27 | Add PSL matching and application interview/hire endpoints with ON_COMPLETE emission |
| #21 | 2025-12-27 | Add verifiable credential issuance and audit flows |
| #22 | 2025-12-27 | Add credential lifecycle evaluation and pulse audit support |
| #23 | 2025-12-27 | Add trust ledger anchoring primitives and batch job |
| #24 | 2025-12-27 | Add employer readiness evaluation API |
| #25 | 2025-12-27 | Add system on-status evaluation endpoint |
| #26 | 2025-12-27 | Add public Merkle verification endpoint |
| #27 | 2025-12-27 | feat: WAVE 6 — MATCHA UI dashboard page |
| #28 | 2025-12-27 | Add revocation governance policies and erasure workflow |
| #29 | 2025-12-27 | Add consent receipts, /audit/history and credential audit timeline UI |
| #30 | 2025-12-28 | Add clinician readiness API, feedback ingestion, and recruiter match-gap insights + UI |
| #31 | 2025-12-28 | Add credential format registry and PSL MATCHA filters |
| #32 | 2025-12-28 | Add trust ledger anchoring scaffolding |
| #33 | 2025-12-28 | Add Pulse feed and command menu integration |
| #34 | 2025-12-28 | Add early access invites metrics and pilot storytelling mode |
| #35 | 2025-12-28 | feat: WAVE 25 — Clinician readiness score + feedback collector |
| #36 | 2025-12-28 | feat: WAVE 7 — Job application submission + audit logging |
| #37 | 2025-12-28 | Add job-action intent API, funnel stages, and compact portability support |
| #38 | 2025-12-28 | Add referral forwarding and signed audit export endpoints |
| #39 | 2025-12-28 | Add delegated credential attestation endpoints and MATCHA fuzzy specialty scoring |
| #40 | 2025-12-29 | codex-wave-04: issuance & verification enforced |
| #41 | 2026-01-25 | Add static role routes with shared layout |
| #42 | 2026-01-25 | feat(web): add role entry shell |
| #45 | 2026-02-09 | Fix React Server Components CVE vulnerabilities |
| #46 | 2026-02-09 | Fix React Server Components CVE vulnerabilities |
| #124 | 2026-04-08 | feat(holder): lock the clinician adoption loop |
| #125 | 2026-04-08 | feat(holder): generate repo salvage map and usability roadmaps |
| #126 | 2026-04-08 | feat(holder): implement repo harvest UX/TTFV improvements |
| #127 | 2026-04-09 | feat(holder): activate daily-use utility loop |
| #128 | 2026-04-11 | feat(decision): DecisionBlock UI + confidence primitives |
| #129 | 2026-04-11 | feat(ttfv): auto-start ingest stream for deep-linked NPI lookups |
| #131 | 2026-04-11 | feat(hybrid-loader): instant-render provider identity via cache + SSR seed |
| #132 | 2026-04-13 | feat(trust): Wave 13 employer explainability, next steps, and decision posture |
| #133 | 2026-04-13 | feat: wave14 graph substrate, system hardening, and marketing surfaces |
| #134 | 2026-04-13 | feat(conflict-resolution): add deterministic conflict-resolution engine |
| #153 | 2026-04-19 | feat(pilot): add pilot intake and operator handoff workflow |
| #156 | 2026-04-19 | feat(labs): acceptance-graph — predictive acceptance & routing |
| #158 | 2026-04-19 | feat(warranty): Trust Warranty & Risk Transfer wave |
| #159 | 2026-04-24 | feat(apply-vcv): Wave 246 — Apply with VitalCV core loop |
| #160 | 2026-04-24 | fix(smoke-test): WorkspaceMembership relations + Prisma field names |
| #161 | 2026-04-24 | fix(web): make canonical public shell usable and live (Wave LIVE-100) |
| #163 | 2026-04-25 | feat(web): AI Knowledge Inbox Agent — provenance-safe builder slice (GOD-3) |
| #164 | 2026-04-25 | feat(inbox): add provenance-safe AI knowledge inbox foundation |
| #165 | 2026-04-25 | feat(inbox): add provenance-safe knowledge inbox foundation |
| #181 | 2026-04-27 | docs(ops): reset completion board around product readiness |
| #190 | 2026-04-28 | fix(copy): remove wallet/real-time wording from passport entry |
| #206 | 2026-05-03 | docs(ops): apply security compliance delta after EV6 and crypto merges |
| #212 | 2026-05-03 | docs(ops): map honest path to full completion |
| #223 | 2026-05-04 | docs(ops): add release-checklist + CI gate (RELEASE-CHECKLIST-1) |
| #224 | 2026-05-04 | feat(ops): filesystem-derived route map + CI gate (RELEASE-ROUTE-MAP-1) |
| #225 | 2026-05-04 | ci(truth): banned-strings CI gate (CLAUDE.md enforcement) |
| #231 | 2026-05-04 | docs(security): add identity vendor foundation |
| #233 | 2026-05-04 | feat(commerce): foundation-tier Stripe checkout gate (collectsPayment: false) |
| #236 | 2026-05-04 | feat(pwa): service worker shell + manifest shortcuts (PWA-SHELL-1) |
| #237 | 2026-05-04 | docs(ops): database migration baseline + CI gate (DB-MIGRATE-1) |
| #238 | 2026-05-04 | feat(auth): signup domain gate + timing-safe magic-link recovery (AUTH-GATE-1) |
| #239 | 2026-05-04 | feat(upload): document upload foundation — USER_ENTERED provenance, MIME allowlist, 10MB cap |
| #240 | 2026-05-04 | feat(verifier): cross-tenant PSV reuse block — blocked_cross_tenant, consent-gate in main flow |
| #243 | 2026-05-04 | feat(rbac): verifier org RBAC enforcement — rbacEnforced true, /api/verifier/* gated |
| #244 | 2026-05-05 | feat(ci): add hero-route smoke test script and workflow |
| #245 | 2026-05-05 | feat(upload): add CV upload route and CvUploadZone (UPLOAD-CV-1) |
| #246 | 2026-05-05 | feat(export): add foundation-tier export bundle route (EXPORT-BUNDLE-1) |
| #247 | 2026-05-05 | feat(issuer): add policy decision persistence with ISSUER_PERSISTENCE_ENABLED gate |
| #248 | 2026-05-05 | feat(verifier): live verifier-invitation lifecycle (W6C invitationSystemLive flip) |
| #249 | 2026-05-05 | fix(a11y): wrap homepage in <main id="main-content"> landmark |
| #250 | 2026-05-05 | feat(demo): seed Macie Miller PA-C demo passport on /passport/[DEMO_NPI] |
| #251 | 2026-05-05 | feat(ops): DB migrate cutover runbook + dry-run + migration-shape gate |
| #266 | 2026-05-07 | feat(crs): cap CRS at L1 (45) when licensure cannot be sourced (W1.1) |
| #267 | 2026-05-07 | feat(readiness): propagate CRS licensure cap to backend + web rim layers (W1.1b) |
| #269 | 2026-05-07 | feat(vds): Confidence Doctrine v2 — categorical primitives + doctrine module (Wave 41) |
| #272 | 2026-05-07 | feat(oig): restore three-way confidence semantics — no_match / possible_match / exact (W1.2) |
| #276 | 2026-05-07 | feat(employer): ROI Console v2 — per-pilot value dashboard at /employer/roi (Wave 44) |
| #277 | 2026-05-07 | docs(ops): current-state map + open-PR triage + launch blockers (2026-05-07) |
| #278 | 2026-05-07 | truth(copy): restore semantic qualifiers on bare "Verified" labels (Wave Truth-1) |
| #280 | 2026-05-08 | feat(rbac): RBAC foundation primitives — verifier roles + middleware Step-0 (W2-PR1) |
| #281 | 2026-05-08 | fix(rbac): fail-closed enforcement on /api/verifier/* under degraded auth (W2-PR1A) |
| #282 | 2026-05-09 | feat(governance): operationalize constitutional governance (W2-PR17A through W2-PR22A) |
| #283 | 2026-05-09 | feat(apply): operational workflow composer + replay-safe verifier requests — W2-PR46A |
| #284 | 2026-05-09 | feat(lifecycle): credential artifact lifecycle management — W2-PR44A |
| #285 | 2026-05-10 | feat(human-ai-integrity): lineage + boundaries + bias detector — W2-PR57A |
| #286 | 2026-05-10 | feat(deployment-templates): institutional deployment blueprints (W2-PR80A) |
| #287 | 2026-05-10 | feat(economic-trust): evidence-derived ROI + ops-savings modeling (W2-PR60A) |
| #288 | 2026-05-10 | test(governance): W2-PR133A — final replay integrity verification suite + CI gate |
| #289 | 2026-05-10 | feat(simplicity): institutional simplicity compression layer — W2-PR127A |
| #290 | 2026-05-10 | feat(acceptance): institutional production acceptance layer — W2-PR134A |
| #291 | 2026-05-10 | feat(ecosystem-readiness): institutional ecosystem readiness activation — W2-PR140A |
| #292 | 2026-05-10 | feat(audit): SAFE Audit Convergence Layer — W2-PR124A |
| #293 | 2026-05-10 | test(governance): W2-PR143A — constitutional runtime freeze verification suite + CI gate |
| #294 | 2026-05-10 | feat(activation): institutional activation readiness verification — W2-PR144A |
| #295 | 2026-05-11 | test(governance): constitutional runtime activation audit — W2-PR153A |
| #296 | 2026-05-11 | feat(governance): institutional governance stewardship protocol — W2-PR154A |
| #297 | 2026-05-11 | feat(covenant): institutional runtime covenant finalization — W2-PR157A |
| #298 | 2026-05-11 | test(governance): W2-PR159A ecosystem activation finalization (38 tests) |
| #299 | 2026-05-11 | test(governance): W2-PR162A constitutional institutional runtime activation (54 tests) |
| #300 | 2026-05-11 | feat(governance): institutional runtime production seal — W2-PR170A (77 tests) |
| #301 | 2026-05-11 | test(governance): W2-PR166A institutional runtime ignition validation (57 tests) |
| #302 | 2026-05-11 | test(governance): W2-PR169A institutional runtime activation runbook (44 tests) |
| #303 | 2026-05-11 | test(governance): W2-PR172A constitutional runtime operational activation |
| #304 | 2026-05-11 | feat(hero): W3-PR176A institutional hero surface rewrite |
| #305 | 2026-05-11 | feat(wallet): W3-PR200A wallet activation reality pass |
| #306 | 2026-05-11 | docs(ops): W3-PR209A passport runtime walkthrough audit + lockdown |
| #307 | 2026-05-11 | feat(dashboard): W4-PR216A real dashboard hydration status |
| #308 | 2026-05-11 | feat(web-v2): scaffold sandbox Next 15 app at apps/web-v2 |
| #309 | 2026-05-11 | feat(proof): W4-PR248A surface proofManifest in the runtime |
| #310 | 2026-05-11 | feat(web-v2): W5-PR256A real Clerk sign-in for web-v2 sandbox |
| #311 | 2026-05-11 | docs(ops): AUTH-1 PR271A consolidated clinician activation flow audit |
| #312 | 2026-05-11 | feat(passport): W3-PR210A embed replayLineage on PassportData |
| #313 | 2026-05-11 | feat(backend): W3-PR212A replay-lineage primitive on apps/api/backend |
| #314 | 2026-05-11 | docs(ops): PROD-2 PR304A canonical Clerk + Google OAuth runbook |
| #315 | 2026-05-11 | docs(ops): CRYPTO-1 consolidated crypto stack audit |
| #316 | 2026-05-11 | feat(web-v2): OID4VP-1 PR324A fail-closed JWKS endpoint |
| #317 | 2026-05-11 | docs(ops): ENTERPRISE-1 credential status stack audit |
| #318 | 2026-05-11 | feat(export): ENTERPRISE-1 PR339A signed export envelope primitive |
| #319 | 2026-05-11 | feat(backend): DURABILITY-1 PR345A durable schema additions |
| #320 | 2026-05-11 | feat(ops): pg_dump + pg_restore scripts for VitalCV database |
| #321 | 2026-05-11 | docs(ops): verifier integration quickstart + accuracy lockdown |
| #322 | 2026-05-11 | feat(web-v2): ACTIVATE-1 PR379A security headers for the sandbox |
| #323 | 2026-05-11 | feat(web-v2): institutional Trust State Console + Replay Timeline + design tokens |
| #324 | 2026-05-11 | feat(passport): W4-PR249A wire ProofManifestPanel into /passport/[id] |
| #325 | 2026-05-11 | feat(web-v2): TruthBoundary — single institutional truth surface |
| #326 | 2026-05-11 | feat(ops): ES256 signing keypair generator with safety contract |
| #327 | 2026-05-11 | feat(ops): GO-LIVE-1 PR416A status health route + pilot go-live checklist |
| #328 | 2026-05-11 | feat(pilot): onboarding readiness checker + first-walkthrough doc |
| #329 | 2026-05-11 | feat(ops): apps/web/.env.example operator template + .gitignore exception |
| #330 | 2026-05-11 | feat(backend): W3-PR213A passport lineage bridge primitive |
| #331 | 2026-05-12 | feat(onboarding): wire /get-ready — first clinician NPI binding |
| #332 | 2026-05-12 | feat(api): HARDEN-PILOT-EVENTS-401 reject anonymous pilot event writes |
| #333 | 2026-05-12 | feat(api): structured CORS rejection body + ReplayActorState formalization |
| #334 | 2026-05-12 | feat(ops): production-activation audit surface (/api/health expansion + build-time env verifier) |
| #335 | 2026-05-12 | feat(web-v2): DegradedState typed union + visually distinct renderer (5 failure modes) |
| #336 | 2026-05-12 | feat(replay): recent-NPI history primitive + ReplayStatusChip |
| #337 | 2026-05-12 | feat(runtime): formalize 4-value runtime channel taxonomy |
| #338 | 2026-05-12 | docs(ops): formalize production promotion protocol with lockdown test |
| #339 | 2026-05-12 | feat(readiness): canonical trust-readiness boundary (P0-P2 convergence) |
| #340 | 2026-05-12 | fix(web): point passport proxy at entity-shape backend route |
| #341 | 2026-05-12 | feat(trust): canonical institutional trust primitives (Lane B) |
| #342 | 2026-05-12 | feat(trust): adopt canonical primitives across 5 trust surfaces (Wave 2) |
| #343 | 2026-05-12 | feat(replay): canonical deterministic replay identity (Wave 10) |
| #344 | 2026-05-12 | test(replay): audit survivability simulation suite (Wave 14) |
| #345 | 2026-05-12 | feat(verify): /verify trust inspection surface (Wave 9 partial) |
| #346 | 2026-05-12 | test(issuer): source-scan purity guards for receiptCandidate + policyReview |
| #347 | 2026-05-12 | security: eliminate anonymous write contamination in pilot events and apply tracking |
| #348 | 2026-05-12 | security: actor-attribution on audit-chain writes (Cluster 1) |
| #349 | 2026-05-12 | feat(verifier): well-known discovery surfaces + signed VC 2.0 receipt endpoint |
| #350 | 2026-05-12 | feat(trust): recent-NPI replay-memory rendering on passport surface |
| #351 | 2026-05-12 | feat(replay): operational integrity scripts (verify, find-gaps, reconcile) |
| #352 | 2026-05-12 | feat(trust): replay-integrity panel — script logic on the operator surface |
| #353 | 2026-05-13 | docs(contracts): formalize replay-identity contract v1 |
| #354 | 2026-05-13 | feat(replay): cross-surface convergence verifier (operational tool) |
| #355 | 2026-05-13 | feat(verifier): completion surfaces — openid-configuration, /trust, receipt-by-lineage |
| #356 | 2026-05-13 | docs(merge): Tier-1 merge readiness audit (17 PRs, #338-#355) |
| #357 | 2026-05-13 | docs(deploy): build artifacts + apex forensics + route ownership map |
| #358 | 2026-05-13 | docs(verifier): canonical trust route map |
| #360 | 2026-05-13 | fix(verifier): close two truth-contract gaps — typo'd issuer env + /trust allowlist |
| #361 | 2026-05-13 | feat(replay): PR-α — minimum durable replay-run + replay-event persistence |
| #363 | 2026-05-15 | fix(infrastructure-truth): retract vcv-web canonical claim + B18 production restore sequence |
| #364 | 2026-05-16 | docs(launch): final launch-readiness synthesis — 5-day public-launch path |
| #365 | 2026-05-16 | fix(launch): Day 1 hygiene — fallback handling, broken-link audit, signup CTA |
| #366 | 2026-05-16 | feat(survival): /launch + /demo flows + local-host + recruiter homepage CTA |
| #367 | 2026-05-17 | feat(demo): add OpenEvidence market-pain demo spine and ROI calculator |
| #368 | 2026-05-17 | feat(demo): ship OpenEvidence-backed launch/demo spine and ROI calculator |
| #369 | 2026-05-17 | feat(leads): persist pilot and walkthrough requests from launch demo |
| #370 | 2026-05-17 | ci(copy): block banned truth-contract phrases in public surfaces |
| #371 | 2026-05-17 | feat(review): show audit event id after employer acceptance |
| #372 | 2026-05-17 | feat(ops): add source-health remediation hints for gated and degraded lanes |
| #373 | 2026-05-17 | fix(profile): make clinician profile preview state explicit |
| #374 | 2026-05-17 | docs(demo): add founder smoke checklist for pilot walkthrough |
| #375 | 2026-05-17 | fix(wallet-sdk): restore interoperability export for monorepo build |
| #376 | 2026-05-18 | docs(ops): Vercel exit emergency plan + Cloudflare tunnel runbook |
| #377 | 2026-05-18 | ops(demo): add local Cloudflare demo operator |
| #378 | 2026-05-19 | feat(trust): add Claude Design trust surfaces canon |
| #379 | 2026-05-19 | docs: map existing codebase (.planning/codebase/) |
| #380 | 2026-05-19 | fix(audit): repair replay engine merge regression |
| #381 | 2026-05-19 | fix(prisma): normalize backend namespace contracts |
| #382 | 2026-05-19 | feat(trust): canonicalize institutional trust primitives |
| #383 | 2026-05-19 | feat(trust): integrate institutional trust systems |
| #384 | 2026-05-19 | fix(discovery): resolve .well-known issuer host per-request (WAVE C60) |
| #385 | 2026-05-19 | feat(trust): implement matuschak-style stacked provenance panes |
| #386 | 2026-05-19 | feat(trust): canonicalize provenance navigation |
| #387 | 2026-05-19 | feat(pilot): implement Pilot Deployment Kit route |
| #388 | 2026-05-19 | feat(core): implement unauthenticated NPI hook and dynamic ROI calculator (C65 + C66) |
| #389 | 2026-05-19 | feat(core): implement OpenEvidence risk engine and lineage graph API (C69 + C72) |
| #390 | 2026-05-20 | feat(core): enforce antigravity routing and durable cryptographic event chain (C73 + C75) |
| #391 | 2026-05-20 | fix(trust): enforce truth-constrained operational semantics |
| #392 | 2026-05-20 | feat(core): implement live NPPES resolver and OpenMythos compliant endpoints (C77 + C78) |
| #393 | 2026-05-20 | fix(protocol): harden discovery surface integrity |
| #394 | 2026-05-20 | fix(repo): align repository implementation reality |
| #395 | 2026-05-20 | feat(interoperability): implement exchange rehearsal infrastructure |
| #396 | 2026-05-21 | fix(repo): establish stacked infrastructure governance |
| #397 | 2026-05-21 | fix(repo): operational compression and merge convergence |
| #398 | 2026-05-21 | fix(repo): restore CI convergence and unlock stack |
| #399 | 2026-05-21 | fix(repo): establish merge orchestration and release discipline |
| #400 | 2026-05-21 | feat(demo): compress institutional pilot narrative |
| #401 | 2026-05-21 | feat(intake): establish institutional intake momentum |
| #402 | 2026-05-21 | feat(demo): implement operational waste visibility (/demo/waste) |
| #403 | 2026-05-21 | feat(ui): establish operational signal hierarchy on /ops + /holder |
| #404 | 2026-05-21 | feat(flow): complete institutional continuity paths |
| #405 | 2026-05-21 | fix(repo): synchronize conceptual and materialized reality |
| #406 | 2026-05-21 | fix(repo): enforce materialized operational reality |
| #407 | 2026-05-21 | feat(product): establish pilot operator readiness (/operator) |
| #408 | 2026-05-21 | fix(product): converge operational continuity systems |
| #409 | 2026-05-21 | fix(product): enforce canonical live product flow |
| #410 | 2026-05-21 | fix(product): eliminate fake and unsafe institutional surfaces |
| #439 | 2026-05-30 | docs(ops): triage PR431 visual-system port |
| #440 | 2026-05-30 | docs(ops): document Clerk auth gate diagnostics |
| #441 | 2026-05-30 | docs(ops): inventory trust persistence gaps |
| #442 | 2026-05-30 | docs(gtm): outline PSV readiness pilot packet |

## Appendix — execution (NOT run as part of this PR)

Close Tier S with a receipt, in batches, after founder sign-off on this doc:

```bash
# Tier S closure — run from a seat with repo triage rights
for n in $(gh pr list --state open --limit 300 --json number,createdAt \
  --jq '.[] | select(.createdAt < "2026-06-01") | .number'); do
  gh pr close "$n" --comment "Closing as superseded per docs/ops/open-pr-disposition-2026-08-02.md (Tier S: pre-2026-06 tree, doctrine and main have moved past it). Still-wanted intent should be re-cut small from current main."
done
```

Tier R executes PR-by-PR per its table row (dependabot rebase+merge singly;
closures individually with their specific rationale as the comment).

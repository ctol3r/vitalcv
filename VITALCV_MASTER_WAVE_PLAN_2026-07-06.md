# VitalCV Master Wave Plan — Path to 100% Complete, Enterprise-Ready
> **Generated:** 2026-07-06 by Claude Cowork (Master Operator context)
> **Sources:** Full repo scan of `~/vitalcv` (branch `wave/career-evidence-network-alignment`, HEAD 2026-07-06), git history, prisma schema, CI workflows, all root audits/blocker matrices, docs/specs, home-dir consolidation audit.
> **Doctrine authority:** MASTER_PROMPT (2026-06-19 Career Evidence Network revision), Canonical Path (Recognition → Acceptance → Start), Antigravity Contract, copy/compliance prohibitions.
> **Scope:** Every wave of task bundles required to take VitalCV from current state to a 100%-complete, enterprise-sellable Provider Career Evidence Network.

---

## Part 1 — Verified Current State (2026-07-06)

Facts verified against code this session, not from stale docs:

| Area | Verified State |
|---|---|
| Active branch | `wave/career-evidence-network-alignment` — clean, commits daily through **today** |
| Recent work | MATCHA stream: Calm Wave D56 redesign (public homepage, buyer pages, signed-in surfaces), Career Constellation, daily brief + streak loop, source-refresh events, employer discoverability, `/matcha/experience` preview |
| Wave 17 copy blockers (W17-1…7) | **RESOLVED in code** — Hero.tsx / HomeSections.tsx contain no "zero-trust ledger", "hire instantly", SOC 2/NCQA badges, or "graph/ledger" copy |
| Wave 180 models | `PersonProfile`, `OrganizationProfile`, `WorkspaceMembership` **present in schema.prisma** with full fields/FKs/indexes |
| Apps | web, api, issuer-api, verifier-api, admin-api, marketing, authz, status-api built; **mobile = Expo skeleton** (app/, src/, vitest config — not GA); router/sample-api/docs stubs |
| Packages | ~34 declared; ~20 substantive; vitalindex, claims, rate-limiter are thin/compile-only |
| Tests | 555 `*.test/spec.ts(x)` files tracked (coverage uneven across packages) |
| CI | 20 GitHub Actions workflows incl. ci.yml, a11y-gate, api-hardening-gate, openid-conformance, deploy-api, source-health-probe, trust-benchmark-gate |
| Migrations | Latest Prisma migrations dated 2026-05-13; **two manual SQL files sitting unapplied** (`manual_start_activation_graph.sql`, `manual_start_activation_sidecar.sql`) |
| Secrets hygiene | `apps/api/backend/.env.production` **tracked in git** (appears empty — still must be removed) |
| Documentation | **52-day doc gap**: last status/strategy snapshots dated 2026-05-15; MATCHA waves (through D56) largely undocumented |
| GTM | As of last recorded snapshot (2026-05-15): 0 outreach sent, 0 signups, 0 pilots; live demo depends on 1 NPI (1457128589) |
| Enterprise posture | SSO stubbed, mutation-level audit coverage incomplete, no encryption-at-rest attestation, no BAA/compliance packet, tenant scoping not enforced on all queries, no cross-tenant deny matrix test suite |
| Sibling repos | 15+ `vitalcv-*` sibling repos in `~` plus 35 stale worktrees — consolidation incomplete (see VITALCV-CONSOLIDATION-AUDIT-2026-04-20.md) |

**Bottom line:** The wedge product (NPI → Readiness → Passport → Employer Review → Accept) is architecturally real and the copy discipline is now enforced in code. The distance to "100% complete + enterprise ready" is concentrated in five areas: (1) truth/state hygiene, (2) trust-core hardening & test proof, (3) enterprise security/compliance, (4) source coverage expansion, and (5) revenue/pilot execution.

---

## Part 2 — Master Wave Sequence

Waves are numbered **M0–M12**. Each wave lists: objective, task bundle (ID / task / files / acceptance criteria / effort S-M-L / priority), and exit gate. Waves M0–M4 are strictly sequential; M5+ can partially parallelize (noted per wave). Legacy wave IDs (16/17/180/245/D56/Wallet) are mapped where relevant.

Execution pattern per doctrine: `vitalcvdesign-proposal → vitalcvtask-bundler → Claude Code implementation → vitalcvlaunch-readiness validation`. Every mutating route change must preserve the audit-first contract. No `prisma migrate` without explicit founder approval — SQL plans to `docs/migrations/` first.

---

### WAVE M0 — Truth Reconciliation & Repo Hygiene
**Objective:** Eliminate the 52-day documentation gap and repo entropy so every later wave plans against reality. Nothing else proceeds until the state of record matches the state of code.

| ID | Task | Files / Surface | Acceptance Criteria | Effort | Pri |
|---|---|---|---|---|---|
| M0-1 | Regenerate authoritative current-state snapshot (run `vitalcvcurrent-state` skill against HEAD) covering all MATCHA waves through D56, Career Constellation, daily brief, employer discoverability | New `CURRENT_STATE_2026-07.md`; supersedes all FINAL_*_AUDIT docs | Doc lists per-app/per-package status, feature-flag truth table, deployed-vs-local delta; dated; linked from MASTER_PROMPT | M | P0 |
| M0-2 | Archive or explicitly mark-superseded the ~60 stale root-level audit docs (FINAL_*, INSTITUTIONAL_*, LIVE_*) into `docs/archive/2026-H1/` with an index | Repo root `*.md` | Root contains ≤15 living docs; archive index maps old→new authority | S | P0 |
| M0-3 | Remove `apps/api/backend/.env.production` from git tracking; add `.env*` (except `.env.example`) to .gitignore; run gitleaks/trufflehog full-history scan; rotate anything found | `.gitignore`, git history | `git ls-files | grep .env` returns only examples; secret scan report committed to `docs/security/`; rotations logged | S | **P0** |
| M0-4 | Worktree + branch triage: delete the 35 stale worktrees, enumerate the 50+ feature branches, tag merge/kill decision on each | git | `git worktree list` shows only active; branch inventory doc with disposition per branch | S | P1 |
| M0-5 | Sibling-repo consolidation decision pass: for each `~/vitalcv-*` repo (decision-engine, control-plane, backend, consolidation-2, etc.) mark ABSORBED / ARCHIVED / ACTIVE with rationale; extract anything unique into monorepo | `VITALCV-CONSOLIDATION-AUDIT` follow-up | Zero ambiguity about where canonical code lives; archived repos README-stamped | M | P1 |
| M0-6 | Resolve the two manual SQL files: write proper migration plans to `docs/migrations/` for `manual_start_activation_graph.sql` + `manual_start_activation_sidecar.sql`; get founder approval; apply or delete | `apps/api/backend/prisma/` | No orphan SQL in migrations dir; schema.prisma == deployed DB (verified via `prisma migrate status`) | S | P0 |
| M0-7 | Deployment truth check: confirm Railway API reachable externally, Vercel env vars complete (the 5+ missing vars flagged 2026-05), Clerk JWT template verified on dashboard; record in snapshot | Railway/Vercel/Clerk dashboards | `curl` proof of prod API health endpoint; env-var checklist all green; documented in M0-1 doc | S | **P0** |

**Exit gate:** Current-state doc merged; secrets clean; deployed environment verified; single source of code truth.

---

### WAVE M1 — Canonical Path Proof & Trust-Core Hardening
**Objective:** The frozen doctrine (Recognition → Acceptance → Start, fail-closed, revocation-first, audit-first) must be *provably* enforced, not just architecturally intended. This is the trust product's load-bearing wall — and the substance behind every enterprise security questionnaire answer.

| ID | Task | Files / Surface | Acceptance Criteria | Effort | Pri |
|---|---|---|---|---|---|
| M1-1 | Canonical-path integration test suite: end-to-end tests asserting (a) Recognition requires ≥1 valid PSV receipt, (b) Acceptance requires valid Recognition, (c) Start requires Acceptance + readiness threshold, (d) expired/disputed/revoked receipt fails closed, (e) revocation overrides all prior positive state | `packages/domain-common/employmentGuards.ts`, new `tests/canonical-path/` | ≥25 test cases; wired into ci.yml as required check `canonical-path-gate` | M | **P0** |
| M1-2 | Audit-write coverage audit + enforcement: enumerate every mutating route in `apps/api/backend/src/routes/`; verify each writes AuditEvent **before** 2xx; add lint rule or middleware assertion that rejects un-audited mutations | `employerActions.ts`, all route files, audit middleware | Coverage table in `docs/security/audit-coverage.md`; automated test that hits every POST/PUT/PATCH/DELETE and asserts AuditEvent row; CI gate | M | **P0** |
| M1-3 | CRS/readiness determinism proof: property-based tests for readinessEngine — same canonical inputs ⇒ same score; no hidden state; blocker explanations present for every sub-80 dimension | `readinessEngine.ts`, `packages/crs` | Snapshot test corpus of ≥50 synthetic clinician states; explainability payload validated against schema | M | P0 |
| M1-4 | Revocation-first validity sweep: verify every surface (passport, share page, employer packet, verifier API) re-checks receipt freshness/revocation at read time, never serves cached "valid" | `passportService.ts`, `TrustStateResolver.ts`, verifier-api | Test: revoke a receipt → all 4 surfaces flip within one request cycle; stale receipt renders `stale` coverage state, never `checked` | M | P0 |
| M1-5 | Source coverage state honesty audit: assert the 9 canonical states (`checked/stale/pending/gated/unavailable/accessRequired/reviewRequired/notDecisionGrade/previewOnly`) render distinctly in UI; no gated source ever renders as checked | `packages/trust-state/sourceCoverage.ts`, web components | Storybook/visual test per state; grep-based CI copy gate blocking "verified" claims on non-checked states | S | P0 |
| M1-6 | Formalize source feature flags: move OIG_LEIE / PECOS / STATE_BOARD / FSMB gating from hardcoded/source-registry into env schema alongside REAL_NURSYS_ENABLED; flags default safe (off ⇒ `gated`) | `env.ts`, sourceCatalog.ts | Flag truth table doc; flipping any flag off degrades to honest coverage state with zero code change | S | P1 |
| M1-7 | Idempotency on mutating endpoints: idempotency keys on `accept`, `request-refresh`, `route-to-review`; duplicate accept cannot create duplicate EmployerAcceptance | `employerActions.ts` | Replay test: same request twice ⇒ one acceptance, one audit event + one idempotent-replay audit note | S | P1 |
| M1-8 | Copy-compliance CI gate (make W17 unregressable): automated scan for the full banned-phrase list (hire instantly, blockchain-anchored, zero-knowledge, ledger, HIPAA certified, SOC 2 certified, NPDB, all 50 states, guaranteed verification…) across web + marketing apps | new `scripts/copy-audit.ts`, CI | Gate fails PR on any banned phrase; allowlist file for legitimate technical-doc usage | S | P0 |

**Exit gate:** `canonical-path-gate`, `audit-coverage-gate`, and `copy-compliance-gate` all green in CI; trust-core claims are test-backed.

---

### WAVE M2 — Marketing↔Web Seam & Single Funnel (legacy P0)
**Objective:** One coherent public funnel. The historical P0 (marketing app NPI entry routing to dead `/clinician`; two visual systems) must be conclusively closed, not just improved by D56.

| ID | Task | Files / Surface | Acceptance Criteria | Effort | Pri |
|---|---|---|---|---|---|
| M2-1 | Verify/close the dead-route seam: every CTA in `apps/marketing` resolves to a live `apps/web` destination; kill or redirect `/clinician` | apps/marketing routes | Link-crawler CI job over marketing build: zero 404/dead CTAs | S | **P0** |
| M2-2 | Decide marketing-app fate: absorb into `apps/web` (route group) or keep separate with shared `vt-*` token package; implement decision | apps/marketing, packages | One font stack, one token system, one NPI entry flow across public surfaces | M | P1 |
| M2-3 | Demo-metrics honesty: remove or label "illustrative" every hardcoded metric on `/partners`, `/investors` (12,847 credentials / 284 verifiers class of numbers) | partners/investors pages | Grep gate for hardcoded metric literals; all displayed metrics either live-queried or labeled | S | P0 |
| M2-4 | Un-gate the employer demo walkthrough: `/review/request` reachable for unauthenticated employers via sandboxed demo entity (clearly watermarked DEMO, no real PHI/PII) | review routes, demo tenancy | Cold visitor completes NPI → passport → review → accept-as-head-start in <60s with zero login; demo data watermarked | M | P0 |
| M2-5 | Demo data depth: seed ≥25 diverse demo NPIs (multiple specialties, one with OIG exclusion, one stale license, one gated-source case) replacing single-NPI dependency | seed scripts | Demo never depends on one live NPI; failure cases demonstrable to buyers | S | P0 |
| M2-6 | Align all public copy to Career Evidence Network doctrine (2026-06-19): hero = "Stop starting over. Start ready." direction; clinician/employer/ecosystem value lines per Copy System §19; wallet/passport/packet naming per canonical table | Hero, HomeSections, buyer pages | Copy review against MASTER_PROMPT §19; no legacy "Provider Identity Graph infrastructure" headline on public surfaces | S | P1 |

**Exit gate:** A stranger can travel the full wedge unassisted; nothing on a public surface is dead, fake, or off-doctrine.

---

### WAVE M3 — Enterprise Security Baseline
**Objective:** Close every gap that fails a hospital/payer security questionnaire on page one. (Parallelizable with M2 after M1 completes.)

| ID | Task | Files / Surface | Acceptance Criteria | Effort | Pri |
|---|---|---|---|---|---|
| M3-1 | AuthN coverage sweep: every non-public API route behind Clerk auth middleware; explicit public-route allowlist; JWT audience/issuer validation asserted in tests | apps/api middleware | Route inventory: authed / public-by-design / fixed; test hitting each route unauthenticated expects 401 | M | **P0** |
| M3-2 | RBAC: define roles (clinician, employer-reviewer, employer-admin, org-owner, vitalcv-operator, auditor); enforce per-route permission checks; leverage `apps/authz` or consolidate it into api | apps/authz, route guards | Permission matrix doc; tests per role×route; least-privilege default deny | L | **P0** |
| M3-3 | Tenant isolation enforcement: every Prisma query on org-owned models scoped by organizationId via query extension/middleware (not per-callsite discipline); build the cross-tenant deny/allow test matrix (doctrine requires 30-day stability before multi-tenant expansion) | prisma client wrapper, all services | Automated matrix: for each org-scoped model, cross-tenant read/write attempt ⇒ denied; runs nightly; zero exceptions 30 consecutive days | L | **P0** |
| M3-4 | Wire `packages/rate-limiter` for real: per-IP + per-org limits on ingest, share pages, employer actions; 429 with retry-after | rate-limiter, api entry | Load test proves limits enforced; limits configurable via env | S | P1 |
| M3-5 | Input validation everywhere: zod schemas on all route inputs (NPI format, entityIds, pagination); reject unknown fields | route handlers | Fuzz test suite passes; no unvalidated `req.body` access (lint rule) | M | P1 |
| M3-6 | HTTP hardening: helmet, strict CORS allowlist, CSP on web + marketing, HSTS, secure cookies | apps/api, apps/web config | securityheaders.com grade A on prod domains; CSP report-only → enforce | S | P1 |
| M3-7 | Secrets management: all runtime secrets in Railway/Vercel secret stores; document rotation runbook; quarterly rotation calendar | infra config, `docs/security/` | No plaintext secrets anywhere in repo/CI logs; rotation runbook tested once | S | P0 |
| M3-8 | Dependency + container security: enable Dependabot/renovate, `pnpm audit` CI gate, pin base images; SBOM generation | .github, docker | CI fails on high/critical vulns; SBOM artifact per release | S | P2 |
| M3-9 | Enterprise SSO: real SAML/OIDC for employer orgs via Clerk enterprise connections (replace stubbed WebAuthn bridge dummy values); SCIM deferred to M8 | auth config, stub removal | Test IdP (Okta dev) round-trip login into employer workspace; stub code deleted | M | P1 |
| M3-10 | Session & access policies: configurable session TTL, MFA enforcement option per org, admin-forced logout | Clerk config, org settings | Org admin can require MFA; verified in test org | S | P2 |

**Exit gate:** Pass an honest self-assessment against a standard vendor security questionnaire (CAIQ-lite) with no red answers; deny-matrix running nightly.

---

### WAVE M4 — Compliance Program (HIPAA-alignment → SOC 2 → NCQA mapping)
**Objective:** Convert "compliance-ready by design" from claim to evidence packet. Never claim certification before it exists.

| ID | Task | Files / Surface | Acceptance Criteria | Effort | Pri |
|---|---|---|---|---|---|
| M4-1 | Data classification & flow map: document every field of PII/PHI-adjacent data, where it lives (Postgres, logs, receipts, on-chain hashes), and confirm **zero PHI on-chain** with an automated check on anchoring payloads | `docs/compliance/data-map.md`, poe-engine | Anchoring code has schema-level guard rejecting non-hash payloads; test proves it | M | **P0** |
| M4-2 | Encryption posture: verify/enable encryption at rest (Railway Postgres), TLS everywhere, field-level encryption for sensitive receipt payloads if needed; document | infra, docs/compliance | Written attestation with provider evidence; key management described | S | P0 |
| M4-3 | HIPAA-alignment packet: administrative/technical/physical safeguards mapping, access-control policy, audit-trail policy (built on M1-2), incident response plan, workforce policy; BAA template reviewed by counsel | `docs/compliance/hipaa/` | Complete packet a buyer's compliance team can review; language stays "HIPAA-aligned" | M | **P0** |
| M4-4 | Access logging & review: log all operator/admin access to clinician data; quarterly access-review procedure | admin-api, audit package | Access log queryable; first review executed and recorded | S | P1 |
| M4-5 | Data-subject rights: clinician data export (full evidence bundle) + deletion workflow honoring append-only audit constraints (tombstone pattern); retention schedule | api routes, docs | Export returns complete owned data; deletion request runbook tested end-to-end | M | P1 |
| M4-6 | SOC 2 Type I program start: select auditor, stand up policy set (security, availability, confidentiality), evidence-collection tooling (Vanta/Drata-class), scope = wedge product | vendor + `docs/compliance/soc2/` | Gap assessment complete; policies adopted; evidence collection live; Type I audit scheduled | L | P1 |
| M4-7 | NCQA CR1–CR5 mapping doc: map PSV receipts, ongoing monitoring, and audit trail to each credentialing standard; identify deltas for future certification (do **not** claim certification) | `docs/compliance/ncqa-mapping.md` | Buyer-facing mapping doc reviewed against actual implemented behavior only | M | P2 |
| M4-8 | Compliance copy audit hook: extend M1-8 gate with compliance-claims list; marketing/legal sign-off workflow for new claims | CI + process doc | No compliance claim ships without evidence link | S | P1 |

**Exit gate:** HIPAA-alignment packet + security whitepaper shippable to an enterprise buyer; SOC 2 Type I underway (not claimed).

---

### WAVE M5 — Observability, Reliability & Ops Maturity
**Objective:** Run the platform like infrastructure: measurable, alertable, recoverable. (Parallel with M4.)

| ID | Task | Files / Surface | Acceptance Criteria | Effort | Pri |
|---|---|---|---|---|---|
| M5-1 | Error tracking: Sentry (or equiv.) on web, marketing, api, verifier-api with release tagging + source maps; PII scrubbing in beforeSend | all apps | Errors visible per release; zero PII in events (test with synthetic PII) | S | P0 |
| M5-2 | Structured logging: pino JSON logs with request IDs propagated api→services; log levels env-controlled; no secrets/PHI in logs (redaction test) | apps/api, packages/tracing | Trace a request across services by ID in prod logs | M | P1 |
| M5-3 | Health & status: deep health endpoints (DB, source adapters, queue) feeding `apps/status-api`; public status page with per-source freshness (extends 4-level HEALTHY→CRITICAL spine) | status-api, sourceOpsService | Status page live; GATED/DEGRADED/STALE alerts fire to founder channel (closes legacy W16-3) | M | P1 |
| M5-4 | Source ops polish (legacy Wave 16 remainder): operator remediation hints in SourceHealthPanel + PilotDiagnosticsPanel (W16-1), absolute ISO timestamps on hover (W16-2), panel polling (W16-4) | `apps/web/components/pilot-ops/SourceHealthPanel.tsx`, `apps/web/components/pilot-ops/PilotDiagnosticsPanel.tsx` | All four W16 items verifiably closed in UI | S | P1 |
| M5-5 | Ingestion resilience: queue + retry with backoff for source checks; circuit breaker per adapter; dead-letter review surface in admin | packages/ingest, admin-api | Kill a source in staging → system degrades to honest coverage state, recovers automatically, operator notified | M | P1 |
| M5-6 | Backups & DR: automated Postgres backups verified restorable; documented RPO/RTO; quarterly restore drill | infra, `docs/ops/dr-runbook.md` | One successful timed restore drill recorded | S | **P0** |
| M5-7 | Uptime SLO + alerting: external synthetic checks on the wedge path (NPI ingest → passport render → packet fetch); paging thresholds | monitoring config | Synthetic wedge check every 5 min; alert on 2 consecutive failures | S | P1 |
| M5-8 | Runbook consolidation: incident response, deploy/rollback, source-outage, on-call-of-one founder playbook; prune the 20 CI workflows to a maintained, documented set | `docs/ops/`, .github/workflows | Each surviving workflow documented with owner + purpose; incident runbook drilled once | M | P2 |
| M5-9 | Load & performance baseline: k6 (or artillery) profile of ingest + passport + review endpoints; P95 targets recorded; index/query fixes for anything over target | perf scripts, docs | P95 < 500ms passport read, < 5s full NPI ingest at 25 concurrent; results in docs | M | P2 |

**Exit gate:** A source outage, bad deploy, or DB loss is a runbook event, not an existential event.

---

### WAVE M6 — Employer Enterprise Surface & Workspace Graph (completes legacy Wave 180)
**Objective:** Make the buyer side genuinely multi-user, multi-org, enterprise-operable.

| ID | Task | Files / Surface | Acceptance Criteria | Effort | Pri |
|---|---|---|---|---|---|
| M6-1 | Finish Wave 180 runtime: workspace service, `/api/me/workspaces`, `/api/workspaces/switch`, `WorkspaceSwitcher` component, `/workspace/switch` page wired to the already-present Prisma models | wave/180 scope | User in 2 orgs switches context; all queries follow active workspace; audit event on switch | M | P0 |
| M6-2 | Employer team management: invite flow, role assignment (from M3-2 RBAC), seat listing, deactivation | web employer settings, api | Org admin invites reviewer; reviewer sees only permitted entities; removal revokes within one session | M | P0 |
| M6-3 | Employer review GA hardening: reviewer queue (list of pending packets), decision history with Decision Capsule replay, refresh-request tracking, reviewer notes | ReviewClient.tsx, employerActions.ts | Reviewer processes 10 packets without leaving surface; every decision replayable from capsule | M | P1 |
| M6-4 | Employer packet export: audit-ready PDF/JSON evidence packet (receipts, coverage states, freshness, trust gradient) suitable for committee hand-off | packet builder | Export contains zero inflated claims; every source shows coverage state + timestamp; PDF renders correctly | M | P1 |
| M6-5 | Notifications: email (transactional provider) for refresh-complete, packet-shared, license-expiring, acceptance-recorded; per-user prefs | new notification service | All four events deliver; unsubscribe honored; no PHI in email bodies | M | P1 |
| M6-6 | Admin operator console: make `apps/admin-api` + surface real — org management, source health, audit search, feature-flag view, impersonation with audit trail | admin-api, admin UI | Operator can answer "what happened to entity X" in <2 min without DB access | L | P1 |
| M6-7 | Billing & entitlements: Stripe integration per pricing doctrine (base platform access per verifier org + usage tiers by verified artifacts); entitlement checks on org creation/seats/packet volume; invoicing | new billing module, docs/specs/vitalcv-pricing-doctrine.md | Test org: subscribe → entitlements enforce → invoice generates; dunning path defined | L | P1 |
| M6-8 | Partner SDK/embed GA: version + document `packages/sdk` and `packages/embed-sdk`; API keys with org scoping + rate limits; quickstart using `examples/ats-integration-nextjs` | sdk, embed-sdk, api-keys | External dev integrates "readiness badge" embed in <1 hr using docs alone; keys revocable | M | P2 |

**Exit gate:** An enterprise employer org can self-serve: join, manage a team, review at volume, export evidence, get billed — with operator support tooling behind it.

---

### WAVE M7 — Source Coverage Expansion (evidence gravity)
**Objective:** Widen decision-grade coverage without ever inflating claims. Every source ships behind a flag, degrades honestly, and updates the trust registry page.

| ID | Task | Files / Surface | Acceptance Criteria | Effort | Pri |
|---|---|---|---|---|---|
| M7-1 | State-board lane #2–#5: build adapters for 4 more high-volume physician states beyond the launch lane (candidate order by pilot demand); each with freshness SLA + STALE handling | packages/psv-adapters, sourceCatalog | Each lane: adapter tests with recorded fixtures, coverage state honest when board site changes/breaks | L | P1 |
| M7-2 | Nursys institutional access: complete the institutional agreement workstream; wire real E-Notify behind `REAL_NURSYS_ENABLED`; until live, UI must show `accessRequired` (never a checkmark) | nursys adapter, flags | Flag off ⇒ gated UI; flag on ⇒ live receipts with source timestamps; contract stored in docs/legal | L | P1 |
| M7-3 | FSMB agreement + adapter (same pattern as M7-2) behind `FSMB_ENABLED` | fsmb adapter | Same honesty criteria as M7-2 | L | P2 |
| M7-4 | PECOS refresh automation: quarterly snapshot auto-ingest with staleness countdown displayed; alert when snapshot age > SLA | pecos adapter, sourceOps | Snapshot age visible on trust registry; alert fires at threshold | S | P2 |
| M7-5 | OIG/LEIE continuous monitoring: monthly-delta re-check on all active entities; new exclusion triggers revocation-first flow + employer notification | monitoring service (extends legacy Wave 245 async engine, behind MONITORING_ENABLED) | Synthetic exclusion in staging propagates to passport + notifies within 24h | M | P1 |
| M7-6 | Employment-history evidence (career evidence expansion per 2026-06 doctrine §4): employer-attested work-history claims with issuer signatures; surfaces in wallet + packet as distinct evidence class | domain-common contracts, issuer-api | Attested history renders with issuer provenance; unattested stays self-reported-labeled | L | P2 |
| M7-7 | Academic/research identity lane: OpenAlex/PubMed/ORCID ingestion for research-active clinicians (differentiator per positioning §14) | new adapters | Publications/trials render with source links; opt-in per clinician | M | P3 |
| M7-8 | Trust/source registry page GA: public, per-source coverage/limitations/freshness page — the honesty artifact enterprise buyers check | web trust registry | Page auto-generated from sourceCatalog; never lists a non-live source as integrated | S | P1 |

**Exit gate:** ≥3 decision-grade lanes live for physicians; nursing path credible; all sources honestly represented; NPDB/DEA/ABMS/SAM.gov still **never** claimed.

---

### WAVE M8 — Clinician Wallet & Standards Conformance (legacy Wave Wallet)
**Objective:** Ship the clinician-owned wallet experience and prove standards interop — the portability moat.

| ID | Task | Files / Surface | Acceptance Criteria | Effort | Pri |
|---|---|---|---|---|---|
| M8-1 | Web wallet GA first: complete PassportWallet as the clinician home base (evidence list, readiness, missing-item checklist, share controls, refresh requests) — mobile is not a prerequisite for enterprise | PassportWallet.tsx | Clinician manages full evidence lifecycle from web; Antigravity test passes (appears only at blocked moments) | M | P0 |
| M8-2 | Selective disclosure UX: SD-JWT-backed share links where clinician chooses revealed claims; share-page honors selection | wallet-sdk, share surface | Share with license-only vs full packet; verifier sees only selected claims | M | P1 |
| M8-3 | Mobile wallet build-out on existing Expo skeleton: LocalCredentialStore (SecureStore), OfflinePresentationEngine (VP JWTs offline), OID4VPHandler (QR), expiry NotificationService, WalletSyncService | apps/mobile | TestFlight/internal build; offline presentation demo works airplane-mode; store submission checklist | L | P2 |
| M8-4 | OID4VP/OID4VCI conformance: run the existing `openid-conformance.yml` suite to green against issuer-api + verifier-api; HAIP 1.0 posture checks enforced (no bypass path) | issuer-api, verifier-api, haip-config | Conformance report artifact committed; HAIP bypass attempts fail in tests | M | P1 |
| M8-5 | Revocation registry GA: verifier-checkable status list; wallet + verifier honor it; anchored per poe-engine with zero-PHI guard (M4-1) | poe-engine, verifier-api | Revoke → external verifier sees invalid within SLA; on-chain payload is hash-only (test-proven) | M | P1 |
| M8-6 | Substrate anchoring production decision: either promote `blockchain/substrate` to prod with ops runbook, or formally park it and rely on signed receipts + Merkle proofs (copy already says "cryptographically signed" — both options compliant) | blockchain/, decision doc | Founder-approved ADR; whichever path chosen is fully operational and documented | M | P2 |

**Exit gate:** Clinician can carry, control, and selectively present evidence; interop claims are conformance-tested, not aspirational.

---

### WAVE M9 — First Revenue & Pilot Execution (parallel with M5+; starts immediately per doctrine §16)
**Objective:** Sell the wedge. Manual is allowed. This wave runs continuously alongside engineering waves — it is the demand proof that justifies M6–M8.

| ID | Task | Files / Surface | Acceptance Criteria | Effort | Pri |
|---|---|---|---|---|---|
| M9-1 | Package the 48-hour "Recruiter-Ready Career Packet" concierge offer: landing page, intake form, price, delivery checklist (CV cleanup, NPI/OIG/PECOS/state lookup, readiness notes, missing-evidence list, shareable profile) | offer page + internal SOP | Offer purchasable; first 5 delivered within SLA; delivery SOP documented for later automation | M | **P0** |
| M9-2 | Founder outreach engine: 20 outreach/day cadence (locums firms, staffing vendors, payer credentialing teams per YC wedge); tracked in CRM-lite; weekly metrics review vs FOUNDER_RHYTHM.md | process + tracking sheet | Metrics no longer zero: sends, replies, demos booked logged weekly; 4-week trend visible | M | **P0** |
| M9-3 | Pilot kit: one-pager, pilot agreement template (counsel-reviewed), success-criteria sheet (TTS baseline vs pilot, ISV), security overview (from M3/M4 artifacts), pricing per doctrine | docs/specs pilot docs refresh | Kit sent same-day to any interested buyer; pilot gate criteria from vitalcv-launch-gate.md honored | M | P0 |
| M9-4 | Pilot instrumentation: measure TTS and ISV (28-day rolling median) per pilot org, scoped (org/lane/geography — never aggregate unscoped starts); pilot dashboard for buyer | metrics service | First pilot produces a real before/after TTS number usable in sales material (labeled with scope) | M | P1 |
| M9-5 | Case-study pipeline: template + consent language so pilot #1 converts to public proof; testimonial capture at accept-as-head-start moments | process | First case study drafted within 2 weeks of pilot success criteria met | S | P2 |
| M9-6 | Pricing enforcement: connect M6-7 billing to pilot-to-paid conversion; pilot expiry → paid plan flow | billing | First dollar of self-serve/contract revenue collected and booked | M | P1 |

**Exit gate:** ≥1 paying pilot with measured TTS improvement; concierge offer generating learnings + revenue; outreach metrics alive.

---

### WAVE M10 — Quality, Accessibility & Experience Completeness
**Objective:** Finish-quality across every shipped surface.

| ID | Task | Files / Surface | Acceptance Criteria | Effort | Pri |
|---|---|---|---|---|---|
| M10-1 | E2E suite (Playwright) over the five canonical surfaces: onboarding/NPI, passport, public share, employer review, pilot page — desktop + mobile viewports | new e2e/ | Runs in CI on PR; <10 min; flake rate <2% | M | P1 |
| M10-2 | Accessibility to WCAG 2.1 AA: extend existing a11y-gate.yml to all routes; manual screen-reader pass on wedge flow; fix findings | web, a11y gate | a11y gate blocking; documented VPAT-lite for enterprise buyers | M | P1 |
| M10-3 | Empty/error/loading state audit: every surface has designed states for gated sources, ingest-in-progress, source outage, zero-evidence clinician | web components | State inventory doc; no raw spinners/blank screens on wedge path | S | P2 |
| M10-4 | Performance budget: LCP <2.5s on passport + review pages; bundle analysis; image/font optimization | apps/web | Lighthouse CI gate ≥90 performance on key pages | S | P2 |
| M10-5 | Antigravity audit: walk every screen against §7 — remove any surface not tied to a blocked moment (dashboards-for-fun, tours, just-in-case screens), including MATCHA gamification review (streaks/constellation must serve readiness, not engagement theater) | all web surfaces | Written audit; each surviving surface names its blocked moment; removals shipped | M | P1 |
| M10-6 | Cross-browser/device matrix: Safari/Chrome/Firefox/Edge + iOS/Android web for share pages (clinicians share from phones) | e2e config | Share page renders correctly across matrix; test evidence archived | S | P2 |

**Exit gate:** Every shipped surface is finished, accessible, fast, and doctrine-compliant.

---

### WAVE M11 — Documentation, Enablement & Enterprise Sales Collateral
**Objective:** Everything a buyer, integrator, or new teammate needs — matching actual system behavior only.

| ID | Task | Files / Surface | Acceptance Criteria | Effort | Pri |
|---|---|---|---|---|---|
| M11-1 | API reference GA: OpenAPI spec generated from routes (build on apps/README_OPENAPI.md), published docs site, versioning policy | apps/api, docs site | Every public endpoint documented with auth, rate limits, examples; drift-check in CI | M | P1 |
| M11-2 | Security whitepaper + architecture overview (buyer-facing): trust model, data flows, encryption, audit, source honesty model | docs/enterprise/ | Reviewed against M3/M4 reality; no unverified claim | S | P0 |
| M11-3 | Enterprise onboarding guide: org setup, SSO config, team roles, pilot-to-production checklist | docs/enterprise/ | New org onboards using doc alone in staging test | S | P1 |
| M11-4 | Internal ops handbook: consolidated runbooks (from M5-8), support playbook, escalation matrix, data-request handling | docs/ops/ | Founder-absent test: a contractor can handle a routine incident from docs | M | P2 |
| M11-5 | Update MASTER_PROMPT/CLAUDE.md to post-M-wave reality; retire 2026-04-01 CLAUDE.md claims that no longer hold (W17 open items, mobile "empty", etc.) | CLAUDE.md, MASTER_PROMPT.md | Agent context files match verified state; refresh cadence noted | S | P1 |

**Exit gate:** Zero tribal knowledge on the critical path; sales can ship collateral without engineering review each time.

---

### WAVE M12 — Enterprise GA Gate (final go/no-go)
**Objective:** Formal, evidence-backed declaration of "100% complete and enterprise ready" for the defined product scope. Run `vitalcvlaunch-readiness` as the closing act.

**GA checklist — every item must cite evidence produced by prior waves:**

| # | Criterion | Evidence Source |
|---|---|---|
| 1 | Canonical path test-proven, fail-closed, revocation-first | M1-1, M1-4 CI gates |
| 2 | 100% mutating-route audit coverage | M1-2 coverage report |
| 3 | Copy/claims compliance automated | M1-8, M4-8 gates |
| 4 | Single coherent public funnel, honest demo | M2 exit gate |
| 5 | AuthN/RBAC/tenant-isolation matrix green 30 days | M3-1/2/3 nightly runs |
| 6 | Secrets clean, encryption attested, HIPAA-alignment packet complete | M0-3, M4-2, M4-3 |
| 7 | SOC 2 Type I in progress or complete (claimed only as true) | M4-6 auditor engagement |
| 8 | Backups restore-drilled; SLO monitoring live; incident runbook drilled | M5-6/7/8 |
| 9 | Employer org lifecycle self-serve incl. billing | M6 exit gate |
| 10 | ≥3 decision-grade source lanes; trust registry honest | M7 exit gate |
| 11 | Wallet GA (web) + standards conformance report | M8-1, M8-4 |
| 12 | ≥1 paying pilot with measured TTS delta | M9 exit gate |
| 13 | E2E + a11y + perf gates green | M10 |
| 14 | Buyer-facing docs/collateral verified accurate | M11 |
| 15 | Founder-signed launch-readiness report | vitalcvlaunch-readiness output |

**Output:** `ENTERPRISE_GA_REPORT_<date>.md` — the successor to every FINAL_*_AUDIT that came before it, and the only one that matters.

---

## Part 3 — Sequencing & Effort Summary

```text
M0 Truth & Hygiene          ──►  M1 Trust-Core Proof ──► M2 Funnel Seam ─┐
                                        │                                 │
                                        ├──► M3 Security ──► M4 Compliance┤
                                        │                                 ├──► M12 GA Gate
M9 Revenue/Pilots (starts NOW, ────────►│    M5 Ops ◄── parallel ──► M6 Employer Enterprise
runs continuously)                      │    M7 Sources ◄─ parallel ─► M8 Wallet/Standards
                                        └──► M10 Quality ──► M11 Docs ───┘
```

| Wave | Focus | Rough Effort (1 founder + Claude Code + contractors) |
|---|---|---|
| M0 | Truth & hygiene | 1 week |
| M1 | Trust-core proof | 2 weeks |
| M2 | Funnel seam | 1 week |
| M3 | Security baseline | 3–4 weeks |
| M4 | Compliance program | 3 weeks build + auditor timeline |
| M5 | Ops maturity | 2–3 weeks |
| M6 | Employer enterprise | 4–5 weeks |
| M7 | Source expansion | 4–6 weeks + institutional agreements (calendar-bound) |
| M8 | Wallet & standards | 3–4 weeks (mobile +4) |
| M9 | Revenue/pilots | Continuous from day 1 |
| M10 | Quality | 2 weeks |
| M11 | Docs/enablement | 1–2 weeks |
| M12 | GA gate | 3 days |

**Critical path:** M0 → M1 → M3 → M4 → M12 (security/compliance chain). **Longest external dependency:** M7-2/M7-3 institutional agreements and M4-6 SOC 2 auditor timeline — start both immediately regardless of engineering sequence. **Revenue rule:** M9 never waits for engineering; the concierge offer sells with today's product.

---

## Part 4 — Standing Anti-Drift Rules for Every Wave

1. Never claim NPDB, DEA, ABMS, SAM.gov, Doximity, real-time Nursys/FSMB, all-50-states, SOC 2/NCQA certification, or HIPAA certification.
2. Every mutating action writes an AuditEvent before 2xx — no exceptions, ever.
3. Zero PHI on-chain. Partial evidence stays partial. Gated stays gated. Unknown is unknown.
4. No `prisma migrate` without founder approval; SQL plans to `docs/migrations/` first.
5. Recognition → Acceptance → Start is frozen; revocation overrides everything.
6. No demo theater: if it's not real, it's not shipping — and it's not in this plan.
7. Antigravity test before shipping any new surface: name the blocked moment it unblocks, or delete it.
8. Verify before asserting: wave statuses, flags, source integrations, and % complete claims in this document expire — regenerate the current-state snapshot (M0-1) after each completed wave.

---

*End of Master Wave Plan. Refresh after each wave exit gate. This document supersedes prior task inventories for planning purposes; it does not supersede doctrine.*

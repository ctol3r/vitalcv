# VitalCV Master Prompt — Canonical Operator Context

> ## ⚠️ SUPERSEDED — DO NOT LOAD AS CURRENT DOCTRINE
>
> **`CLAUDE.md` is the operator contract of record.** Where this file disagrees with it,
> `CLAUDE.md` wins — without exception. Read governance from `origin/main`, never from the
> checked-out branch.
>
> Retained for **historical product context only** (CRS, trust states, the canonical path,
> naming). Its operating instructions are stale and actively wrong:
>
> - §17 "Cowork mode" (line 480) authorises Cowork for workspace file operations. `CLAUDE.md`
>   forbids OpenClaw, Browser, and Cowork for build/verify work.
> - §17 model routing (line 448) assigns Codex ownership of cryptography, backend services, and
>   ledger flows. Codex is an **optional** surgical verifier and is **not** a merge gate.
> - It predates the truth contract, the banned-string list, the founder visual gate, and the
>   Experience Constitution. None of those appear here.
>
> Do not cite this file as authority for how to work. Cite `CLAUDE.md`.

> **Version:** 2026-04-01 (frozen) | **Original scope:** All AI agents operating on this repo
> **Authority:** Synthesized from: repo source, ANTIGRAVITY.md, Canon.md, CRED0_DOCTRINE.md, CONTRACTORS.md, VITALCV_OVERVIEW.md, PRODUCT_POSITIONING.md, TRUST_LOOP.md, yc-positioning.md, all skill SKILL.md files, RELEASE-GATE-REPORT-2026-04-01.md, LIGHT_FIRST_UX_AUDIT, WAVE180.md, and Google Drive strategic documents.

---

## 0. Identity & Immutable Truths

You are operating inside the **VitalCV monorepo** at `~/vitalcv`.

**You are not a general assistant. You are a persistent technical + strategic operator for this specific system.**

VitalCV is not a job board. Not a document vault. Not a workflow automation tool. Not a credentialing platform in the legacy sense.

**VitalCV is Provider Identity Graph infrastructure — the trust layer that makes issued trust operational for healthcare credentialing.**

It is infrastructure in the same sense as HTTPS, OAuth, or DNS: invisible when working, catastrophic when absent.

---

## 1. Core Thesis (Non-Negotiable)

Healthcare does not primarily have a talent shortage. It has a **trust throughput problem**.

> Every employer re-verifies the same clinician from scratch because no employer trusts another employer's verification. This is structural, not procedural.

**VitalCV converts credential readiness into clinical capacity** by replacing inferred trust (hoping documents are real) with issued trust (cryptographic proofs from authoritative sources), collapsing onboarding timelines from months to days.

**North Star Primitives:**
- **CRS (Credential Readiness Score):** 0–100 deterministic score across 8 weighted dimensions. Explainable. Audit-trailable. Computed from receipt validity, acceptance presence, and threshold rules. No mutable side effects.
- **ISV (Interview-to-Start Velocity):** Days from interview to start date. 28-day rolling median. The single metric that proves the system is working.

---

## 2. Canonical Naming (Always Use These)

| Term | Usage |
|---|---|
| **VitalCV** | The product and platform. Always the primary brand name. |
| **CRED0** (pronounced "cred-zero") | The underlying trust-layer primitive — "Credential Zero." Insight, not headline. |
| **CRS** | Credential Readiness Score |
| **ISV** | Interview-to-Start Velocity |
| **PSV** | Primary Source Verification |
| **TTS** | Time to Start — the buyer-facing metric |
| **PRE** | Professional Recognition Event — system-level trust root |
| **QIA** | Qualified Identity Assertion — binds human + credential + intent + time |
| **AuditScrapbook** | Immutable audit trail pattern |
| **Decision Capsules** | Replayable decision provenance artifacts |
| **Trust Gradients** | Surfaces uncertainty: freshness, corroboration, disputes, confidence |

Never use: "blockchain-anchored" (say "cryptographically signed"), "zero-knowledge proof" (say "selectively disclosed"), "NPDB check cleared" (NPDB is NOT integrated), "hire instantly" (actual TTS is days), "ledger" for audit logs (say "audit trail"), "graph" for data flow descriptions.

---

## 3. The Canonical Path — Frozen Doctrine

There is **exactly one valid sequence** in this system:

```
Recognition → Acceptance → Start
```

**Frozen rules (never override without explicit founder approval):**
1. Recognition must be anchored by at least one valid PSV receipt.
2. Acceptance must reference an existing valid Recognition.
3. Start must reference an existing Acceptance and CRS ≥ 80.
4. Any missing, expired, or revoked receipt **fails closed**.
5. Revocation always overrides prior positive state — no exceptions.
6. CRS is computed from canonical inputs only — no hidden state, no imperative overrides.

**Copy discipline (holder-facing):** "Present VitalCV Recognition"
**Copy discipline (employer/verifier-facing):** "Accept VitalCV Authority"

---

## 4. The Antigravity Contract (Product Law)

VitalCV is not a place you go. VitalCV is the force that lets you go.

**The system must only appear at moments where progress cannot continue without it.**

| Allowed | Forbidden |
|---|---|
| Employer cannot start clinician → VitalCV unblocks | Optional dashboard that exists outside a block |
| Verifier needs proof of authority → VitalCV proves it | Parallel or duplicate workflow |
| Decision must be auditable → VitalCV anchors it | "Just in case" screens or setup wizards |
| | Feature tours |
| | Re-entry of already verified information |

**Design test:** If removing VitalCV does not force the user into a blocked state, VitalCV is in the wrong place. Redesign or remove.

---

## 5. Repo Architecture (Current State — 2026-04-01)

### Monorepo Root: `~/vitalcv`
- **Build system:** Turborepo + pnpm v10.6.1
- **Language:** TypeScript (strict mode throughout)
- **DB:** PostgreSQL via Prisma ORM
- **Auth:** Clerk (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`)
- **Deploy:** Railway (API + Web) — Vercel deprecated
- **CSS tokens:** `vt-*` system (e.g., `bg-vt-surface-ops-base`)
- **Typography classes:** `heading-sm`, `body-sm`, `heading-lg`

### Applications (`apps/`)

| App | Package Name | Type | Status |
|---|---|---|---|
| `apps/web` | `@vitalcv/web` | Next.js 15 / React 19 / Tailwind v4 | ✅ Active production app |
| `apps/api` | `@vitalcv/api` | Express + Prisma backend | ✅ Active production API |
| `apps/issuer-api` | `@vitalcv/issuer-api` | Credential issuance service | ⚠ Exists, integration status unknown |
| `apps/verifier-api` | `@vitalcv/verifier-api` | OID4VP verifier | ⚠ Canonical Path enforcement |
| `apps/marketing` | — | Public marketing site (separate visual system) | ⚠ Primary CTA routes to dead `/clinician` page — P0 |
| `apps/mobile` | — | Expo SDK 52 React Native wallet | 🔲 Designed (Wave Wallet spec) — **not yet built** |
| `apps/admin-api` | — | Admin tooling | Status unknown |
| `apps/router` | — | Internal routing service | Status unknown |

**CRITICAL:** `apps/marketing` and `apps/web` are **two separate apps** with different visual systems, different font stacks, and different NPI flows. The marketing app's NPI entry routes to a dead `/clinician` page. The web app has a fully functional NPI → readiness pipeline. This seam is **a P0 launch blocker**.

### Key Packages (`packages/`)

| Package | Purpose |
|---|---|
| `packages/trust-state` | `TrustStateResolver`, `sourceCoverage.ts` (9 coverage states), `contracts.ts` |
| `packages/domain-common` | `employmentContracts.ts`, `employmentGuards.ts`, `psvContracts.ts`, `psvPolicy.ts`, `facilityPrivilegeContracts.ts` |
| `packages/domain-identity` | Identity primitives |
| `packages/domain-core` | Core domain logic |
| `packages/domain-events` | Event types and patterns |
| `packages/psv` | `PSVReceipt.ts`, `psvStore.ts`, `validateReceipt.ts`, `sources/` |
| `packages/psv-adapters` | Source adapters |
| `packages/wallet-sdk` | `VitalCVWallet` SDK (API-connected, localMode stub added in Wave Wallet) |
| `packages/issuer-sdk` | Credential issuance SDK |
| `packages/verifier-sdk` | Verification SDK |
| `packages/poe-engine` | Proof-of-existence engine |
| `packages/crs` | CRS computation |
| `packages/graph-core` | Provider Identity Graph primitives |
| `packages/vitalindex` | Search/index layer |
| `packages/audit` | Audit primitives |
| `packages/audit-receipts` | Receipt-based audit trail |
| `packages/sdk` | Public SDK surface |
| `packages/embed-sdk` | Embeddable widget SDK |
| `packages/haip-config` | HAIP 1.0 posture enforcement |
| `packages/vc-formats-csdjwt` | SD-JWT / W3C VC format handlers |
| `packages/runtime-mode` | Runtime mode flags |
| `packages/rate-limiter` | Rate limiting primitives |
| `packages/tracing` | Observability/tracing |
| `packages/ingest` | Source ingestion pipeline |
| `packages/claims` | Claims processing |

### Services (`services/`)
- `services/decision-engine` — Trust decision engine
- `services/investigator-engine` — Research/investigator profile engine

### Anchoring (no `blockchain/` directory)
- The Substrate pallet skeletons were **deleted on 2026-07-25** — nothing built, deployed, or imported them, and they carried 171 unaudited Rust advisories. See [the ADR](docs/architecture/adr-substrate-anchoring.md).
- Tamper-evidence today = ES256-signed receipts + Merkle inclusion proofs (`merkleBatcher.ts`, `anchorWorker.ts`); the on-chain write remains simulated.
- **Zero PHI on-chain** is a permanent non-negotiable, enforced at the anchor boundary by `assertHashOnlyAnchor` if a real ledger is ever wired.

---

## 6. Live Sources — What's Actually Running (2026-04-01)

| Source | Status | Feature Flag |
|---|---|---|
| **NPPES** (CMS NPI Registry — 8M+ providers) | ✅ Always on | — |
| **OIG/LEIE** (Federal exclusion registry) | ✅ Always on | `OIG_LEIE_ENABLED=true` (default) |
| **CMS PECOS** (Medicare enrollment, quarterly snapshot) | ✅ Source-backed, not real-time | `PECOS_ENABLED=true` |
| **STATE_BOARD** (launch physician licensure lane) | ⚠ Source-backed when adapter configured | `STATE_BOARD_ENABLED` |
| **Nursys** (State board network, 50 states) | 🔒 Gated — institutional access required | `REAL_NURSYS_ENABLED=true` when ready |
| **FSMB** | 🔒 Gated — institutional agreement required | `FSMB_ENABLED=true` |

**NEVER add to UI or copy (not integrated):** NPDB, DEA, ABMS, SAM.gov, Doximity.

### Decision-Grade Rules
A clinician is decision-grade (employer can accept) when:
1. Identity confirmed: NPPES L2+
2. Safety clear: OIG/LEIE `CLEAR`
3. Authority verified: state license ACTIVE via configured state-board lane
4. Eligibility: PECOS enrolled (or `NOT_FOUND` with explicit action shown)
5. `readinessEngine` score ≥ 60 → L2+; all blockers resolved → L3

---

## 7. Canonical Trust Path — Backend Routes

```
POST /api/ingest/npi/:npi
  → sourceVerifier (NPPES)
  → oigLeieChecker (OIG/LEIE)
  → physicianLicensureLaunchLane / authority adapters
  → trustStateEngine → readinessEngine
  → passportService.buildPassport(entityId)

GET  /api/passport/entity/:entityId
GET  /api/passport/npi/:npi
GET  /api/employer-review/:entityId/packet     — evidence export
POST /api/employer-review/:entityId/accept     — ATOMIC: EmployerAcceptance + AuditEvent
POST /api/employer-review/:entityId/request-refresh
POST /api/employer-review/:entityId/route-to-review
```

**The audit contract:** Every mutating action writes an `AuditEvent` row before returning 2xx. Never skip this.

### Canonical Product Flow (buyer-facing wedge)
```
1. /onboarding → NPI entry → credential ingestion start
2. /passport/[id] → full trust passport, readiness score, blockers
3. /p/[slug] → public share surface (NPI-based slug, clinician-controlled)
4. /review/[entityId] → employer decision surface (FreshnessPanel, 4-layer freshness)
5. Employer clicks "Accept as head start" → AuditEvent written → confirmation
```
Complete flow: **< 60 seconds** for a pilot demo.

---

## 8. Source Coverage States (Trust State)

9 canonical states in `packages/trust-state/sourceCoverage.ts`:
`checked` | `stale` | `pending` | `gated` | `unavailable` | `accessRequired` | `reviewRequired` | `notDecisionGrade` | `previewOnly`

**4-level operator spine status:** `HEALTHY` → `DEGRADED` (≥3 consecutive failures) → `STALE` (missed freshness SLA) → `CRITICAL` (source unavailable)

---

## 9. Current Work Streams (April 2026)

### Wave 16: Source Health — CONDITIONAL GO
Architecture sound. P1/P2 polish remaining:
- **W16-1 (P1):** Add operator remediation hints to `SourceHealthPanel.tsx` + `PilotDiagnosticsPanel.tsx`
- **W16-2 (P2):** Add absolute ISO timestamp on hover (currently relative-only)
- **W16-3 (P2):** Add GATED alert to `sourceOpsService.ts` alert system
- **W16-4 (P3):** Add polling to `PilotDiagnosticsPanel.tsx`

### Wave 17: Buyer Surface — NO-GO (7 copy violations)
**P0 blockers (must fix before any buyer-facing deployment):**
- **W17-1:** `Hero.tsx:133-136` — Remove "anchor it to a zero-trust ledger" and "hire instantly". Replace with factual TTS copy.
- **W17-2:** `Hero.tsx:122` — Remove "Zero-Trust Credentialing Infrastructure" eyebrow. Replace with "Source-Backed Credentialing".
- **W17-3:** `HomeSections.tsx:307` — Remove "graph" (implies graph DB). Replace with "chain".
- **W17-4:** `HomeSections.tsx:309` — Remove "ledger" + HIPAA → "HIPAA-aligned". Use "audit trail" not "audit ledger".
- **W17-5 (P1):** `Hero.tsx:16,20` — Terminal shows green checkmark for Nursys (gated source). Show `⚠ institutional access required` or remove.
- **W17-6 (P2):** `Hero.tsx:159` — Remove SOC 2 and NCQA trust badges (uncertified). Keep "HIPAA-aligned" + "W3C VC".
- **W17-7 (P2):** `Hero.tsx:142` — Fix "Request a Demo" CTA routing to `/verifier` (wrong destination). Route to demo request form.

**Additional non-blocking buyer issues:**
- `/partners` and `/investors` pages have hardcoded `DEMO_METRICS` (12,847 credentials, 284 verifiers) without "illustrative" labels — P0 investor credibility risk
- Review flow (`/review/request`) is auth-gated — blocks live demo walkthroughs for unauthenticated employers

### Wave 180: Dual-Entity Identity & Workspace Graph
Branch: `wave/180-identity-workspace-graph`
Adding: `PersonProfile`, `OrganizationProfile`, `WorkspaceMembership`, `WorkspacePreference` Prisma models; workspace service; `/api/me/workspaces` + `/api/workspaces/switch` routes; `WorkspaceSwitcher` frontend component; `/workspace/switch` page.
**Status:** Designed, not yet implemented.

### Wave Wallet: Clinician Credential Wallet (Expo)
`apps/mobile/` — Standalone Expo SDK 52+ React Native app.
Features: `LocalCredentialStore` (SecureStore), `OfflinePresentationEngine` (VP JWTs, no network), `OID4VPHandler` (QR scan), `NotificationService` (expiry alerts), `WalletSyncService`.
**Status:** Designed (full spec in WAVE_TASK.md), `apps/mobile/` is **empty** — not yet built.

---

## 10. Environment Flags

```env
# Core Sources
OIG_LEIE_ENABLED=true           # Always on in prod
PECOS_ENABLED=true              # CMS quarterly snapshot
STATE_BOARD_ENABLED=false       # Set true when launch-state adapter configured
REAL_NURSYS_ENABLED=false       # Set true when institutional E-Notify access ready
FSMB_ENABLED=false              # Set true when FSMB institutional agreement active

# Features
MONITORING_ENABLED=false        # Wave 245 async trust engine
SEAL_TRAINING_EXPORT_ENABLED=false  # Training dataset export gate
OCR_PROVIDER=stub               # Set to 'openai' when OpenAI key available
```

---

## 11. Key Files by Concern

| Concern | File |
|---|---|
| Canonical path types | `packages/domain-common/employmentContracts.ts` |
| Canonical path enforcement (compile-time) | `packages/domain-common/employmentGuards.ts` |
| PSV evidence types | `packages/domain-common/psvContracts.ts` |
| PSV policy evaluation | `packages/domain-common/psvPolicy.ts` |
| Source coverage states | `packages/trust-state/sourceCoverage.ts` |
| Trust state resolver | `packages/trust-state/TrustStateResolver.ts` |
| PSV receipt types | `packages/psv/PSVReceipt.ts` |
| PSV store | `packages/psv/psvStore.ts` |
| Trust source catalog | `apps/api/backend/src/services/identity/sourceCatalog.ts` |
| Passport builder | `apps/api/backend/src/services/entity/passportService.ts` |
| Readiness engine | `apps/api/backend/src/services/verticals/readiness/readinessEngine.ts` |
| Source ops service | `apps/api/backend/src/services/sourceOpsService.ts` |
| Employer review routes | `apps/api/backend/src/routes/employerActions.ts` |
| SEAL event capture | `apps/api/backend/src/services/seal/sealEventCapture.ts` |
| DB schema | `apps/api/backend/prisma/schema.prisma` |
| PassportWallet UI | `apps/web/components/passport/PassportWallet.tsx` |
| ReviewClient UI | `apps/web/components/review/ReviewClient.tsx` |
| InterviewClient UI | `apps/web/app/interview/InterviewClient.tsx` |
| SourceHealthPanel | `apps/web/components/pilot/SourceHealthPanel.tsx` |
| PilotDiagnosticsPanel | `apps/web/components/pilot/PilotDiagnosticsPanel.tsx` |
| HAIP config | `packages/haip-config/` |
| SD-JWT / W3C VC formats | `packages/vc-formats-csdjwt/` |
| Wallet SDK | `packages/wallet-sdk/src/index.ts` |

---

## 12. Technology Stack

| Layer | Tech |
|---|---|
| **Frontend** | Next.js 15, React 19, Tailwind v4, TypeScript strict |
| **Backend** | Express, Prisma ORM, TypeScript |
| **Database** | PostgreSQL |
| **Auth** | Clerk |
| **Mobile** | Expo SDK 52, React Native, expo-secure-store, expo-local-authentication |
| **Identity standards** | W3C Verifiable Credentials, DIDs (did:key, did:vitalcv), NPI-first identity |
| **Presentation** | OpenID4VP (OID4VP), OpenID4VCI (OID4VCI) |
| **VC format** | SD-JWT (selective disclosure preferred for pilots), W3C JWT VC |
| **Cryptography** | ES256 (P-256), PKCE S256, DPoP token binding, SHA-256 Merkle roots, HAIP 1.0 |
| **Trust ledger** | Substrate-based permissioned blockchain (off-chain data, on-chain anchors only) |
| **Build** | Turborepo + pnpm monorepo |
| **Deploy** | Railway (API + Web) — Vercel deprecated |
| **CI/CD** | `pnpm --filter @vitalcv/api build` + `pnpm --filter web build` + `pnpm lint` + `pnpm tsc --noEmit` |

---

## 13. Trust Primitives Reference

### NPI-First Identity
- Every clinician identity is rooted at their NPI (National Provider Identifier)
- NPI → DID binding is the trust anchor
- Type 1 NPI = individual clinician | Type 2 NPI = organization

### Cryptographic Trust Flow (Target State)
```
Primary Source (NPPES / State Board / OIG)
  → Issues signed PSV Receipt
  → Receipt anchored via Proof-of-Existence engine
  → TrustStateResolver computes aggregate trust state
  → CRS computed from trust state
  → Recognition Event issued (PRE)
  → Holder stores in wallet (SD-JWT)
  → Holder presents to verifier (OID4VP)
  → Verifier checks revocation registry
  → Acceptance recorded (Decision Capsule)
  → AuditScrapbook entry written
```

### Revocation-First Validity
Validity must be actively proven with freshness bounds. A stale or unverified credential is NOT valid — it is unknown. The system fails closed.

### Zero PHI On-Chain
Absolute non-negotiable. Blockchain layer anchors hashes/proofs only. All clinical/identity data stays off-chain in PostgreSQL.

### Selective Disclosure
SD-JWT is the preferred format for pilots. Holders can reveal specific claims without exposing the full credential.

### SEAL Advisory Pipeline (Offline)
SEAL captures behavioral outcomes for offline advisory training. It **never** modifies source truth. Any output labeled: `"Based on observed patterns"`. Event tables are append-only: `advisory_outcome_events`, `blocker_resolution_events`, `employer_decision_events`, `start_outcome_events`.

---

## 14. Product Positioning & Competition

**VitalCV is Provider Identity Graph infrastructure** — not a credentialing workflow tool.

**Category we own (competitors don't do well):**
1. Composite Trust Scoring (0–100, 8 weighted dimensions, explainable)
2. Verification Freshness (per-claim-class decay model)
3. Cross-Source Divergence Detection (7 rules, 3 severity tiers)
4. Source Coverage Transparency (checked/gated/stale/missing per source)
5. Claim-Level Receipts + Provenance (source → timestamp → checksum → parser version)
6. Academic/Research Identity Integration (OpenAlex, PubMed, ClinicalTrials, ORCID)

**Non-compete rule:** Do not add features to compete with workflow automation (document collection, form routing, committee management). Make those tools smarter by being their trust layer.

**Competitive differentiation from Medallion:** Medallion automates the process of collecting and verifying documents. VitalCV *is the underlying truth layer* those documents should derive from.

---

## 15. YC Positioning

**One-liner:** VitalCV compresses time-to-start for healthcare employers from months to days by making clinician credentials continuously verified, cryptographically auditable, and instantly reusable — eliminating the re-verification bottleneck that exists in every hiring cycle.

**Pilot wedge:** Start with payer credential verification teams and staffing vendors. Single-tenant first. Mandatory artifact checks. Expand after cross-tenant deny/allow matrix is stable for 30 days.

**Revenue model:** Base platform access per active verifier org (monthly) + usage tiers by verified artifacts + enterprise modules for trust governance + implementation/compliance onboarding fee for first pilots.

**Why now:** Federal and payer programs requiring stronger credential governance + auditable provenance. Operational risk from stale source data. VitalCV is compliance-ready by design.

---

## 16. What Must Never Be Said / Done

### Copy prohibitions
| ❌ Never say | ✅ Say instead |
|---|---|
| "Blockchain-anchored" | "Cryptographically signed" |
| "Zero-knowledge proof" | "Selectively disclosed (SD-JWT)" |
| "Hire instantly" | "Start clinicians in days, not months" |
| "HIPAA certified" | "HIPAA-aligned" |
| "SOC 2 certified" / "NCQA certified" | Nothing — remove badges until certified |
| "NPDB check cleared" | Never — NPDB is not integrated |
| "All 50 states" | "Licensed states (via Nursys)" — only when Nursys is enabled |
| "Anchor it to a zero-trust ledger" | "Generate audit-ready credential packets" |
| "Permanent record" | "Append-only audit trail" |
| "Zero-Trust Credentialing Infrastructure" | "Source-Backed Credentialing" |
| Hardcoded demo metrics without labels | Add "illustrative" label or remove |

### Engineering prohibitions
- Never put PHI on-chain
- Never skip AuditEvent writes on mutating actions
- Never reintroduce demo theater routes (archived in `apps/web/app/_archive`)
- Never run `prisma migrate` without explicit approval — write SQL plan to `docs/migrations/` only
- Never delete existing Prisma models or routes without explicit approval
- Never bypass HAIP posture checks
- Never invent cryptographic schemes — use established primitives only
- Never break canonical path sequence (Recognition → Acceptance → Start)

---

## 17. Execution Model & Skills Inventory

### Primary Executor
**Claude Code** is the bulk execution engine for VitalCV. All large-scale implementation, refactoring, and scaffolding runs through Claude Code.

### Specialist Tools
- **Codex:** Cryptography, standards/protocols (DID/VC/OID4VP), backend services, ledger flows
- **Cursor:** Frontend implementation, UI/UX polish, refactors, pairing

### Available Skills (invoke before major work)

| Skill | Use When |
|---|---|
| `vitalcvrepo-map` | Need full structural/architectural map of the monorepo |
| `vitalcvcurrent-state` | Need factual snapshot of what's implemented vs stubbed vs broken |
| `vitalcvflow-trace` | Tracing issuer → holder → verifier → revocation flows |
| `vitalcvgap-analysis` | Identifying P0/P1/P2 gaps before a release or audit |
| `vitalcvdesign-proposal` | Creating implementation-ready technical designs |
| `vitalcvtask-bundler` | Breaking designs into Claude Code / Codex / Cursor task waves |
| `vitalcvimplement-feature` | Delivering a complete end-to-end feature |
| `vitalcvscaffold` | Generating production-grade scaffolding for new components |
| `vitalcvfix-and-harden` | Diagnosing and fixing build failures, runtime errors, broken trust flows |
| `vitalcvrefactor-safely` | Controlled refactors preserving public interfaces and data schemas |
| `vitalcvchain-integrator` | On-chain signing, revocation registries, anchoring logic |
| `vitalcvcompliance-mapper` | Mapping features to NCQA, HIPAA, audit controls |
| `vitalcvdocs-and-ops` | READMEs, API docs, runbooks — matches actual system behavior |
| `vitalcvlaunch-readiness` | Go/no-go assessment for production or pilot deployment |
| `yc-export-optimizer` | Transforming session transcripts into YC-quality export documents |

### Default Execution Pattern
```
Design (vitalcvdesign-proposal)
  → Task Bundling (vitalcvtask-bundler)
  → Forked Implementation (Claude Code / Codex / Cursor)
  → Validation (vitalcvlaunch-readiness or vitalcvgap-analysis)
  → Launch Readiness
```

**Cowork mode (this context):** Authorized for: file operations in vitalcv workspace, triage/classification, artifact indexing, research hygiene, packaging exports, documentation. **Never:** modify source code directly (use Claude Code), delete without review, modify Prisma schema without review.

---

## 18. Compliance & Regulatory Framework

| Standard | Scope | Status |
|---|---|---|
| **HIPAA** | PHI handling, access controls, audit trails | HIPAA-aligned (not certified) |
| **NCQA CR1-CR5** | Credentialing criteria, primary source verification, ongoing monitoring | Architecturally compliant (audit pending) |
| **CMS §482.12** | Conditions of Participation — credentials verified before appointment | Canonical path enforces this |
| **HAIP 1.0** | High Assurance Interoperability Profile for VC presentation | Enforced via `packages/haip-config` |
| **W3C VC** | Verifiable Credential data model | Core VC format |
| **OpenID4VCI/VP** | Credential issuance and presentation protocols | Implemented |
| **SOC 2** | Security audit | **NOT YET completed — do not claim** |
| **NCQA Certification** | Formal certification | **NOT YET — do not claim** |

---

## 19. Pilot Boundaries (Do Not Widen Without Approval)

The live pilot is scoped to the **NPI → Passport → Review → Accept** wedge. Before any deployment, read:
- `docs/specs/vitalcv-launch-gate.md`
- `docs/specs/vitalcv-pilot-runbook.md`
- `docs/specs/vitalcv-pilot-brief.md`
- `docs/specs/vitalcv-pricing-doctrine.md`

**Do not build features solely to make demos look impressive. If it's not real, it's not shipping.**

Scope rule: Pilot outcomes must carry the same scope (org, pilot, lane, geography) as the filter applied. Never aggregate unscoped starts.

---

## 20. Anti-Drift Rules

### Always Treat as Immutable (Tier 1/2)
- Core thesis, primitives, canonical path, Antigravity contract
- Security posture: zero PHI on-chain, HAIP enforcement, audit-first
- Naming: VitalCV, CRED0, CRS, ISV, PRE, QIA, AuditScrapbook, Decision Capsules
- Revocation-first validity
- Receipt-first rule
- All copy prohibitions and engineering prohibitions

### Always Treat as Mutable — Verify Before Asserting (Tier 3)
- % complete claims
- Wave numbers and their implementation status
- Pilot partner counts and sizes
- Specific source integration status (check CONTRACTORS.md and flags)
- Feature flag states
- Current blockers list

---

## 21. Immediate Priorities (as of 2026-04-01)

**Release Gate — BLOCKED PENDING FIXES:**

| Priority | Item | Effort | File |
|---|---|---|---|
| **P0** | Hero.tsx copy rewrite (W17-1, W17-2) | S | `apps/web/app/(marketing)/Hero.tsx` |
| **P0** | Terminal green checkmarks for gated Nursys (W17-5) | S | `Hero.tsx:16,20` |
| **P1** | HomeSections.tsx "graph" + "ledger" removal (W17-3, W17-4) | S | `apps/web/app/(marketing)/HomeSections.tsx` |
| **P1** | Add operator remediation hints to SourceHealthPanel (W16-1) | M | `SourceHealthPanel.tsx`, `sourceOpsService.ts` |
| **P2** | Remove SOC 2 / NCQA trust badges (W17-6) | S | `Hero.tsx:159` |
| **P2** | Fix "Request a Demo" CTA destination (W17-7) | S | `Hero.tsx:142` |
| **P2** | Add GATED alert to sourceOpsService (W16-3) | S | `sourceOpsService.ts` |

**Total blocking work estimate: ~2 hours of focused changes.**
**The architecture is sound. The execution gap is entirely in messaging discipline and copy accuracy.**

---

*Generated 2026-04-01 by Claude Cowork acting as VitalCV Master Operator.*
*Sources: entire repo scan + Notion + Google Drive + all VitalCV skill files.*
*Refresh this document after major wave completions or product pivots.*

# VitalCV — Billion-Dollar Feature Extraction & Wave Task Bundle
> **Generated:** 2026-04-12 | **Sources:** VitalCV monorepo, Dropbox, christoler/, Downloads/, Google Drive, Notion
> **Purpose:** Master execution prompt for OpenClaw to implement into VitalCV current state

---

## PART 1: THE BILLION-DOLLAR FEATURE INVENTORY

Every feature, concept, and idea extracted from every document Christopher has ever written about VitalCV — filtered for features that compound into a billion-dollar outcome.

### Tier 1: Network-Effect Engines (Winner-Take-All Moats)

| # | Feature | Source Doc | Why Billion-Dollar | Current State |
|---|---------|-----------|-------------------|---------------|
| 1 | **Credential Liquidity Network** | PLATFORM_PILLARS.md | Once credentials are portable and reusable across employers, switching cost is infinite. Every new employer that accepts VitalCV makes the next one more likely. This IS the Visa analogy. | MATCHA engine built (2,370 LOC), scoring works, but disconnected from live hospital capacity data. Flag-gated as MATCHA_V2. |
| 2 | **Apply with VitalCV (Embed Widget)** | PLATFORM_PILLARS.md, ROADMAP.md | The Stripe Checkout moment — embed VitalCV into any ATS, job board, or hospital careers page. Distribution flywheel: clinician uses widget → employer receives verified bundle → employer demands all candidates use it. | embed-sdk package exists. Application model + flow built (Wave 229). Missing: ATS integrations (Workday, Greenhouse, iCIMS, Lever), output payload standardization. |
| 3 | **Continuous Credential Monitoring** | PLATFORM_PILLARS.md, SYSTEM_MAP.md | Turns VitalCV from point-in-time verification into always-on infrastructure. Employers can't turn it off once monitoring is active. Creates subscription revenue. | NursysENotifyAdapter, MonitoringSubscription, trustAlerts service, continuousMonitor, OIG/LEIE checker all BUILT. Not production-wired. Wave 245 target. |
| 4 | **Decision Capsules (Institutional Memory)** | PLATFORM_PILLARS.md | Every hiring decision ever made becomes queryable. "Show me every clinician this hospital accepted in the last 2 years and their current trust state." No competitor has this. | Prisma model exists, capsuleEngine built. Not wired to live Trust State Engine. No query API. Wave 244 target. |
| 5 | **Global Trust Graph** | PLATFORM_PILLARS.md, SYSTEM_MAP.md | The provider identity graph itself — nodes (clinicians, credentials, issuers, hospitals, payers) + edges (ISSUED_BY, VERIFIED_BY, DEPENDS_ON). Network grows with every verification. | trustGraph service, GlobalTrustMap canvas, federation nodes, knowledge graph all built. Missing: expansion API, dynamic edge streaming. graph-core package exists (9 dirs). |

### Tier 2: Revenue Multipliers (Direct Enterprise Value)

| # | Feature | Source Doc | Why Billion-Dollar | Current State |
|---|---------|-----------|-------------------|---------------|
| 6 | **Trust Simulation Engine** | PLATFORM_PILLARS.md | Hospital CTO can simulate "what happens if Dr. X's license is revoked?" and see cascade: affected privileges, revenue impact, staffing gaps across facilities. This sells six-figure enterprise contracts. | simulationMachine (state machine), revocation blast radius page, cascade computation, cascadeEngine all BUILT. Not connected to real trust state. No revenue impact model. |
| 7 | **Clinic Capacity Score** | FOUNDER_NOTES.md, NARRATIVE.md | "For the first time employers can measure capacity of their clinic." Measuring "starts enabled per quarter" as enterprise sales metric. This is the ISV metric productized. | Capacity score MVP concept exists. MATCHA has scoring logic. Real hospital capacity data not connected. |
| 8 | **Instant Offers** | Feature flags, growth services | Employer sees decision-grade clinician → sends conditional offer instantly. Collapses the offer-to-start timeline from months to hours. | instantOfferService.ts BUILT (241 LOC), route handler exists. Behind PILOT flag (INSTANT_OFFERS). |
| 9 | **Ask VitalCV (AI Search)** | SYSTEM_MAP.md, feature flags | Natural language queries against the trust graph: "Find me a board-certified oncologist in California with no sanctions and PECOS enrollment." This is the killer employer UX. | Routes exist (/ask), flag-gated (ASK_VITALCV). Framework present but disabled. |
| 10 | **Referral Network** | Feature flags, referral services | Clinician-to-clinician referrals with trust provenance. "Dr. X referred Dr. Y, both are decision-grade." Social proof + network effect. | referralService.ts BUILT (335 LOC), /holder/referrals page exists. Behind INTERNAL flag (REFERRALS_V2). |

### Tier 3: Wedge Expanders (Market Capture)

| # | Feature | Source Doc | Why Billion-Dollar | Current State |
|---|---------|-----------|-------------------|---------------|
| 11 | **Mobile Credential Wallet** | WAVE_TASK.md, mobile app | Clinician carries credentials on phone. Presents via QR/NFC at hospital. Offline-capable. This is the "VitalCV in every pocket" play. | apps/mobile has REAL Expo code: LocalCredentialStore, OID4VPHandler, OfflinePresentationEngine, WalletSyncService, 25+ components. Needs integration testing + polish. |
| 12 | **Resident/Fellow Wedge** | YC Flashcards | "Final-year residents and fellows — the only predictable transition point." Capture them at graduation, they carry VitalCV for their entire career. | Onboarding flow exists. No specific resident-targeting UX or GME integration. |
| 13 | **Multi-Site Credentialing** | Use Cases PDF | Resident credentials at main hospital + affiliates simultaneously. Process taking 4-8 weeks per site done in 1 week. | Passport sharing exists. No multi-org simultaneous credentialing workflow. |
| 14 | **Telehealth Multi-State Practice** | Use Cases PDF | Unified verified profile of all licenses across states. $15B/year admin overhead from COVID waiver removal. | State board adapter framework exists. Multi-state license aggregation not productized. |
| 15 | **Locum Tenens / Travel Nurse Instant Placement** | Use Cases PDF | Embedded at point of shift booking. SnapNurse benchmark: 24-48 hours vs 11-14 days standard. | Apply flow works. No staffing agency integration or shift-booking embed. |

### Tier 4: Data Moat Deepeners (Compounding Advantage)

| # | Feature | Source Doc | Why Billion-Dollar | Current State |
|---|---------|-----------|-------------------|---------------|
| 16 | **Cross-Source Divergence Detection** | PRODUCT_POSITIONING.md | 7 rules, 3 severity tiers. When NPPES says one thing and state board says another, VitalCV surfaces that signal. No single-source tool can do this. | Trust computation architecture designed. Implementation status: rules defined, enforcement unclear. |
| 17 | **Verification Freshness Decay Model** | PRODUCT_POSITIONING.md | Per-claim-class decay: licenses 7-day window, identity 30-day, sanctions daily. A 6-month-old verification is not the same as today's. | Freshness architecture designed. 4-layer freshness in ReviewClient. |
| 18 | **Research Identity Integration** | PRODUCT_POSITIONING.md, SYSTEM_MAP.md | PubMed, ClinicalTrials.gov, ORCID, OpenAlex. Academic medical centers are underserved — this is the AMC sales wedge. | PubMed planned in Phase 2 (Wave 244). ORCID/OpenAlex referenced. investigator-engine service BUILT (7 files). |
| 19 | **SEAL Advisory Pipeline** | Master Prompt | Behavioral outcome capture for offline advisory training. Append-only event tables: advisory_outcome_events, blocker_resolution_events, employer_decision_events, start_outcome_events. | SEAL event capture service exists (sealEventCapture.ts). Offline advisory not implemented. |
| 20 | **Source Coverage Transparency** | PRODUCT_POSITIONING.md | 9 canonical states: checked, stale, pending, gated, unavailable, accessRequired, reviewRequired, notDecisionGrade, previewOnly. No competitor shows what they DON'T know. | packages/trust-state/sourceCoverage.ts BUILT with all 9 states. SourceHealthPanel and PilotDiagnosticsPanel exist. |

### Tier 5: Infrastructure & Standards (Long-Term Defensibility)

| # | Feature | Source Doc | Why Billion-Dollar | Current State |
|---|---------|-----------|-------------------|---------------|
| 21 | **OID4VCI Credential Issuance at Scale** | ARCHITECTURE.md, issuer-api | Standard-based credential issuance. Becomes the default issuer for healthcare VCs. | issuer-api app exists. OID4VCI endpoints built. |
| 22 | **OID4VP Verifier Federation** | ARCHITECTURE.md, verifier-api | Any hospital can verify VitalCV credentials using open standards. Federation = network effect. | verifier-api app exists. OID4VP endpoints built. |
| 23 | **SD-JWT Selective Disclosure** | Multiple | Clinician reveals only what's needed. "Show my license status but not my home address." Privacy-preserving and HIPAA-aligned. | packages/vc-formats-csdjwt exists. SD-JWT is preferred format for pilots. |
| 24 | **Dual-Entity Identity (Wave 180)** | WAVE180.md | PersonProfile + OrganizationProfile + WorkspaceMembership. Clinicians AND organizations as first-class entities. | Designed. WORKSPACES feature flag enabled. WorkspaceSwitcher component exists. |
| 25 | **Blockchain Trust Anchoring** | blockchain/substrate/ | Immutable proof-of-existence for credential events. Zero PHI on-chain. Regulatory audit trail that can't be tampered with. | blockchain/substrate exists. Architecture complete. Production integration TBD. |

---

## PART 2: THE EXECUTION SEQUENCE

### Principle: Every wave must either (a) reduce time-to-start, (b) create switching cost, or (c) unlock enterprise revenue.

### Current Blocking Issues (Fix First — 2 hours)

Before any new feature work, clear the P0 release gate blockers documented in the Release Gate Report:

```
WAVE 0: RELEASE GATE CLEARANCE (2 hours)
├── W17-1: Hero.tsx — remove "anchor it to a zero-trust ledger" + "hire instantly" → factual TTS copy
├── W17-2: Hero.tsx — remove "Zero-Trust Credentialing Infrastructure" → "Source-Backed Credentialing"
├── W17-3: HomeSections.tsx — remove "graph" → "chain"
├── W17-4: HomeSections.tsx — remove "ledger" → "audit trail", HIPAA → "HIPAA-aligned"
├── W17-5: Hero.tsx — Nursys green checkmarks → "⚠ institutional access required" or remove
├── W17-6: Hero.tsx — remove SOC 2 / NCQA trust badges (uncertified)
├── W17-7: Hero.tsx — fix "Request a Demo" CTA routing (→ demo form, not /verifier)
├── W16-1: SourceHealthPanel + PilotDiagnosticsPanel — add operator remediation hints
└── DEMO_METRICS on /partners and /investors — add "illustrative" labels or remove
```

---

## PART 3: THE WAVE TASK BUNDLE PROMPT FOR OPENCLAW

> **Copy everything below this line into OpenClaw as a single execution prompt.**

---

# OPENCLAW EXECUTION PROMPT: VitalCV Billion-Dollar Wave Bundle

You are implementing features into the VitalCV monorepo at `~/vitalcv`. This is a Turborepo + pnpm monorepo with TypeScript strict mode, Next.js 15 / React 19 frontend (apps/web), Express + Prisma backend (apps/api), and Expo mobile (apps/mobile).

**Before ANY implementation:** Read the CLAUDE.md at the repo root for immutable rules, copy prohibitions, and engineering constraints.

**Frozen rules you must never break:**
1. Recognition → Acceptance → Start canonical path sequence
2. Zero PHI on-chain
3. Every mutating action writes an AuditEvent before returning 2xx
4. Never run `prisma migrate` without explicit approval
5. CRS computed from canonical inputs only — no hidden state
6. Revocation always overrides prior positive state
7. Never claim SOC 2, NCQA certified, NPDB integrated, or "all 50 states"

**Current branch:** `fix/npmes-full-hydration` — create feature branches off main for each wave.

---

## WAVE 1: RELEASE GATE CLEARANCE (Priority: IMMEDIATE)
**Branch:** `fix/release-gate-copy-cleanup`
**Effort:** S (2 hours)

### Tasks:
1. **`apps/web/app/(marketing)/Hero.tsx`**
   - Lines 133-136: Replace "anchor it to a zero-trust ledger" with "Generate audit-ready credential packets"
   - Line 122: Replace "Zero-Trust Credentialing Infrastructure" with "Source-Backed Credentialing"
   - Lines 16,20: Replace green checkmark for Nursys with `⚠ institutional access required` or remove the Nursys line entirely
   - Line 159: Remove SOC 2 and NCQA trust badges. Keep only "HIPAA-aligned" and "W3C VC"
   - Line 142: Fix "Request a Demo" CTA — route to demo request form, NOT `/verifier`

2. **`apps/web/app/(marketing)/HomeSections.tsx`**
   - Line 307: Replace "graph" with "chain" (avoid implying graph DB)
   - Line 309: Replace "audit ledger" with "audit trail"; replace "HIPAA" with "HIPAA-aligned"

3. **`/partners` and `/investors` pages**
   - Find hardcoded `DEMO_METRICS` (12,847 credentials, 284 verifiers)
   - Add "illustrative" label or replace with actual metrics if available

4. **Verification:** Run `pnpm --filter web build` and `pnpm lint` — zero errors.

---

## WAVE 2: ACTIVATE EXISTING FLAG-GATED FEATURES (Priority: HIGH)
**Branch:** `feature/activate-gravity-well`
**Effort:** M (1 day)

These features are ALREADY BUILT but sitting behind disabled flags. Review each, fix any broken integrations, and enable for pilot:

### Tasks:
1. **Enable MATCHA_V2** (`apps/web/lib/features.ts`)
   - Review `apps/api/backend/src/services/matcha/` (2,370 LOC)
   - Verify matchaEngine, liveMatchaService, opportunityRegistry, eligibility are functional
   - If mockData.ts is the only data source, wire to real NPPES/passport data
   - Ensure `/api/matcha/score` and `/api/matcha/opportunities/[npi]` return real results
   - Enable flag, verify UI at `/holder/opportunities`

2. **Enable INSTANT_OFFERS** (`INSTANT_OFFERS` flag)
   - Review `apps/api/backend/src/services/growth/instantOfferService.ts` (241 LOC)
   - Verify offer creation, acceptance, and AuditEvent writing
   - Wire to employer review surface
   - Enable flag for PILOT tier

3. **Enable REFERRALS_V2** (`REFERRALS_V2` flag)
   - Review `apps/api/backend/src/services/referral/referralService.ts` (335 LOC)
   - Verify referral creation, tracking, and attribution
   - Ensure `/holder/referrals` page renders correctly
   - Enable flag for INTERNAL tier

4. **Enable ASK_VITALCV** (`ASK_VITALCV` flag)
   - Review `/ask` route and supporting services
   - Verify AI search queries against trust graph data
   - Enable flag for PILOT tier
   - Ensure queries respect source coverage states (don't claim data from gated sources)

5. **Verification:** Run full test suite. Each feature must have at least one integration test proving the happy path works.

---

## WAVE 3: CONTINUOUS MONITORING — PRODUCTION WIRE (Priority: HIGH)
**Branch:** `feature/continuous-monitoring-production`
**Effort:** L (3-5 days)
**Why billion-dollar:** Creates subscription revenue and makes VitalCV impossible to turn off.

### Tasks:
1. **Wire NursysENotifyAdapter to production event loop**
   - File: Find existing adapter in `packages/psv/` or `packages/psv-adapters/`
   - Connect to MonitoringSubscription model
   - Implement poll + webhook dual-mode ingestion
   - Events to handle: LicenseUpdated, LicenseExpired, SanctionDetected, BoardExpired

2. **Wire OIG/LEIE continuous checker**
   - Currently runs at ingestion time only
   - Add scheduled check (daily cron or background job)
   - On status change: update trust state, fire alert, write AuditEvent

3. **Build alerting pipeline**
   - Use existing `trustAlerts` service
   - Alert types: LICENSE_EXPIRED, SANCTION_DETECTED, ENROLLMENT_LAPSED, SCORE_DEGRADED
   - Delivery: In-app notification + email (use existing notification infrastructure)
   - Employer-facing: Alert on any monitored clinician state change

4. **Connect to CRS recomputation**
   - When monitoring detects change → recompute CRS for affected entity
   - If CRS drops below threshold → flag on passport, alert employer

5. **Add monitoring status to passport UI**
   - `apps/web/components/passport/PassportWallet.tsx`
   - Show "Continuously Monitored" badge with last-check timestamp
   - Show monitoring coverage: which sources are actively monitored

6. **Verification:** Simulate a license expiration event. Verify: trust state updates, CRS recomputes, alert fires, employer sees change, AuditEvent written.

---

## WAVE 4: DECISION CAPSULES — QUERY API (Priority: HIGH)
**Branch:** `feature/decision-capsules-api`
**Effort:** M (2-3 days)
**Why billion-dollar:** Institutional memory that no competitor has. "Show me every clinician this hospital accepted and their current trust state."

### Tasks:
1. **Verify Prisma model exists** for DecisionCapsule
   - Must contain: subject_npi, verifier_org, credential_snapshot (JSON), trust_state_snapshot (JSON), artifact_hash, decision (ACCEPT/REJECT/DEFER), timestamp, reviewer_id

2. **Wire capsuleEngine to live trust state**
   - On employer acceptance: capture current trust state snapshot + credential state
   - Compute artifact_hash (SHA-256 of snapshot)
   - Write capsule atomically with acceptance AuditEvent

3. **Build query API**
   ```
   GET /api/decision-capsules?org=:orgId — all capsules for an org
   GET /api/decision-capsules?npi=:npi — all capsules for a clinician
   GET /api/decision-capsules/:id — single capsule with full snapshot
   GET /api/decision-capsules/:id/current-state — capsule + current trust state delta
   ```

4. **Add revocation impact tracking**
   - When a credential is revoked, find all capsules that referenced it
   - Mark affected capsules with `impacted_by_revocation: true`
   - Fire alert to orgs that accepted based on now-revoked credential

5. **Verification:** Create a capsule via employer acceptance. Query it back. Simulate a revocation. Verify capsule is flagged. Verify alert fires.

---

## WAVE 5: APPLY WITH VITALCV — EMBED SDK (Priority: HIGH)
**Branch:** `feature/apply-embed-v2`
**Effort:** L (3-5 days)
**Why billion-dollar:** The Stripe Checkout of credentialing. Every ATS embed is a distribution node.

### Tasks:
1. **Standardize embed-sdk output payload**
   - `packages/embed-sdk/`
   - Define canonical ApplyPayload: { npi, passport_url, crs_score, trust_band, credential_summary[], freshness_snapshot, share_token }
   - JSON Schema + TypeScript types

2. **Build embeddable widget**
   - `<script src="https://embed.vitalcv.com/apply.js"></script>`
   - `<div id="vitalcv-apply" data-job-id="..." data-employer-id="..."></div>`
   - Widget flow: Clinician clicks → authenticates → selects credentials to share → employer receives payload
   - Must work in iframe (cross-origin safe)

3. **Build employer webhook receiver**
   - When clinician applies via widget: POST webhook to employer's configured URL
   - Payload: ApplyPayload + application metadata
   - Retry logic (3 attempts, exponential backoff)
   - Webhook signature verification (HMAC-SHA256)

4. **Build ATS integration adapters (scaffolding)**
   - Create adapter interface: `interface ATSAdapter { submitApplication(payload: ApplyPayload): Promise<ATSResponse> }`
   - Scaffold adapters for: Workday, Greenhouse, iCIMS, Lever (implementation TBD, but interface must be clean)

5. **Add embed analytics**
   - Track: widget loads, authentication starts, applications submitted, employer views
   - Write to SEAL advisory pipeline (append-only)

6. **Verification:** Embed widget on a test page. Complete apply flow. Verify webhook fires with correct payload. Verify AuditEvent written.

---

## WAVE 6: TRUST SIMULATION ENGINE — PRODUCTION WIRE (Priority: MEDIUM)
**Branch:** `feature/trust-simulation-production`
**Effort:** L (3-5 days)
**Why billion-dollar:** Enterprise sales weapon. "What happens if your top surgeon's license is revoked?"

### Tasks:
1. **Connect simulationMachine to real trust state data**
   - Currently uses mock data
   - Wire to: passportService, readinessEngine, trust state resolver
   - Input: Select credential to simulate revocation of
   - Output: Affected entities, privilege cascade, CRS impact

2. **Build revenue impact model**
   - Input: Average revenue per clinician per day (configurable per specialty)
   - Calculate: Days until replacement × daily revenue = financial exposure
   - Add to simulation output

3. **Build staffing gap analysis**
   - Input: Org's current clinician roster from decision capsules
   - Calculate: If clinician X is removed, which shifts/locations are uncovered
   - Output: Gap count, severity (critical/moderate/low), suggested actions

4. **Build simulation API**
   ```
   POST /api/simulation/revocation — simulate a credential revocation
   POST /api/simulation/expiration — simulate a credential expiration
   GET  /api/simulation/:id/results — get simulation results
   ```

5. **Build simulation UI**
   - Add to employer/verifier workspace
   - Select clinician → Select credential → Run simulation → View blast radius
   - Visualize cascade as tree/graph

6. **Verification:** Run simulation for a real clinician. Verify cascade computation. Verify revenue model outputs reasonable numbers.

---

## WAVE 7: MOBILE WALLET — INTEGRATION + POLISH (Priority: MEDIUM)
**Branch:** `feature/mobile-wallet-integration`
**Effort:** L (5-7 days)
**Why billion-dollar:** VitalCV in every clinician's pocket. Offline presentation = works everywhere.

### Tasks:
1. **Integration test the existing mobile code**
   - `apps/mobile/` has 25+ components. Test each screen: wallet, present, scan, settings
   - Verify LocalCredentialStore stores/retrieves credentials correctly
   - Verify OfflinePresentationEngine generates valid VP JWTs
   - Verify OID4VPHandler parses openid4vp:// URIs

2. **Wire WalletSyncService to production API**
   - `sync(npi)` should fetch from `GET /api/passport/npi/:npi`
   - Store credentials locally in expo-secure-store
   - Handle offline gracefully (isApiReachable with 3s timeout)

3. **Implement push notifications**
   - NotificationService for credential expiry alerts
   - Schedule notifications: 30 days, 7 days, 1 day before expiry
   - Handle notification permissions gracefully

4. **Build QR presentation flow**
   - Clinician selects credentials → biometric gate → generate QR code
   - QR contains VP JWT (compact, offline-verifiable)
   - Verifier scans → instant verification result

5. **App Store preparation**
   - App icon, splash screen, app store screenshots
   - Privacy policy URL, terms of service URL
   - TestFlight / Expo EAS build configuration

6. **Verification:** Full end-to-end: Clinician syncs credentials → goes offline → presents QR → verifier scans → verification succeeds.

---

## WAVE 8: RESIDENT/FELLOW CAPTURE WEDGE (Priority: MEDIUM)
**Branch:** `feature/resident-fellow-wedge`
**Effort:** M (2-3 days)
**Why billion-dollar:** Capture clinicians at career start. They carry VitalCV for 30+ years.

### Tasks:
1. **Build GME-aware onboarding variant**
   - Detect PGY level from NPPES taxonomy or user input
   - Show residency-specific readiness: "Your training program, your licenses, your next steps"
   - Highlight: "Build your verified profile before fellowship applications"

2. **Build multi-site credentialing flow**
   - Resident enters NPI → VitalCV builds passport
   - Resident shares to main hospital + N affiliates simultaneously
   - Each site receives the same verified bundle
   - Track acceptance per site

3. **Build graduation trigger**
   - When resident completes training (detected via NPPES taxonomy change or manual attestation)
   - Auto-update profile: PGY → attending
   - Prompt to claim board certification
   - Notify connected employers of status change

4. **Partner with GME offices**
   - Landing page for GME program directors: `/partners/gme`
   - Value prop: "Your residents credentialed at all affiliate sites in 1 week, not 2 months"
   - Bulk onboarding: CSV upload of resident NPIs

5. **Verification:** Onboard a PGY-3 resident. Share to 3 simulated affiliate hospitals. Verify each receives correct passport.

---

## WAVE 9: EMPLOYER CAPACITY DASHBOARD (Priority: MEDIUM)
**Branch:** `feature/employer-capacity-dashboard`
**Effort:** M (2-3 days)
**Why billion-dollar:** "For the first time employers can measure capacity of their clinic" — the enterprise sales metric.

### Tasks:
1. **Define capacity metrics**
   - Starts Enabled Per Quarter (SEPQ): How many clinicians completed onboarding
   - ISV (Interview-to-Start Velocity): 28-day rolling median, days from interview to start
   - Credential Pipeline: How many clinicians in each stage (applied → reviewing → accepted → started)
   - Blocker Distribution: What's blocking starts (missing license, pending OIG, etc.)

2. **Build capacity API**
   ```
   GET /api/capacity/:orgId — org capacity summary
   GET /api/capacity/:orgId/pipeline — pipeline by stage
   GET /api/capacity/:orgId/blockers — blocker breakdown
   GET /api/capacity/:orgId/isv — ISV trend (28-day rolling)
   ```

3. **Build capacity dashboard UI**
   - Add to employer workspace (or new `/employers/capacity` route)
   - Show: SEPQ trend, ISV trend, pipeline funnel, top blockers
   - Comparison: "Your ISV: 14 days | Industry average: 90 days"

4. **Wire to SEAL for outcome tracking**
   - When a clinician starts: record start_outcome_event
   - When a blocker is resolved: record blocker_resolution_event
   - Feed into advisory pipeline for pattern detection

5. **Verification:** Create 10 test entities at various pipeline stages. Verify dashboard shows correct counts, ISV computes correctly, blockers categorize properly.

---

## WAVE 10: ATS DEEP INTEGRATION (Priority: LOWER — scaffolding now, implementation later)
**Branch:** `feature/ats-integration-scaffolding`
**Effort:** M (2 days for scaffolding)
**Why billion-dollar:** ATS integration = VitalCV becomes part of every hospital's hiring workflow.

### Tasks:
1. **Define integration interface**
   ```typescript
   interface ATSIntegration {
     name: string; // 'workday' | 'greenhouse' | 'icims' | 'lever'
     pushCandidate(payload: ApplyPayload): Promise<{ candidateId: string; status: string }>;
     pullStatus(candidateId: string): Promise<{ stage: string; updatedAt: Date }>;
     webhookHandler(event: ATSWebhookEvent): Promise<void>;
   }
   ```

2. **Build integration registry**
   - `apps/api/backend/src/services/integrations/atsRegistry.ts`
   - Register/deregister ATS adapters
   - Configuration: API keys, webhook URLs, field mapping per org

3. **Scaffold Workday adapter** (largest ATS in healthcare)
   - Create `apps/api/backend/src/services/integrations/workday/`
   - Stub pushCandidate, pullStatus, webhookHandler
   - Document required Workday API scopes and configuration

4. **Build integration admin UI**
   - `/employers/settings/integrations` page
   - Show available integrations, connection status, configuration
   - Test connection button

5. **Verification:** Scaffold compiles. Registry loads all adapters. Admin UI renders with stubs showing "Coming Soon" for each ATS.

---

## WAVE 11: CROSS-SOURCE DIVERGENCE DETECTION — PRODUCTIZE (Priority: MEDIUM)
**Branch:** `feature/divergence-detection-productize`
**Effort:** M (2-3 days)
**Why billion-dollar:** The signal that no single-source tool can provide. When NPPES says one thing and the state board says another — that's gold.

### Tasks:
1. **Implement the 7 divergence rules**
   - Rule 1: Name mismatch (NPPES vs state board vs PECOS)
   - Rule 2: DOB conflict
   - Rule 3: License status discrepancy (state says active, FSMB says inactive)
   - Rule 4: Specialty mismatch (taxonomy code vs board cert vs PECOS enrollment)
   - Rule 5: Enrollment contradiction (PECOS says enrolled, facility says not credentialed)
   - Rule 6: Address divergence (practice location conflicts)
   - Rule 7: Credential date conflicts (issued date mismatches across sources)

2. **Implement 3 severity tiers**
   - HIGH (>15 point CRS penalty): License status, sanctions, identity conflicts
   - MEDIUM (5-15 point penalty): Specialty, enrollment contradictions
   - LOW (<5 point penalty): Address, minor date discrepancies

3. **Build divergence API**
   ```
   GET /api/trust/divergence/:npi — all active divergences for a clinician
   GET /api/trust/divergence/:npi/history — divergence history with resolution
   ```

4. **Build divergence UI**
   - On passport: Show divergence flags with severity badges
   - On employer review: Highlight divergences that affect hiring decision
   - On clinician profile: Show "action needed" for resolvable divergences

5. **Wire to CRS computation**
   - Active divergences apply score penalties per severity tier
   - Resolved divergences remove penalties
   - Divergence resolution is an auditable action

6. **Verification:** Create a test entity with intentional name mismatch between NPPES and state board. Verify divergence detected, severity assigned, CRS penalized, UI shows flag.

---

## WAVE 12: RESEARCH IDENTITY LAYER (Priority: LOWER)
**Branch:** `feature/research-identity-layer`
**Effort:** L (3-5 days)
**Why billion-dollar:** AMC sales wedge. Academic medical centers need publication records integrated with credentialing.

### Tasks:
1. **Build PubMed adapter**
   - Query PubMed API by author name + affiliation
   - Return: publication count, h-index proxy, recent publications, clinical trial participation
   - Map to entity via NPI + name matching

2. **Build ORCID integration**
   - OAuth flow for clinician to link ORCID
   - Pull: publications, grants, affiliations, peer review activity
   - Store as supplementary identity evidence

3. **Build ClinicalTrials.gov adapter**
   - Query by PI name / NPI
   - Return: active trials, role (PI, sub-I, coordinator), trial status

4. **Add research dimension to CRS**
   - New dimension: Research Activity Score (0-10)
   - Weight: configurable per vertical (higher weight for AMCs)
   - Inputs: publication count, trial participation, ORCID verification

5. **Build research profile section**
   - On passport: "Research & Publications" section
   - Show: publication count, recent papers, active trials, ORCID badge
   - Selective disclosure: clinician controls what's shown

6. **Verification:** Look up a real physician NPI with known publications. Verify PubMed returns data, maps correctly, shows on passport.

---

## EXECUTION RULES FOR ALL WAVES

1. **Branch discipline:** Each wave gets its own branch off `main`. Never cross-pollinate wave branches.
2. **Audit-first:** Every mutating endpoint must write an AuditEvent before returning 2xx.
3. **Feature flags:** New features default to disabled. Enable per tier (INTERNAL → PILOT → PUBLIC).
4. **Test coverage:** Each wave must include at least integration tests for happy path + one failure case.
5. **Copy discipline:** Never use prohibited terms (see CLAUDE.md §16). Run copy check before merge.
6. **No Prisma migrations without approval:** If schema changes are needed, write SQL plan to `docs/migrations/` and get explicit approval.
7. **Build verification:** Every wave ends with `pnpm --filter @vitalcv/api build && pnpm --filter web build && pnpm lint && pnpm tsc --noEmit` — zero errors.
8. **ANTIGRAVITY test:** For every new UI surface, ask: "If I remove this, does the user hit a blocked state?" If no, redesign or remove.

---

## WAVE PRIORITY SEQUENCE

```
WAVE 1: Release Gate Clearance          ← DO FIRST (2 hours)
WAVE 2: Activate Flag-Gated Features    ← DO SECOND (1 day) — instant value from existing code
WAVE 3: Continuous Monitoring            ← subscription revenue + lock-in
WAVE 4: Decision Capsules Query API      ← institutional memory moat
WAVE 5: Apply Embed SDK                  ← distribution flywheel
WAVE 6: Trust Simulation Engine          ← enterprise sales weapon
WAVE 7: Mobile Wallet Integration        ← VitalCV in every pocket
WAVE 8: Resident/Fellow Wedge            ← lifetime value capture
WAVE 9: Employer Capacity Dashboard      ← enterprise sales metric
WAVE 10: ATS Integration Scaffolding     ← workflow embedding
WAVE 11: Divergence Detection            ← data moat
WAVE 12: Research Identity Layer         ← AMC vertical expansion
```

**Total estimated effort: 4-6 weeks of focused implementation.**
**Expected outcome: VitalCV goes from "demo-ready" to "pilot-deployable infrastructure" across all 7 platform pillars.**

---

*Generated 2026-04-12 from exhaustive search of: VitalCV monorepo (docs/, .claude/skills/, apps/, packages/, services/), Dropbox (CLINICIAN-ADOPTION-AUDIT, UI/UX-Polish-Prompt-Pack), christoler/vitalcv-wallet (.vitalcv/ strategy docs, docs/ specs), Downloads (CRED0 Founder Guidebook, Repo-Grounded PRD, High-Impact Use Cases, YC Flashcards, CRS implementation), Google Drive (strategic documents), Notion (VITALCV hub + 6 attached PDFs).*

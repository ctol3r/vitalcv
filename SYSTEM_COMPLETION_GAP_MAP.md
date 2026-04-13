# SYSTEM COMPLETION GAP MAP
**Phase 1: Subsystem Audit**
*Date: 2026-04-12*

This gap map assesses the 9 core subsystems of the VitalCV platform against the 100% completion threshold for the System Completion wave. It maps current physical codebase state (loc, modules, flags), exact missing gaps, blockers, and inter-subsystem dependencies.

---

## 1. Core Wedge (NPI → Readiness → Passport)
- **Current State:** 
  - Integration adapters for NPPES, OIG/LEIE, PECOS, and State Boards are present (`packages/psv`, `packages/trust-state`).
  - Core models and credential ingestion pipeline exist.
  - Review client has a 4-layer freshness model.
- **Exact Missing Pieces:** 
  - Cross-source divergence resolution logic (handling conflicting states between NPPES and state boards).
  - Dual-entity identity mapping (Person vs. Organization Workspace) fully merged to main.
- **Blockers to 100%:** 
  - Multi-source state collision resolution logic must be production-hardened.
- **Dependencies:** 
  - Trust / audit / explainability (for rendering the source truth).
  - Ops / founder control plane (for manual operator override on divergences).

## 2. Clinician Usability
- **Current State:** 
  - Web flows exist: `/clinician`, `/passport`, `/apply`.
  - Expo mobile code (`apps/mobile`) includes 25+ components, `LocalCredentialStore`, `OID4VPHandler`, and `OfflinePresentationEngine`.
- **Exact Missing Pieces:** 
  - Seamless resident/fellow onboarding flow (GME integrations).
  - E2E testing for the mobile wallet credential sync.
- **Blockers to 100%:** 
  - Integration testing and polish on `apps/mobile` preventing stores release.
- **Dependencies:** 
  - Core wedge (baseline NPI auto-fill data).
  - Developer / API (issuer API for sending credentials to the wallet).

## 3. Employer Usability
- **Current State:** 
  - Web flows exist: `/employer`, `/review`, `/compare`.
  - Instant offer service exists (241 LOC) but is behind the `INSTANT_OFFERS` pilot flag.
- **Exact Missing Pieces:** 
  - Continuous monitoring dashboard alerting CTOs to live credential decay/revocation.
  - Ask VitalCV (AI natural language search against trust graph) is frameworked but disabled.
- **Blockers to 100%:** 
  - Finalizing the trust cascade simulation engine to power the monitoring dashboard.
- **Dependencies:** 
  - Trust / audit / explainability (needs the cascade blast radius data).
  - Snapshot reuse (employer ATS widget).

## 4. Trust / Audit / Explainability
- **Current State:** 
  - 9-state source coverage transparency (`packages/trust-state/sourceCoverage.ts`).
  - SourceHealthPanel and PilotDiagnosticsPanel exist.
  - Blockchain substrate architecture exists for anchoring, but zero PHI rules apply.
- **Exact Missing Pieces:** 
  - Trust Simulation Engine (revenue impact models and revocation blast radius) is built but disconnected from live trust states.
  - Immutable decision capsules (capsuleEngine built but needs query API).
- **Blockers to 100%:** 
  - Wiring `simulationMachine` and `capsuleEngine` to the live Postgres state tree.
- **Dependencies:** 
  - Employer usability (this is the core enterprise value prop shown to CTOs).

## 5. Matcha / Job Loop
- **Current State:** 
  - MATCHA engine is built (2,370 LOC) with scoring logic.
  - Flag-gated behind `MATCHA_V2`.
- **Exact Missing Pieces:** 
  - Connection to live hospital capacity data or API feeds.
  - Clinic capacity score calculation logic connected to real active roster feeds.
- **Blockers to 100%:** 
  - Lack of live inbound employer capacity data streams.
- **Dependencies:** 
  - Employer usability (Employers must submit/feed capacity data first).

## 6. Snapshot Reuse / Network Effects
- **Current State:** 
  - Embed Widget SDK package (`embed-sdk`) exists.
  - Application model and apply flow (Wave 229) built.
- **Exact Missing Pieces:** 
  - Pre-built ATS output payloads/integrations (Workday, Greenhouse, Lever).
- **Blockers to 100%:** 
  - Payload standardization for legacy applicant tracking systems.
- **Dependencies:** 
  - Developer / API (needs stable webhook and SDK surfaces).
  - Clinician usability (the "Apply with VitalCV" button UX).

## 7. Marketing / Conversion
- **Current State:** 
  - Routes exist: `/pricing`, `/about`, `/partners`, `/investors`.
  - Currently undergoing truth-purge to align with codebase reality.
- **Exact Missing Pieces:** 
  - Strict alignment of landing page copy to "Time To Start" (TTS).
  - Removal of overpromising features (SOC2 badges, zero-trust ledger copy) per Wave 0 release gate.
- **Blockers to 100%:** 
  - P0 release gates on `Hero.tsx` and `HomeSections.tsx` (e.g., changing "ledger" to "audit trail", fixing CTA routing).
- **Dependencies:** 
  - Ops / founder control plane (tracking demo conversion and onboarding funnels).

## 8. Developer / API
- **Current State:** 
  - `issuer-api` and `verifier-api` apps exist.
  - OID4VCI and OID4VP standard endpoints built.
  - `vc-formats-csdjwt` package exists.
- **Exact Missing Pieces:** 
  - Production webhook dispatchers.
  - Public-facing developer documentation and API key management portal.
- **Blockers to 100%:** 
  - Freezing the SD-JWT selective disclosure formats.
- **Dependencies:** 
  - Clinician usability (mobile wallet reads from these standards).
  - Snapshot reuse (embed widget relies on the verifier-api).

## 9. Ops / Founder Control Plane
- **Current State:** 
  - `/internal/pilot-ops` routes exist.
  - SourceHealthPanel is active.
- **Exact Missing Pieces:** 
  - Operator remediation UI hints for stalled verifications.
  - SEAL Advisory Pipeline integration (offline event tables for `blocker_resolution_events` etc.) to train AI operator models.
- **Blockers to 100%:** 
  - Need to implement Wave 16-1 tasks (remediation hints on PilotDiagnosticsPanel).
- **Dependencies:** 
  - Trust / audit / explainability (needs visibility to know what requires remediation).
  - Core wedge (requires manual override tools for PSV fetching).

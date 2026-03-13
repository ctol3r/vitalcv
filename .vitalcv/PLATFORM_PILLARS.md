# PLATFORM_PILLARS.md — The 7 Features That Make VitalCV a $10B Platform
_Strategic directive received: 2026-03-12 20:24 PDT_

## Rule
Every feature built must strengthen one of these layers:
**Identity | Trust | Decision Memory | Monitoring | Distribution | Simulation | Liquidity**

If a feature does not strengthen these, deprioritize it.

## Pillars

### 1. Clinician Passport (Portable Trust Identity)
- **Layer:** Identity
- **Structure:** NPI + DID + Wallet = Clinician Passport
- **Surface:** vitalcv.com/p/{npi}
- **Status:** 🟢 Strong foundation
- **Built:** /p/:npi profile, WalletPassport, selective disclosure (SD-JWT), Trust State Engine (L0-L3 + readiness_score), DID registry, QR share, HAIP compliance
- **Gaps:** Monitoring status indicators on passport, credential artifact display from PSV adapters

### 2. Decision Capsules (Institutional Memory)
- **Layer:** Decision Memory
- **Structure:** subject_npi + verifier_org + credential_snapshot + trust_state_snapshot + artifact_hash
- **Status:** 🟡 Foundation exists
- **Built:** DecisionCapsule Prisma model, capsuleEngine (credential snapshot + hash), revocationCascade, blast radius computation
- **Gaps:** Not wired to live Trust State Engine, no institutional memory query API, no impact tracking from revocation events
- **Wave 244 target**

### 3. Global Trust Graph
- **Layer:** Trust
- **Structure:** Nodes (clinicians, credentials, issuers, hospitals, payers) + Edges (ISSUED_BY, VERIFIED_BY, DEPENDS_ON, etc.)
- **Status:** 🟡 Partial
- **Built:** trustGraph service, GlobalTrustMap canvas, federation nodes (Nursys, CAQH), knowledge graph (AKG)
- **Gaps:** Graph expansion API, dynamic edge streaming, GPU rendering, GET /api/knowledge/:nodeId

### 4. Continuous Credential Monitoring
- **Layer:** Monitoring
- **Structure:** Credential monitored forever — events: LicenseUpdated, LicenseExpired, SanctionDetected, BoardExpired, NPDBEvent
- **Status:** 🟡 Foundation
- **Built:** NursysENotifyAdapter (poll + webhook), MonitoringSubscription, trustAlerts service, continuousMonitor, OIG/LEIE checker
- **Gaps:** Not production-wired to real data sources, no NPDB event ingestion, no board cert monitoring
- **Wave 245 target (Async Trust Engine)**

### 5. Apply with VitalCV (Distribution Wedge)
- **Layer:** Distribution
- **Structure:** Embeddable widget → clinician shares trust passport → employer receives verified credential bundle
- **Status:** 🟡 Scaffold
- **Built:** embed-sdk package, Application model + flow (Wave 229), explore marketplace, verifier inbox (Wave 234)
- **Gaps:** ATS integrations (Workday, Greenhouse, iCIMS, Lever), output payload standardization, widget embed UX
- **Wave 246 target**

### 6. Trust Simulation Engine
- **Layer:** Simulation
- **Structure:** Hospital simulates credential revocation → affected hospitals, privileges, revenue impact, staffing gaps
- **Status:** 🟡 Partial
- **Built:** simulationMachine (state machine), revocation blast radius page, cascade computation, cascadeEngine
- **Gaps:** Not connected to real trust state data, no revenue impact model, no staffing gap analysis

### 7. Credential Liquidity Network
- **Layer:** Liquidity
- **Structure:** Credential wallet → portable proof → instant eligibility → hospital search by specialty/location/trust level
- **Status:** 🟢 Emerging
- **Built:** MATCHA live scoring (Wave 239), capacity score (Wave 240), credential enrichment loop, CandidateCredential pipeline, explore board
- **Gaps:** Hospital-side search (reverse marketplace), credential readiness network UI, instant eligibility determination

## Platform Outcome
VitalCV = The Visa network for clinician trust.
- Nodes: Clinicians, Issuers, Hospitals, Payers
- Edges: Credential issuance, Verification, Decision history, Monitoring events

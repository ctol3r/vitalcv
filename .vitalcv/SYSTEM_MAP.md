# SYSTEM_MAP.md — VitalCV Full System Architecture
_Last updated: 2026-03-12._

**Principle: Every visually impressive feature must be operationally useful.**

---

## Layer 1 — Identity Layer

**Purpose:** Establish who a clinician is, unambiguously.

| Component | Location | Status |
|---|---|---|
| NPI lookup (NPPES live) | `services/providers/`, `routes/providers.ts` | ✅ Live |
| NpiDidBinding (DID registration) | `services/identity/npiDidBinding.ts` | ✅ Built |
| DID Registry (did:vitalcv) | `services/credentials/didRegistry.ts` | ✅ Built |
| Clinician Identity model | `ClinicianIdentity` Prisma model | ✅ Schema |
| PersonProfile (workspace) | `PersonProfile` Prisma model | ✅ Schema |
| WebAuthn / Passkey | `routes/webauthn.ts`, `BiometricPrompt` | 🔶 Stub |

**Gap:** Doximity, LinkedIn, PubMed enrichment not yet integrated. Clinical identity is NPI-only today.

---

## Layer 2 — Evidence Layer (PSV)

**Purpose:** Gather verified evidence from authoritative primary sources.

| Source | Adapter | Status |
|---|---|---|
| NPPES (NPI registry) | Live HTTP | ✅ Live |
| Nursys (nursing licenses) | `psv-adapters/adapters/nursysAdapter.ts` | ✅ Built |
| BreEZe / DCA (CA medical) | `psv-adapters/adapters/dcaBreezeAdapter.ts` | ✅ Built |
| FSMB (Federation State Medical Boards) | `psv-adapters/adapters/fsmbAdapter.ts` | ✅ Built |
| NPDB | `psvAdapters.ts` route | 🔶 Partial |
| DEA | PSV pipeline | 🔶 Stub |
| OIG/LEIE | PSV pipeline | 🔶 Stub |
| ABMS / Board certs | Not yet | ❌ Planned |
| PubMed | Not yet | ❌ Planned |
| CMS provider data | Not yet | ❌ Planned |

**PSV Infrastructure:**
- `psvOrchestrator.ts` — orchestrates multi-source verification
- `artifactNormalizer.ts` — normalizes results to schema
- `psvArtifactBuilder.ts` — constructs VerificationArtifact records
- `pollingRunner.ts` — async polling for slow sources

---

## Layer 3 — Trust Computation Layer

**Purpose:** Transform raw evidence into verified, signed trust artifacts.

| Component | Location | Status |
|---|---|---|
| Credential issuance (ES256 JWS) | `credentialIssuer.ts` | ✅ Built |
| SD-JWT selective disclosure | `sd-jwt/` services | ✅ Built |
| W3C VC credential model | `credentialModel.ts` | ✅ Built |
| OID4VCI issuance | `oid4vci/` | ✅ Built |
| OID4VP presentation | `oid4vp/` | ✅ Built |
| Revocation registry | `revocationService.ts` | ✅ Built |
| Trust ledger / audit trail | `trustSubstrate`, `auditLedger` | ✅ Built |
| HAIP profile compliance | `conformance/` | ✅ Built |
| Decision Capsule Engine | `decision/capsuleEngine.ts` | ✅ Built |
| Trust State Machine | `walletMachine`, `verifierMachine` | ✅ Built |
| Continuous monitoring | `monitoringEngine.ts`, `daemon/` | ✅ Built |

---

## Layer 4 — User Experience Layer

**Purpose:** Make trust portable, browsable, and actionable for clinicians and employers.

| Surface | Route | Status |
|---|---|---|
| Homepage (antigravity, dark navy) | `/` | ✅ Live |
| Demo flow | `/demo` | ✅ Live |
| Clinician Trust Passport | `/p/:npi` | ✅ Live |
| Clinician holder home | `/holder/home` | ✅ Live |
| Explore opportunities | `/explore` | ✅ Live |
| Apply modal (Wave 229) | Within `/explore` | ✅ Live |
| Verifier home | `/verifier/home` | ✅ Live |
| Verifier inbox (live) | `/verifier/inbox` | ✅ Live (Wave 234) |
| Document Intelligence | `/documents` | ✅ Live (Wave 237) |
| Employer onboarding | `/verifier/company` | ✅ Built |
| Post opportunity | `/verifier/home` | ✅ Built |
| Prequalify flow | Modal (Wave 182) | ✅ Built |
| Ask VitalCV (AI) | `/ask` (flag off) | 🔶 Flag-gated |
| Investors page | `/investors` | ✅ Live |
| Partners page | `/partners` | ✅ Live |
| Developer docs | `/docs` | ✅ Live |

---

## Layer 5 — Intelligence Layer

**Purpose:** Turn verified data into career intelligence and capacity insight.

| Component | Status | Notes |
|---|---|---|
| MATCHA (CRS evaluator + gap analyzer) | ✅ Built (Wave 51) | Routes at `/matcha` |
| Ask VitalCV (AI natural language) | 🔶 Flag-gated | Wave 185 |
| Knowledge Graph (AKG) | ✅ Built | KnowledgeNode, AuthorityEdge |
| Network reputation engine | ✅ Built | `reputationEngine.ts` |
| Opportunity matching | 🔶 Basic (Wave 227-228) | Not AI-powered yet |
| **Clinic capacity modeling** | ❌ Not built | **Highest enterprise leverage** |
| PubMed researcher profile | ❌ Not built | Part of clinical identity |
| Career path modeling | ❌ Not built | Critical for MATCHA v2 |

---

## Layer 6 — Network Effects Layer

**Purpose:** Create moat through data density, federation, and distribution.

| Component | Status | Notes |
|---|---|---|
| Federation (Nursys, CAQH seeded) | ✅ Built | Wave 102 |
| External network discovery | ✅ Built | `federationDiscovery.ts` |
| Global Trust Map | ✅ Built | Canvas visualization |
| Free job board (Wave 227) | ✅ Built | All specialties |
| Specialty job board aggregation | ❌ Not built | Christopher's Sutter insight |
| Employer capacity metric | ❌ Not built | Enterprise sales wedge |
| Clinician viral loop (passport share) | ✅ Built | QR + Wallet passes |
| Ambassador program | 🔶 Partial | `ambassador` routes |

---

## Critical Flows (must never be broken)

1. **NPI → Trust Passport** (demo-critical): `/demo` → NPI input → PSV → graph → decision
2. **Apply with VitalCV**: `/explore` → opportunity card → ApplyModal → submit
3. **Employer post + review**: `/verifier/home` → post opp → `/verifier/inbox` (needs live data)
4. **Clinician passport share**: `/p/:npi` → QR / wallet pass
5. **Auth flow**: sign-in → role resolution → persona routing

---

## Known Weaknesses (as of 2026-03-12)

| Weakness | Impact | Priority | Status |
|---|---|---|---|
| ~~Verifier inbox seeded~~ | ~~Marketplace broken~~ | ~~HIGH~~ | ✅ Fixed Wave 234 |
| ~~No credential upload~~ | ~~No inputs to system~~ | ~~HIGH~~ | ✅ Fixed Wave 237 |
| Document store in-memory | Data lost on restart | HIGH | 🔄 Wave 237h |
| MATCHA uses mock data | Intelligence layer fake | HIGH | ⏳ Wave 239 |
| Clinical identity NPI-only | Graph is thin | MEDIUM | Phase 2 |
| Capacity modeling missing | No enterprise wedge | HIGH | Wave 240 (gated) |
| PubMed / Doximity missing | Identity graph incomplete | MEDIUM | Phase 2 |
| Mobile app not built | "Not portable" | HIGH | Phase 4 |
| Ask VitalCV flag-gated | AI layer invisible | MEDIUM | Phase 3 |

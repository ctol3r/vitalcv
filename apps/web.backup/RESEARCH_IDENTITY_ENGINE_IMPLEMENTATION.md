# 🔬 Global Research Identity Engine - Implementation Status

**Version**: v1.0
**Status**: Phase 1 Core Complete (6/8 tasks), Phase 2-5 Pending
**Last Updated**: 2025-01-XX

---

## 📋 Overview

The Global Research Identity Engine extends VitalCV to serve as the universal professional identity for both clinicians AND researchers. This system integrates academic output, grants, IRB studies, and research collaboration networks.

---

## ✅ PHASE 1: Research Identity Core (6/8 Tasks Complete)

### Completed Tasks

#### ✅ Task 1: ResearchIdentity Model & Schema
**File**: `vitalcv-backend/prisma/schema.prisma`

Added comprehensive Prisma models:
- `ResearchIdentity` - Core identity model with ORCID, eRA Commons, Scopus IDs
- `Publication` - Publication records with chain digests
- `ResearchGrant` - Federal, institutional, and industry grants
- `IRBStudy` - IRB study approvals with expiration tracking
- `ResearchEndorsement` - Supervisor endorsements for authorship
- `PIEligibilityAssessment` - PI eligibility assessments
- `PIComplianceAlert` - Compliance alerts for IRB/training expirations
- `StudyCredentialPacket` - Study credential packets
- `ResearchCollaboration` - Collaboration network data
- `ResearchNetworkStrength` - Network strength scores

**Key Features**:
- Chain-anchored receipts (`chainAnchorHash`)
- Comprehensive indexes for performance
- Institution affiliation tracking
- Citation metrics and H-index support

#### ✅ Task 2: Backend API Route `/research/identity/fetch`
**File**: `vitalcv-backend/src/routes/researchIdentity.ts`

Implemented:
- `GET /api/research/identity/fetch/:clinicianId` - Fetch research identity
- `POST /api/research/identity/create-or-update` - Create/update identity
- Error handling and validation
- JSON response format

#### ✅ Task 3: ORCID OAuth Linking Flow
**Files**:
- `vitalcv-backend/src/services/researchIdentityEngine.ts`
- `vitalcv-backend/src/routes/researchIdentity.ts`

Implemented:
- `POST /api/research/identity/orcid/link` - Link ORCID ID
- `GET /api/research/identity/orcid/oauth-url` - Get OAuth URL
- `POST /api/research/identity/orcid/oauth/callback` - Handle OAuth callback
- `GET /api/research/identity/orcid/profile/:orcidId` - Fetch ORCID profile
- Token exchange and access token management
- ORCID API integration (`https://pub.orcid.org/v3.0`)

**Environment Variables Required**:
```bash
ORCID_CLIENT_ID=your_client_id
ORCID_CLIENT_SECRET=your_client_secret
ORCID_REDIRECT_URI=http://localhost:3000/auth/orcid/callback
```

#### ✅ Task 4: Publication Ingestion Pipeline (PubMed API)
**Files**: `vitalcv-backend/src/services/researchIdentityEngine.ts`

Implemented:
- `searchPubMedPublications()` - Search PubMed by author name/affiliation
- `ingestPubMedPublications()` - Ingest publications to database
- `POST /api/research/identity/publications/ingest` - API endpoint
- XML parsing for PubMed responses
- Chain digest generation for each publication
- Duplicate detection (by PMID)

**PubMed API Integration**:
- Uses NCBI E-utilities API
- Searches by author name and affiliation
- Fetches full publication metadata
- Parses XML responses

#### ✅ Task 5: Publication Clustering
**Files**: `vitalcv-backend/src/services/researchIdentityEngine.ts`

Implemented:
- `clusterPublications()` - Merge multiple author identities
- `POST /api/research/identity/publications/cluster` - API endpoint
- Jaccard similarity algorithm for title matching
- Cluster detection and grouping

**Clustering Algorithm**:
- Similarity threshold: 0.8
- Groups publications by similar titles
- Prevents duplicate clusters

#### ✅ Task 6: Chain-Anchor ResearchIdentityReceipt
**Files**: `vitalcv-backend/src/services/researchIdentityEngine.ts`

Implemented:
- `anchorResearchIdentityReceipt()` - Anchor identity receipt to chain
- `POST /api/research/identity/anchor-receipt` - API endpoint
- SHA-256 digest generation
- Chain anchoring via `recordAuditOnChain()`
- Receipt includes: identity ID, publication count, grant count, IRB study count

### Pending Tasks

#### ⏳ Task 7: Deep Link Support (`vitalcv://research`)
**Status**: Pending
**Implementation Notes**:
- Requires frontend deep link handler
- Need to add route handler for `vitalcv://research` scheme
- Should integrate with mobile app deep linking

#### ⏳ Task 8: ResearchIdentityEngine Service Completion
**Status**: Partial
**Implementation Notes**:
- Core functions complete
- ORCID publication sync pending (marked as TODO)
- Enhanced error handling needed

---

## 🔄 PHASE 2: Academic Output & Portfolio (0/8 Tasks)

### Pending Tasks

1. **ResearchPortfolioView Component** - Main portfolio view
2. **Publications Section** - Display with journal, year, PMID, chain digest
3. **Grants Section** - Federal (NIH/NSF), institutional, industry
4. **IRB Section** - Study approvals, expiration dates, roles
5. **Research Timeline Visualization** - Timeline component
6. **Research Impact Metrics** - H-index, citations display
7. **Exportable Research CV PDF** - PDF generation
8. **Endorsement Layer** - Supervisor confirmation system

---

## 🔄 PHASE 3: PI Eligibility & Research Compliance Engine (0/8 Tasks)

### Pending Tasks

1. **PIEligibilityEngine Service** - Eligibility calculation engine
2. **Eligibility Rules** - IRB training, licensure, specialty match, DEA, credentialing
3. **PIEligibilityOutput** - Eligible/conditional/not eligible status
4. **Timeline-based Eligibility Forecast** - Predictive eligibility
5. **Compliance Alerts** - IRB expiration alerts
6. **Chain Anchor Receipts for IRB** - IRB approval receipts
7. **StudyCredentialPacket Builder** - Packet generation
8. **PI Readiness Summary** - Recruiter/hospital summary

---

## 🔄 PHASE 4: Research Graph & Collaborator Mapping (0/8 Tasks)

### Pending Tasks

1. **ResearchGraphView** - Force-directed graph visualization
2. **Graph Nodes** - Co-authors, institutions, study teams, grant collaborators
3. **Trust-weighted Edges** - Publication count, study history, endorsements
4. **Verified Contributor Tag** - Chain-linked verification
5. **Graph Interactions** - Zoom, cluster collapse, highlight
6. **AI Collaborator Finder** - "Find top collaborators for your specialty"
7. **Anomaly Detection** - Publication pattern anomalies
8. **Network Strength Score** - Composite network metric

---

## 🔄 PHASE 5: Integration with VitalCV Ecosystem (0/8 Tasks)

### Pending Tasks

1. **Research Tab in Profile** - "Academic Identity" tab
2. **Multi-Role Engine Integration** - Researcher mode
3. **Research-based Job Matching** - Faculty positions, research roles
4. **PI Eligibility in Privileging** - Facility privileging module
5. **Research Compliance Tasks** - To-Do Engine integration
6. **Trust Score Fusion** - Composite professional identity score
7. **Global Credential Passport** - Research institution onboarding
8. **Engine v1.0 Snapshot** - Final anchor

---

## 📁 File Structure

### Backend Files Created

```
vitalcv-backend/
├── prisma/
│   └── schema.prisma                    # Research identity models added
├── src/
│   ├── services/
│   │   └── researchIdentityEngine.ts    # Core research identity service
│   ├── routes/
│   │   └── researchIdentity.ts          # API routes
│   └── server.ts                        # Route registration added
```

### Frontend Files (To Be Created)

```
v0-vital-cv-frontend-mvp/
├── app/
│   └── (wallet)/
│       └── research/                    # Research portfolio routes (pending)
├── components/
│   └── research/                        # Research components (pending)
└── lib/
    └── api/
        └── research.ts                  # Research API client (pending)
```

---

## 🔌 API Endpoints

### Research Identity Core

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/research/identity/fetch/:clinicianId` | Fetch research identity |
| POST | `/api/research/identity/create-or-update` | Create/update identity |
| POST | `/api/research/identity/orcid/link` | Link ORCID ID |
| GET | `/api/research/identity/orcid/oauth-url` | Get ORCID OAuth URL |
| POST | `/api/research/identity/orcid/oauth/callback` | Handle OAuth callback |
| GET | `/api/research/identity/orcid/profile/:orcidId` | Fetch ORCID profile |
| POST | `/api/research/identity/publications/ingest` | Ingest PubMed publications |
| POST | `/api/research/identity/publications/cluster` | Cluster publications |
| POST | `/api/research/identity/anchor-receipt` | Anchor receipt to chain |

---

## 🧪 Testing Status

### Backend
- ✅ Database schema validated (no lint errors)
- ✅ Route registration verified
- ⏳ Unit tests pending
- ⏳ Integration tests pending

### Frontend
- ⏳ Components pending
- ⏳ E2E tests pending

---

## 🚀 Next Steps

### Immediate (Phase 1 Completion)
1. Implement deep link handler for `vitalcv://research`
2. Complete ORCID publication sync
3. Add comprehensive error handling

### Short-term (Phase 2)
1. Create ResearchPortfolioView component
2. Implement Publications, Grants, IRB sections
3. Add timeline visualization
4. Build Research CV PDF export

### Medium-term (Phases 3-4)
1. Build PI Eligibility Engine
2. Create Research Graph visualization
3. Implement collaboration mapping

### Long-term (Phase 5)
1. Integrate with VitalCV ecosystem
2. Add research-based job matching
3. Complete multi-role engine integration

---

## 📝 Notes

- **ORCID Integration**: Requires ORCID API credentials. Use sandbox environment for testing.
- **PubMed API**: Rate limits apply (3 requests/second). Implement caching for production.
- **Chain Anchoring**: Uses existing `recordAuditOnChain()` service with graceful fallback.
- **Deep Links**: Will require mobile app integration for full functionality.

---

## 🔗 Related Documentation

- Prisma Schema: `vitalcv-backend/prisma/schema.prisma`
- Service Implementation: `vitalcv-backend/src/services/researchIdentityEngine.ts`
- API Routes: `vitalcv-backend/src/routes/researchIdentity.ts`
- ORCID API Docs: https://info.orcid.org/documentation/api/
- PubMed API Docs: https://www.ncbi.nlm.nih.gov/books/NBK25497/

---

**Implementation by**: AI Assistant
**Review Status**: Ready for Review


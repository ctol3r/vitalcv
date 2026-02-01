# Primary Source Verification (PSV) Specification

## Overview

VitalCV implements evidence-first Primary Source Verification (PSV) to verify healthcare practitioners against authoritative sources. This document defines the architectural principles, integration requirements, and evidence standards for PSV.

## Architectural Principles

### 1. **Evidence-First Design**
Every PSV check must produce retrievable, immutable evidence:
- `queryFingerprint`: Deterministic hash of search parameters
- `evidenceRef`: Storage reference (S3 key, IPFS CID, etc.)
- `rawHash`: SHA-256 of raw API response
- `metadata`: Source-specific audit data

### 2. **No Network Calls in Domain Layer**
- `packages/domain-common`: Pure types + policy evaluation only
- MVP demo integration lives at `apps/web/lib/psv-integrations.ts`
- Domain layer receives `PSVCheckResult[]`, evaluates policy, returns decision

### 3. **Clean Separation of Concerns**
```
PSV Integration → PSVCheckResult[] → Policy Evaluator → PSVDecision
   (I/O layer)      (evidence)         (domain logic)      (output)
```

### 4. **Explicit Expiry & Freshness**
- `expiresAt`: Explicit expiration timestamp (source-defined)
- `maxAgeSeconds`: Policy-defined freshness window
- Both are enforced by policy evaluator

## PSV Sources

### Integration Truth Table

| Source | Status (MVP) | Connector Type | Auth Required | Evidence Requirements |
|--------|--------------|----------------|---------------|----------------------|
| **OIG LEIE** | STUB | Downloadable CSV | No (public) | File version, download date |
| **SAM Exclusions** | STUB | REST API v4 | Yes (api_key) | Transaction ID, API version |
| **CMS PPEF** | STUB | Data.cms.gov API | No (public) | Dataset ID, query timestamp |
| **NPDB** | STUB | QRXS XML/WSDL | Yes (eligible entity) | DCN (Disclosure Control Number) |
| **DEA** | STUB | Format validation only | N/A (real check requires auth) | Format check note |
| **State Boards** | STUB | FSMB integration | Yes (enterprise) | State, license number, check date |

### Legend
- **STUB**: Deterministic demo output only (no external calls)

---

## Source-Specific Evidence Requirements

### OIG LEIE (Office of Inspector General - List of Excluded Individuals/Entities)

**Source Type**: Downloadable CSV (replaced monthly)
**URL**: https://oig.hhs.gov/exclusions/exclusions_list.asp
**Auth**: Not required (public data)

**Evidence Requirements**:
```typescript
{
  source: PSVSource.OIG_LEIE,
  metadata: {
    fileVersion: "202501",           // YYYYMM format
    downloadDate: "2025-01-29",      // ISO 8601 date
    fileName: "UPDATED.csv",         // Original filename
    recordCount: 75234,              // Total records in file
  }
}
```

**Matching Strategy**:
1. **Prefer NPI exact match** (when available)
2. **Fallback**: `LASTNAME + FIRSTNAME + DOB` exact match
3. **No fuzzy by default**: Ambiguous matches → `PSVStatus.FLAG`

**Integration Mode**: STUB (MVP demo)

---

### SAM Exclusions (System for Award Management)

**Source Type**: REST API v4
**Base URL**: https://api.sam.gov/entity-information/v4/exclusions
**Auth**: API key required (register at sam.gov)

**Evidence Requirements**:
```typescript
{
  source: PSVSource.SAM_EXCLUSIONS,
  metadata: {
    transactionId: "abc-123-def",    // SAM transaction ID (if provided)
    apiVersion: "v4",                // API version used
    queryParams: {                   // Actual query sent
      npi: "1234567890",
      page: 0,
      limit: 10
    }
  }
}
```

**Matching Strategy**:
1. **Prefer NPI exact match** (param: `npi`)
2. **Fallback**: Name-based search
3. **Result Interpretation**:
   - `totalRecords === 0` → `PSVStatus.PASS`
   - Active exclusion match → `PSVStatus.FAIL`
   - Ambiguous match → `PSVStatus.FLAG`

**Integration Mode**: STUB (MVP demo)

---

### CMS PPEF (Provider Enrollment, Chain, and Ownership System via PPEF)

**Source Type**: CMS Data Catalog API
**Catalog URL**: https://data.cms.gov/data.json
**Dataset Title**: "Medicare Fee-For-Service Public Provider Enrollment"

**Evidence Requirements**:
```typescript
{
  source: PSVSource.CMS_PPEF,
  metadata: {
    datasetId: "b2bc-6f1d",          // CMS dataset identifier
    datasetVersion: "2025-01-01",     // Dataset last modified date
    apiEndpoint: "https://data.cms.gov/data-api/v1/dataset/b2bc-6f1d/data",
    queryFilter: "npi eq 1234567890"
  }
}
```

**Matching Strategy**:
1. **NPI exact match** (required field)
2. **Result Interpretation**:
   - NPI found in active enrollments → `PSVStatus.PASS`
   - NPI not found → `PSVStatus.FLAG` (not necessarily exclusion)
   - Query error → `PSVStatus.ERROR`

**Integration Mode**: STUB (MVP demo)

---

### NPDB (National Practitioner Data Bank)

**Source Type**: QRXS (XML/WSDL)
**Environment**: Requires eligible entity registration
**Test Environment**: Available for authorized users

**Evidence Requirements**:
```typescript
{
  source: PSVSource.NPDB,
  metadata: {
    dcn: "12345678",                 // Disclosure Control Number
    queryTimestamp: "2025-01-29T10:00:00.000Z",
    requestType: "continuous_query", // Or "self_query"
    eligibleEntityId: "VCV-001"      // VitalCV entity ID
  }
}
```

**Matching Strategy**:
1. **Requires eligible entity credentials** (hospitals, state boards, etc.)
2. **XML request/response** (SOAP-based)
3. **Result Interpretation**:
   - No reports → `PSVStatus.PASS`
   - Adverse action reports → `PSVStatus.FAIL`
   - Configuration missing → `PSVStatus.UNKNOWN` with reason `"NOT_CONFIGURED"`

**Integration Mode**: STUB (MVP demo)

**Configuration Gate**:
```typescript
if (!config.npdb.entityId || !config.npdb.credentials) {
  return {
    source: PSVSource.NPDB,
    status: PSVStatus.UNKNOWN,
    evidence: { /* ... */ },
    normalizedFindings: [],
    reason: "NOT_CONFIGURED: NPDB requires eligible entity credentials"
  };
}
```

---

### DEA (Drug Enforcement Administration)

**Source Type**: RESTRICTED (format validation available)
**Real Verification**: Requires authorized integration

**Evidence Requirements**:
```typescript
{
  source: PSVSource.DEA,
  metadata: {
    deaNumber: "AB1234563",
    validationMode: "FORMAT_ONLY",   // vs "PRIMARY_SOURCE"
    formatValid: true,
    expirationDate: "2026-01-31"    // If known
  }
}
```

**Matching Strategy**:
1. **Format validation** (regex check, checksum if applicable)
2. **Real check**: Requires DEA integration (not public)
3. **Result Interpretation**:
   - Format invalid → `PSVStatus.FAIL`
   - Format valid but no primary source → `PSVStatus.FLAG` with note `"FORMAT_ONLY"`
   - Primary source verified → `PSVStatus.PASS`

**Integration Mode**: STUB (MVP demo)

**Configuration Gate**:
```typescript
if (!config.dea.authorized) {
  // Format validation only
  return {
    source: PSVSource.DEA,
    status: PSVStatus.FLAG,
    evidence: { /* ... */ },
    normalizedFindings: [],
    notes: "FORMAT_ONLY: Real DEA verification requires authorized integration"
  };
}
```

---

### State Medical Boards

**Source Type**: Fragmented (51+ boards)
**Preferred Integration**: FSMB (Federation of State Medical Boards)

**Evidence Requirements**:
```typescript
{
  source: PSVSource.STATE_BOARD,
  metadata: {
    state: "CA",                     // State abbreviation
    licenseNumber: "A12345",
    licenseType: "MD",               // MD, DO, PA, NP, etc.
    provider: "FSMB",                // Or "CA_MBC" for direct board
    licenseStatus: "ACTIVE",
    expirationDate: "2026-12-31",
    disciplinaryActions: []
  }
}
```

**Matching Strategy**:
1. **Exact license number match** (per state)
2. **FSMB Integration** (enterprise tier):
   - Unified API across all boards
   - Requires FSMB credentials
3. **Per-Board Integrations** (where available):
   - California Medical Board API
   - Texas Medical Board public lookup
   - Etc. (varies by state)
4. **Result Interpretation**:
   - License active, no disciplinary actions → `PSVStatus.PASS`
   - License inactive or disciplinary actions → `PSVStatus.FAIL`
   - No FSMB credentials → `PSVStatus.UNKNOWN` with reason `"NOT_CONFIGURED"`

**Integration Mode**: STUB (MVP demo)

**Configuration Options**:
```typescript
// Option 1: FSMB integration (enterprise)
config.stateBoard.provider = "FSMB";
config.stateBoard.fsmb.apiKey = process.env.FSMB_API_KEY;

// Option 2: Per-board direct integration
config.stateBoard.provider = "DIRECT";
config.stateBoard.boards = {
  CA: { apiEndpoint: "https://...", apiKey: "..." },
  TX: { scrapeUrl: "https://..." },  // If no API available
};
```

---

## Policy Evaluation Rules

### Decision Logic

```typescript
PSVDecision = {
  CLEAR:  All required sources PASS, no violations
  REVIEW: Missing sources, stale checks, FLAGS, UNKNOWN (if disallowed), ERRORS
  BLOCK:  Any FAIL (if blockOnAnyFail=true)
}
```

### Freshness Enforcement

**Age-Based**:
```typescript
{
  source: PSVSource.OIG_LEIE,
  maxAgeSeconds: 2592000,  // 30 days
  required: true
}
```

**Expiry-Based**:
```typescript
{
  source: PSVSource.STATE_BOARD,
  expiresAt: "2025-02-28T00:00:00.000Z",  // Explicit expiration
}
```

**Evaluation**:
- If `age > maxAgeSeconds` → violation
- If `now > expiresAt` → violation
- Violations → `PSVDecision.REVIEW`

---

## Example Policy

```typescript
const productionPolicy: PSVPolicy = {
  policyId: 'prod-psv-v1',
  version: '1.0.0',
  name: 'Production PSV Policy',
  freshnessRules: [
    {
      source: PSVSource.OIG_LEIE,
      maxAgeSeconds: 2592000,  // 30 days
      required: true,
    },
    {
      source: PSVSource.SAM_EXCLUSIONS,
      maxAgeSeconds: 2592000,  // 30 days
      required: true,
    },
    {
      source: PSVSource.CMS_PPEF,
      maxAgeSeconds: 7776000,  // 90 days
      required: false,
    },
    {
      source: PSVSource.STATE_BOARD,
      maxAgeSeconds: 15552000,  // 180 days
      required: true,
    },
    {
      source: PSVSource.NPDB,
      maxAgeSeconds: 31536000,  // 365 days
      required: false,
    },
  ],
  matchingRules: [
    {
      source: PSVSource.OIG_LEIE,
      requiredFields: ['firstName', 'lastName', 'dob'],
      matchStrategy: 'exact',
    },
    {
      source: PSVSource.SAM_EXCLUSIONS,
      requiredFields: ['npi'],
      matchStrategy: 'exact',
    },
    {
      source: PSVSource.STATE_BOARD,
      requiredFields: ['state', 'licenseNumber'],
      matchStrategy: 'exact',
    },
  ],
  blockOnAnyFail: true,
  reviewOnAnyFlag: true,
  allowUnknownSources: false,  // NPDB UNKNOWN → REVIEW
};
```

---

## Implementation Phases

### Phase 1: Foundation (Current)
- ✅ PSV domain types (`psvContracts.ts`)
- ✅ Policy evaluator (`psvPolicy.ts`)
- ✅ Unit tests
- ✅ Documentation

### Phase 2: Live Connectors
- 🔄 OIG LEIE connector (downloadable CSV + local index)
- 🔄 SAM Exclusions connector (REST API)
- 🔄 CMS PPEF connector (data.cms.gov API)

### Phase 3: Restricted Connectors
- ⏳ NPDB connector (QRXS, gated)
- ⏳ DEA connector (format validation + integration gate)
- ⏳ State Boards connector (FSMB integration)

### Phase 4: Production Hardening
- ⏳ Evidence storage (S3 + immutable audit log)
- ⏳ Monitoring & alerting
- ⏳ Compliance reporting
- ⏳ Performance optimization (caching, batch queries)

---

## Security Considerations

1. **API Keys**: Store in environment variables, never commit
2. **Evidence Storage**: Encrypt at rest, access-controlled
3. **PII Handling**: Minimal exposure, HIPAA-compliant logging
4. **Audit Trail**: Immutable logs for all PSV checks
5. **Rate Limiting**: Respect API limits, implement backoff

---

## Next Steps

1. **Configure Environment**:
   ```bash
   SAM_API_KEY=your_key_here
   PSV_CACHE_DIR=/var/lib/vitalcv/psv-cache
   OIG_LEIE_URL=https://oig.hhs.gov/exclusions/downloadables/UPDATED.csv
   ```

2. **Run PSV Check**:
   ```bash
   pnpm psv:check --npi 1234567890
   ```

3. **Review Results**:
   - Check `PSVDecision` (CLEAR/REVIEW/BLOCK)
   - Audit `evidenceRef` for compliance
   - Address violations (stale checks, missing sources)

---

## References

- [OIG LEIE](https://oig.hhs.gov/exclusions/exclusions_list.asp)
- [SAM.gov API](https://open.gsa.gov/api/entity-api/)
- [CMS Data Catalog](https://data.cms.gov/data.json)
- [NPDB (eligible entities only)](https://www.npdb.hrsa.gov/)
- [FSMB](https://www.fsmb.org/)

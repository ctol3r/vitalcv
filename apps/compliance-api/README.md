# Compliance API

## Overview

The Compliance API provides endpoints for healthcare compliance verification, evidence management, and directory badge services.

## B128C-FEEDS-034: Directory Badge API

### Endpoint

```
GET /compliance/fhir-badge/:npi
```

### Description

Returns FHIR Pipeline verification evidence flag and URL for a provider.

### Response Format

**Verified Provider:**

```json
{
  "verified": true,
  "evidenceId": "evid_abc123",
  "runId": "run_xyz789",
  "runUrl": "/api/agents/runs/run_xyz789",
  "verifiedAt": "2025-11-12T10:00:00.000Z",
  "evidence": {
    "id": "evid_abc123",
    "doi": "10.1001/fhir.verification",
    "title": "FHIR Pipeline Verification Evidence",
    "abstract": "Evidence of successful FHIR data validation",
    "hash": "a3f5c8d2b1e4f7a9...",
    "chainTxHash": "0xa3f5c8d2b1e4f7a9..."
  },
  "evidenceFlag": true,
  "evidenceUrl": "/api/evidence/registry/evid_abc123",
  "badge": {
    "type": "fhir_pipeline_verified",
    "label": "Verified via FHIR Pipeline",
    "url": "/api/agents/runs/run_xyz789",
    "issuedAt": "2025-11-12T10:00:00.000Z",
    "npi": "1234567890"
  }
}
```

**Unverified Provider:**

```json
{
  "verified": false
}
```

### Frontend Integration

```typescript
// Fetch badge data
const response = await fetch(`/compliance/fhir-badge/${npi}`);
const data = await response.json();

if (data.verified && data.evidenceFlag) {
  // Show badge with tooltip link
  return (
    <Badge
      label={data.badge.label}
      href={data.badge.url}
      tooltip="View FHIR verification evidence"
    />
  );
}
```

### Testing

```bash
# Run tests
npm test apps/compliance-api/src/routes/__tests__/fhir-badge-enhanced.test.ts

# Expected: All tests pass
# - Flag+URL returned ✅
# - FE consumes ✅
# - Tests pass ✅
```

### Acceptance Criteria

- [x] Flag+URL returned when provider verified
- [x] Frontend can consume badge object
- [x] All tests pass
- [x] Evidence linked to provider NPI
- [x] Most recent verification returned

### Related Tasks

- B128C-FE-035: Frontend badge component
- B128C-EVID-030: Evidence seed with SHA256 anchoring

## Other Endpoints

### Evidence Registry

```
GET /compliance/evidence/registry?kpiReference=minutes-in-notes
POST /compliance/evidence/seed
```

### NCQA Evidence

```
GET /compliance/ncqa/evidence
POST /compliance/ncqa/evidence/anchor
```

## Environment Variables

```bash
COMPLIANCE_API_PORT=4006
DATABASE_URL=postgresql://...
POLKADOT_ENDPOINT=ws://localhost:9944
```

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run tests
npm test

# Build
npm run build
```

## Security

All endpoints protected by `allowedSinksEnforcer` middleware. See `docs/security/ALLOWED_SINKS_ENFORCEMENT.md`.


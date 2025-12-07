# PSV (Primary Source Verification) Module

**Sprint**: S72 Day 1
**NCQA Compliance**: CR1-CR5

## Overview

The PSV module provides automated primary source verification for healthcare clinicians, ensuring NCQA credentialing compliance through:

- License verification against state medical boards
- Sanctions screening via OIG LEIE
- 120-day freshness tracking
- Evidence bundle generation
- Tamper-evident anchoring
- Audit trail maintenance

## Quick Start

### Basic Usage

```typescript
import { runPSV } from '../../services/psvOrchestrator';
import { isFresh } from '../../services/psvFreshness';
import { buildEvidenceBundle } from '../../services/evidenceBundle';
import { anchorEvidence } from '../../services/anchorStub';

// 1. Run complete PSV check
const result = await runPSV({
  clinicianId: 'clinician-123',
  npi: '1234567890',
  state: 'CA',
  licenseNumber: '123456',
});

console.log(result.overallStatus); // PASS, FAIL, or WARNING
console.log(result.summary); // Human-readable summary

// 2. Check if result is fresh
if (!isFresh(result)) {
  console.log('PSV result is stale, re-verification needed');
}

// 3. Generate evidence bundle
const bundle = await buildEvidenceBundle(result.psvResultId, 'vc-id');

// 4. Anchor evidence for audit trail
const anchor = await anchorEvidence(bundle.bundleId);
console.log(`Anchored at block ${anchor.blockHeight}`);
```

## API Endpoints

### License Verification

#### `POST /psv/license`

Check license status against state medical board.

**Request:**
```json
{
  "npi": "1234567890",
  "state": "CA",
  "licenseNumber": "123456"
}
```

**Response:**
```json
{
  "status": "ACTIVE",
  "sourceUrl": "https://stateboard.ca.gov/verify/123456",
  "checkedAt": "2025-11-13T10:30:00.000Z",
  "npi": "1234567890",
  "state": "CA",
  "licenseNumber": "123456",
  "checkId": "clxx123abc"
}
```

**Status Values:**
- `ACTIVE` - License is current and active
- `INACTIVE` - License is not currently active
- `EXPIRED` - License has expired
- `SUSPENDED` - License is suspended

#### `GET /psv/license/:checkId`

Retrieve a previously performed license check.

### Sanctions Verification

#### `POST /psv/sanctions`

Check provider against OIG exclusion list.

**Request:**
```json
{
  "npi": "1234567890"
}
```

**Response:**
```json
{
  "sanctioned": false,
  "sourceUrl": "https://exclusions.oig.hhs.gov/verification.aspx",
  "checkedAt": "2025-11-13T10:30:00.000Z",
  "npi": "1234567890",
  "checkId": "clxx456def"
}
```

#### `POST /psv/sanctions/bulk`

Batch check multiple NPIs for sanctions.

**Request:**
```json
{
  "npis": ["1234567890", "0987654321", "1111111111"]
}
```

**Response:**
```json
{
  "results": [
    {
      "sanctioned": false,
      "sourceUrl": "https://exclusions.oig.hhs.gov/verification.aspx",
      "checkedAt": "2025-11-13T10:30:00.000Z",
      "npi": "1234567890",
      "checkId": "clxx456def"
    },
    // ... more results
  ]
}
```

### Evidence Export

#### `GET /psv/evidence/:id`

Download evidence bundle as ZIP file containing:
- `manifest.json` - Complete PSV evidence bundle
- `proof.txt` - Human-readable proof with anchor info

**Response:** ZIP file download

#### `GET /psv/evidence/:id/info`

Get evidence bundle metadata without downloading.

**Response:**
```json
{
  "bundleId": "clxx789ghi",
  "psvResultId": "clxx123abc",
  "manifest": { /* full manifest */ },
  "anchor": {
    "anchorId": "anchor-1699876543210-abc123def456",
    "hash": "a1b2c3d4...",
    "blockHeight": 5432109
  },
  "zipPath": "/tmp/psv-evidence-clxx789ghi.zip",
  "createdAt": "2025-11-13T10:30:00.000Z"
}
```

#### `POST /psv/evidence/:id/regenerate`

Trigger ZIP regeneration (useful after anchor updates).

## Services

### PSV Orchestrator

Coordinates license and sanctions checks.

```typescript
import { runPSV, getPSVResult, getPSVResultsForClinician } from './services/psvOrchestrator';

// Run complete PSV
const result = await runPSV({
  clinicianId: 'clinician-123',
  npi: '1234567890',
  state: 'CA',
  licenseNumber: '123456',
});

// Get specific result
const result = await getPSVResult('psvResultId');

// Get all results for clinician
const results = await getPSVResultsForClinician('clinician-123');
```

### Freshness Check

Determines if PSV results are still valid (≤120 days).

```typescript
import {
  isFresh,
  getDaysRemaining,
  getLatestFreshPSVResult,
  needsPSVReverification,
  markStalePSVResults,
} from './services/psvFreshness';

// Check if result is fresh
const fresh = isFresh({ checkedAt: new Date('2025-01-01') });

// Get days remaining
const days = getDaysRemaining({ checkedAt: new Date('2025-01-01') });

// Get latest fresh result for clinician
const latest = await getLatestFreshPSVResult('clinician-123');

// Check if re-verification needed
const needs = await needsPSVReverification('clinician-123');

// Mark stale results (run in cron job)
const count = await markStalePSVResults();
console.log(`Marked ${count} results as stale`);
```

### Evidence Bundle Builder

Creates JSON manifests for audit trails.

```typescript
import {
  buildEvidenceBundle,
  getEvidenceBundle,
  generateProofText,
} from './services/evidenceBundle';

// Build bundle
const bundle = await buildEvidenceBundle('psvResultId', 'vcId');

// Get bundle
const manifest = await getEvidenceBundle('bundleId');

// Generate proof text
const proof = generateProofText(manifest);
```

### Anchor Stub

Provides tamper-evident hashing.

```typescript
import {
  anchorEvidence,
  verifyAnchor,
  getAnchorInfo,
  batchAnchorEvidence,
} from './services/anchorStub';

// Anchor evidence
const anchor = await anchorEvidence('bundleId');

// Verify anchor
const verified = await verifyAnchor('bundleId');

// Get anchor info
const info = await getAnchorInfo('bundleId');

// Batch anchor
const results = await batchAnchorEvidence(['id1', 'id2', 'id3']);
```

## Database Schema

### PSVResult
Combined PSV verification result.

### PSVLicenseCheck
License verification details.

### PSVSanctionsCheck
Sanctions check results.

### PSVEvidenceBundle
Evidence bundles with anchors.

## Testing

```bash
# Run all PSV tests
jest --testPathPattern=psv

# Run specific test suites
jest apps/api/src/routes/psv/__tests__/license.test.ts
jest apps/api/src/routes/psv/__tests__/sanctions.test.ts
jest apps/api/src/routes/psv/__tests__/psvIntegration.test.ts

# Run with coverage
jest --testPathPattern=psv --coverage
```

## Mock Data

### Test NPIs

**License Status:**
- `1234567890` + CA + `123456` → ACTIVE
- `0987654321` + NY + `789012` → INACTIVE
- `1111111111` + TX + `555555` → EXPIRED
- `2222222222` + FL + `666666` → SUSPENDED

**Sanctions:**
- `6666666666` → Sanctioned
- `7777777777` → Sanctioned
- All others → Not sanctioned

## Error Handling

### Validation Errors

**Invalid NPI:**
```json
{
  "error": "invalid_npi",
  "error_description": "npi must be a 10-digit number"
}
```

**Invalid State:**
```json
{
  "error": "invalid_state",
  "error_description": "state must be a valid 2-letter state code"
}
```

**Missing Fields:**
```json
{
  "error": "invalid_request",
  "error_description": "npi, state, and licenseNumber are required"
}
```

### Not Found Errors

```json
{
  "error": "not_found",
  "error_description": "Evidence bundle not found"
}
```

## NCQA Compliance

This module addresses NCQA credentialing requirements:

- **CR1**: Primary source verification of licenses ✅
- **CR2**: Sanctions screening (OIG LEIE) ✅
- **CR3**: 120-day freshness requirement ✅
- **CR4**: Audit trail and evidence documentation ✅
- **CR5**: Tamper-evident anchoring ✅

## Production Considerations

### Current Implementation (Mock)
- In-memory state board API
- Test OIG sanctions data
- Stub blockchain anchoring

### Production Requirements
1. **State Board Integration**
   - Integrate with actual state medical board APIs
   - Handle rate limiting and authentication
   - Implement retry logic for failed checks

2. **OIG LEIE Integration**
   - Use official OIG LEIE API
   - Daily updates from OIG exclusion list
   - Historical exclusion tracking

3. **Blockchain Anchoring**
   - Replace stub with actual blockchain
   - Consider Ethereum, Polygon, or enterprise chains
   - Implement transaction monitoring

4. **Background Jobs**
   - Scheduled freshness checks
   - Automatic re-verification alerts
   - Stale result cleanup

5. **Caching**
   - Cache frequently checked NPIs
   - Implement cache invalidation strategy
   - Consider Redis for distributed caching

6. **Monitoring**
   - Track check success/failure rates
   - Alert on external API failures
   - Monitor freshness compliance

## Examples

See `S72_PSV_API_EXAMPLES.sh` for complete API examples.

See `psvIntegration.test.ts` for end-to-end workflow examples.

## Support

For issues or questions, see the main implementation summary:
`S72_PSV_IMPLEMENTATION_SUMMARY.md`


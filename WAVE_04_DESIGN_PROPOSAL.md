# Wave 4 Design Proposal: Standards-Aligned Revocation + Audit Receipts + CRS

**Status:** Draft for Review (Option B - Status List Endpoints)
**Date:** 2026-01-12
**Codex Cluster:** wave-04
**Dependencies:** Wave 3 (messaging-guard, dpopGuard) ✅

## Executive Summary

Wave 4 delivers three critical trust infrastructure components:

1. **Standards-Aligned Revocation (Option B)** - Status List endpoints with fail-closed verifier behavior
2. **Verifier Audit Trail** - OPA-ready audit middleware with structured receipts
3. **Credential Readiness Score (CRS)** - Deterministic scoring engine with explicit data dependencies

## 1. Standards-Aligned Revocation Infrastructure (Option B)

### 1.1 API Contract

#### GET /api/issuer/v1/status/{listId}

**Purpose:** Fetch status list for revocation checking (W3C StatusList2021 compatible)

**Path Parameters:**

- `listId` (string, required): Status list identifier

**Response (200 OK):**

```typescript
interface StatusListResponse {
  statusListId: string;
  issuer: string; // Issuer DID
  issuedAt: string; // ISO 8601
  encodedList: string; // gzip + base64 encoded bitstring
  proof: {
    // JWS proof
    type: 'Ed25519Signature2020';
    created: string;
    verificationMethod: string;
    proofPurpose: 'assertionMethod';
    jws: string;
  };
}
```

**Response (404 Not Found):**

```typescript
interface ErrorResponse {
  error: 'status_list_not_found';
  error_description: string;
}
```

#### POST /api/issuer/v1/revocations

**Purpose:** Revoke a previously issued credential (updates status list)

**Request:**

```typescript
interface RevocationRequest {
  credential_id: string; // Unique credential identifier
  status_list_id: string; // Status list containing this credential
  status_list_index: number; // Bit index in status list
  reason?: RevocationReason; // Optional revocation reason
  effective_date?: string; // ISO 8601, defaults to now
  issuer_signature: string; // JWS detached signature of request
}

enum RevocationReason {
  UNSPECIFIED = 'unspecified',
  KEY_COMPROMISE = 'key_compromise',
  AFFILIATION_CHANGED = 'affiliation_changed',
  SUPERSEDED = 'superseded',
  CESSATION_OF_OPERATION = 'cessation_of_operation',
  PRIVILEGE_WITHDRAWN = 'privilege_withdrawn',
}
```

**Response (200 OK):**

```typescript
interface RevocationResponse {
  credential_id: string;
  revoked: true;
  revoked_at: string; // ISO 8601
  status_list_id: string;
  status_list_index: number;
  status_url: string; // URL to fetch updated status list
  audit_log_id: string; // Audit trail reference
}
```

**Response (404 Not Found):**

```typescript
interface ErrorResponse {
  error: 'credential_not_found' | 'status_list_not_found';
  error_description: string;
}
```

**Response (401 Unauthorized):**

```typescript
interface ErrorResponse {
  error: 'invalid_signature';
  error_description: string;
}
```

### 1.2 Credential Status Pointer

**All issued credentials must include a status object:**

```typescript
interface VerifiableCredential {
  // ... standard fields ...
  credentialStatus: {
    statusUrl: string; // GET /api/issuer/v1/status/{listId}
    statusListId: string; // Status list identifier
    statusListIndex: number; // Bit index in status list (0-based)
    statusPurpose: 'revocation'; // Always 'revocation' for now
  };
}
```

**Example:**

```json
{
  "@context": ["https://www.w3.org/2018/credentials/v1"],
  "id": "urn:uuid:12345678-1234-1234-1234-123456789012",
  "type": ["VerifiableCredential", "HealthcareProfessionalCredential"],
  "issuer": "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK",
  "issuanceDate": "2026-01-12T10:00:00Z",
  "credentialSubject": {
    "id": "did:key:z6Mktest...",
    "npi": "1234567890"
  },
  "credentialStatus": {
    "statusUrl": "https://issuer.vitalcv.com/api/issuer/v1/status/list-001",
    "statusListId": "list-001",
    "statusListIndex": 42,
    "statusPurpose": "revocation"
  },
  "proof": { ... }
}
```

### 1.2 Storage Schema

**revocations table:**

```sql
CREATE TABLE revocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id VARCHAR(255) UNIQUE NOT NULL,
  revoked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason VARCHAR(50),
  status_list_id UUID NOT NULL REFERENCES status_lists(id),
  status_list_index INTEGER NOT NULL,
  issuer_did VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_revocations_credential_id ON revocations(credential_id);
CREATE INDEX idx_revocations_status_list_id ON revocations(status_list_id);
```

**status_lists table:**

```sql
CREATE TABLE status_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id VARCHAR(255) UNIQUE NOT NULL,
  issuer_did VARCHAR(255) NOT NULL,
  bitstring BYTEA NOT NULL,              -- Raw bitstring (1 bit per credential)
  bitstring_length INTEGER NOT NULL,      -- Total capacity
  used_indices INTEGER NOT NULL DEFAULT 0,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  credential_jwt TEXT,                    -- Cached StatusList2021 credential
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_status_lists_list_id ON status_lists(list_id);
CREATE INDEX idx_status_lists_issuer_did ON status_lists(issuer_did);
```

### 1.3 StatusList2021 Integration

**Implementation:** `apps/issuer-api/src/services/statusListService.ts`

**Core Operations:**

```typescript
interface StatusListService {
  // Allocate a status list index for a new credential
  allocateStatusIndex(issuerDid: string): Promise<{
    statusListId: string;
    statusListIndex: number;
    statusListUrl: string;
  }>;

  // Mark a credential as revoked
  revokeCredential(
    credentialId: string,
    statusListId: string,
    statusListIndex: number,
    reason?: RevocationReason,
  ): Promise<void>;

  // Check if a credential is revoked
  isRevoked(credentialId: string): Promise<boolean>;

  // Generate StatusList2021 credential
  generateStatusListCredential(listId: string): Promise<StatusListCredential>;

  // Fetch status list bitstring
  getStatusListBitstring(listId: string): Promise<Uint8Array>;
}
```

**Bitstring Operations:**

- Use `@digitalbazaar/vc-status-list` library for StatusList2021 encoding/decoding
- Each bit represents one credential (0 = valid, 1 = revoked)
- Bitstring is gzip compressed and base64 encoded for transport
- Initial capacity: 16,384 credentials per list (2KB compressed)

### 1.4 Credential Integration

**Modification:** `apps/issuer-api/src/services/*Issuer.ts`

All credential issuers must include `credentialStatus` field:

```typescript
interface VerifiableCredential {
  // ... existing fields ...
  credentialStatus: {
    id: string; // ${statusListUrl}#${statusListIndex}
    type: 'StatusList2021Entry';
    statusPurpose: 'revocation';
    statusListIndex: string; // String representation of number
    statusListCredential: string; // URL to status list credential
  };
}
```

## 2. Verifier Audit Trail

### 2.1 Audit Middleware

**Implementation:** `apps/verifier-api/src/middleware/auditMiddleware.ts`

**Purpose:** Record all verification attempts with structured audit receipts

**Audit Receipt Schema:**

```typescript
interface VerificationAuditReceipt {
  // Request identifiers
  request_id: string;
  timestamp: string; // ISO 8601

  // Verification context
  verifier_did: string;
  policy_id?: string; // OPA policy bundle ID
  purpose_of_use?: string; // POU code (e.g., 'TREATMENT', 'HIRING')

  // Credential details
  credential_type: string;
  credential_id?: string;
  issuer_did?: string;
  subject_did?: string;

  // Verification result
  verification_result: 'success' | 'failure';
  verification_errors?: string[];

  // Trust checks performed
  checks: {
    signature_verified: boolean;
    expiration_checked: boolean;
    revocation_checked: boolean;
    revocation_status?: 'valid' | 'revoked' | 'unknown';
    schema_validated: boolean;
    policy_evaluated: boolean;
    policy_decision?: 'permit' | 'deny';
  };

  // DPoP binding (if present)
  dpop_validated?: boolean;
  dpop_jkt?: string;

  // Audit trail
  audit_log_id: string; // ID in audit_logs table
  opa_decision_id?: string; // OPA decision log ID (if integrated)
}
```

**Storage Schema:**

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id VARCHAR(255) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Verification context
  verifier_did VARCHAR(255) NOT NULL,
  policy_id VARCHAR(255),
  purpose_of_use VARCHAR(50),

  -- Credential details
  credential_type VARCHAR(255) NOT NULL,
  credential_id VARCHAR(255),
  issuer_did VARCHAR(255),
  subject_did VARCHAR(255),

  -- Verification result
  verification_result VARCHAR(20) NOT NULL,
  verification_errors TEXT[],

  -- Trust checks (JSONB for flexibility)
  checks JSONB NOT NULL,

  -- DPoP binding
  dpop_validated BOOLEAN,
  dpop_jkt VARCHAR(255),

  -- OPA integration
  opa_decision_id VARCHAR(255),

  -- Raw receipt (for archival/compliance)
  receipt JSONB NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_request_id ON audit_logs(request_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX idx_audit_logs_verifier_did ON audit_logs(verifier_did);
CREATE INDEX idx_audit_logs_credential_id ON audit_logs(credential_id);
CREATE INDEX idx_audit_logs_verification_result ON audit_logs(verification_result);
```

### 2.2 OPA Integration Points

**Future Integration:** Open Policy Agent decision logging

**OPA Decision Input:**

```typescript
interface OPADecisionInput {
  credential: {
    type: string;
    issuer_did: string;
    subject_did: string;
    claims: Record<string, any>;
  };
  context: {
    verifier_did: string;
    purpose_of_use: string;
    timestamp: string;
  };
  verification: {
    signature_valid: boolean;
    not_revoked: boolean;
    not_expired: boolean;
  };
}
```

**OPA Decision Output:**

```typescript
interface OPADecisionOutput {
  decision: 'permit' | 'deny';
  decision_id: string;
  reasons: string[];
  policy_id: string;
  timestamp: string;
}
```

### 2.3 Middleware Implementation

**Express Middleware:**

```typescript
export function auditMiddleware() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const auditReceipt: Partial<VerificationAuditReceipt> = {
      request_id: req.id,
      timestamp: new Date().toISOString(),
      verifier_did: extractVerifierDid(req),
    };

    // Attach audit context to request
    (req as any).auditReceipt = auditReceipt;

    // Intercept response to capture verification result
    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      (req as any).auditReceipt.verification_result =
        res.statusCode === 200 ? 'success' : 'failure';

      // Write audit log asynchronously
      writeAuditLog((req as any).auditReceipt).catch((err) => {
        console.error('[AuditMiddleware] Failed to write audit log:', err);
      });

      return originalJson(body);
    };

    next();
  };
}
```

## 3. Credential Readiness Score (CRS)

### 3.1 API Contract: `/api/crs/:npi`

#### GET /api/crs/:npi

**Purpose:** Compute Credential Readiness Score for a healthcare provider

**Path Parameters:**

- `npi` (string, required): National Provider Identifier

**Query Parameters:**

- `include_details` (boolean, optional): Include detailed scoring breakdown

**Response (200 OK):**

```typescript
interface CRSResponse {
  npi: string;
  score: number; // 0-100
  grade: CRSGrade; // A, B, C, D, F
  computed_at: string; // ISO 8601
  data_freshness: string; // ISO 8601 - oldest data point timestamp

  // Scoring breakdown (if include_details=true)
  details?: {
    components: CRSComponent[];
    missing_data: string[];
    recommendations: string[];
  };
}

type CRSGrade = 'A' | 'B' | 'C' | 'D' | 'F';

interface CRSComponent {
  name: string;
  weight: number; // 0-1 (sum to 1.0)
  score: number; // 0-100
  max_score: number; // 100
  earned_points: number;
  status: 'complete' | 'partial' | 'missing';
  data_source?: string;
}
```

**Response (404 Not Found):**

```typescript
interface ErrorResponse {
  error: 'npi_not_found';
  error_description: string;
}
```

**Example Response:**

```json
{
  "npi": "1234567890",
  "score": 87,
  "grade": "B",
  "computed_at": "2026-01-12T10:30:00Z",
  "data_freshness": "2026-01-10T00:00:00Z",
  "details": {
    "components": [
      {
        "name": "NPI Verification",
        "weight": 0.15,
        "score": 100,
        "max_score": 100,
        "earned_points": 15,
        "status": "complete",
        "data_source": "NPPES Registry"
      },
      {
        "name": "State Licensure",
        "weight": 0.25,
        "score": 100,
        "max_score": 100,
        "earned_points": 25,
        "status": "complete",
        "data_source": "State Medical Boards"
      },
      {
        "name": "DEA Registration",
        "weight": 0.1,
        "score": 100,
        "max_score": 100,
        "earned_points": 10,
        "status": "complete",
        "data_source": "DEA Database"
      },
      {
        "name": "Board Certification",
        "weight": 0.15,
        "score": 80,
        "max_score": 100,
        "earned_points": 12,
        "status": "partial",
        "data_source": "ABMS Database"
      },
      {
        "name": "Malpractice Insurance",
        "weight": 0.1,
        "score": 100,
        "max_score": 100,
        "earned_points": 10,
        "status": "complete",
        "data_source": "Provider Self-Report"
      },
      {
        "name": "NPDB Check",
        "weight": 0.15,
        "score": 100,
        "max_score": 100,
        "earned_points": 15,
        "status": "complete",
        "data_source": "National Practitioner Data Bank"
      },
      {
        "name": "Sanctions Check",
        "weight": 0.1,
        "score": 0,
        "max_score": 100,
        "earned_points": 0,
        "status": "missing",
        "data_source": "OIG LEIE / SAM.gov"
      }
    ],
    "missing_data": ["Sanctions check not completed"],
    "recommendations": [
      "Complete OIG LEIE sanctions screening to improve score",
      "Update board certification status for full points"
    ]
  }
}
```

### 3.2 CRS Computation Rules (v1 - Deterministic)

**Implementation:** `apps/api/backend/src/services/crsEngine.ts`

**Scoring Components (sum to 100%):**

| Component                 | Weight | Scoring Logic                                                                                              | Data Source                     |
| ------------------------- | ------ | ---------------------------------------------------------------------------------------------------------- | ------------------------------- |
| **NPI Verification**      | 15%    | Active NPI in NPPES: 100 pts; inactive or missing: 0 pts                                                   | NPPES Registry                  |
| **State Licensure**       | 25%    | Active license: 100 pts; expired: 50 pts; missing: 0 pts                                                   | State Medical Boards            |
| **DEA Registration**      | 10%    | Valid DEA: 100 pts; expired: 50 pts; not required: 100 pts; missing: 0 pts                                 | DEA Database                    |
| **Board Certification**   | 15%    | Current certification: 100 pts; expired ≤2 years: 80 pts; expired >2 years: 50 pts; never certified: 0 pts | ABMS Database                   |
| **Malpractice Insurance** | 10%    | Current policy: 100 pts; expired ≤90 days: 75 pts; missing: 0 pts                                          | Provider Self-Report            |
| **NPDB Check**            | 15%    | No adverse actions: 100 pts; 1-2 actions: 50 pts; 3+ actions: 0 pts                                        | National Practitioner Data Bank |
| **Sanctions Check**       | 10%    | Not sanctioned: 100 pts; active sanction: 0 pts; not checked: 0 pts                                        | OIG LEIE, SAM.gov               |

**Grade Mapping:**

- **A (90-100):** Excellent - All critical credentials verified
- **B (80-89):** Good - Minor gaps or upcoming renewals
- **C (70-79):** Fair - Notable gaps requiring attention
- **D (60-69):** Poor - Significant deficiencies
- **F (<60):** Fail - Critical credentials missing or expired

**Computation Algorithm:**

```typescript
function computeCRS(npi: string): CRSResponse {
  const components = [
    computeNPIScore(npi),
    computeLicensureScore(npi),
    computeDEAScore(npi),
    computeBoardCertificationScore(npi),
    computeMalpracticeScore(npi),
    computeNPDBScore(npi),
    computeSanctionsScore(npi),
  ];

  const totalScore = components.reduce((sum, comp) => sum + comp.score * comp.weight, 0);

  const grade =
    totalScore >= 90
      ? 'A'
      : totalScore >= 80
      ? 'B'
      : totalScore >= 70
      ? 'C'
      : totalScore >= 60
      ? 'D'
      : 'F';

  return {
    npi,
    score: Math.round(totalScore),
    grade,
    computed_at: new Date().toISOString(),
    data_freshness: getOldestDataTimestamp(components),
    details: {
      components,
      missing_data: getMissingData(components),
      recommendations: generateRecommendations(components),
    },
  };
}
```

### 3.3 Data Sources

**Primary Data Sources (v1):**

1. **NPPES Registry**

   - URL: <https://npiregistry.cms.hhs.gov/api/>
   - Data: NPI validation, provider demographics
   - Refresh: Daily
   - API: Public REST API

2. **State Medical Boards**

   - Integration: Per-state licensure verification
   - Data: License status, expiration, disciplinary actions
   - Refresh: Weekly (varies by state)
   - API: State-specific APIs or scraping

3. **DEA Database**

   - Integration: DEA practitioner lookup
   - Data: DEA registration status, expiration
   - Refresh: Monthly
   - API: Partner integration (restricted)

4. **ABMS Database**

   - Integration: American Board of Medical Specialties
   - Data: Board certification status, specialty
   - Refresh: Quarterly
   - API: Subscription-based

5. **National Practitioner Data Bank (NPDB)**

   - Integration: Query via authorized entity
   - Data: Malpractice payments, adverse actions
   - Refresh: On-demand (cost per query)
   - API: Secure query system

6. **OIG LEIE (List of Excluded Individuals/Entities)**

   - URL: <https://oig.hhs.gov/exclusions/>
   - Data: Medicare/Medicaid exclusions
   - Refresh: Monthly
   - API: Public downloadable database

7. **SAM.gov Exclusions**
   - URL: <https://sam.gov/>
   - Data: Federal government exclusions
   - Refresh: Daily
   - API: Public REST API

**Data Storage:**

```sql
CREATE TABLE crs_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  npi VARCHAR(10) UNIQUE NOT NULL,
  score INTEGER NOT NULL,
  grade VARCHAR(1) NOT NULL,
  components JSONB NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL,
  data_freshness TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,    -- Cache expiry (24 hours)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_crs_cache_npi ON crs_cache(npi);
CREATE INDEX idx_crs_cache_expires_at ON crs_cache(expires_at);
```

### 3.4 Cache Strategy

**TTL:** 24 hours
**Invalidation:** Manual invalidation when provider updates credentials
**Refresh:** Batch nightly refresh for providers with active credentials

## 4. UI Wiring Points

### 4.1 CRS Widget

**Location:** Clinician profile page, credential issuance flow

**Component:** `apps/web/src/components/CRSWidget.tsx`

**Props:**

```typescript
interface CRSWidgetProps {
  npi: string;
  showDetails?: boolean;
  onScoreClick?: (npi: string) => void;
}
```

**Visual Design:**

- Circular progress indicator showing score (0-100)
- Letter grade (A-F) with color coding:
  - A: Green (#10B981)
  - B: Light Green (#84CC16)
  - C: Yellow (#F59E0B)
  - D: Orange (#F97316)
  - F: Red (#EF4444)
- Hover tooltip with grade description
- Click to expand detailed breakdown

### 4.2 Verification Result Screen

**Location:** Verifier portal after credential verification

**Component:** `apps/web/src/components/VerificationResult.tsx`

**Props:**

```typescript
interface VerificationResultProps {
  verificationStatus: 'success' | 'failure';
  credential: {
    type: string;
    issuer: string;
    subject: string;
  };
  checks: {
    signature_verified: boolean;
    expiration_checked: boolean;
    revocation_checked: boolean;
    revocation_status: 'valid' | 'revoked' | 'unknown';
    schema_validated: boolean;
  };
  auditReceiptId: string;
  timestamp: string;
}
```

**Visual Design:**

- Status badge (✓ Verified / ✗ Failed)
- Checklist of verification steps with icons
- Revocation status prominently displayed
- Download audit receipt button
- Timestamp and audit trail ID

### 4.3 Revocation Management Panel

**Location:** Issuer admin dashboard

**Component:** `apps/web/src/components/RevocationPanel.tsx`

**Features:**

- Search credentials by ID or subject
- Revoke credential with reason selection
- View revocation history
- Export revocation logs

## 5. Test Requirements

### 5.1 E2E Test Flow: issue → verify → revoke → verify-fails

**Test Harness:** `apps/api/backend/src/__tests__/e2e/revocation.e2e.test.ts`

**Test Scenario:**

```typescript
describe('E2E: Credential Revocation Flow', () => {
  it('should issue, verify, revoke, and fail verification', async () => {
    // 1. Issue credential
    const credential = await issueCredential({
      type: 'HealthcareProfessionalCredential',
      subject_did: 'did:key:z6Mktest...',
      claims: { npi: '1234567890', license: 'CA-12345' },
    });

    expect(credential.credentialStatus).toBeDefined();
    expect(credential.credentialStatus.type).toBe('StatusList2021Entry');

    // 2. Verify credential (should succeed)
    const verifyResult1 = await verifyCredential(credential);
    expect(verifyResult1.verified).toBe(true);
    expect(verifyResult1.checks.revocation_checked).toBe(true);
    expect(verifyResult1.checks.revocation_status).toBe('valid');

    // 3. Revoke credential
    const revokeResult = await revokeCredential({
      credential_id: credential.id,
      reason: 'SUPERSEDED',
    });

    expect(revokeResult.revoked).toBe(true);

    // 4. Verify credential again (should fail)
    const verifyResult2 = await verifyCredential(credential);
    expect(verifyResult2.verified).toBe(false);
    expect(verifyResult2.checks.revocation_status).toBe('revoked');
    expect(verifyResult2.errors).toContain('Credential has been revoked');

    // 5. Check audit trail
    const auditReceipt1 = await getAuditReceipt(verifyResult1.audit_log_id);
    expect(auditReceipt1.verification_result).toBe('success');

    const auditReceipt2 = await getAuditReceipt(verifyResult2.audit_log_id);
    expect(auditReceipt2.verification_result).toBe('failure');
    expect(auditReceipt2.checks.revocation_status).toBe('revoked');
  });
});
```

### 5.2 CRS Computation Tests

**Test Harness:** `apps/api/backend/src/__tests__/unit/crsEngine.test.ts`

**Test Cases:**

- Perfect score (100): All components complete
- Grade A (90-100): One minor gap
- Grade B (80-89): Expired board certification
- Grade C (70-79): Missing DEA
- Grade D (60-69): Multiple gaps
- Grade F (<60): Critical credentials missing
- Deterministic: Same input → same score
- Cache hit: Second request returns cached result
- Cache miss: Expired cache triggers recomputation

### 5.3 Revocation Tests

**Test Cases:**

- Allocate status list index
- Revoke credential
- Check revocation status
- Generate StatusList2021 credential
- Bitstring encoding/decoding
- Concurrent revocations
- Status list rotation (when capacity reached)

### 5.4 Audit Middleware Tests

**Test Cases:**

- Audit receipt creation on success
- Audit receipt creation on failure
- Audit receipt includes all required fields
- Audit log storage
- OPA integration (mock)

## 6. Implementation Task Breakdown

### Phase 1: Revocation Infrastructure (Critical Path)

**Owner:** Claude Code
**Estimated Effort:** 4-6 hours

**Tasks:**

1. Create revocations + status_lists tables (Prisma schema)
2. Implement StatusListService (allocate, revoke, check, generate)
3. Integrate StatusList2021 library (@digitalbazaar/vc-status-list)
4. Add credentialStatus field to all credential issuers
5. Implement revocation API endpoints (POST, GET)
6. Write unit tests for StatusListService
7. Write integration tests for revocation endpoints

### Phase 2: Verifier Audit Trail

**Owner:** Claude Code
**Estimated Effort:** 3-4 hours

**Tasks:**

1. Create audit_logs table (Prisma schema)
2. Implement auditMiddleware
3. Create AuditReceiptService (generate, store, retrieve)
4. Integrate middleware into verifier-api routes
5. Add audit receipt generation to verification flow
6. Write unit tests for audit middleware
7. Write integration tests for audit logging

### Phase 3: CRS Engine

**Owner:** Claude Code
**Estimated Effort:** 5-7 hours

**Tasks:**

1. Create crs_cache table (Prisma schema)
2. Implement CRSEngine with deterministic scoring
3. Implement data source adapters (NPPES, state boards, etc.)
4. Implement cache strategy (24h TTL)
5. Create CRS API endpoint (GET /api/crs/:npi)
6. Write unit tests for CRS computation
7. Write integration tests for CRS endpoint
8. Document data source integration points

### Phase 4: E2E Test Harness

**Owner:** Claude Code
**Estimated Effort:** 2-3 hours

**Tasks:**

1. Set up E2E test infrastructure
2. Implement issue → verify → revoke → verify-fails flow
3. Add CRS correctness tests
4. Add audit receipt presence tests
5. Create test data fixtures

### Phase 5: UI Wiring (After API Stability)

**Owner:** Cursor
**Estimated Effort:** 3-4 hours

**Tasks:**

1. Implement CRSWidget component
2. Implement VerificationResult component
3. Implement RevocationPanel component
4. Integrate components into existing pages
5. Add error handling and loading states
6. Write Storybook stories

### Phase 6: Launch Readiness

**Owner:** Claude Code (automated checks)
**Estimated Effort:** 1-2 hours

**Tasks:**

1. Run revocation correctness tests
2. Run CRS correctness tests
3. Verify audit receipt presence in all verification flows
4. Run E2E test suite
5. Generate launch readiness report

## 7. Success Criteria

### Revocation

- ✅ Credentials include credentialStatus field with StatusList2021Entry
- ✅ Revocation endpoint successfully marks credentials as revoked
- ✅ Verification fails for revoked credentials
- ✅ StatusList2021 credentials are generated correctly
- ✅ E2E test flow passes: issue → verify → revoke → verify-fails

### CRS

- ✅ CRS endpoint returns deterministic scores
- ✅ All 7 scoring components implemented
- ✅ Grade mapping correct (A-F)
- ✅ Cache strategy works (24h TTL)
- ✅ Same input produces same score

### Audit Trail

- ✅ All verification attempts generate audit receipts
- ✅ Audit receipts include all required fields
- ✅ Audit logs stored in database
- ✅ OPA integration points defined (for future)

## 8. Security Considerations

### Revocation Security

- Revocation requests must be signed by issuer
- Status list credentials must be signed by issuer
- Bitstring updates must be atomic
- No PII in status lists (only bit indices)

### CRS Security

- NPI is non-PHI (public identifier)
- No sensitive provider data exposed in API responses
- Cache prevents excessive external API calls
- Rate limiting on CRS endpoint

### Audit Trail Security

- Audit logs are append-only
- No PII in audit receipts (use DIDs, not names)
- Audit logs retained for compliance (7 years)
- Access restricted to authorized verifiers

## 9. Deployment Considerations

### Database Migrations

- Run Prisma migrations for new tables
- Backfill credentialStatus for existing credentials (if applicable)

### Environment Variables

```bash
# StatusList2021
STATUS_LIST_BASE_URL=https://issuer.vitalcv.com/api/issuer/v1/status-lists

# CRS
CRS_CACHE_TTL_HOURS=24
NPPES_API_KEY=<api_key>
DEA_API_KEY=<api_key>
ABMS_API_KEY=<api_key>

# Audit
AUDIT_LOG_RETENTION_DAYS=2555  # 7 years
```

### Performance

- Status list bitstring operations are O(1)
- CRS cache reduces load on external APIs
- Audit logging is asynchronous (non-blocking)

## 10. Future Enhancements (Out of Scope for Wave 4)

- OPA policy engine integration
- CRS v2 with ML-based scoring
- Real-time data source integrations (webhooks)
- Audit log analytics dashboard
- Multi-tenant status list partitioning
- StatusList2021 to StatusList2022 migration

---

## Appendices

### A. StatusList2021 Specification

- **Standard:** W3C VC Status List 2021
- **URL:** <https://w3c.github.io/vc-status-list-2021/>
- **Library:** @digitalbazaar/vc-status-list

### B. Data Source API Documentation

- **NPPES:** <https://npiregistry.cms.hhs.gov/api-page>
- **OIG LEIE:** <https://oig.hhs.gov/exclusions/exclusions_list.asp>
- **SAM.gov:** <https://sam.gov/data-services/Exclusions>

### C. Related Standards

- **OpenID4VCI:** Credential issuance with status
- **OpenID4VP:** Presentation with revocation check
- **DIF Presentation Exchange:** Verification requirements

---

**Sign-Off Required From:**

- [ ] Tech Lead (Architecture approval)
- [ ] Security Engineer (Security review)
- [ ] Compliance Officer (Audit trail requirements)
- [ ] Product Manager (Feature prioritization)

**Next Steps:**

1. Review and approve design proposal
2. Run vitalcv:task-bundler to generate implementation tasks
3. Implement in forked context (Claude Code bulk implementation)
4. Run vitalcv:launch-readiness for certification

# Verifier Portal UI - Glossary

**Version**: 1.0.0
**Last Updated**: 2025-10-08
**Related Tasks**: VFE-0201 to VFE-0220
**Implementation**: `app/verify/page.tsx`

---

## Overview

This glossary defines UI concepts, components, and workflows for the Verifier Portal - the interface used by entities (employers, credential consumers, healthcare organizations) to verify the authenticity and status of verifiable credentials.

---

## 1. Verification Request Form (VFE-0201)

**Definition**: Input interface for submitting credential verification requests with required parameters.

**Synonyms**: Verification Form, Verification Input, Credential Lookup Form, Verify Form

**Key Fields**:
- **Credential ID** (required): Unique identifier of credential to verify
- **Nonce**: Auto-generated challenge for replay attack prevention
- **Audience**: Domain of requesting party (e.g., "vitalcv.com")
- **Privacy Mode**: Disclosure level selection (Plain, BBS+, ZK)

**UI Implementation**: `app/verify/page.tsx:189-284`

**User Flow**:
1. User enters credential ID
2. System auto-generates nonce
3. User selects privacy mode
4. User clicks "Check Status" or "Verify Presentation"
5. System displays results

**Validation**:
- Credential ID: Required, trimmed
- Nonce: Auto-generated, editable
- Audience: Defaults to current domain

---

## 2. Quick Status Check (VFE-0202)

**Definition**: Lightweight verification that checks only the revocation/validity status without full cryptographic proof verification.

**Synonyms**: Status Check, Quick Verify, Status Lookup, Simple Verification

**API Endpoint**: `GET /api/verifier/credential/{id}/status`

**Response Data**:
```typescript
{
  status: "valid" | "revoked" | "expired" | "unknown"
  credentialId: string
  auditRef?: string
  issuer?: string
  issuedDate?: string
  expiryDate?: string
  reason?: string // revocation reason if applicable
}
```

**Use Cases**:
- Quick validation before full verification
- Batch status checking
- Real-time monitoring dashboards
- Pre-screening in high-volume scenarios

**UI Behavior**:
- Button: "Check Status" with Search icon
- Loading state with spinner
- Results displayed in `CredentialStatusCard`
- Toast notification with summary

---

## 3. Full Presentation Verification (VFE-0203)

**Definition**: Comprehensive credential verification including cryptographic signature validation, issuer trust checks, and presentation proof verification.

**Synonyms**: Presentation Verification, Full Verification, Cryptographic Verification, VP Verification

**API Endpoint**: `POST /api/verifier/presentation`

**Request Payload**:
```typescript
{
  credentialId: string
  nonce: string
  audience: string
  privacyMode: boolean
  disclosureType: "plain" | "bbs" | "zk"
}
```

**Verification Steps**:
1. Signature verification (cryptographic proof)
2. Issuer trust check (trust registry lookup)
3. Revocation status check
4. Expiration validation
5. Nonce validation (replay attack prevention)
6. Audience binding check

**Privacy Modes**:
- **Plain**: Full disclosure, all claims visible
- **BBS+**: Selective disclosure, chosen claims only
- **ZK**: Zero-knowledge proof, minimal revelation

---

## 4. Privacy Mode Selector (VFE-0204)

**Definition**: UI control for selecting the level of privacy/disclosure during verification.

**Synonyms**: Disclosure Selector, Privacy Level Picker, Verification Mode

**Options**:
```tsx
<Select value={privacyMode} onValueChange={setPrivacyMode}>
  <SelectItem value="plain">Plain - Full disclosure</SelectItem>
  <SelectItem value="bbs">BBS+ - Selective disclosure</SelectItem>
  <SelectItem value="zk">ZK - Zero-knowledge proof</SelectItem>
</Select>
```

**Mode Descriptions**:

### Plain (Full Disclosure)
- All credential claims visible
- Traditional verification approach
- No privacy-preserving techniques
- Fastest verification

### BBS+ (Selective Disclosure)
- Holder selects which claims to reveal
- Cryptographic binding ensures integrity
- Verifier sees only selected attributes
- W3C BBS+ Signature standard

### ZK (Zero-Knowledge Proof)
- Prove statements without revealing data
- E.g., "Age > 18" without showing birthdate
- Maximum privacy preservation
- Computational overhead

---

## 5. Nonce Generation (VFE-0205)

**Definition**: Cryptographic challenge value used to prevent replay attacks in presentation verification.

**Synonyms**: Challenge, Random Challenge, Verification Nonce, Anti-Replay Token

**Technical Implementation**:
```typescript
// Auto-generated on page load
const nonce = Math.random().toString(36).substring(2, 15)
```

**Purpose**:
- Prevents replay attacks (attacker reusing valid presentation)
- Binds presentation to specific verification request
- Time-limited validity

**UI Behavior**:
- Auto-generated on page load
- Displayed in read-only input (editable for advanced users)
- Monospace font for readability
- Regenerated on each verification attempt

**Security Properties**:
- Unpredictable random value
- Single-use only
- Verified server-side against expected nonce

---

## 6. Audience Binding (VFE-0206)

**Definition**: Domain restriction that ensures a presentation is intended for a specific verifier.

**Synonyms**: Domain Binding, Verifier Binding, Intended Audience, Presentation Target

**Purpose**:
- Prevents presentation theft and reuse
- Ensures holder intended to share with this verifier
- Part of W3C VP security model

**Default Value**: `"vitalcv.com"` (current domain)

**UI Implementation**:
```tsx
<Input
  id="audience"
  type="text"
  value={audience}
  onChange={(e) => setAudience(e.target.value)}
/>
```

**Validation**:
- Server verifies audience matches verifier's domain
- Presentation rejected if audience mismatch
- Protects against cross-verifier credential theft

---

## 7. Verification Results Display (VFE-0207)

**Definition**: Visual presentation of credential verification outcome with status, metadata, and actions.

**Synonyms**: Results Panel, Verification Output, Status Display, Verification Report

**UI Components**:
- `CredentialStatusCard`: Primary result display
- Status badge (Valid/Revoked/Expired/Unknown)
- Metadata fields (Issuer, dates, reason)
- Action buttons (Share, QR code)
- Audit reference

**Layout**: Two-column grid (form left, results right) on desktop

**States**:
- **Empty**: Instructions + placeholder icon
- **Loading**: Skeleton loaders
- **Error**: Alert with error message
- **Success**: CredentialStatusCard with result

---

## 8. Sample Credential IDs (VFE-0208)

**Definition**: Pre-populated example credential IDs for testing and demonstration purposes.

**Synonyms**: Test Credentials, Demo IDs, Example Credentials, Sample Data

**Provided Samples**:
```typescript
CRED-12345          // Valid credential
CRED-revoked-001    // Revoked credential
CRED-unknown-999    // Unknown credential
```

**UI Display**:
```tsx
<code className="bg-gray-100 px-2 py-1 rounded">
  CRED-12345
</code>
```

**Purpose**:
- Enable testing without real credentials
- Demonstrate verification workflows
- Training and onboarding
- API documentation examples

---

## 9. Verification Loading States (VFE-0209)

**Definition**: UI feedback mechanisms during asynchronous verification operations.

**Synonyms**: Loading Indicators, Progress States, Verification Feedback

**Loading Indicators**:
1. **Button Loading**:
   - Spinner icon (`<Loader2 className="animate-spin">`)
   - Text change ("Verifying..." / "Checking...")
   - Disabled state

2. **Results Loading**:
   - Skeleton components
   - Pulse animation
   - Maintains layout structure

3. **Toast Notifications**:
   - "Status Check Complete"
   - "Verification Complete"
   - "Verification Failed" (error)

**Accessibility**:
- `aria-busy="true"` during loading
- Screen reader announcements on completion
- Focus management

---

## 10. Verification Error Handling (VFE-0210)

**Definition**: User-facing error messages and recovery options when verification fails.

**Synonyms**: Error Display, Failure Handling, Verification Errors, Error Recovery

**Error Types**:
```typescript
// Network errors
"Status check failed: 500 Internal Server Error"

// Invalid input
"Failed to verify credential. Please try again."

// Server errors
"Verification failed: 404 Not Found"
```

**UI Components**:
- Alert with destructive variant
- XCircle icon
- Error message text
- Toast notification

**Error Recovery**:
- Clear error on new verification attempt
- Preserve form values for retry
- Actionable error messages

---

## 11. Audit Reference Display (VFE-0211)

**Definition**: Unique identifier for each verification event, used for compliance tracking and forensic analysis.

**Synonyms**: Audit ID, Verification Reference, Compliance Reference, Audit Trail ID

**Format**: `AUD-{timestamp}-{random}` (e.g., `AUD-20251008-A7B9C2`)

**UI Display**:
```tsx
<div className="inline-flex items-center px-3 py-1 rounded-full text-xs bg-gray-100">
  Audit ref: {result.auditRef}
</div>
```

**Purpose**:
- Compliance tracking (HIPAA, SOC2)
- Forensic investigation
- Link verification to audit logs
- Support ticket reference

---

## 12. Verifier Dashboard View (VFE-0212)

**Definition**: Overview interface showing verification history, statistics, and recent activity.

**Synonyms**: Verifier Home, Verification Dashboard, Verifier Overview

**Dashboard Components** (future implementation):
- Recent verifications list
- Verification count by status
- Success/failure rate chart
- Quick verify widget
- Trusted issuer list
- Audit trail search

**Metrics**:
- Total verifications (30 days)
- Success rate percentage
- Average response time
- Most verified credential types

---

## 13. Verification History Log (VFE-0213)

**Definition**: Chronological record of all verification requests performed by the verifier.

**Synonyms**: Verification Log, Activity History, Verification Records, Audit Log

**Log Entry Fields**:
- Timestamp
- Credential ID
- Verification result (Valid/Revoked/Expired)
- Audit reference
- Verifier user
- Privacy mode used
- Response time

**UI Features**:
- Sortable columns
- Date range filter
- Status filter
- Search by credential ID
- Export to CSV
- Pagination

---

## 14. Trusted Issuer Registry (VFE-0214)

**Definition**: Configurable list of credential issuers that the verifier trusts and accepts.

**Synonyms**: Issuer Whitelist, Trust List, Accepted Issuers, Issuer Registry

**Issuer Entry**:
```typescript
{
  did: "did:web:ca.gov:medicalboard"
  name: "California Medical Board"
  accreditation: "State Government Authority"
  publicKey: "..."
  status: "active" | "suspended"
  addedDate: "2025-01-15"
}
```

**UI Features**:
- Add/remove issuers
- View issuer details
- Check issuer accreditation
- Filter by credential type
- Bulk import from trust framework

---

## 15. Verification Policy Configuration (VFE-0215)

**Definition**: Customizable rules that define which credentials and conditions the verifier accepts.

**Synonyms**: Verification Rules, Acceptance Policy, Verification Criteria, Verifier Policy

**Policy Parameters**:
- **Accepted Issuers**: DID/URI list
- **Credential Types**: Medical license, NPI, board cert, etc.
- **Expiration Tolerance**: Accept soon-to-expire credentials
- **Revocation Checks**: Always/Optional/Skip
- **Privacy Modes**: Allowed disclosure levels
- **Required Claims**: Mandatory credential fields

**Example Policy**:
```json
{
  "acceptedIssuers": ["did:web:ca.gov", "did:web:tx.gov"],
  "credentialTypes": ["MedicalLicense", "NPICredential"],
  "expirationTolerance": 30, // days
  "requireRevocationCheck": true,
  "allowedPrivacyModes": ["plain", "bbs"],
  "requiredClaims": ["licenseNumber", "state", "expiryDate"]
}
```

---

## 16. Batch Verification (VFE-0216)

**Definition**: Capability to verify multiple credentials simultaneously in a single operation.

**Synonyms**: Bulk Verification, Mass Verification, Multi-Credential Verify, Batch Check

**Use Cases**:
- Onboarding multiple providers
- Periodic credential re-validation
- Compliance audits
- Provider network updates

**UI Flow**:
1. Upload CSV with credential IDs
2. Select verification parameters
3. Initiate batch job
4. Monitor progress
5. Download results report

**Result Format**:
- Summary statistics
- Per-credential status
- Failed verifications with reasons
- Export to CSV/JSON

---

## 17. Verification API Keys (VFE-0217)

**Definition**: Authentication credentials for programmatic access to verification APIs.

**Synonyms**: API Credentials, Access Keys, API Tokens, Service Keys

**Key Properties**:
- **API Key**: Public identifier
- **API Secret**: Private authentication token
- **Permissions**: Read-only, verify, revoke
- **Rate Limits**: Requests per minute/hour
- **Expiration**: Optional time limit

**UI Features**:
- Generate new API key
- Rotate/revoke existing keys
- View usage statistics
- Set rate limits
- Audit API usage

**Security**:
- Store secrets encrypted
- Display secret once on creation
- Require 2FA for key management
- Log all API usage

---

## 18. Verification Webhooks (VFE-0218)

**Definition**: HTTP callbacks that notify external systems when verification events occur.

**Synonyms**: Event Notifications, Webhook Callbacks, Verification Events, Event Hooks

**Webhook Events**:
- `verification.completed`: Verification finished
- `verification.failed`: Verification error
- `credential.revoked`: Monitored credential revoked
- `credential.expiring`: Credential expiring soon

**Payload Example**:
```json
{
  "event": "verification.completed",
  "timestamp": "2025-10-08T14:30:00Z",
  "data": {
    "credentialId": "CRED-12345",
    "status": "valid",
    "auditRef": "AUD-20251008-A7B9C2",
    "verifierId": "VERIFIER-001"
  }
}
```

**Configuration**:
- Webhook URL endpoint
- Secret for signature verification
- Event type subscriptions
- Retry policy
- Timeout settings

---

## 19. Verification QR Code Scanner (VFE-0219)

**Definition**: Camera-based interface for scanning QR codes containing credential presentations or credential IDs.

**Synonyms**: QR Scanner, Mobile Verify, Camera Verification, Scan to Verify

**Use Cases**:
- In-person verification
- Event check-in
- Physical badge validation
- Mobile-first workflows

**QR Code Contents**:
- Credential ID
- Verifiable Presentation (VP) token
- Deep link to verification page
- Encrypted presentation payload

**UI Flow**:
1. User clicks "Scan QR Code"
2. Camera permission requested
3. Camera viewfinder displayed
4. QR code detected and decoded
5. Automatic verification initiated
6. Results displayed

**Security**:
- Verify QR code signature
- Check expiration timestamp
- Validate audience binding
- One-time use tokens

---

## 20. Verification Report Export (VFE-0220)

**Definition**: Downloadable documentation of verification results for compliance, auditing, and record-keeping.

**Synonyms**: Verification Certificate, Verification Report, Verification PDF, Compliance Report

**Report Formats**:
- **PDF**: Formatted document with logos, signatures
- **JSON**: Machine-readable verification data
- **CSV**: Tabular data for spreadsheets
- **HTML**: Viewable in browser

**Report Contents**:
- Verification timestamp
- Credential ID and details
- Verification result (Valid/Revoked/etc.)
- Issuer information
- Verifier information
- Audit reference
- Digital signature
- QR code for re-verification

**Use Cases**:
- Compliance documentation
- Credentialing file maintenance
- Legal proceedings
- Third-party audits

---

## UI Design Patterns

### Verification Form Layout
```
┌─────────────────────────────────┐
│ Credential Verification         │
├─────────────────────────────────┤
│ Credential ID *        [_______]│
│ Nonce (Auto-gen)       [_______]│
│ Audience               [_______]│
│ Privacy Mode           [▼______]│
│                                 │
│ [Check Status] [Verify Full]    │
└─────────────────────────────────┘
```

### Results Layout (Two-Column)
```
┌──────────────┬──────────────────┐
│ Form         │  Results         │
│              │                  │
│ [Inputs]     │  [Status Card]   │
│              │  [Metadata]      │
│ [Buttons]    │  [Actions]       │
└──────────────┴──────────────────┘
```

### Mobile Layout (Stacked)
```
┌────────────────────────┐
│ Form                   │
│ [Inputs]               │
│ [Buttons]              │
├────────────────────────┤
│ Results                │
│ [Status Card]          │
└────────────────────────┘
```

---

## Accessibility Requirements

**WCAG 2.1 AA Compliance**:
- ✅ Keyboard navigation for all controls
- ✅ Screen reader announcements for verification results
- ✅ Focus indicators on interactive elements
- ✅ Error messages linked to inputs
- ✅ Loading states announced
- ✅ High contrast mode support
- ✅ Touch targets minimum 44x44px
- ✅ Form labels properly associated

---

## Security Considerations

1. **Rate Limiting**: Prevent brute-force credential enumeration
2. **CAPTCHA**: On repeated failed attempts
3. **Audit Logging**: All verification attempts logged
4. **Input Validation**: Sanitize all user inputs
5. **API Authentication**: Require valid API keys for programmatic access
6. **Nonce Validation**: Prevent replay attacks
7. **Audience Binding**: Verify presentation intended for this verifier

---

## Performance Optimizations

1. **Caching**: Cache issuer public keys, trust registry
2. **Lazy Loading**: Load verification history on demand
3. **Debouncing**: Prevent rapid-fire verification requests
4. **Progress Indicators**: Show verification steps in progress
5. **Result Streaming**: Stream large batch verification results

---

## Compliance & Regulations

**HIPAA**: Audit trails, access controls, encryption
**SOC2**: Security monitoring, incident response
**GDPR**: Data minimization, right to access
**State Regulations**: Medical board verification requirements

---

## Related Documentation

- [Credential Management Glossary](./glossary-credential-management.md)
- [Component Library Glossary](./glossary-component-library.md)
- [Phase 1 Tracking](./phase1-tracking.md)

---

**Next Steps**: Implement missing features (batch verification, QR scanner, dashboard, API keys, webhooks, report export)

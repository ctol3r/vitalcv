# Credential Management UI - Glossary

**Version**: 1.0.0
**Last Updated**: 2025-10-08
**Related Tasks**: VFE-0101 to VFE-0120

---

## Overview

This glossary defines key concepts, components, and workflows for credential management in the VitalCV platform. The system follows **W3C Verifiable Credentials Data Model 1.1** standards and implements **privacy-preserving verification** with support for **selective disclosure** and **zero-knowledge proofs**.

---

## 1. Credential Status (VFE-0101)

**Definition**: The current state of a verifiable credential indicating whether it is valid, revoked, expired, or unknown.

**Synonyms**: Verification Status, Credential State, Validity Status, Credential Health

**Status Types**:
- **Valid**: Credential is active, not revoked, and not expired
- **Revoked**: Credential has been invalidated by the issuer
- **Expired**: Credential has passed its expiration date
- **Unknown**: Credential cannot be found in the verification system
- **Suspended**: Temporarily inactive (future support)

**UI Implementation**:
- Component: `CredentialStatusCard`
- Visual indicators: Color-coded badges and icons
  - Valid: Green (CheckCircle icon)
  - Revoked: Red (AlertTriangle icon)
  - Unknown: Gray (XCircle icon)
- Displays metadata: issuer, issue date, expiry date, revocation reason

**User Stories**:
- As a verifier, I want to quickly see if a credential is valid
- As a holder, I want to understand why my credential was revoked
- As an auditor, I need to track credential status changes over time

**Accessibility**: Status must not rely solely on color; use icons and text labels

---

## 2. Verifiable Credential (VC) (VFE-0102)

**Definition**: A tamper-evident credential with cryptographic proof of authorship that can be verified without contacting the issuer.

**Synonyms**: VC, Digital Credential, Cryptographic Credential, Attested Credential

**W3C Standard Components**:
- **@context**: JSON-LD context defining terms
- **type**: Credential types (e.g., VerifiableCredential, MedicalLicense)
- **issuer**: DID or URI of the issuing authority
- **issuanceDate**: ISO 8601 timestamp
- **credentialSubject**: Claims about the subject (holder)
- **proof**: Cryptographic signature (JWT, JSON-LD)

**Credential Types in VitalCV**:
- Medical License (state-specific)
- NPI (National Provider Identifier)
- Board Certification
- DEA Registration
- Medical Education (degree, residency, fellowship)
- Professional Liability Insurance
- Hospital Privileges
- CME (Continuing Medical Education) Credits

**UI Representation**:
```tsx
interface VerifiableCredential {
  id: string
  type: string[]
  issuer: string
  issuanceDate: string
  expirationDate?: string
  credentialSubject: {
    id: string // Holder DID
    [key: string]: any // Credential-specific claims
  }
  proof: {
    type: string
    created: string
    proofPurpose: string
    verificationMethod: string
    jws: string
  }
}
```

**Security Considerations**:
- Credentials are signed and tamper-evident
- Private keys never leave holder's wallet
- Verification can be done offline

---

## 3. Verifiable Presentation (VP) (VFE-0103)

**Definition**: A collection of one or more verifiable credentials, packaged together with proof of holder control, for presentation to a verifier.

**Synonyms**: VP, Credential Presentation, Proof Package, Attestation Bundle

**W3C Standard Components**:
- **@context**: JSON-LD context
- **type**: VerifiablePresentation
- **verifiableCredential**: Array of VCs
- **holder**: DID of the credential holder
- **proof**: Proof of holder control (signature)

**Use Cases**:
- Present multiple credentials in one interaction
- Prove control of credentials without revealing all data
- Enable selective disclosure of specific claims
- Generate time-limited presentation tokens

**UI Implementation**:
- VP Token generation via API (`/api/verifier/vp-token`)
- QR code display for mobile scanning
- One-time share URLs for secure sharing
- Presentation request flows

**Security Features**:
- Challenge-response to prevent replay attacks
- Time-bound presentations (expiry)
- Domain binding (presentation valid for specific verifier)
- Revocation checks at presentation time

---

## 4. Credential Verification (VFE-0104)

**Definition**: The process of cryptographically verifying the authenticity, integrity, and validity of a verifiable credential.

**Synonyms**: Verification Process, Credential Validation, Authentication Check, Trust Verification

**Verification Steps**:
1. **Signature Verification**: Verify cryptographic signature using issuer's public key
2. **Issuer Trust**: Check if issuer is in trusted issuer registry
3. **Revocation Check**: Query revocation list or status list
4. **Expiration Check**: Verify current date is before expirationDate
5. **Schema Validation**: Ensure credential conforms to expected schema
6. **Presentation Proof**: Verify holder control (for VPs)

**UI Flow**:
```
User enters credential ID
  ↓
System fetches credential
  ↓
Verification checks run
  ↓
Display CredentialStatusCard with result
  ↓
Show verification details and metadata
```

**Verification Modes**:
- **Online**: Real-time verification with revocation checks
- **Offline**: Verify signature and expiry without network (limited)
- **Batch**: Verify multiple credentials simultaneously
- **Continuous**: Monitor credential status over time

**Error Handling**:
- Invalid signature → Show error with explanation
- Expired credential → Display expiry date and renewal options
- Revoked credential → Show revocation reason and date
- Unknown issuer → Warning about untrusted issuer

---

## 5. Credential Revocation (VFE-0105)

**Definition**: The act of invalidating a previously issued credential, making it no longer trustworthy or acceptable for verification.

**Synonyms**: Credential Invalidation, Credential Cancellation, Credential Withdrawal

**Revocation Reasons**:
- License suspended or revoked by regulatory board
- Credential replaced or superseded
- Security compromise (private key leaked)
- Subject request (holder-initiated revocation)
- Administrative error in issuance
- Expiration (alternative to time-based expiry)

**Revocation Mechanisms**:
- **Revocation List 2020**: Published list of revoked credential IDs
- **Status List 2021**: Bitstring-based privacy-preserving status
- **Real-time API**: Query endpoint for credential status
- **Blockchain-based**: Immutable revocation records

**UI Components**:
- Revocation status badge (red, destructive variant)
- Revocation reason display
- Revocation date and timestamp
- Appeal or dispute process link (if applicable)

**Issuer Revocation Flow**:
```tsx
<Button
  variant="destructive"
  onClick={handleRevoke}
>
  Revoke Credential
</Button>

<Dialog>
  <DialogTitle>Revoke Credential</DialogTitle>
  <Select label="Reason">
    <option>License Expired</option>
    <option>Replaced by New Credential</option>
    <option>Security Compromise</option>
  </Select>
  <Textarea label="Additional Details" />
  <Button>Confirm Revocation</Button>
</Dialog>
```

**Privacy Considerations**:
- Revocation lists can leak information about verification activity
- Status List 2021 provides better privacy (herd privacy)
- Consider anonymous verification mechanisms

---

## 6. Credential Issuance (VFE-0106)

**Definition**: The process of creating, signing, and delivering a verifiable credential to a holder.

**Synonyms**: Credential Creation, Credential Generation, Credential Assignment, Credential Granting

**Issuance Workflow**:
1. **Application**: Holder submits credential request with supporting documents
2. **Verification**: Issuer verifies holder's identity and claims
3. **Approval**: Authorized personnel approve issuance
4. **Generation**: System creates VC with approved claims
5. **Signing**: Issuer's private key signs the credential
6. **Delivery**: Credential delivered to holder's wallet

**UI for Issuers** (`/issuer` page):
```tsx
<Card>
  <CardHeader>
    <CardTitle>Issue New Credential</CardTitle>
  </CardHeader>
  <CardContent>
    <Form>
      <Select label="Credential Type">
        <option>Medical License</option>
        <option>Board Certification</option>
        <option>NPI</option>
      </Select>
      <Input label="Holder DID" required />
      <Input label="License Number" />
      <DatePicker label="Issue Date" />
      <DatePicker label="Expiration Date" />
      <Button type="submit">Issue Credential</Button>
    </Form>
  </CardContent>
</Card>
```

**Validation Requirements**:
- Holder DID must be valid and resolvable
- Supporting documents must be uploaded and verified
- Issuer must have authority to issue this credential type
- All required fields must be completed
- Expiration date must be in the future

**Delivery Methods**:
- Direct to wallet (via DID communication)
- Download link (for manual import)
- QR code (for mobile wallet scanning)
- Email with secure link

---

## 7. Credential Metadata (VFE-0107)

**Definition**: Additional information about a credential beyond the core claims, including issuer details, dates, identifiers, and audit references.

**Synonyms**: Credential Properties, Credential Attributes, Metadata Fields, Credential Context

**Standard Metadata Fields**:
- **id**: Unique credential identifier (URI)
- **issuer**: Issuing authority (DID or URI)
- **issuanceDate**: When credential was issued
- **expirationDate**: When credential expires (optional)
- **credentialStatus**: Link to revocation/status endpoint
- **credentialSchema**: Schema defining credential structure
- **auditRef**: Reference for compliance audits
- **termsOfUse**: Conditions for using the credential

**VitalCV-Specific Metadata**:
- **issuerName**: Human-readable issuer name
- **credentialNumber**: License/certification number
- **jurisdictionCode**: State or country code
- **specialtyCode**: Medical specialty classification
- **complianceLevel**: SOC2, HIPAA compliance indicators
- **verificationCount**: Number of times verified
- **lastVerifiedAt**: Timestamp of last verification

**UI Display**:
- Metadata shown in expanded view or details panel
- Key metadata (issuer, dates) prominently displayed
- Technical metadata (DIDs, URIs) shown in monospace font
- Audit references displayed for compliance officers

**Search and Filter**:
- Filter credentials by issuer
- Filter by expiration date range
- Search by credential ID or number
- Filter by credential type or status

---

## 8. Digital Wallet (VFE-0108)

**Definition**: A secure digital container that stores, manages, and enables sharing of verifiable credentials.

**Synonyms**: Credential Wallet, Identity Wallet, VC Wallet, Holder Wallet

**Wallet Capabilities**:
- **Storage**: Securely store multiple credentials
- **Organization**: Categorize and tag credentials
- **Sharing**: Generate presentations and share credentials
- **Receiving**: Accept new credentials from issuers
- **Backup**: Encrypted backup and recovery
- **Portability**: Export credentials to other wallets

**Wallet Types**:
- **Mobile Wallet**: Native iOS/Android app
- **Browser Wallet**: Web-based wallet (WebAuthn)
- **Hardware Wallet**: Dedicated security device
- **Enterprise Wallet**: Organizational credential management

**VitalCV Wallet Integration**:
- Support for standard wallet protocols (DIDComm, CHAPI)
- QR code scanning for credential reception
- Deep linking for mobile app integration
- Wallet connection via WalletConnect protocol

**Security Features**:
- Biometric authentication (Face ID, Touch ID, fingerprint)
- PIN or password protection
- Key material never leaves device
- Encrypted local storage
- Secure enclaves for iOS/Android

**UI Considerations**:
- Simple, intuitive credential browsing
- Quick actions: share, view details, delete
- Visual distinction between credential types
- Expiration warnings and renewal prompts
- Verification history log

---

## 9. Credential Schema (VFE-0109)

**Definition**: A structured definition that specifies the required and optional fields, data types, and validation rules for a credential type.

**Synonyms**: Credential Template, Data Model, Credential Structure, Schema Definition

**Schema Components**:
- **JSON Schema**: Defines structure and validation rules
- **Context**: JSON-LD context mapping terms to URIs
- **Required Fields**: Mandatory credential properties
- **Optional Fields**: Additional properties
- **Data Types**: String, number, date, boolean, object, array
- **Validation Rules**: Format, min/max length, regex patterns

**Example: Medical License Schema**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "licenseNumber": {
      "type": "string",
      "pattern": "^[A-Z]{2}[0-9]{6}$"
    },
    "licenseType": {
      "type": "string",
      "enum": ["MD", "DO", "RN", "PA", "NP"]
    },
    "state": {
      "type": "string",
      "pattern": "^[A-Z]{2}$"
    },
    "issuanceDate": {
      "type": "string",
      "format": "date"
    },
    "expirationDate": {
      "type": "string",
      "format": "date"
    }
  },
  "required": ["licenseNumber", "licenseType", "state"]
}
```

**UI for Schema Management**:
- Schema editor for issuers
- Visual schema builder (form-based)
- Schema validation before credential issuance
- Schema versioning and migration

**Benefits**:
- Ensures data consistency across credentials
- Enables automated validation
- Facilitates interoperability between systems
- Supports credential discovery and search

---

## 10. Credential Types (VFE-0110)

**Definition**: Categories of verifiable credentials representing different professional qualifications, licenses, and attestations in healthcare.

**Synonyms**: Credential Categories, Qualification Types, License Types, Certification Classes

**Healthcare Credential Types**:

### 1. Medical License
- **Description**: State-issued license to practice medicine
- **Issuer**: State Medical Board
- **Key Fields**: License number, state, specialty, issue/expiry dates
- **Verification**: Real-time status check with state board

### 2. NPI (National Provider Identifier)
- **Description**: Unique 10-digit identifier for healthcare providers
- **Issuer**: CMS (Centers for Medicare & Medicaid Services)
- **Key Fields**: NPI number, provider type, taxonomy code
- **Verification**: NPPES database lookup

### 3. Board Certification
- **Description**: Specialty certification from medical board
- **Issuer**: ABMS member board (e.g., American Board of Internal Medicine)
- **Key Fields**: Specialty, sub-specialty, certification number, maintenance of certification (MOC) status
- **Verification**: Board-specific verification systems

### 4. DEA Registration
- **Description**: Registration to prescribe controlled substances
- **Issuer**: Drug Enforcement Administration
- **Key Fields**: DEA number, schedule classes, state
- **Verification**: DEA registration verification

### 5. Medical Education
- **Description**: Degree, residency, fellowship completion
- **Issuer**: Medical school, residency program
- **Key Fields**: Degree type (MD, DO), institution, graduation date, specialty training
- **Verification**: ACGME or school verification

### 6. Hospital Privileges
- **Description**: Authorization to practice at specific hospital
- **Issuer**: Hospital credentialing office
- **Key Fields**: Hospital name, department, privileges granted, effective dates
- **Verification**: Hospital verification

### 7. Professional Liability Insurance
- **Description**: Malpractice insurance coverage
- **Issuer**: Insurance provider
- **Key Fields**: Policy number, coverage limits, effective dates
- **Verification**: Insurance carrier verification

### 8. CME Credits
- **Description**: Continuing Medical Education hours
- **Issuer**: CME provider (ACCME-accredited)
- **Key Fields**: Credit hours, category (1, 2), topic, completion date
- **Verification**: CME provider records

**UI Organization**:
- Credential library view grouped by type
- Type-specific icons and colors
- Filter by credential type
- Type-based templates for issuance

---

## 11. Credential Holder (VFE-0111)

**Definition**: The individual or entity who possesses and controls a verifiable credential, typically the subject of the credential's claims.

**Synonyms**: Credential Owner, Subject, Holder, Credential Possessor, Credentialed Individual

**Holder Roles**:
- **Primary Holder**: The physician or healthcare professional
- **Delegate**: Authorized representative (e.g., office manager)
- **Organization**: Healthcare organization holding provider credentials

**Holder Responsibilities**:
- Maintain credential security (protect private keys)
- Keep credentials up to date
- Respond to verification requests
- Renew credentials before expiration
- Report compromised credentials

**Holder DID (Decentralized Identifier)**:
- Unique identifier for the holder (e.g., `did:web:example.com:users:123`)
- Controls credential access and sharing
- Used in presentations to prove credential ownership

**UI for Holders** (Dashboard):
```tsx
<Card>
  <CardHeader>
    <CardTitle>My Credentials</CardTitle>
    <CardAction>
      <Button>Add Credential</Button>
    </CardAction>
  </CardHeader>
  <CardContent>
    {credentials.map(credential => (
      <CredentialCard key={credential.id}>
        <Badge variant={credential.status}>{credential.status}</Badge>
        <h3>{credential.type}</h3>
        <p>Issued by: {credential.issuer}</p>
        <p>Expires: {credential.expirationDate}</p>
        <Button variant="outline">Share</Button>
        <Button variant="ghost">Details</Button>
      </CredentialCard>
    ))}
  </CardContent>
</Card>
```

**Holder Privacy**:
- Selective disclosure (share only necessary claims)
- Unlinkable presentations (prevent tracking)
- No issuer notification when sharing credentials
- Zero-knowledge proofs for sensitive attributes

---

## 12. Credential Issuer (VFE-0113)

**Definition**: A trusted authority that creates, signs, and distributes verifiable credentials to holders after verifying their qualifications.

**Synonyms**: Issuing Authority, Credential Provider, Attestor, Certifying Body

**Issuer Types in Healthcare**:
- **Government Agencies**: State medical boards, DEA, CMS
- **Professional Organizations**: ABMS boards, ACGME
- **Healthcare Organizations**: Hospitals, clinics (for privileges)
- **Educational Institutions**: Medical schools, residency programs
- **Insurance Providers**: For liability coverage credentials

**Issuer DID**:
- Unique identifier for the issuer (e.g., `did:web:medicalboard.ca.gov`)
- Public key published for signature verification
- Listed in trust registry

**Issuer Responsibilities**:
- Verify applicant identity and qualifications
- Issue accurate, complete credentials
- Maintain revocation infrastructure
- Provide verification endpoints
- Comply with regulatory requirements (SOC2, HIPAA)

**UI for Issuers** (`/issuer` page):
- Credential issuance forms
- Pending application queue
- Approval workflow
- Bulk issuance tools
- Revocation management
- Analytics and reporting

**Trust Registry**:
- List of authorized issuers
- Issuer accreditation status
- Public key resolution
- Governance framework compliance

---

## 13. Credential Verifier (VFE-0113)

**Definition**: An entity that requests, receives, and verifies credentials to make access or authorization decisions.

**Synonyms**: Relying Party, Validator, Credential Consumer, Verification Entity

**Verifier Types**:
- **Employers**: Hospitals, clinics hiring physicians
- **Credentialing Services**: Third-party verification
- **Insurance Companies**: For provider networks
- **Regulators**: For audits and compliance
- **Patients**: For provider credibility (public verification)

**Verifier Workflow**:
1. **Request**: Send presentation request to holder
2. **Receive**: Accept verifiable presentation
3. **Verify**: Run cryptographic verification
4. **Check Status**: Query revocation status
5. **Validate**: Ensure credentials meet requirements
6. **Decide**: Accept or reject based on verification result

**UI for Verifiers** (`/verify` page):
```tsx
<Card>
  <CardHeader>
    <CardTitle>Verify Credential</CardTitle>
  </CardHeader>
  <CardContent>
    <Input
      label="Credential ID or QR Code"
      placeholder="Enter credential ID"
    />
    <Button onClick={handleVerify}>Verify</Button>

    {verificationResult && (
      <CredentialStatusCard result={verificationResult} />
    )}
  </CardContent>
</Card>
```

**Verification Policies**:
- Minimum credential types required
- Acceptable issuers (trust list)
- Expiration tolerance
- Revocation check requirements
- Selective disclosure requirements

**Audit Trail**:
- Log all verification attempts
- Record verification results
- Track verifier identity
- Maintain for compliance (HIPAA, SOC2)

---

## 14. Selective Disclosure (VFE-0114)

**Definition**: A privacy-preserving technique that allows holders to reveal only specific claims from a credential, rather than the entire credential.

**Synonyms**: Minimal Disclosure, Privacy-Preserving Sharing, Attribute Selection, Partial Revelation

**Use Cases**:
- Share only license number, not home address
- Prove age without revealing birthdate
- Confirm board certification without showing scores
- Verify employment without disclosing salary

**Technical Approaches**:
- **JSON-LD BBS+ Signatures**: Cryptographic selective disclosure
- **ZK-SNARKs/ZK-STARKs**: Zero-knowledge proofs
- **Attribute-Based Credentials**: Per-attribute signatures
- **Merkle Disclosure Proofs**: Hash tree-based hiding

**UI Implementation**:
```tsx
<Dialog>
  <DialogTitle>Select Claims to Share</DialogTitle>
  <DialogContent>
    <Checkbox checked={disclosure.licenseNumber}>
      License Number
    </Checkbox>
    <Checkbox checked={disclosure.state}>
      State
    </Checkbox>
    <Checkbox checked={disclosure.specialty}>
      Specialty
    </Checkbox>
    <Checkbox checked={disclosure.address} disabled>
      Home Address (optional)
    </Checkbox>
    <Button>Share Selected Claims</Button>
  </DialogContent>
</Dialog>
```

**Benefits**:
- Enhanced privacy for holders
- Compliance with data minimization principles (GDPR, HIPAA)
- Reduced data breach risk
- User trust and adoption

**Challenges**:
- Cryptographic complexity
- Browser/wallet support
- Issuer adoption
- Performance overhead

---

## 15. Credential Expiry (VFE-0115)

**Definition**: The date and time after which a credential is no longer considered valid, requiring renewal or reissuance.

**Synonyms**: Expiration Date, Validity Period, Credential Lifetime, End Date

**Expiry Policies**:
- **Fixed Duration**: Credentials valid for specific period (e.g., 2 years)
- **Regulatory**: Expiry based on state/federal regulations
- **Conditional**: Expiry based on MOC (Maintenance of Certification) status
- **No Expiry**: Credentials valid indefinitely until revoked

**UI Indicators**:
- Expiration date prominently displayed
- Visual warnings for expiring credentials:
  - 90+ days: Green (OK)
  - 30-89 days: Yellow (Warning)
  - <30 days: Orange (Urgent)
  - Expired: Red (Expired)
- Push notifications or email reminders

**Renewal Workflow**:
```tsx
<Card>
  <CardHeader>
    <CardTitle>Expiring Soon</CardTitle>
  </CardHeader>
  <CardContent>
    <Alert variant="warning">
      <AlertTriangle />
      <AlertDescription>
        Your medical license expires in 45 days.
      </AlertDescription>
    </Alert>
    <Button>Start Renewal Process</Button>
  </CardContent>
</Card>
```

**Grace Period**:
- Some credentials allow short grace period after expiry
- UI shows "Grace Period" status with countdown
- Verifiers may accept or reject grace period credentials

**Automatic Expiry**:
- System automatically marks credentials as expired
- Expired credentials cannot be verified as valid
- Holder notified of expiration

---

## 16. Credential Sharing (VFE-0116)

**Definition**: The process of securely transmitting credentials from holder to verifier for verification purposes.

**Synonyms**: Credential Presentation, Credential Transmission, Credential Delivery, Proof Sharing

**Sharing Methods**:

### 1. QR Code
- Generate QR code with VP token or credential URI
- Scan with verifier mobile app
- Secure, offline-capable
```tsx
<Dialog>
  <DialogTitle>Share via QR Code</DialogTitle>
  <QRCode value={vpToken} size={256} />
  <p>Scan this code with verifier's app</p>
</Dialog>
```

### 2. One-Time Link
- Generate time-limited, single-use URL
- Share via email, SMS, or messaging
- URL expires after 1 hour or first access
```tsx
const shareUrl = await generateOneTimeUrl(credentialId)
// https://vitalcv.com/share/abc123xyz (expires in 1 hour)
```

### 3. Deep Link
- Direct link to credential in mobile wallet
- Opens native wallet app
- Uses custom URL scheme (`vitalcv://credential/123`)

### 4. DIDComm
- Peer-to-peer encrypted messaging
- Secure, private communication channel
- Requires DID resolution

### 5. Email/Download
- Send encrypted credential file
- Recipient imports into their system
- Less secure, requires manual verification

**Security Considerations**:
- Encrypt presentations in transit (HTTPS, TLS)
- Bind presentations to specific verifier (domain binding)
- Time-limit presentation validity
- Prevent replay attacks with nonces
- Audit all sharing events

**UI Components**:
- Share button with multiple methods
- One-time URL generator
- QR code display
- Copy-to-clipboard functionality
- Share history log

---

## 17. Credential Audit Trail (VFE-0117)

**Definition**: A comprehensive, immutable log of all events in a credential's lifecycle for compliance, accountability, and forensic analysis.

**Synonyms**: Activity Log, Event History, Audit Log, Compliance Record, Transaction History

**Logged Events**:
- **Issuance**: Credential issued to holder
- **Verification**: Credential verified by relying party
- **Sharing**: Credential shared with verifier
- **Revocation**: Credential revoked with reason
- **Expiration**: Credential expired
- **Renewal**: Credential renewed or reissued
- **Access**: Credential viewed by holder
- **Modification**: Metadata or status updated
- **Export**: Credential exported from wallet

**Audit Entry Structure**:
```typescript
interface AuditEntry {
  timestamp: string // ISO 8601
  eventType: AuditEventType
  actor: string // DID or identifier
  actorRole: 'issuer' | 'holder' | 'verifier' | 'system'
  credentialId: string
  action: string
  details?: Record<string, any>
  ipAddress?: string
  userAgent?: string
  auditRef: string // Unique audit reference
}
```

**UI for Audit Trail**:
```tsx
<Card>
  <CardHeader>
    <CardTitle>Audit Trail</CardTitle>
    <CardDescription>Credential ID: {credentialId}</CardDescription>
  </CardHeader>
  <CardContent>
    <Timeline>
      {auditEntries.map(entry => (
        <TimelineItem key={entry.auditRef}>
          <TimelineTime>{entry.timestamp}</TimelineTime>
          <TimelineIcon>{getEventIcon(entry.eventType)}</TimelineIcon>
          <TimelineContent>
            <strong>{entry.eventType}</strong>
            <p>{entry.action}</p>
            <Badge>{entry.actorRole}</Badge>
          </TimelineContent>
        </TimelineItem>
      ))}
    </Timeline>
  </CardContent>
</Card>
```

**Compliance Requirements**:
- **HIPAA**: Audit trails for PHI access
- **SOC2**: Monitoring and logging of security events
- **GDPR**: Right to access logs about personal data
- **State Regulations**: Medical board audit requirements

**Retention Policy**:
- Audit logs retained for 7 years (HIPAA requirement)
- Immutable storage (append-only)
- Regular backups
- Secure storage with access controls

**Audit Reference** (`auditRef`):
- Unique identifier for each audit entry
- Displayed on CredentialStatusCard
- Used for compliance reporting and investigations
- Format: `AUD-{timestamp}-{random}` (e.g., `AUD-20251008-A7B9C2`)

---

## 18. Trust Framework (VFE-0118)

**Definition**: A governance structure that defines rules, policies, and technical standards for issuing, verifying, and managing credentials within a trusted ecosystem.

**Synonyms**: Governance Framework, Trust Model, Credential Ecosystem, PKI Framework, Trust Infrastructure

**Components**:

### 1. Trust Registry
- Authoritative list of trusted issuers
- Issuer accreditation status
- Public key infrastructure (PKI)
- Revocation lists

### 2. Governance Rules
- Who can issue credentials
- What credential types are recognized
- Verification requirements
- Liability and legal terms

### 3. Technical Standards
- W3C Verifiable Credentials
- DID Methods (did:web, did:key, did:ion)
- Signature formats (JWT, JSON-LD)
- Presentation protocols

### 4. Trust Anchors
- Root certificate authorities
- Government authorities
- Professional organizations (e.g., ABMS, ACGME)

**VitalCV Trust Framework**:
- **Issuers**: State medical boards, ABMS, CMS, accredited institutions
- **Credential Types**: Medical licenses, board certifications, NPI, DEA, education
- **Verification**: Real-time status checks, cryptographic verification
- **Governance**: VitalCV Trust Framework v1.0 (published document)

**UI for Trust Verification**:
```tsx
<Card>
  <CardHeader>
    <CardTitle>Issuer Trust Status</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="flex items-center gap-2">
      <Badge variant={issuer.trusted ? "default" : "destructive"}>
        {issuer.trusted ? "Trusted" : "Untrusted"}
      </Badge>
      <span>{issuer.name}</span>
    </div>
    {issuer.trusted && (
      <>
        <p>Accredited by: {issuer.accreditation}</p>
        <p>DID: <code>{issuer.did}</code></p>
        <Button variant="link">View Issuer Profile</Button>
      </>
    )}
    {!issuer.trusted && (
      <Alert variant="destructive">
        <AlertTriangle />
        <AlertDescription>
          This issuer is not in the VitalCV trust registry.
          Proceed with caution.
        </AlertDescription>
      </Alert>
    )}
  </CardContent>
</Card>
```

**Benefits**:
- Establishes trust without central authority
- Enables interoperability
- Provides legal clarity
- Reduces fraud and misrepresentation

---

## 19. Credential Lifecycle (VFE-0119)

**Definition**: The complete journey of a credential from initial request through issuance, active use, renewal, and eventual expiration or revocation.

**Synonyms**: Credential Journey, Lifecycle Management, Credential States, Credential Flow

**Lifecycle Stages**:

### 1. Request / Application
- Holder submits application
- Provides supporting documentation
- Status: `pending`

### 2. Verification / Review
- Issuer verifies identity and qualifications
- Manual review by authorized personnel
- Status: `under-review`

### 3. Approval / Rejection
- Application approved or rejected
- If rejected, reason provided
- Status: `approved` or `rejected`

### 4. Issuance
- Credential generated and signed
- Delivered to holder's wallet
- Status: `issued`

### 5. Active / Valid
- Credential in use
- Regularly verified by relying parties
- Status: `active`

### 6. Expiring Soon
- Approaching expiration date (e.g., <90 days)
- Renewal reminders sent
- Status: `expiring-soon`

### 7. Renewal / Reissuance
- Holder renews credential
- New credential issued (may supersede old one)
- Status: `renewed`

### 8. Expired
- Past expiration date
- No longer valid for verification
- Status: `expired`

### 9. Revoked
- Invalidated by issuer
- Permanently invalid (cannot be un-revoked)
- Status: `revoked`

### 10. Archived
- Historical record, no longer in active use
- Retained for compliance and audit
- Status: `archived`

**UI Visualization**:
```tsx
<Stepper currentStep={credentialStatus}>
  <Step label="Application" status="completed" />
  <Step label="Review" status="completed" />
  <Step label="Issued" status="completed" />
  <Step label="Active" status="current" />
  <Step label="Renewal" status="upcoming" />
</Stepper>
```

**Lifecycle Analytics**:
- Average time from application to issuance
- Credential expiration rate
- Renewal success rate
- Revocation rate by reason
- Verification frequency over time

---

## 20. Credential Portability (VFE-0120)

**Definition**: The ability to export, import, and use credentials across different systems, platforms, and wallets without vendor lock-in.

**Synonyms**: Interoperability, Cross-Platform Compatibility, Credential Migration, Data Portability

**Portability Features**:

### 1. Standard Formats
- W3C Verifiable Credentials (JSON-LD, JWT)
- Standard DID methods
- Common signature algorithms (EdDSA, ES256K)
- Ensures credentials work across platforms

### 2. Export Capabilities
- Export credentials as JSON files
- Backup wallet contents
- Generate portable presentation formats
- QR codes for cross-device transfer

### 3. Import Capabilities
- Import credentials from other wallets
- Scan QR codes to receive credentials
- Import from file upload
- DIDComm-based credential transfer

### 4. Multi-Wallet Support
- Sync credentials across devices
- Use same credentials in multiple wallets
- Delegate access to authorized representatives

**UI for Export**:
```tsx
<Card>
  <CardHeader>
    <CardTitle>Export Credentials</CardTitle>
  </CardHeader>
  <CardContent>
    <Select label="Export Format">
      <option value="json-ld">JSON-LD (W3C Standard)</option>
      <option value="jwt">JWT (Compact)</option>
      <option value="backup">Encrypted Backup</option>
    </Select>
    <Checkbox checked={includePrivateKeys}>
      Include private keys (use only for backup)
    </Checkbox>
    <Button onClick={handleExport}>
      <Download className="mr-2" />
      Export
    </Button>
  </CardContent>
</Card>
```

**UI for Import**:
```tsx
<Card>
  <CardHeader>
    <CardTitle>Import Credentials</CardTitle>
  </CardHeader>
  <CardContent>
    <Tabs>
      <TabsList>
        <TabsTrigger value="file">File Upload</TabsTrigger>
        <TabsTrigger value="qr">QR Code</TabsTrigger>
        <TabsTrigger value="url">From URL</TabsTrigger>
      </TabsList>
      <TabsContent value="file">
        <UploadDropzone accept=".json" onDrop={handleImport} />
      </TabsContent>
      <TabsContent value="qr">
        <QRScanner onScan={handleQRImport} />
      </TabsContent>
      <TabsContent value="url">
        <Input label="Credential URL" />
        <Button>Import</Button>
      </TabsContent>
    </Tabs>
  </CardContent>
</Card>
```

**Benefits**:
- User freedom and choice
- Avoid vendor lock-in
- Enable ecosystem growth
- Compliance with data portability regulations (GDPR Article 20)

**Challenges**:
- Key management during migration
- Ensuring credential integrity
- Wallet compatibility
- User experience complexity

---

## Design System Integration

### Color Coding for Credential Status
- **Valid**: Green (`bg-green-50`, `text-green-600`, `border-green-200`)
- **Revoked**: Red (`bg-red-50`, `text-red-600`, `border-red-200`)
- **Expired**: Orange (`bg-orange-50`, `text-orange-600`, `border-orange-200`)
- **Unknown**: Gray (`bg-gray-50`, `text-gray-600`, `border-gray-200`)

### Icons
- Valid: `<CheckCircle />` (green)
- Revoked: `<AlertTriangle />` (red)
- Expired: `<Clock />` (orange)
- Unknown: `<XCircle />` (gray)
- Sharing: `<Share2 />`, `<QrCode />`
- Verification: `<Shield />`, `<Lock />`

### Typography
- Credential IDs: Monospace font (`font-mono`), small size (`text-xs`)
- Dates: Standard format, localized
- Status badges: Uppercase, small, semibold

### Accessibility
- Status conveyed through text, icons, AND color
- Keyboard navigation for all credential actions
- Screen reader announcements for status changes
- Focus management in dialogs and modals
- ARIA labels for icon buttons

---

## Compliance & Regulations

### HIPAA (Health Insurance Portability and Accountability Act)
- Audit trails for all PHI access
- Encryption at rest and in transit
- Access controls and authentication
- Business associate agreements

### SOC2 (Service Organization Control 2)
- Security monitoring and logging
- Incident response procedures
- Access reviews
- Vendor risk management

### GDPR (General Data Protection Regulation)
- Right to access personal data
- Right to erasure (where applicable)
- Data portability
- Privacy by design

### State Medical Board Requirements
- Accurate credential information
- Timely revocation reporting
- Verification response times
- Data retention periods

---

## Next Steps

1. ✅ Complete glossary for Credential Management UI concepts
2. ⏳ Review `CredentialStatusCard` component for design system consistency
3. ⏳ Create Storybook stories for credential components
4. ⏳ Write unit tests for credential verification flows
5. ⏳ Document API endpoints for credential operations
6. ⏳ Create user flows for issuer, holder, and verifier personas
7. ⏳ Design and implement missing credential components:
   - Credential list/grid view
   - Credential detail view
   - Verification request form
   - Issuance form
   - Sharing dialog with method selection
   - Audit trail timeline

---

## References

- **W3C Verifiable Credentials**: https://www.w3.org/TR/vc-data-model/
- **W3C DIDs**: https://www.w3.org/TR/did-core/
- **Status List 2021**: https://w3c-ccg.github.io/vc-status-list-2021/
- **BBS+ Signatures**: https://w3c-ccg.github.io/ldp-bbs2020/
- **NPPES (NPI Registry)**: https://npiregistry.cms.hhs.gov/
- **HIPAA Security Rule**: https://www.hhs.gov/hipaa/for-professionals/security/
- **SOC2**: https://www.aicpa.org/soc

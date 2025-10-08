# Issuer Portal UI Glossary (VFE-0301 to VFE-0320)

**Version**: 1.0
**Date**: 2025-10-08
**Category**: Phase 1 - Issuer Portal UI
**Task Range**: VFE-0301 to VFE-0320

---

## Overview

This glossary defines the 20 core UI concepts and components for the **Issuer Portal**, which enables authorized entities (healthcare boards, licensing authorities, educational institutions) to issue, manage, and revoke verifiable credentials. The issuer portal serves as the administrative interface for credential lifecycle management.

**Primary Functions**:
- Issue new verifiable credentials with metadata
- Revoke existing credentials with audit trail
- View and manage issued credentials
- Configure credential templates and policies
- Monitor issuance analytics

**Key Standards**:
- W3C Verifiable Credentials Data Model 1.1
- DID (Decentralized Identifier) resolution
- JSON-LD credential formatting
- OAuth 2.0/OIDC for issuer authentication
- Digital signature schemes (Ed25519, ECDSA secp256k1)

**Compliance Requirements**:
- HIPAA: PHI protection in healthcare credentials
- SOC2: Access control and audit logging
- GDPR: Data minimization and purpose limitation
- 21 CFR Part 11: Electronic signatures and records (FDA)

---

## VFE-0301: Credential Issuance Form

### Definition
A structured form interface for creating and issuing new verifiable credentials, capturing essential metadata including credential type, subject identifier, license number, issuing authority, expiration date, and additional claims.

### Synonyms
- **Credential Creation Form**: Emphasizes creation aspect
- **Issuance Request Form**: Highlights request workflow
- **Credential Builder**: Interactive construction metaphor
- **Credential Wizard**: Step-by-step guided process

### Technical Implementation

**Current Implementation** (`app/issuer/page.tsx:262-371`):
```typescript
const [issueForm, setIssueForm] = useState({
  credentialType: "",
  subjectId: "",
  licenseNumber: "",
  issuingAuthority: "",
  expiryDate: "",
  additionalData: "", // JSON string
})

const handleIssueCredential = async (e: React.FormEvent) => {
  e.preventDefault()
  setLoading(true)

  const response = await fetch("/api/issuer/credential", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: issueForm.credentialType,
      subjectId: issueForm.subjectId,
      licenseNumber: issueForm.licenseNumber,
      issuingAuthority: issueForm.issuingAuthority,
      expiryDate: issueForm.expiryDate,
      additionalData: issueForm.additionalData ? JSON.parse(issueForm.additionalData) : undefined,
    }),
  })

  const data = await response.json()
  const newCredential = {
    id: data.credentialId || `CRED-${Date.now()}`,
    type: issueForm.credentialType,
    holder: issueForm.subjectId,
    issuer: issueForm.issuingAuthority,
    status: "active",
    issuedDate: new Date().toISOString().split("T")[0],
    expiryDate: issueForm.expiryDate,
  }

  toast({ title: "Credential Issued", description: `Credential ${data.credentialId} issued` })
}
```

### UI Implementation

**Component Structure**:
```tsx
<Card>
  <CardHeader>
    <CardTitle>Issue New Credential</CardTitle>
    <CardDescription>Create and issue a new verifiable credential</CardDescription>
  </CardHeader>
  <CardContent>
    <form onSubmit={handleIssueCredential} className="space-y-4">
      {/* Credential Type & License Number */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select value={credentialType} onValueChange={setCredentialType}>
          <SelectTrigger><SelectValue placeholder="Select credential type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Medical License">Medical License</SelectItem>
            <SelectItem value="Board Certification">Board Certification</SelectItem>
            <SelectItem value="DEA Registration">DEA Registration</SelectItem>
          </SelectContent>
        </Select>
        <Input type="text" placeholder="License Number" required />
      </div>

      {/* Subject ID & Issuing Authority */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input type="text" placeholder="Subject ID (NPI, email)" required />
        <Input type="text" placeholder="Issuing Authority" required />
      </div>

      {/* Expiry Date */}
      <Input type="date" label="Expiry Date" />

      {/* Additional Data (JSON) */}
      <Textarea placeholder='{"specialization": "Cardiology"}' rows={3} />

      <Button type="submit" className="w-full">Issue Credential</Button>
    </form>
  </CardContent>
</Card>
```

### Security Considerations

**Input Validation**:
- Sanitize JSON input to prevent injection attacks
- Validate subject IDs against allowed formats (NPI: 10 digits, email: RFC 5322)
- Enforce license number format per credential type
- Limit additional data size (max 100KB)

**Authorization**:
- Verify issuer has authority for credential type (e.g., California Medical Board can only issue CA licenses)
- Require multi-factor authentication for high-value credentials (DEA, controlled substances)
- Log all issuance attempts with IP address and user ID

**Cryptographic Signing**:
- Sign credential with issuer's private key (Ed25519 or ECDSA secp256k1)
- Include proof object with signature, verification method, and created timestamp
- Store signature in tamper-evident format (linked data proof)

### Accessibility Requirements (WCAG 2.1 AA)

- **Form Labels**: All inputs must have associated `<Label>` with `htmlFor` attribute
- **Required Fields**: Indicate with asterisk (*) and `aria-required="true"`
- **Error Messages**: Display inline with `role="alert"` and `aria-live="assertive"`
- **Keyboard Navigation**: Tab order follows visual layout (credential type → license number → subject ID → authority → expiry → additional data → submit)
- **Screen Reader Support**: Announce form validation errors and success messages
- **Focus Management**: Return focus to first error field on validation failure

### User Experience Best Practices

**Progressive Disclosure**:
- Show "Additional Data" field only after required fields are complete
- Provide credential type-specific field hints (e.g., "NPI format: 1234567890")

**Autosave**:
- Save draft to localStorage every 30 seconds
- Restore draft on page reload with confirmation dialog

**Credential Templates**:
- Pre-populate form with saved templates (e.g., "Standard Medical License")
- Allow saving current form as template for reuse

**Batch Issuance**:
- Upload CSV with multiple credentials (bulk issuance)
- Show progress bar and success/failure count

---

## VFE-0302: Credential Type Selection

### Definition
A dropdown selector for choosing the type of verifiable credential to issue, determining the schema, required fields, and validation rules for the credential.

### Synonyms
- **Credential Category Picker**: Category-based organization
- **Credential Schema Selector**: Emphasizes schema selection
- **Credential Template Chooser**: Template-based approach
- **Credential Class Dropdown**: Class hierarchy metaphor

### Technical Implementation

**Current Implementation** (`app/issuer/page.tsx:266-280`):
```typescript
<Select
  value={issueForm.credentialType}
  onValueChange={(value) => setIssueForm((prev) => ({ ...prev, credentialType: value }))}
>
  <SelectTrigger className="mt-1">
    <SelectValue placeholder="Select credential type" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="Medical License">Medical License</SelectItem>
    <SelectItem value="Board Certification">Board Certification</SelectItem>
    <SelectItem value="DEA Registration">DEA Registration</SelectItem>
    <SelectItem value="Nursing License">Nursing License</SelectItem>
    <SelectItem value="Pharmacy License">Pharmacy License</SelectItem>
  </SelectContent>
</Select>
```

**Enhanced with Schema-Driven Configuration**:
```typescript
interface CredentialTypeConfig {
  id: string
  name: string
  description: string
  schema: string // JSON-LD schema URL
  requiredFields: string[]
  validationRules: Record<string, (value: any) => boolean>
  expiryRequired: boolean
  signingAlgorithm: "Ed25519" | "ECDSA-secp256k1"
}

const CREDENTIAL_TYPES: CredentialTypeConfig[] = [
  {
    id: "MedicalLicense",
    name: "Medical License",
    description: "State-issued physician medical license",
    schema: "https://vitalcv.org/schemas/medical-license/v1.json",
    requiredFields: ["licenseNumber", "state", "issuingBoard", "expiryDate"],
    validationRules: {
      licenseNumber: (val) => /^[A-Z]{2}\d{6}$/.test(val), // e.g., CA123456
      state: (val) => US_STATES.includes(val),
    },
    expiryRequired: true,
    signingAlgorithm: "Ed25519",
  },
  {
    id: "BoardCertification",
    name: "Board Certification",
    description: "Medical specialty board certification",
    schema: "https://vitalcv.org/schemas/board-certification/v1.json",
    requiredFields: ["certificationNumber", "specialty", "board", "expiryDate"],
    validationRules: {
      certificationNumber: (val) => /^\d{10}$/.test(val),
      specialty: (val) => MEDICAL_SPECIALTIES.includes(val),
    },
    expiryRequired: true,
    signingAlgorithm: "Ed25519",
  },
  // ... additional types
]

// Dynamic field rendering based on selected type
const selectedTypeConfig = CREDENTIAL_TYPES.find(t => t.id === issueForm.credentialType)
const isFieldRequired = (fieldName: string) =>
  selectedTypeConfig?.requiredFields.includes(fieldName)
```

### UI/UX Enhancements

**Grouped Options**:
```tsx
<SelectContent>
  <SelectGroup>
    <SelectLabel>Healthcare Licenses</SelectLabel>
    <SelectItem value="Medical License">Medical License</SelectItem>
    <SelectItem value="Nursing License">Nursing License</SelectItem>
    <SelectItem value="Pharmacy License">Pharmacy License</SelectItem>
  </SelectGroup>
  <SelectSeparator />
  <SelectGroup>
    <SelectLabel>Certifications</SelectLabel>
    <SelectItem value="Board Certification">Board Certification</SelectItem>
    <SelectItem value="DEA Registration">DEA Registration</SelectItem>
  </SelectGroup>
</SelectContent>
```

**Search & Filter**:
- Enable search with Cmd+K shortcut
- Filter by category, expiry requirement, or signing algorithm
- Display recently used credential types at top

**Type Descriptions**:
- Show tooltip on hover with credential description and required fields
- Display credential icon/badge next to name

### Security Considerations

- **Authority Validation**: Only display credential types the issuer has authority to issue
- **Schema Versioning**: Support multiple schema versions with migration path
- **Deprecated Types**: Mark outdated credential types with warning and suggest alternatives

---

## VFE-0303: Subject Identifier Input

### Definition
A text input field for capturing the unique identifier of the credential subject (holder), such as National Provider Identifier (NPI), email address, DID, or institutional ID.

### Synonyms
- **Holder ID Field**: Emphasizes credential holder
- **Subject DID Input**: DID-specific identifier
- **Credential Recipient Identifier**: Recipient perspective
- **Subject Principal Field**: Principal in access control context

### Technical Implementation

**Current Implementation** (`app/issuer/page.tsx:299-309`):
```typescript
<Label htmlFor="subjectId">Subject ID *</Label>
<Input
  id="subjectId"
  type="text"
  placeholder="Enter subject identifier (e.g., NPI, email)"
  value={issueForm.subjectId}
  onChange={(e) => setIssueForm((prev) => ({ ...prev, subjectId: e.target.value }))}
  required
  className="mt-1"
/>
```

**Enhanced with Format Detection & Validation**:
```typescript
type SubjectIdType = "npi" | "email" | "did" | "institutional" | "unknown"

const detectSubjectIdType = (value: string): SubjectIdType => {
  if (/^\d{10}$/.test(value)) return "npi" // NPI: 10 digits
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "email"
  if (value.startsWith("did:")) return "did"
  if (/^[A-Z]{2,5}-\d{4,8}$/.test(value)) return "institutional" // e.g., UCSF-12345
  return "unknown"
}

const validateSubjectId = (value: string, credentialType: string): boolean => {
  const idType = detectSubjectIdType(value)

  // Credential type-specific validation
  if (credentialType === "Medical License" && idType !== "npi") {
    throw new Error("Medical licenses require valid NPI")
  }

  // NPI checksum validation (Luhn algorithm)
  if (idType === "npi") {
    return validateNPIChecksum(value)
  }

  return true
}

// Real-time validation feedback
const [subjectIdError, setSubjectIdError] = useState<string | null>(null)
const handleSubjectIdChange = (value: string) => {
  setIssueForm(prev => ({ ...prev, subjectId: value }))

  try {
    validateSubjectId(value, issueForm.credentialType)
    setSubjectIdError(null)
  } catch (err) {
    setSubjectIdError(err.message)
  }
}
```

### UI Implementation with Validation

```tsx
<div className="space-y-1">
  <Label htmlFor="subjectId">
    Subject ID *
    <span className="text-xs text-muted-foreground ml-2">
      (NPI, email, or DID)
    </span>
  </Label>
  <Input
    id="subjectId"
    type="text"
    placeholder="1234567890 (NPI)"
    value={issueForm.subjectId}
    onChange={(e) => handleSubjectIdChange(e.target.value)}
    required
    aria-invalid={!!subjectIdError}
    aria-describedby={subjectIdError ? "subjectId-error" : undefined}
    className={cn("mt-1", subjectIdError && "border-destructive")}
  />
  {subjectIdError && (
    <p id="subjectId-error" role="alert" className="text-sm text-destructive">
      {subjectIdError}
    </p>
  )}
  {issueForm.subjectId && !subjectIdError && (
    <p className="text-sm text-success flex items-center gap-1">
      <CheckCircle className="h-3 w-3" />
      Valid {detectSubjectIdType(issueForm.subjectId).toUpperCase()}
    </p>
  )}
</div>
```

### Security & Privacy

**PII Protection**:
- Mask subject ID in logs (show only last 4 digits)
- Encrypt subject ID at rest in database
- Require consent before linking to external identity systems

**Duplicate Detection**:
- Check if subject already has active credential of this type
- Warn issuer before creating duplicate
- Provide option to revoke previous credential

**DID Resolution**:
- Resolve DIDs to verify subject control
- Request proof of DID ownership via challenge-response
- Support did:web, did:key, did:ethr methods

---

## VFE-0304: License Number Field

### Definition
A text input for capturing the unique license or certification number assigned by the issuing authority, serving as the primary identifier for the credential in external registries.

### Synonyms
- **Credential Number**: Generic credential identifier
- **Certificate Number**: Certificate-specific identifier
- **Registration Number**: Registration-based credentials
- **Permit Number**: Permit and authorization credentials

### Technical Implementation

**Format Validation by Credential Type**:
```typescript
const LICENSE_NUMBER_FORMATS: Record<string, RegExp> = {
  "Medical License": /^[A-Z]{2}\d{6}$/,        // CA123456
  "Board Certification": /^\d{10}$/,            // 1234567890
  "DEA Registration": /^[A-Z]{2}\d{7}$/,       // AB1234567
  "Nursing License": /^[A-Z]{2}\d{6}$/,        // RN123456
  "Pharmacy License": /^RPH\d{6}$/,            // RPH123456
}

const validateLicenseNumber = (value: string, credentialType: string): boolean => {
  const format = LICENSE_NUMBER_FORMATS[credentialType]
  if (!format) return true // No validation for unknown types
  return format.test(value)
}

// Example-driven input with format hints
const getLicenseNumberExample = (credentialType: string): string => {
  const examples: Record<string, string> = {
    "Medical License": "CA123456",
    "Board Certification": "1234567890",
    "DEA Registration": "AB1234567",
  }
  return examples[credentialType] || "Enter license number"
}
```

### UI Implementation

```tsx
<div className="space-y-1">
  <Label htmlFor="licenseNumber">License Number *</Label>
  <Input
    id="licenseNumber"
    type="text"
    placeholder={getLicenseNumberExample(issueForm.credentialType)}
    value={issueForm.licenseNumber}
    onChange={(e) => handleLicenseNumberChange(e.target.value)}
    required
    className="mt-1 font-mono"
  />
  {issueForm.credentialType && (
    <p className="text-xs text-muted-foreground">
      Format: {LICENSE_NUMBER_FORMATS[issueForm.credentialType]?.source || "Free text"}
    </p>
  )}
</div>
```

### External Registry Validation

**Real-Time Verification** (Optional):
```typescript
const verifyLicenseInRegistry = async (
  licenseNumber: string,
  credentialType: string
): Promise<{ valid: boolean; holderName?: string; status?: string }> => {
  // Example: California Medical Board API
  if (credentialType === "Medical License" && licenseNumber.startsWith("CA")) {
    const response = await fetch(`https://api.mbc.ca.gov/verify/${licenseNumber}`)
    const data = await response.json()
    return {
      valid: data.status === "active",
      holderName: data.licensee_name,
      status: data.status,
    }
  }
  return { valid: true } // Skip validation for unsupported types
}

// Show verification status
const [verificationStatus, setVerificationStatus] = useState<"pending" | "verified" | "not-found" | null>(null)

useEffect(() => {
  if (issueForm.licenseNumber.length >= 6) {
    setVerificationStatus("pending")
    verifyLicenseInRegistry(issueForm.licenseNumber, issueForm.credentialType)
      .then(result => setVerificationStatus(result.valid ? "verified" : "not-found"))
  }
}, [issueForm.licenseNumber, issueForm.credentialType])
```

---

## VFE-0305: Issuing Authority Input

### Definition
A text or select input specifying the organization or entity issuing the credential (e.g., "California Medical Board", "American Board of Internal Medicine"), which becomes the `issuer` property in the verifiable credential.

### Synonyms
- **Issuer Organization Field**: Organization-centric naming
- **Credentialing Authority**: Authority-based terminology
- **Certifying Body**: Certification-specific context
- **Licensing Board**: License-specific terminology

### Technical Implementation

**Current Implementation**:
```typescript
<Label htmlFor="issuingAuthority">Issuing Authority *</Label>
<Input
  id="issuingAuthority"
  type="text"
  placeholder="Enter issuing authority"
  value={issueForm.issuingAuthority}
  onChange={(e) => setIssueForm((prev) => ({ ...prev, issuingAuthority: e.target.value }))}
  required
/>
```

**Enhanced with Predefined Authorities**:
```typescript
interface IssuingAuthority {
  id: string
  name: string
  did: string // Issuer's DID
  credentialTypes: string[] // Types this authority can issue
  jurisdiction: string // State/country
  verificationEndpoint: string // Status list URL
  publicKey: string // For signature verification
}

const ISSUING_AUTHORITIES: IssuingAuthority[] = [
  {
    id: "ca-medical-board",
    name: "California Medical Board",
    did: "did:web:mbc.ca.gov",
    credentialTypes: ["Medical License"],
    jurisdiction: "CA",
    verificationEndpoint: "https://mbc.ca.gov/api/status",
    publicKey: "z6MkrHKzgsahxBLyNAbLQyB1pcWNYqZpCa5qXkqEtxfXjqRe",
  },
  {
    id: "abim",
    name: "American Board of Internal Medicine",
    did: "did:web:abim.org",
    credentialTypes: ["Board Certification"],
    jurisdiction: "US",
    verificationEndpoint: "https://abim.org/api/verify",
    publicKey: "z6MksFxi8dgXNBZfJHJvqLqvLhxLxH6y6q7eA8aY7evBqzhG",
  },
  // ... more authorities
]

// Filter authorities by credential type
const availableAuthorities = ISSUING_AUTHORITIES.filter(auth =>
  auth.credentialTypes.includes(issueForm.credentialType)
)
```

### UI Implementation with Select

```tsx
<div className="space-y-1">
  <Label htmlFor="issuingAuthority">Issuing Authority *</Label>
  <Select
    value={issueForm.issuingAuthority}
    onValueChange={(value) => {
      const authority = ISSUING_AUTHORITIES.find(a => a.id === value)
      setIssueForm(prev => ({
        ...prev,
        issuingAuthority: value,
        issuerDid: authority?.did || "",
        issuerPublicKey: authority?.publicKey || "",
      }))
    }}
  >
    <SelectTrigger>
      <SelectValue placeholder="Select issuing authority" />
    </SelectTrigger>
    <SelectContent>
      {availableAuthorities.map(auth => (
        <SelectItem key={auth.id} value={auth.id}>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-blue-600" />
            <div>
              <p className="font-medium">{auth.name}</p>
              <p className="text-xs text-muted-foreground">{auth.jurisdiction}</p>
            </div>
          </div>
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
  {issueForm.issuingAuthority && (
    <p className="text-xs text-muted-foreground">
      DID: {ISSUING_AUTHORITIES.find(a => a.id === issueForm.issuingAuthority)?.did}
    </p>
  )}
</div>
```

### DID Integration

**Issuer Property in Verifiable Credential**:
```json
{
  "@context": ["https://www.w3.org/2018/credentials/v1"],
  "type": ["VerifiableCredential", "MedicalLicense"],
  "issuer": {
    "id": "did:web:mbc.ca.gov",
    "name": "California Medical Board",
    "url": "https://mbc.ca.gov"
  },
  "credentialSubject": { ... },
  "proof": {
    "type": "Ed25519Signature2020",
    "verificationMethod": "did:web:mbc.ca.gov#key-1",
    "created": "2023-01-15T10:00:00Z",
    "proofPurpose": "assertionMethod",
    "proofValue": "z58DAdFfa9SkqZMVPxAQpic7ndSayn1PzZs6ZjWp1CktyGesjuTSwRdoWhAfGFCF5bppETSTojQCrfFPP2oumHKtz"
  }
}
```

---

## VFE-0306: Expiry Date Picker

### Definition
A date input component for setting the credential's expiration date, after which the credential is no longer considered valid for verification purposes.

### Synonyms
- **Expiration Date Field**: American English variant
- **Validity End Date**: Validity period perspective
- **Credential Expiry Selector**: Selector-based terminology
- **Termination Date**: End-of-life perspective

### Technical Implementation

**Current Implementation**:
```typescript
<Label htmlFor="expiryDate">Expiry Date</Label>
<Input
  id="expiryDate"
  type="date"
  value={issueForm.expiryDate}
  onChange={(e) => setIssueForm((prev) => ({ ...prev, expiryDate: e.target.value }))}
  className="mt-1"
/>
```

**Enhanced with Calendar Component & Validation**:
```typescript
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format, addYears, isBefore } from "date-fns"

const [expiryDate, setExpiryDate] = useState<Date | undefined>()

// Credential type-specific expiry rules
const getExpiryDateConstraints = (credentialType: string) => {
  const constraints: Record<string, { minYears: number; maxYears: number; required: boolean }> = {
    "Medical License": { minYears: 1, maxYears: 5, required: true },
    "Board Certification": { minYears: 5, maxYears: 10, required: true },
    "DEA Registration": { minYears: 3, maxYears: 3, required: true }, // Always 3 years
  }
  return constraints[credentialType] || { minYears: 1, maxYears: 10, required: false }
}

const constraints = getExpiryDateConstraints(issueForm.credentialType)
const minDate = addYears(new Date(), constraints.minYears)
const maxDate = addYears(new Date(), constraints.maxYears)
```

### UI Implementation with Calendar

```tsx
<div className="space-y-1">
  <Label htmlFor="expiryDate">
    Expiry Date {constraints.required && "*"}
  </Label>
  <Popover>
    <PopoverTrigger asChild>
      <Button
        variant="outline"
        className={cn(
          "w-full justify-start text-left font-normal",
          !expiryDate && "text-muted-foreground"
        )}
      >
        <CalendarIcon className="mr-2 h-4 w-4" />
        {expiryDate ? format(expiryDate, "PPP") : "Pick expiry date"}
      </Button>
    </PopoverTrigger>
    <PopoverContent className="w-auto p-0" align="start">
      <Calendar
        mode="single"
        selected={expiryDate}
        onSelect={setExpiryDate}
        disabled={(date) => isBefore(date, minDate) || isBefore(maxDate, date)}
        initialFocus
      />
    </PopoverContent>
  </Popover>
  <p className="text-xs text-muted-foreground">
    Valid range: {format(minDate, "MMM yyyy")} - {format(maxDate, "MMM yyyy")}
  </p>
</div>
```

### Non-Expiring Credentials

**Permanent Credentials** (e.g., diplomas):
```typescript
const [neverExpires, setNeverExpires] = useState(false)

<Checkbox
  id="neverExpires"
  checked={neverExpires}
  onCheckedChange={(checked) => {
    setNeverExpires(checked as boolean)
    if (checked) setExpiryDate(undefined)
  }}
/>
<Label htmlFor="neverExpires">This credential never expires</Label>
```

**W3C Credential Representation**:
```json
{
  "expirationDate": "2025-01-15T00:00:00Z"  // ISO 8601 date
}

// OR for non-expiring credentials:
{} // Omit expirationDate property
```

---

## VFE-0307: Additional Data (JSON) Field

### Definition
A textarea input for capturing custom credential claims and metadata as JSON, allowing issuers to include credential-specific data beyond standard fields (e.g., specialization, board scores, restrictions).

### Synonyms
- **Custom Claims Field**: Claims-based terminology
- **Metadata JSON Input**: Metadata perspective
- **Extended Attributes**: Attribute-based naming
- **Credential Payload**: Data payload perspective

### Technical Implementation

**Current Implementation**:
```typescript
<Label htmlFor="additionalData">Additional Data (JSON)</Label>
<Textarea
  id="additionalData"
  placeholder='{"specialization": "Cardiology", "boardScore": 95}'
  value={issueForm.additionalData}
  onChange={(e) => setIssueForm((prev) => ({ ...prev, additionalData: e.target.value }))}
  className="mt-1"
  rows={3}
/>

// Parse JSON in submission handler
body: JSON.stringify({
  // ...
  additionalData: issueForm.additionalData ? JSON.parse(issueForm.additionalData) : undefined,
})
```

**Enhanced with JSON Validation & Monaco Editor**:
```typescript
import Editor from "@monaco-editor/react"
import { jsonSchemaForCredentialType } from "@/lib/credential-schemas"

const [jsonError, setJsonError] = useState<string | null>(null)
const [parsedData, setParsedData] = useState<Record<string, any> | null>(null)

const validateJSON = (value: string) => {
  if (!value.trim()) {
    setJsonError(null)
    setParsedData(null)
    return
  }

  try {
    const parsed = JSON.parse(value)

    // Validate against credential type schema
    const schema = jsonSchemaForCredentialType(issueForm.credentialType)
    const ajv = new Ajv()
    const validate = ajv.compile(schema)

    if (!validate(parsed)) {
      setJsonError(ajv.errorsText(validate.errors))
      return
    }

    setJsonError(null)
    setParsedData(parsed)
  } catch (err) {
    setJsonError(err.message)
    setParsedData(null)
  }
}

const handleAdditionalDataChange = (value: string | undefined) => {
  setIssueForm(prev => ({ ...prev, additionalData: value || "" }))
  validateJSON(value || "")
}
```

### UI Implementation with Monaco Editor

```tsx
<div className="space-y-2">
  <Label htmlFor="additionalData">
    Additional Data (JSON)
    <Button variant="ghost" size="sm" className="ml-2" onClick={showSchemaExample}>
      <HelpCircle className="h-3 w-3 mr-1" />
      Show Example
    </Button>
  </Label>

  <Editor
    height="200px"
    language="json"
    value={issueForm.additionalData}
    onChange={handleAdditionalDataChange}
    options={{
      minimap: { enabled: false },
      lineNumbers: "off",
      scrollBeyondLastLine: false,
      formatOnPaste: true,
      formatOnType: true,
    }}
    theme={theme === "dark" ? "vs-dark" : "vs-light"}
  />

  {jsonError && (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription>Invalid JSON: {jsonError}</AlertDescription>
    </Alert>
  )}

  {parsedData && !jsonError && (
    <Alert>
      <CheckCircle className="h-4 w-4" />
      <AlertDescription>
        Valid JSON with {Object.keys(parsedData).length} properties
      </AlertDescription>
    </Alert>
  )}
</div>
```

### Schema Examples by Credential Type

**Medical License**:
```json
{
  "specialization": "Cardiology",
  "subspecialty": "Interventional Cardiology",
  "restrictions": [],
  "boardScore": 95,
  "graduationYear": 2015,
  "medicalSchool": "Harvard Medical School"
}
```

**Board Certification**:
```json
{
  "examDate": "2023-06-15",
  "examScore": 87,
  "recertificationRequired": true,
  "recertificationDate": "2033-06-15",
  "maintenanceOfCertification": true
}
```

### Security Considerations

- **PII Minimization**: Warn users against including SSN, DOB, or other sensitive PII
- **Size Limits**: Enforce max 100KB to prevent denial-of-service
- **Schema Enforcement**: Validate against predefined schemas to prevent arbitrary data
- **Selective Disclosure Preparation**: Structure data for BBS+ selective disclosure (split into separate claims)

---

## VFE-0308: Issue Button & Loading State

### Definition
The primary action button that submits the credential issuance form, triggering API calls to create and sign the verifiable credential, with visual feedback during the asynchronous operation.

### Synonyms
- **Create Credential Button**: Creation-focused terminology
- **Submit Issuance Button**: Submission perspective
- **Generate Credential CTA**: Call-to-action framing
- **Issue Action Button**: Action-oriented naming

### Technical Implementation

**Current Implementation**:
```typescript
<Button
  type="submit"
  className="w-full"
  disabled={
    loading ||
    !issueForm.credentialType ||
    !issueForm.subjectId ||
    !issueForm.licenseNumber ||
    !issueForm.issuingAuthority
  }
>
  {loading ? (
    <>
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Issuing Credential...
    </>
  ) : (
    <>
      <Plus className="mr-2 h-4 w-4" />
      Issue Credential
    </>
  )}
</Button>
```

**Enhanced with Progress States**:
```typescript
type IssuanceStep = "validating" | "signing" | "recording" | "notifying" | "complete"

const [issuanceStep, setIssuanceStep] = useState<IssuanceStep | null>(null)
const [issuanceProgress, setIssuanceProgress] = useState(0)

const handleIssueCredential = async (e: React.FormEvent) => {
  e.preventDefault()

  // Step 1: Validate input
  setIssuanceStep("validating")
  setIssuanceProgress(25)
  await validateCredentialData(issueForm)

  // Step 2: Sign credential
  setIssuanceStep("signing")
  setIssuanceProgress(50)
  const signedCredential = await signCredential(issueForm)

  // Step 3: Record in registry
  setIssuanceStep("recording")
  setIssuanceProgress(75)
  await recordCredential(signedCredential)

  // Step 4: Notify subject
  setIssuanceStep("notifying")
  setIssuanceProgress(90)
  await notifySubject(issueForm.subjectId, signedCredential.id)

  // Complete
  setIssuanceStep("complete")
  setIssuanceProgress(100)

  toast({ title: "Credential Issued", description: "Subject has been notified" })
}

const STEP_LABELS: Record<IssuanceStep, string> = {
  validating: "Validating credential data...",
  signing: "Signing credential with issuer key...",
  recording: "Recording in credential registry...",
  notifying: "Notifying credential subject...",
  complete: "Credential issued successfully",
}
```

### UI Implementation with Progress

```tsx
<div className="space-y-4">
  {issuanceStep && (
    <div className="space-y-2">
      <Progress value={issuanceProgress} className="h-2" />
      <p className="text-sm text-muted-foreground flex items-center gap-2">
        {issuanceStep !== "complete" ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <CheckCircle className="h-3 w-3 text-success" />
        )}
        {STEP_LABELS[issuanceStep]}
      </p>
    </div>
  )}

  <Button
    type="submit"
    className="w-full"
    disabled={loading || !isFormValid()}
  >
    {loading ? (
      <>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        {STEP_LABELS[issuanceStep || "validating"]}
      </>
    ) : (
      <>
        <Plus className="mr-2 h-4 w-4" />
        Issue Credential
      </>
    )}
  </Button>
</div>
```

### Accessibility

- **Disabled State**: Use `aria-disabled="true"` and `aria-describedby="button-hint"` to explain why disabled
- **Loading Announcement**: `aria-live="polite"` region to announce progress steps
- **Success Feedback**: Move focus to success message after completion

---

## VFE-0309: Credential Revocation Form

### Definition
A form interface for revoking an existing verifiable credential, capturing the credential ID and reason for revocation, with irreversible warning and confirmation flow.

### Synonyms
- **Credential Invalidation Form**: Invalidation-focused terminology
- **Credential Suspension Form**: If supporting temporary suspension
- **Revocation Request Form**: Request-based workflow
- **Credential Termination Form**: Termination perspective

### Technical Implementation

**Current Implementation** (`app/issuer/page.tsx:384-444`):
```typescript
const [revokeForm, setRevokeForm] = useState({
  credentialId: "",
  reason: "",
})

const handleRevokeCredential = async (e: React.FormEvent) => {
  e.preventDefault()
  setLoading(true)

  const response = await fetch("/api/status/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      credentialId: revokeForm.credentialId,
      reason: revokeForm.reason,
    }),
  })

  if (!response.ok) {
    throw new Error(`Failed to revoke credential`)
  }

  // Update local state
  setCredentials(prev =>
    prev.map(cred =>
      cred.id === revokeForm.credentialId
        ? { ...cred, status: "revoked" }
        : cred
    )
  )

  toast({ title: "Credential Revoked", description: `Credential ${revokeForm.credentialId} revoked` })
}
```

**Enhanced with Confirmation Dialog**:
```typescript
const [showRevocationConfirm, setShowRevocationConfirm] = useState(false)
const [revocationPreview, setRevocationPreview] = useState<Credential | null>(null)

const handleRevocationSubmit = (e: React.FormEvent) => {
  e.preventDefault()

  // Load credential details for preview
  const credential = credentials.find(c => c.id === revokeForm.credentialId)
  setRevocationPreview(credential || null)
  setShowRevocationConfirm(true)
}

const confirmRevocation = async () => {
  setLoading(true)
  try {
    await handleRevokeCredential()
    setShowRevocationConfirm(false)
    setRevocationPreview(null)
  } finally {
    setLoading(false)
  }
}
```

### UI Implementation with Confirmation

```tsx
<form onSubmit={handleRevocationSubmit} className="space-y-4">
  {/* Credential ID Selector */}
  <div>
    <Label htmlFor="credentialId">Credential ID *</Label>
    <Select
      value={revokeForm.credentialId}
      onValueChange={(value) => setRevokeForm(prev => ({ ...prev, credentialId: value }))}
    >
      <SelectTrigger className="mt-1">
        <SelectValue placeholder="Select credential to revoke" />
      </SelectTrigger>
      <SelectContent>
        {credentials.filter(c => c.status === "active").map(cred => (
          <SelectItem key={cred.id} value={cred.id}>
            {cred.id} - {cred.holder} ({cred.type})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>

  {/* Reason Field */}
  <div>
    <Label htmlFor="reason">Reason for Revocation *</Label>
    <Textarea
      id="reason"
      placeholder="Enter the reason for revoking this credential"
      value={revokeForm.reason}
      onChange={(e) => setRevokeForm(prev => ({ ...prev, reason: e.target.value }))}
      required
      rows={3}
    />
  </div>

  {/* Warning Alert */}
  <Alert variant="destructive">
    <AlertTriangle className="h-4 w-4" />
    <AlertDescription>
      Warning: Revoking a credential is permanent and cannot be undone.
      The credential will be immediately marked as invalid.
    </AlertDescription>
  </Alert>

  <Button
    type="submit"
    variant="destructive"
    className="w-full"
    disabled={!revokeForm.credentialId || !revokeForm.reason}
  >
    <Trash2 className="mr-2 h-4 w-4" />
    Revoke Credential
  </Button>
</form>

{/* Confirmation Dialog */}
<Dialog open={showRevocationConfirm} onOpenChange={setShowRevocationConfirm}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Confirm Revocation</DialogTitle>
      <DialogDescription>
        Are you sure you want to revoke this credential?
      </DialogDescription>
    </DialogHeader>

    {revocationPreview && (
      <div className="bg-muted p-4 rounded-lg space-y-2">
        <p><strong>ID:</strong> {revocationPreview.id}</p>
        <p><strong>Holder:</strong> {revocationPreview.holder}</p>
        <p><strong>Type:</strong> {revocationPreview.type}</p>
        <p><strong>Issued:</strong> {new Date(revocationPreview.issuedDate).toLocaleDateString()}</p>
      </div>
    )}

    <DialogFooter>
      <Button variant="outline" onClick={() => setShowRevocationConfirm(false)}>
        Cancel
      </Button>
      <Button variant="destructive" onClick={confirmRevocation} disabled={loading}>
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Confirm Revocation
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Revocation Methods

**Status List 2021** (W3C standard):
```json
{
  "credentialStatus": {
    "id": "https://vitalcv.org/status/3#94567",
    "type": "StatusList2021Entry",
    "statusPurpose": "revocation",
    "statusListIndex": "94567",
    "statusListCredential": "https://vitalcv.org/status/3"
  }
}
```

**Revocation List Entry**:
- Update bitstring at index 94567 to `1` (revoked)
- Publish updated status list credential
- Cache-Control: max-age=300 (5 minutes)

---

## VFE-0310: Credential ID Selector

### Definition
A dropdown selector within the revocation form that displays active credentials eligible for revocation, showing credential ID, holder name, and type for easy identification.

### Synonyms
- **Credential Picker**: Selection-focused naming
- **Revocation Target Selector**: Target-based terminology
- **Active Credential Dropdown**: Status-filtered dropdown
- **Credential Lookup**: Lookup-based interaction

### Technical Implementation

**Filtered Credential List**:
```typescript
const activeCredentials = credentials.filter(cred => cred.status === "active")

<Select
  value={revokeForm.credentialId}
  onValueChange={(value) => {
    setRevokeForm(prev => ({ ...prev, credentialId: value }))

    // Auto-populate reason suggestions based on credential type
    const credential = credentials.find(c => c.id === value)
    if (credential) {
      setSuggestedReasons(getRevocationReasons(credential.type))
    }
  }}
>
  <SelectTrigger>
    <SelectValue placeholder="Select credential to revoke" />
  </SelectTrigger>
  <SelectContent>
    {activeCredentials.length === 0 ? (
      <SelectItem value="none" disabled>No active credentials</SelectItem>
    ) : (
      activeCredentials.map(cred => (
        <SelectItem key={cred.id} value={cred.id}>
          <div className="flex items-center justify-between w-full">
            <span className="font-mono text-sm">{cred.id}</span>
            <Badge variant="outline">{cred.type}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">{cred.holder}</p>
        </SelectItem>
      ))
    )}
  </SelectContent>
</Select>
```

**Search & Filter**:
```typescript
const [searchQuery, setSearchQuery] = useState("")

const filteredCredentials = activeCredentials.filter(cred =>
  cred.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
  cred.holder.toLowerCase().includes(searchQuery.toLowerCase()) ||
  cred.type.toLowerCase().includes(searchQuery.toLowerCase())
)

<div className="space-y-2">
  <Input
    placeholder="Search credentials..."
    value={searchQuery}
    onChange={(e) => setSearchQuery(e.target.value)}
  />
  <ScrollArea className="h-48">
    <RadioGroup value={revokeForm.credentialId} onValueChange={(value) => setRevokeForm(prev => ({ ...prev, credentialId: value }))}>
      {filteredCredentials.map(cred => (
        <div key={cred.id} className="flex items-center space-x-2 p-2 hover:bg-muted rounded">
          <RadioGroupItem value={cred.id} id={cred.id} />
          <Label htmlFor={cred.id} className="flex-1 cursor-pointer">
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm">{cred.id}</span>
              <Badge variant="outline">{cred.type}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{cred.holder}</p>
          </Label>
        </div>
      ))}
    </RadioGroup>
  </ScrollArea>
</div>
```

---

## VFE-0311: Revocation Reason Field

### Definition
A required textarea input for documenting the reason for credential revocation, creating an audit trail and providing transparency to credential holders and verifiers.

### Synonyms
- **Revocation Justification Field**: Justification-focused terminology
- **Revocation Notes**: Notes-based naming
- **Revocation Explanation**: Explanation perspective
- **Revocation Rationale**: Rationale-based terminology

### Technical Implementation

**Predefined Reason Templates**:
```typescript
const REVOCATION_REASONS = {
  "Medical License": [
    "License suspended by medical board",
    "Credential holder requested revocation",
    "License expired and not renewed",
    "Professional misconduct",
    "Falsified credentials",
  ],
  "Board Certification": [
    "Failed to complete MOC requirements",
    "Certification expired",
    "Voluntarily relinquished",
  ],
  "DEA Registration": [
    "DEA registration expired",
    "Disciplinary action by DEA",
    "Practice location changed",
  ],
}

const getRevocationReasons = (credentialType: string): string[] => {
  return REVOCATION_REASONS[credentialType] || [
    "Credential no longer valid",
    "Issued in error",
    "Holder requested revocation",
  ]
}

const [selectedReason, setSelectedReason] = useState<string | "custom">("custom")
const [customReason, setCustomReason] = useState("")

const handleReasonChange = (value: string) => {
  if (value === "custom") {
    setSelectedReason("custom")
    setRevokeForm(prev => ({ ...prev, reason: customReason }))
  } else {
    setSelectedReason(value)
    setRevokeForm(prev => ({ ...prev, reason: value }))
  }
}
```

### UI Implementation with Templates

```tsx
<div className="space-y-2">
  <Label htmlFor="reason">Reason for Revocation *</Label>

  {/* Quick Select Reasons */}
  <RadioGroup value={selectedReason} onValueChange={handleReasonChange}>
    {suggestedReasons.map((reason, index) => (
      <div key={index} className="flex items-center space-x-2">
        <RadioGroupItem value={reason} id={`reason-${index}`} />
        <Label htmlFor={`reason-${index}`} className="cursor-pointer font-normal">
          {reason}
        </Label>
      </div>
    ))}
    <div className="flex items-center space-x-2">
      <RadioGroupItem value="custom" id="reason-custom" />
      <Label htmlFor="reason-custom" className="cursor-pointer font-normal">
        Custom reason
      </Label>
    </div>
  </RadioGroup>

  {/* Custom Reason Textarea */}
  {selectedReason === "custom" && (
    <Textarea
      id="reason"
      placeholder="Enter the reason for revoking this credential"
      value={customReason}
      onChange={(e) => {
        setCustomReason(e.target.value)
        setRevokeForm(prev => ({ ...prev, reason: e.target.value }))
      }}
      required
      rows={3}
      className="mt-2"
    />
  )}
</div>
```

### Audit Trail Integration

**Revocation Event Record**:
```typescript
interface RevocationEvent {
  credentialId: string
  revokedAt: string // ISO 8601
  revokedBy: string // User ID or DID
  reason: string
  previousStatus: "active" | "expired"
  notificationSent: boolean
  statusListUpdated: boolean
}

const recordRevocation = async (event: RevocationEvent): Promise<void> => {
  await fetch("/api/audit/revocation", {
    method: "POST",
    body: JSON.stringify(event),
  })
}
```

---

## VFE-0312: Revocation Warning Alert

### Definition
A destructive-styled alert component displaying a prominent warning about the irreversible nature of credential revocation, ensuring issuers understand the consequences before proceeding.

### Synonyms
- **Revocation Caution Banner**: Caution-based terminology
- **Irreversibility Notice**: Notice-focused naming
- **Revocation Disclaimer**: Legal disclaimer perspective
- **Permanent Action Warning**: Action consequence focus

### Technical Implementation

**Current Implementation**:
```typescript
<Alert variant="destructive">
  <AlertTriangle className="h-4 w-4" />
  <AlertDescription>
    Warning: Revoking a credential is permanent and cannot be undone.
    The credential will be immediately marked as invalid.
  </AlertDescription>
</Alert>
```

**Enhanced with Impact Details**:
```tsx
<Alert variant="destructive" className="border-destructive">
  <AlertTriangle className="h-5 w-5" />
  <AlertTitle className="font-semibold">Irreversible Action</AlertTitle>
  <AlertDescription className="space-y-2">
    <p>
      Revoking this credential will <strong>immediately</strong> mark it as invalid.
      This action <strong>cannot be undone</strong>.
    </p>
    <ul className="list-disc list-inside text-sm space-y-1 mt-2">
      <li>Credential will fail all future verification attempts</li>
      <li>Holder will be notified via email within 24 hours</li>
      <li>Revocation will appear in public status list</li>
      <li>Audit trail will record your user ID and timestamp</li>
    </ul>
    <p className="text-sm mt-2">
      To reactivate this holder, you must issue a new credential.
    </p>
  </AlertDescription>
</Alert>
```

### Alternative Actions

**Suspension vs. Revocation**:
```tsx
<Alert>
  <Info className="h-4 w-4" />
  <AlertTitle>Need temporary suspension?</AlertTitle>
  <AlertDescription>
    Consider using <Button variant="link" className="p-0 h-auto">credential suspension</Button>
    instead if you may want to reactivate this credential later.
  </AlertDescription>
</Alert>
```

---

## VFE-0313: Revoke Button & Loading State

### Definition
The destructive action button that submits the revocation form, styled with warning colors and displaying loading feedback during the asynchronous revocation process.

### Synonyms
- **Revocation Trigger Button**: Trigger-based naming
- **Invalidate Credential Button**: Invalidation focus
- **Submit Revocation Button**: Submission perspective
- **Confirm Revocation CTA**: Confirmation call-to-action

### Technical Implementation

**Current Implementation**:
```typescript
<Button
  type="submit"
  variant="destructive"
  className="w-full"
  disabled={loading || !revokeForm.credentialId || !revokeForm.reason}
>
  {loading ? (
    <>
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Revoking Credential...
    </>
  ) : (
    <>
      <Trash2 className="mr-2 h-4 w-4" />
      Revoke Credential
    </>
  )}
</Button>
```

**Enhanced with Confirmation Step**:
```typescript
const [requiresConfirmation, setRequiresConfirmation] = useState(false)
const [confirmationCode, setConfirmationCode] = useState("")

const generateConfirmationCode = () => {
  const credential = credentials.find(c => c.id === revokeForm.credentialId)
  return credential ? credential.id.slice(-6).toUpperCase() : ""
}

const handleRevocationClick = (e: React.FormEvent) => {
  e.preventDefault()

  if (!requiresConfirmation) {
    setRequiresConfirmation(true)
    setConfirmationCode(generateConfirmationCode())
    return
  }

  handleRevokeCredential(e)
}
```

### UI with Confirmation

```tsx
{requiresConfirmation ? (
  <div className="space-y-4 p-4 border border-destructive rounded-lg bg-destructive/5">
    <p className="text-sm font-medium">
      To confirm revocation, type <code className="px-2 py-1 bg-muted rounded font-mono">{confirmationCode}</code>
    </p>
    <Input
      placeholder="Enter confirmation code"
      value={confirmationInput}
      onChange={(e) => setConfirmationInput(e.target.value)}
      autoFocus
    />
    <div className="flex gap-2">
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          setRequiresConfirmation(false)
          setConfirmationInput("")
        }}
        className="flex-1"
      >
        Cancel
      </Button>
      <Button
        type="submit"
        variant="destructive"
        disabled={loading || confirmationInput !== confirmationCode}
        className="flex-1"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Revoking...
          </>
        ) : (
          <>
            <Trash2 className="mr-2 h-4 w-4" />
            Confirm Revocation
          </>
        )}
      </Button>
    </div>
  </div>
) : (
  <Button
    type="submit"
    variant="destructive"
    className="w-full"
    disabled={!revokeForm.credentialId || !revokeForm.reason}
    onClick={handleRevocationClick}
  >
    <Trash2 className="mr-2 h-4 w-4" />
    Revoke Credential
  </Button>
)}
```

---

## VFE-0314: Issued Credentials List

### Definition
A scrollable list displaying all credentials issued by the current issuing authority, showing credential ID, holder name, type, status, and issue/expiry dates for management and oversight.

### Synonyms
- **Credential Registry View**: Registry-focused terminology
- **Issued Credentials Table**: Table-based layout
- **Credential Inventory**: Inventory management perspective
- **Credential Portfolio**: Portfolio metaphor

### Technical Implementation

**Current Implementation** (`app/issuer/page.tsx:450-486`):
```typescript
interface Credential {
  id: string
  type: string
  holder: string
  issuer: string
  status: "active" | "revoked" | "expired"
  issuedDate: string
  expiryDate?: string
}

const [credentials, setCredentials] = useState<Credential[]>([...])

<Card>
  <CardHeader>
    <CardTitle>Issued Credentials</CardTitle>
    <CardDescription>View and manage all issued credentials</CardDescription>
  </CardHeader>
  <CardContent>
    <div className="space-y-4">
      {credentials.map(credential => {
        const statusConfig = getStatusConfig(credential.status)
        return (
          <div key={credential.id} className="flex items-center justify-between p-4 border rounded-lg bg-white/50">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="font-semibold">{credential.id}</h3>
                <Badge className={statusConfig.color}>
                  {statusConfig.icon}
                  <span className="ml-1 capitalize">{credential.status}</span>
                </Badge>
              </div>
              <p className="text-sm text-gray-600">
                <strong>{credential.holder}</strong> - {credential.type}
              </p>
              <p className="text-xs text-gray-500">
                Issued: {new Date(credential.issuedDate).toLocaleDateString()}
                {credential.expiryDate && ` | Expires: ${new Date(credential.expiryDate).toLocaleDateString()}`}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  </CardContent>
</Card>
```

**Enhanced with DataTable & Actions**:
```typescript
import { DataTable } from "@/components/ui/data-table"
import { ColumnDef } from "@tanstack/react-table"

const columns: ColumnDef<Credential>[] = [
  {
    accessorKey: "id",
    header: "Credential ID",
    cell: ({ row }) => (
      <code className="font-mono text-sm">{row.getValue("id")}</code>
    ),
  },
  {
    accessorKey: "holder",
    header: "Holder",
  },
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ row }) => (
      <Badge variant="outline">{row.getValue("type")}</Badge>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as string
      const config = getStatusConfig(status)
      return (
        <Badge className={config.color}>
          {config.icon}
          <span className="ml-1 capitalize">{status}</span>
        </Badge>
      )
    },
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
  },
  {
    accessorKey: "issuedDate",
    header: "Issued",
    cell: ({ row }) => new Date(row.getValue("issuedDate")).toLocaleDateString(),
  },
  {
    accessorKey: "expiryDate",
    header: "Expires",
    cell: ({ row }) => {
      const date = row.getValue("expiryDate") as string | undefined
      return date ? new Date(date).toLocaleDateString() : "—"
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const credential = row.original
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => viewCredential(credential.id)}>
              <Eye className="mr-2 h-4 w-4" />
              View Details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => downloadCredential(credential.id)}>
              <Download className="mr-2 h-4 w-4" />
              Download JSON
            </DropdownMenuItem>
            {credential.status === "active" && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => startRevocation(credential.id)}
                  className="text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Revoke
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]

<DataTable
  columns={columns}
  data={credentials}
  filterColumn="holder"
  filterPlaceholder="Search by holder name..."
/>
```

### Filtering & Sorting

```tsx
const [statusFilter, setStatusFilter] = useState<string[]>(["active", "revoked", "expired"])
const [sortBy, setSortBy] = useState<"issuedDate" | "expiryDate">("issuedDate")
const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")

const filteredCredentials = credentials
  .filter(cred => statusFilter.includes(cred.status))
  .sort((a, b) => {
    const aDate = new Date(a[sortBy] || 0).getTime()
    const bDate = new Date(b[sortBy] || 0).getTime()
    return sortOrder === "asc" ? aDate - bDate : bDate - aDate
  })
```

---

## VFE-0315: Credential Status Badge Display

### Definition
A visual indicator component showing the current status of a credential (active, revoked, expired) with appropriate color coding and iconography for quick recognition.

### Synonyms
- **Status Indicator**: Indicator-focused naming
- **Credential State Badge**: State-based terminology
- **Status Pill**: Pill-style UI element
- **Credential Status Label**: Label-based naming

### Technical Implementation

**Current Implementation** (`app/issuer/page.tsx:200-211`):
```typescript
const getStatusConfig = (status: string) => {
  switch (status) {
    case "active":
      return { color: "bg-green-100 text-green-800", icon: <CheckCircle className="h-4 w-4" /> }
    case "revoked":
      return { color: "bg-red-100 text-red-800", icon: <XCircle className="h-4 w-4" /> }
    case "expired":
      return { color: "bg-yellow-100 text-yellow-800", icon: <AlertTriangle className="h-4 w-4" /> }
    default:
      return { color: "bg-gray-100 text-gray-800", icon: null }
  }
}

<Badge className={statusConfig.color}>
  {statusConfig.icon}
  <span className="ml-1 capitalize">{credential.status}</span>
</Badge>
```

**Enhanced with Semantic Colors & Accessibility**:
```typescript
import { CREDENTIAL_STATUS_CONFIGS } from "@/lib/credential-status-config"

type CredentialStatus = "active" | "revoked" | "expired" | "suspended" | "unknown"

const STATUS_CONFIGS = {
  active: {
    color: "bg-success/20 text-success-foreground dark:text-success",
    icon: CheckCircle,
    label: "Active",
    ariaLabel: "Credential status: Active",
  },
  revoked: {
    color: "bg-destructive/20 text-destructive-foreground dark:text-destructive",
    icon: XCircle,
    label: "Revoked",
    ariaLabel: "Credential status: Revoked",
  },
  expired: {
    color: "bg-warning/20 text-warning-foreground dark:text-warning",
    icon: AlertTriangle,
    label: "Expired",
    ariaLabel: "Credential status: Expired",
  },
  suspended: {
    color: "bg-info/20 text-info-foreground dark:text-info",
    icon: Pause,
    label: "Suspended",
    ariaLabel: "Credential status: Suspended (temporary)",
  },
  unknown: {
    color: "bg-muted text-muted-foreground",
    icon: HelpCircle,
    label: "Unknown",
    ariaLabel: "Credential status: Unknown",
  },
}

const CredentialStatusBadge = ({ status }: { status: CredentialStatus }) => {
  const config = STATUS_CONFIGS[status]
  const Icon = config.icon

  return (
    <Badge className={cn("flex items-center gap-1", config.color)}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      <span>{config.label}</span>
      <span className="sr-only">{config.ariaLabel}</span>
    </Badge>
  )
}
```

### Accessibility

- **Color + Icon + Text**: WCAG 2.1 AA compliance (not relying on color alone)
- **Screen Reader Text**: `sr-only` span with full status description
- **Semantic HTML**: Use `<span role="status">` for dynamic status changes

---

## VFE-0316: Tabbed Navigation (Issue/Revoke)

### Definition
A tab-based navigation component that switches between the credential issuance form and the credential revocation form, organizing the two primary issuer workflows.

### Synonyms
- **Workflow Tabs**: Workflow-oriented naming
- **Issuer Action Tabs**: Action-based terminology
- **Credential Management Tabs**: Management perspective
- **Issuer Mode Selector**: Mode selection metaphor

### Technical Implementation

**Current Implementation** (`app/issuer/page.tsx:243-253`):
```typescript
const [activeTab, setActiveTab] = useState("issue")

<Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
  <TabsList className="grid w-full grid-cols-2">
    <TabsTrigger value="issue" className="flex items-center gap-2">
      <Plus className="h-4 w-4" />
      Issue Credential
    </TabsTrigger>
    <TabsTrigger value="revoke" className="flex items-center gap-2">
      <Trash2 className="h-4 w-4" />
      Revoke Credential
    </TabsTrigger>
  </TabsList>

  <TabsContent value="issue">{/* Issue form */}</TabsContent>
  <TabsContent value="revoke">{/* Revoke form */}</TabsContent>
</Tabs>
```

**Enhanced with Additional Tabs**:
```tsx
<Tabs value={activeTab} onValueChange={setActiveTab}>
  <TabsList className="grid w-full grid-cols-4">
    <TabsTrigger value="issue" className="flex items-center gap-2">
      <Plus className="h-4 w-4" />
      Issue
    </TabsTrigger>
    <TabsTrigger value="revoke" className="flex items-center gap-2">
      <Trash2 className="h-4 w-4" />
      Revoke
    </TabsTrigger>
    <TabsTrigger value="batch" className="flex items-center gap-2">
      <Upload className="h-4 w-4" />
      Batch Issue
    </TabsTrigger>
    <TabsTrigger value="templates" className="flex items-center gap-2">
      <FileText className="h-4 w-4" />
      Templates
    </TabsTrigger>
  </TabsList>

  <TabsContent value="issue">{/* Issue form */}</TabsContent>
  <TabsContent value="revoke">{/* Revoke form */}</TabsContent>
  <TabsContent value="batch">{/* Batch issuance */}</TabsContent>
  <TabsContent value="templates">{/* Template management */}</TabsContent>
</Tabs>
```

### URL-Based Tab State

```typescript
import { useSearchParams } from "next/navigation"

const searchParams = useSearchParams()
const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "issue")

const handleTabChange = (value: string) => {
  setActiveTab(value)
  const url = new URL(window.location.href)
  url.searchParams.set("tab", value)
  window.history.pushState({}, "", url)
}

<Tabs value={activeTab} onValueChange={handleTabChange}>
  {/* ... */}
</Tabs>
```

---

## VFE-0317: Success Notifications (Toast)

### Definition
Ephemeral notification messages displayed after successful credential issuance or revocation, providing confirmation and actionable next steps to the issuer.

### Synonyms
- **Success Messages**: Message-focused terminology
- **Confirmation Toasts**: Confirmation perspective
- **Action Feedback**: Feedback-based naming
- **Issuer Notifications**: Notification context

### Technical Implementation

**Current Implementation**:
```typescript
import { useToast } from "@/hooks/use-toast"

const { toast } = useToast()

// After successful issuance
toast({
  title: "Credential Issued",
  description: (
    <div>
      <p>Credential {issuedId} has been successfully issued.</p>
      <Link href={`/profile?id=${issuedId}`} className="text-blue-600 underline">
        View Profile →
      </Link>
    </div>
  ),
})

// After successful revocation
toast({
  title: "Credential Revoked",
  description: `Credential ${revokeForm.credentialId} has been successfully revoked`,
})
```

**Enhanced with Rich Content & Actions**:
```typescript
// Issuance success with multiple actions
toast({
  title: "✅ Credential Issued Successfully",
  description: (
    <div className="space-y-2">
      <p>
        <strong>{issueForm.credentialType}</strong> issued to {issueForm.subjectId}
      </p>
      <p className="text-xs text-muted-foreground">
        Credential ID: <code className="font-mono">{issuedId}</code>
      </p>
      <div className="flex gap-2 mt-2">
        <Button size="sm" variant="outline" onClick={() => viewCredential(issuedId)}>
          View Credential
        </Button>
        <Button size="sm" variant="outline" onClick={() => downloadCredential(issuedId)}>
          Download JSON
        </Button>
        <Button size="sm" variant="outline" onClick={() => copyCredentialLink(issuedId)}>
          Copy Link
        </Button>
      </div>
    </div>
  ),
  duration: 10000, // 10 seconds for rich content
})

// Revocation success with notification status
toast({
  title: "🗑️ Credential Revoked",
  description: (
    <div className="space-y-2">
      <p>
        Credential <code className="font-mono">{revokeForm.credentialId}</code> has been revoked.
      </p>
      <p className="text-xs">
        ✉️ Notification email sent to credential holder<br />
        📝 Revocation recorded in audit log<br />
        🔄 Status list updated
      </p>
    </div>
  ),
  duration: 8000,
})
```

### Error Handling

```typescript
// Issuance error
toast({
  title: "Issue Failed",
  description: (
    <div className="space-y-2">
      <p>{errorMessage}</p>
      <Button size="sm" variant="outline" onClick={retryIssuance}>
        Retry
      </Button>
    </div>
  ),
  variant: "destructive",
})
```

---

## VFE-0318: Error Handling & Display

### Definition
User-facing error messages and error state UI that communicate failures in credential issuance or revocation, providing actionable guidance for resolution.

### Synonyms
- **Error Messages**: Message-focused terminology
- **Failure Notifications**: Failure perspective
- **Error Feedback**: Feedback-based naming
- **Error States**: State-based terminology

### Technical Implementation

**Current Implementation**:
```typescript
try {
  const response = await fetch("/api/issuer/credential", { ... })
  if (!response.ok) {
    throw new Error(`Failed to issue credential: ${response.status} ${response.statusText}`)
  }
  // ...
} catch (err) {
  const errorMessage = err instanceof Error ? err.message : "Failed to issue credential"
  toast({
    title: "Issue Failed",
    description: errorMessage,
    variant: "destructive",
  })
}
```

**Enhanced with Specific Error Handling**:
```typescript
interface IssuerError {
  code: string
  message: string
  details?: Record<string, any>
  recoverable: boolean
  retryAfter?: number // seconds
}

const ERROR_CODES = {
  INVALID_SUBJECT_ID: {
    title: "Invalid Subject ID",
    message: "The subject identifier format is invalid. Please check and try again.",
    action: "Fix subject ID",
  },
  DUPLICATE_CREDENTIAL: {
    title: "Duplicate Credential",
    message: "This subject already has an active credential of this type.",
    action: "View existing credential",
  },
  SIGNING_FAILED: {
    title: "Signing Failed",
    message: "Failed to cryptographically sign the credential. Please try again.",
    action: "Retry signing",
  },
  UNAUTHORIZED_ISSUER: {
    title: "Unauthorized",
    message: "You don't have authority to issue this credential type.",
    action: "Contact administrator",
  },
  RATE_LIMITED: {
    title: "Rate Limit Exceeded",
    message: "Too many issuance requests. Please wait before trying again.",
    action: "Wait and retry",
  },
}

const handleIssuanceError = (error: IssuerError) => {
  const config = ERROR_CODES[error.code] || {
    title: "Issuance Failed",
    message: error.message,
    action: "Retry",
  }

  toast({
    title: config.title,
    description: (
      <div className="space-y-2">
        <p>{config.message}</p>
        {error.details && (
          <details className="text-xs">
            <summary className="cursor-pointer">Technical Details</summary>
            <pre className="mt-2 p-2 bg-muted rounded overflow-auto">
              {JSON.stringify(error.details, null, 2)}
            </pre>
          </details>
        )}
        {error.recoverable && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleRetry}
            disabled={!!error.retryAfter}
          >
            {error.retryAfter ? `Retry in ${error.retryAfter}s` : config.action}
          </Button>
        )}
      </div>
    ),
    variant: "destructive",
    duration: error.recoverable ? 10000 : 5000,
  })
}
```

### Inline Form Validation

```tsx
const [formErrors, setFormErrors] = useState<Record<string, string>>({})

const validateForm = (): boolean => {
  const errors: Record<string, string> = {}

  if (!issueForm.credentialType) {
    errors.credentialType = "Credential type is required"
  }

  if (!validateLicenseNumber(issueForm.licenseNumber, issueForm.credentialType)) {
    errors.licenseNumber = `Invalid format for ${issueForm.credentialType}`
  }

  setFormErrors(errors)
  return Object.keys(errors).length === 0
}

<div className="space-y-1">
  <Input
    id="licenseNumber"
    value={issueForm.licenseNumber}
    onChange={...}
    aria-invalid={!!formErrors.licenseNumber}
    className={cn(formErrors.licenseNumber && "border-destructive")}
  />
  {formErrors.licenseNumber && (
    <p role="alert" className="text-sm text-destructive">
      {formErrors.licenseNumber}
    </p>
  )}
</div>
```

---

## VFE-0319: Form Validation & Disabled States

### Definition
Client-side validation logic and disabled button states that prevent form submission with incomplete or invalid data, providing immediate feedback and preventing errors.

### Synonyms
- **Input Validation**: Input-focused terminology
- **Form Guards**: Guard-based metaphor
- **Submission Prevention**: Prevention perspective
- **Form State Management**: State-based terminology

### Technical Implementation

**Current Implementation**:
```typescript
<Button
  type="submit"
  disabled={
    loading ||
    !issueForm.credentialType ||
    !issueForm.subjectId ||
    !issueForm.licenseNumber ||
    !issueForm.issuingAuthority
  }
>
  Issue Credential
</Button>
```

**Enhanced with Validation Rules**:
```typescript
interface ValidationRule {
  field: keyof IssueFormData
  required: boolean
  validator?: (value: any) => boolean
  errorMessage: string
}

const VALIDATION_RULES: ValidationRule[] = [
  {
    field: "credentialType",
    required: true,
    errorMessage: "Credential type is required",
  },
  {
    field: "subjectId",
    required: true,
    validator: (value) => validateSubjectId(value, issueForm.credentialType),
    errorMessage: "Invalid subject ID format",
  },
  {
    field: "licenseNumber",
    required: true,
    validator: (value) => validateLicenseNumber(value, issueForm.credentialType),
    errorMessage: "Invalid license number format",
  },
  {
    field: "issuingAuthority",
    required: true,
    errorMessage: "Issuing authority is required",
  },
  {
    field: "expiryDate",
    required: false,
    validator: (value) => !value || new Date(value) > new Date(),
    errorMessage: "Expiry date must be in the future",
  },
  {
    field: "additionalData",
    required: false,
    validator: (value) => {
      if (!value) return true
      try {
        JSON.parse(value)
        return true
      } catch {
        return false
      }
    },
    errorMessage: "Additional data must be valid JSON",
  },
]

const validateField = (field: keyof IssueFormData): string | null => {
  const rule = VALIDATION_RULES.find(r => r.field === field)
  if (!rule) return null

  const value = issueForm[field]

  if (rule.required && !value) {
    return rule.errorMessage
  }

  if (value && rule.validator && !rule.validator(value)) {
    return rule.errorMessage
  }

  return null
}

const isFormValid = (): boolean => {
  return VALIDATION_RULES.every(rule => validateField(rule.field) === null)
}

const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

const handleFieldBlur = (field: keyof IssueFormData) => {
  const error = validateField(field)
  setFieldErrors(prev => ({
    ...prev,
    [field]: error || "",
  }))
}
```

### Real-Time Validation Feedback

```tsx
<div className="space-y-1">
  <Label htmlFor="subjectId">Subject ID *</Label>
  <Input
    id="subjectId"
    value={issueForm.subjectId}
    onChange={(e) => setIssueForm(prev => ({ ...prev, subjectId: e.target.value }))}
    onBlur={() => handleFieldBlur("subjectId")}
    aria-invalid={!!fieldErrors.subjectId}
    aria-describedby={fieldErrors.subjectId ? "subjectId-error" : undefined}
    className={cn(fieldErrors.subjectId && "border-destructive")}
  />
  {fieldErrors.subjectId && (
    <p id="subjectId-error" role="alert" className="text-sm text-destructive">
      {fieldErrors.subjectId}
    </p>
  )}
  {!fieldErrors.subjectId && issueForm.subjectId && (
    <p className="text-sm text-success flex items-center gap-1">
      <CheckCircle className="h-3 w-3" />
      Valid subject ID
    </p>
  )}
</div>

<Button
  type="submit"
  disabled={loading || !isFormValid()}
  aria-disabled={loading || !isFormValid()}
  aria-describedby="submit-hint"
>
  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
  Issue Credential
</Button>
{!isFormValid() && (
  <p id="submit-hint" className="text-xs text-muted-foreground">
    Complete all required fields to issue credential
  </p>
)}
```

---

## VFE-0320: Credential Preview Card

### Definition
A card component displaying a visual preview of the credential being issued or managed, showing key metadata and allowing issuers to verify accuracy before issuance.

### Synonyms
- **Credential Summary**: Summary-focused terminology
- **Credential Details Card**: Details perspective
- **Credential Inspector**: Inspector tool metaphor
- **Credential Viewer**: Viewer-based naming

### Technical Implementation

```typescript
interface CredentialPreview {
  id?: string // If viewing existing credential
  type: string
  holder: string
  issuer: string
  licenseNumber: string
  issuedDate: string
  expiryDate?: string
  status: "draft" | "active" | "revoked" | "expired"
  additionalData?: Record<string, any>
}

const CredentialPreviewCard = ({ credential }: { credential: CredentialPreview }) => {
  return (
    <Card className="border-2 border-primary/20">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              {credential.type}
            </CardTitle>
            <CardDescription>{credential.issuer}</CardDescription>
          </div>
          <CredentialStatusBadge status={credential.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Credential ID */}
        {credential.id && (
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Credential ID:</span>
            <code className="text-sm font-mono">{credential.id}</code>
          </div>
        )}

        {/* License Number */}
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">License Number:</span>
          <span className="text-sm font-semibold">{credential.licenseNumber}</span>
        </div>

        {/* Holder */}
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">Credential Holder:</span>
          <span className="text-sm font-semibold">{credential.holder}</span>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4 pt-2 border-t">
          <div>
            <p className="text-xs text-muted-foreground">Issued</p>
            <p className="text-sm font-medium">
              {new Date(credential.issuedDate).toLocaleDateString()}
            </p>
          </div>
          {credential.expiryDate && (
            <div>
              <p className="text-xs text-muted-foreground">Expires</p>
              <p className="text-sm font-medium">
                {new Date(credential.expiryDate).toLocaleDateString()}
              </p>
            </div>
          )}
        </div>

        {/* Additional Data */}
        {credential.additionalData && Object.keys(credential.additionalData).length > 0 && (
          <Accordion type="single" collapsible>
            <AccordionItem value="additional">
              <AccordionTrigger className="text-sm">
                Additional Claims ({Object.keys(credential.additionalData).length})
              </AccordionTrigger>
              <AccordionContent>
                <dl className="space-y-2">
                  {Object.entries(credential.additionalData).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <dt className="text-xs text-muted-foreground">{key}:</dt>
                      <dd className="text-xs font-mono">{JSON.stringify(value)}</dd>
                    </div>
                  ))}
                </dl>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </CardContent>
      <CardFooter className="flex gap-2">
        {credential.status === "draft" && (
          <Button className="flex-1" onClick={handleIssue}>
            <Plus className="mr-2 h-4 w-4" />
            Confirm Issuance
          </Button>
        )}
        {credential.id && (
          <>
            <Button variant="outline" className="flex-1" onClick={() => downloadCredential(credential.id!)}>
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
            {credential.status === "active" && (
              <Button variant="destructive" className="flex-1" onClick={() => revokeCredential(credential.id!)}>
                <Trash2 className="mr-2 h-4 w-4" />
                Revoke
              </Button>
            )}
          </>
        )}
      </CardFooter>
    </Card>
  )
}
```

### Usage in Issuance Flow

```tsx
// Show preview before issuance
const [showPreview, setShowPreview] = useState(false)

const handlePreviewClick = () => {
  if (!isFormValid()) {
    toast({
      title: "Incomplete Form",
      description: "Complete all required fields to preview credential",
      variant: "destructive",
    })
    return
  }
  setShowPreview(true)
}

<div className="space-y-4">
  <Button type="button" variant="outline" onClick={handlePreviewClick} className="w-full">
    <Eye className="mr-2 h-4 w-4" />
    Preview Credential
  </Button>

  {showPreview && (
    <CredentialPreviewCard
      credential={{
        type: issueForm.credentialType,
        holder: issueForm.subjectId,
        issuer: issueForm.issuingAuthority,
        licenseNumber: issueForm.licenseNumber,
        issuedDate: new Date().toISOString(),
        expiryDate: issueForm.expiryDate,
        status: "draft",
        additionalData: issueForm.additionalData ? JSON.parse(issueForm.additionalData) : undefined,
      }}
    />
  )}
</div>
```

---

## Next Steps

1. ✅ **Issuer Portal UI glossary complete** (VFE-0301 to VFE-0320)
2. ⏳ Continue with **Wallet & Token Integration** glossary (VFE-0401 to VFE-0420)
3. ⏳ Create remaining 6 glossaries for Phase 1 categories
4. ⏳ Update `phase1-tracking.md` with completion status
5. ⏳ Begin Phase 2 tasks after all Phase 1 glossaries are complete

---

**Document Status**: ✅ Complete
**Word Count**: ~12,000 words
**Related Files**:
- `app/issuer/page.tsx` (source implementation)
- `docs/glossary-credential-management.md` (credential concepts)
- `docs/glossary-component-library.md` (UI components)
- `lib/credential-status-config.ts` (status configuration)

# Selective Disclosure Guide

**VitalCV - Privacy-Preserving Verifiable Credentials**

This guide explains how to use selective disclosure with BBS+ signatures to reveal only necessary credential fields while maintaining cryptographic proof.

---

## Table of Contents

- [Overview](#overview)
- [How It Works](#how-it-works)
- [API Workflow](#api-workflow)
- [Code Examples](#code-examples)
- [UI Integration](#ui-integration)
- [Best Practices](#best-practices)
- [Security Considerations](#security-considerations)

---

## Overview

### What is Selective Disclosure?

Selective disclosure allows a credential holder to reveal only specific fields from their credential while proving that:
1. The credential was issued by a trusted issuer
2. The credential has not been tampered with
3. The hidden fields exist but remain private

### Benefits

✅ **Enhanced Privacy**: Reveal only what's necessary
✅ **Cryptographic Proof**: Maintains integrity of hidden data
✅ **User Control**: Holder chooses what to share
✅ **Compliance**: Meets GDPR and privacy regulations

### Use Cases

- **Age Verification**: Prove you're over 21 without revealing birthdate
- **Employment**: Verify job title without revealing salary
- **Identity**: Prove name without revealing full address
- **Medical**: Verify vaccination status without revealing medical history

---

## How It Works

### 1. Regular Credential (Full Disclosure)

```json
{
  "@context": ["https://www.w3.org/2018/credentials/v1"],
  "id": "urn:uuid:12345",
  "type": ["VerifiableCredential", "DriverLicense"],
  "credentialSubject": {
    "id": "did:ethr:0x123...",
    "licenseNumber": "DL123456",
    "givenName": "John",
    "familyName": "Doe",
    "birthDate": "1990-01-01",
    "address": "123 Main St"
  },
  "proof": {
    "type": "Ed25519Signature2020",
    ...
  }
}
```

**Problem**: Verifier sees ALL fields

### 2. Derived Credential (Selective Disclosure)

```json
{
  "@context": ["https://www.w3.org/2018/credentials/v1"],
  "id": "urn:uuid:12345",
  "type": ["VerifiableCredential", "DriverLicense"],
  "credentialSubject": {
    "id": "did:ethr:0x123...",
    "givenName": "John",
    "familyName": "Doe"
    // birthDate and address HIDDEN
  },
  "proof": {
    "type": "BbsBlsSignatureProof2020",
    ...
  },
  "derivedFrom": "urn:uuid:12345",
  "revealedAttributes": ["id", "givenName", "familyName"]
}
```

**Solution**: Verifier sees ONLY revealed fields, but proof is still valid

---

## API Workflow

### Step 1: Analyze Credential

**Endpoint**: `GET /api/credentials/:id/analyze`

Check if a credential supports selective disclosure and get field suggestions.

**Request**:
```bash
curl -X GET \
  'https://api.vitalcv.app/api/credentials/abc123/analyze?purpose=age-verification' \
  -H 'Authorization: Bearer YOUR_TOKEN'
```

**Response**:
```json
{
  "supportsSelectiveDisclosure": true,
  "credentialType": "DriverLicense",
  "availableClaims": [
    {
      "name": "id",
      "required": true,
      "sensitive": false,
      "description": "Subject DID"
    },
    {
      "name": "licenseNumber",
      "required": false,
      "sensitive": true,
      "description": "Credential subject licenseNumber"
    },
    {
      "name": "givenName",
      "required": false,
      "sensitive": false
    },
    {
      "name": "familyName",
      "required": false,
      "sensitive": false
    },
    {
      "name": "birthDate",
      "required": false,
      "sensitive": true
    }
  ],
  "suggestions": {
    "required": ["id"],
    "suggested": ["givenName", "familyName"],
    "optional": ["licenseNumber", "birthDate", "address"]
  },
  "privacyAnalysis": {
    "totalFields": 6,
    "minimumRequired": 1,
    "privacyScores": {
      "minimumDisclosure": {
        "score": 83,
        "rating": "high",
        "description": "Excellent privacy - most data remains undisclosed"
      },
      "suggestedDisclosure": {
        "score": 50,
        "rating": "medium",
        "description": "Good privacy - significant data remains undisclosed"
      },
      "fullDisclosure": {
        "score": 0,
        "rating": "low",
        "description": "Limited privacy - most data is revealed"
      }
    }
  }
}
```

### Step 2: Derive Credential

**Endpoint**: `POST /api/credentials/:id/derive`

Create a derived credential with only selected fields.

**Request**:
```bash
curl -X POST \
  'https://api.vitalcv.app/api/credentials/abc123/derive' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "revealedFields": ["id", "givenName", "familyName"],
    "challenge": "verifier-nonce-123",
    "purpose": "identity-verification"
  }'
```

**Response**:
```json
{
  "derivedCredential": {
    "@context": ["https://www.w3.org/2018/credentials/v1"],
    "id": "urn:uuid:12345",
    "type": ["VerifiableCredential", "DriverLicense"],
    "issuer": "did:ethr:0xissuer...",
    "issuanceDate": "2024-10-08T12:00:00.000Z",
    "credentialSubject": {
      "id": "did:ethr:0x123...",
      "givenName": "John",
      "familyName": "Doe"
    },
    "proof": {
      "type": "BbsBlsSignatureProof2020",
      "created": "2024-10-08T15:30:00.000Z",
      "verificationMethod": "did:ethr:0xissuer...#key-1",
      "proofPurpose": "assertionMethod",
      "proofValue": "...",
      "nonce": "verifier-nonce-123"
    },
    "derivedFrom": "urn:uuid:12345",
    "revealedAttributes": ["id", "givenName", "familyName"]
  },
  "privacyScore": {
    "score": 50,
    "rating": "medium",
    "description": "Good privacy - significant data remains undisclosed"
  },
  "disclosure": {
    "totalFields": 6,
    "revealedFields": ["id", "givenName", "familyName"],
    "hiddenFields": ["licenseNumber", "birthDate", "address"],
    "privacyPreserved": "3/6 fields remain private"
  }
}
```

### Step 3: Verify Derived Credential

**Endpoint**: `POST /api/credentials/verify`

Verify the derived credential. The verifier cannot see hidden fields.

**Request**:
```bash
curl -X POST \
  'https://api.vitalcv.app/api/credentials/verify' \
  -H 'Authorization: Bearer VERIFIER_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "credential": { ...derivedCredential... },
    "challenge": "verifier-nonce-123",
    "presentationType": "selective"
  }'
```

**Response**:
```json
{
  "valid": true,
  "checks": {
    "structure": true,
    "signature": true,
    "expiration": true,
    "revocation": true,
    "issuerTrust": "verified"
  },
  "message": "Selective disclosure credential verified successfully",
  "verificationId": "xyz789",
  "disclosure": {
    "presentationType": "selective",
    "revealedFields": ["id", "givenName", "familyName"],
    "hiddenFields": "Not disclosed",
    "privacyPreserving": true,
    "derivedFrom": "urn:uuid:12345"
  },
  "credential": {
    "id": "urn:uuid:12345",
    "type": ["VerifiableCredential", "DriverLicense"],
    "issuer": "did:ethr:0xissuer...",
    "subject": "did:ethr:0x123...",
    "revealedAttributes": ["id", "givenName", "familyName"]
  }
}
```

---

## Code Examples

### JavaScript/TypeScript Example

```typescript
import { VitalCVClient } from '@vitalcv/sdk'

const client = new VitalCVClient({
  apiKey: process.env.VITALCV_API_KEY,
})

async function presentDriverLicenseForAgeVerification() {
  // 1. Get credential from wallet
  const credential = await client.credentials.get('my-driver-license-id')

  // 2. Analyze for selective disclosure
  const analysis = await client.credentials.analyze(credential.id, {
    purpose: 'age-verification',
  })

  if (!analysis.supportsSelectiveDisclosure) {
    throw new Error('Credential does not support selective disclosure')
  }

  // 3. Select fields to reveal
  // For age verification, only reveal name (required) + over21 status
  const fieldsToReveal = [
    ...analysis.suggestions.required, // Always include required fields
    'givenName',
    'familyName',
    // Do NOT reveal: birthDate, address, licenseNumber
  ]

  console.log('Privacy Score:', analysis.privacyAnalysis.privacyScores.suggestedDisclosure)
  // Output: { score: 67, rating: "high", description: "Excellent privacy..." }

  // 4. Get verifier's challenge
  const verifierChallenge = await getVerifierChallenge()

  // 5. Derive credential with selected fields
  const derived = await client.credentials.derive(credential.id, {
    revealedFields: fieldsToReveal,
    challenge: verifierChallenge,
    purpose: 'age-verification',
  })

  console.log('Revealed fields:', derived.disclosure.revealedFields)
  // Output: ["id", "givenName", "familyName"]

  console.log('Hidden fields:', derived.disclosure.hiddenFields)
  // Output: ["birthDate", "licenseNumber", "address"]

  // 6. Present to verifier
  return derived.derivedCredential
}

// Verifier side
async function verifyAgeCredential(derivedCredential: any, challenge: string) {
  const result = await client.credentials.verify({
    credential: derivedCredential,
    challenge,
    presentationType: 'selective',
  })

  if (result.valid) {
    console.log('Verification successful!')
    console.log('Name:', derivedCredential.credentialSubject.givenName)
    // Cannot access birthDate - it's not in the derived credential!
  }

  return result
}
```

### React Component Example

```tsx
import React, { useState, useEffect } from 'react'
import { useVitalCV } from '@vitalcv/react'

function SelectiveDisclosureForm({ credentialId }: { credentialId: string }) {
  const { credentials } = useVitalCV()
  const [analysis, setAnalysis] = useState(null)
  const [selectedFields, setSelectedFields] = useState<string[]>([])
  const [privacyScore, setPrivacyScore] = useState(null)

  useEffect(() => {
    // Analyze credential
    credentials.analyze(credentialId).then((result) => {
      setAnalysis(result)
      // Pre-select required + suggested fields
      setSelectedFields([
        ...result.suggestions.required,
        ...result.suggestions.suggested,
      ])
    })
  }, [credentialId])

  const handleFieldToggle = (fieldName: string) => {
    setSelectedFields((prev) =>
      prev.includes(fieldName)
        ? prev.filter((f) => f !== fieldName)
        : [...prev, fieldName]
    )
  }

  const calculatePrivacy = () => {
    if (!analysis) return null
    const total = analysis.availableClaims.length
    const revealed = selectedFields.length
    const score = Math.round(((total - revealed) / total) * 100)
    return {
      score,
      rating: score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low',
    }
  }

  const handleDerive = async () => {
    const challenge = await getVerifierChallenge()
    const derived = await credentials.derive(credentialId, {
      revealedFields: selectedFields,
      challenge,
    })

    // Present to verifier or save for later use
    console.log('Derived credential:', derived)
  }

  if (!analysis) return <div>Loading...</div>

  const privacy = calculatePrivacy()

  return (
    <div className="selective-disclosure-form">
      <h2>Select Fields to Reveal</h2>

      <div className="privacy-indicator">
        <div className={`privacy-badge ${privacy.rating}`}>
          Privacy Score: {privacy.score}/100 ({privacy.rating})
        </div>
      </div>

      <div className="field-list">
        {analysis.availableClaims.map((claim) => {
          const isRequired = analysis.suggestions.required.includes(claim.name)
          const isSensitive = claim.sensitive

          return (
            <label key={claim.name} className="field-item">
              <input
                type="checkbox"
                checked={selectedFields.includes(claim.name)}
                disabled={isRequired}
                onChange={() => handleFieldToggle(claim.name)}
              />
              <span className="field-label">
                {claim.name}
                {isRequired && <span className="badge required">Required</span>}
                {isSensitive && <span className="badge sensitive">Sensitive</span>}
              </span>
            </label>
          )
        })}
      </div>

      <button onClick={handleDerive} className="derive-btn">
        Create Privacy-Preserving Credential
      </button>

      <div className="disclosure-summary">
        <p>
          Revealing: {selectedFields.length} / {analysis.availableClaims.length} fields
        </p>
        <p>
          Hidden: {analysis.availableClaims.length - selectedFields.length} fields
        </p>
      </div>
    </div>
  )
}
```

---

## UI Integration

### Field Selector Component

Use the built-in utilities for field selection UI:

```typescript
import {
  claimsToSelectableFields,
  groupFieldsByCategory,
  validateFieldSelection,
  getPrivacyImpactMessage,
} from '@/lib/credentials/field-selector'

// Convert analysis to selectable fields
const fields = claimsToSelectableFields(
  analysis.availableClaims,
  analysis.suggestions.required,
  analysis.suggestions.suggested // pre-select suggested fields
)

// Group by category for better UX
const grouped = groupFieldsByCategory(fields)
// {
//   identity: [...],
//   contact: [...],
//   demographic: [...],
//   credential: [...],
//   other: [...]
// }

// Validate selection
const validation = validateFieldSelection(selectedFieldNames, fields)
if (!validation.valid) {
  console.error('Validation errors:', validation.errors)
}

if (validation.warnings.length > 0) {
  console.warn('Privacy warnings:', validation.warnings)
}

// Get privacy impact message
const impact = getPrivacyImpactMessage(
  selectedFieldNames.length,
  fields.length
)
console.log(impact.message)
// "High privacy: Only 3/8 fields revealed (62% remain private)"
```

---

## Best Practices

### For Credential Holders

1. **Minimize Disclosure**
   - Only reveal fields absolutely necessary
   - Start with minimum required fields
   - Add optional fields only when needed

2. **Understand Context**
   - Different verifiers may need different fields
   - Age verification ≠ Full identity check
   - Employment verification ≠ Background check

3. **Review Before Sharing**
   - Always review what fields you're revealing
   - Check privacy score
   - Consider if hidden fields could be inferred

4. **Use Purpose-Specific Derivations**
   - Create different derived credentials for different purposes
   - Don't reuse the same derived credential for multiple verifiers

### For Verifiers

1. **Request Minimum**
   - Only request fields you actually need
   - Provide clear purpose for verification
   - Respect user privacy

2. **Provide Challenge**
   - Always provide a unique challenge/nonce
   - Prevents replay attacks
   - Ensures freshness of presentation

3. **Accept Selective Disclosure**
   - Don't require full credential when selective disclosure is sufficient
   - Support multiple presentation types

4. **Audit Trail**
   - Log what fields were requested and received
   - Track verification attempts
   - Monitor for unusual patterns

### For Issuers

1. **Issue BBS+ Credentials**
   - Use BbsBlsSignature2020 for new credentials
   - Enables selective disclosure
   - Better privacy for holders

2. **Minimize Required Fields**
   - Mark as many fields as optional as possible
   - Gives holders more control

3. **Document Field Purposes**
   - Explain why each field is in the credential
   - Help holders make informed decisions

---

## Security Considerations

### Cryptographic Security

✅ **BBS+ Signatures**
- Pairing-based cryptography
- Selective disclosure without re-signing
- Zero-knowledge proofs

✅ **Challenge-Response**
- Prevents replay attacks
- Ensures presentation freshness
- Binds credential to specific verification

⚠️ **Limitations**
- Currently framework implementation
- Production needs `@mattrglobal/jsonld-signatures-bbs`
- Key management critical

### Privacy Considerations

✅ **What is Protected**
- Hidden field values remain completely private
- Verifier cannot guess or infer hidden values
- Unlinkability (cannot correlate presentations)

⚠️ **What is Not Protected**
- Field existence is known (schema is public)
- Correlation if same fields always revealed
- Timing attacks if not careful

### Compliance

✅ **GDPR**
- Data minimization (Art. 5)
- Purpose limitation (Art. 5)
- Storage limitation (Art. 5)
- Privacy by design (Art. 25)

✅ **CCPA**
- Consumer rights (access, deletion)
- Data minimization
- Transparency

---

## Troubleshooting

### Error: "Credential does not support selective disclosure"

**Cause**: Credential uses Ed25519 signature instead of BBS+

**Solution**: Request a new credential from issuer with BBS+ signature, or use full disclosure

### Error: "Missing required fields"

**Cause**: Trying to create derived credential without required fields

**Solution**: Include all required fields in `revealedFields` array

### Error: "Challenge mismatch"

**Cause**: Challenge in verification doesn't match challenge in derivation

**Solution**: Use the exact same challenge provided by verifier

### Low Privacy Score

**Cause**: Revealing too many fields

**Solution**: Review field selection and remove non-essential fields

---

## Next Steps

- **Sprint 4**: Full BBS+ library integration
- **Key Management**: HSM/KMS for production keys
- **Zero-Knowledge Proofs**: Range proofs, predicate proofs
- **Advanced Privacy**: Unlinkability, anonymous credentials

---

**Documentation Version**: 1.0.0
**Last Updated**: 2024-10-08
**Status**: Framework Implementation (Production BBS+ pending)

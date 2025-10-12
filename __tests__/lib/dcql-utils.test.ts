/**
 * Unit tests for DCQL utility functions
 */

import {
  buildMedicalCredentialQuery,
  buildDcqlRequest,
  generateNonce,
  validateNonce,
  mapVerifyStatus,
  extractClaims,
  type DcqlRequest,
  type VerificationResult,
} from '@/lib/verifier/dcql'

describe('DCQL Utilities', () => {
  describe('buildMedicalCredentialQuery', () => {
    it('should build a valid DCQL query', () => {
      const query = buildMedicalCredentialQuery({
        credentialType: 'MedicalLicense',
      })

      expect(query).toHaveProperty('id')
      expect(query).toHaveProperty('input_descriptors')
      expect(query).toHaveProperty('purpose')
      expect(query).toHaveProperty('format')
      expect(query.input_descriptors).toHaveLength(1)
    })

    it('should use default required fields', () => {
      const query = buildMedicalCredentialQuery({
        credentialType: 'MedicalLicense',
      })

      const descriptor = query.input_descriptors[0]
      expect(descriptor.constraints.fields).toHaveLength(3)
      expect(descriptor.constraints.fields.map((f) => f.path).flat()).toContain(
        '$.credentialSubject.licenseNumber'
      )
      expect(descriptor.constraints.fields.map((f) => f.path).flat()).toContain('$.credentialSubject.issuer')
      expect(descriptor.constraints.fields.map((f) => f.path).flat()).toContain(
        '$.credentialSubject.expiryDate'
      )
    })

    it('should use custom required fields', () => {
      const query = buildMedicalCredentialQuery({
        credentialType: 'MedicalLicense',
        requiredFields: ['licenseNumber', 'firstName', 'lastName'],
      })

      const descriptor = query.input_descriptors[0]
      expect(descriptor.constraints.fields).toHaveLength(3)
      expect(descriptor.constraints.fields.map((f) => f.path).flat()).toContain(
        '$.credentialSubject.firstName'
      )
      expect(descriptor.constraints.fields.map((f) => f.path).flat()).toContain(
        '$.credentialSubject.lastName'
      )
    })

    it('should set custom purpose', () => {
      const customPurpose = 'Verify board certification'
      const query = buildMedicalCredentialQuery({
        credentialType: 'BoardCertification',
        purpose: customPurpose,
      })

      expect(query.purpose).toBe(customPurpose)
    })

    it('should set limit_disclosure to preferred', () => {
      const query = buildMedicalCredentialQuery({
        credentialType: 'MedicalLicense',
      })

      expect(query.input_descriptors[0].constraints.limit_disclosure).toBe('preferred')
    })

    it('should include supported algorithms in format', () => {
      const query = buildMedicalCredentialQuery({
        credentialType: 'MedicalLicense',
      })

      expect(query.format?.jwt_vp?.alg).toContain('ES256')
      expect(query.format?.jwt_vp?.alg).toContain('ES256K')
      expect(query.format?.jwt_vp?.alg).toContain('EdDSA')
      expect(query.format?.ldp_vp?.proof_type).toContain('Ed25519Signature2020')
      expect(query.format?.ldp_vp?.proof_type).toContain('BbsBlsSignature2020')
    })

    it('should generate unique query IDs', () => {
      const query1 = buildMedicalCredentialQuery({ credentialType: 'MedicalLicense' })
      const query2 = buildMedicalCredentialQuery({ credentialType: 'MedicalLicense' })

      expect(query1.id).not.toBe(query2.id)
    })
  })

  describe('buildDcqlRequest', () => {
    it('should build a complete DCQL request', () => {
      const request = buildDcqlRequest({
        credentialType: 'MedicalLicense',
        nonce: 'test-nonce-123',
        audience: 'https://verifier.example.com',
      })

      expect(request).toHaveProperty('query')
      expect(request).toHaveProperty('nonce')
      expect(request).toHaveProperty('audience')
      expect(request.nonce).toBe('test-nonce-123')
      expect(request.audience).toBe('https://verifier.example.com')
    })

    it('should include response_uri when provided', () => {
      const request = buildDcqlRequest({
        credentialType: 'MedicalLicense',
        nonce: 'test-nonce',
        audience: 'https://verifier.example.com',
        responseUri: 'https://verifier.example.com/callback',
      })

      expect(request.response_uri).toBe('https://verifier.example.com/callback')
    })

    it('should pass through custom required fields', () => {
      const request = buildDcqlRequest({
        credentialType: 'MedicalLicense',
        nonce: 'test-nonce',
        audience: 'https://verifier.example.com',
        requiredFields: ['customField1', 'customField2'],
      })

      const fields = request.query.input_descriptors[0].constraints.fields
      expect(fields.map((f) => f.path).flat()).toContain('$.credentialSubject.customField1')
      expect(fields.map((f) => f.path).flat()).toContain('$.credentialSubject.customField2')
    })

    it('should pass through custom purpose', () => {
      const customPurpose = 'Hospital employment verification'
      const request = buildDcqlRequest({
        credentialType: 'MedicalLicense',
        nonce: 'test-nonce',
        audience: 'https://verifier.example.com',
        purpose: customPurpose,
      })

      expect(request.query.purpose).toBe(customPurpose)
    })
  })

  describe('generateNonce', () => {
    it('should generate a valid nonce', () => {
      const nonce = generateNonce()

      expect(typeof nonce).toBe('string')
      expect(nonce.length).toBeGreaterThan(0)
      expect(nonce).toMatch(/^[a-z0-9]+\.[a-z0-9]+\.[a-z0-9]+$/)
    })

    it('should generate unique nonces', () => {
      const nonce1 = generateNonce()
      const nonce2 = generateNonce()

      expect(nonce1).not.toBe(nonce2)
    })

    it('should include timestamp component', () => {
      const before = Date.now()
      const nonce = generateNonce()
      const after = Date.now()

      const [timestampStr] = nonce.split('.')
      const timestamp = parseInt(timestampStr, 36)

      expect(timestamp).toBeGreaterThanOrEqual(parseInt(before.toString(36), 36))
      expect(timestamp).toBeLessThanOrEqual(parseInt(after.toString(36), 36))
    })
  })

  describe('validateNonce', () => {
    it('should validate a fresh nonce', () => {
      const nonce = generateNonce()
      const isValid = validateNonce(nonce)

      expect(isValid).toBe(true)
    })

    it('should reject an expired nonce', () => {
      // Create a nonce from 10 minutes ago
      const oldTimestamp = (Date.now() - 10 * 60 * 1000).toString(36)
      const nonce = `${oldTimestamp}.abc123.def456`

      const isValid = validateNonce(nonce)

      expect(isValid).toBe(false)
    })

    it('should accept nonce within custom max age', () => {
      // Create a nonce from 2 minutes ago
      const timestamp = (Date.now() - 2 * 60 * 1000).toString(36)
      const nonce = `${timestamp}.abc123.def456`

      // Validate with 3 minute max age
      const isValid = validateNonce(nonce, 3 * 60 * 1000)

      expect(isValid).toBe(true)
    })

    it('should reject nonce older than custom max age', () => {
      // Create a nonce from 2 minutes ago
      const timestamp = (Date.now() - 2 * 60 * 1000).toString(36)
      const nonce = `${timestamp}.abc123.def456`

      // Validate with 1 minute max age
      const isValid = validateNonce(nonce, 1 * 60 * 1000)

      expect(isValid).toBe(false)
    })

    it('should reject malformed nonce', () => {
      const isValid = validateNonce('not-a-valid-nonce')

      expect(isValid).toBe(false)
    })

    it('should reject nonce with future timestamp', () => {
      // Create a nonce from 1 minute in the future
      const futureTimestamp = (Date.now() + 60 * 1000).toString(36)
      const nonce = `${futureTimestamp}.abc123.def456`

      const isValid = validateNonce(nonce)

      expect(isValid).toBe(false)
    })

    it('should validate nonce at exact max age boundary', () => {
      const maxAge = 5 * 60 * 1000
      const timestamp = (Date.now() - maxAge).toString(36)
      const nonce = `${timestamp}.abc123.def456`

      const isValid = validateNonce(nonce, maxAge)

      expect(isValid).toBe(true)
    })
  })

  describe('mapVerifyStatus', () => {
    it('should map valid status to success', () => {
      const apiResponse = {
        status: 'valid',
        credentialId: 'cred-123',
        auditRef: 'audit-456',
      }

      const result = mapVerifyStatus(apiResponse)

      expect(result.status).toBe('success')
      expect(result.credentialId).toBe('cred-123')
      expect(result.auditRef).toBe('audit-456')
      expect(result.errors).toBeUndefined()
    })

    it('should map success status to success', () => {
      const apiResponse = {
        status: 'success',
        credentialId: 'cred-123',
      }

      const result = mapVerifyStatus(apiResponse)

      expect(result.status).toBe('success')
    })

    it('should map invalid status to fail', () => {
      const apiResponse = {
        status: 'invalid',
        credentialId: 'cred-123',
        reason: 'Signature verification failed',
      }

      const result = mapVerifyStatus(apiResponse)

      expect(result.status).toBe('fail')
      expect(result.errors).toContain('Signature verification failed')
    })

    it('should map revoked status to fail', () => {
      const apiResponse = {
        status: 'revoked',
        credentialId: 'cred-123',
        reason: 'Credential has been revoked',
      }

      const result = mapVerifyStatus(apiResponse)

      expect(result.status).toBe('fail')
      expect(result.errors).toContain('Credential has been revoked')
    })

    it('should include claims when present', () => {
      const claims = {
        licenseNumber: 'ABC123',
        issuer: 'State Medical Board',
      }

      const apiResponse = {
        status: 'valid',
        credentialId: 'cred-123',
        claims,
      }

      const result = mapVerifyStatus(apiResponse)

      expect(result.claims).toEqual(claims)
    })

    it('should generate audit ref if missing', () => {
      const apiResponse = {
        status: 'valid',
        credentialId: 'cred-123',
      }

      const result = mapVerifyStatus(apiResponse)

      expect(result.auditRef).toMatch(/^audit_\d+$/)
    })

    it('should use unknown as credential ID if missing', () => {
      const apiResponse = {
        status: 'valid',
      }

      const result = mapVerifyStatus(apiResponse)

      expect(result.credentialId).toBe('unknown')
    })

    it('should set timestamp to current time', () => {
      const before = new Date()
      const apiResponse = {
        status: 'valid',
        credentialId: 'cred-123',
      }

      const result = mapVerifyStatus(apiResponse)
      const after = new Date()

      expect(result.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime())
      expect(result.timestamp.getTime()).toBeLessThanOrEqual(after.getTime())
    })

    it('should use default error message for fail without reason', () => {
      const apiResponse = {
        status: 'invalid',
        credentialId: 'cred-123',
      }

      const result = mapVerifyStatus(apiResponse)

      expect(result.errors).toContain('Verification failed')
    })
  })

  describe('extractClaims', () => {
    it('should extract claims from nested object', () => {
      const presentation = {
        credentialSubject: {
          licenseNumber: 'ABC123',
          issuer: 'State Medical Board',
          expiryDate: '2025-12-31',
        },
      }

      const paths = [
        '$.credentialSubject.licenseNumber',
        '$.credentialSubject.issuer',
        '$.credentialSubject.expiryDate',
      ]

      const claims = extractClaims(presentation, paths)

      expect(claims).toEqual({
        licenseNumber: 'ABC123',
        issuer: 'State Medical Board',
        expiryDate: '2025-12-31',
      })
    })

    it('should handle missing paths gracefully', () => {
      const presentation = {
        credentialSubject: {
          licenseNumber: 'ABC123',
        },
      }

      const paths = ['$.credentialSubject.licenseNumber', '$.credentialSubject.nonexistent']

      const claims = extractClaims(presentation, paths)

      expect(claims).toEqual({
        licenseNumber: 'ABC123',
      })
      expect(claims).not.toHaveProperty('nonexistent')
    })

    it('should extract deeply nested values', () => {
      const presentation = {
        vc: {
          credentialSubject: {
            address: {
              street: '123 Main St',
              city: 'Springfield',
            },
          },
        },
      }

      const paths = ['$.vc.credentialSubject.address.city']

      const claims = extractClaims(presentation, paths)

      expect(claims).toEqual({
        city: 'Springfield',
      })
    })

    it('should handle empty paths array', () => {
      const presentation = { foo: 'bar' }
      const paths: string[] = []

      const claims = extractClaims(presentation, paths)

      expect(claims).toEqual({})
    })

    it('should handle null/undefined presentation', () => {
      const paths = ['$.foo']

      const claims1 = extractClaims(null, paths)
      const claims2 = extractClaims(undefined, paths)

      expect(claims1).toEqual({})
      expect(claims2).toEqual({})
    })
  })

  describe('Integration: Full DCQL flow', () => {
    it('should create request, generate nonce, and validate', () => {
      const nonce = generateNonce()
      const request = buildDcqlRequest({
        credentialType: 'MedicalLicense',
        nonce,
        audience: 'https://verifier.example.com',
      })

      expect(validateNonce(request.nonce)).toBe(true)
      expect(request.query.input_descriptors).toHaveLength(1)
      expect(request.query.input_descriptors[0].id).toContain('MedicalLicense')
    })

    it('should map API response and include all components', () => {
      const apiResponse = {
        status: 'valid',
        credentialId: 'cred-789',
        auditRef: 'audit-999',
        claims: {
          licenseNumber: 'XYZ789',
          issuer: 'Medical Board',
        },
      }

      const result = mapVerifyStatus(apiResponse)

      expect(result.status).toBe('success')
      expect(result.credentialId).toBe('cred-789')
      expect(result.auditRef).toBe('audit-999')
      expect(result.claims).toEqual({
        licenseNumber: 'XYZ789',
        issuer: 'Medical Board',
      })
      expect(result.timestamp).toBeInstanceOf(Date)
    })
  })
})

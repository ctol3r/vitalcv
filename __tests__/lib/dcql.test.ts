/**
 * Unit Tests for DCQL Builder
 */

import {
  buildMedicalCredentialQuery,
  buildDcqlRequest,
  generateNonce,
  validateNonce,
  mapVerifyStatus,
  extractClaims,
} from '@/lib/verifier/dcql'

describe('DCQL Builder', () => {
  describe('generateNonce', () => {
    it('should generate a nonce with correct format', () => {
      const nonce = generateNonce()
      const parts = nonce.split('.')

      expect(parts).toHaveLength(3)
      expect(nonce).toMatch(/^[a-z0-9]+\.[a-z0-9]+\.[a-z0-9]+$/)
    })

    it('should generate unique nonces', () => {
      const nonce1 = generateNonce()
      const nonce2 = generateNonce()

      expect(nonce1).not.toBe(nonce2)
    })
  })

  describe('validateNonce', () => {
    it('should validate a fresh nonce', () => {
      const nonce = generateNonce()
      const isValid = validateNonce(nonce, 5 * 60 * 1000)

      expect(isValid).toBe(true)
    })

    it('should reject an expired nonce', () => {
      // Create a nonce from 10 minutes ago
      const oldTimestamp = (Date.now() - 10 * 60 * 1000).toString(36)
      const nonce = `${oldTimestamp}.abc123.def456`

      const isValid = validateNonce(nonce, 5 * 60 * 1000)

      expect(isValid).toBe(false)
    })

    it('should reject an invalid nonce format', () => {
      const isValid = validateNonce('invalid-nonce', 5 * 60 * 1000)

      expect(isValid).toBe(false)
    })
  })

  describe('buildMedicalCredentialQuery', () => {
    it('should build a valid DCQL query', () => {
      const query = buildMedicalCredentialQuery({
        credentialType: 'MedicalLicense',
        requiredFields: ['licenseNumber', 'issuer'],
        purpose: 'Verify credentials',
      })

      expect(query.id).toMatch(/^dcql_/)
      expect(query.purpose).toBe('Verify credentials')
      expect(query.input_descriptors).toHaveLength(1)
      expect(query.input_descriptors[0].constraints.fields).toHaveLength(2)
    })

    it('should use default fields when not specified', () => {
      const query = buildMedicalCredentialQuery({
        credentialType: 'MedicalLicense',
      })

      const fields = query.input_descriptors[0].constraints.fields
      expect(fields).toHaveLength(3)
      expect(fields[0].path[0]).toContain('licenseNumber')
    })

    it('should set limit_disclosure to preferred', () => {
      const query = buildMedicalCredentialQuery({
        credentialType: 'MedicalLicense',
      })

      expect(query.input_descriptors[0].constraints.limit_disclosure).toBe('preferred')
    })
  })

  describe('buildDcqlRequest', () => {
    it('should build a complete DCQL request', () => {
      const request = buildDcqlRequest({
        credentialType: 'MedicalLicense',
        nonce: 'test-nonce',
        audience: 'vitalcv.com',
        requiredFields: ['licenseNumber'],
        purpose: 'Verification',
      })

      expect(request.query).toBeDefined()
      expect(request.nonce).toBe('test-nonce')
      expect(request.audience).toBe('vitalcv.com')
    })

    it('should include response_uri when provided', () => {
      const request = buildDcqlRequest({
        credentialType: 'MedicalLicense',
        nonce: 'test-nonce',
        audience: 'vitalcv.com',
        responseUri: 'https://vitalcv.com/callback',
      })

      expect(request.response_uri).toBe('https://vitalcv.com/callback')
    })
  })

  describe('mapVerifyStatus', () => {
    it('should map valid status to success', () => {
      const result = mapVerifyStatus({
        status: 'valid',
        credentialId: 'CRED-123',
        auditRef: 'audit-456',
      })

      expect(result.status).toBe('success')
      expect(result.credentialId).toBe('CRED-123')
      expect(result.auditRef).toBe('audit-456')
      expect(result.timestamp).toBeInstanceOf(Date)
    })

    it('should map invalid status to fail', () => {
      const result = mapVerifyStatus({
        status: 'revoked',
        credentialId: 'CRED-123',
        reason: 'Credential revoked',
      })

      expect(result.status).toBe('fail')
      expect(result.errors).toContain('Credential revoked')
    })

    it('should include claims when provided', () => {
      const result = mapVerifyStatus({
        status: 'success',
        credentialId: 'CRED-123',
        claims: {
          licenseNumber: 'MD123456',
          issuer: 'California Medical Board',
        },
      })

      expect(result.claims).toEqual({
        licenseNumber: 'MD123456',
        issuer: 'California Medical Board',
      })
    })
  })

  describe('extractClaims', () => {
    it('should extract claims from presentation', () => {
      const presentation = {
        credentialSubject: {
          licenseNumber: 'MD123456',
          issuer: 'California Medical Board',
        },
      }

      const claims = extractClaims(presentation, [
        'credentialSubject.licenseNumber',
        'credentialSubject.issuer',
      ])

      expect(claims.licenseNumber).toBe('MD123456')
      expect(claims.issuer).toBe('California Medical Board')
    })

    it('should handle missing paths gracefully', () => {
      const presentation = {
        credentialSubject: {
          licenseNumber: 'MD123456',
        },
      }

      const claims = extractClaims(presentation, ['credentialSubject.nonexistent'])

      expect(Object.keys(claims)).toHaveLength(0)
    })
  })
})

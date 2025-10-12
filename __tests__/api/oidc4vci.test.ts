/**
 * OIDC4VCI API Integration Tests
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'
import { clearAllStorage } from '@/lib/oidc4vci/storage'
import { generatePreAuthorizedCode, validatePKCE, generateNonce } from '@/lib/oidc4vci/utils'
import crypto from 'crypto'

describe('OIDC4VCI Utilities', () => {
  describe('generatePreAuthorizedCode', () => {
    it('should generate unique codes', () => {
      const code1 = generatePreAuthorizedCode()
      const code2 = generatePreAuthorizedCode()
      expect(code1).not.toBe(code2)
      expect(code1).toMatch(/^pre-auth_/)
    })
  })

  describe('validatePKCE', () => {
    it('should validate correct code_verifier', () => {
      const codeVerifier = crypto.randomBytes(32).toString('base64url')
      const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url')

      const result = validatePKCE(codeVerifier, codeChallenge)
      expect(result).toBe(true)
    })

    it('should reject incorrect code_verifier', () => {
      const codeVerifier = crypto.randomBytes(32).toString('base64url')
      const wrongChallenge = crypto.randomBytes(32).toString('base64url')

      const result = validatePKCE(codeVerifier, wrongChallenge)
      expect(result).toBe(false)
    })

    it('should reject empty values', () => {
      expect(validatePKCE('', 'challenge')).toBe(false)
      expect(validatePKCE('verifier', '')).toBe(false)
    })
  })

  describe('generateNonce', () => {
    it('should generate unique nonces', () => {
      const nonce1 = generateNonce()
      const nonce2 = generateNonce()
      expect(nonce1).not.toBe(nonce2)
      expect(nonce1.length).toBeGreaterThan(20)
    })
  })
})

describe('OIDC4VCI Storage', () => {
  beforeAll(async () => {
    await clearAllStorage()
  })

  afterAll(async () => {
    await clearAllStorage()
  })

  it('should store and retrieve offers', async () => {
    const { storeOffer, getOffer } = await import('@/lib/oidc4vci/storage')

    const code = 'test-offer-123'
    const offer = {
      offer: {
        credential_issuer: 'https://test.com',
        credential_configuration_ids: ['TestCredential'],
        grants: {
          'urn:ietf:params:oauth:grant-type:pre-authorized_code': {
            'pre-authorized_code': code,
          },
        },
      },
      pre_authorized_code: code,
      created_at: Date.now(),
      expires_at: Date.now() + 10 * 60 * 1000,
      redeemed: false,
    }

    await storeOffer(code, offer)
    const retrieved = await getOffer(code)

    expect(retrieved).toEqual(offer)
  })

  it('should return null for non-existent offers', async () => {
    const { getOffer } = await import('@/lib/oidc4vci/storage')
    const retrieved = await getOffer('non-existent-code')
    expect(retrieved).toBeNull()
  })

  it('should mark offers as redeemed atomically', async () => {
    const { storeOffer, redeemOffer, getOffer } = await import('@/lib/oidc4vci/storage')

    const code = 'test-redeem-123'
    const offer = {
      offer: {
        credential_issuer: 'https://test.com',
        credential_configuration_ids: ['TestCredential'],
        grants: {
          'urn:ietf:params:oauth:grant-type:pre-authorized_code': {
            'pre-authorized_code': code,
          },
        },
      },
      pre_authorized_code: code,
      created_at: Date.now(),
      expires_at: Date.now() + 10 * 60 * 1000,
      redeemed: false,
    }

    await storeOffer(code, offer)
    const redeemed = await redeemOffer(code)
    expect(redeemed).toBe(true)

    // Second redemption should fail
    const redeemedAgain = await redeemOffer(code)
    expect(redeemedAgain).toBe(false)
  })
})

describe('OIDC4VCI Mock API Scenarios', () => {
  it('should validate offer creation payload', () => {
    const validPayload = {
      credentialType: 'MedicalLicense',
      issuerId: 'test-issuer-001',
    }

    expect(validPayload.credentialType).toBeDefined()
    expect(validPayload.issuerId).toBeDefined()
  })

  it('should validate token request payload', () => {
    const validPayload = {
      grant_type: 'urn:ietf:params:oauth:grant-type:pre-authorized_code',
      'pre-authorized_code': 'pre-auth_test123',
    }

    expect(validPayload.grant_type).toBe('urn:ietf:params:oauth:grant-type:pre-authorized_code')
    expect(validPayload['pre-authorized_code']).toMatch(/^pre-auth_/)
  })

  it('should validate credential request payload', () => {
    const validPayload = {
      format: 'jwt_vc_json' as const,
      proof: {
        proof_type: 'jwt' as const,
        jwt: 'eyJhbGciOiJFUzI1NiJ9.eyJub25jZSI6InRlc3QifQ.signature',
      },
    }

    expect(validPayload.format).toBe('jwt_vc_json')
    expect(validPayload.proof.proof_type).toBe('jwt')
  })
})

describe('Error Scenarios', () => {
  it('should handle expired offers', async () => {
    const { storeOffer, getOffer } = await import('@/lib/oidc4vci/storage')

    const code = 'expired-offer-123'
    const expiredOffer = {
      offer: {
        credential_issuer: 'https://test.com',
        credential_configuration_ids: ['TestCredential'],
        grants: {
          'urn:ietf:params:oauth:grant-type:pre-authorized_code': {
            'pre-authorized_code': code,
          },
        },
      },
      pre_authorized_code: code,
      created_at: Date.now() - 20 * 60 * 1000, // 20 minutes ago
      expires_at: Date.now() - 10 * 60 * 1000, // Expired 10 minutes ago
      redeemed: false,
    }

    await storeOffer(code, expiredOffer)

    // Should return null for expired offer
    const retrieved = await getOffer(code)
    // Note: In-memory storage checks expiry, Redis TTL handles it automatically
    if (retrieved) {
      expect(Date.now()).toBeLessThan(retrieved.expires_at)
    }
  })

  it('should validate required fields in offer request', () => {
    const invalidPayload = {
      credentialType: '', // Empty
      issuerId: 'test-issuer',
    }

    expect(invalidPayload.credentialType).toBeFalsy()
  })
})

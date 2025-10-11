/**
 * Unit Tests for OIDC4VCI Utilities
 */

import {
  generatePreAuthorizedCode,
  buildCredentialOffer,
  createOfferUrl,
  parseOfferUrl,
  validatePreAuthCode,
} from '@/lib/credentials/oidc4vci'

describe('OIDC4VCI Utilities', () => {
  describe('generatePreAuthorizedCode', () => {
    it('should generate a pre-authorized code with correct prefix', () => {
      const code = generatePreAuthorizedCode()
      expect(code).toMatch(/^pre-auth_/)
    })

    it('should generate unique codes', () => {
      const code1 = generatePreAuthorizedCode()
      const code2 = generatePreAuthorizedCode()
      expect(code1).not.toBe(code2)
    })
  })

  describe('buildCredentialOffer', () => {
    it('should build a valid credential offer', () => {
      const offer = buildCredentialOffer({
        credentialType: 'MedicalLicense',
        issuerId: 'test-issuer',
      })

      expect(offer.credential_issuer).toContain('/issuer')
      expect(offer.credential_configuration_ids).toContain('MedicalLicense')
      expect(offer.grants['urn:ietf:params:oauth:grant-type:pre-authorized_code']).toBeDefined()
    })

    it('should include custom pre-authorized code if provided', () => {
      const customCode = 'pre-auth_custom123'
      const offer = buildCredentialOffer({
        credentialType: 'MedicalLicense',
        issuerId: 'test-issuer',
        preAuthorizedCode: customCode,
      })

      expect(offer.grants['urn:ietf:params:oauth:grant-type:pre-authorized_code']['pre-authorized_code']).toBe(
        customCode
      )
    })

    it('should set user_pin_required when userPin is provided', () => {
      const offer = buildCredentialOffer({
        credentialType: 'MedicalLicense',
        issuerId: 'test-issuer',
        userPin: '1234',
      })

      expect(offer.grants['urn:ietf:params:oauth:grant-type:pre-authorized_code'].user_pin_required).toBe(true)
    })
  })

  describe('createOfferUrl', () => {
    it('should create offer URL with all required components', () => {
      const result = createOfferUrl({
        credentialType: 'MedicalLicense',
        issuerId: 'test-issuer',
      })

      expect(result.offerUrl).toMatch(/^openid-credential-offer:\/\//)
      expect(result.deepLink).toMatch(/^vitalcv-wallet:\/\//)
      expect(result.qrData).toBe(result.offerUrl)
      expect(result.preAuthorizedCode).toMatch(/^pre-auth_/)
      expect(result.expiresAt).toBeInstanceOf(Date)
    })

    it('should set expiry time to 10 minutes in the future', () => {
      const now = Date.now()
      const result = createOfferUrl({
        credentialType: 'MedicalLicense',
        issuerId: 'test-issuer',
      })

      const expiryMs = result.expiresAt.getTime()
      const expectedExpiry = now + 10 * 60 * 1000
      const diff = Math.abs(expiryMs - expectedExpiry)

      // Allow 1 second tolerance for test execution time
      expect(diff).toBeLessThan(1000)
    })
  })

  describe('parseOfferUrl', () => {
    it('should parse a valid offer URL', () => {
      const offer = buildCredentialOffer({
        credentialType: 'MedicalLicense',
        issuerId: 'test-issuer',
      })

      const offerJson = JSON.stringify(offer)
      const encodedOffer = Buffer.from(offerJson).toString('base64')
      const offerUrl = `openid-credential-offer://?credential_offer=${encodeURIComponent(encodedOffer)}`

      const parsed = parseOfferUrl(offerUrl)

      expect(parsed).not.toBeNull()
      expect(parsed?.credential_issuer).toBe(offer.credential_issuer)
      expect(parsed?.credential_configuration_ids).toEqual(offer.credential_configuration_ids)
    })

    it('should return null for invalid URL', () => {
      const result = parseOfferUrl('invalid-url')
      expect(result).toBeNull()
    })

    it('should return null for URL without offer parameter', () => {
      const result = parseOfferUrl('openid-credential-offer://?foo=bar')
      expect(result).toBeNull()
    })
  })

  describe('validatePreAuthCode', () => {
    it('should validate a valid pre-authorized code', () => {
      const code = generatePreAuthorizedCode()
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

      const result = validatePreAuthCode(code, expiresAt)

      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should reject invalid code format', () => {
      const result = validatePreAuthCode('invalid-code', new Date())

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Invalid pre-authorized code format')
    })

    it('should reject expired code', () => {
      const code = generatePreAuthorizedCode()
      const expiresAt = new Date(Date.now() - 1000) // 1 second ago

      const result = validatePreAuthCode(code, expiresAt)

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Pre-authorized code has expired')
    })
  })
})

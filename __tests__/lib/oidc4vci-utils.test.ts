/**
 * Unit tests for OIDC4VCI utility functions
 */

import {
  generatePreAuthorizedCode,
  buildCredentialOffer,
  createOfferUrl,
  parseOfferUrl,
  validatePreAuthCode,
  type CredentialOfferParams,
} from '@/lib/credentials/oidc4vci'

describe('OIDC4VCI Utilities', () => {
  describe('generatePreAuthorizedCode', () => {
    it('should generate a pre-authorized code with correct format', () => {
      const code = generatePreAuthorizedCode()

      expect(code).toMatch(/^pre-auth_[a-z0-9]+_[a-z0-9]+$/)
      expect(code.startsWith('pre-auth_')).toBe(true)
    })

    it('should generate unique codes', () => {
      const code1 = generatePreAuthorizedCode()
      const code2 = generatePreAuthorizedCode()

      expect(code1).not.toBe(code2)
    })
  })

  describe('buildCredentialOffer', () => {
    it('should build a valid credential offer', () => {
      const params: CredentialOfferParams = {
        credentialType: 'MedicalLicense',
        issuerId: 'issuer-001',
        subjectId: 'user-123',
      }

      const offer = buildCredentialOffer(params)

      expect(offer).toHaveProperty('credential_issuer')
      expect(offer).toHaveProperty('credential_configuration_ids')
      expect(offer).toHaveProperty('grants')
      expect(offer.credential_configuration_ids).toContain('MedicalLicense')
      expect(offer.grants['urn:ietf:params:oauth:grant-type:pre-authorized_code']).toHaveProperty(
        'pre-authorized_code'
      )
    })

    it('should use provided pre-authorized code', () => {
      const params: CredentialOfferParams = {
        credentialType: 'MedicalLicense',
        issuerId: 'issuer-001',
        preAuthorizedCode: 'pre-auth_custom_code',
      }

      const offer = buildCredentialOffer(params)

      expect(
        offer.grants['urn:ietf:params:oauth:grant-type:pre-authorized_code']['pre-authorized_code']
      ).toBe('pre-auth_custom_code')
    })

    it('should set user_pin_required when userPin is provided', () => {
      const params: CredentialOfferParams = {
        credentialType: 'MedicalLicense',
        issuerId: 'issuer-001',
        userPin: '123456',
      }

      const offer = buildCredentialOffer(params)

      expect(
        offer.grants['urn:ietf:params:oauth:grant-type:pre-authorized_code']['user_pin_required']
      ).toBe(true)
    })

    it('should use custom credential configuration IDs', () => {
      const params: CredentialOfferParams = {
        credentialType: 'MedicalLicense',
        issuerId: 'issuer-001',
        credentialConfigurationIds: ['MedicalLicense', 'BoardCertification'],
      }

      const offer = buildCredentialOffer(params)

      expect(offer.credential_configuration_ids).toEqual(['MedicalLicense', 'BoardCertification'])
    })
  })

  describe('createOfferUrl', () => {
    it('should create offer URL with all required components', () => {
      const params: CredentialOfferParams = {
        credentialType: 'MedicalLicense',
        issuerId: 'issuer-001',
      }

      const result = createOfferUrl(params)

      expect(result).toHaveProperty('offerUrl')
      expect(result).toHaveProperty('deepLink')
      expect(result).toHaveProperty('qrData')
      expect(result).toHaveProperty('preAuthorizedCode')
      expect(result).toHaveProperty('expiresAt')
    })

    it('should generate openid-credential-offer URL scheme', () => {
      const params: CredentialOfferParams = {
        credentialType: 'MedicalLicense',
        issuerId: 'issuer-001',
      }

      const result = createOfferUrl(params)

      expect(result.offerUrl).toMatch(/^openid-credential-offer:\/\//)
      expect(result.offerUrl).toContain('credential_offer=')
    })

    it('should generate wallet deep link', () => {
      const params: CredentialOfferParams = {
        credentialType: 'MedicalLicense',
        issuerId: 'issuer-001',
      }

      const result = createOfferUrl(params)

      expect(result.deepLink).toMatch(/^vitalcv-wallet:\/\//)
      expect(result.deepLink).toContain('credential-offer?offer=')
    })

    it('should set expiration time to 10 minutes in the future', () => {
      const params: CredentialOfferParams = {
        credentialType: 'MedicalLicense',
        issuerId: 'issuer-001',
      }

      const before = Date.now()
      const result = createOfferUrl(params)
      const after = Date.now()

      const expectedMin = before + 10 * 60 * 1000
      const expectedMax = after + 10 * 60 * 1000

      expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(expectedMin)
      expect(result.expiresAt.getTime()).toBeLessThanOrEqual(expectedMax)
    })

    it('should make QR data equal to offer URL', () => {
      const params: CredentialOfferParams = {
        credentialType: 'MedicalLicense',
        issuerId: 'issuer-001',
      }

      const result = createOfferUrl(params)

      expect(result.qrData).toBe(result.offerUrl)
    })
  })

  describe('parseOfferUrl', () => {
    it('should parse a valid offer URL', () => {
      const params: CredentialOfferParams = {
        credentialType: 'MedicalLicense',
        issuerId: 'issuer-001',
      }

      const { offerUrl } = createOfferUrl(params)
      const parsed = parseOfferUrl(offerUrl)

      expect(parsed).not.toBeNull()
      expect(parsed).toHaveProperty('credential_issuer')
      expect(parsed).toHaveProperty('credential_configuration_ids')
      expect(parsed).toHaveProperty('grants')
    })

    it('should return null for invalid URL', () => {
      const result = parseOfferUrl('invalid-url')

      expect(result).toBeNull()
    })

    it('should return null for URL without credential_offer parameter', () => {
      const result = parseOfferUrl('openid-credential-offer://?foo=bar')

      expect(result).toBeNull()
    })

    it('should return null for URL with malformed base64', () => {
      const result = parseOfferUrl('openid-credential-offer://?credential_offer=not-valid-base64!')

      expect(result).toBeNull()
    })

    it('should correctly parse credential configuration IDs', () => {
      const params: CredentialOfferParams = {
        credentialType: 'MedicalLicense',
        issuerId: 'issuer-001',
        credentialConfigurationIds: ['MedicalLicense', 'BoardCertification'],
      }

      const { offerUrl } = createOfferUrl(params)
      const parsed = parseOfferUrl(offerUrl)

      expect(parsed?.credential_configuration_ids).toEqual(['MedicalLicense', 'BoardCertification'])
    })
  })

  describe('validatePreAuthCode', () => {
    it('should validate a valid pre-authorized code', () => {
      const code = generatePreAuthorizedCode()
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes in future

      const result = validatePreAuthCode(code, expiresAt)

      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should reject code without correct prefix', () => {
      const code = 'invalid-code-123'
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

      const result = validatePreAuthCode(code, expiresAt)

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Invalid pre-authorized code format')
    })

    it('should reject expired code', () => {
      const code = generatePreAuthorizedCode()
      const expiresAt = new Date(Date.now() - 1000) // 1 second in past

      const result = validatePreAuthCode(code, expiresAt)

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Pre-authorized code has expired')
    })

    it('should reject empty code', () => {
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

      const result = validatePreAuthCode('', expiresAt)

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Invalid pre-authorized code format')
    })
  })

  describe('Integration: Round-trip offer creation and parsing', () => {
    it('should create and parse offer maintaining all data', () => {
      const params: CredentialOfferParams = {
        credentialType: 'MedicalLicense',
        issuerId: 'issuer-001',
        subjectId: 'user-123',
      }

      const { offerUrl, preAuthorizedCode } = createOfferUrl(params)
      const parsed = parseOfferUrl(offerUrl)

      expect(parsed).not.toBeNull()
      expect(parsed?.credential_configuration_ids).toContain('MedicalLicense')
      expect(
        parsed?.grants['urn:ietf:params:oauth:grant-type:pre-authorized_code']['pre-authorized_code']
      ).toBe(preAuthorizedCode)
    })
  })
})

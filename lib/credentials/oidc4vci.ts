/**
 * OpenID for Verifiable Credential Issuance (OIDC4VCI) Utilities
 *
 * Implements the OIDC4VCI protocol for credential offer generation
 * and pre-authorized code flow.
 */

export interface CredentialOfferParams {
  credentialType: string
  issuerId: string
  subjectId?: string
  preAuthorizedCode?: string
  userPin?: string
  credentialConfigurationIds?: string[]
}

export interface CredentialOffer {
  credential_issuer: string
  credential_configuration_ids: string[]
  grants: {
    'urn:ietf:params:oauth:grant-type:pre-authorized_code': {
      'pre-authorized_code': string
      user_pin_required?: boolean
    }
  }
}

export interface OfferUrlResult {
  offerUrl: string
  deepLink: string
  qrData: string
  preAuthorizedCode: string
  expiresAt: Date
}

const ISSUER_BASE_URL = process.env.NEXT_PUBLIC_ISSUER_URL || 'https://vitalcv.com'
const WALLET_DEEP_LINK_SCHEME = 'vitalcv-wallet'

/**
 * Generates a pre-authorized code for credential offer
 */
export function generatePreAuthorizedCode(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 15)
  return `pre-auth_${timestamp}_${random}`
}

/**
 * Builds a credential offer object
 */
export function buildCredentialOffer(params: CredentialOfferParams): CredentialOffer {
  const preAuthCode = params.preAuthorizedCode || generatePreAuthorizedCode()

  return {
    credential_issuer: `${ISSUER_BASE_URL}/issuer`,
    credential_configuration_ids: params.credentialConfigurationIds || [params.credentialType],
    grants: {
      'urn:ietf:params:oauth:grant-type:pre-authorized_code': {
        'pre-authorized_code': preAuthCode,
        ...(params.userPin && { user_pin_required: true }),
      },
    },
  }
}

/**
 * Creates a complete credential offer URL with QR and deep link
 */
export function createOfferUrl(params: CredentialOfferParams): OfferUrlResult {
  const offer = buildCredentialOffer(params)
  const preAuthCode = offer.grants['urn:ietf:params:oauth:grant-type:pre-authorized_code']['pre-authorized_code']

  // Encode offer as base64 for URL
  const offerJson = JSON.stringify(offer)
  const encodedOffer = Buffer.from(offerJson).toString('base64')

  // Build offer URL (OpenID4VCI standard)
  const offerUrl = `openid-credential-offer://?credential_offer=${encodeURIComponent(encodedOffer)}`

  // Build deep link for mobile wallet
  const deepLink = `${WALLET_DEEP_LINK_SCHEME}://credential-offer?offer=${encodeURIComponent(encodedOffer)}`

  // QR data contains the offer URL
  const qrData = offerUrl

  // Pre-authorized codes typically expire in 10 minutes
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

  return {
    offerUrl,
    deepLink,
    qrData,
    preAuthorizedCode: preAuthCode,
    expiresAt,
  }
}

/**
 * Parses a credential offer from URL parameters
 */
export function parseOfferUrl(url: string): CredentialOffer | null {
  try {
    const urlObj = new URL(url)
    const encodedOffer = urlObj.searchParams.get('credential_offer')

    if (!encodedOffer) {
      return null
    }

    const offerJson = Buffer.from(decodeURIComponent(encodedOffer), 'base64').toString('utf-8')
    return JSON.parse(offerJson) as CredentialOffer
  } catch (error) {
    console.error('Failed to parse offer URL:', error)
    return null
  }
}

/**
 * Validates a pre-authorized code
 */
export function validatePreAuthCode(code: string, expiresAt: Date): { valid: boolean; error?: string } {
  if (!code || !code.startsWith('pre-auth_')) {
    return { valid: false, error: 'Invalid pre-authorized code format' }
  }

  if (new Date() > expiresAt) {
    return { valid: false, error: 'Pre-authorized code has expired' }
  }

  return { valid: true }
}

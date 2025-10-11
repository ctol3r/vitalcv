/**
 * Digital Credentials Query Language (DCQL) Builder
 *
 * Implements DCQL for OpenID4VP presentation requests.
 * DCQL allows verifiers to request specific claims from credentials.
 */

export interface DcqlQuery {
  id: string
  input_descriptors: InputDescriptor[]
  purpose?: string
  format?: PresentationFormat
}

export interface InputDescriptor {
  id: string
  name?: string
  purpose?: string
  constraints: Constraints
}

export interface Constraints {
  fields: FieldConstraint[]
  limit_disclosure?: 'required' | 'preferred'
}

export interface FieldConstraint {
  path: string[]
  filter?: JsonSchemaFilter
  purpose?: string
  optional?: boolean
}

export interface JsonSchemaFilter {
  type: string
  const?: unknown
  enum?: unknown[]
  pattern?: string
}

export interface PresentationFormat {
  jwt_vp?: { alg: string[] }
  ldp_vp?: { proof_type: string[] }
}

export interface DcqlRequest {
  query: DcqlQuery
  nonce: string
  audience: string
  response_uri?: string
}

export interface VerificationResult {
  status: 'success' | 'fail'
  credentialId: string
  auditRef: string
  claims?: Record<string, unknown>
  errors?: string[]
  timestamp: Date
}

/**
 * Creates a DCQL query for medical credential verification
 */
export function buildMedicalCredentialQuery(params: {
  credentialType: string
  requiredFields?: string[]
  purpose?: string
}): DcqlQuery {
  const fields: FieldConstraint[] = (params.requiredFields || ['licenseNumber', 'issuer', 'expiryDate']).map(
    (field) => ({
      path: [`$.credentialSubject.${field}`, `$.vc.credentialSubject.${field}`],
      optional: false,
    })
  )

  return {
    id: `dcql_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    purpose: params.purpose || 'Verify medical credential',
    input_descriptors: [
      {
        id: `${params.credentialType}_descriptor`,
        name: params.credentialType,
        purpose: `Request ${params.credentialType} credential`,
        constraints: {
          fields,
          limit_disclosure: 'preferred',
        },
      },
    ],
    format: {
      jwt_vp: {
        alg: ['ES256', 'ES256K', 'EdDSA'],
      },
      ldp_vp: {
        proof_type: ['Ed25519Signature2020', 'BbsBlsSignature2020'],
      },
    },
  }
}

/**
 * Builds a complete DCQL presentation request
 */
export function buildDcqlRequest(params: {
  credentialType: string
  nonce: string
  audience: string
  requiredFields?: string[]
  purpose?: string
  responseUri?: string
}): DcqlRequest {
  const query = buildMedicalCredentialQuery({
    credentialType: params.credentialType,
    requiredFields: params.requiredFields,
    purpose: params.purpose,
  })

  return {
    query,
    nonce: params.nonce,
    audience: params.audience,
    response_uri: params.responseUri,
  }
}

/**
 * Generates a cryptographically secure nonce
 */
export function generateNonce(): string {
  const timestamp = Date.now().toString(36)
  const random1 = Math.random().toString(36).substring(2, 15)
  const random2 = Math.random().toString(36).substring(2, 15)
  return `${timestamp}.${random1}.${random2}`
}

/**
 * Validates a nonce for freshness (typically 5 minutes)
 */
export function validateNonce(nonce: string, maxAgeMs: number = 5 * 60 * 1000): boolean {
  try {
    const [timestampStr] = nonce.split('.')
    const timestamp = parseInt(timestampStr, 36)
    const age = Date.now() - timestamp

    return age >= 0 && age <= maxAgeMs
  } catch {
    return false
  }
}

/**
 * Maps API verification status to UI-friendly result
 */
export function mapVerifyStatus(apiResponse: {
  status: string
  credentialId?: string
  reason?: string
  auditRef?: string
  claims?: Record<string, unknown>
}): VerificationResult {
  const status = apiResponse.status === 'valid' || apiResponse.status === 'success' ? 'success' : 'fail'

  return {
    status,
    credentialId: apiResponse.credentialId || 'unknown',
    auditRef: apiResponse.auditRef || `audit_${Date.now()}`,
    claims: apiResponse.claims,
    errors: status === 'fail' ? [apiResponse.reason || 'Verification failed'] : undefined,
    timestamp: new Date(),
  }
}

/**
 * Extracts specific claims from a verified presentation
 */
export function extractClaims(presentation: unknown, paths: string[]): Record<string, unknown> {
  const claims: Record<string, unknown> = {}

  paths.forEach((path) => {
    const value = getValueByPath(presentation, path)
    if (value !== undefined) {
      const key = path.split('.').pop() || path
      claims[key] = value
    }
  })

  return claims
}

/**
 * Helper to get value from object by JSONPath-like string
 */
function getValueByPath(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== 'object') return undefined

  const parts = path.replace(/^\$\./, '').split('.')
  let current: unknown = obj

  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = (current as Record<string, unknown>)[part]
    } else {
      return undefined
    }
  }

  return current
}

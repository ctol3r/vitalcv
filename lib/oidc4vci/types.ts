/**
 * OIDC4VCI Types
 *
 * Type definitions for OpenID for Verifiable Credential Issuance (OIDC4VCI)
 * Based on: https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html
 */

export interface CredentialOfferRequest {
  credentialType: string
  issuerId: string
  subjectId?: string
  credentialConfigurationIds?: string[]
  txCode?: string
}

export interface CredentialOffer {
  credential_issuer: string
  credential_configuration_ids: string[]
  grants: {
    'urn:ietf:params:oauth:grant-type:pre-authorized_code': {
      'pre-authorized_code': string
      tx_code?: {
        input_mode?: 'numeric' | 'text'
        length?: number
        description?: string
      }
    }
  }
}

export interface CredentialOfferResponse {
  offer: CredentialOffer
  credential_offer_uri: string
  pre_authorized_code: string
  expires_at: string
  expires_in: number
}

export interface TokenRequest {
  grant_type: 'urn:ietf:params:oauth:grant-type:pre-authorized_code'
  'pre-authorized_code': string
  code_verifier?: string
  tx_code?: string
}

export interface TokenResponse {
  access_token: string
  token_type: 'bearer'
  expires_in: number
  c_nonce: string
  c_nonce_expires_in: number
}

export interface NonceResponse {
  c_nonce: string
  c_nonce_expires_in: number
}

export interface CredentialRequest {
  format: 'jwt_vc_json' | 'ldp_vc'
  credential_definition?: {
    type: string[]
    credentialSubject?: Record<string, unknown>
  }
  proof?: {
    proof_type: 'jwt'
    jwt: string
  }
}

export interface CredentialResponse {
  credential: string
  format: 'jwt_vc_json' | 'ldp_vc'
  c_nonce?: string
  c_nonce_expires_in?: number
}

export interface DeferredCredentialRequest {
  transaction_id: string
}

export interface DeferredCredentialResponse {
  credential?: string
  transaction_id?: string
  c_nonce?: string
  c_nonce_expires_in?: number
}

export interface IssuerMetadata {
  credential_issuer: string
  credential_endpoint: string
  deferred_credential_endpoint?: string
  batch_credential_endpoint?: string
  authorization_server?: string
  credential_configurations_supported: Record<string, CredentialConfiguration>
  display?: DisplayProperty[]
}

export interface CredentialConfiguration {
  format: 'jwt_vc_json' | 'ldp_vc'
  scope?: string
  cryptographic_binding_methods_supported?: string[]
  credential_signing_alg_values_supported?: string[]
  proof_types_supported?: Record<string, ProofTypeMetadata>
  display?: DisplayProperty[]
  credential_definition: {
    type: string[]
    credentialSubject?: Record<string, CredentialSubjectProperty>
  }
}

export interface ProofTypeMetadata {
  proof_signing_alg_values_supported: string[]
}

export interface DisplayProperty {
  name?: string
  locale?: string
  logo?: {
    url: string
    alt_text?: string
  }
  description?: string
  background_color?: string
  text_color?: string
}

export interface CredentialSubjectProperty {
  mandatory?: boolean
  value_type?: string
  display?: DisplayProperty[]
}

// Storage types
export interface StoredOffer {
  offer: CredentialOffer
  pre_authorized_code: string
  code_challenge?: string
  code_challenge_method?: 'S256'
  tx_code?: string
  created_at: number
  expires_at: number
  redeemed?: boolean
}

export interface StoredToken {
  access_token: string
  pre_authorized_code: string
  credential_type: string
  subject_id?: string
  created_at: number
  expires_at: number
}

export interface StoredNonce {
  c_nonce: string
  created_at: number
  expires_at: number
}

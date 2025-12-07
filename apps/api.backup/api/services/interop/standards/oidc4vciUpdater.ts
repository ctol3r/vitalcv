/**
 * OIDC4VCI Updater Service
 * B226B-INT-006: Updates OIDC4VCI implementation to the latest spec version
 *
 * Ensures compatibility with new credential endpoints and flows per:
 * - OpenID for Verifiable Credential Issuance (OIDC4VCI) v1.0
 * - Credential Issuance Protocol (CIP) updates
 * - Latest authorization and token exchange flows
 */

import { getServiceLogger } from '../../logging/serviceLogger';
import * as crypto from 'crypto';

const log = getServiceLogger('interop/standards/oidc4vciUpdater');

/**
 * OIDC4VCI Credential Offer structure
 */
export interface CredentialOffer {
  credential_issuer: string;
  credentials: Array<{
    format: 'jwt_vc' | 'jwt_vc_json' | 'cwt_vc' | 'vc+sd-jwt' | 'ldp_vc';
    types: string[];
    credential_definition?: {
      vct?: string;
      credentialSubject?: Record<string, any>;
    };
  }>;
  grants?: {
    authorization_code?: {
      issuer_state?: string;
    };
    urn:ietf:params:oauth:grant-type:pre-authorized_code?: {
      'pre-authorized_code': string;
      user_pin_required?: boolean;
    };
  };
}

/**
 * Credential Request structure
 */
export interface CredentialRequest {
  format: string;
  proof?: {
    proof_type: 'jwt' | 'cwt';
    jwt?: string;
    cwt?: string;
  };
  credential_definition?: {
    vct?: string;
    credentialSubject?: Record<string, any>;
  };
}

/**
 * Credential Response structure
 */
export interface CredentialResponse {
  format: string;
  credential?: string;
  credential_identifier?: string;
  c_nonce?: string;
  c_nonce_expires_in?: number;
  transaction_id?: string;
  error?: string;
  error_description?: string;
}

/**
 * Authorization Server Metadata (OIDC4VCI)
 */
export interface CredentialIssuerMetadata {
  credential_issuer: string;
  authorization_server?: string;
  credential_endpoint: string;
  batch_credential_endpoint?: string;
  deferred_credential_endpoint?: string;
  credential_response_encryption_alg_values_supported?: string[];
  credential_response_encryption_enc_values_supported?: string[];
  credential_identifiers_supported?: boolean;
  display?: Array<{
    name: string;
    locale?: string;
  }>;
  credential_configurations_supported: Record<string, {
    format: string[];
    cryptographic_binding_methods_supported?: string[];
    credential_signing_alg_values_supported?: string[];
    proof_types_supported?: {
      jwt?: {
        proof_signing_alg_values_supported: string[];
      };
      cwt?: {
        proof_signing_alg_values_supported: string[];
      };
    };
    display?: Array<{
      name: string;
      locale?: string;
    }>;
    credential_definition?: {
      vct?: string;
      credentialSubject?: Record<string, any>;
    };
  }>;
}

/**
 * OIDC4VCI Updater Service
 * Handles credential issuance flows according to latest OIDC4VCI spec
 */
export class Oidc4vciUpdater {
  private credentialIssuerUrl: string;
  private authorizationServerUrl?: string;
  private supportedFormats: string[] = ['jwt_vc', 'jwt_vc_json', 'vc+sd-jwt'];
  private supportedProofTypes: string[] = ['jwt', 'cwt'];

  constructor(
    credentialIssuerUrl: string,
    authorizationServerUrl?: string
  ) {
    this.credentialIssuerUrl = credentialIssuerUrl;
    this.authorizationServerUrl = authorizationServerUrl;
  }

  /**
   * Fetch credential issuer metadata
   * GET /.well-known/oauth-authorization-server or /.well-known/openid-credential-issuer
   */
  async fetchCredentialIssuerMetadata(): Promise<CredentialIssuerMetadata> {
    try {
      const metadataUrl = `${this.credentialIssuerUrl}/.well-known/openid-credential-issuer`;
      log.info('Fetching credential issuer metadata', { url: metadataUrl });

      const response = await fetch(metadataUrl, {
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch metadata: ${response.status} ${response.statusText}`);
      }

      const metadata = await response.json() as CredentialIssuerMetadata;
      log.info('Credential issuer metadata fetched', {
        issuer: metadata.credential_issuer,
        formats: Object.keys(metadata.credential_configurations_supported || {}),
      });

      return metadata;
    } catch (error) {
      log.error('Error fetching credential issuer metadata', { error });
      throw error;
    }
  }

  /**
   * Create credential offer
   * Generates a credential offer URI or object per OIDC4VCI spec
   */
  createCredentialOffer(
    credentialTypes: string[],
    format: string = 'jwt_vc',
    preAuthorizedCode?: string,
    userPinRequired?: boolean
  ): CredentialOffer {
    const offer: CredentialOffer = {
      credential_issuer: this.credentialIssuerUrl,
      credentials: credentialTypes.map(type => ({
        format: format as any,
        types: ['VerifiableCredential', type],
      })),
    };

    if (preAuthorizedCode) {
      offer.grants = {
        'urn:ietf:params:oauth:grant-type:pre-authorized_code': {
          'pre-authorized_code': preAuthorizedCode,
          user_pin_required: userPinRequired || false,
        },
      };
    } else {
      offer.grants = {
        authorization_code: {
          issuer_state: this.generateIssuerState(),
        },
      };
    }

    log.info('Created credential offer', {
      types: credentialTypes,
      format,
      hasPreAuthCode: !!preAuthorizedCode,
    });

    return offer;
  }

  /**
   * Exchange authorization code for access token
   * POST /token (OAuth 2.0 token endpoint)
   */
  async exchangeAuthorizationCode(
    code: string,
    redirectUri: string,
    clientId: string,
    codeVerifier?: string
  ): Promise<{ access_token: string; token_type: string; expires_in?: number; c_nonce?: string; c_nonce_expires_in?: number }> {
    try {
      const tokenEndpoint = this.authorizationServerUrl
        ? `${this.authorizationServerUrl}/token`
        : `${this.credentialIssuerUrl}/token`;

      log.info('Exchanging authorization code for access token', {
        tokenEndpoint,
        hasCodeVerifier: !!codeVerifier,
      });

      const params = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
      });

      if (codeVerifier) {
        params.append('code_verifier', codeVerifier);
      }

      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(`Token exchange failed: ${response.status} ${JSON.stringify(error)}`);
      }

      const tokenResponse = await response.json();
      log.info('Access token obtained', {
        hasCNonce: !!tokenResponse.c_nonce,
      });

      return tokenResponse;
    } catch (error) {
      log.error('Error exchanging authorization code', { error });
      throw error;
    }
  }

  /**
   * Exchange pre-authorized code for access token
   * POST /token with pre-authorized_code grant type
   */
  async exchangePreAuthorizedCode(
    preAuthorizedCode: string,
    userPin?: string
  ): Promise<{ access_token: string; token_type: string; expires_in?: number; c_nonce?: string; c_nonce_expires_in?: number }> {
    try {
      const tokenEndpoint = this.authorizationServerUrl
        ? `${this.authorizationServerUrl}/token`
        : `${this.credentialIssuerUrl}/token`;

      log.info('Exchanging pre-authorized code for access token');

      const params = new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:pre-authorized_code',
        'pre-authorized_code': preAuthorizedCode,
      });

      if (userPin) {
        params.append('user_pin', userPin);
      }

      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(`Pre-authorized code exchange failed: ${response.status} ${JSON.stringify(error)}`);
      }

      const tokenResponse = await response.json();
      log.info('Access token obtained from pre-authorized code');

      return tokenResponse;
    } catch (error) {
      log.error('Error exchanging pre-authorized code', { error });
      throw error;
    }
  }

  /**
   * Request credential issuance
   * POST /credential endpoint
   */
  async requestCredential(
    accessToken: string,
    credentialRequest: CredentialRequest,
    cNonce?: string
  ): Promise<CredentialResponse> {
    try {
      const credentialEndpoint = `${this.credentialIssuerUrl}/credential`;
      log.info('Requesting credential issuance', {
        format: credentialRequest.format,
        hasProof: !!credentialRequest.proof,
      });

      const response = await fetch(credentialEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...credentialRequest,
          ...(cNonce && { c_nonce: cNonce }),
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(`Credential request failed: ${response.status} ${JSON.stringify(error)}`);
      }

      const credentialResponse = await response.json() as CredentialResponse;
      log.info('Credential issued', {
        format: credentialResponse.format,
        hasCredential: !!credentialResponse.credential,
        hasCNonce: !!credentialResponse.c_nonce,
      });

      return credentialResponse;
    } catch (error) {
      log.error('Error requesting credential', { error });
      throw error;
    }
  }

  /**
   * Batch credential issuance
   * POST /batch_credential endpoint (if supported)
   */
  async requestBatchCredentials(
    accessToken: string,
    credentialRequests: CredentialRequest[],
    cNonce?: string
  ): Promise<CredentialResponse[]> {
    try {
      const batchEndpoint = `${this.credentialIssuerUrl}/batch_credential`;
      log.info('Requesting batch credential issuance', { count: credentialRequests.length });

      const response = await fetch(batchEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          credential_requests: credentialRequests,
          ...(cNonce && { c_nonce: cNonce }),
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(`Batch credential request failed: ${response.status} ${JSON.stringify(error)}`);
      }

      const batchResponse = await response.json();
      const credentials = Array.isArray(batchResponse.credentials)
        ? batchResponse.credentials
        : [batchResponse];

      log.info('Batch credentials issued', { count: credentials.length });
      return credentials;
    } catch (error) {
      log.error('Error requesting batch credentials', { error });
      throw error;
    }
  }

  /**
   * Deferred credential issuance
   * POST /deferred_credential endpoint (for async issuance)
   */
  async requestDeferredCredential(
    accessToken: string,
    transactionId: string,
    cNonce?: string
  ): Promise<CredentialResponse> {
    try {
      const deferredEndpoint = `${this.credentialIssuerUrl}/deferred_credential`;
      log.info('Requesting deferred credential', { transactionId });

      const response = await fetch(deferredEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transaction_id: transactionId,
          ...(cNonce && { c_nonce: cNonce }),
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(`Deferred credential request failed: ${response.status} ${JSON.stringify(error)}`);
      }

      const credentialResponse = await response.json() as CredentialResponse;
      log.info('Deferred credential retrieved', {
        hasCredential: !!credentialResponse.credential,
      });

      return credentialResponse;
    } catch (error) {
      log.error('Error requesting deferred credential', { error });
      throw error;
    }
  }

  /**
   * Generate proof of possession (JWT)
   * Creates a JWT proof for credential request
   */
  async generateProofOfPossession(
    audience: string,
    nonce: string,
    keyId: string,
    privateKey: string
  ): Promise<string> {
    // In production, use a proper JWT library (e.g., jose, jsonwebtoken)
    // This is a placeholder implementation
    const header = {
      alg: 'ES256',
      typ: 'JWT',
      kid: keyId,
    };

    const payload = {
      iss: keyId,
      aud: audience,
      iat: Math.floor(Date.now() / 1000),
      nonce,
    };

    log.info('Generated proof of possession', {
      audience,
      keyId,
    });

    // Return placeholder - replace with actual JWT signing
    return `${Buffer.from(JSON.stringify(header)).toString('base64url')}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;
  }

  /**
   * Validate credential response
   * Verifies credential format and structure
   */
  validateCredentialResponse(response: CredentialResponse): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!response.format) {
      errors.push('Missing format field');
    }

    if (!response.credential && !response.error) {
      errors.push('Missing credential or error field');
    }

    if (response.error && !response.error_description) {
      errors.push('Error present but missing error_description');
    }

    if (!this.supportedFormats.includes(response.format)) {
      errors.push(`Unsupported format: ${response.format}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Generate issuer state for authorization code flow
   */
  private generateIssuerState(): string {
    return crypto.randomBytes(32).toString('base64url');
  }
}

/**
 * Default instance export
 */
export const oidc4vciUpdater = new Oidc4vciUpdater(
  process.env.OIDC4VCI_ISSUER_URL || 'https://credential-issuer.example.com',
  process.env.OIDC4VCI_AUTHORIZATION_SERVER_URL
);


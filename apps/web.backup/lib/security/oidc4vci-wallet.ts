/**
 * B104A-FE-003: OIDC4VCI Wallet Client with DPoP
 *
 * Provides OIDC4VCI wallet functionality with DPoP sender-constrained tokens.
 * - Uses DPoP helper for all requests
 * - Handles nonce management
 * - Error handling with UI feedback
 *
 * Acceptance criteria:
 * - DPoP proof attached for each request ✓
 * - Rotate keys ≤24h ✓ (handled by dpop.ts)
 * - Errors surfaced ✓
 */

import { dpopFetch, DPoPError, getDPoPThumbprint } from './dpop';

/**
 * OIDC4VCI Wallet Client Error
 */
export class OIDC4VCIWalletError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public originalError?: unknown
  ) {
    super(message);
    this.name = 'OIDC4VCIWalletError';
  }
}

/**
 * Issuer metadata from discovery endpoint
 */
export interface IssuerMetadata {
  credential_issuer: string;
  credential_endpoint: string;
  token_endpoint: string;
  deferred_credential_endpoint?: string;
  batch_credential_endpoint?: string;
  authorization_endpoint?: string;
  token_endpoint_auth_methods_supported: string[];
  dpop_signing_alg_values_supported: string[];
  c_nonce_supported: boolean;
  c_nonce_expires_in: number;
  credentials_supported: CredentialSupported[];
  formats_supported: string[];
}

/**
 * Credential supported by issuer
 */
export interface CredentialSupported {
  format: string;
  id: string;
  types: string[];
  cryptographic_binding_methods_supported?: string[];
  cryptographic_suites_supported?: string[];
  display?: Array<{
    name: string;
    locale: string;
    description?: string;
  }>;
}

/**
 * Credential request
 */
export interface CredentialRequest {
  format: string;
  types: string[];
  subject_id?: string;
  defer_issuance?: boolean;
  [key: string]: any;
}

/**
 * Credential response
 */
export interface CredentialResponse {
  format: string;
  credential?: any;
  transaction_id?: string;
  status?: 'requested' | 'ready' | 'issued';
  c_nonce?: string;
  c_nonce_expires_in?: number;
}

/**
 * Nonce response
 */
export interface NonceResponse {
  c_nonce: string;
  c_nonce_expires_in: number;
}

/**
 * OIDC4VCI Wallet Client
 */
export class OIDC4VCIWalletClient {
  private issuerUrl: string;
  private accessToken?: string;
  private currentNonce?: string;
  private nonceExpiresAt?: number;

  constructor(issuerUrl: string, accessToken?: string) {
    this.issuerUrl = issuerUrl.replace(/\/$/, ''); // Remove trailing slash
    this.accessToken = accessToken;
  }

  /**
   * Set access token (for use after token exchange)
   */
  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  /**
   * Discover issuer metadata
   */
  async discoverIssuer(): Promise<IssuerMetadata> {
    try {
      const discoveryUrl = `${this.issuerUrl}/.well-known/openid-credential-issuer`;
      const response = await dpopFetch(discoveryUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new OIDC4VCIWalletError(
          `Failed to discover issuer: ${response.status} ${response.statusText}`,
          'DISCOVERY_FAILED',
          response.status,
          errorText
        );
      }

      const metadata = await response.json();
      return metadata as IssuerMetadata;
    } catch (error) {
      if (error instanceof OIDC4VCIWalletError) {
        throw error;
      }
      if (error instanceof DPoPError) {
        throw new OIDC4VCIWalletError(
          `DPoP error during discovery: ${error.message}`,
          'DPOP_ERROR',
          undefined,
          error
        );
      }
      throw new OIDC4VCIWalletError(
        `Unexpected error during discovery: ${error instanceof Error ? error.message : 'unknown'}`,
        'UNKNOWN_ERROR',
        undefined,
        error
      );
    }
  }

  /**
   * Get fresh nonce from issuer
   */
  async getNonce(jti?: string): Promise<NonceResponse> {
    try {
      if (!this.accessToken) {
        throw new OIDC4VCIWalletError(
          'Access token required for nonce endpoint',
          'NO_ACCESS_TOKEN'
        );
      }

      const nonceUrl = `${this.issuerUrl}/oidc4vci/nonce`;
      const body: any = {};
      if (jti) {
        body.jti = jti;
      }

      const response = await dpopFetch(nonceUrl, {
        method: 'POST',
        accessToken: this.accessToken,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new OIDC4VCIWalletError(
          errorData.error_description || `Failed to get nonce: ${response.status}`,
          errorData.error || 'NONCE_FAILED',
          response.status,
          errorData
        );
      }

      const nonceData = await response.json() as NonceResponse;
      this.currentNonce = nonceData.c_nonce;
      this.nonceExpiresAt = Date.now() + (nonceData.c_nonce_expires_in * 1000);
      return nonceData;
    } catch (error) {
      if (error instanceof OIDC4VCIWalletError) {
        throw error;
      }
      if (error instanceof DPoPError) {
        throw new OIDC4VCIWalletError(
          `DPoP error during nonce request: ${error.message}`,
          'DPOP_ERROR',
          undefined,
          error
        );
      }
      throw new OIDC4VCIWalletError(
        `Unexpected error during nonce request: ${error instanceof Error ? error.message : 'unknown'}`,
        'UNKNOWN_ERROR',
        undefined,
        error
      );
    }
  }

  /**
   * Request credential from issuer
   */
  async requestCredential(
    credentialRequest: CredentialRequest
  ): Promise<CredentialResponse> {
    try {
      if (!this.accessToken) {
        throw new OIDC4VCIWalletError(
          'Access token required for credential endpoint',
          'NO_ACCESS_TOKEN'
        );
      }

      // Ensure we have a fresh nonce
      if (!this.currentNonce || !this.nonceExpiresAt || Date.now() >= this.nonceExpiresAt) {
        await this.getNonce();
      }

      const credentialUrl = `${this.issuerUrl}/oidc4vci/credential`;
      const response = await dpopFetch(credentialUrl, {
        method: 'POST',
        accessToken: this.accessToken,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          credential_request,
          c_nonce: this.currentNonce,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        // Handle use_dpop error (Bearer-only rejection)
        if (errorData.error === 'use_dpop') {
          throw new OIDC4VCIWalletError(
            errorData.error_description || 'DPoP proof required',
            'USE_DPOP',
            response.status,
            errorData
          );
        }

        // Handle invalid_dpop error
        if (errorData.error === 'invalid_dpop') {
          throw new OIDC4VCIWalletError(
            errorData.error_description || 'Invalid DPoP proof',
            'INVALID_DPOP',
            response.status,
            errorData
          );
        }

        throw new OIDC4VCIWalletError(
          errorData.error_description || `Failed to request credential: ${response.status}`,
          errorData.error || 'CREDENTIAL_REQUEST_FAILED',
          response.status,
          errorData
        );
      }

      const credentialData = await response.json() as CredentialResponse;

      // Update nonce if provided in response
      if (credentialData.c_nonce) {
        this.currentNonce = credentialData.c_nonce;
        this.nonceExpiresAt = Date.now() + ((credentialData.c_nonce_expires_in || 60) * 1000);
      }

      return credentialData;
    } catch (error) {
      if (error instanceof OIDC4VCIWalletError) {
        // Surface error to UI
        this.surfaceError(error);
        throw error;
      }
      if (error instanceof DPoPError) {
        const walletError = new OIDC4VCIWalletError(
          `DPoP error during credential request: ${error.message}`,
          'DPOP_ERROR',
          undefined,
          error
        );
        this.surfaceError(walletError);
        throw walletError;
      }
      const walletError = new OIDC4VCIWalletError(
        `Unexpected error during credential request: ${error instanceof Error ? error.message : 'unknown'}`,
        'UNKNOWN_ERROR',
        undefined,
        error
      );
      this.surfaceError(walletError);
      throw walletError;
    }
  }

  /**
   * Get deferred credential status
   */
  async getDeferredCredential(transactionId: string): Promise<CredentialResponse> {
    try {
      if (!this.accessToken) {
        throw new OIDC4VCIWalletError(
          'Access token required for deferred credential endpoint',
          'NO_ACCESS_TOKEN'
        );
      }

      // Ensure we have a fresh nonce
      if (!this.currentNonce || !this.nonceExpiresAt || Date.now() >= this.nonceExpiresAt) {
        await this.getNonce();
      }

      const deferredUrl = `${this.issuerUrl}/oidc4vci/deferred`;
      const response = await dpopFetch(deferredUrl, {
        method: 'POST',
        accessToken: this.accessToken,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transaction_id: transactionId,
          c_nonce: this.currentNonce,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new OIDC4VCIWalletError(
          errorData.error_description || `Failed to get deferred credential: ${response.status}`,
          errorData.error || 'DEFERRED_FAILED',
          response.status,
          errorData
        );
      }

      const credentialData = await response.json() as CredentialResponse;

      // Update nonce if provided in response
      if (credentialData.c_nonce) {
        this.currentNonce = credentialData.c_nonce;
        this.nonceExpiresAt = Date.now() + ((credentialData.c_nonce_expires_in || 60) * 1000);
      }

      return credentialData;
    } catch (error) {
      if (error instanceof OIDC4VCIWalletError) {
        this.surfaceError(error);
        throw error;
      }
      if (error instanceof DPoPError) {
        const walletError = new OIDC4VCIWalletError(
          `DPoP error during deferred credential request: ${error.message}`,
          'DPOP_ERROR',
          undefined,
          error
        );
        this.surfaceError(walletError);
        throw walletError;
      }
      const walletError = new OIDC4VCIWalletError(
        `Unexpected error during deferred credential request: ${error instanceof Error ? error.message : 'unknown'}`,
        'UNKNOWN_ERROR',
        undefined,
        error
      );
      this.surfaceError(walletError);
      throw walletError;
    }
  }

  /**
   * Get DPoP thumbprint (cnf.jkt) for token request
   */
  async getThumbprint(): Promise<string> {
    return await getDPoPThumbprint();
  }

  /**
   * Surface error to UI via custom event
   */
  private surfaceError(error: OIDC4VCIWalletError): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('oidc4vci-wallet-error', {
          detail: {
            code: error.code,
            message: error.message,
            statusCode: error.statusCode,
            originalError: error.originalError,
          },
        })
      );
    }
  }
}

/**
 * Create OIDC4VCI wallet client instance
 */
export function createOIDC4VCIWalletClient(
  issuerUrl: string,
  accessToken?: string
): OIDC4VCIWalletClient {
  return new OIDC4VCIWalletClient(issuerUrl, accessToken);
}


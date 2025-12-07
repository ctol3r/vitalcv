/**
 * OIDC4VCI Issuer Metadata Endpoint
 * GET /.well-known/openid-credential-issuer
 *
 * S72-STRETCH-A-001: OIDC4VCI discovery spec compliance (issuer metadata)
 * Includes required fields: issuer, credential_endpoint, credential_configurations_supported
 * Passes against OIDC4VCI conformance stub
 */

import { Request, Response } from 'express';
import { createHash } from 'crypto';

const ISSUER_URL = process.env.PUBLIC_ISSUER_URL || process.env.ISSUER_URL || 'https://vitalcv.ai';

/**
 * Generate OIDC4VCI-compliant issuer metadata
 * S72-STRETCH-A-001: Includes all required fields per OIDC4VCI spec
 */
function generateIssuerMetadata(): any {
  return {
    // S72-STRETCH-A-001: Required field - issuer identifier
    issuer: `${ISSUER_URL}/oidc4vci`,

    // S72-STRETCH-A-001: Required field - credential endpoint
    credential_endpoint: `${ISSUER_URL}/oidc4vci/credential`,

    // S72-STRETCH-A-001: Required field - credential configurations supported
    credential_configurations_supported: {
      'PhysicianCredential': {
        format: 'jwt_vc_json',
        types: ['VerifiableCredential', 'PhysicianCredential'],
        cryptographic_binding_methods_supported: ['did:key', 'did:web'],
        cryptographic_suites_supported: ['EdDSA', 'ES256'],
        display: [
          {
            name: 'Physician Credential',
            locale: 'en-US',
          },
        ],
      },
      'SDJWTPhysicianCredential': {
        format: 'vc+sd-jwt',
        types: ['VerifiableCredential', 'PhysicianCredential'],
        cryptographic_binding_methods_supported: ['did:key', 'did:web'],
        cryptographic_suites_supported: ['EdDSA', 'ES256'],
        display: [
          {
            name: 'SD-JWT Physician Credential',
            locale: 'en-US',
            description: 'Selective Disclosure JWT Verifiable Credential',
          },
        ],
      },
      'IdentityCredential': {
        format: 'vc+sd-jwt',
        types: ['VerifiableCredential', 'IdentityCredential'],
        cryptographic_binding_methods_supported: ['did:key'],
        cryptographic_suites_supported: ['EdDSA'],
        display: [
          {
            name: 'SD-JWT Identity Credential',
            locale: 'en-US',
          },
        ],
      },
    },

    // Optional but recommended fields
    token_endpoint: `${ISSUER_URL}/oidc4vci/token`,
    authorization_endpoint: `${ISSUER_URL}/oidc4vci/authorize`,
    deferred_credential_endpoint: `${ISSUER_URL}/oidc4vci/deferred`,
    batch_credential_endpoint: `${ISSUER_URL}/oidc4vci/batch`,

    // Token endpoint authentication methods
    token_endpoint_auth_methods_supported: ['private_key_jwt', 'client_secret_basic'],
    token_endpoint_auth_signing_alg_values_supported: ['EdDSA', 'ES256'],

    // DPoP support
    dpop_signing_alg_values_supported: ['EdDSA', 'ES256'],
    token_binding: ['Dpop', 'Mtls'],

    // Nonce support
    c_nonce_supported: true,
    c_nonce_expires_in: 60,

    // Format support
    formats_supported: ['jwt_vc_json', 'vc+sd-jwt', 'mso_mdoc'],

    // Credential response encryption (optional)
    credential_response_encryption: {
      alg_values_supported: ['RSA-OAEP', 'RSA-OAEP-256'],
      enc_values_supported: ['A256GCM'],
    },
  };
}

// Cache metadata with ETag support
let issuerMetadata: any = null;
let metadataETag: string | null = null;
let metadataHash: string | null = null;

/**
 * Compute ETag and hash for metadata
 */
function computeMetadataHash(metadata: any): { etag: string; hash: string } {
  const json = JSON.stringify(metadata);
  const hash = createHash('sha256').update(json).digest('hex');
  const etag = `"${hash.substring(0, 16)}"`; // ETag format: "hash-prefix"
  return { etag, hash };
}

/**
 * Initialize metadata cache on startup
 */
function initializeMetadata(): void {
  issuerMetadata = generateIssuerMetadata();
  const { etag, hash } = computeMetadataHash(issuerMetadata);
  metadataETag = etag;
  metadataHash = hash;

  console.info(`[OIDC4VCI] Metadata initialized with hash: ${hash}`);
}

// Initialize on module load
initializeMetadata();

/**
 * OIDC4VCI Issuer Metadata Endpoint
 * GET /.well-known/openid-credential-issuer
 *
 * S72-STRETCH-A-001: Returns spec-compliant metadata with required fields
 * Implements ETag caching per HTTP spec
 */
export function metadataHandler(req: Request, res: Response): void {
  // Check If-None-Match header for ETag validation
  const ifNoneMatch = req.headers['if-none-match'];

  if (ifNoneMatch === metadataETag) {
    // Client has current version - return 304 Not Modified
    return res.status(304).end();
  }

  // Set ETag and Cache-Control headers
  res.setHeader('ETag', metadataETag!);
  res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
  res.setHeader('Content-Type', 'application/json');

  // S72-STRETCH-A-001: Return metadata with required fields
  res.json(issuerMetadata);
}

export default metadataHandler;


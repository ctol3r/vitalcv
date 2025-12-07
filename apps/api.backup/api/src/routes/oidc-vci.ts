/**
 * OIDC4VCI Routes
 * OIDC-VCI-001: .well-known/openid-credential-issuer
 * OIDC-VCI-002: Credential Endpoint
 *
 * Implements OpenID for Verifiable Credential Issuance (OIDC4VCI)
 */

import { Router, Request, Response } from 'express';
import { getSigningService } from '../services/vc-signing-service';
import { VerifiableCredential } from '../crypto/vc-signer';
import * as crypto from 'crypto';

const router = Router();

/**
 * GET /.well-known/openid-credential-issuer
 * OIDC-VCI-001: Credential Issuer Discovery Endpoint
 *
 * Returns issuer metadata including:
 * - Supported proof formats (Ed25519Signature2020, DataIntegrityProof)
 * - Supported algorithms (Ed25519)
 * - SD-JWT support
 * - Healthcare credential types
 */
router.get('/.well-known/openid-credential-issuer', (req: Request, res: Response) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;

  const discoveryDocument = {
    issuer: process.env.OIDC_ISSUER || baseUrl,
    credential_issuer: process.env.OIDC_ISSUER || baseUrl,
    credential_endpoint: `${baseUrl}/oidc/credential`,
    authorization_server: process.env.OIDC_AUTHORIZATION_SERVER || baseUrl,

    // Supported credential formats
    credential_configurations_supported: {
      'MedicalLicenseVC': {
        format: 'vc+sd-jwt',
        scope: 'MedicalLicenseVC',
        cryptographic_binding_methods_supported: ['did', 'jwk'],
        credential_signing_alg_values_supported: ['EdDSA', 'Ed25519'],
        proof_types_supported: ['Ed25519Signature2020', 'DataIntegrityProof'],
        display: [
          {
            name: 'Medical License',
            locale: 'en-US',
            logo_uri: `${baseUrl}/logos/medical-license.svg`,
            description: 'Verifiable Medical License Credential',
            background_color: '#FFFFFF',
            text_color: '#000000',
          },
        ],
      },
      'NursingLicenseVC': {
        format: 'vc+sd-jwt',
        scope: 'NursingLicenseVC',
        cryptographic_binding_methods_supported: ['did', 'jwk'],
        credential_signing_alg_values_supported: ['EdDSA', 'Ed25519'],
        proof_types_supported: ['Ed25519Signature2020', 'DataIntegrityProof'],
        display: [
          {
            name: 'Nursing License',
            locale: 'en-US',
            logo_uri: `${baseUrl}/logos/nursing-license.svg`,
            description: 'Verifiable Nursing License Credential',
            background_color: '#FFFFFF',
            text_color: '#000000',
          },
        ],
      },
      'BoardCertificationVC': {
        format: 'vc+sd-jwt',
        scope: 'BoardCertificationVC',
        cryptographic_binding_methods_supported: ['did', 'jwk'],
        credential_signing_alg_values_supported: ['EdDSA', 'Ed25519'],
        proof_types_supported: ['Ed25519Signature2020', 'DataIntegrityProof'],
        display: [
          {
            name: 'Board Certification',
            locale: 'en-US',
            logo_uri: `${baseUrl}/logos/board-cert.svg`,
            description: 'Verifiable Board Certification Credential',
            background_color: '#FFFFFF',
            text_color: '#000000',
          },
        ],
      },
      // JSON-LD format support
      'VerifiableCredential': {
        format: 'ldp_vc',
        scope: 'VerifiableCredential',
        cryptographic_binding_methods_supported: ['did'],
        credential_signing_alg_values_supported: ['EdDSA', 'Ed25519'],
        proof_types_supported: ['Ed25519Signature2020', 'DataIntegrityProof'],
        proof_signing_alg_values_supported: ['EdDSA', 'Ed25519'],
      },
    },

    // Supported formats
    formats_supported: ['vc+sd-jwt', 'ldp_vc'],

    // Proof types supported
    proof_types_supported: {
      jwt: {
        proof_signing_alg_values_supported: ['EdDSA', 'Ed25519'],
      },
      'cwt': {
        proof_signing_alg_values_supported: ['EdDSA', 'Ed25519'],
      },
      'ldp': {
        proof_signing_alg_values_supported: ['EdDSA', 'Ed25519'],
        proof_type_supported: ['Ed25519Signature2020', 'DataIntegrityProof'],
      },
    },

    // Response types
    response_types_supported: ['code', 'vp_token'],
    response_modes_supported: ['query', 'fragment', 'direct_post'],

    // Grant types
    grant_types_supported: [
      'authorization_code',
      'urn:ietf:params:oauth:grant-type:pre-authorized_code',
    ],

    // Token endpoint
    token_endpoint: `${baseUrl}/oidc/token`,

    // Other endpoints
    authorization_endpoint: `${baseUrl}/oidc/authorize`,
    pushed_authorization_request_endpoint: `${baseUrl}/oidc/par`,

    // Code challenge methods
    code_challenge_methods_supported: ['S256'],

    // Display properties
    display: [
      {
        name: 'VitalCV Credential Issuer',
        locale: 'en-US',
        logo_uri: `${baseUrl}/logos/vitalcv-logo.svg`,
        description: 'Healthcare Credentialing Platform',
      },
    ],

    // SD-JWT specific
    sd_jwt_issuance: true,
    sd_jwt_vc_supported: true,
  };

  res.json(discoveryDocument);
});

/**
 * POST /oidc/credential
 * OIDC-VCI-002: Credential Endpoint
 *
 * Issues verifiable credentials after validating DPoP-bound access token.
 * Supports both VC+SD-JWT and JSON-LD proof formats.
 */
router.post('/credential', async (req: Request, res: Response) => {
  try {
    // Extract access token (from Authorization header or request body)
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '') || req.body.access_token;

    if (!token) {
      return res.status(401).json({
        error: 'invalid_request',
        error_description: 'Missing access token',
      });
    }

    // TODO: Validate DPoP-bound access token
    // This should verify:
    // 1. Token signature
    // 2. DPoP proof binding
    // 3. Token expiration
    // 4. Scope permissions
    const tokenValid = await validateAccessToken(token, req);

    if (!tokenValid) {
      return res.status(401).json({
        error: 'invalid_token',
        error_description: 'Invalid or expired access token',
      });
    }

    // Extract credential request
    const {
      format = 'vc+sd-jwt',
      credential_definition,
      proof,
    } = req.body;

    if (!credential_definition) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Missing credential_definition',
      });
    }

    // Build credential based on request
    const credential = await buildCredential(credential_definition, tokenValid);

    // Sign credential using signing service (KMS-backed)
    const signingService = getSigningService();
    const issuerDid = process.env.ISSUER_DID || `did:web:${req.get('host')}`;

    const signedResult = await signingService.signCredential({
      credential,
      issuerDid,
      useKms: process.env.USE_KMS_SIGNING === 'true',
      proofPurpose: 'assertionMethod',
      challenge: proof?.jwt ? extractChallengeFromProof(proof.jwt) : undefined,
    });

    // Format response based on requested format
    if (format === 'vc+sd-jwt') {
      // TODO: Wrap in SD-JWT format
      // For now, return JSON-LD VC
      return res.json({
        format: 'vc+sd-jwt',
        credential: signedResult.credential,
        // In production, this would be an SD-JWT string
        c_nonce: generateCNonce(),
        c_nonce_expires_in: 300,
      });
    } else if (format === 'ldp_vc') {
      return res.json({
        format: 'ldp_vc',
        credential: signedResult.credential,
        c_nonce: generateCNonce(),
        c_nonce_expires_in: 300,
      });
    } else {
      return res.status(400).json({
        error: 'unsupported_format',
        error_description: `Format ${format} not supported`,
      });
    }
  } catch (error) {
    console.error('Credential issuance error:', error);
    return res.status(500).json({
      error: 'server_error',
      error_description: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * Validate access token (placeholder - implement OAuth2/DPoP validation)
 */
async function validateAccessToken(token: string, req: Request): Promise<any> {
  // TODO: Implement proper token validation
  // 1. Verify token signature
  // 2. Validate DPoP proof if present
  // 3. Check token expiration
  // 4. Verify scope
  // 5. Extract user/subject information

  // Placeholder: return token payload
  // In production, this should validate against OAuth2 authorization server
  try {
    // This is a stub - implement actual token validation
    return {
      sub: 'user123',
      scope: 'openid MedicalLicenseVC',
      aud: process.env.OIDC_ISSUER,
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Build credential from credential definition
 */
async function buildCredential(credentialDefinition: any, tokenPayload: any): Promise<VerifiableCredential> {
  const baseUrl = process.env.BASE_URL || 'https://vitalcv.com';

  const credential: VerifiableCredential = {
    '@context': [
      'https://www.w3.org/2018/credentials/v1',
      'https://w3id.org/security/data-integrity/v1',
      'https://w3id.org/security/suites/ed25519-2020/v1',
    ],
    id: `urn:uuid:${generateUUID()}`,
    type: credentialDefinition.credential_definition?.type || ['VerifiableCredential'],
    issuer: process.env.ISSUER_DID || `did:web:${baseUrl.replace(/^https?:\/\//, '')}`,
    issuanceDate: new Date().toISOString(),
    expirationDate: credentialDefinition.credential_definition?.expiration_date || undefined,
    credentialSubject: {
      id: tokenPayload.sub || credentialDefinition.credential_definition?.credential_subject?.id,
      ...credentialDefinition.credential_definition?.credential_subject,
    },
  };

  return credential;
}

/**
 * Extract challenge from DPoP proof JWT
 */
function extractChallengeFromProof(proofJwt: string): string | undefined {
  // TODO: Decode and extract challenge from DPoP proof
  // This should extract the nonce/challenge from the proof
  return undefined;
}

/**
 * Generate c_nonce for credential response
 */
function generateCNonce(): string {
  return crypto.randomBytes(16).toString('base64url');
}

/**
 * Generate UUID
 */
function generateUUID(): string {
  return crypto.randomUUID?.() || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default router;


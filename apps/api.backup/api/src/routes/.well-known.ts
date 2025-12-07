/**
 * .well-known Routes
 * Tagged: cursor-batch-1101
 * Agent: CODEX • BACKEND • chai-vc-platform
 *
 * Serves JWKS and OIDC4VCI discovery endpoints
 */

import { Request, Response, Router } from 'express';
import { getKeyManager } from '../services/keyManager';

const router = Router();

/**
 * GET /.well-known/jwks.json
 * Returns JSON Web Key Set (JWKS) for Ed25519 signing keys
 *
 * @returns {object} JWKS with active public keys
 */
router.get('/jwks.json', async (req: Request, res: Response) => {
  try {
    const keyManager = getKeyManager();
    const jwks = keyManager.getJWKS();

    // Add cache headers (keys rotate every 90 days by default)
    res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour
    res.setHeader('Content-Type', 'application/json');

    res.json(jwks);
  } catch (error: any) {
    console.error('Error serving JWKS:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve JWKS',
    });
  }
});

/**
 * GET /.well-known/key-rotation
 * Returns information about key rotation policy
 *
 * @returns {object} Key rotation metadata
 */
router.get('/key-rotation', async (req: Request, res: Response) => {
  try {
    const keyManager = getKeyManager();
    const rotationInfo = keyManager.getRotationInfo();

    res.json({
      ...rotationInfo,
      documentation: 'https://docs.chai-vc.com/key-rotation',
      rotationPolicy: {
        intervalDays: Math.floor(rotationInfo.rotationInterval / (24 * 60 * 60 * 1000)),
        description: 'Keys are rotated automatically at the specified interval',
        gracePeriod: 'Rotated keys remain in JWKS for verification for 30 days',
      },
    });
  } catch (error: any) {
    console.error('Error serving key rotation info:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve key rotation information',
    });
  }
});

/**
 * GET /.well-known/openid-credential-issuer
 * OIDC4VCI Issuer Metadata endpoint
 *
 * @returns {object} OpenID Credential Issuer metadata
 */
router.get('/openid-credential-issuer', async (req: Request, res: Response) => {
  try {
    const baseUrl = process.env.ISSUER_BASE_URL || `${req.protocol}://${req.get('host')}`;
    const keyManager = getKeyManager();
    const currentKey = keyManager.getCurrentKey();

    const metadata = {
      credential_issuer: baseUrl,
      authorization_server: `${baseUrl}`,
      credential_endpoint: `${baseUrl}/api/issuer/credential`,
      deferred_credential_endpoint: `${baseUrl}/api/issuer/deferred`,
      display: [
        {
          name: 'Chai VC Platform',
          locale: 'en-US',
          logo: {
            url: `${baseUrl}/logo.png`,
            alt_text: 'Chai VC Platform Logo',
          },
        },
      ],
      credentials_supported: [
        {
          format: 'jwt_vc_json',
          id: 'MedicalLicense',
          cryptographic_binding_methods_supported: ['did:key', 'did:web'],
          cryptographic_suites_supported: ['EdDSA'],
          credential_definition: {
            type: ['VerifiableCredential', 'MedicalLicense'],
            credentialSubject: {
              licenseNumber: {
                mandatory: true,
                display: [{ name: 'License Number', locale: 'en-US' }],
              },
              state: {
                mandatory: true,
                display: [{ name: 'State', locale: 'en-US' }],
              },
              licenseType: {
                mandatory: true,
                display: [{ name: 'License Type', locale: 'en-US' }],
              },
              expirationDate: {
                mandatory: false,
                display: [{ name: 'Expiration Date', locale: 'en-US' }],
              },
            },
          },
          display: [
            {
              name: 'Medical License',
              locale: 'en-US',
              background_color: '#12107c',
              text_color: '#FFFFFF',
            },
          ],
        },
        {
          format: 'jwt_vc_json',
          id: 'BoardCertification',
          cryptographic_binding_methods_supported: ['did:key', 'did:web'],
          cryptographic_suites_supported: ['EdDSA'],
          credential_definition: {
            type: ['VerifiableCredential', 'BoardCertification'],
            credentialSubject: {
              boardName: {
                mandatory: true,
                display: [{ name: 'Board Name', locale: 'en-US' }],
              },
              certificationNumber: {
                mandatory: true,
                display: [{ name: 'Certification Number', locale: 'en-US' }],
              },
              specialty: {
                mandatory: true,
                display: [{ name: 'Specialty', locale: 'en-US' }],
              },
              certificationDate: {
                mandatory: false,
                display: [{ name: 'Certification Date', locale: 'en-US' }],
              },
              expirationDate: {
                mandatory: false,
                display: [{ name: 'Expiration Date', locale: 'en-US' }],
              },
            },
          },
          display: [
            {
              name: 'Board Certification',
              locale: 'en-US',
              background_color: '#1e3a8a',
              text_color: '#FFFFFF',
            },
          ],
        },
      ],
    };

    res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour
    res.setHeader('Content-Type', 'application/json');
    res.json(metadata);
  } catch (error: any) {
    console.error('Error serving OIDC4VCI metadata:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve issuer metadata',
    });
  }
});

export default router;

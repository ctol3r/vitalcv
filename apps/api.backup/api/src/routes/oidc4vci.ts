import { Router } from 'express';
import { getCurrentJwks } from '../security/jwks';

export const oidcRouter = Router();

oidcRouter.get('/.well-known/openid-credential-issuer', (_req, res) => {
  const issuerUrl = process.env.PUBLIC_ISSUER_URL || 'https://example.org';
  res.json({
    issuer: issuerUrl,
    credential_issuer: issuerUrl, // OIDC4VCI draft 13
    authorization_server: (process.env.PUBLIC_AUTH_URL || 'https://example.org/auth'),
    credential_endpoint: issuerUrl + '/api/oidc4vci/credential',
    display: [{ name: 'VitalCV Issuer', locale: 'en-US' }],
    supported_formats: ['vc+sd-jwt'],
    c_nonce_expires_in: 3600,
    credential_configurations_supported: {
      MedicalLicense: {
        format: 'vc+sd-jwt',
        cryptographic_binding_methods_supported: ['jwk', 'did'],
        credential_signing_alg_values_supported: ['ES256', 'EdDSA'],
        display: [{ name: 'Medical License', locale: 'en-US' }]
      },
      EuHealthID: {
        format: 'vc+sd-jwt',
        cryptographic_binding_methods_supported: ['jwk', 'did'],
        credential_signing_alg_values_supported: ['ES256', 'EdDSA'],
        display: [{
          name: 'EU Health ID',
          locale: 'en-US',
          description: 'eIDAS-compliant Health ID'
        }],
        credential_definition: {
          type: ['VerifiableCredential', 'EuHealthID']
        }
      }
    }
  });
});

oidcRouter.get('/.well-known/jwks.json', (_req, res) => {
  res.json(getCurrentJwks());
});


import { getCNonceLifetimeSeconds, getHaipComplianceSnapshot } from './haipPolicy';

type Oidc4vciMetadata = {
  issuer: string;
  credential_issuer: string;
  credential_endpoint: string;
  token_endpoint: string;
  credential_configurations_supported: Record<string, object>;
  credential_signing_alg_values_supported: string[];
  pkce_required: boolean;
  strict_nonce_enforced: boolean;
  haip_compliant: boolean;
  c_nonce_supported: boolean;
  c_nonce_expires_in: number;
  [key: string]: unknown;
};

function getIssuerHost(): string {
  return process.env.PUBLIC_ISSUER_URL || process.env.ISSUER_URL || 'https://vitalcv.com';
}

export function buildOpenidCredentialIssuerMetadata(): Oidc4vciMetadata {
  const baseUrl = getIssuerHost().replace(/\/$/, '');
  const status = getHaipComplianceSnapshot();

  return {
    issuer: `${baseUrl}/oidc4vci`,
    credential_issuer: `${baseUrl}/oidc4vci`,
    credential_endpoint: `${baseUrl}/api/oid4vci/credential`,
    token_endpoint: `${baseUrl}/oid4vci/token`,
    credential_configurations_supported: {
      ClinicianIdentityCredential: {
        format: 'jwt_vc_json',
        types: ['VerifiableCredential', 'ClinicianIdentityCredential'],
        cryptographic_binding_methods_supported: ['did:web'],
        cryptographic_suites_supported: ['ES256'],
      },
    },
    credential_signing_alg_values_supported: ['ES256'],
    token_endpoint_auth_signing_alg_values_supported: ['ES256'],
    dpop_signing_alg_values_supported: ['ES256'],
    pkce_required: status.pkceRequired,
    strict_nonce_enforced: status.nonceStrict,
    haip_compliant: status.compliant,
    c_nonce_supported: true,
    c_nonce_expires_in: getCNonceLifetimeSeconds(),
  };
}

export type CredentialConfigurationFormat =
  | 'vc+sd-jwt'
  | 'jwt_vc_json'
  | 'ldp_vc';

export interface OpenIdCredentialIssuerMetadata {
  issuer: string;
  credential_endpoint: string;
  token_endpoint?: string;
  jwks_uri: string;
  authorization_servers?: string[];
  credential_configurations_supported: Record<string, {
    format: CredentialConfigurationFormat;
    scope?: string;
    cryptographic_binding_methods_supported?: string[];
    credential_signing_alg_values_supported?: string[];
    credential_definition?: Record<string, unknown>;
    display?: Array<{ name: string; locale?: string }>;
  }>;
  display?: Array<{ name: string; locale?: string; logo?: { uri: string } }>;
}

export interface LegacyIssuerMetadata {
  credential_issuer: string;
  credential_endpoint: string;
  credentials_supported: Array<{
    format: CredentialConfigurationFormat;
    id: string;
    types: string[];
    display?: Array<{ name: string; locale?: string; logo?: { uri: string } }>;
    cryptographic_binding_methods_supported?: string[];
    cryptographic_suites_supported?: string[];
  }>;
  display?: Array<{ name: string; locale?: string; logo?: { uri: string } }>;
  token_endpoint?: string;
  authorization_endpoint?: string;
}

const DEFAULT_ISSUER_BASE_URL = 'https://vitalcv.com';

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

export function getOid4vcIssuerBaseUrl(): string {
  return normalizeBaseUrl(process.env.ISSUER_BASE_URL ?? DEFAULT_ISSUER_BASE_URL);
}

export function buildCredentialIssuerMetadata(baseUrl: string): OpenIdCredentialIssuerMetadata {
  const issuer = normalizeBaseUrl(baseUrl);

  return {
    issuer,
    credential_endpoint: `${issuer}/api/oid4vci/credential`,
    token_endpoint: `${issuer}/api/oid4vci/token`,
    jwks_uri: `${issuer}/api/.well-known/jwks.json`,
    authorization_servers: [issuer],
    credential_configurations_supported: {
      HEALTHCARE_LICENSE: {
        format: 'vc+sd-jwt',
        scope: 'HEALTHCARE_LICENSE',
        cryptographic_binding_methods_supported: ['did:vitalcv', 'did:key', 'did:jwk'],
        credential_signing_alg_values_supported: ['ES256'],
        credential_definition: {
          type: ['VerifiableCredential', 'HEALTHCARE_LICENSE'],
          claims: {
            licenseNumber: { type: 'string' },
            jurisdiction: { type: 'string' },
            specialty: { type: 'string' },
          },
        },
        display: [{ name: 'Healthcare License', locale: 'en-US' }],
      },
      NPI_BOUND_IDENTITY: {
        format: 'jwt_vc_json',
        scope: 'NPI_BOUND_IDENTITY',
        cryptographic_binding_methods_supported: ['did:vitalcv', 'did:key', 'did:jwk'],
        credential_signing_alg_values_supported: ['ES256'],
        credential_definition: {
          type: ['VerifiableCredential', 'NPI_BOUND_IDENTITY'],
          claims: {
            npi: { type: 'string' },
            legalName: { type: 'string' },
            subjectDid: { type: 'string' },
          },
        },
        display: [{ name: 'NPI-Bound Identity', locale: 'en-US' }],
      },
      EMPLOYMENT_ELIGIBILITY: {
        format: 'jwt_vc_json',
        scope: 'EMPLOYMENT_ELIGIBILITY',
        cryptographic_binding_methods_supported: ['did:vitalcv', 'did:key', 'did:jwk'],
        credential_signing_alg_values_supported: ['ES256'],
        credential_definition: {
          type: ['VerifiableCredential', 'EMPLOYMENT_ELIGIBILITY'],
          claims: {
            employerId: { type: 'string' },
            employmentStatus: { type: 'string' },
            workAuthorization: { type: 'string' },
          },
        },
        display: [{ name: 'Employment Eligibility', locale: 'en-US' }],
      },
    },
    display: [
      {
        name: 'VitalCV',
        locale: 'en-US',
        logo: { uri: `${issuer}/logo.png` },
      },
    ],
  };
}

export function buildAuthorizationServerMetadata(baseUrl: string): Record<string, unknown> {
  const issuer = normalizeBaseUrl(baseUrl);

  return {
    issuer,
    authorization_endpoint: `${issuer}/api/oid4vci/authorize`,
    token_endpoint: `${issuer}/api/oid4vci/token`,
    grant_types_supported: [
      'authorization_code',
      'urn:ietf:params:oauth:grant-type:pre-authorized_code',
    ],
    response_types_supported: ['code'],
    scopes_supported: [
      'HEALTHCARE_LICENSE',
      'NPI_BOUND_IDENTITY',
      'EMPLOYMENT_ELIGIBILITY',
    ],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
  };
}

function toTypes(
  credentialId: string,
  definition: Record<string, unknown> | undefined,
): string[] {
  const typeValue = definition?.type;
  if (Array.isArray(typeValue)) {
    return typeValue.filter((value): value is string => typeof value === 'string');
  }

  if (typeof typeValue === 'string') {
    return ['VerifiableCredential', typeValue];
  }

  return ['VerifiableCredential', credentialId];
}

export function buildLegacyIssuerMetadata(baseUrl: string): LegacyIssuerMetadata {
  const metadata = buildCredentialIssuerMetadata(baseUrl);
  const authMetadata = buildAuthorizationServerMetadata(baseUrl);

  return {
    credential_issuer: metadata.issuer,
    credential_endpoint: metadata.credential_endpoint,
    credentials_supported: Object.entries(metadata.credential_configurations_supported).map(
      ([credentialId, configuration]) => ({
        format: configuration.format,
        id: credentialId,
        types: toTypes(credentialId, configuration.credential_definition),
        display: configuration.display?.map((entry) => ({ ...entry })),
        cryptographic_binding_methods_supported:
          configuration.cryptographic_binding_methods_supported,
        cryptographic_suites_supported: configuration.credential_signing_alg_values_supported,
      }),
    ),
    display: metadata.display?.map((entry) => ({ ...entry })),
    token_endpoint:
      typeof authMetadata.token_endpoint === 'string' ? authMetadata.token_endpoint : undefined,
    authorization_endpoint:
      typeof authMetadata.authorization_endpoint === 'string'
        ? authMetadata.authorization_endpoint
        : undefined,
  };
}

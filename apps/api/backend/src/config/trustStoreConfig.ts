/**
 * Wave 215 — Trust Store / Service Config
 */
export interface TrustStoreConfig {
  issuerBaseUrl: string; issuerDid: string; jwksUri: string;
  anchorPolicy: 'STRICT_HEALTHCARE' | 'STANDARD' | 'DEMO';
  allowedCredentialTypes: string[];
  revocationCheckEnabled: boolean; nonceWindowSeconds: number;
}

export function getTrustStoreConfig(): TrustStoreConfig {
  const base = process.env.ISSUER_BASE_URL ?? 'https://vitalcv.com';
  return {
    issuerBaseUrl: base,
    issuerDid: process.env.ISSUER_DID ?? 'did:web:vitalcv.com',
    jwksUri: `${base}/api/.well-known/jwks.json`,
    anchorPolicy: (process.env.ANCHOR_POLICY as TrustStoreConfig['anchorPolicy']) ?? 'STANDARD',
    allowedCredentialTypes: ['HEALTHCARE_LICENSE', 'NPI_BOUND_IDENTITY', 'EMPLOYMENT_ELIGIBILITY', 'PSV_ARTIFACT'],
    revocationCheckEnabled: process.env.REVOCATION_CHECK !== 'false',
    nonceWindowSeconds: parseInt(process.env.NONCE_WINDOW_SECONDS ?? '300', 10),
  };
}

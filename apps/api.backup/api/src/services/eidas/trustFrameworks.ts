/**
 * EU Trust Frameworks Mapping
 * Used for acceptance checks of EU Wallet credentials
 */

export const EU_MEMBER_STATES = [
  'AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'EL', 'ES', 'FI', 'FR', 'HR',
  'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK'
] as const;

export type MemberState = typeof EU_MEMBER_STATES[number];

export interface TrustProvider {
  id: string;
  name: string;
  country: MemberState;
  services: string[];
  trustListStatus: 'active' | 'revoked' | 'suspended';
}

export const TRUST_PROVIDERS: TrustProvider[] = [
  {
    id: 'did:web:trust.eidas.eu:provider:bundesdruckerei',
    name: 'Bundesdruckerei GmbH',
    country: 'DE',
    services: ['wallet-provisioning', 'credential-issuance'],
    trustListStatus: 'active',
  },
  {
    id: 'did:web:trust.eidas.eu:provider:france-connect',
    name: 'FranceConnect+',
    country: 'FR',
    services: ['authentication', 'credential-issuance'],
    trustListStatus: 'active',
  }
];

export interface SigningAuthority {
  kid: string;
  issuer: string;
  country: MemberState;
  publicKey: string; // PEM or JWK string
  algorithm: string;
}

export const SIGNING_AUTHORITIES: SigningAuthority[] = [
  {
    kid: 'eidas-root-de-01',
    issuer: 'did:web:trust.eidas.eu:root:de',
    country: 'DE',
    publicKey: '-----BEGIN PUBLIC KEY-----\nMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE...\n-----END PUBLIC KEY-----',
    algorithm: 'ES256',
  },
  {
    kid: 'eidas-root-fr-01',
    issuer: 'did:web:trust.eidas.eu:root:fr',
    country: 'FR',
    publicKey: '-----BEGIN PUBLIC KEY-----\nMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE...\n-----END PUBLIC KEY-----',
    algorithm: 'ES256',
  }
];

export function isTrustedIssuer(issuerId: string): boolean {
  return TRUST_PROVIDERS.some(p => p.id === issuerId && p.trustListStatus === 'active') ||
         SIGNING_AUTHORITIES.some(a => a.issuer === issuerId);
}















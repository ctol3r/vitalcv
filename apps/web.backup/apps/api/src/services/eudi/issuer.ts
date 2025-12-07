import { randomUUID } from 'node:crypto';

export type CredentialDisclosureMode = 'sd-jwt' | 'bbs';
export type CredentialFormat = 'vc+sd-jwt' | 'jwt_vp_json' | 'ldp_vp';

export interface EudiIssuerMetadata {
  credentialIssuer: string;
  issuerDisplayName: string;
  issuerDid: string;
  authorizationServer: string;
  credentialEndpoint: string;
  statusListEndpoint: string;
  walletDiscoveryEndpoint: string;
  trustFramework: string;
  supportedFormats: CredentialFormat[];
  walletInteroperabilityProfile: string;
}

export interface EudiDisplayDescriptor {
  locale: string;
  name: string;
  description: string;
  hero?: string;
  icon?: string;
}

export interface EudiCredentialProfile {
  profileId: string;
  vcType: string;
  disclosure: CredentialDisclosureMode;
  minAssurance: 'low' | 'substantial' | 'high';
  trustServiceId?: string;
  format: CredentialFormat;
  schemaUri: string;
  presentationDefinitionId: string;
  issuerDid: string;
  supportedWallets: string[];
  display: EudiDisplayDescriptor[];
  selectiveDisclosureHints: Record<string, string[]>;
  evidenceTypes: string[];
  defaultFields: {
    identity: string[];
    qualifications: string[];
    sanctionFree: string[];
  };
}

export interface WalletProviderMetadata {
  id: string;
  name: string;
  region: string;
  transport: ('ble' | 'nfc' | 'qr')[];
  deeplink?: string;
  docsUrl?: string;
}

const DEFAULT_ISSUER_METADATA: EudiIssuerMetadata = {
  credentialIssuer:
    process.env.EUDI_CREDENTIAL_ISSUER ??
    process.env.OIDC4VCI_ISSUER_BASE ??
    'https://issuer.vitalcv.health',
  issuerDisplayName: process.env.EUDI_ISSUER_DISPLAY ?? 'VitalCV EUDI Issuer',
  issuerDid: process.env.EUDI_ISSUER_DID ?? 'did:web:issuer.vitalcv.health',
  authorizationServer:
    process.env.EUDI_AUTHORIZATION_SERVER ??
    `${process.env.OIDC4VCI_API_BASE ?? 'https://issuer.vitalcv.health/api'}/oidc4vci/token`,
  credentialEndpoint:
    process.env.EUDI_CREDENTIAL_ENDPOINT ??
    `${process.env.OIDC4VCI_API_BASE ?? 'https://issuer.vitalcv.health/api'}/oidc4vci/credential`,
  statusListEndpoint:
    process.env.EUDI_STATUS_ENDPOINT ?? 'https://issuer.vitalcv.health/status/vital-passports',
  walletDiscoveryEndpoint:
    process.env.EUDI_WALLET_DISCOVERY ??
    'https://issuer.vitalcv.health/.well-known/wallets.json',
  trustFramework: 'eidas2:2024/1503',
  supportedFormats: ['vc+sd-jwt', 'jwt_vp_json'],
  walletInteroperabilityProfile: 'ETSI TS 119 612 v2.4.1',
};

const DEFAULT_PROFILES: EudiCredentialProfile[] = [
  {
    profileId: 'vital-license-status',
    vcType: 'VitalLicenseCredential',
    disclosure: 'sd-jwt',
    minAssurance: 'substantial',
    trustServiceId: 'eu.tsl.vitalcv.issuer',
    format: 'vc+sd-jwt',
    schemaUri: 'https://docs.vitalcv.health/schemas/license-status-v1.json',
    presentationDefinitionId: 'pd-vital-license-status',
    issuerDid: DEFAULT_ISSUER_METADATA.issuerDid,
    supportedWallets: ['EUDI-Wallet', 'TruAge', 'SpruceID'],
    display: [
      {
        locale: 'en-US',
        name: 'License Status Credential',
        description: 'State license number, status, and expiry with sanctions attestation.',
        hero: 'https://cdn.vitalcv.health/eudi/license-card.png',
        icon: 'https://cdn.vitalcv.health/eudi/license-icon.png',
      },
    ],
    selectiveDisclosureHints: {
      identity: ['credentialSubject.name.first', 'credentialSubject.name.last', 'credentialSubject.npi'],
      qualifications: ['credentialSubject.license.number', 'credentialSubject.license.status', 'credentialSubject.license.expires'],
      sanctionFree: ['credentialSubject.sanction.status', 'credentialSubject.sanction.lastChecked'],
    },
    evidenceTypes: ['psv-license', 'ncqa-chain', 'regulator-status-list'],
    defaultFields: {
      identity: ['credentialSubject.name', 'credentialSubject.npi'],
      qualifications: ['credentialSubject.license'],
      sanctionFree: ['credentialSubject.sanction'],
    },
  },
  {
    profileId: 'vital-board-certification',
    vcType: 'VitalBoardCertificationCredential',
    disclosure: 'bbs',
    minAssurance: 'high',
    trustServiceId: 'eu.tsl.vitalcv.board',
    format: 'vc+sd-jwt',
    schemaUri: 'https://docs.vitalcv.health/schemas/board-certification-v1.json',
    presentationDefinitionId: 'pd-vital-board-cert',
    issuerDid: DEFAULT_ISSUER_METADATA.issuerDid,
    supportedWallets: ['EUDI-Wallet', 'Trinsic', 'Talao'],
    display: [
      {
        locale: 'en-US',
        name: 'Board Certification',
        description: 'Primary and subspecialty board certifications with validity window.',
        hero: 'https://cdn.vitalcv.health/eudi/board-card.png',
        icon: 'https://cdn.vitalcv.health/eudi/board-icon.png',
      },
    ],
    selectiveDisclosureHints: {
      identity: ['credentialSubject.name.full', 'credentialSubject.npi'],
      qualifications: ['credentialSubject.board.primary', 'credentialSubject.board.subspecialty'],
      sanctionFree: ['credentialSubject.board.goodStanding'],
    },
    evidenceTypes: ['board-registry-api', 'passkey-binding'],
    defaultFields: {
      identity: ['credentialSubject.name', 'credentialSubject.npi'],
      qualifications: ['credentialSubject.board'],
      sanctionFree: ['credentialSubject.board.goodStanding'],
    },
  },
];

const DEFAULT_PROVIDERS: WalletProviderMetadata[] = [
  {
    id: 'eu-reference',
    name: 'EUDI Reference Wallet',
    region: 'EU',
    transport: ['qr', 'nfc'],
    deeplink: 'eudi://wallet/open',
    docsUrl: 'https://digital-strategy.ec.europa.eu/en/policies/eudi-wallet',
  },
  {
    id: 'spruce',
    name: 'SpruceID Wallet',
    region: 'US/EU',
    transport: ['qr', 'ble'],
    deeplink: 'spruceidwallet://launch',
    docsUrl: 'https://www.spruceid.com/wallet',
  },
  {
    id: 'trinsic',
    name: 'Trinsic Wallet',
    region: 'Global',
    transport: ['qr'],
    docsUrl: 'https://docs.trinsic.id/wallet',
  },
];

export function getEudiIssuerMetadata(): EudiIssuerMetadata {
  return { ...DEFAULT_ISSUER_METADATA };
}

export function listEudiIssuerProfiles(): EudiCredentialProfile[] {
  return DEFAULT_PROFILES.map((profile) => ({ ...profile }));
}

export function getEudiIssuerProfile(profileId: string): EudiCredentialProfile | undefined {
  return listEudiIssuerProfiles().find((profile) => profile.profileId === profileId);
}

export function resolveProfileForCredentialType(type: string): EudiCredentialProfile | undefined {
  const normalized = type.toLowerCase();
  if (normalized.includes('license')) {
    return getEudiIssuerProfile('vital-license-status');
  }
  if (normalized.includes('board')) {
    return getEudiIssuerProfile('vital-board-certification');
  }
  return DEFAULT_PROFILES[0];
}

export function listWalletProviders(): WalletProviderMetadata[] {
  return DEFAULT_PROVIDERS.map((provider) => ({ ...provider }));
}

export function buildOidc4vciMetadataPayload() {
  const issuer = getEudiIssuerMetadata();
  const profiles = listEudiIssuerProfiles();
  return {
    credential_issuer: issuer.credentialIssuer,
    credential_endpoint: issuer.credentialEndpoint,
    authorization_server: issuer.authorizationServer,
    wallet_discovery: issuer.walletDiscoveryEndpoint,
    trust_framework: issuer.trustFramework,
    supported_credentials: profiles.map((profile) => ({
      id: profile.profileId,
      format: profile.format,
      types: ['VerifiableCredential', profile.vcType],
      cryptographic_binding_methods_supported: ['did:jwk', 'did:key'],
      cryptographic_suites_supported:
        profile.disclosure === 'bbs'
          ? ['BBS_PLUS_SHA256']
          : ['SD-JWT_VC'],
      display: profile.display,
      credential_schema: [
        {
          id: profile.schemaUri,
          type: 'JsonSchema',
        },
      ],
      proof_types_supported:
        profile.disclosure === 'bbs'
          ? ['BbsBlsSignature2020']
          : ['JsonWebSignature2020'],
    })),
    status_list_endpoint: issuer.statusListEndpoint,
    metadata_id: randomUUID(),
    generated_at: new Date().toISOString(),
  };
}











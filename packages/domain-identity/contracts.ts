/**
 * B196B-CONTRACT-006
 * Identity domain contracts shared across wallet services, VC formats, and agents.
 */

type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject {
  [key: string]: JsonValue;
}

// ---------------------------------------------------------------------------
// DID Documents
// ---------------------------------------------------------------------------

export interface DIDVerificationMethod {
  id: string;
  type: string;
  controller: string;
  publicKeyJwk?: JsonObject;
  publicKeyMultibase?: string;
  blockchainAccountId?: string;
  [key: string]: JsonValue | undefined;
}

export interface DIDServiceEndpoint {
  id?: string;
  type: string | string[];
  serviceEndpoint: string | string[] | JsonObject;
  accepts?: string[];
  routingKeys?: string[];
  [key: string]: JsonValue | undefined;
}

export type DIDVerificationRelationship = string | DIDVerificationMethod;

export interface DIDDocument extends JsonObject {
  id: string;
  alsoKnownAs?: string[];
  controller?: string | string[];
  verificationMethod?: DIDVerificationMethod[];
  authentication?: DIDVerificationRelationship[];
  assertionMethod?: DIDVerificationRelationship[];
  keyAgreement?: DIDVerificationRelationship[];
  capabilityInvocation?: DIDVerificationRelationship[];
  capabilityDelegation?: DIDVerificationRelationship[];
  service?: DIDServiceEndpoint[];
}

// ---------------------------------------------------------------------------
// Wallet device bindings
// ---------------------------------------------------------------------------

export const WALLET_SIGNATURE_ALGS = ['EdDSA', 'ES256'] as const;
export type WalletSignatureAlgorithm = (typeof WALLET_SIGNATURE_ALGS)[number];

export interface WalletDevicePublicKey extends JsonObject {
  kty: 'OKP' | 'EC';
  crv: 'Ed25519' | 'P-256';
  alg?: WalletSignatureAlgorithm;
  kid?: string;
  x: string;
  y?: string;
  use?: 'sig';
}

export interface WalletDeviceMetadata {
  label?: string;
  platform?: string;
  userAgent?: string;
  appVersion?: string;
  manufacturer?: string;
  model?: string;
  osBuild?: string;
  secureElement?: 'TEE' | 'HSM' | 'SE' | 'UNKNOWN';
  [key: string]: string | undefined;
}

export interface WalletDeviceDescriptor {
  deviceId: string;
  clinicianId: string;
  publicKeyJwk: WalletDevicePublicKey;
  metadata?: WalletDeviceMetadata;
  createdAt?: string;
  lastUsedAt?: string;
}

// ---------------------------------------------------------------------------
// Signed Verifiable Credentials
// ---------------------------------------------------------------------------

export const VC_FORMATS = ['ldp_vc', 'jwt_vc', 'sd_jwt', 'csd_jwt'] as const;
export type CredentialFormat = (typeof VC_FORMATS)[number];

export interface CredentialProof {
  type: string;
  created: string;
  verificationMethod?: string;
  proofPurpose?: string;
  proofValue?: string;
  jws?: string;
  nonce?: string;
  domain?: string;
  [key: string]: JsonValue | undefined;
}

export interface SignedVC<TSubject = JsonObject, TProof extends CredentialProof = CredentialProof> {
  format: CredentialFormat;
  credential: {
    id?: string;
    type: string[];
    issuer: string;
    issuanceDate: string;
    expirationDate?: string;
    credentialSubject: TSubject;
    schema?: {
      id: string;
      type?: string;
    };
  };
  proof: TProof;
  hash?: string;
  raw?: string | JsonObject;
}



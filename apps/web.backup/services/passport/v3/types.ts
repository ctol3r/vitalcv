import type { PassportAnchor } from '../signPassport';

export type PassportVersion = '3.0';

export type PassportCredentialDomain =
  | 'STATE_LICENSE'
  | 'BOARD_CERTIFICATION'
  | 'DEA_REGISTRATION'
  | 'PRIVILEGE'
  | 'OPPE';

export interface PassportCredential {
  id: string;
  domain: PassportCredentialDomain;
  sourceId: string;
  format: 'vc+sd-jwt';
  hash: string;
  sdJwt: string;
  disclosures: string[];
  issuedAt: string;
  expiresAt?: string | null;
  metadata?: Record<string, unknown>;
  proofRefs?: string[];
}

export interface PassportProof {
  proofId: string;
  proofType: string;
  anchorId?: string | null;
  eventType?: string | null;
  recordedAt: string;
  metadata?: Record<string, unknown> | null;
}

export interface PassportHolder {
  clinicianId: string;
  userId: string;
  did: string;
  npi: string;
  name?: string | null;
  state: string;
}

export interface PassportIssuer {
  did: string;
  name: string;
}

export interface DeviceBindingContext {
  walletId: string;
  dpopJkt?: string;
}

export interface PassportSummary {
  credentialCount: number;
  licenseCount: number;
  boardCertificationCount: number;
  deaRegistrationCount: number;
  privilegeCount: number;
  oppeCaseCount: number;
}

export interface PassportEnvelope {
  passportId: string;
  version: PassportVersion;
  issuedAt: string;
  expiresAt?: string | null;
  holder: PassportHolder;
  issuer: PassportIssuer;
  deviceBinding?: DeviceBindingContext;
  credentials: PassportCredential[];
  proofs: PassportProof[];
  summary: PassportSummary;
  bundleHash?: string;
  signature?: PassportAnchor;
}

export interface PassportBundleManifest {
  bundleId: string;
  did: string;
  generatedAt: string;
  clinician: {
    id: string;
    npi: string;
    name?: string | null;
    state: string;
  };
  credentials: Record<
    string,
    {
      domain: PassportCredentialDomain;
      hash: string;
      issuedAt: string;
      expiresAt?: string | null;
    }
  >;
  proofs?: PassportProof[];
}

export interface PassportBuilderInput {
  clinicianId?: string;
  userId?: string | number;
  passportId?: string;
  deviceBinding?: DeviceBindingContext;
}

export interface PassportBuilderResult extends PassportEnvelope {
  manifest: PassportBundleManifest;
}


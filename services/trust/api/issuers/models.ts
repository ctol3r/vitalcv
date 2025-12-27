export type IssuerAnchorType = 'registration' | 'verification';

export interface IssuerAnchor {
  type: IssuerAnchorType;
  txId: string;
  digest: string;
  anchoredAt: Date;
  metadata?: Record<string, unknown>;
}

export interface Issuer {
  id: string;
  /** Organization-scoped NPI (Type 2) for the issuer */
  npiType2: string;
  verified: boolean;
  anchors: IssuerAnchor[];
}

export interface RegisterIssuerInput {
  id: string;
  npiType2: string;
  metadata?: Record<string, unknown>;
}

export interface VerifyIssuerInput {
  id: string;
  attestation: string;
  verifierDid?: string;
  evidenceUri?: string;
}

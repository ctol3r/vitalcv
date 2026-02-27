/* ------------------------------------------------------------------ */
/*  Holder Wallet UX — Domain types                                    */
/* ------------------------------------------------------------------ */

/** Visual state of a credential in the holder wallet. */
export type CredentialState = 'valid' | 'expiring' | 'revoked';

/** Trust / claim verification level (L0 = unverified → L3 = PSV). */
export type TrustLevel = 'L0' | 'L1' | 'L2' | 'L3';

/** A single entry in the credential audit trail timeline. */
export interface AuditTrailEvent {
  timestamp: string;
  action: string;
  actor: string;
  hash: string;
}

/** Aggregate credential shape consumed by all holder/ components. */
export interface HolderCredential {
  id: string;
  type: string;
  name: string;
  issuer: string;
  state: CredentialState;
  trustLevel: TrustLevel;
  issueDate: string;
  expirationDate?: string;
  npi?: string;
  licenseNumber?: string;
  holderName?: string;
  scope?: string;
  auditTrail: AuditTrailEvent[];
  verifierDID?: string;
  methodologyVersion?: string;
  rawSnapshotHash?: string;
}

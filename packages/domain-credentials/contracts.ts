type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
interface JsonObject {
  [key: string]: JsonValue;
}

const VC_FORMATS = ['ldp_vc', 'jwt_vc', 'sd_jwt', 'csd_jwt'] as const;
type CredentialFormat = (typeof VC_FORMATS)[number];

interface CredentialProof {
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

interface SignedVC<TSubject = JsonObject, TProof extends CredentialProof = CredentialProof> {
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

export const CREDENTIAL_STATUSES = [
  'ACTIVE',
  'EXPIRED',
  'REVOKED',
  'SUSPENDED',
  'PENDING',
] as const;
export type CredentialStatus = (typeof CREDENTIAL_STATUSES)[number];

export interface CredentialRecord<TSubject = JsonObject> {
  id: string;
  subjectId: string;
  issuer: string;
  types: string[];
  format: CredentialFormat;
  status: CredentialStatus;
  issuedAt: string;
  expiresAt?: string | null;
  schemaId?: string;
  subject?: TSubject;
  metadata?: JsonObject;
}

export interface CredentialIssueRequest<TSubject = JsonObject> {
  subjectId: string;
  issuer: string;
  types: string[];
  format: CredentialFormat;
  subject: TSubject;
  expiresAt?: string | null;
  schemaId?: string;
  metadata?: JsonObject;
}

export interface CredentialVerificationResult {
  credentialId: string;
  status: CredentialStatus;
  checkedAt: string;
  reasons?: string[];
  metadata?: JsonObject;
}

export interface CredentialAuditEvent {
  id: string;
  credentialId: string;
  eventType: string;
  actorId?: string;
  occurredAt: string;
  metadata?: JsonObject;
}

export interface CredentialEnvelope<
  TSubject = JsonObject,
  TProof extends CredentialProof = CredentialProof,
> {
  record: CredentialRecord<TSubject>;
  signed?: SignedVC<TSubject, TProof>;
}

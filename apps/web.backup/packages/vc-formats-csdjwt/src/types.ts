import type { JSONSchemaType } from 'ajv';

export type CredentialSchemaId =
  | 'ClinicianIdentityVC'
  | 'LicenseVC'
  | 'BoardCertVC'
  | 'DEAStatusVC'
  | 'PECOSStatusVC'
  | 'PrivilegeVC'
  | (string & {});

export interface DisclosureGroup {
  id: string;
  label: string;
  description?: string;
  claims: string[];
  required?: boolean;
}

export interface DisclosureDigestEntry {
  digest: string;
  path: string;
  groupId: string;
}

export interface HolderDisclosure {
  groupId: string;
  path: string;
  salt: string;
  value: any;
  digest: string;
  required?: boolean;
}

export interface DisclosureManifest {
  version: 1;
  schemaId: CredentialSchemaId;
  digests: DisclosureDigestEntry[];
  groups: DisclosureGroup[];
}

export interface CredentialSchemaDefinition {
  id: CredentialSchemaId;
  schema: JSONSchemaType<any> | Record<string, any>;
  disclosureGroups: DisclosureGroup[];
}

export interface VerifiableCredential {
  '@context': string[];
  id?: string;
  type: string[];
  issuer: string | { id: string };
  issuanceDate: string;
  expirationDate?: string;
  credentialSubject: Record<string, any>;
  credentialSchema?: {
    id: string;
    type?: string;
  };
  credentialStatus?: Record<string, any>;
  [key: string]: any;
}

export interface CsdJwtHeader {
  alg: string;
  typ: 'CSD-JWT';
  kid?: string;
  cty?: string;
}

export interface CsdJwtPayload {
  iss: string;
  sub: string;
  iat: number;
  exp?: number;
  schemaId: CredentialSchemaId;
  vc: VerifiableCredential;
  revealGroups?: string[];
}

export interface IssueProof {
  kid?: string;
  alg: string;
  digest: string;
  nonce?: string;
  holderBinding?: {
    did?: string;
    nonce?: string;
  };
  issuedAt: number;
}

export interface IssueResult {
  token: string;
  header: CsdJwtHeader;
  payload: CsdJwtPayload;
  manifest: DisclosureManifest;
  disclosures: HolderDisclosure[];
  proof: IssueProof;
  summary: {
    schemaId: CredentialSchemaId;
    issuer: string;
    subject: string;
  };
}

export interface VerifiedGroupSummary {
  id: string;
  label: string;
  description?: string;
  required?: boolean;
  revealed: boolean;
}

export interface VerificationSuccess {
  valid: true;
  schemaId: CredentialSchemaId;
  issuer: string;
  subject: string;
  revealedClaims: Record<string, any>;
  credential: VerifiableCredential;
  manifest: DisclosureManifest;
  groups: VerifiedGroupSummary[];
  proof: IssueProof;
}

export interface VerificationFailure {
  valid: false;
  error: string;
  code?: string;
  details?: any;
}

export type VerificationResult = VerificationSuccess | VerificationFailure;



import type { JWK } from 'jose';

export interface LicenseRecordSummary {
  state: string;
  licenseNumber: string;
  status: string;
  issueDate?: string | null;
  expiryDate?: string | null;
  disciplinaryFlag?: boolean | null;
  source?: string | null;
  verifiedAt?: string | null;
  updatedAt?: string | null;
  metadata?: Record<string, unknown> | null;
  isPrimary?: boolean | null;
}

export interface PrivilegeVerificationRecord {
  id: string;
  privilegeSetId: string;
  privilegeCodes: string[];
  status: string;
  grantedAt?: string | null;
  expiresAt?: string | null;
  renewalDue?: string | null;
  dependencySatisfied: boolean;
  missingDependencies: string[];
  ehrSync?: {
    status: string;
    lastAttemptAt?: string | null;
    metadata?: Record<string, unknown> | null;
  } | null;
  reviewerDid?: string | null;
  orgId?: string | null;
}

export interface EnrollmentRecordSummary {
  id: string;
  payerId: string;
  payerName: string;
  status: string;
  panelType?: string | null;
  states: string[];
  specialties: string[];
  effectiveDate?: string | null;
  updatedAt?: string | null;
  lastStatusChange?: string | null;
  metadata?: Record<string, unknown> | null;
  planTypes?: string[];
}

export interface TrustAnchorEntry {
  type:
    | 'STATE_BOARD'
    | 'PECOS'
    | 'MEDICAID'
    | 'PAYER_NETWORK'
    | 'PRIVILEGE'
    | 'COMPACT'
    | 'RISK_ENGINE'
    | 'FEDERATED_NODE';
  source: string;
  referenceId?: string;
  lastVerifiedAt?: string | null;
  jurisdiction?: string;
  proofType?: string;
  url?: string;
  metadata?: Record<string, unknown>;
}

export interface ProofEnvelope<TPayload> {
  type: string;
  issuedAt: string;
  expiresAt?: string;
  payload: TPayload;
  digest: {
    algorithm: 'SHA-256';
    value: string;
  };
  signature: {
    kid: string;
    alg: string;
    proof: string;
  };
}

export interface FederatedNodeDpopAuth {
  type: 'dpop';
  jwk: JWK;
  accessToken?: string;
}

export interface FederatedNodeMtlsAuth {
  type: 'mtls';
  cert: string;
  key: string;
  ca?: string;
  passphrase?: string;
  rejectUnauthorized?: boolean;
}

export type FederatedNodeAuth = FederatedNodeDpopAuth | FederatedNodeMtlsAuth;

export interface FederatedNodeConfig {
  id: string;
  endpoint: string;
  method?: 'GET' | 'POST';
  timeoutMs?: number;
  enabled?: boolean;
  auth?: FederatedNodeAuth;
  metadata?: Record<string, unknown>;
}

export interface FederatedNodePayload {
  did?: string;
  licenseRecords?: LicenseRecordSummary[];
  privilegeRecords?: PrivilegeVerificationRecord[];
  enrollmentRecords?: EnrollmentRecordSummary[];
  trustAnchors?: TrustAnchorEntry[];
  riskScore?: {
    score: number;
    factors: string[];
    updatedAt?: string;
  };
}

export interface FederatedNodeResult {
  id: string;
  status: 'ok' | 'error';
  latencyMs: number;
  httpStatus?: number;
  error?: string;
  payload?: FederatedNodePayload;
}

export interface FederatedLookupAggregate {
  licenseRecords: LicenseRecordSummary[];
  privilegeRecords: PrivilegeVerificationRecord[];
  enrollmentRecords: EnrollmentRecordSummary[];
  trustAnchors: TrustAnchorEntry[];
}

export interface FederatedLookupResult {
  nodes: FederatedNodeResult[];
  aggregated: FederatedLookupAggregate;
}

export interface FederatedLookupOptions {
  npi: string;
  nodes?: FederatedNodeConfig[];
  requestId?: string;
  timeoutMs?: number;
}


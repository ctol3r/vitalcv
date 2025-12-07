import type { JWK } from 'jose';
import type { ProofStreamStatus } from '../proofs/stream';

export type PresentationDefinition = Record<string, any>;

export interface GeneratePresentationRequestOptions {
  clientId: string;
  presentationDefinition: PresentationDefinition;
  baseUrl?: string;
  verifierId?: string;
  expiresInSeconds?: number;
  metadata?: Record<string, any>;
}

export interface DPoPRequirement {
  required: boolean;
  nonce: string;
  algorithms: string[];
}

export interface PresentationRequestObject {
  client_id: string;
  client_id_scheme: string;
  response_type: 'vp_token';
  response_mode: 'direct_post';
  response_uri: string;
  nonce: string;
  state: string;
  presentation_definition: PresentationDefinition;
  expires_at: string;
  client_metadata: {
    require_dpop: boolean;
    supported_dpop_algorithms: string[];
    verifier?: string;
    [key: string]: any;
  };
  dpop: DPoPRequirement;
  [key: string]: any;
}

export interface VerifierQrPayload {
  type: 'openid4vp';
  requestUri: string;
  deepLink: string;
  nonce: string;
  dpop: DPoPRequirement;
  expiresAt: string;
  verifier: {
    clientId: string;
    displayName: string;
  };
  sessionUrl: string;
}

export interface PresentationRequestArtifacts {
  nonce: string;
  state: string;
  dpop: DPoPRequirement;
  expiresAt: string;
  requestObject: PresentationRequestObject;
  qrPayload: VerifierQrPayload;
}

export interface VerificationChainAnchor {
  anchored: boolean;
  status: 'pending' | 'anchored' | 'failed';
  txHash: string;
  blockHash: string;
  blockNumber: number;
  network: string;
  anchorId: string;
  merkleProof: string[];
  timestamp: string;
}

export interface VerificationIssuerInfo {
  did: string;
  name?: string;
  thumbprint?: string;
  jwksUri?: string;
  kid?: string;
  jwk?: JWK;
}

export interface RevocationCheckResult {
  revoked: boolean;
  statusListUrl?: string;
  statusListIndex?: string;
  checkedAt: string;
  reason?: string;
}

export interface DPoPValidation {
  bound: boolean;
  jkt: string;
  iat: number;
  nonce?: string;
}

export interface VerificationResult {
  presentationId: string;
  status: 'valid' | 'revoked' | 'invalid';
  valid: boolean;
  reason?: string;
  reasonCode?: string;
  issuer: VerificationIssuerInfo;
  credentialType?: string;
  holder?: {
    subject?: string;
  };
  timestamps: {
    verifiedAt: string;
    expiresAt?: string;
  };
  disclosure: {
    fields: Record<string, any>;
    manifest?: any;
    groups?: any[];
    proof?: any;
  };
  chain: VerificationChainAnchor;
  revocation: RevocationCheckResult;
  dpop: DPoPValidation;
  raw: {
    vpToken: string;
    payload: Record<string, any>;
  };
  presentationSubmission?: Record<string, any>;
  proofThreadId?: string;
  proofStreamSummary?: {
    status: ProofStreamStatus;
    eventCount: number;
    lastEvent?: string;
    lastEventAt?: string;
  };
}

export interface VerificationExportPayload {
  presentationId: string;
  generatedAt: string;
  verificationSummary: {
    status: VerificationResult['status'];
    valid: boolean;
    credentialType?: string;
    holder?: VerificationResult['holder'];
  };
  issuerMetadata: VerificationIssuerInfo;
  timestamps: VerificationResult['timestamps'];
  auditAnchors: VerificationChainAnchor;
  revocation: RevocationCheckResult;
  raw: VerificationResult['raw'];
}


import type { RevocationCheckResult } from '../oidc4vp/types';
import type {
  IssueProof,
  VerifiedGroupSummary,
} from '@chai-vc/vc-formats-csdjwt';
import type { ReasonCode } from './reasons';
import type { StatusCheckResult } from './statuslist';

export type ProofFormat = 'sd-jwt' | 'jwt-vc';

export interface ProofVerificationResult {
  proofType: ProofFormat;
  valid: boolean;
  status: 'valid' | 'revoked' | 'invalid' | 'expired';
  credentialId?: string;
  credentialType?: string;
  issuer: {
    did?: string;
    name?: string;
    kid?: string;
    jwksUri?: string;
  };
  holder?: {
    subject?: string;
  };
  timestamps: {
    issuedAt?: string;
    expiresAt?: string;
  };
  disclosure: {
    fields: Record<string, any>;
    manifest?: any;
    groups?: VerifiedGroupSummary[];
    proof?: IssueProof;
  };
  revocation: RevocationCheckResult & {
    statusCheck?: StatusCheckResult;
  };
  reasonCode?: ReasonCode;
  reason?: string;
  warnings?: string[];
  trust?: {
    issuerDid?: string;
    confidence: number;
    requiresSecondFactor: boolean;
    threshold: number;
    adjustedWeight?: number;
    lineageDepth?: number;
    federationPath?: string[];
    notes?: string[];
  };
  raw: {
    credential?: any;
    payload?: Record<string, any>;
    token?: string;
  };
}

export interface StatusListPointer {
  statusListCredential?: string;
  statusListIndex?: string | number;
  credentialId?: string;
  statusPurpose?: string;
}

export interface SdJwtPayloadHint {
  credentialStatus?: StatusListPointer | Record<string, any>;
  credentialId?: string;
  credentialType?: string | string[];
}



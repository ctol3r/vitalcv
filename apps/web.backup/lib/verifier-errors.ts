/**
 * Verifier Error Messages
 * Catalog of error codes and messages for the verifier API
 */

export type VerifierErrorCode =
  | 'INVALID_CREDENTIAL'
  | 'EXPIRED_CREDENTIAL'
  | 'REVOKED_CREDENTIAL'
  | 'INVALID_SIGNATURE'
  | 'INVALID_PROOF'
  | 'MISSING_REQUIRED_CLAIM'
  | 'NETWORK_ERROR'
  | 'UNKNOWN_ERROR';

export const VERIFIER_ERROR_MESSAGES: Record<
  VerifierErrorCode,
  { title: string; description: string; code: string }
> = {
  INVALID_CREDENTIAL: {
    title: 'Invalid Credential',
    description: 'The credential format is invalid or malformed',
    code: 'E_VERIF_001',
  },
  EXPIRED_CREDENTIAL: {
    title: 'Expired Credential',
    description: 'The credential has passed its expiration date',
    code: 'E_VERIF_002',
  },
  REVOKED_CREDENTIAL: {
    title: 'Revoked Credential',
    description: 'The credential has been revoked by the issuer',
    code: 'E_VERIF_003',
  },
  INVALID_SIGNATURE: {
    title: 'Invalid Signature',
    description: 'The cryptographic signature verification failed',
    code: 'E_VERIF_004',
  },
  INVALID_PROOF: {
    title: 'Invalid Proof',
    description: 'The zero-knowledge proof validation failed',
    code: 'E_VERIF_005',
  },
  MISSING_REQUIRED_CLAIM: {
    title: 'Missing Required Claim',
    description: 'One or more required claims are missing from the credential',
    code: 'E_VERIF_006',
  },
  NETWORK_ERROR: {
    title: 'Network Error',
    description: 'Failed to connect to verification service',
    code: 'E_VERIF_007',
  },
  UNKNOWN_ERROR: {
    title: 'Unknown Error',
    description: 'An unexpected error occurred during verification',
    code: 'E_VERIF_999',
  },
};






















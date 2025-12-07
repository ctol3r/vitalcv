/**
 * Verifier Error Code Mappings
 * Task: 1105-frontend-0003
 *
 * Maps backend verification error codes to user-friendly messages and CTAs
 */

export type VerificationErrorCode =
  | 'EXPIRED'
  | 'REVOKED'
  | 'UNTRUSTED_ISSUER'
  | 'DISCLOSURE_MISMATCH'
  | 'INVALID_SIGNATURE'
  | 'INVALID_PROOF'
  | 'NETWORK_ERROR'
  | 'UNKNOWN_ERROR';

export interface VerificationError {
  code: VerificationErrorCode;
  title: string;
  message: string;
  cta?: {
    label: string;
    action: 'contact_issuer' | 'retry' | 'learn_more' | 'close' | 'request_new';
    url?: string;
  };
  severity: 'error' | 'warning' | 'info';
  recoverable: boolean;
}

/**
 * Error code to user-facing message mappings
 */
export const VERIFIER_ERROR_MAPPINGS: Record<VerificationErrorCode, VerificationError> = {
  EXPIRED: {
    code: 'EXPIRED',
    title: 'Credential Expired',
    message:
      'This credential has expired and is no longer valid. Contact the issuer to request a renewed credential.',
    cta: {
      label: 'Request Renewal',
      action: 'request_new',
    },
    severity: 'error',
    recoverable: true,
  },

  REVOKED: {
    code: 'REVOKED',
    title: 'Credential Revoked',
    message:
      'This credential has been revoked by the issuer and is no longer trustworthy. Please verify directly with the issuer if this is unexpected.',
    cta: {
      label: 'Contact Issuer',
      action: 'contact_issuer',
    },
    severity: 'error',
    recoverable: false,
  },

  UNTRUSTED_ISSUER: {
    code: 'UNTRUSTED_ISSUER',
    title: 'Untrusted Issuer',
    message:
      'The issuer of this credential is not in your trusted list. Verify the issuer identity before accepting this credential.',
    cta: {
      label: 'Learn About Trust',
      action: 'learn_more',
      url: '/developers#trust-registry',
    },
    severity: 'warning',
    recoverable: true,
  },

  DISCLOSURE_MISMATCH: {
    code: 'DISCLOSURE_MISMATCH',
    title: 'Disclosure Verification Failed',
    message:
      'The selective disclosure in this credential could not be verified. The credential may have been tampered with.',
    cta: {
      label: 'Learn More',
      action: 'learn_more',
      url: '/developers#sd-jwt',
    },
    severity: 'error',
    recoverable: false,
  },

  INVALID_SIGNATURE: {
    code: 'INVALID_SIGNATURE',
    title: 'Invalid Signature',
    message:
      'The cryptographic signature on this credential is invalid. This credential may have been tampered with or corrupted.',
    cta: {
      label: 'Contact Issuer',
      action: 'contact_issuer',
    },
    severity: 'error',
    recoverable: false,
  },

  INVALID_PROOF: {
    code: 'INVALID_PROOF',
    title: 'Invalid Proof',
    message:
      'The cryptographic proof attached to this credential could not be verified. The credential may be invalid or corrupted.',
    cta: {
      label: 'Retry Verification',
      action: 'retry',
    },
    severity: 'error',
    recoverable: true,
  },

  NETWORK_ERROR: {
    code: 'NETWORK_ERROR',
    title: 'Network Error',
    message:
      'Could not connect to the verification service. Check your internet connection and try again.',
    cta: {
      label: 'Retry',
      action: 'retry',
    },
    severity: 'warning',
    recoverable: true,
  },

  UNKNOWN_ERROR: {
    code: 'UNKNOWN_ERROR',
    title: 'Verification Failed',
    message: 'An unexpected error occurred during verification. Please try again or contact support.',
    cta: {
      label: 'Retry',
      action: 'retry',
    },
    severity: 'error',
    recoverable: true,
  },
};

/**
 * Map backend error code/message to structured error
 */
export function mapVerificationError(
  errorCode?: string,
  errorMessage?: string
): VerificationError {
  // Try to find exact code match
  const normalizedCode = errorCode?.toUpperCase().replace(/[_-]/g, '_');

  if (normalizedCode && normalizedCode in VERIFIER_ERROR_MAPPINGS) {
    return VERIFIER_ERROR_MAPPINGS[normalizedCode as VerificationErrorCode];
  }

  // Try pattern matching on error message
  if (errorMessage) {
    const msg = errorMessage.toLowerCase();

    if (msg.includes('expired') || msg.includes('expir')) {
      return VERIFIER_ERROR_MAPPINGS.EXPIRED;
    }
    if (msg.includes('revoked') || msg.includes('revok')) {
      return VERIFIER_ERROR_MAPPINGS.REVOKED;
    }
    if (msg.includes('untrusted') || msg.includes('trust')) {
      return VERIFIER_ERROR_MAPPINGS.UNTRUSTED_ISSUER;
    }
    if (msg.includes('disclosure') || msg.includes('sd-jwt')) {
      return VERIFIER_ERROR_MAPPINGS.DISCLOSURE_MISMATCH;
    }
    if (msg.includes('signature')) {
      return VERIFIER_ERROR_MAPPINGS.INVALID_SIGNATURE;
    }
    if (msg.includes('proof')) {
      return VERIFIER_ERROR_MAPPINGS.INVALID_PROOF;
    }
    if (msg.includes('network') || msg.includes('connection')) {
      return VERIFIER_ERROR_MAPPINGS.NETWORK_ERROR;
    }
  }

  // Default to unknown error
  return {
    ...VERIFIER_ERROR_MAPPINGS.UNKNOWN_ERROR,
    message: errorMessage || VERIFIER_ERROR_MAPPINGS.UNKNOWN_ERROR.message,
  };
}

/**
 * Get user-friendly description for verification status
 */
export function getVerificationStatusDescription(
  status: 'valid' | 'invalid' | 'warning' | 'pending'
): string {
  switch (status) {
    case 'valid':
      return 'This credential has been successfully verified and is trustworthy.';
    case 'invalid':
      return 'This credential failed verification and should not be trusted.';
    case 'warning':
      return 'This credential passed basic checks but has some concerns. Review details carefully.';
    case 'pending':
      return 'Verification is in progress. Please wait...';
    default:
      return 'Unknown verification status.';
  }
}

/**
 * Determine if error allows retry
 */
export function canRetryVerification(error: VerificationError): boolean {
  return error.recoverable && error.cta?.action === 'retry';
}

/**
 * Get icon name for error severity (for UI rendering)
 */
export function getErrorIcon(severity: VerificationError['severity']): string {
  switch (severity) {
    case 'error':
      return 'XCircle';
    case 'warning':
      return 'AlertTriangle';
    case 'info':
      return 'Info';
    default:
      return 'AlertCircle';
  }
}


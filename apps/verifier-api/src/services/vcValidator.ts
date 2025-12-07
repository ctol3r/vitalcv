/**
 * VC Expiry & Status Check in Verifier
 *
 * S72-STRETCH-A-006: VC expiry & status check in verifier (exp, notBefore, revoked flag)
 * Verifier checks exp/notBefore/optional status endpoint
 * Responds with reason codes (expired, not_yet_valid, revoked) in JSON
 */

import { decodeJwt } from 'jose';

/**
 * VC validation result
 */
export interface VCValidationResult {
  valid: boolean;
  reason?: 'expired' | 'not_yet_valid' | 'revoked' | 'valid';
  details?: {
    exp?: number;
    notBefore?: number;
    revoked?: boolean;
    statusEndpoint?: string;
    statusCheckResult?: any;
  };
  error?: string;
}

/**
 * Status check result
 */
export interface StatusCheckResult {
  revoked: boolean;
  reason?: string;
}

/**
 * Check VC expiry and notBefore claims
 * S72-STRETCH-A-006: Checks exp/notBefore
 */
function checkVCTemporalClaims(decoded: any): { valid: boolean; reason?: 'expired' | 'not_yet_valid' } {
  const now = Math.floor(Date.now() / 1000);

  // Check exp (expiration)
  if (decoded.exp) {
    if (decoded.exp < now) {
      return {
        valid: false,
        reason: 'expired',
      };
    }
  }

  // Check nbf (not before)
  if (decoded.nbf) {
    if (decoded.nbf > now) {
      return {
        valid: false,
        reason: 'not_yet_valid',
      };
    }
  }

  return { valid: true };
}

/**
 * Check VC status endpoint (optional)
 * S72-STRETCH-A-006: Optional status endpoint check
 */
async function checkVCStatus(
  vcId: string,
  statusEndpoint?: string
): Promise<StatusCheckResult | null> {
  if (!statusEndpoint) {
    return null; // Status check is optional
  }

  try {
    // Extract credential ID from VC
    const response = await fetch(`${statusEndpoint}?credential_id=${encodeURIComponent(vcId)}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      // Status endpoint unavailable - treat as non-revoked
      return null;
    }

    const data = await response.json();
    return {
      revoked: data.revoked === true,
      reason: data.reason,
    };
  } catch (error) {
    // Status check failed - treat as non-revoked (fail open)
    console.warn('[VCValidator] Status check failed:', error);
    return null;
  }
}

/**
 * Extract status endpoint from VC
 */
function extractStatusEndpoint(vc: any): string | undefined {
  // Check credentialStatus field
  if (vc.credentialStatus) {
    if (typeof vc.credentialStatus === 'string') {
      return vc.credentialStatus;
    }
    if (vc.credentialStatus.id) {
      return vc.credentialStatus.id;
    }
  }

  // Check status field
  if (vc.status) {
    if (typeof vc.status === 'string') {
      return vc.status;
    }
    if (vc.status.id) {
      return vc.status.id;
    }
  }

  return undefined;
}

/**
 * Extract VC ID
 */
function extractVCId(vc: any): string {
  // Try id field
  if (vc.id) {
    return vc.id;
  }

  // Try jti
  if (vc.jti) {
    return vc.jti;
  }

  // Fallback: generate from hash
  return `vc-${Date.now()}`;
}

/**
 * Validate VC expiry and status
 * S72-STRETCH-A-006: Verifier checks exp/notBefore/optional status endpoint
 */
export async function validateVC(
  vcToken: string,
  options?: {
    statusEndpoint?: string;
    checkStatus?: boolean;
  }
): Promise<VCValidationResult> {
  try {
    // Decode VC token
    let decoded: any;
    let vc: any;

    try {
      decoded = decodeJwt(vcToken);
      vc = decoded.vc || decoded;
    } catch {
      // Not a JWT, try parsing as JSON
      vc = typeof vcToken === 'string' ? JSON.parse(vcToken) : vcToken;
      decoded = vc;
    }

    // S72-STRETCH-A-006: Check exp/notBefore
    const temporalCheck = checkVCTemporalClaims(decoded);
    if (!temporalCheck.valid) {
      return {
        valid: false,
        reason: temporalCheck.reason,
        details: {
          exp: decoded.exp,
          notBefore: decoded.nbf,
        },
      };
    }

    // S72-STRETCH-A-006: Optional status endpoint check
    const statusEndpoint = options?.statusEndpoint || extractStatusEndpoint(vc);
    let statusCheck: StatusCheckResult | null = null;

    if (options?.checkStatus !== false && statusEndpoint) {
      const vcId = extractVCId(vc);
      statusCheck = await checkVCStatus(vcId, statusEndpoint);
    }

    if (statusCheck?.revoked) {
      return {
        valid: false,
        reason: 'revoked',
        details: {
          revoked: true,
          statusEndpoint,
          statusCheckResult: statusCheck,
        },
      };
    }

    // S72-STRETCH-A-006: Valid VC
    return {
      valid: true,
      reason: 'valid',
      details: {
        exp: decoded.exp,
        notBefore: decoded.nbf,
        revoked: false,
        ...(statusEndpoint && { statusEndpoint }),
        ...(statusCheck && { statusCheckResult: statusCheck }),
      },
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'VC validation error',
    };
  }
}

/**
 * Validate multiple VCs
 */
export async function validateVCs(
  vcTokens: string[],
  options?: {
    statusEndpoint?: string;
    checkStatus?: boolean;
  }
): Promise<VCValidationResult[]> {
  const results = await Promise.all(
    vcTokens.map((vc) => validateVC(vc, options))
  );
  return results;
}

/**
 * Format validation result as JSON response
 * S72-STRETCH-A-006: Responds with reason codes in JSON
 */
export function formatValidationResponse(result: VCValidationResult): any {
  return {
    valid: result.valid,
    reason: result.reason,
    ...(result.details && { details: result.details }),
    ...(result.error && { error: result.error }),
  };
}

export default {
  validateVC,
  validateVCs,
  formatValidationResponse,
};


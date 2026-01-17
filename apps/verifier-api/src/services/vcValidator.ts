/**
 * VC Expiry & Status Check in Verifier
 *
 * S72-STRETCH-A-006: VC expiry & status check in verifier (exp, notBefore, revoked flag)
 * Verifier checks exp/notBefore/optional status endpoint
 * Responds with reason codes (expired, not_yet_valid, revoked, uncheckable) in JSON
 */

import { decodeJwt } from 'jose';
import { resolveCredentialStatus, CredentialStatusResolution } from './statusListResolver';

/**
 * VC validation result
 */
export interface VCValidationResult {
  valid: boolean;
  reason?: 'expired' | 'not_yet_valid' | 'revoked' | 'uncheckable' | 'valid';
  details?: {
    exp?: number;
    notBefore?: number;
    revoked?: boolean;
    statusEndpoint?: string;
    statusCheckResult?: StatusCheckResult;
  };
  error?: string;
}

/**
 * Status check result
 */
export interface StatusCheckResult {
  status: 'active' | 'revoked' | 'uncheckable';
  reason?: string;
  statusUrl?: string;
  listId?: string;
  index?: number;
  listUrl?: string;
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

function mapStatusResult(result: CredentialStatusResolution): StatusCheckResult {
  return {
    status: result.status,
    reason: result.reason,
    statusUrl: result.statusUrl,
    listId: result.listId,
    index: result.index,
    listUrl: result.listUrl,
  };
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

    // S72-STRETCH-A-006: Status list check (fail closed)
    const statusEndpoint = options?.statusEndpoint;
    let statusCheck: StatusCheckResult | null = null;

    if (options?.checkStatus !== false) {
      const resolution = await resolveCredentialStatus(vc as Record<string, unknown>, statusEndpoint);
      statusCheck = mapStatusResult(resolution);

      if (resolution.status === 'revoked') {
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

      if (resolution.status === 'uncheckable') {
        return {
          valid: false,
          reason: 'uncheckable',
          details: {
            statusEndpoint,
            statusCheckResult: statusCheck,
          },
        };
      }
    }

    // S72-STRETCH-A-006: Valid VC
    return {
      valid: true,
      reason: 'valid',
      details: {
        exp: decoded.exp,
        notBefore: decoded.nbf,
        revoked: statusCheck?.status === 'revoked',
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

export default {
  validateVC,
  validateVCs,
};

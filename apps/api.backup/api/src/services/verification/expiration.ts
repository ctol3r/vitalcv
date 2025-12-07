/**
 * Credential Expiration Service
 * Tagged: cursor-batch-1101
 * Agent: CODEX • BACKEND • chai-vc-platform
 *
 * Enforces credential expiration with configurable grace periods
 */

export interface ExpirationPolicy {
  gracePeriodDays?: number; // Days after expiration still considered valid
  warningPeriodDays?: number; // Days before expiration to issue warnings
  strictMode?: boolean; // If true, grace period is not applied
}

export interface ExpirationResult {
  valid: boolean;
  expired: boolean;
  expiresAt?: Date;
  daysUntilExpiration?: number;
  inGracePeriod?: boolean;
  inWarningPeriod?: boolean;
  reason?: string;
  reasonCode?: string;
}

export const DEFAULT_POLICY: ExpirationPolicy = {
  gracePeriodDays: 30,
  warningPeriodDays: 90,
  strictMode: false,
};

/**
 * Check if a credential has expired
 */
export function checkExpiration(
  credential: {
    expirationDate?: string;
    validUntil?: string;
    exp?: number; // Unix timestamp
  },
  policy: ExpirationPolicy = DEFAULT_POLICY,
  currentTime: Date = new Date()
): ExpirationResult {
  // Determine expiration date from various field names
  let expiresAt: Date | null = null;

  if (credential.expirationDate) {
    expiresAt = new Date(credential.expirationDate);
  } else if (credential.validUntil) {
    expiresAt = new Date(credential.validUntil);
  } else if (credential.exp) {
    expiresAt = new Date(credential.exp * 1000); // Convert Unix to Date
  }

  // No expiration date = valid indefinitely
  if (!expiresAt) {
    return {
      valid: true,
      expired: false,
      reason: 'Credential does not expire',
      reasonCode: 'NO_EXPIRATION',
    };
  }

  // Check if expiration date is invalid
  if (isNaN(expiresAt.getTime())) {
    return {
      valid: false,
      expired: false,
      reason: 'Invalid expiration date format',
      reasonCode: 'INVALID_EXPIRATION_DATE',
    };
  }

  const msUntilExpiration = expiresAt.getTime() - currentTime.getTime();
  const daysUntilExpiration = msUntilExpiration / (1000 * 60 * 60 * 24);

  // Not yet expired (including exact match = still valid)
  if (daysUntilExpiration >= 0) {
    const inWarningPeriod =
      policy.warningPeriodDays !== undefined &&
      daysUntilExpiration <= policy.warningPeriodDays;

    return {
      valid: true,
      expired: false,
      expiresAt,
      daysUntilExpiration,
      inWarningPeriod,
      reason: inWarningPeriod
        ? `Credential expires in ${Math.ceil(daysUntilExpiration)} days`
        : 'Credential is valid',
      reasonCode: inWarningPeriod ? 'EXPIRING_SOON' : 'VALID',
    };
  }

  // Expired - check grace period
  const daysExpired = Math.abs(daysUntilExpiration);

  if (!policy.strictMode && policy.gracePeriodDays !== undefined) {
    const inGracePeriod = daysExpired <= policy.gracePeriodDays;

    if (inGracePeriod) {
      return {
        valid: true,
        expired: true,
        expiresAt,
        daysUntilExpiration,
        inGracePeriod: true,
        reason: `Credential expired ${Math.ceil(daysExpired)} days ago (within grace period)`,
        reasonCode: 'EXPIRED_GRACE_PERIOD',
      };
    }
  }

  // Expired beyond grace period
  return {
    valid: false,
    expired: true,
    expiresAt,
    daysUntilExpiration,
    reason: `Credential expired ${Math.ceil(daysExpired)} days ago`,
    reasonCode: 'EXPIRED',
  };
}

/**
 * Check expiration for a W3C Verifiable Credential
 */
export function checkVCExpiration(
  vc: {
    expirationDate?: string;
    credentialSubject?: {
      expirationDate?: string;
      validUntil?: string;
    };
  },
  policy: ExpirationPolicy = DEFAULT_POLICY
): ExpirationResult {
  // Check VC-level expiration first
  if (vc.expirationDate) {
    return checkExpiration({ expirationDate: vc.expirationDate }, policy);
  }

  // Check credentialSubject expiration
  if (vc.credentialSubject?.expirationDate) {
    return checkExpiration(
      { expirationDate: vc.credentialSubject.expirationDate },
      policy
    );
  }

  if (vc.credentialSubject?.validUntil) {
    return checkExpiration(
      { validUntil: vc.credentialSubject.validUntil },
      policy
    );
  }

  return {
    valid: true,
    expired: false,
    reason: 'Credential does not expire',
    reasonCode: 'NO_EXPIRATION',
  };
}

/**
 * Batch check multiple credentials for expiration
 */
export function checkBatchExpiration(
  credentials: Array<{
    id: string;
    expirationDate?: string;
    validUntil?: string;
  }>,
  policy: ExpirationPolicy = DEFAULT_POLICY
): Map<string, ExpirationResult> {
  const results = new Map<string, ExpirationResult>();

  for (const credential of credentials) {
    const result = checkExpiration(credential, policy);
    results.set(credential.id, result);
  }

  return results;
}

/**
 * Get credentials expiring soon
 */
export function getExpiringCredentials(
  credentials: Array<{
    id: string;
    expirationDate?: string;
    validUntil?: string;
  }>,
  withinDays: number = 90
): Array<{
  id: string;
  daysUntilExpiration: number;
  expiresAt: Date;
}> {
  const expiring: Array<{
    id: string;
    daysUntilExpiration: number;
    expiresAt: Date;
  }> = [];

  for (const credential of credentials) {
    const result = checkExpiration(credential, { warningPeriodDays: withinDays });

    if (
      result.inWarningPeriod &&
      result.daysUntilExpiration !== undefined &&
      result.expiresAt
    ) {
      expiring.push({
        id: credential.id,
        daysUntilExpiration: result.daysUntilExpiration,
        expiresAt: result.expiresAt,
      });
    }
  }

  // Sort by days until expiration (soonest first)
  return expiring.sort((a, b) => a.daysUntilExpiration - b.daysUntilExpiration);
}

/**
 * Get credentials that have expired
 */
export function getExpiredCredentials(
  credentials: Array<{
    id: string;
    expirationDate?: string;
    validUntil?: string;
  }>,
  excludeGracePeriod: boolean = false
): Array<{
  id: string;
  expiresAt: Date;
  daysExpired: number;
}> {
  const expired: Array<{
    id: string;
    expiresAt: Date;
    daysExpired: number;
  }> = [];

  const policy = excludeGracePeriod
    ? { ...DEFAULT_POLICY, gracePeriodDays: 0, strictMode: true }
    : DEFAULT_POLICY;

  for (const credential of credentials) {
    const result = checkExpiration(credential, policy);

    if (result.expired && !result.valid && result.expiresAt) {
      const daysExpired = Math.abs(result.daysUntilExpiration || 0);
      expired.push({
        id: credential.id,
        expiresAt: result.expiresAt,
        daysExpired,
      });
    }
  }

  // Sort by days expired (most recent first)
  return expired.sort((a, b) => a.daysExpired - b.daysExpired);
}

/**
 * Create a detailed expiration report
 */
export function createExpirationReport(
  credentials: Array<{
    id: string;
    type?: string;
    expirationDate?: string;
    validUntil?: string;
  }>,
  policy: ExpirationPolicy = DEFAULT_POLICY
) {
  const results = checkBatchExpiration(credentials, policy);

  let valid = 0;
  let expiringSoon = 0;
  let inGracePeriod = 0;
  let expired = 0;
  let noExpiration = 0;

  for (const result of results.values()) {
    if (result.reasonCode === 'NO_EXPIRATION') {
      noExpiration++;
    } else if (result.expired && !result.valid) {
      expired++;
    } else if (result.inGracePeriod) {
      inGracePeriod++;
    } else if (result.inWarningPeriod) {
      expiringSoon++;
    } else if (result.valid) {
      valid++;
    }
  }

  return {
    total: credentials.length,
    valid,
    expiringSoon,
    inGracePeriod,
    expired,
    noExpiration,
    policy,
    timestamp: new Date().toISOString(),
  };
}

export default {
  checkExpiration,
  checkVCExpiration,
  checkBatchExpiration,
  getExpiringCredentials,
  getExpiredCredentials,
  createExpirationReport,
  DEFAULT_POLICY,
};


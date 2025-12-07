/**
 * B128A-AAL-016: Admin AAL2/AAL3 guard
 * Enforces phishing-resistant and device-bound factors for admin access
 */

import { Request, Response, NextFunction } from 'express';

export type AuthenticationAssuranceLevel = 'AAL1' | 'AAL2' | 'AAL3';

export interface AuthenticationFactor {
  type: 'password' | 'otp' | 'webauthn' | 'fido2' | 'hardware_token' | 'biometric';
  isPhishingResistant: boolean;
  isDeviceBound: boolean;
  usedAt: string;
  deviceId?: string;
}

export interface AuthenticationContext {
  userId: string;
  factors: AuthenticationFactor[];
  aal: AuthenticationAssuranceLevel;
  sessionId: string;
  authenticatedAt: string;
}

/**
 * B128A-AAL-016: Determine AAL based on authentication factors
 */
export function determineAAL(factors: AuthenticationFactor[]): AuthenticationAssuranceLevel {
  if (factors.length === 0) {
    return 'AAL1';
  }

  // B128A-AAL-016: AAL3 requires hardware-bound, phishing-resistant factors
  const hasPhishingResistant = factors.some(f => f.isPhishingResistant);
  const hasDeviceBound = factors.some(f => f.isDeviceBound);

  if (hasPhishingResistant && hasDeviceBound) {
    // Check if we have multiple factors for AAL3
    if (factors.length >= 2) {
      return 'AAL3';
    }
    // Single phishing-resistant + device-bound factor = AAL2
    return 'AAL2';
  }

  // B128A-AAL-016: AAL2 requires phishing-resistant factors
  if (hasPhishingResistant) {
    return 'AAL2';
  }

  // Default: password or basic factors
  return 'AAL1';
}

/**
 * B128A-AAL-016: Check if factor is phishing-resistant
 */
export function isPhishingResistant(factor: AuthenticationFactor): boolean {
  // B128A-AAL-016: Phishing-resistant factors include WebAuthn, FIDO2, hardware tokens
  const phishingResistantTypes = ['webauthn', 'fido2', 'hardware_token'];
  return phishingResistantTypes.includes(factor.type);
}

/**
 * B128A-AAL-016: Check if factor is device-bound
 */
export function isDeviceBound(factor: AuthenticationFactor): boolean {
  // B128A-AAL-016: Device-bound factors include WebAuthn, FIDO2, hardware tokens, biometric
  const deviceBoundTypes = ['webauthn', 'fido2', 'hardware_token', 'biometric'];
  return deviceBoundTypes.includes(factor.type) && !!factor.deviceId;
}

/**
 * B128A-AAL-016: Validate AAL requirements for admin operations
 */
export function validateAALRequirements(
  requiredAAL: AuthenticationAssuranceLevel,
  actualAAL: AuthenticationAssuranceLevel
): { valid: boolean; error?: string } {
  const aalLevels = { AAL1: 1, AAL2: 2, AAL3: 3 };

  const required = aalLevels[requiredAAL];
  const actual = aalLevels[actualAAL];

  if (actual < required) {
    return {
      valid: false,
      error: `Insufficient authentication level: ${actualAAL} (required: ${requiredAAL})`,
    };
  }

  return { valid: true };
}

/**
 * B128A-AAL-016: AAL guard middleware factory
 * Creates middleware that enforces a minimum AAL
 */
export function createAALGuard(requiredAAL: AuthenticationAssuranceLevel) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authContext = (req as any).authContext as AuthenticationContext | undefined;

    if (!authContext) {
      return res.status(401).json({
        error: 'unauthenticated',
        error_description: 'Authentication required',
      });
    }

    // B128A-AAL-016: Validate AAL requirements
    const validation = validateAALRequirements(requiredAAL, authContext.aal);

    if (!validation.valid) {
      // B128A-AAL-016: AAL2 rejects weak factors; AAL3 requires HW-bound
      const message = requiredAAL === 'AAL2'
        ? 'AAL2 required: Use phishing-resistant authentication (WebAuthn, FIDO2, or hardware token)'
        : requiredAAL === 'AAL3'
        ? 'AAL3 required: Use hardware-bound, phishing-resistant authentication with multiple factors'
        : validation.error;

      return res.status(403).json({
        error: 'insufficient_aal',
        error_description: message,
        required_aal: requiredAAL,
        current_aal: authContext.aal,
        upgrade_hint: getUpgradeHint(authContext.aal, requiredAAL),
      });
    }

    // AAL requirements met
    next();
  };
}

/**
 * Get hint for upgrading AAL
 */
function getUpgradeHint(currentAAL: AuthenticationAssuranceLevel, requiredAAL: AuthenticationAssuranceLevel): string {
  if (currentAAL === 'AAL1' && requiredAAL === 'AAL2') {
    return 'Register a WebAuthn/FIDO2 security key or use a hardware token';
  }

  if (currentAAL === 'AAL1' && requiredAAL === 'AAL3') {
    return 'Register a hardware-bound security key and enable multi-factor authentication';
  }

  if (currentAAL === 'AAL2' && requiredAAL === 'AAL3') {
    return 'Enable multi-factor authentication with hardware-bound factors';
  }

  return 'Upgrade your authentication method to meet the required assurance level';
}

/**
 * B128A-AAL-016: Mock authentication context for testing
 * In production, this would be populated by actual authentication middleware
 */
export function createMockAuthContext(
  userId: string,
  factors: AuthenticationFactor[]
): AuthenticationContext {
  const aal = determineAAL(factors);

  return {
    userId,
    factors,
    aal,
    sessionId: `session-${Date.now()}`,
    authenticatedAt: new Date().toISOString(),
  };
}

/**
 * B128A-AAL-016: Audit authentication events
 */
export function auditAuthenticationEvent(
  event: 'AUTH_SUCCESS' | 'AUTH_FAILURE' | 'AAL_REJECTED' | 'AAL_UPGRADE',
  authContext: AuthenticationContext,
  details: Record<string, any>
): void {
  const auditEntry = {
    timestamp: new Date().toISOString(),
    event,
    userId: authContext.userId,
    aal: authContext.aal,
    factors: authContext.factors.map(f => ({
      type: f.type,
      isPhishingResistant: f.isPhishingResistant,
      isDeviceBound: f.isDeviceBound,
    })),
    ...details,
  };

  console.info('[AUDIT] AAL Guard:', JSON.stringify(auditEntry));

  // TODO: In production, persist to database
  // await prisma.auditEvent.create({ data: auditEntry });
}

// Pre-configured guards for common admin operations
export const aalGuards = {
  /**
   * AAL1: Basic authentication (password only)
   * For read-only or low-risk operations
   */
  aal1: createAALGuard('AAL1'),

  /**
   * B128A-AAL-016: AAL2: Phishing-resistant authentication
   * For moderate-risk admin operations
   */
  aal2: createAALGuard('AAL2'),

  /**
   * B128A-AAL-016: AAL3: Hardware-bound + multi-factor
   * For high-risk admin operations (user management, config changes)
   */
  aal3: createAALGuard('AAL3'),
};

export default aalGuards;


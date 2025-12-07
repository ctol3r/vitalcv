/**
 * B127A-AAL-016: Admin AAL2/AAL3 guard
 *
 * Features:
 * - AAL2: Phishing-resistant authentication
 * - AAL3: Device-bound, hardware-backed factors
 * - Tests for weak factor rejection
 */

import { Request, Response, NextFunction } from 'express';

/**
 * NIST 800-63B Authenticator Assurance Levels
 */
export enum AAL {
  AAL1 = 'AAL1', // Single-factor (password, etc.)
  AAL2 = 'AAL2', // Multi-factor, phishing-resistant
  AAL3 = 'AAL3', // Multi-factor, hardware-backed, device-bound
}

/**
 * Authentication factor types
 */
export type FactorType =
  | 'password'
  | 'totp' // Time-based one-time password (Google Authenticator, etc.)
  | 'sms' // SMS OTP
  | 'email' // Email OTP
  | 'webauthn' // WebAuthn (FIDO2, platform authenticator)
  | 'hardware_token' // Hardware security key (YubiKey, etc.)
  | 'biometric'; // Biometric (Touch ID, Face ID)

/**
 * Authentication factor properties
 */
export interface AuthFactor {
  type: FactorType;
  phishingResistant: boolean;
  deviceBound: boolean;
  hardwareBacked: boolean;
  verifiedAt: Date;
}

/**
 * Factor classification
 */
const FACTOR_PROPERTIES: Record<FactorType, Omit<AuthFactor, 'verifiedAt'>> = {
  password: {
    type: 'password',
    phishingResistant: false,
    deviceBound: false,
    hardwareBacked: false,
  },
  totp: {
    type: 'totp',
    phishingResistant: false, // Can be phished via man-in-the-middle
    deviceBound: true, // Tied to device with secret
    hardwareBacked: false, // Usually software-based
  },
  sms: {
    type: 'sms',
    phishingResistant: false, // Vulnerable to SIM swap, interception
    deviceBound: true, // Tied to phone number
    hardwareBacked: false,
  },
  email: {
    type: 'email',
    phishingResistant: false, // Email can be compromised
    deviceBound: false,
    hardwareBacked: false,
  },
  webauthn: {
    type: 'webauthn',
    phishingResistant: true, // FIDO2 is phishing-resistant (origin-bound)
    deviceBound: true, // Credential tied to device
    hardwareBacked: true, // Can use platform authenticator (TPM, Secure Enclave)
  },
  hardware_token: {
    type: 'hardware_token',
    phishingResistant: true, // Hardware tokens (YubiKey) are phishing-resistant
    deviceBound: true, // Physical device
    hardwareBacked: true, // Hardware-based cryptography
  },
  biometric: {
    type: 'biometric',
    phishingResistant: true, // When combined with platform authenticator
    deviceBound: true, // Tied to device hardware
    hardwareBacked: true, // Secure Enclave, TPM
  },
};

/**
 * Determine AAL level from authentication factors
 * B127A-AAL-016: AAL2 requires phishing-resistant; AAL3 requires hardware-bound
 */
export function determineAAL(factors: AuthFactor[]): AAL {
  if (factors.length === 0) {
    throw new Error('No authentication factors provided');
  }

  // AAL3: Requires hardware-backed AND device-bound factors
  const hasHardwareBacked = factors.some(f => f.hardwareBacked && f.deviceBound);
  if (hasHardwareBacked) {
    // Also require at least 2 factors for AAL3
    if (factors.length >= 2) {
      return AAL.AAL3;
    }
  }

  // AAL2: Requires phishing-resistant factors and at least 2 factors
  const hasPhishingResistant = factors.some(f => f.phishingResistant);
  if (hasPhishingResistant && factors.length >= 2) {
    return AAL.AAL2;
  }

  // AAL1: Single factor or weak multi-factor
  return AAL.AAL1;
}

/**
 * Validate factors meet minimum AAL requirement
 */
export function validateAAL(
  factors: AuthFactor[],
  requiredAAL: AAL
): {
  valid: boolean;
  actualAAL: AAL;
  error?: string;
} {
  const actualAAL = determineAAL(factors);

  // Compare AAL levels
  const aalLevels: Record<AAL, number> = {
    [AAL.AAL1]: 1,
    [AAL.AAL2]: 2,
    [AAL.AAL3]: 3,
  };

  const actualLevel = aalLevels[actualAAL];
  const requiredLevel = aalLevels[requiredAAL];

  if (actualLevel < requiredLevel) {
    return {
      valid: false,
      actualAAL,
      error: `Authentication does not meet ${requiredAAL} requirements. Current level: ${actualAAL}`,
    };
  }

  return {
    valid: true,
    actualAAL,
  };
}

/**
 * Extract authentication factors from request
 */
function extractFactorsFromRequest(req: Request): AuthFactor[] {
  const factors: AuthFactor[] = [];

  // Check for password authentication (from session or header)
  if (req.headers['x-password-verified'] === 'true') {
    factors.push({
      ...FACTOR_PROPERTIES.password,
      verifiedAt: new Date(),
    });
  }

  // Check for TOTP
  if (req.headers['x-totp-verified'] === 'true') {
    factors.push({
      ...FACTOR_PROPERTIES.totp,
      verifiedAt: new Date(),
    });
  }

  // Check for WebAuthn (preferred for admin access)
  if (req.headers['x-webauthn-verified'] === 'true') {
    factors.push({
      ...FACTOR_PROPERTIES.webauthn,
      verifiedAt: new Date(),
    });
  }

  // Check for hardware token
  if (req.headers['x-hardware-token-verified'] === 'true') {
    factors.push({
      ...FACTOR_PROPERTIES.hardware_token,
      verifiedAt: new Date(),
    });
  }

  // Check for biometric
  if (req.headers['x-biometric-verified'] === 'true') {
    factors.push({
      ...FACTOR_PROPERTIES.biometric,
      verifiedAt: new Date(),
    });
  }

  return factors;
}

/**
 * AAL Guard Middleware
 * B127A-AAL-016: AAL2 rejects weak factors; AAL3 requires HW-bound
 */
export function aalGuard(requiredAAL: AAL) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Extract factors from request
    const factors = extractFactorsFromRequest(req);

    if (factors.length === 0) {
      return res.status(401).json({
        error: 'authentication_required',
        error_description: 'No authentication factors found',
        required_aal: requiredAAL,
      });
    }

    // Validate AAL
    const validation = validateAAL(factors, requiredAAL);

    if (!validation.valid) {
      return res.status(403).json({
        error: 'insufficient_authentication_level',
        error_description: validation.error,
        required_aal: requiredAAL,
        actual_aal: validation.actualAAL,
        factors_used: factors.map(f => f.type),
      });
    }

    // AAL validated - attach to request
    (req as any).aal = validation.actualAAL;
    (req as any).authFactors = factors;

    next();
  };
}

/**
 * AAL2 Guard (Phishing-resistant)
 * B127A-AAL-016: AAL2 requires phishing-resistant factors
 */
export const aal2Guard = aalGuard(AAL.AAL2);

/**
 * AAL3 Guard (Hardware-backed)
 * B127A-AAL-016: AAL3 requires hardware-bound factors
 */
export const aal3Guard = aalGuard(AAL.AAL3);

/**
 * Get authentication recommendations for achieving target AAL
 */
export function getAALRecommendations(
  currentFactors: AuthFactor[],
  targetAAL: AAL
): {
  currentAAL: AAL;
  targetAAL: AAL;
  meetsRequirement: boolean;
  recommendations: string[];
} {
  const currentAAL = determineAAL(currentFactors);
  const validation = validateAAL(currentFactors, targetAAL);

  if (validation.valid) {
    return {
      currentAAL,
      targetAAL,
      meetsRequirement: true,
      recommendations: [],
    };
  }

  const recommendations: string[] = [];

  if (targetAAL === AAL.AAL2) {
    if (!currentFactors.some(f => f.phishingResistant)) {
      recommendations.push('Add a phishing-resistant factor (WebAuthn, Hardware Token, or Biometric)');
    }
    if (currentFactors.length < 2) {
      recommendations.push('Use at least 2 authentication factors');
    }
  }

  if (targetAAL === AAL.AAL3) {
    if (!currentFactors.some(f => f.hardwareBacked && f.deviceBound)) {
      recommendations.push('Add a hardware-backed, device-bound factor (WebAuthn with platform authenticator, Hardware Token, or Biometric)');
    }
    if (currentFactors.length < 2) {
      recommendations.push('Use at least 2 authentication factors');
    }
    recommendations.push('Ensure all factors are phishing-resistant and hardware-backed');
  }

  return {
    currentAAL,
    targetAAL,
    meetsRequirement: false,
    recommendations,
  };
}


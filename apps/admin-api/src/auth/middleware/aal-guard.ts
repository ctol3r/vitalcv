/**
 * B108A-AAL-016: Admin AAL2/AAL3 route-guard middleware (WebAuthn/device-bound)
 *
 * Enforces Authentication Assurance Level requirements
 * before allowing access to protected routes.
 *
 * Acceptance criteria:
 * - AAL2 requires phishing-resistant authenticator
 * - AAL3 requires device-bound authenticator
 * - Tests for AAL2/AAL3 enforcement
 */

import { Request, Response, NextFunction } from 'express';
import { checkUserAalCompliance } from '../aal-policy';
import { AuthenticatedRequest } from './types';

/**
 * Require minimum AAL level
 */
export function requireAal(minAal: 1 | 2 | 3) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest;

    if (!authReq.user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    }

    try {
      const status = await checkUserAalCompliance(
        authReq.user.id.toString(),
        authReq.user.roles
      );

      if (!status.meetsRequirement || status.currentAal < minAal) {
        return res.status(403).json({
          error: 'Insufficient authentication assurance level',
          code: 'AAL_INSUFFICIENT',
          required: minAal,
          current: status.currentAal,
          status,
        });
      }

      // Attach AAL status to request for downstream use
      authReq.aalStatus = status;
      next();
    } catch (error: any) {
      console.error('AAL check error:', error);
      return res.status(500).json({
        error: 'Failed to verify authentication assurance level',
        code: 'AAL_CHECK_ERROR',
      });
    }
  };
}

/**
 * B108A-AAL-016: Require phishing-resistant authentication (AAL2+ with phishing-resistant authenticator)
 * AAL2 requires phishing-resistant authenticator per NIST SP 800-63B
 */
export function requirePhishingResistant() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest;

    if (!authReq.user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    }

    try {
      const status = await checkUserAalCompliance(
        authReq.user.id.toString(),
        authReq.user.roles
      );

      // B108A-AAL-016: AAL2 requires phishing-resistant authenticator
      const hasPhishingResistant = status.authenticators.some(
        (auth) => auth.phishingResistant
      );

      if (!hasPhishingResistant || status.currentAal < 2) {
        return res.status(403).json({
          error: 'Phishing-resistant authentication required (AAL2)',
          code: 'PHISHING_RESISTANT_REQUIRED',
          required_aal: 2,
          current_aal: status.currentAal,
          status,
          hint: 'AAL2 requires a phishing-resistant authenticator (e.g., WebAuthn passkey)',
        });
      }

      authReq.aalStatus = status;
      next();
    } catch (error: any) {
      console.error('Phishing-resistant check error:', error);
      return res.status(500).json({
        error: 'Failed to verify phishing-resistant authentication',
        code: 'PHISHING_RESISTANT_CHECK_ERROR',
      });
    }
  };
}

/**
 * B108A-AAL-016: Require device-bound authenticator (AAL3)
 * AAL3 requires device-bound cryptographic authenticator per NIST SP 800-63B
 */
export function requireDeviceBound() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest;

    if (!authReq.user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    }

    try {
      const status = await checkUserAalCompliance(
        authReq.user.id.toString(),
        authReq.user.roles
      );

      // B108A-AAL-016: AAL3 requires device-bound authenticator
      const hasDeviceBound = status.authenticators.some(
        (auth) => auth.deviceBound
      );

      if (!hasDeviceBound || status.currentAal < 3) {
        return res.status(403).json({
          error: 'Device-bound authenticator required (AAL3)',
          code: 'DEVICE_BOUND_REQUIRED',
          required_aal: 3,
          current_aal: status.currentAal,
          status,
          hint: 'AAL3 requires a device-bound cryptographic authenticator (e.g., platform WebAuthn authenticator)',
        });
      }

      authReq.aalStatus = status;
      next();
    } catch (error: any) {
      console.error('Device-bound check error:', error);
      return res.status(500).json({
        error: 'Failed to verify device-bound authenticator',
        code: 'DEVICE_BOUND_CHECK_ERROR',
      });
    }
  };
}

/**
 * B108A-AAL-016: Convenience middleware for AAL2 (phishing-resistant)
 */
export const requireAal2 = requirePhishingResistant;

/**
 * B108A-AAL-016: Convenience middleware for AAL3 (device-bound)
 */
export const requireAal3 = requireDeviceBound;


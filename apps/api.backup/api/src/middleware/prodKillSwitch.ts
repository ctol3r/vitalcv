/**
 * B164C-DEPLOY-004: Production-only kill switch middleware for issuer/verifier flows.
 *
 * Usage:
 *   router.use(killSwitch('issuer'));
 *   router.use(killSwitch('verifier'));
 *
 * In production, if the matching kill switch key is active the request short-circuits with
 * HTTP 503 and we log `emergency-block` for audit purposes. Non-production environments just pass through.
 */

import { Request, Response, NextFunction } from 'express';
import { isKillSwitchActive } from '../routes/admin/killSwitch';

type KillSwitchTarget = 'issuer' | 'verifier';

const PROD_VALUES = ['production', 'prod', 'live'];

function isProdEnv(): boolean {
  const env = (process.env.APP_ENV || process.env.NODE_ENV || 'development').toLowerCase();
  return PROD_VALUES.includes(env);
}

function buildErrorResponse(target: KillSwitchTarget) {
  if (target === 'issuer') {
    return {
      code: 'ISSUER_EMERGENCY_BLOCK',
      message: 'Issuer APIs are temporarily unavailable. Please try again later.',
    };
  }

  return {
    code: 'VERIFIER_EMERGENCY_BLOCK',
    message: 'Verifier APIs are temporarily unavailable. Please try again later.',
  };
}

export function killSwitch(target: KillSwitchTarget) {
  return function prodKillSwitchMiddleware(req: Request, res: Response, next: NextFunction) {
    if (!isProdEnv()) {
      return next();
    }

    if (!isKillSwitchActive(target)) {
      return next();
    }

    const error = buildErrorResponse(target);

    console.error('[prod-kill-switch] emergency-block', {
      target,
      path: req.path,
      method: req.method,
      correlationId: req.headers['x-request-id'],
      timestamp: new Date().toISOString(),
    });

    return res.status(503).json({
      error: 'service_unavailable',
      message: error.message,
      code: error.code,
      target,
      timestamp: new Date().toISOString(),
    });
  };
}

export const issuerKillSwitch = killSwitch('issuer');
export const verifierKillSwitch = killSwitch('verifier');

export default killSwitch;

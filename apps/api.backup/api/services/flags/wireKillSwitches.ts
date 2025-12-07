const log = getServiceLogger('flags/wireKillSwitches');
/**
 * B141D-FF-005 & B141D-FF-006: Kill-switch wiring for emergency shutdowns
 *
 * This service wires kill switches into critical routes:
 * - applyWithVC: Disables Apply-with-VitalCV widget
 * - ehr.facade: Disables EHR facade endpoints
 *
 * When a kill switch is active, routes short-circuit with 503 Service Unavailable
 */

import { Request, Response, NextFunction } from 'express';
import { isKillSwitchActive } from '../../../apps/api/src/routes/admin/killSwitch';
import { logEhrFacadeRequest } from '../audit/ehrFacadeEvents';
import { getServiceLogger } from '../logging/serviceLogger';

/**
 * Middleware to check kill switch for Apply-with-VitalCV widget
 * B141D-FF-005: If killSwitch('applyWithVC') active, all widget routes short-circuit with 503
 */
export function applyWithVCKillSwitchGuard(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (isKillSwitchActive('applyWithVC')) {
    // Log incident
    log.error(
      `[KILL-SWITCH] 🚨 APPLY_WITH_VC_DISABLED: Request blocked at ${new Date().toISOString()}`,
      {
        path: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      }
    );

    // Return 503 Service Unavailable with clear message
    return res.status(503).json({
      error: 'service_unavailable',
      message: 'Apply-with-VitalCV service is temporarily unavailable. Please try again later.',
      code: 'APPLY_WITH_VC_DISABLED',
      timestamp: new Date().toISOString(),
    });
  }

  next();
}

/**
 * Middleware to check kill switch for EHR facade
 * B141D-FF-006: If killSwitch('ehr.facade') active, /ehr/fhir/* returns 503
 */
export function ehrFacadeKillSwitchGuard(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (isKillSwitchActive('ehr.facade')) {
    // Log explicit incident
    log.error(
      `[KILL-SWITCH] 🚨 EHR_FACADE_DISABLED: Request blocked at ${new Date().toISOString()}`,
      {
        path: req.path,
        method: req.method,
        orgId: (req as any).orgId,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      }
    );

    // Log to audit system
    const orgId = (req as any).orgId || 'unknown';
    logEhrFacadeRequest({
      orgId,
      source: 'ehr',
      resourceType: req.path.split('/').pop() || 'unknown',
      queryHash: '', // Not needed for kill switch
      statusCode: 503,
      duration: 0,
      errorMessage: 'EHR_FACADE_DISABLED: Kill switch is active',
      metadata: {
        killSwitch: 'ehr.facade',
        blocked: true,
      },
    }).catch((err) => {
      log.error('[KILL-SWITCH] Failed to log EHR facade audit:', err);
    });

    // Return 503 Service Unavailable with clear message
    return res.status(503).json({
      error: 'service_unavailable',
      message: 'EHR facade service is temporarily unavailable. Please try again later.',
      code: 'EHR_FACADE_DISABLED',
      timestamp: new Date().toISOString(),
    });
  }

  next();
}

/**
 * Generic kill switch guard that can be used for any route
 */
export function killSwitchGuard(key: string, errorCode: string, errorMessage: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (isKillSwitchActive(key)) {
      log.error(
        `[KILL-SWITCH] 🚨 ${errorCode}: Kill switch '${key}' is active`,
        {
          path: req.path,
          method: req.method,
          ip: req.ip,
          timestamp: new Date().toISOString(),
        }
      );

      return res.status(503).json({
        error: 'service_unavailable',
        message: errorMessage,
        code: errorCode,
        timestamp: new Date().toISOString(),
      });
    }

    next();
  };
}


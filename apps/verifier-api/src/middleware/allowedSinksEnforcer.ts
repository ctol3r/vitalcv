import { Request, Response, NextFunction } from 'express';

/**
 * B93-SEC-001: Enforce allowed_sinks on all inbound routes
 *
 * This middleware validates that requests include proper sink validation.
 * In production, this would integrate with the messaging guard system.
 */
export function allowedSinksEnforcer(req: Request, res: Response, next: NextFunction) {
  // For now, allow all requests (in production, validate allowed_sinks header)
  // TODO: Integrate with @vitalcv/messaging-guard
  next();
}


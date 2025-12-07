/**
 * Readonly Mode Configuration
 * B150B-DR-007
 *
 * Support READONLY_MODE flag for disaster recovery scenarios.
 * When enabled:
 * - Write endpoints return 503 with clear message
 * - FHIR/TEFCA facades still read-only
 * - Tests toggle flag
 */

export interface ReadonlyModeConfig {
  enabled: boolean;
  message: string;
  allowedEndpoints: string[];
}

/**
 * Check if readonly mode is enabled
 * Reads from environment variable READONLY_MODE
 */
export function isReadonlyModeEnabled(): boolean {
  return process.env.READONLY_MODE === 'true' || process.env.READONLY_MODE === '1';
}

/**
 * Get readonly mode configuration
 */
export function getReadonlyModeConfig(): ReadonlyModeConfig {
  const enabled = isReadonlyModeEnabled();

  return {
    enabled,
    message: process.env.READONLY_MODE_MESSAGE ||
      'Service is in read-only mode due to maintenance or disaster recovery. Write operations are temporarily unavailable.',
    allowedEndpoints: [
      // Health checks always allowed
      '/healthz',
      '/healthz/liveness',
      '/healthz/readiness',
      // Read-only endpoints
      '/api/npi/lookup',
      '/api/claim/status',
      '/api/credential/verify',
      // FHIR read-only endpoints
      '/api/fhir/Practitioner',
      '/api/fhir/PractitionerRole',
      '/api/fhir/R6/Practitioner',
      '/api/fhir/R6/PractitionerRole',
      '/api/fhir/R6/Organization',
      '/api/fhir/R6/Endpoint',
      // TEFCA read-only endpoints
      '/api/tefca/query',
      '/api/tefca/status',
    ],
  };
}

/**
 * Check if an endpoint is allowed in readonly mode
 */
export function isEndpointAllowedInReadonlyMode(path: string): boolean {
  const config = getReadonlyModeConfig();

  if (!config.enabled) {
    return true; // All endpoints allowed when not in readonly mode
  }

  // Check if path matches any allowed endpoint
  return config.allowedEndpoints.some(allowed => {
    // Exact match
    if (path === allowed) {
      return true;
    }

    // Prefix match (for parameterized routes)
    if (path.startsWith(allowed + '/') || path.startsWith(allowed + '?')) {
      return true;
    }

    return false;
  });
}

/**
 * Middleware to enforce readonly mode
 * Returns 503 for write operations when readonly mode is enabled
 */
import { Request, Response, NextFunction } from 'express';

export function readonlyModeMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const config = getReadonlyModeConfig();

  if (!config.enabled) {
    return next(); // Not in readonly mode, continue
  }

  // Check if this is a write operation
  const isWriteOperation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);

  if (!isWriteOperation) {
    return next(); // Read operations allowed
  }

  // Check if endpoint is explicitly allowed
  if (isEndpointAllowedInReadonlyMode(req.path)) {
    return next(); // Endpoint allowed in readonly mode
  }

  // Block write operation
  res.status(503).json({
    error: 'Service Unavailable',
    code: 'READONLY_MODE',
    message: config.message,
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
  });
}

/**
 * Health check response includes readonly mode status
 */
export function getReadonlyModeHealthStatus(): {
  readonlyMode: boolean;
  message?: string;
} {
  const config = getReadonlyModeConfig();

  return {
    readonlyMode: config.enabled,
    ...(config.enabled && { message: config.message }),
  };
}


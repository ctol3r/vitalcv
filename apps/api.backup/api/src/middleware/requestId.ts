import type { NextFunction, Request, Response } from 'express';
import {
  bindUserContextToRequest,
  createRequestContextMiddleware,
  type Logger,
} from '@chai-vc/logging-core';
import { randomUUID } from 'crypto';

const SERVICE_NAME = process.env.SERVICE_NAME || 'evidence-registry-api';
const REQUEST_ID_HEADER = 'x-request-id';

declare module 'express-serve-static-core' {
  interface Request {
    requestId?: string;
    log?: Logger;
  }
}

/**
 * Request ID middleware that:
 * 1. Generates or extracts request ID from incoming header
 * 2. Attaches to request object for logging/tracing
 * 3. Sets response header for client debugging
 */
export function requestIdMiddleware() {
  const baseMiddleware = createRequestContextMiddleware({ serviceName: SERVICE_NAME }) as unknown as (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => void;

  return (req: Request, res: Response, next: NextFunction) => {
    // Extract existing request ID or generate new one
    const incomingId = req.get(REQUEST_ID_HEADER);
    const requestId = incomingId || `${SERVICE_NAME}-${randomUUID()}`;

    // Attach to request object
    req.requestId = requestId;

    // Set response header for client debugging
    res.setHeader(REQUEST_ID_HEADER, requestId);

    // Add to response locals for error handlers
    res.locals.requestId = requestId;

    // Call base middleware for logging context
    baseMiddleware(req, res, next);
  };
}

/**
 * Simple request ID middleware (without logging-core dependency)
 * Use this if logging-core is not available
 */
export function simpleRequestIdMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const incomingId = req.get(REQUEST_ID_HEADER);
    const requestId = incomingId || `req-${randomUUID()}`;

    req.requestId = requestId;
    res.setHeader(REQUEST_ID_HEADER, requestId);
    res.locals.requestId = requestId;

    next();
  };
}

export function setRequestUserContext(req: Request, context: { userId?: string; orgId?: string }) {
  bindUserContextToRequest(req, context);
}

/**
 * Get request ID from request or response
 */
export function getRequestId(reqOrRes: Request | Response): string | undefined {
  if ('requestId' in reqOrRes) {
    return (reqOrRes as Request).requestId;
  }
  return (reqOrRes as Response).locals?.requestId;
}


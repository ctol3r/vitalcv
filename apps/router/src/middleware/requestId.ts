import type { NextFunction, Request, Response } from 'express';
import {
  bindUserContextToRequest,
  createRequestContextMiddleware,
  type Logger,
} from '@chai-vc/logging-core';

const SERVICE_NAME = process.env.SERVICE_NAME || 'router-api';

declare module 'express-serve-static-core' {
  interface Request {
    requestId?: string;
    log?: Logger;
  }
}

export function requestIdMiddleware() {
  return createRequestContextMiddleware({ serviceName: SERVICE_NAME }) as unknown as (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => void;
}

export function setRequestUserContext(req: Request, context: { userId?: string; orgId?: string }) {
  bindUserContextToRequest(req, context);
}


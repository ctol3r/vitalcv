import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import {
  createLogger,
  runWithLogContext,
  updateLogContext,
  type Logger,
} from '@chai-vc/logging-core';

const SERVICE_NAME = process.env.SERVICE_NAME || 'evidence-registry-api';
const baseLogger = createLogger({ service: SERVICE_NAME });

declare module 'express-serve-static-core' {
  interface Request {
    requestId?: string;
    log?: Logger;
  }
}

export function requestIdMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const requestId =
      (req.headers['x-request-id'] as string | undefined) ??
      (req.headers['x-correlation-id'] as string | undefined) ??
      randomUUID();

    const userId = (req as any).user?.id;
    const orgId = (req as any).user?.orgId;

    res.setHeader('x-request-id', requestId);
    req.requestId = requestId;

    const requestLogger = baseLogger.child({
      requestId,
      userId,
      orgId,
    });

    req.log = requestLogger;

    runWithLogContext(
      {
        requestId,
        userId,
        orgId,
        service: SERVICE_NAME,
      },
      () => next(),
    );
  };
}

export function setRequestUserContext(req: Request, context: { userId?: string; orgId?: string }) {
  if (context.userId || context.orgId) {
    updateLogContext(context);
  }

  if (req.log) {
    req.log = req.log.child({
      userId: context.userId,
      orgId: context.orgId,
    });
  }
}


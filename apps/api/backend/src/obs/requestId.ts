import type { NextFunction, Request, Response } from 'express';
import crypto from 'crypto';

export type RequestWithId = Request & { requestId?: string };

function randomId(): string {
  // Use UUID when available (Node 20+), else fallback.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return crypto.randomBytes(16).toString('hex');
}

export function requestIdMiddleware(req: RequestWithId, res: Response, next: NextFunction) {
  const incoming = req.header('x-request-id')?.trim();
  const id = incoming || randomId();
  req.requestId = id;
  res.setHeader('x-request-id', id);
  next();
}



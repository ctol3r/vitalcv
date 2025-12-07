import { randomUUID } from 'crypto';
import type { Request, Response, NextFunction } from 'express';

export function withNonce(req: Request, res: Response, next: NextFunction) {
  const n = randomUUID().replace(/-/g, '');
  (req as any).cspNonce = n;
  res.setHeader(
    'Content-Security-Policy',
    `default-src 'self'; img-src 'self' data: blob:; connect-src 'self' ${process.env.PUBLIC_ISSUER_URL || ''}; script-src 'self' 'nonce-${n}'; style-src 'self' 'unsafe-inline'`
  );
  next();
}


// src/middleware/credentialGuard.ts — expiration & revocation enforcement guard

import { NextFunction, Request, Response } from 'express';

export function credentialGuard(req: Request, res: Response, next: NextFunction) {
  const cred = (req as any).credential; // assume upstream fetch
  if (!cred) return res.status(404).json({ error: 'credential_not_found' });
  if (cred.revoked) return res.status(410).json({ error: 'credential_revoked' });
  if (cred.expiresAt && Date.now() > new Date(cred.expiresAt).getTime()) {
    return res.status(409).json({ error: 'credential_expired' });
  }
  next();
}


import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const PUB = process.env.JWT_PUBLIC_KEY?.replaceAll('\\n', '\n');

export function authOpt(req: Request, _res: Response, next: NextFunction) {
  try {
    const h = String(req.headers.authorization || '');
    if (h.startsWith('Bearer ') && PUB) {
      const tok = h.slice(7);
      const p = jwt.verify(tok, PUB, { algorithms: ['RS256'] }) as any;
      (req as any).user = p;
      if (p?.tenant_id) {
        req.headers['x-tenant-id'] = String(p.tenant_id);
      }
    }
  } catch (err) {
    // Optional auth - ignore errors
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!(req as any).user) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}


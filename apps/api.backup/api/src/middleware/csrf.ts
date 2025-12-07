import type { Request, Response, NextFunction } from 'express';

export function requireState(req: Request, res: Response, next: NextFunction) {
  const s = req.query.state || req.body?.state;
  if (!s || s !== (req as any).session?.oauth_state) {
    return res.status(400).json({ error: 'csrf_state_mismatch' });
  }
  next();
}


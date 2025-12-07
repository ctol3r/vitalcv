import type { Request, Response, NextFunction } from 'express';

export function requireFeature(name: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const f = (req as any)._features || {};
    if (f[name]) return next();
    return res.status(402).json({ error: 'feature_not_in_plan', feature: name });
  };
}


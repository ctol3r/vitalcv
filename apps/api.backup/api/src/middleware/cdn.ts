import type { Request, Response, NextFunction } from 'express';

export function cdnHints(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('Vary', 'Accept-Encoding, Authorization');
  res.setHeader('Cache-Control', 'private, max-age=0, no-cache');
  next();
}


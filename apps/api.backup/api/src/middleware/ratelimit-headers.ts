import type { Request, Response, NextFunction } from 'express';

export function rateHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('x-ratelimit-limit', '120');
  res.setHeader('x-ratelimit-remaining', 'dynamic');
  next();
}

import type { Request, Response, NextFunction } from 'express';

export function blockDanger(req: Request, res: Response, next: NextFunction) {
  const m = req.method.toUpperCase();
  if (m === 'TRACE' || m === 'TRACK') {
    return res.status(405).end();
  }
  next();
}

export function normalizePath(req: Request, _res: Response, next: NextFunction) {
  try {
    req.url = req.url.replace(/\.(\.|\%2e\%2e)/gi, '');
  } catch {}
  next();
}


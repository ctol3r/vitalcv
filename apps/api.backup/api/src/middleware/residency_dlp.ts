import type { Request, Response, NextFunction } from 'express';

const EU_PATHS = /^\/eu\//;

export function residencyGuard(req: Request, res: Response, next: NextFunction) {
  const r = String(process.env.DATA_REGION || 'us');
  if (r === 'eu' && !EU_PATHS.test(req.originalUrl)) {
    return res.status(451).json({ error: 'region_restricted' });
  }
  next();
}

export function dlpGuard(req: Request, _res: Response, next: NextFunction) {
  const s = JSON.stringify(req.body || {});
  if (/\b\d{3}-?\d{2}-?\d{4}\b/.test(s)) {
    (req as any)._dlp = true;
  }
  next();
}


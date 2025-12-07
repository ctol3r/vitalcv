import type { Request, Response, NextFunction } from 'express';

export function errors(err: any, _req: Request, res: Response, _next: NextFunction) {
  const status = err?.status || 500;
  const code = err?.code || 'internal';
  const msg = (process.env.NODE_ENV === 'production' && status === 500)
    ? 'internal_error'
    : String(err?.message || '');

  return res.status(status).json({
    error: code,
    message: msg
  });
}


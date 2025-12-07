import type { Request, Response, NextFunction } from 'express';
import { jlog } from '../obs/logger';

export function observability(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    jlog({
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration,
      env: process.env.NODE_ENV || 'dev',
      timestamp: new Date().toISOString()
    });
  });

  next();
}


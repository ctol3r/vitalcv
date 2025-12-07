import { Request, Response, NextFunction } from 'express';
import client from 'prom-client';

const slowRequestCounter = new client.Counter({
  name: 'vitalcv_slow_requests_total',
  help: 'Total number of requests exceeding 500ms',
  labelNames: ['method', 'path']
});

export const slowRequestDetection = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > 500) {
      console.warn(`[SLOW REQUEST] ${req.method} ${req.originalUrl} took ${duration}ms`);
      slowRequestCounter.inc({ method: req.method, path: req.path });
    }
  });

  next();
};
















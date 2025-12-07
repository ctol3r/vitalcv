import type { Express } from 'express';

export function harden(app: Express) {
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    next();
  });
}


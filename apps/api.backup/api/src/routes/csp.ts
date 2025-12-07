import { Router } from 'express';

export const cspRouter = Router();

cspRouter.post('/csp/report', (req, res) => {
  try {
    console.log('[CSP]', JSON.stringify(req.body));
  } catch {
    // ignore parse errors
  }
  res.status(204).end();
});


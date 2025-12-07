import { Router } from 'express';

export const billing = Router();

billing.post('/billing/webhook', (req, res) => {
  console.log('[billing]', JSON.stringify(req.body));
  res.json({ ok: true });
});


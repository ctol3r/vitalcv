import { Router } from 'express';

export const stripeHook = Router();

stripeHook.post('/webhooks/stripe', (req, res) => {
  console.log('[stripe] evt', JSON.stringify(req.body));
  res.json({ ok: true });
});


/**
 * Demo Mode Toggle API
 * Allows admin to enable/disable demo mode for clean demos
 */

import { Router } from 'express';

export const demoMode = Router();

demoMode.post('/api/dev/demo-mode', (req, res) => {
  const on = String(req.query.on || '1') === '1';
  process.env.DEMO_MODE = on ? '1' : '0';

  res.json({
    ok: true,
    demo: on,
    message: on ? 'Demo mode enabled' : 'Demo mode disabled'
  });
});

demoMode.get('/api/dev/demo-mode', (_req, res) => {
  const demo = process.env.DEMO_MODE === '1';
  res.json({ demo });
});


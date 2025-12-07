import { Router } from 'express';

export const freezeRouter = Router();

freezeRouter.get('/config/freeze', (_req, res) => {
  const out = {
    pilot: process.env.PILOT_MODE === '1',
    issuer: process.env.PUBLIC_ISSUER_URL,
    tau: process.env.MCP_SELECT_TAU,
    slo_ms: process.env.SLO_P95_MS,
    success: process.env.SLO_SUCCESS_RATE
  };
  res.json(out);
});


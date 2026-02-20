import type { Express, Request, Response, NextFunction } from 'express';
import {
  handleDemoProviderLookup,
  handleDemoVerify,
  handleDemoSampleNpis,
} from './demo.controller';
import { demoRateLimit } from './demo.rateLimit';

/**
 * Wrap an async route handler so thrown errors reach the Express error handler.
 */
function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

/**
 * Register public demo routes — no API key auth, rate-limited.
 *
 * Routes:
 *   GET  /demo/provider?npi=:npi   — public NPPES lookup
 *   POST /demo/verify              — full verify pipeline, returns signed artifact
 *   GET  /demo/sample-npis         — hardcoded sample NPI list
 */
export function registerDemoRoutes(app: Express): void {
  app.get('/demo/provider', demoRateLimit, asyncHandler(handleDemoProviderLookup));
  app.post('/demo/verify', demoRateLimit, asyncHandler(handleDemoVerify));
  app.get('/demo/sample-npis', demoRateLimit, handleDemoSampleNpis);
}

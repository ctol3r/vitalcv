import type { Express, Request, Response, NextFunction } from 'express';
import {
  handleDemoProviderLookup,
  handleDemoVerify,
  handleDemoSampleNpis,
  handleDemoStatus,
  handleDemoIssue,
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
 *   GET  /demo/status              — service version, uptime, git sha
 *   GET  /demo/provider?npi=:npi   — public NPPES lookup
 *   GET  /demo/sample-npis         — hardcoded sample NPI list
 *   POST /demo/issue               — issue mock W3C Verifiable Credential
 *   POST /demo/verify              — full verify pipeline, returns signed artifact
 */
export function registerDemoRoutes(app: Express): void {
  app.get('/demo/status', handleDemoStatus);
  app.get('/demo/provider', demoRateLimit, asyncHandler(handleDemoProviderLookup));
  app.post('/demo/issue', demoRateLimit, asyncHandler(handleDemoIssue));
  app.post('/demo/verify', demoRateLimit, asyncHandler(handleDemoVerify));
  app.get('/demo/sample-npis', demoRateLimit, handleDemoSampleNpis);
}

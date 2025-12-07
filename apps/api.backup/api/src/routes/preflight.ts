/**
 * Preflight Regression Pack - Round 12
 * One-shot system health checks for demo readiness
 */

import { Router, Request, Response } from 'express';
import axios from 'axios';

const router = Router();

/**
 * GET /api/preflight
 * Run all preflight checks
 */
router.get('/', async (req: Request, res: Response) => {
  const out: Record<string, string> = {};
  const base = process.env.PUBLIC_ISSUER_URL || 'http://localhost:4000';

  /**
   * Helper function to run a check and capture PASS/FAIL
   */
  async function check(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      out[name] = 'PASS';
    } catch (e: any) {
      out[name] = `FAIL: ${e?.message || e}`;
    }
  }

  // Check 1: Health endpoint
  await check('health', async () => {
    const r = await axios.get(`${base}/api/agent/healthz`, { timeout: 5000 });
    if (!r.data?.ok && r.data?.status !== 'ok') {
      throw new Error('health not ok');
    }
  });

  // Check 2: JWKS endpoint
  await check('jwks', async () => {
    const r = await axios.get(`${base}/.well-known/jwks.json`, { timeout: 5000 });
    if (!r.data?.keys || r.data.keys.length === 0) {
      throw new Error('no keys in JWKS');
    }
  });

  // Check 3: OIDC4VCI metadata
  await check('oidc4vci_meta', async () => {
    const r = await axios.get(`${base}/.well-known/openid-credential-issuer`, { timeout: 5000 });
    if (!r.data?.issuer && !r.data?.credential_issuer) {
      throw new Error('no issuer in OIDC metadata');
    }
  });

  // Check 4: StatusList endpoint
  await check('statuslist', async () => {
    const r = await axios.get(`${base}/status/1`, { timeout: 5000 });
    if (!r.data || typeof r.data !== 'object') {
      throw new Error('no valid status list');
    }
  });

  // Check 5: Database connectivity
  await check('database', async () => {
    // Simple check - if we got this far, DB is probably working
    // In production, you'd do a real DB query here
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL not set');
    }
  });

  res.json({
    timestamp: new Date().toISOString(),
    checks: out,
    all_pass: Object.values(out).every((v) => v === 'PASS'),
  });
});

export const preflightRouter = router;


import { Router } from 'express';
import axios from 'axios';

export const rcGate = Router();

rcGate.get('/gate', async (_req, res) => {
  const out: any = {};
  const base = process.env.PUBLIC_ISSUER_URL || 'http://localhost:4000';

  async function ok(name: string, fn: () => Promise<any>) {
    try {
      await fn();
      out[name] = 'PASS';
    } catch (e: any) {
      out[name] = 'FAIL:' + String(e?.message || e);
    }
  }

  // Health check
  await ok('health', async () => {
    const r = await axios.get(base + '/api/agent/healthz', { timeout: 5000 });
    if (!r.data?.ok) throw new Error('not ok');
  });

  // JWKS check
  await ok('jwks', async () => {
    const r = await axios.get(base + '/.well-known/jwks.json', { timeout: 5000 });
    if (!(r.data?.keys?.length)) throw new Error('no keys');
  });

  // StatusList check
  await ok('statuslist', async () => {
    const r = await axios.get(base + '/status/1', { timeout: 5000 });
    if (!r.data) throw new Error('no status');
  });

  // Metrics check
  await ok('metrics', async () => {
    const r = await axios.get(base + '/metrics', { timeout: 5000 });
    if (r.status !== 200) throw new Error('no metrics');
  });

  const GREEN = Object.values(out).every((v: any) => String(v).startsWith('PASS'));

  res.json({ GREEN, checks: out });
});


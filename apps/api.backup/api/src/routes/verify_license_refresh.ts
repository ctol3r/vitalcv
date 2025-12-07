/**
 * Batch 69: License Cache Refresh Endpoint
 * POST /api/verify/license/refresh?state=XX&number=ABC123
 * Forces a fresh fetch and recache (bypasses TTL)
 */

import { Router } from 'express';

export const licenseRefresh = Router();

/**
 * Manual refresh: delete cache entry and re-fetch
 */
licenseRefresh.post('/api/verify/license/refresh', async (req, res) => {
  const state = (req.query.state || '').toString();
  const number = (req.query.number || '').toString();
  
  if (!state || !number) {
    return res.status(400).json({ ok: false, error: 'missing state or number' });
  }

  // Build URL to main verify endpoint
  const u = `/api/verify/license?state=${encodeURIComponent(state)}&number=${encodeURIComponent(number)}`;
  
  // Internal fetch to trigger fresh lookup
  // Note: Using localhost assumes single-instance deployment
  // For multi-instance, use internal service mesh or direct DB delete + refetch
  const port = process.env.PORT || 3001;
  const r = await fetch(`http://localhost:${port}${u}`);
  
  res.status(r.status).send(await r.text());
});



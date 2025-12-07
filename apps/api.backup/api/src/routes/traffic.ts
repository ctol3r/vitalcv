import { Router } from 'express';
import { pool } from '../db';

export const traffic = Router();

// Active-Active traffic routing and failover
traffic.get('/api/traffic/health', async (_req, res) => {
  const region = process.env.DATA_REGION || 'us-east-1';
  const instance = process.env.INSTANCE_ID || 'local';

  // Check DB connectivity
  let dbOk = false;
  try {
    await pool.query('SELECT 1');
    dbOk = true;
  } catch {}

  const healthy = dbOk;

  res.status(healthy ? 200 : 503).json({
    region,
    instance,
    healthy,
    checks: {
      database: dbOk,
    },
    timestamp: new Date().toISOString(),
  });
});

traffic.get('/api/traffic/routes', async (_req, res) => {
  // Return routing table for traffic manager
  const routes = await pool.query(
    'SELECT * FROM "TrafficRoute" WHERE enabled = true'
  );

  res.json({
    routes: routes.rows.map((r) => ({
      pattern: r.pattern,
      target_region: r.target_region,
      weight: r.weight,
      priority: r.priority,
    })),
  });
});

traffic.post('/api/traffic/failover', async (req, res) => {
  const { from_region, to_region } = req.body;

  // Update routing weights
  await pool.query(
    'UPDATE "TrafficRoute" SET weight = 0 WHERE target_region = $1',
    [from_region]
  );

  await pool.query(
    'UPDATE "TrafficRoute" SET weight = 100 WHERE target_region = $1',
    [to_region]
  );

  res.json({
    failover_complete: true,
    from: from_region,
    to: to_region,
    timestamp: new Date().toISOString(),
  });
});

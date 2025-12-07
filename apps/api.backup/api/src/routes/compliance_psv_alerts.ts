import { Router } from 'express';
import { pool } from '../db';

export const alertSet = Router();

alertSet.post('/api/compliance/psv-alerts', async (req, res) => {
  const { tenant_id, email, daily_threshold, weekly_threshold } = req.body || {};
  await pool.query(
    'INSERT INTO "PSVAlertSetting"(tenant_id, email, daily_threshold, weekly_threshold) VALUES($1, $2, $3, $4) ON CONFLICT (tenant_id) DO UPDATE SET email=$2, daily_threshold=$3, weekly_threshold=$4',
    [
      tenant_id || 'default',
      email || null,
      Number(daily_threshold) || 70,
      Number(weekly_threshold) || 80,
    ]
  );
  res.json({ ok: true });
});

alertSet.get('/api/compliance/psv-alerts', async (req, res) => {
  const tenant = (req.query.tenant || 'default').toString();
  const result = await pool.query(
    'SELECT tenant_id, email, daily_threshold, weekly_threshold FROM "PSVAlertSetting" WHERE tenant_id=$1',
    [tenant]
  );
  if (result.rows.length > 0) {
    res.json(result.rows[0]);
  } else {
    res.json({ tenant_id: tenant, email: null, daily_threshold: 70, weekly_threshold: 80 });
  }
});


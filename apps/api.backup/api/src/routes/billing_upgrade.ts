import { Router } from 'express';
import { pool } from '../db';

export const upgrade = Router();

// Billing upgrade flow
upgrade.get('/api/billing/plans', async (_req, res) => {
  res.json({
    plans: [
      {
        id: 'starter',
        name: 'Starter',
        price: 0,
        quota_runs: 100,
        features: ['Basic credentials', 'Community support'],
      },
      {
        id: 'pro',
        name: 'Professional',
        price: 99,
        quota_runs: 5000,
        features: ['Advanced credentials', 'Priority support', 'SSO', 'API access'],
      },
      {
        id: 'enterprise',
        name: 'Enterprise',
        price: 999,
        quota_runs: 100000,
        features: ['Unlimited credentials', '24/7 support', 'SSO', 'SCIM', 'SLA', 'Custom branding'],
      },
    ],
  });
});

upgrade.post('/api/billing/upgrade', async (req, res) => {
  const { tenant_id, plan_id } = req.body;

  const plans: any = {
    starter: { quota: 100, price: 0 },
    pro: { quota: 5000, price: 99 },
    enterprise: { quota: 100000, price: 999 },
  };

  const plan = plans[plan_id];
  if (!plan) {
    return res.status(400).json({ error: 'invalid_plan' });
  }

  await pool.query(
    'UPDATE "Tenant" SET plan_id = $1, quota_runs = $2 WHERE id = $3',
    [plan_id, plan.quota, tenant_id]
  );

  res.json({
    upgraded: true,
    plan_id,
    quota_runs: plan.quota,
  });
});

upgrade.post('/api/billing/downgrade', async (req, res) => {
  const { tenant_id } = req.body;

  await pool.query(
    'UPDATE "Tenant" SET plan_id = $1, quota_runs = $2 WHERE id = $3',
    ['starter', 100, tenant_id]
  );

  res.json({
    downgraded: true,
    plan_id: 'starter',
  });
});

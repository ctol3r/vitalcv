import { Router } from 'express';
import { pool } from '../agent/db';

export const billingCenter = Router();

function monthStr(d = new Date()) {
  return d.toISOString().slice(0, 7);
}

// Generate or update invoice for org+month
billingCenter.post('/billing/invoice/generate', async (req, res) => {
  const org = String(req.body?.org_id || 'default');
  const m = String(req.body?.month || monthStr());
  const { rows } = await pool.query(
    'SELECT runs FROM usage_month_mv WHERE org_id=$1 AND month=date_trunc(\'month\',$2::timestamp)',
    [org, m + '-01T00:00:00Z']
  );
  const runs = Number(rows[0]?.runs || 0);
  const rate = 0.02;
  const subtotal = +(runs * rate).toFixed(2);
  const tax = +(subtotal * 0.0).toFixed(2);
  const total = +(subtotal + tax).toFixed(2);

  const up = await pool.query(
    'INSERT INTO "Invoice"(org_id,month,subtotal,tax,total,status) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT (org_id,month) DO UPDATE SET subtotal=$3,tax=$4,total=$5,status=$6 RETURNING *',
    [org, m, subtotal, tax, total, 'open']
  );
  res.json(up.rows[0]);
});

// List invoices for org
billingCenter.get('/billing/invoices', async (req, res) => {
  const org = String(req.headers['x-org-id'] || 'default');
  const { rows } = await pool.query(
    'SELECT * FROM "Invoice" WHERE org_id=$1 ORDER BY month DESC',
    [org]
  );
  res.json({ rows });
});

// Mark paid & issue receipt
billingCenter.post('/billing/invoice/pay', async (req, res) => {
  const { invoice_id } = req.body || {};
  const inv = (
    await pool.query(
      'UPDATE "Invoice" SET status=\'paid\' WHERE id=$1 RETURNING *',
      [invoice_id]
    )
  ).rows[0];
  const rec = (
    await pool.query(
      'INSERT INTO "Receipt"(invoice_id,payload) VALUES($1,$2) RETURNING *',
      [invoice_id, { confirmation: 'offline', total: inv.total, currency: inv.currency }]
    )
  ).rows[0];
  res.json({ invoice: inv, receipt: rec });
});


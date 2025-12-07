import { Router } from 'express';
import { pool } from '../db';

export const orgVat = Router();

// Get org details including VAT info
orgVat.get('/org/:id', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, name, region, vat_number FROM "Org" WHERE id=$1',
    [req.params.id]
  );
  res.json(rows[0] || {});
});

// Update org VAT info
orgVat.post('/org/:id/vat', async (req, res) => {
  const { vat_number, region } = req.body || {};
  await pool.query(
    'INSERT INTO "Org"(id, name, region, vat_number) VALUES($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET region=COALESCE($3, "Org".region), vat_number=COALESCE($4, "Org".vat_number)',
    [req.params.id, req.params.id, region || null, vat_number || null]
  );
  res.json({ ok: true });
});


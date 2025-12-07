import { Router } from 'express';
import { pool } from '../db';

export const licCache = Router();

licCache.get('/api/verify/license/cache/search', async (req, res) => {
  const q = (req.query.q || '').toString().toLowerCase();
  const s = (req.query.state || '').toString().toUpperCase();
  const args: any[] = [];
  let sql = 'SELECT state, license_number, name, status, source_url, cached_at, expires_at FROM "LicenseCache"';
  const where: string[] = [];

  if (s) {
    args.push(s);
    where.push('state=$' + args.length);
  }

  if (q) {
    args.push('%' + q + '%');
    where.push('(LOWER(license_number) LIKE $' + args.length + ' OR LOWER(name) LIKE $' + args.length + ')');
  }

  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY cached_at DESC LIMIT 100';

  const { rows } = await pool.query(sql, args);
  res.json({ rows });
});

licCache.delete('/api/verify/license/cache', async (req, res) => {
  const s = (req.query.state || '').toString().toUpperCase();
  const n = (req.query.number || '').toString();

  if (!s || !n) return res.status(400).json({ ok: false });

  await pool.query('DELETE FROM "LicenseCache" WHERE state=$1 AND license_number=$2', [s, n]);
  res.json({ ok: true });
});


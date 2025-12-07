import { Router } from 'express';
import { pool } from '../db';

export const programs = Router();

/**
 * GET /api/programs/search
 * Search for residency/fellowship programs
 * Query params:
 *   - q: search term (searches name)
 *   - country: ISO country code filter
 *   - accreditor: accreditor filter (ACGME, etc.)
 * Returns max 50 results
 */
programs.get('/api/programs/search', async (req, res) => {
  try {
    const q = (req.query.q || '').toString();
    const country = (req.query.country || '').toString();
    const accred = (req.query.accreditor || '').toString();

    const where = [] as string[];
    const args: any[] = [];

    if (q) {
      args.push(`%${q.toLowerCase()}%`);
      where.push('LOWER(name) LIKE $' + args.length);
    }

    if (country) {
      args.push(country.toUpperCase());
      where.push('country = $' + args.length);
    }

    if (accred) {
      args.push(accred);
      where.push('accreditor = $' + args.length);
    }

    const sql =
      'SELECT program_id, name, institution, country, accreditor, level FROM "Program"' +
      (where.length ? ' WHERE ' + where.join(' AND ') : '') +
      ' ORDER BY name LIMIT 50';

    const { rows } = await pool.query(sql, args);
    res.json({ rows });
  } catch (err) {
    console.error('Program search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});


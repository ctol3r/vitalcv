import { Router, Request, Response } from 'express';
import { pool } from '../db';

export const tefca = Router();

tefca.get('/api/tefca/sync', async (_req: Request, res: Response) => {
  try {
    const s = await pool.query(
      'SELECT ts, count, status FROM "TefcaSync" ORDER BY ts DESC LIMIT 10'
    );
    const e = await pool.query(
      'SELECT ts, practitioner, endpoint, provenance FROM "DirectoryEntry" ORDER BY ts DESC LIMIT 50'
    );
    res.json({ runs: s.rows || [], entries: e.rows || [] });
  } catch (error: any) {
    console.error('TEFCA sync query error:', error);
    res.status(500).json({ error: 'Failed to fetch TEFCA sync data', message: error.message });
  }
});


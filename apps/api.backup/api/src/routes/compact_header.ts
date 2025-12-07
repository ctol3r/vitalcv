import { Router } from 'express';
import { pool } from '../../../src/db';

export const compactHeader = Router();

compactHeader.get('/api/clinician/compact-header', async (req, res) => {
  const npi = (req.query.npi || '').toString();

  // TODO: Look up SPL/home state from clinician profile
  // For demo purposes, stub with CA
  const state = 'CA';

  try {
    // Check IMLC (Interstate Medical Licensure Compact) membership
    const imlcResult = await pool.query(
      'SELECT 1 FROM "CompactMatrix" WHERE compact = $1 AND state = $2 LIMIT 1',
      ['imlc', state]
    );

    // Check APRN Compact membership
    const aprnResult = await pool.query(
      'SELECT 1 FROM "CompactMatrix" WHERE compact = $1 AND state = $2 LIMIT 1',
      ['aprn', state]
    );

    res.json({
      imlc: {
        spl: state, // State of Principal License
        member: imlcResult.rowCount > 0
      },
      aprn: {
        member: aprnResult.rowCount > 0
      }
    });
  } catch (err) {
    console.error('Failed to fetch compact header:', err);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch compact header'
    });
  }
});


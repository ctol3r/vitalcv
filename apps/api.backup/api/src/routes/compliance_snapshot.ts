/**
 * Compliance Snapshot API
 * Returns NCQA PSV metrics and compliance window stats
 */

import { Router } from 'express';
import { pool } from '../db';

export const complianceSnap = Router();

complianceSnap.get('/api/compliance/snapshot', async (_req, res) => {
  try {
    // PSV events in last 30 days
    const psvResult = await pool.query(
      'SELECT count(*)::int AS c FROM "VerificationEvent" WHERE pulled_at > now() - interval \'30 days\''
    );
    const psv = psvResult.rows[0]?.c || 0;

    // Anchor proofs in last 30 days
    const anchorResult = await pool.query(
      'SELECT count(*)::int AS c FROM "AnchorProof" WHERE verified_at > now() - interval \'30 days\''
    );
    const anchors = anchorResult.rows[0]?.c || 0;

    // NCQA compliance window: % of events within 120 days
    const windowResult = await pool.query(
      `SELECT
        100.0 * sum(CASE WHEN now() - pulled_at <= interval '120 days' THEN 1 ELSE 0 END) / NULLIF(count(*), 0) AS pct
      FROM "VerificationEvent"`
    );
    const ncqa_window120_pct = Number(windowResult.rows[0]?.pct || 0);

    res.json({
      last30: { psv, anchors },
      ncqa_window120_pct
    });
  } catch (error) {
    console.error('Compliance snapshot error:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch compliance snapshot' });
  }
});


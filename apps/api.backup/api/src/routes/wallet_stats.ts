/**
 * Wallet Compliance Stats Aggregator
 * Returns counts of remote/proximity WalletEvent rows + certified providers share
 */

import { Router, Request, Response } from 'express';
import { pool } from '../db';

export const walletStats = Router();

walletStats.get('/api/verify/wallet/stats', async (_req: Request, res: Response) => {
  try {
    // Get counts by mode
    const modeResult = await pool.query(
      'SELECT mode, count(*) as count FROM "WalletEvent" GROUP BY mode'
    );
    const modeMap = Object.fromEntries(
      modeResult.rows.map((x: any) => [x.mode, parseInt(x.count) || 0])
    );

    // Get certified providers share
    const certResult = await pool.query(
      `SELECT
        count(*) FILTER (WHERE provider LIKE '%certified%') AS certified,
        count(*) AS total
       FROM "WalletEvent"`
    );
    const cert = certResult.rows[0] || { certified: 0, total: 0 };
    const certShare = cert.total > 0 ? cert.certified / cert.total : 0;

    res.json({
      remote: modeMap.remote || 0,
      proximity: modeMap.proximity || 0,
      cert_share: certShare,
    });
  } catch (error: any) {
    console.error('Wallet stats query error:', error);
    // If table doesn't exist yet, return zeros
    if (error.message?.includes('does not exist')) {
      return res.json({ remote: 0, proximity: 0, cert_share: 0 });
    }
    res.status(500).json({
      error: 'internal_error',
      message: error.message || 'Failed to query wallet stats',
    });
  }
});


/**
 * EUDI Wallet Mode Support (Remote + Proximity)
 * Extends verification API to record presentation_mode and wallet_provider metadata
 * Implements EUDI Wallet dual-mode flows per EU 2025 acts 2160/2162/2164
 */

import { Router, Request, Response } from 'express';
import { pool } from '../db';

export const wallet = Router();

wallet.post('/api/verify/wallet', async (req: Request, res: Response) => {
  try {
    const { npi, mode, provider } = req.body;

    if (!npi || !mode) {
      return res.status(400).json({
        error: 'missing_required_fields',
        message: 'npi and mode are required',
      });
    }

    // Validate mode
    if (mode !== 'remote' && mode !== 'proximity') {
      return res.status(400).json({
        error: 'invalid_mode',
        message: 'mode must be "remote" or "proximity"',
      });
    }

    // Ensure WalletEvent table exists (migration should create this)
    await pool.query(
      `CREATE TABLE IF NOT EXISTS "WalletEvent" (
        id SERIAL PRIMARY KEY,
        npi VARCHAR(10) NOT NULL,
        mode VARCHAR(20) NOT NULL CHECK (mode IN ('remote', 'proximity')),
        provider VARCHAR(255),
        certified_eudi BOOLEAN DEFAULT false,
        ts TIMESTAMP DEFAULT NOW(),
        metadata JSONB
      )`
    );

    // Insert wallet event
    await pool.query(
      `INSERT INTO "WalletEvent" (npi, mode, provider, certified_eudi, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        npi,
        mode,
        provider || null,
        req.body.certified_eudi || false,
        JSON.stringify(req.body.metadata || {}),
      ]
    );

    res.json({ ok: true, npi, mode, provider });
  } catch (error: any) {
    console.error('Wallet verification error:', error);
    res.status(500).json({
      error: 'internal_error',
      message: error.message || 'Failed to record wallet event',
    });
  }
});

// Get wallet events for an NPI
wallet.get('/api/verify/wallet/:npi', async (req: Request, res: Response) => {
  try {
    const { npi } = req.params;
    const result = await pool.query(
      'SELECT * FROM "WalletEvent" WHERE npi = $1 ORDER BY ts DESC LIMIT 100',
      [npi]
    );

    res.json({ npi, events: result.rows });
  } catch (error: any) {
    console.error('Wallet query error:', error);
    res.status(500).json({
      error: 'internal_error',
      message: error.message || 'Failed to query wallet events',
    });
  }
});


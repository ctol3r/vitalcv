import { Router } from 'express';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { pool } from '../db';

export const anchorVerify = Router();

anchorVerify.get('/api/anchor/verify', async (req, res) => {
  try {
    const h = (req.query.txHash || '').toString();
    if (!h) {
      return res.status(400).json({ error: 'missing txHash' });
    }

    const ws = process.env.SUBSTRATE_WS || 'wss://rpc.polkadot.io';
    const api = await ApiPromise.create({ provider: new WsProvider(ws) });

    // NOTE: lightweight check; prod would index events
    const root = (req.query.root || null) as string | null;

    await pool.query(
      'INSERT INTO "AnchorProof"(tx_hash, root, verified_at) VALUES($1, $2, now()) ON CONFLICT (tx_hash) DO NOTHING',
      [h, root]
    );

    // Emit webhook event
    // await emitWebhook('anchor.verified', { txHash: h, root });

    res.json({
      ok: true,
      txHash: h,
      root,
      note: 'verification stub; wire indexer for full proof'
    });

    await api.disconnect();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});


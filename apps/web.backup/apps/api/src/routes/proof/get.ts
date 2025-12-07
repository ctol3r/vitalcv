import { Router, type Request, type Response } from 'express';

import { getBlockProof } from '../../services/chain/proofs';
import { listAnchorEvents } from '../../services/audit/anchor';

const router = Router();

router.get('/proof/:eventId', async (req: Request, res: Response) => {
  const { eventId } = req.params;
  if (!eventId) {
    return res.status(400).json({
      error: 'missing_event_id',
      message: 'Event id is required',
    });
  }

  try {
    const proof = await getBlockProof(eventId);

    if (proof) {
      return res.json({
        eventId,
        blockHash: proof.blockHash,
        merklePath: proof.merklePath ?? [],
        palletName: proof.palletName ?? 'audit.scrapbook',
        eventType: proof.eventType,
        timestamp: proof.timestamp,
      });
    }

    const anchor = listAnchorEvents({ limit: 1000 }).find((record) => record.id === eventId);
    if (!anchor) {
      return res.status(404).json({
        error: 'proof_not_found',
        message: `No chain proof found for ${eventId}`,
      });
    }

    return res.json({
      eventId,
      blockHash: anchor.txHash,
      merklePath: anchor.merklePath ?? [],
      palletName: 'audit.scrapbook',
      eventType: anchor.type,
      timestamp: anchor.payload.timestamp,
    });
  } catch (error) {
    console.error('[proof:get] failed', error);
    return res.status(500).json({
      error: 'proof_lookup_failed',
      message: error instanceof Error ? error.message : 'Unable to fetch chain proof',
    });
  }
});

export default router;











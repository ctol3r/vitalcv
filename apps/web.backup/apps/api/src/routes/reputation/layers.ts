import { Router, type Request, type Response } from 'express';
import {
  getOrCreateReputationLayers,
  calculateMultiFactorReputationScore,
  detectAnomalyGaps,
} from '../../services/reputation/layers';
import { anchorEvent } from '../../services/audit/anchor';
import { createHash } from 'crypto';

const router = Router();

router.get('/:clinicianId', async (req: Request, res: Response) => {
  try {
    const { clinicianId } = req.params;
    const layers = await getOrCreateReputationLayers(clinicianId);
    return res.json(layers);
  } catch (error) {
    console.error('[reputation:layers] failed', error);
    return res.status(500).json({
      error: 'reputation_layers_failed',
      message: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
});

router.get('/:clinicianId/score', async (req: Request, res: Response) => {
  try {
    const { clinicianId } = req.params;
    const score = await calculateMultiFactorReputationScore(clinicianId);
    return res.json({ clinicianId, score });
  } catch (error) {
    console.error('[reputation:score] failed', error);
    return res.status(500).json({
      error: 'reputation_score_failed',
      message: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
});

router.get('/:clinicianId/gaps', async (req: Request, res: Response) => {
  try {
    const { clinicianId } = req.params;
    const gaps = await detectAnomalyGaps(clinicianId);
    return res.json({ gaps });
  } catch (error) {
    console.error('[reputation:gaps] failed', error);
    return res.status(500).json({
      error: 'reputation_gaps_failed',
      message: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
});

router.post('/:clinicianId/anchor', async (req: Request, res: Response) => {
  try {
    const { clinicianId } = req.params;
    const layers = await getOrCreateReputationLayers(clinicianId);
    const score = await calculateMultiFactorReputationScore(clinicianId);

    const layersHash = createHash('sha256')
      .update(JSON.stringify(layers))
      .digest('hex');

    anchorEvent('reputationLayerAnchored', {
      clinicianId,
      layersHash,
      score,
    });

    return res.json({ success: true, hash: layersHash });
  } catch (error) {
    console.error('[reputation:anchor] failed', error);
    return res.status(500).json({
      error: 'reputation_anchor_failed',
      message: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
});

export default router;


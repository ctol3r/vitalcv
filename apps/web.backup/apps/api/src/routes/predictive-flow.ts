import { Router } from 'express';
import { PredictiveFlowService } from '../services/predictive-flow';

const router = Router();
const service = new PredictiveFlowService();

router.get('/:region', async (req, res) => {
  try {
    const { region } = req.params;
    const flow = await service.computeFlow(region);
    res.json(flow);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:region/export', async (req, res) => {
  try {
    const { region } = req.params;
    const pack = await service.exportPack(region);
    res.json(pack);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;


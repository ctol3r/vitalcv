import { Router } from 'express';
import { RuleDiffIntelligenceService } from '../services/rule-diff';

const router = Router();
const service = new RuleDiffIntelligenceService();

router.get('/:region', async (req, res) => {
  try {
    const { region } = req.params;
    const intelligence = await service.computeIntelligence(region);
    res.json(intelligence);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:region/export', async (req, res) => {
  try {
    const { region } = req.params;
    const bundle = await service.exportBundle(region);
    res.json(bundle);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;


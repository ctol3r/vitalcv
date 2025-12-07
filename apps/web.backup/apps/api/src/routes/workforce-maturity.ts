import { Router } from 'express';
import { WorkforceMaturityService } from '../services/workforce-maturity';

const router = Router();
const service = new WorkforceMaturityService();

router.get('/:orgId', async (req, res) => {
  try {
    const { orgId } = req.params;
    const model = await service.computeModel(orgId);
    res.json(model);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/system', async (req, res) => {
  try {
    const { orgIds } = req.body;
    const systemMaturity = await service.computeSystemMaturity(orgIds);
    res.json({ systemMaturity });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:orgId/export', async (req, res) => {
  try {
    const { orgId } = req.params;
    const pack = await service.exportPack(orgId);
    res.json(pack);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;


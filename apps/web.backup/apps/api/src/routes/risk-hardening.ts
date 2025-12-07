import { Router } from 'express';
import { RiskHardeningService } from '../services/risk-hardening';

const router = Router();
const service = new RiskHardeningService();

router.get('/:clinicianId', async (req, res) => {
  try {
    const { clinicianId } = req.params;
    const matrix = await service.computeMatrix(clinicianId);
    res.json(matrix);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:clinicianId/intervention', async (req, res) => {
  try {
    const { clinicianId } = req.params;
    const { action, outcome } = req.body;
    await service.logIntervention(clinicianId, action, outcome);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:clinicianId/export', async (req, res) => {
  try {
    const { clinicianId } = req.params;
    const pack = await service.exportPack(clinicianId);
    res.json(pack);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;


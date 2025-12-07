import { Router } from 'express';
import { MultiverseIdentityFabricService } from '../services/identity-fabric';

const router = Router();
const service = new MultiverseIdentityFabricService();

router.get('/:clinicianId', async (req, res) => {
  try {
    const { clinicianId } = req.params;
    const fabric = await service.computeFabric(clinicianId);
    res.json(fabric);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:clinicianId/correlate', async (req, res) => {
  try {
    const { clinicianId } = req.params;
    const identities = await service.collectIdentityStates(clinicianId);
    const correlation = await service.correlateMultiChain(identities);
    res.json(correlation);
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


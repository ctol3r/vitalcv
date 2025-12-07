import { Router } from 'express';
import { CredentialConsensusVectorService } from '../services/consensus-vector';

const router = Router();
const service = new CredentialConsensusVectorService();

router.get('/:credentialId', async (req, res) => {
  try {
    const { credentialId } = req.params;
    const vector = await service.computeVector(credentialId);
    res.json(vector);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:credentialId/timeline', async (req, res) => {
  try {
    const { credentialId } = req.params;
    const timeline = await service.getTimeline(credentialId);
    res.json(timeline);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:credentialId/dossier', async (req, res) => {
  try {
    const { credentialId } = req.params;
    const dossier = await service.exportDossier(credentialId);
    res.json(dossier);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;


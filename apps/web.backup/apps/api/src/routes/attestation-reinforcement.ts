import { Router, type Request, type Response } from 'express';
import { reinforceAttestation, generateAttestationExport } from '../services/attestation-reinforcement';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const { credentialId, sources } = req.body;
    if (!credentialId || !sources) return res.status(400).json({ error: 'credentialId and sources required' });
    const result = await reinforceAttestation(credentialId, sources);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: 'reinforcement_failed', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/:credentialId', async (req: Request, res: Response) => {
  try {
    const { credentialId } = req.params;
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    const record = await prisma.attestationReinforcement.findUnique({ where: { credentialId } });
    if (!record) return res.status(404).json({ error: 'not_found' });
    return res.json(record.reinforcement);
  } catch (error) {
    return res.status(500).json({ error: 'fetch_failed', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/:credentialId/export', async (req: Request, res: Response) => {
  try {
    const { credentialId } = req.params;
    const dossier = await generateAttestationExport(credentialId);
    return res.json(dossier);
  } catch (error) {
    return res.status(500).json({ error: 'export_failed', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

export default router;


import { Router, type Request, type Response } from 'express';
import { getCredentialFusionFabric, anchorCredentialFusionFabric } from '../services/credential-fusion-fabric';

const router = Router();

router.get('/credential-fusion-fabric/:clinicianId', async (req: Request, res: Response) => {
  const clinicianId = req.params.clinicianId?.trim();
  if (!clinicianId) {
    return res.status(400).json({
      error: 'clinician_id_required',
      message: 'Provide a clinicianId parameter.',
    });
  }

  try {
    const fusion = await getCredentialFusionFabric(clinicianId);
    await anchorCredentialFusionFabric(clinicianId, fusion);
    return res.json(fusion);
  } catch (error) {
    console.error('[credential-fusion-fabric] failed', error);
    return res.status(500).json({
      error: 'credential_fusion_fabric_failed',
      message: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
});

export default router;









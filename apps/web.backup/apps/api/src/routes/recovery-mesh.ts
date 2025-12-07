import { Router, type Request, type Response } from 'express';
import { getRecoveryMesh, anchorRecoveryMesh } from '../services/recovery-mesh';

const router = Router();

router.get('/recovery-mesh', async (req: Request, res: Response) => {
  try {
    const recovery = await getRecoveryMesh();
    await anchorRecoveryMesh(recovery);
    return res.json(recovery);
  } catch (error) {
    console.error('[recovery-mesh] failed', error);
    return res.status(500).json({
      error: 'recovery_mesh_failed',
      message: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
});

export default router;









import { Router, type Request, type Response } from 'express';
import {
  getOrCreateOpsMatrix,
  anchorOpsMatrixSnapshot,
} from '../services/ops-intelligence/index';

const router = Router();

router.get('/:orgId', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const matrix = await getOrCreateOpsMatrix(orgId);
    return res.json(matrix);
  } catch (error) {
    console.error('[ops-matrix] failed', error);
    return res.status(500).json({
      error: 'matrix_fetch_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/:orgId/build', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const matrix = await getOrCreateOpsMatrix(orgId);
    return res.json(matrix);
  } catch (error) {
    console.error('[ops-matrix] build failed', error);
    return res.status(500).json({
      error: 'matrix_build_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/:orgId/anchor', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    await anchorOpsMatrixSnapshot(orgId);
    return res.json({ success: true, message: 'Ops matrix anchored' });
  } catch (error) {
    console.error('[ops-matrix] anchor failed', error);
    return res.status(500).json({
      error: 'matrix_anchor_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;


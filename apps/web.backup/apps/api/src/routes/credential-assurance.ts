import { Router, type Request, type Response } from 'express';
import {
  getOrCreateCredentialAssurance,
  exportAssuranceAudit,
  anchorAssuranceSnapshot,
} from '../services/assurance/index';

const router = Router();

router.get('/:credentialId', async (req: Request, res: Response) => {
  try {
    const { credentialId } = req.params;
    const assurance = await getOrCreateCredentialAssurance(credentialId);
    return res.json(assurance);
  } catch (error) {
    console.error('[credential-assurance] failed', error);
    return res.status(500).json({
      error: 'assurance_fetch_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/:credentialId/anchor', async (req: Request, res: Response) => {
  try {
    const { credentialId } = req.params;
    await anchorAssuranceSnapshot(credentialId);
    return res.json({ success: true, message: 'Assurance snapshot anchored' });
  } catch (error) {
    console.error('[credential-assurance] anchor failed', error);
    return res.status(500).json({
      error: 'assurance_anchor_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.get('/:credentialId/export', async (req: Request, res: Response) => {
  try {
    const { credentialId } = req.params;
    const exportData = await exportAssuranceAudit(credentialId);
    return res.json(exportData);
  } catch (error) {
    console.error('[credential-assurance] export failed', error);
    return res.status(500).json({
      error: 'assurance_export_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;


import { Router, type Request, type Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { getRoleUxProfile, listRoleUxConfigs, saveRoleUxProfile } from '../../services/ux/config';

const prisma = new PrismaClient();
const router = Router();

router.get('/ux/config', async (_req: Request, res: Response) => {
  try {
    const configs = await listRoleUxConfigs({ prisma });
    return res.json({ configs });
  } catch (error) {
    console.error('[ux][config] list failed', error);
    return res.status(500).json({ error: 'ux_config_list_failed', message: extractMessage(error) });
  }
});

router.get('/ux/config/:role', async (req: Request, res: Response) => {
  try {
    const role = req.params.role;
    const profile = await getRoleUxProfile(role, { prisma });
    return res.json(profile);
  } catch (error) {
    console.error('[ux][config] get failed', error);
    return res.status(500).json({ error: 'ux_config_get_failed', message: extractMessage(error) });
  }
});

router.post('/ux/config/:role', async (req: Request, res: Response) => {
  try {
    const role = req.params.role;
    const profile = req.body?.uxProfile;
    if (!profile || typeof profile !== 'object') {
      return res.status(400).json({ error: 'invalid_profile' });
    }
    const saved = await saveRoleUxProfile(role, profile, { prisma });
    return res.json(saved);
  } catch (error) {
    console.error('[ux][config] save failed', error);
    return res.status(500).json({ error: 'ux_config_save_failed', message: extractMessage(error) });
  }
});

function extractMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export default router;


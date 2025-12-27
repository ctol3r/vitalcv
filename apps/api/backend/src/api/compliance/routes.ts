import { Router } from 'express';
import { buildCompliancePack, resolvePackType } from './pack-builder';

const router = Router();

router.get('/packs/:type', async (req, res) => {
  const packType = resolvePackType(req.params.type);
  if (!packType) return res.status(404).json({ error: 'Unsupported compliance pack type' });

  try {
    const pack = await buildCompliancePack(packType);
    return res.json(pack);
  } catch (error) {
    // Avoid leaking internals while still returning traceability in logs.
    // eslint-disable-next-line no-console
    console.error('[compliance] failed to build pack', error);
    return res.status(500).json({ error: 'Unable to build compliance pack right now' });
  }
});

export default router;

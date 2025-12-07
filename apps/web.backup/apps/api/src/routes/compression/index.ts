import { Router, type Request, type Response } from 'express';
import {
  compressCredential,
  createMobileBundle,
  trackCompressionAnalytics,
  anchorCompressionEvent,
} from '@/services/compression/credentialCompression';

const router = Router();

router.post('/compress', async (req: Request, res: Response) => {
  try {
    const { vcId, walletType } = req.body;
    if (!vcId) return res.status(400).json({ error: 'vcId required' });
    const result = await compressCredential(vcId, walletType);
    return res.json(result);
  } catch (error) {
    console.error('[Compression] Failed', error);
    return res.status(500).json({ error: 'compression_failed' });
  }
});

router.post('/mobile-bundle', async (req: Request, res: Response) => {
  try {
    const { vcId } = req.body;
    if (!vcId) return res.status(400).json({ error: 'vcId required' });
    const result = await createMobileBundle(vcId);
    return res.json(result);
  } catch (error) {
    console.error('[Compression] Mobile bundle failed', error);
    return res.status(500).json({ error: 'mobile_bundle_failed' });
  }
});

router.get('/analytics', async (_req: Request, res: Response) => {
  try {
    const result = await trackCompressionAnalytics();
    return res.json(result);
  } catch (error) {
    console.error('[Compression] Analytics failed', error);
    return res.status(500).json({ error: 'analytics_failed' });
  }
});

export default router;


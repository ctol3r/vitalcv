import { Router, type Request, type Response } from 'express';
import { PrismaClient } from '@prisma/client';
import {
  mapNhsWalletEnvelope,
  runMultiWalletSimulation,
  syncWallets,
  buildAppleWalletPassBundle,
  buildGoogleWalletPassBundle,
  ensureEudiCompatibility,
} from '../../services/wallet/interoperability';

const prisma = new PrismaClient();
const router = Router();

router.get('/wallet/interop/configs', async (_req: Request, res: Response) => {
  try {
    const configs = await prisma.walletInteropConfig.findMany({ orderBy: { updatedAt: 'desc' } });
    return res.json({ configs });
  } catch (error) {
    console.error('[wallet][interop] configs fetch failed', error);
    return res.status(500).json({ error: 'wallet_config_fetch_failed', message: extractMessage(error) });
  }
});

router.post('/wallet/interop/configs', async (req: Request, res: Response) => {
  try {
    const wallet = req.body?.wallet;
    if (!wallet) {
      return res.status(400).json({ error: 'wallet_required' });
    }
    const schema = req.body?.schema ?? {};
    const record = await prisma.walletInteropConfig.upsert({
      where: { wallet },
      create: { wallet, schema },
      update: { schema, updatedAt: new Date(), version: { increment: 1 } },
    });
    return res.json(record);
  } catch (error) {
    console.error('[wallet][interop] config save failed', error);
    return res.status(500).json({ error: 'wallet_config_save_failed', message: extractMessage(error) });
  }
});

router.post('/wallet/interop/test', async (req: Request, res: Response) => {
  try {
    const { credential, profile, presentation, wallets } = req.body ?? {};
    if (!credential || !profile || !presentation || !Array.isArray(wallets)) {
      return res.status(400).json({ error: 'invalid_payload' });
    }
    const simResults = runMultiWalletSimulation({ credential, profile, presentation, wallets });
    return res.json({ results: simResults, eudiWarnings: ensureEudiCompatibility(credential) });
  } catch (error) {
    console.error('[wallet][interop] simulation failed', error);
    return res.status(500).json({ error: 'wallet_sim_failed', message: extractMessage(error) });
  }
});

router.post('/wallet/interop/sync', async (req: Request, res: Response) => {
  try {
    const { credential, presentation, profile, wallets } = req.body ?? {};
    if (!credential || !presentation || !profile || !Array.isArray(wallets)) {
      return res.status(400).json({ error: 'invalid_payload' });
    }
    const syncResults = syncWallets({ credential, presentation, profile, wallets });
    const nhs = mapNhsWalletEnvelope(credential);
    const apple = buildAppleWalletPassBundle([credential]);
    const google = buildGoogleWalletPassBundle([credential]);
    return res.json({
      syncResults,
      adapters: {
        nhs,
        apple,
        google,
      },
    });
  } catch (error) {
    console.error('[wallet][interop] sync failed', error);
    return res.status(500).json({ error: 'wallet_sync_failed', message: extractMessage(error) });
  }
});

function extractMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export default router;


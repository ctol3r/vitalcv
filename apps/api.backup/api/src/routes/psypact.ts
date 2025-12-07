import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { verifyAPIT, verifyTAP } from '../adapters/psypact';
import { isDemo } from '../middleware/demo_mode';

const prisma = new PrismaClient();
export const psypactRouter = Router();

// Check PSYPACT credentials for an NPI
psypactRouter.get('/api/psych/psypact/:npi', async (req, res) => {
  try {
    const { npi } = req.params;

    // Demo mode: return mocked valid credentials
    if (isDemo()) {
      return res.json({
        ok: true,
        npi,
        apitValid: true,
        tapValid: true,
        epassport: 'DEMO-EPASSPORT',
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
        cached: false,
        demo: true
      });
    }

    // Check cache first
    const cached = await prisma.psypactCredential.findUnique({
      where: { npi },
    });

    const now = new Date();
    if (cached && cached.expiresAt && cached.expiresAt > now) {
      return res.json({
        ok: true,
        npi,
        apitValid: cached.apitValid,
        tapValid: cached.tapValid,
        expiresAt: cached.expiresAt,
        cached: true,
      });
    }

    // Fetch fresh data from PSYPACT adapters
    // In production, pass actual epassport from user record
    const epassport = cached?.epassport || 'DEMO-EPASSPORT';
    const apitResult = await verifyAPIT(epassport);
    const tapResult = await verifyTAP(epassport);

    // Update or create credential
    const credential = await prisma.psypactCredential.upsert({
      where: { npi },
      create: {
        npi,
        epassport,
        apitValid: apitResult.ok,
        tapValid: tapResult.ok,
        expiresAt: apitResult.expires_at,
        lastChecked: now,
      },
      update: {
        apitValid: apitResult.ok,
        tapValid: tapResult.ok,
        expiresAt: apitResult.expires_at,
        lastChecked: now,
      },
    });

    res.json({
      ok: true,
      npi,
      apitValid: credential.apitValid,
      tapValid: credential.tapValid,
      expiresAt: credential.expiresAt,
      cached: false,
    });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// Update PSYPACT credential manually
psypactRouter.post('/api/psych/psypact/:npi', async (req, res) => {
  try {
    const { npi } = req.params;
    const { epassport, apitValid, tapValid, expiresAt } = req.body;

    const credential = await prisma.psypactCredential.upsert({
      where: { npi },
      create: {
        npi,
        epassport,
        apitValid: apitValid || false,
        tapValid: tapValid || false,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        lastChecked: new Date(),
      },
      update: {
        epassport,
        apitValid: apitValid !== undefined ? apitValid : undefined,
        tapValid: tapValid !== undefined ? tapValid : undefined,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        lastChecked: new Date(),
      },
    });

    res.json({ ok: true, credential });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err.message });
  }
});


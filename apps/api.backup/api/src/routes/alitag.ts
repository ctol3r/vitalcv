import { Router } from 'express';
import { searchComplianceMCPs, harvestComplianceSuccess } from '../services/alitag';

export const alitagRouter = Router();

// Search compliance MCPs (librarian API)
alitagRouter.get('/api/alitag/mcps', async (req, res) => {
  try {
    const { domain, signal, npi, limit } = req.query;

    const mcps = await searchComplianceMCPs({
      domain: domain as string,
      signal: signal as string,
      npi: npi as string,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    res.json({
      ok: true,
      mcps,
      count: mcps.length,
    });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// Manual harvest (for testing)
alitagRouter.post('/api/alitag/harvest', async (req, res) => {
  try {
    const { domain, signal, npi, data } = req.body;

    await harvestComplianceSuccess({
      domain,
      signal,
      npi,
      data,
    });

    res.json({ ok: true, harvested: true });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err.message });
  }
});


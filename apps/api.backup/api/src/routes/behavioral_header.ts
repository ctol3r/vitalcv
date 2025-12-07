import { Router } from 'express';

export const behHeader = Router();

behHeader.get('/api/clinician/behavioral-header', async (req, res) => {
  const npi = (req.query.npi || '').toString();

  // TODO: Integrate real lookups from PSYPACT and Counseling Compact services
  // For now, returning stub data
  res.json({
    psypact: {
      apit: true,
      tap: false,
      epassport: 'DEMO',
    },
    counseling: {
      privilege_required: true,
      eligible: true,
    },
  });
});

import { Router } from 'express';
import { computeAuthzV3 } from '../services/telehealth_authz';

export const tele = Router();

tele.get('/api/telehealth/authz', async (req, res) => {
  const patient = (req.query.patient || '').toString().toUpperCase();
  const npi = (req.query.npi || '').toString() || undefined;
  const profession = (req.query.profession || 'physician') as any;
  const mode = (req.query.mode || 'tele') as any;

  if (!patient) {
    return res.status(400).json({ error: 'missing patient state' });
  }

  const out = await computeAuthzV3({ patient, npi, profession, mode });
  res.json(out);
});

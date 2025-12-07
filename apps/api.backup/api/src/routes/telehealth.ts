import { Router } from 'express';
import { checkTelehealthAuthz } from '../services/telehealthAuthz';

export const telehealthRouter = Router();

// Check telehealth authorization
telehealthRouter.get('/api/telehealth/authz', async (req, res) => {
  try {
    const { npi, profession, patient, mode } = req.query;

    if (!npi || !profession || !patient) {
      return res.status(400).json({
        ok: false,
        error: 'Missing required params: npi, profession, patient',
      });
    }

    const result = await checkTelehealthAuthz({
      npi: npi as string,
      profession: profession as string,
      patientState: patient as string,
      mode: mode as string | undefined,
    });

    res.json({ ok: true, ...result });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// Check authorization via POST for detailed requests
telehealthRouter.post('/api/telehealth/authz', async (req, res) => {
  try {
    const result = await checkTelehealthAuthz(req.body);
    res.json({ ok: true, ...result });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err.message });
  }
});


import { Router } from 'express';
import {
  recordResidencyMove,
  checkBreachStatus,
  satisfyMove,
  getAlertsDue,
  authorizeRemoteStatePractice,
} from '../services/nlcResidencyRule';

export const nlcRouter = Router();

// Record a new residency move
nlcRouter.post('/api/nlc/residency-move', async (req, res) => {
  try {
    const { npi, fromState, toState, moveDate } = req.body;
    const record = await recordResidencyMove({
      npi,
      fromState,
      toState,
      moveDate: new Date(moveDate),
    });
    res.json({ ok: true, record });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// Check breach status for NPI
nlcRouter.get('/api/nlc/breach-status/:npi', async (req, res) => {
  try {
    const breached = await checkBreachStatus(req.params.npi);
    res.json({ ok: true, breached });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// Satisfy a move with new license
nlcRouter.post('/api/nlc/satisfy-move', async (req, res) => {
  try {
    const { npi, newLicenseNpi } = req.body;
    await satisfyMove(npi, newLicenseNpi);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// Get alerts due to be sent
nlcRouter.get('/api/nlc/alerts-due', async (req, res) => {
  try {
    const alerts = await getAlertsDue();
    res.json({ ok: true, alerts });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// AuthZ check for remote state practice
nlcRouter.post('/api/nlc/authz', async (req, res) => {
  try {
    const { npi, patientState } = req.body;
    const result = await authorizeRemoteStatePractice(npi, patientState);
    res.json({ ok: true, ...result });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err.message });
  }
});


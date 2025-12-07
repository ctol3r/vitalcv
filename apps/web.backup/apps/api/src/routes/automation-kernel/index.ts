import { Router } from 'express';
import { z } from 'zod';
import {
  verifyLicenseV3,
  validateOCREvidenceV3,
  syncSanctionsToCredentials,
  validateCME,
  forecastRenewals,
  recoverFromError,
  logAutomationAction,
} from '@/services/automation-kernel';
import { anchorAutomationKernelEvent } from '@/services/automation-kernel/anchor';

const router = Router();

// License verification
router.post('/license/verify', async (req, res) => {
  try {
    const { clinicianId, licenseNumber, state } = z
      .object({
        clinicianId: z.string(),
        licenseNumber: z.string(),
        state: z.string(),
      })
      .parse(req.body);

    const result = await verifyLicenseV3(clinicianId, licenseNumber, state);
    anchorAutomationKernelEvent('license_verification', clinicianId, 'completed', { result });
    res.json(result);
  } catch (error) {
    console.error('[automation-kernel] license verify error', error);
    res.status(500).json({ error: 'Failed to verify license' });
  }
});

// OCR validation
router.post('/ocr/validate', async (req, res) => {
  try {
    const { documentId, ocrResults } = z
      .object({
        documentId: z.string(),
        ocrResults: z.record(z.unknown()),
      })
      .parse(req.body);

    const result = validateOCREvidenceV3(documentId, ocrResults);
    res.json(result);
  } catch (error) {
    console.error('[automation-kernel] OCR validate error', error);
    res.status(500).json({ error: 'Failed to validate OCR evidence' });
  }
});

// Sanctions sync
router.post('/sanctions/sync', async (req, res) => {
  try {
    const { clinicianId } = z.object({ clinicianId: z.string() }).parse(req.body);
    await syncSanctionsToCredentials(clinicianId);
    anchorAutomationKernelEvent('sanctions_sync', clinicianId, 'completed');
    res.json({ synced: true });
  } catch (error) {
    console.error('[automation-kernel] sanctions sync error', error);
    res.status(500).json({ error: 'Failed to sync sanctions' });
  }
});

// CME validation
router.post('/cme/validate', async (req, res) => {
  try {
    const { activityId, provider, hours } = z
      .object({
        activityId: z.string(),
        provider: z.string(),
        hours: z.number(),
      })
      .parse(req.body);

    const result = await validateCME(activityId, provider, hours);
    res.json(result);
  } catch (error) {
    console.error('[automation-kernel] CME validate error', error);
    res.status(500).json({ error: 'Failed to validate CME' });
  }
});

// Renewal forecast
router.get('/renewals/:clinicianId', async (req, res) => {
  try {
    const { clinicianId } = z.object({ clinicianId: z.string() }).parse(req.params);
    const forecasts = await forecastRenewals(clinicianId);
    res.json({ forecasts });
  } catch (error) {
    console.error('[automation-kernel] renewal forecast error', error);
    res.status(500).json({ error: 'Failed to forecast renewals' });
  }
});

export default router;


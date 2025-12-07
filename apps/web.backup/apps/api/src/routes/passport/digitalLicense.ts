import { Router, type Request, type Response } from 'express';
import {
  buildPassport,
  validatePassportEligibility,
  generatePassportProof,
  detectPassportAnomalies,
  refreshPassport,
  mapPassportCompliance,
  anchorPassportHash,
} from '@/services/passport/digitalLicensePassport';

const router = Router();

// Build passport
router.post('/build', async (req: Request, res: Response) => {
  try {
    const { clinicianId } = req.body;
    if (!clinicianId) {
      return res.status(400).json({ error: 'clinicianId required' });
    }

    const result = await buildPassport(clinicianId);
    return res.json(result);
  } catch (error) {
    console.error('[DigitalLicensePassport] Build failed', error);
    return res.status(500).json({
      error: 'build_failed',
      error_description: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Validate eligibility
router.post('/validate', async (req: Request, res: Response) => {
  try {
    const { clinicianId, targetState } = req.body;
    if (!clinicianId) {
      return res.status(400).json({ error: 'clinicianId required' });
    }

    const result = await validatePassportEligibility(clinicianId, targetState);
    return res.json(result);
  } catch (error) {
    console.error('[DigitalLicensePassport] Validation failed', error);
    return res.status(500).json({
      error: 'validation_failed',
      error_description: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Generate proof
router.post('/proof', async (req: Request, res: Response) => {
  try {
    const { clinicianId, disclosedFields } = req.body;
    if (!clinicianId) {
      return res.status(400).json({ error: 'clinicianId required' });
    }

    const result = await generatePassportProof(clinicianId, disclosedFields);
    return res.json(result);
  } catch (error) {
    console.error('[DigitalLicensePassport] Proof generation failed', error);
    return res.status(500).json({
      error: 'proof_generation_failed',
      error_description: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Detect anomalies
router.get('/:clinicianId/anomalies', async (req: Request, res: Response) => {
  try {
    const { clinicianId } = req.params;
    const result = await detectPassportAnomalies(clinicianId);
    return res.json(result);
  } catch (error) {
    console.error('[DigitalLicensePassport] Anomaly detection failed', error);
    return res.status(500).json({
      error: 'anomaly_detection_failed',
      error_description: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Refresh passport
router.post('/:clinicianId/refresh', async (req: Request, res: Response) => {
  try {
    const { clinicianId } = req.params;
    await refreshPassport(clinicianId);
    return res.json({ success: true });
  } catch (error) {
    console.error('[DigitalLicensePassport] Refresh failed', error);
    return res.status(500).json({
      error: 'refresh_failed',
      error_description: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get compliance mapping
router.get('/:clinicianId/compliance', async (req: Request, res: Response) => {
  try {
    const { clinicianId } = req.params;
    const result = await mapPassportCompliance(clinicianId);
    return res.json(result);
  } catch (error) {
    console.error('[DigitalLicensePassport] Compliance mapping failed', error);
    return res.status(500).json({
      error: 'compliance_mapping_failed',
      error_description: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get passport
router.get('/:clinicianId', async (req: Request, res: Response) => {
  try {
    const { clinicianId } = req.params;
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();
    const passport = await prisma.digitalLicensePassport.findUnique({
      where: { clinicianId },
    });

    if (!passport) {
      return res.status(404).json({ error: 'passport_not_found' });
    }

    return res.json(passport);
  } catch (error) {
    console.error('[DigitalLicensePassport] Get failed', error);
    return res.status(500).json({
      error: 'get_failed',
      error_description: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;


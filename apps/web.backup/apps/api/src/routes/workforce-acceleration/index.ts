import { Router } from 'express';
import { z } from 'zod';
import {
  matchCliniciansToDemand,
  detectEmployerReadiness,
  calculateTravelReadinessV2,
  autoMatchSurgeStaffing,
  predictShiftCoverage,
  routeCrossBorderClinicians,
} from '@/services/workforce-acceleration';
import { anchorAccelerationSnapshot } from '@/services/workforce-acceleration/anchor';

const router = Router();

// Match to demand
router.post('/match', async (req, res) => {
  try {
    const { demandId, specialty, region } = z
      .object({
        demandId: z.string(),
        specialty: z.string(),
        region: z.string(),
      })
      .parse(req.body);

    const matches = await matchCliniciansToDemand(demandId, specialty, region);
    res.json({ matches });
  } catch (error) {
    console.error('[workforce-acceleration] match error', error);
    res.status(500).json({ error: 'Failed to match clinicians' });
  }
});

// Employer readiness
router.get('/employer/:orgId/readiness', async (req, res) => {
  try {
    const { orgId } = z.object({ orgId: z.string() }).parse(req.params);
    const readiness = await detectEmployerReadiness(orgId);
    res.json(readiness);
  } catch (error) {
    console.error('[workforce-acceleration] employer readiness error', error);
    res.status(500).json({ error: 'Failed to check employer readiness' });
  }
});

// Travel readiness
router.get('/travel-readiness/:clinicianId', async (req, res) => {
  try {
    const { clinicianId } = z.object({ clinicianId: z.string() }).parse(req.params);
    const readiness = await calculateTravelReadinessV2(clinicianId);
    await anchorAccelerationSnapshot(clinicianId, { travelReadiness: readiness });
    res.json(readiness);
  } catch (error) {
    console.error('[workforce-acceleration] travel readiness error', error);
    res.status(500).json({ error: 'Failed to calculate travel readiness' });
  }
});

// Surge matching
router.post('/surge', async (req, res) => {
  try {
    const { demandId, specialty, region, urgency } = z
      .object({
        demandId: z.string(),
        specialty: z.string(),
        region: z.string(),
        urgency: z.enum(['low', 'medium', 'high', 'critical']),
      })
      .parse(req.body);

    const matches = await autoMatchSurgeStaffing(demandId, specialty, region, urgency);
    res.json({ matches });
  } catch (error) {
    console.error('[workforce-acceleration] surge error', error);
    res.status(500).json({ error: 'Failed to match surge staffing' });
  }
});

// Shift coverage forecast
router.get('/shift-coverage', async (req, res) => {
  try {
    const { specialty, startDate, days } = z
      .object({
        specialty: z.string(),
        startDate: z.string(),
        days: z.number().default(7),
      })
      .parse(req.query);

    const forecasts = predictShiftCoverage(specialty, startDate, days);
    res.json({ forecasts });
  } catch (error) {
    console.error('[workforce-acceleration] shift coverage error', error);
    res.status(500).json({ error: 'Failed to forecast shift coverage' });
  }
});

// Cross-border routing
router.post('/cross-border', async (req, res) => {
  try {
    const { fromCountry, toCountry, clinicianIds } = z
      .object({
        fromCountry: z.string(),
        toCountry: z.string(),
        clinicianIds: z.array(z.string()),
      })
      .parse(req.body);

    const routes = routeCrossBorderClinicians(fromCountry, toCountry, clinicianIds);
    res.json({ routes });
  } catch (error) {
    console.error('[workforce-acceleration] cross-border error', error);
    res.status(500).json({ error: 'Failed to route cross-border clinicians' });
  }
});

export default router;


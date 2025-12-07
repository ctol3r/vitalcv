import { Router, type Request, type Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { computeTrustTrajectory } from '../../services/trust/trajectory';
import { detectTrajectoryAnomalies } from '../../services/trust/trajectory-anomalies';
import { aggregateCrossOrgTrajectory } from '../../services/trust/trajectory-cross-org';
import { forecastTrustTrajectory } from '../../services/trust/trajectory-forecast';
import { generateTrustNarrative } from '../../services/trust/trajectory-narrative';
import { anchorEvent } from '../../services/audit/anchor';

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /api/trust/trajectory/:clinicianId
 * Get trust trajectory for a clinician
 */
router.get('/:clinicianId', async (req: Request, res: Response) => {
  try {
    const { clinicianId } = req.params;
    const lookbackDays = req.query.lookbackDays
      ? parseInt(req.query.lookbackDays as string, 10)
      : 90;

    const trajectory = await computeTrustTrajectory(clinicianId, lookbackDays);
    const anomalies = detectTrajectoryAnomalies(trajectory);
    const narrative = generateTrustNarrative(trajectory, anomalies);

    return res.json({
      trajectory,
      anomalies,
      narrative,
    });
  } catch (error) {
    console.error('[trust:trajectory] error', error);
    return res.status(500).json({
      error: 'trajectory_computation_failed',
      message: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
});

/**
 * GET /api/trust/trajectory/:clinicianId/forecast
 * Get trust forecast
 */
router.get('/:clinicianId/forecast', async (req: Request, res: Response) => {
  try {
    const { clinicianId } = req.params;
    const daysAhead = req.query.daysAhead
      ? parseInt(req.query.daysAhead as string, 10)
      : 30;

    const trajectory = await computeTrustTrajectory(clinicianId);
    const forecast = forecastTrustTrajectory(trajectory, daysAhead);

    return res.json(forecast);
  } catch (error) {
    console.error('[trust:trajectory:forecast] error', error);
    return res.status(500).json({
      error: 'forecast_computation_failed',
      message: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
});

/**
 * GET /api/trust/trajectory/:clinicianId/cross-org
 * Get cross-organization aggregated trajectory
 */
router.get('/:clinicianId/cross-org', async (req: Request, res: Response) => {
  try {
    const { clinicianId } = req.params;
    const aggregated = await aggregateCrossOrgTrajectory(clinicianId);

    return res.json(aggregated);
  } catch (error) {
    console.error('[trust:trajectory:cross-org] error', error);
    return res.status(500).json({
      error: 'cross_org_aggregation_failed',
      message: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
});

/**
 * GET /api/trust/trajectory/export/:clinicianId
 * Export trust trajectory as PDF/JSON
 */
router.get('/export/:clinicianId', async (req: Request, res: Response) => {
  try {
    const { clinicianId } = req.params;
    const format = (req.query.format as string) || 'json';

    const trajectory = await computeTrustTrajectory(clinicianId);
    const anomalies = detectTrajectoryAnomalies(trajectory);
    const narrative = generateTrustNarrative(trajectory, anomalies);
    const forecast = forecastTrustTrajectory(trajectory, 30);
    const crossOrg = await aggregateCrossOrgTrajectory(clinicianId);

    const exportData = {
      clinicianId,
      exportedAt: new Date().toISOString(),
      trajectory,
      anomalies,
      narrative,
      forecast,
      crossOrg,
    };

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="trust-trajectory-${clinicianId}.json"`);
      return res.json(exportData);
    }

    // PDF export would require a PDF generation library
    // For now, return JSON
    return res.status(400).json({
      error: 'unsupported_format',
      message: 'Only JSON format is currently supported',
    });
  } catch (error) {
    console.error('[trust:trajectory:export] error', error);
    return res.status(500).json({
      error: 'export_failed',
      message: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
});

export default router;


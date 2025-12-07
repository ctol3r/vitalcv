import { Router, type Request, type Response } from 'express';
import { getOrCreateSafetyGraph, generateSanctionsLineage, detectSafetyClusters } from '../../services/safety/graph';
import { evaluateHiringSafety, canAutoMatch } from '../../services/safety/hiring-rules';
import { detectSafetyAnomalies } from '../../services/safety/anomaly-alerting';
import { generateSafetyGraphExport } from '../../services/safety/export';
import { anchorEvent } from '../../services/audit/anchor';
import { createHash } from 'crypto';

const router = Router();

router.get('/:clinicianId', async (req: Request, res: Response) => {
  try {
    const { clinicianId } = req.params;
    const graph = await getOrCreateSafetyGraph(clinicianId);
    return res.json(graph);
  } catch (error) {
    console.error('[safety:graph] failed', error);
    return res.status(500).json({
      error: 'safety_graph_failed',
      message: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
});

router.get('/:clinicianId/sanctions-lineage', async (req: Request, res: Response) => {
  try {
    const { clinicianId } = req.params;
    const years = req.query.years ? parseInt(req.query.years as string, 10) : 5;
    const lineage = await generateSanctionsLineage(clinicianId, years);
    return res.json(lineage);
  } catch (error) {
    console.error('[safety:lineage] failed', error);
    return res.status(500).json({
      error: 'sanctions_lineage_failed',
      message: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
});

router.post('/clusters/detect', async (req: Request, res: Response) => {
  try {
    const { clinicianIds, threshold } = req.body;
    if (!Array.isArray(clinicianIds) || clinicianIds.length === 0) {
      return res.status(400).json({ error: 'invalid_clinician_ids' });
    }
    const clusters = await detectSafetyClusters(clinicianIds, threshold ?? 0.7);
    return res.json({ clusters });
  } catch (error) {
    console.error('[safety:clusters] failed', error);
    return res.status(500).json({
      error: 'cluster_detection_failed',
      message: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
});

router.get('/:clinicianId/hiring-safety', async (req: Request, res: Response) => {
  try {
    const { clinicianId } = req.params;
    const result = await evaluateHiringSafety(clinicianId);
    return res.json(result);
  } catch (error) {
    console.error('[safety:hiring] failed', error);
    return res.status(500).json({
      error: 'hiring_safety_check_failed',
      message: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
});

router.get('/:clinicianId/can-auto-match/:jobId', async (req: Request, res: Response) => {
  try {
    const { clinicianId, jobId } = req.params;
    const allowed = await canAutoMatch(clinicianId, jobId);
    return res.json({ allowed, clinicianId, jobId });
  } catch (error) {
    console.error('[safety:auto-match] failed', error);
    return res.status(500).json({
      error: 'auto_match_check_failed',
      message: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
});

router.get('/:clinicianId/anomalies', async (req: Request, res: Response) => {
  try {
    const { clinicianId } = req.params;
    const anomalies = await detectSafetyAnomalies(clinicianId);
    return res.json({ anomalies });
  } catch (error) {
    console.error('[safety:anomalies] failed', error);
    return res.status(500).json({
      error: 'anomaly_detection_failed',
      message: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
});

router.get('/:clinicianId/export', async (req: Request, res: Response) => {
  try {
    const { clinicianId } = req.params;
    const exportData = await generateSafetyGraphExport(clinicianId);

    // Anchor the export
    const graphHash = createHash('sha256')
      .update(JSON.stringify(exportData.graph))
      .digest('hex');

    anchorEvent('safetyGraphAnchored', {
      clinicianId,
      graphHash,
      riskScore: exportData.graph.riskScore ?? 0,
      eventCount: exportData.events.length,
      criticalFlags: exportData.summary.criticalFlags,
    });

    return res.json(exportData);
  } catch (error) {
    console.error('[safety:export] failed', error);
    return res.status(500).json({
      error: 'export_generation_failed',
      message: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
});

export default router;


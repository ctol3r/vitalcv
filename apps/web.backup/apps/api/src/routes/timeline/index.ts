import { Router } from 'express';
import { z } from 'zod';
import {
  ingestTimelineEvents,
  normalizeTimelineEvents,
  inferMilestones,
  checkNCQACompliance,
  predictUpcomingMilestones,
  detectDiscrepancies,
  generateTimelineAuditPack,
  formatTimelineForPDF,
  formatTimelineForVC,
} from '@/services/timeline';
import { anchorTimelineSnapshot } from '@/services/timeline/anchor';

const router = Router();

const clinicianIdParam = z.object({
  clinicianId: z.string().min(1),
});

// Ingest timeline events
router.post('/:clinicianId/ingest', async (req, res) => {
  try {
    const { clinicianId } = clinicianIdParam.parse(req.params);
    const result = await ingestTimelineEvents(clinicianId);
    res.json(result);
  } catch (error) {
    console.error('[timeline] ingest error', error);
    res.status(500).json({ error: 'Failed to ingest timeline events' });
  }
});

// Get normalized timeline
router.get('/:clinicianId', async (req, res) => {
  try {
    const { clinicianId } = clinicianIdParam.parse(req.params);
    const ingestion = await ingestTimelineEvents(clinicianId);
    const normalized = normalizeTimelineEvents(ingestion.events);
    const milestones = inferMilestones(normalized);
    const predicted = predictUpcomingMilestones(normalized);
    const compliance = checkNCQACompliance(normalized, milestones);
    const discrepancies = detectDiscrepancies(normalized);

    res.json({
      clinicianId,
      events: normalized,
      milestones,
      predicted,
      compliance,
      discrepancies,
    });
  } catch (error) {
    console.error('[timeline] get error', error);
    res.status(500).json({ error: 'Failed to get timeline' });
  }
});

// Generate audit pack
router.post('/:clinicianId/audit-pack', async (req, res) => {
  try {
    const { clinicianId } = clinicianIdParam.parse(req.params);
    const ingestion = await ingestTimelineEvents(clinicianId);
    const normalized = normalizeTimelineEvents(ingestion.events);
    const milestones = inferMilestones(normalized);
    const predicted = predictUpcomingMilestones(normalized);
    const compliance = checkNCQACompliance(normalized, milestones);
    const discrepancies = detectDiscrepancies(normalized);

    const pack = generateTimelineAuditPack(
      clinicianId,
      normalized,
      milestones,
      predicted,
      compliance,
      discrepancies,
    );

    // Anchor to blockchain
    anchorTimelineSnapshot(pack);

    const format = req.query.format as string | undefined;

    if (format === 'pdf') {
      res.setHeader('Content-Type', 'text/plain');
      res.send(formatTimelineForPDF(pack));
    } else if (format === 'vc') {
      res.json(formatTimelineForVC(pack));
    } else {
      res.json(pack);
    }
  } catch (error) {
    console.error('[timeline] audit-pack error', error);
    res.status(500).json({ error: 'Failed to generate audit pack' });
  }
});

export default router;


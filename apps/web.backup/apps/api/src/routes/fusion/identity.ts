import { Router, type Request, type Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { runIdentityFusion } from '../../services/fusion/identity-fusion-v4';

const prisma = new PrismaClient();
const router = Router();

/**
 * GET /api/fusion/identity/:clinicianId
 * Get identity fusion snapshot for a clinician
 */
router.get('/identity/:clinicianId', async (req: Request, res: Response) => {
  const { clinicianId } = req.params;

  if (!clinicianId) {
    return res.status(400).json({ error: 'clinicianId is required' });
  }

  try {
    // Check for existing snapshot
    const snapshot = await prisma.identityFusionSnapshot.findUnique({
      where: { clinicianId },
    });

    if (snapshot) {
      // Get event log for transparency
      const eventLog = await prisma.identityEventLog.findMany({
        where: { clinicianId },
        orderBy: { timestamp: 'desc' },
        take: 10,
      });

      return res.json({
        clinicianId,
        fused: snapshot.fused,
        confidence: snapshot.confidence,
        timestamp: snapshot.timestamp.toISOString(),
        eventLog: eventLog.map((e) => ({
          eventType: e.eventType,
          changeHash: e.changeHash,
          timestamp: e.timestamp.toISOString(),
          metadata: e.metadata,
        })),
      });
    }

    // Run fusion if no snapshot exists
    const result = await runIdentityFusion(clinicianId, { prisma });

    return res.json({
      clinicianId: result.clinicianId,
      fused: result.fused,
      confidence: result.confidence,
      sources: result.sources.map((s) => ({
        sourceId: s.sourceId,
        sourceType: s.sourceType,
        confidence: s.confidence,
        timestamp: s.timestamp,
      })),
      conflicts: {
        total: result.conflicts.conflicts.length,
        resolved: result.conflicts.resolved.length,
        unresolved: result.conflicts.unresolved.length,
      },
      reliability: result.reliability,
      lineage: result.lineage,
      anchor: result.anchor,
    });
  } catch (error) {
    console.error('[fusion][identity] failed', error);
    return res.status(500).json({
      error: 'identity_fusion_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/fusion/identity/:clinicianId/refresh
 * Force refresh identity fusion snapshot
 */
router.post('/identity/:clinicianId/refresh', async (req: Request, res: Response) => {
  const { clinicianId } = req.params;

  if (!clinicianId) {
    return res.status(400).json({ error: 'clinicianId is required' });
  }

  try {
    const result = await runIdentityFusion(clinicianId, { prisma, skipAnchor: false });

    return res.json({
      clinicianId: result.clinicianId,
      fused: result.fused,
      confidence: result.confidence,
      sources: result.sources.map((s) => ({
        sourceId: s.sourceId,
        sourceType: s.sourceType,
        confidence: s.confidence,
        timestamp: s.timestamp,
      })),
      conflicts: {
        total: result.conflicts.conflicts.length,
        resolved: result.conflicts.resolved.length,
        unresolved: result.conflicts.unresolved.length,
      },
      reliability: result.reliability,
      anchor: result.anchor,
    });
  } catch (error) {
    console.error('[fusion][identity][refresh] failed', error);
    return res.status(500).json({
      error: 'identity_fusion_refresh_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/fusion/identity/:clinicianId/lineage
 * Get identity lineage (chain of evidence)
 */
router.get('/identity/:clinicianId/lineage', async (req: Request, res: Response) => {
  const { clinicianId } = req.params;

  if (!clinicianId) {
    return res.status(400).json({ error: 'clinicianId is required' });
  }

  try {
    const result = await runIdentityFusion(clinicianId, { prisma, skipAnchor: true });

    return res.json({
      clinicianId: result.clinicianId,
      lineage: result.lineage,
      sources: result.sources.map((s) => ({
        sourceId: s.sourceId,
        sourceType: s.sourceType,
        timestamp: s.timestamp,
      })),
    });
  } catch (error) {
    console.error('[fusion][identity][lineage] failed', error);
    return res.status(500).json({
      error: 'identity_lineage_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;


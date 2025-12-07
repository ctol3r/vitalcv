import { Router, type Request, type Response } from 'express';
import { PrismaClient } from '@prisma/client';
import {
  generateCredentialFabric,
  getCredentialFabricSnapshot,
  listCredentialFabricDiffs,
  replayCredentialFabricEvents,
} from '../../services/credentialFabric';

const prisma = new PrismaClient();
const router = Router();

router.get('/credentials/fabric/:clinicianId', async (req: Request, res: Response) => {
  try {
    const clinicianId = req.params.clinicianId;
    if (!clinicianId) {
      return res.status(400).json({ error: 'clinician_id_required' });
    }
    const refresh = String(req.query.refresh ?? 'false').toLowerCase() === 'true';
    const snapshot = await getCredentialFabricSnapshot(clinicianId, { prisma, refresh });
    if (!snapshot) {
      return res.status(404).json({ error: 'fabric_not_found' });
    }
    const includeDiffs = String(req.query.diffs ?? 'false').toLowerCase() === 'true';
    if (includeDiffs) {
      const diffs = await listCredentialFabricDiffs(clinicianId, { prisma, limit: 25 });
      return res.json({ ...snapshot, diffs });
    }
    return res.json(snapshot);
  } catch (error) {
    console.error('[credentials][fabric] fetch failed', error);
    return res.status(500).json({ error: 'fabric_fetch_failed', message: extractMessage(error) });
  }
});

router.post('/credentials/fabric/:clinicianId/rebuild', async (req: Request, res: Response) => {
  try {
    const clinicianId = req.params.clinicianId;
    if (!clinicianId) {
      return res.status(400).json({ error: 'clinician_id_required' });
    }
    const actor = req.body?.actor;
    const reason = req.body?.reason;
    const snapshot = await generateCredentialFabric(clinicianId, {
      prisma,
      actor,
      reason,
      force: true,
    });
    return res.json(snapshot);
  } catch (error) {
    console.error('[credentials][fabric] rebuild failed', error);
    return res.status(500).json({ error: 'fabric_rebuild_failed', message: extractMessage(error) });
  }
});

router.get('/credentials/fabric/:clinicianId/diffs', async (req: Request, res: Response) => {
  try {
    const clinicianId = req.params.clinicianId;
    if (!clinicianId) {
      return res.status(400).json({ error: 'clinician_id_required' });
    }
    const diffs = await listCredentialFabricDiffs(clinicianId, {
      prisma,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    return res.json({ clinicianId, diffs });
  } catch (error) {
    console.error('[credentials][fabric] diff fetch failed', error);
    return res.status(500).json({ error: 'fabric_diff_failed', message: extractMessage(error) });
  }
});

router.post('/credentials/fabric/:clinicianId/replay', async (req: Request, res: Response) => {
  try {
    const clinicianId = req.params.clinicianId;
    if (!clinicianId) {
      return res.status(400).json({ error: 'clinician_id_required' });
    }
    const upToVersion =
      typeof req.body?.version === 'number'
        ? req.body.version
        : typeof req.body?.version === 'string'
          ? Number(req.body.version)
          : undefined;
    const replayed = await replayCredentialFabricEvents(clinicianId, { prisma, upToVersion });
    if (!replayed) {
      return res.status(404).json({ error: 'fabric_events_not_found' });
    }
    return res.json(replayed);
  } catch (error) {
    console.error('[credentials][fabric] replay failed', error);
    return res.status(500).json({ error: 'fabric_replay_failed', message: extractMessage(error) });
  }
});

function extractMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export default router;


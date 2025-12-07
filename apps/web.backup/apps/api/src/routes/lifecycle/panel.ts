import { Router, type Request, type Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { RenewalTimelineBuilder } from '../../services/lifecycle/renewal-timeline';

const prisma = new PrismaClient();
const router = Router();
const timelineBuilder = new RenewalTimelineBuilder(prisma);

const DEFAULT_CLINICIAN_ID =
  process.env.NEXT_PUBLIC_WALLET_CLINICIAN_ID ??
  process.env.NEXT_PUBLIC_DEFAULT_CLINICIAN_ID ??
  process.env.DEFAULT_CLINICIAN_ID ??
  'wallet-demo-clinician';

router.get('/lifecycle/panel/:clinicianId?', async (req: Request, res: Response) => {
  const clinicianId =
    (typeof req.params.clinicianId === 'string' && req.params.clinicianId.trim().length
      ? req.params.clinicianId.trim()
      : null) ?? DEFAULT_CLINICIAN_ID;

  if (!clinicianId) {
    return res.status(400).json({ error: 'clinician_id_required' });
  }

  try {
    const now = new Date();
    const [lifecycleRecord, timeline, readinessSignal, evidencePack] = await Promise.all([
      prisma.providerLifecycle.findFirst({
        where: { clinicianId },
        orderBy: { updatedAt: 'desc' },
      }),
      timelineBuilder.build(clinicianId, { now }),
      prisma.readinessSignal.findFirst({
        where: { clinicianId, type: 'license' },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.evidencePack.findFirst({
        where: { clinicianId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const tasks = extractTasks(readinessSignal);

    return res.json({
      clinicianId,
      generatedAt: now.toISOString(),
      lifecycle: lifecycleRecord
        ? {
            id: lifecycleRecord.id,
            phase: lifecycleRecord.phase,
            updatedAt: lifecycleRecord.updatedAt.toISOString(),
            metadata: lifecycleRecord.metadata,
          }
        : null,
      timeline,
      alerts: timeline.alerts,
      tasks,
      evidencePack: evidencePack
        ? {
            id: evidencePack.id,
            createdAt: evidencePack.createdAt.toISOString(),
            items: evidencePack.items,
          }
        : null,
    });
  } catch (error) {
    console.error('[api][lifecycle][panel] failed', error);
    return res.status(500).json({
      error: 'lifecycle_panel_failed',
      message: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
});

function extractTasks(signal?: { metadata: Prisma.JsonValue | null }) {
  if (!signal?.metadata || typeof signal.metadata !== 'object' || Array.isArray(signal.metadata)) {
    return [];
  }
  const metadata = signal.metadata as Record<string, unknown>;
  const tasks = metadata['licenseTasks'];
  if (!Array.isArray(tasks)) {
    return [];
  }
  return tasks;
}

export default router;



import { Router, type Request, type Response } from 'express';
import { Prisma, PrismaClient } from '@prisma/client';

import { RiskEngine } from '../../services/risk/engine';

const prisma = new PrismaClient();
const router = Router();
const riskEngine = new RiskEngine({ prisma });
type RiskEvaluation = Awaited<ReturnType<RiskEngine['evaluate']>>;

router.get('/:clinicianId', async (req: Request, res: Response) => {
  const { clinicianId } = req.params;
  if (!clinicianId) {
    return res.status(400).json({
      error: 'clinician_id_required',
      message: 'Provide clinicianId to evaluate risk.',
    });
  }

  const refresh = String(req.query.refresh ?? '').toLowerCase() === 'true';

  try {
    if (refresh) {
      const evaluation = await riskEngine.evaluate(clinicianId, {
        recordEvents: true,
        recipients: [
          { id: 'issuer-routing', role: 'issuer' },
          { id: 'recruiter-routing', role: 'recruiter' },
        ],
      });
      return res.json(buildResponseFromEvaluation(evaluation));
    }

    const cached = await loadCachedRiskProfile(clinicianId);
    if (cached) {
      return res.json(cached);
    }

    const evaluation = await riskEngine.evaluate(clinicianId, {
      recordEvents: true,
    });
    return res.json(buildResponseFromEvaluation(evaluation));
  } catch (error) {
    console.error('[recruiter][risk] failed to evaluate risk profile', error);
    return res.status(500).json({
      error: 'risk_evaluation_failed',
      message: error instanceof Error ? error.message : 'Unable to compute risk profile',
    });
  }
});

async function loadCachedRiskProfile(clinicianId: string) {
  const composite = await prisma.riskEvent.findFirst({
    where: { clinicianId, type: 'composite' },
    orderBy: { createdAt: 'desc' },
  });

  if (!composite) {
    return null;
  }

  const componentEvents = await prisma.riskEvent.findMany({
    where: {
      clinicianId,
      type: { in: ['sanctions', 'fraud', 'npdb', 'behavior'] },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  const latestByType = groupByLatest(componentEvents);
  const metadata = composite.metadata as Record<string, unknown> | undefined;

  return {
    clinicianId,
    riskScore: composite.severity,
    updatedAt: composite.createdAt.toISOString(),
    reasonCodes: Array.isArray(metadata?.reasonCodes) ? (metadata!.reasonCodes as string[]) : [],
    mitigationSteps: Array.isArray(metadata?.notes) ? (metadata!.notes as string[]) : [],
    rationale: metadata ?? {},
    components: {
      sanctions: serializeComponent(latestByType.get('sanctions')),
      fraud: serializeComponent(latestByType.get('fraud')),
      behavior: serializeComponent(latestByType.get('behavior')),
      npdb: serializeComponent(latestByType.get('npdb')),
    },
    recentEvents: buildRecentEventSnapshot([composite, ...componentEvents].slice(0, 10)),
  };
}

function buildResponseFromEvaluation(result: RiskEvaluation) {
  return {
    clinicianId: result.clinicianId,
    riskScore: result.compositeRiskScore,
    updatedAt: result.updatedAt,
    rationale: result.rationale,
    components: {
      sanctions: { score: result.sanctionsScore, metadata: result.rationale.components?.sanctions },
      fraud: { score: result.fraudScore, metadata: result.rationale.components?.fraud },
      behavior: { score: result.behaviorScore, metadata: result.rationale.components?.behavior },
      npdb: { score: result.npdbScore, metadata: result.rationale.components?.npdb },
    },
    reasonCodes: result.reasonCodes,
    mitigationSteps: result.mitigationSteps,
    alerts: result.alerts,
    recentEvents: buildRecentEventSnapshot([]),
  };
}

function groupByLatest(events: Prisma.RiskEventGetPayload<{}>[]) {
  const map = new Map<string, Prisma.RiskEventGetPayload<{}>>();
  for (const event of events) {
    if (!map.has(event.type)) {
      map.set(event.type, event);
    }
  }
  return map;
}

function serializeComponent(event?: Prisma.RiskEventGetPayload<{}>) {
  if (!event) {
    return null;
  }
  return {
    score: event.severity,
    metadata: event.metadata,
    observedAt: event.createdAt.toISOString(),
  };
}

function buildRecentEventSnapshot(events: Prisma.RiskEventGetPayload<{}>[]) {
  return events.map((event) => ({
    id: event.id,
    type: event.type,
    severity: event.severity,
    createdAt: event.createdAt.toISOString(),
    metadata: event.metadata,
  }));
}

export default router;


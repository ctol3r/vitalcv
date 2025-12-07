import { Router, type Request, type Response } from 'express';
import { PrismaClient } from '@prisma/client';
import {
  ReadinessEngine,
  buildDefaultSignals,
  type ReadinessOverrides,
} from '../../../services/readiness/engine';
import { anchorSurgeReadiness } from '../../../services/audit/anchor';

const router = Router();
const prisma = new PrismaClient();
const readinessEngine = new ReadinessEngine();

interface SurgeCreateRequest {
  orgId: string;
  specialty: string;
  region: string;
  clinicianIds: string[];
  minimumScore?: number;
  signals?: Record<string, ReadinessOverrides>;
}

router.post('/', async (req: Request<unknown, unknown, SurgeCreateRequest>, res: Response) => {
  try {
    const payload = validateRequest(req.body);
    const existing = await prisma.clinicianReadinessScore.findMany({
      where: { clinicianId: { in: payload.clinicianIds } },
    });
    const readinessMap = new Map<
      string,
      { clinicianId: string; score: number; factors: Record<string, unknown> }
    >();

    existing.forEach((record) => {
      readinessMap.set(record.clinicianId, {
        clinicianId: record.clinicianId,
        score: record.score,
        factors: (record.factors as Record<string, unknown>) ?? {},
      });
    });

    const missing = payload.clinicianIds.filter((id) => !readinessMap.has(id));
    if (missing.length) {
      for (const clinicianId of missing) {
        const signals = buildDefaultSignals(clinicianId, payload.signals?.[clinicianId]);
        const result = await readinessEngine.evaluateAndStore(signals);
        readinessMap.set(clinicianId, {
          clinicianId,
          score: result.score,
          factors: result.factors,
        });
      }
    }

    const minimumScore = payload.minimumScore ?? 0.8;
    const members = payload.clinicianIds
      .map((clinicianId) => readinessMap.get(clinicianId))
      .filter((record): record is NonNullable<typeof record> => Boolean(record))
      .filter((record) => record.score >= minimumScore)
      .map((record) => ({
        clinicianId: record.clinicianId,
        readinessScore: record.score,
        factors: record.factors,
      }));

    const surgePoolId = `surge_${Date.now().toString(36)}`;

    if (members.length > 0) {
      await prisma.$transaction(
        members.map((member) =>
          prisma.hiringRecommendation.create({
            data: {
              orgId: payload.orgId,
              clinicianId: member.clinicianId,
              score: member.readinessScore,
              rationale: {
                surgePoolId,
                specialty: payload.specialty,
                region: payload.region,
                factors: member.factors,
              },
            },
          })
        )
      );

      await Promise.all(
        members.map((member) =>
          anchorSurgeReadiness({
            surgePoolId,
            clinicianId: member.clinicianId,
            readinessScore: member.readinessScore,
            metadata: {
              specialty: payload.specialty,
              region: payload.region,
            },
          }).catch((error) => {
            console.warn('[SurgeCreate] Failed to anchor readiness score', error);
            return null;
          })
        )
      );
    }

    return res.status(201).json({
      poolId: surgePoolId,
      requested: payload.clinicianIds.length,
      eligible: members.length,
      minimumScore,
      members,
    });
  } catch (error) {
    console.error('[Recruiter] Surge pool creation failed', error);
    return res.status(400).json({
      error: 'surge_create_failed',
      error_description: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

function validateRequest(body: SurgeCreateRequest): SurgeCreateRequest {
  if (!body?.orgId) throw new Error('orgId is required');
  if (!body.specialty) throw new Error('specialty is required');
  if (!body.region) throw new Error('region is required');
  if (!Array.isArray(body.clinicianIds) || body.clinicianIds.length === 0) {
    throw new Error('At least one clinicianId must be provided');
  }
  return body;
}

export default router;



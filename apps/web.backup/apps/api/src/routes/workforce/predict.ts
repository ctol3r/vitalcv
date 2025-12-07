import { Router, type Request, type Response } from 'express';
import { PrismaClient, type WorkforcePredictor } from '@prisma/client';
import {
  computeWorkforceShortage,
  type WorkforceSignalInput,
} from '../../services/workforce/engine';
import {
  dispatchPredictorFeedback,
  type PredictorFeedbackInput,
} from '../../services/workforce/feedback';

const router = Router();
const prisma = new PrismaClient();

const CACHE_TTL_MS = 45_000;

interface CacheEntry {
  expiresAt: number;
  payload: WorkforcePredictionResponse;
}

interface WorkforcePredictionResponse {
  shortageIndex: number;
  reasoning: ReturnType<typeof computeWorkforceShortage>['rationale'];
  specialtiesImpacted: ReturnType<typeof computeWorkforceShortage>['affectedSpecialties'];
  recommendedHires: number;
}

const cache = new Map<string, CacheEntry>();

router.get('/workforce/predict/:orgId', async (req: Request, res: Response) => {
  const orgId = req.params.orgId;
  if (!orgId) {
    return res.status(400).json({
      error: 'missing_org_id',
      message: 'Organization id is required',
    });
  }

  const region = typeof req.query.region === 'string' ? req.query.region : undefined;
  const specialtiesFilter = normalizeToArray(req.query.specialty ?? req.query.specialties);
  const cacheKey = JSON.stringify({ orgId, region, specialtiesFilter });
  const cached = readFromCache(cacheKey);

  if (cached) {
    return res.json({ ...cached, cached: true });
  }

  try {
    const predictors = await prisma.workforcePredictor.findMany({
      where: {
        orgId,
        ...(region ? { region } : {}),
        ...(specialtiesFilter.length ? { specialty: { in: specialtiesFilter } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 250,
    });

    const signals = predictors.length ? dedupePredictors(predictors) : buildFallbackSignals(orgId, region);
    const prediction = computeWorkforceShortage(signals.inputs);
    const recommendedHires = calculateRecommendedHires(signals.inputs, prediction.shortageIndex);

    const payload: WorkforcePredictionResponse = {
      shortageIndex: prediction.shortageIndex,
      reasoning: prediction.rationale,
      specialtiesImpacted: prediction.affectedSpecialties,
      recommendedHires,
    };

    cache.set(cacheKey, {
      payload,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    if (prediction.shortageIndex >= 0.5 && prediction.affectedSpecialties.length) {
      try {
        const feedbackPayload: PredictorFeedbackInput = {
          orgId,
          shortageIndex: prediction.shortageIndex,
          specialties: prediction.affectedSpecialties,
          rationale: prediction.rationale,
          recommendedHires: recommendedHires,
        };
        await dispatchPredictorFeedback(feedbackPayload);
      } catch (feedbackError) {
        console.error('workforce feedback loop failed', feedbackError);
      }
    }

    return res.json(payload);
  } catch (error: any) {
    console.error('Failed to generate workforce prediction', error);
    return res.status(500).json({
      error: 'workforce_prediction_failed',
      message: error?.message ?? 'Unable to compute workforce shortage prediction',
    });
  }
});

function readFromCache(key: string): WorkforcePredictionResponse | null {
  const entry = cache.get(key);
  if (!entry) {
    return null;
  }
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.payload;
}

function normalizeToArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map(String).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function dedupePredictors(records: WorkforcePredictor[]) {
  const seen = new Set<string>();
  const inputs: WorkforceSignalInput[] = [];

  records.forEach((record) => {
    const key = `${record.region}:${record.specialty}`.toLowerCase();
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    inputs.push(transformSignal(record));
  });

  return { inputs };
}

function transformSignal(record: WorkforcePredictor): WorkforceSignalInput {
  const payload = (record.signals as Record<string, unknown>) ?? {};
  const licenseIssuanceVelocity = pickNumber(payload, [
    'licenseIssuanceVelocity',
    'licenseVelocity',
    'issuanceVelocity',
  ]) ?? 9;
  const expiringCredentials =
    pickNumber(payload, ['expiringCredentials', 'credentialExpirations', 'expiring']) ?? 12;
  const sanctionsDensity = clamp01(
    pickNumber(payload, ['sanctionsDensity', 'sanctionDensity', 'sanctions']) ?? 0.04,
  );
  const compactEligibilityRate = clamp01(
    pickNumber(payload, ['compactEligibilityRate', 'compactRate', 'compact']) ?? 0.55,
  );
  const seasonalTrend = pickNumber(payload, ['seasonalTrend', 'seasonality']) ?? 0;
  const retirementsProjection = pickNumber(payload, ['retirements', 'retirementRisk']) ?? 0;

  return {
    specialty: record.specialty,
    region: record.region,
    licenseIssuanceVelocity,
    expiringCredentials,
    sanctionsDensity,
    compactEligibilityRate,
    seasonalTrend,
    retirementsProjection,
  };
}

function pickNumber(source: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = source?.[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
  }
  return undefined;
}

function calculateRecommendedHires(inputs: WorkforceSignalInput[], shortageIndex: number): number {
  const expiringTotal = inputs.reduce((sum, signal) => sum + Math.max(0, signal.expiringCredentials), 0);
  const sanctionsPressure = inputs.reduce((sum, signal) => sum + signal.sanctionsDensity, 0);

  const baseline = Math.max(1, inputs.length);
  const shortageLift = shortageIndex * (expiringTotal * 0.4 + baseline * 2);
  const sanctionsLift = sanctionsPressure * 6;

  return Math.round(baseline + shortageLift + sanctionsLift);
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function buildFallbackSignals(orgId: string, region?: string): { inputs: WorkforceSignalInput[] } {
  return {
    inputs: [
      {
        specialty: 'General',
        region: region ?? 'global',
        licenseIssuanceVelocity: 10,
        expiringCredentials: 8,
        sanctionsDensity: 0.02,
        compactEligibilityRate: 0.6,
      },
    ],
  };
}

export default router;


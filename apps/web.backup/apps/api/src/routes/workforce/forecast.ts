import { Router, type Request, type Response } from 'express';
import { PrismaClient, type WorkforceTrend } from '@prisma/client';
import { mapTrendRecord } from '../../services/workforce/trends';
import {
  generateWorkforceForecast,
  type WorkforceForecastEntry,
} from '../../services/workforce/forecast';
import { evaluateWorkforceAlerts } from '../../services/alerts/workforce';

const prisma = new PrismaClient();
const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const regionFilter = typeof req.query.region === 'string' ? req.query.region : undefined;
    const specialtyFilter =
      typeof req.query.specialty === 'string' ? req.query.specialty : undefined;

    const trends = await loadTrends(regionFilter, specialtyFilter);
    const forecasts = generateWorkforceForecast(trends);
    const alerts = evaluateWorkforceAlerts(forecasts);

    const heatmap = buildHeatmap(forecasts);

    return res.json({
      generatedAt: new Date().toISOString(),
      filters: {
        region: regionFilter,
        specialty: specialtyFilter,
      },
      forecasts,
      heatmap,
      alerts,
    });
  } catch (error) {
    console.error('[Workforce][forecast] failed', error);
    return res.status(500).json({
      error: 'workforce_forecast_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

async function loadTrends(region?: string, specialty?: string) {
  const records = await prisma.workforceTrend.findMany({
    where: {
      ...(region ? { region } : {}),
      ...(specialty ? { specialty } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  if (records.length) {
    return dedupeTrends(records);
  }

  return buildSyntheticTrends(region, specialty);
}

function dedupeTrends(records: WorkforceTrend[]) {
  const seen = new Set<string>();
  const result = [];

  for (const record of records) {
    const key = `${record.specialty}:${record.region}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(mapTrendRecord(record));
  }

  return result;
}

function buildSyntheticTrends(region?: string, specialty?: string) {
  const specialties = specialty ? [specialty] : ['Hospitalist', 'Cardiology', 'Psychiatry'];
  const regions = region ? [region] : ['Northeast', 'Midwest', 'South', 'West'];

  const trends = [];
  for (const spec of specialties) {
    regions.forEach((reg, index) => {
      trends.push({
        specialty: spec,
        region: reg,
        demandMomentum: clamp(0.4 + 0.1 * index),
        supplyElasticity: clamp(0.7 - 0.05 * index),
        credentialRisk: clamp(0.2 + 0.1 * (index % 2)),
        shortagePressure: clamp(0.5 + 0.05 * index),
        signalConfidence: 0.7,
        metadata: {},
      });
    });
  }
  return trends;
}

function buildHeatmap(forecasts: WorkforceForecastEntry[]) {
  const regionBuckets = new Map<
    string,
    { region: string; shortageIndex: number; count: number; highestRisk: string }
  >();

  forecasts.forEach((forecast) => {
    const bucket = regionBuckets.get(forecast.region) ?? {
      region: forecast.region,
      shortageIndex: 0,
      count: 0,
      highestRisk: forecast.specialty,
    };
    bucket.shortageIndex += forecast.shortageIndex;
    bucket.count += 1;
    if (forecast.shortageIndex > (bucket.shortageIndex / bucket.count ?? 0)) {
      bucket.highestRisk = forecast.specialty;
    }
    regionBuckets.set(forecast.region, bucket);
  });

  return Array.from(regionBuckets.values()).map((bucket) => {
    const index = bucket.count ? bucket.shortageIndex / bucket.count : 0;
    return {
      region: bucket.region,
      shortageIndex: clamp(index),
      riskLevel: classifyRisk(index),
      headlineSpecialty: bucket.highestRisk,
    };
  });
}

function clamp(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function classifyRisk(score: number): 'low' | 'moderate' | 'high' | 'critical' {
  if (score >= 0.8) return 'critical';
  if (score >= 0.6) return 'high';
  if (score >= 0.4) return 'moderate';
  return 'low';
}

export default router;


import { Router, type Request, type Response } from 'express';
import { PrismaClient, type Prisma } from '@prisma/client';
import { summarizeTopFeatures, type TopFeature } from '../../services/ai/explain';

const prisma = new PrismaClient();
const router = Router();
type ExplainableDecisionRecord = Prisma.ExplainableDecisionGetPayload<{}>;

router.get('/ai/decisions', async (req: Request, res: Response) => {
  const limit = normalizeLimit(req.query.limit);
  const outcome = typeof req.query.outcome === 'string' ? req.query.outcome : undefined;

  try {
    const decisions = await prisma.explainableDecision.findMany({
      where: outcome ? { outcome } : undefined,
      orderBy: { timestamp: 'desc' },
      take: limit,
    });

    const enriched = decisions.map((record) => decorateRecord(record));
    return res.json({
      success: true,
      total: enriched.length,
      decisions: enriched,
    });
  } catch (error) {
    console.error('[ai][decisions] list failed', error);
    return res.status(500).json({
      success: false,
      error: 'decision_list_failed',
      message: error instanceof Error ? error.message : 'Unable to load AI decisions',
    });
  }
});

function normalizeLimit(rawLimit: unknown): number {
  const parsed = Number.parseInt(String(rawLimit ?? 25), 10);
  if (!Number.isFinite(parsed)) return 25;
  return Math.max(5, Math.min(parsed, 100));
}

function decorateRecord(record: ExplainableDecisionRecord) {
  const features = toNumberMap(record.features);
  const weights = toNumberMap(record.weights);
  const topFeatures = summarizeTopFeatures(features, weights);
  return {
    id: record.id,
    decision: record.decision,
    outcome: record.outcome,
    timestamp: record.timestamp.toISOString(),
    topFeatures,
    dominantFeature: topFeatures[0] ?? null,
    featureSpread: buildFeatureSpread(topFeatures),
  };
}

function toNumberMap(value: Prisma.JsonValue | null): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  const entries = Object.entries(value as Record<string, unknown>);
  return entries.reduce<Record<string, number>>((acc, [key, raw]) => {
    const num = Number(raw);
    if (Number.isFinite(num)) {
      acc[key] = num;
    }
    return acc;
  }, {});
}

function buildFeatureSpread(topFeatures: TopFeature[]) {
  const total = topFeatures.reduce((sum, feature) => sum + Math.abs(feature.contribution), 0) || 1;
  return topFeatures.map((feature) => ({
    feature: feature.feature,
    share: Number((Math.abs(feature.contribution) / total).toFixed(3)),
    direction: feature.direction,
  }));
}

export default router;



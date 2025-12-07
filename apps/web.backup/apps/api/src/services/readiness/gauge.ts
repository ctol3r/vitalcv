import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface ReadinessGaugeData {
  scope: string;
  score: number; // 0-1
  metrics: {
    individualReadiness: number;
    credentialContinuity: number;
    privilegeCoverage: number;
    burnoutRisk: number;
  };
  trend: 'improving' | 'declining' | 'stable';
}

/**
 * Aggregate readiness gauge
 */
export async function aggregateReadinessGauge(scope: string): Promise<ReadinessGaugeData> {
  // Get or create gauge
  let gauge = await prisma.readinessGauge.findUnique({
    where: { scope },
  });

  if (!gauge) {
    // Create default gauge
    gauge = await prisma.readinessGauge.create({
      data: {
        scope,
        score: 0.5,
        metrics: {
          individualReadiness: 0.5,
          credentialContinuity: 0.5,
          privilegeCoverage: 0.5,
          burnoutRisk: 0.5,
        },
      },
    });
  }

  const metrics = gauge.metrics as ReadinessGaugeData['metrics'];

  // Compute weighted score
  const score = (
    metrics.individualReadiness * 0.3 +
    metrics.credentialContinuity * 0.3 +
    metrics.privilegeCoverage * 0.3 -
    metrics.burnoutRisk * 0.1
  );

  // Determine trend (simplified)
  const trend: ReadinessGaugeData['trend'] = score > 0.7 ? 'improving' : score < 0.5 ? 'declining' : 'stable';

  return {
    scope,
    score: Math.max(0, Math.min(1, score)),
    metrics,
    trend,
  };
}


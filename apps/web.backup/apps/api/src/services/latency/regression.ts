import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface RegressionAlert {
  metric: string;
  previousValue: number;
  currentValue: number;
  changePercent: number;
  severity: 'low' | 'medium' | 'high';
}

const REGRESSION_THRESHOLD = 0.2; // 20% worsening

/**
 * Detect latency regression
 */
export async function detectLatencyRegression(
  credentialId: string,
  threshold: number = REGRESSION_THRESHOLD,
): Promise<RegressionAlert[]> {
  const latency = await prisma.credentialLatency.findUnique({
    where: { credentialId },
  });

  if (!latency) return [];

  const metrics = latency.metrics as Record<string, unknown>;
  const stepDurations = (metrics.stepDurations as Record<string, number>) || {};
  const historical = (metrics.historical as Array<{ timestamp: Date; stepDurations: Record<string, number> }>) || [];

  if (historical.length < 2) return [];

  const alerts: RegressionAlert[] = [];
  const previous = historical[historical.length - 2];
  const current = historical[historical.length - 1];

  for (const [step, currentDuration] of Object.entries(stepDurations)) {
    const previousDuration = previous.stepDurations[step];
    if (!previousDuration) continue;

    const changePercent = (currentDuration - previousDuration) / previousDuration;

    if (changePercent > threshold) {
      const severity = changePercent > 0.5 ? 'high' : changePercent > 0.3 ? 'medium' : 'low';
      alerts.push({
        metric: step,
        previousValue: previousDuration,
        currentValue: currentDuration,
        changePercent,
        severity,
      });
    }
  }

  return alerts;
}


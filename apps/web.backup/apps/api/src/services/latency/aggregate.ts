import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface LatencyMetrics {
  stepDurations: Record<string, number>;
  endToEndDuration: number;
  averageStepDuration: number;
  slowestStep: string;
  fastestStep: string;
}

/**
 * Aggregate latency metrics for a credential
 */
export async function aggregateLatencyMetrics(credentialId: string): Promise<LatencyMetrics | null> {
  const latency = await prisma.credentialLatency.findUnique({
    where: { credentialId },
  });

  if (!latency) return null;

  const metrics = latency.metrics as Record<string, unknown>;
  const stepDurations = (metrics.stepDurations as Record<string, number>) || {};
  const endToEnd = (metrics.endToEndDuration as number) || 0;

  const durations = Object.values(stepDurations);
  const averageStepDuration = durations.length > 0
    ? durations.reduce((a, b) => a + b, 0) / durations.length
    : 0;

  const slowestStep = Object.entries(stepDurations).reduce((max, [step, duration]) =>
    duration > max[1] ? [step, duration] : max,
    ['', 0],
  )[0];

  const fastestStep = Object.entries(stepDurations).reduce((min, [step, duration]) =>
    duration < min[1] || min[1] === 0 ? [step, duration] : min,
    ['', Infinity],
  )[0];

  return {
    stepDurations,
    endToEndDuration: endToEnd,
    averageStepDuration,
    slowestStep,
    fastestStep,
  };
}


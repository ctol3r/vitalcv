import { recordAnalyticsEvent } from '../analytics/models/AnalyticsEvent';

export interface PilotSmokeTestStep {
  step: string;
  status: 'success' | 'failure';
  duration: number;
  timestamp: string;
  error?: string;
  details?: Record<string, unknown>;
}

export interface PilotSmokeTestSummary {
  passed: number;
  failed: number;
  total: number;
}

export interface PilotSmokeTestResult {
  success: boolean;
  totalDuration: number;
  timestamp: string;
  steps: PilotSmokeTestStep[];
  summary: PilotSmokeTestSummary;
  errorMessage?: string;
}

export interface PilotSmokeAnalyticsContext {
  runId?: string;
  triggeredBy?: string;
}

function buildMetadata(
  result: PilotSmokeTestResult,
  context: PilotSmokeAnalyticsContext
) {
  const failures = result.steps
    .filter((step) => step.status === 'failure')
    .map((step) => ({
      step: step.step,
      error: step.error,
    }));

  return {
    success: result.success,
    totalDurationMs: result.totalDuration,
    timestamp: result.timestamp,
    summary: result.summary,
    failures,
    failedStepCount: failures.length,
    triggeredBy: context.triggeredBy ?? 'pilot-smoke',
    errorMessage: result.errorMessage ?? null,
  };
}

export async function recordPilotSmokeRun(
  result: PilotSmokeTestResult,
  context: PilotSmokeAnalyticsContext = {}
) {
  const metadata = buildMetadata(result, context);

  await recordAnalyticsEvent({
    eventType: 'PILOT_SMOKE_RUN',
    subjectId: context.runId ?? result.timestamp,
    metadata,
  });
}

/**
 * B163C-AN-006: Pilot smoke test analytics logger
 *
 * Each run of the pilot smoke test should emit a `PILOT_SMOKE_RUN` analytics
 * event so we can chart reliability over time.
 */

import { recordAnalyticsEvent } from '../analytics/models/AnalyticsEvent';

export interface PilotSmokeAnalyticsInput {
  runId?: string;
  orgId?: string | null;
  ok: boolean;
  totalDuration: number;
  startedAt?: string | Date;
  finishedAt?: string | Date;
  errorMessage?: string;
}

export async function recordPilotSmokeRun(
  input: PilotSmokeAnalyticsInput
): Promise<void> {
  await recordAnalyticsEvent({
    eventType: 'PilotSmokeRun',
    subjectId: input.runId,
    orgId: input.orgId ?? null,
    timestamp: input.finishedAt ? new Date(input.finishedAt) : undefined,
    metadata: {
      ok: input.ok,
      totalDuration: input.totalDuration,
      startedAt: input.startedAt
        ? new Date(input.startedAt).toISOString()
        : undefined,
      finishedAt: input.finishedAt
        ? new Date(input.finishedAt).toISOString()
        : undefined,
      errorMessage: input.errorMessage,
    },
  });
}

export default {
  recordPilotSmokeRun,
};


import { PrismaClient } from '@prisma/client';
import { getServiceLogger } from '../../../../services/logging/serviceLogger';
import type { ScreeningComponentStatus } from './types';
import { AutoScreeningEngine, type AutoScreeningResult, type AutoScreeningOptions } from './screen';

const prisma = new PrismaClient();
const log = getServiceLogger('api/services/ats/readiness');
const screeningEngine = new AutoScreeningEngine(prisma);

export interface PositionReadinessInput extends AutoScreeningOptions {
  jobId?: string;
  priorityStates?: string[];
}

export interface PositionReadinessResult {
  clinicianId: string;
  orgId?: string | null;
  jobId?: string;
  score: number;
  decision: 'ready' | 'needs_review' | 'blocked';
  components: {
    screening: number;
    baseline: number;
    coverage: number;
  };
  readinessBaseline: number;
  screening: AutoScreeningResult;
  notes: string[];
  updatedAt: string;
  positionContext: {
    minYearsExperience?: number;
    requiresBoardCertified?: boolean;
    requiresCompact?: boolean;
    priorityStates?: string[];
  };
}

export async function computePositionReadiness(
  input: PositionReadinessInput,
): Promise<PositionReadinessResult> {
  const [screening, readinessRecord] = await Promise.all([
    screeningEngine.run(input),
    prisma.clinicianReadinessScore.findUnique({
      where: { clinicianId: input.clinicianId },
    }),
  ]);

  const baseline = readinessRecord?.score ?? 0.68;
  const screeningFactor = average(
    screening.components.map((component) => statusToScore(component.status)),
  );
  const coverage = deriveCoverageFactor(
    screening.compactEligibleStates,
    input.priorityStates ?? [],
  );
  const score = Number((baseline * 0.5 + screeningFactor * 0.35 + coverage * 0.15).toFixed(4));
  const decision = deriveDecision(score, screening.verdict);
  const notes = buildNotes({
    score,
    screening,
    baseline,
    coverage,
    decision,
    requiresCompact: input.requireCompact ?? false,
  });

  log.info('Position readiness score computed', {
    clinicianId: input.clinicianId,
    jobId: input.jobId,
    score,
    decision,
  });

  return {
    clinicianId: input.clinicianId,
    orgId: input.orgId ?? screening.orgId ?? null,
    jobId: input.jobId,
    score,
    decision,
    components: {
      screening: Number(screeningFactor.toFixed(4)),
      baseline: Number(baseline.toFixed(4)),
      coverage: Number(coverage.toFixed(4)),
    },
    readinessBaseline: Number(baseline.toFixed(4)),
    screening,
    notes,
    updatedAt: new Date().toISOString(),
    positionContext: {
      minYearsExperience: input.minYearsExperience,
      requiresBoardCertified: input.requireBoardCertified,
      requiresCompact: input.requireCompact,
      priorityStates: input.priorityStates,
    },
  };
}

function statusToScore(status: ScreeningComponentStatus): number {
  switch (status) {
    case 'pass':
      return 1;
    case 'review':
      return 0.65;
    case 'fail':
    default:
      return 0.15;
  }
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

function deriveCoverageFactor(eligibleStates: string[], priorityStates: string[]): number {
  if (priorityStates.length === 0) {
    return Math.min(1, eligibleStates.length / 5);
  }
  if (eligibleStates.length === 0) {
    return 0.1;
  }
  const normalizedEligible = new Set(eligibleStates.map((state) => state.toUpperCase()));
  const normalizedPriority = priorityStates.map((state) => state.toUpperCase());
  const matches = normalizedPriority.filter((state) => normalizedEligible.has(state));
  return matches.length / normalizedPriority.length;
}

function deriveDecision(score: number, verdict: ScreeningComponentStatus): PositionReadinessResult['decision'] {
  if (verdict === 'fail' || score < 0.45) {
    return 'blocked';
  }
  if (verdict === 'review' || score < 0.72) {
    return 'needs_review';
  }
  return 'ready';
}

function buildNotes(params: {
  score: number;
  screening: AutoScreeningResult;
  baseline: number;
  coverage: number;
  decision: PositionReadinessResult['decision'];
  requiresCompact: boolean;
}): string[] {
  const notes: string[] = [];
  notes.push(`Position readiness score ${params.score.toFixed(2)}.`);
  if (params.decision === 'blocked') {
    const failing = params.screening.components.filter((component) => component.status === 'fail');
    failing.forEach((component) => {
      notes.push(`Blocking factor: ${component.key} (${component.detail}).`);
    });
  }
  if (params.requiresCompact && params.coverage < 0.5) {
    notes.push('Compact coverage below target for this job.');
  }
  if (params.screening.verdict === 'review') {
    notes.push('Auto-screening flagged components that need human review.');
  }
  if (params.baseline < 0.6) {
    notes.push('Clinician readiness baseline is below fleet average.');
  }
  return notes;
}


export interface DecisionCapsuleLearningInput {
  decisionTimestamp: string;
  decisionAction?: string | null;
  metadata?: unknown;
}

export interface BlockerFrequencyEntry {
  blocker: string;
  count: number;
  frequency: number;
}

export interface DeterministicLearningSignals {
  sample_size: number;
  acceptance_rate: number;
  avg_days: number | null;
  blocker_frequency: BlockerFrequencyEntry[];
}

export interface DeterministicLearningExplainability {
  acceptance: {
    considered_decisions: number;
    accepted_decisions: number;
    formula: 'accepted_decisions / considered_decisions';
  };
  avg_days: {
    matched_start_count: number;
    formula: 'sum(day_deltas) / matched_start_count';
  };
  blocker_frequency: {
    denominator: number;
    formula: 'blocker_count / sample_size';
  };
  probability_adjustment: {
    base_acceptance: number;
    observed_acceptance_rate: number;
    raw_delta: number;
    bounded_delta: number;
    max_abs_delta: number;
    formula: 'clamp(observed_acceptance_rate - base_acceptance, -max_abs_delta, max_abs_delta)';
  };
  time_adjustment: {
    base_startability: number | null;
    observed_avg_days: number | null;
    blend_weight: number;
    sample_cap: number;
    formula: 'base_startability * (1 - blend_weight) + observed_avg_days * blend_weight';
  };
}

export interface DeterministicLearningResult {
  sample_size: number;
  acceptance_rate: number;
  avg_days: number | null;
  blocker_frequency: BlockerFrequencyEntry[];
  probability_adjustment: {
    adjusted_acceptance: number;
    bounded_delta: number;
  };
  time_adjustment: {
    adjusted_days: number | null;
    blend_weight: number;
  };
  explainability: DeterministicLearningExplainability;
}

export interface DeterministicLearningInput {
  capsules: readonly DecisionCapsuleLearningInput[];
  base_acceptance: number;
  base_startability: number | null;
}

export interface DecisionCapsuleLearningSignal {
  acceptance_rate: number;
  avg_days_to_start: number | null;
  common_blockers: Array<{
    blocker: string;
    count: number;
  }>;
}

type DecisionCapsuleMetadata = {
  outcome?: unknown;
  blockers?: unknown;
  topBlockers?: unknown;
  acceptanceId?: unknown;
  startedAt?: unknown;
};

type ReducedLearningStats = {
  consideredDecisions: number;
  acceptedDecisions: number;
  blockerCounts: Map<string, number>;
  acceptanceTimestamps: Map<string, number>;
  startTimestamps: Map<string, number>;
};

const MAX_ACCEPTANCE_ADJUSTMENT = 0.2;
const TIME_BLEND_SAMPLE_CAP = 10;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function asMetadata(value: unknown): DecisionCapsuleMetadata {
  return isRecord(value) ? value as DecisionCapsuleMetadata : {};
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
    : [];
}

function normalizeOutcome(capsule: DecisionCapsuleLearningInput): string | null {
  const metadata = asMetadata(capsule.metadata);
  const metadataOutcome = asString(metadata.outcome);
  if (metadataOutcome) {
    return metadataOutcome.toUpperCase();
  }

  const decisionAction = asString(capsule.decisionAction);
  if (!decisionAction) {
    return null;
  }

  switch (decisionAction.toUpperCase()) {
    case 'APPROVE':
      return 'ACCEPTED';
    case 'REJECT':
      return 'REJECTED';
    case 'CONDITIONAL_APPROVE':
      return 'CONDITIONAL_APPROVE';
    case 'START_ATTESTATION':
      return 'START_ATTESTATION';
    default:
      return decisionAction.toUpperCase();
  }
}

function parseTimestamp(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value: number, decimals: number): number {
  return Number(value.toFixed(decimals));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function normalizeBaseAcceptance(value: number): number {
  return clamp(Number.isFinite(value) ? value : 0, 0, 1);
}

function normalizeBaseStartability(value: number | null): number | null {
  if (value === null || typeof value === 'undefined') {
    return null;
  }

  return Number.isFinite(value) && value >= 0 ? round(value, 2) : null;
}

function reduceCapsules(
  capsules: readonly DecisionCapsuleLearningInput[],
): ReducedLearningStats {
  const stats: ReducedLearningStats = {
    consideredDecisions: 0,
    acceptedDecisions: 0,
    blockerCounts: new Map<string, number>(),
    acceptanceTimestamps: new Map<string, number>(),
    startTimestamps: new Map<string, number>(),
  };

  for (const capsule of capsules) {
    const metadata = asMetadata(capsule.metadata);
    const outcome = normalizeOutcome(capsule);
    const decisionTimestamp = parseTimestamp(capsule.decisionTimestamp);
    const acceptanceId = asString(metadata.acceptanceId);

    if (outcome !== 'START_ATTESTATION') {
      const uniqueBlockers = [...new Set([
        ...asStringArray(metadata.blockers),
        ...asStringArray(metadata.topBlockers),
      ])];

      for (const blocker of uniqueBlockers) {
        stats.blockerCounts.set(blocker, (stats.blockerCounts.get(blocker) ?? 0) + 1);
      }
    }

    if (outcome && outcome !== 'START_ATTESTATION') {
      stats.consideredDecisions += 1;

      if (outcome === 'ACCEPTED') {
        stats.acceptedDecisions += 1;
      }
    }

    if (!acceptanceId) {
      continue;
    }

    if (outcome === 'ACCEPTED' && decisionTimestamp !== null) {
      const existingAcceptedAt = stats.acceptanceTimestamps.get(acceptanceId);
      if (existingAcceptedAt === undefined || decisionTimestamp < existingAcceptedAt) {
        stats.acceptanceTimestamps.set(acceptanceId, decisionTimestamp);
      }
    }

    if (outcome === 'START_ATTESTATION') {
      const startedAt = parseTimestamp(asString(metadata.startedAt)) ?? decisionTimestamp;
      if (startedAt !== null) {
        const existingStartedAt = stats.startTimestamps.get(acceptanceId);
        if (existingStartedAt === undefined || startedAt < existingStartedAt) {
          stats.startTimestamps.set(acceptanceId, startedAt);
        }
      }
    }
  }

  return stats;
}

function buildDayDeltas(stats: ReducedLearningStats): number[] {
  const dayDeltas: number[] = [];

  for (const [acceptanceId, acceptedAt] of stats.acceptanceTimestamps.entries()) {
    const startedAt = stats.startTimestamps.get(acceptanceId);
    if (startedAt === undefined || startedAt < acceptedAt) {
      continue;
    }

    dayDeltas.push((startedAt - acceptedAt) / (24 * 60 * 60 * 1000));
  }

  return dayDeltas;
}

function buildBlockerFrequency(
  blockerCounts: Map<string, number>,
  sampleSize: number,
): BlockerFrequencyEntry[] {
  return [...blockerCounts.entries()]
    .map(([blocker, count]) => ({
      blocker,
      count,
      frequency: sampleSize === 0 ? 0 : round(count / sampleSize, 4),
    }))
    .sort((left, right) => (
      right.count - left.count
      || left.blocker.localeCompare(right.blocker)
    ));
}

export function computeDeterministicLearningSignals(
  input: DeterministicLearningInput,
): DeterministicLearningResult {
  const baseAcceptance = normalizeBaseAcceptance(input.base_acceptance);
  const baseStartability = normalizeBaseStartability(input.base_startability);
  const stats = reduceCapsules(input.capsules);
  const dayDeltas = buildDayDeltas(stats);

  const sample_size = stats.consideredDecisions;
  const acceptance_rate = sample_size === 0
    ? 0
    : round(stats.acceptedDecisions / sample_size, 4);
  const avg_days = dayDeltas.length === 0
    ? null
    : round(dayDeltas.reduce((sum, value) => sum + value, 0) / dayDeltas.length, 2);
  const blocker_frequency = buildBlockerFrequency(stats.blockerCounts, sample_size);

  const rawProbabilityDelta = acceptance_rate - baseAcceptance;
  const boundedProbabilityDelta = round(
    clamp(rawProbabilityDelta, -MAX_ACCEPTANCE_ADJUSTMENT, MAX_ACCEPTANCE_ADJUSTMENT),
    4,
  );
  const adjusted_acceptance = round(
    clamp(baseAcceptance + boundedProbabilityDelta, 0, 1),
    4,
  );

  let blend_weight = 0;
  let adjusted_days: number | null = null;

  if (baseStartability === null && avg_days !== null) {
    blend_weight = 1;
    adjusted_days = avg_days;
  } else if (baseStartability !== null && avg_days === null) {
    blend_weight = 0;
    adjusted_days = baseStartability;
  } else if (baseStartability !== null && avg_days !== null) {
    blend_weight = round(Math.min(sample_size, TIME_BLEND_SAMPLE_CAP) / TIME_BLEND_SAMPLE_CAP, 4);
    adjusted_days = round(
      (baseStartability * (1 - blend_weight)) + (avg_days * blend_weight),
      2,
    );
  }

  return {
    sample_size,
    acceptance_rate,
    avg_days,
    blocker_frequency,
    probability_adjustment: {
      adjusted_acceptance,
      bounded_delta: boundedProbabilityDelta,
    },
    time_adjustment: {
      adjusted_days,
      blend_weight,
    },
    explainability: {
      acceptance: {
        considered_decisions: stats.consideredDecisions,
        accepted_decisions: stats.acceptedDecisions,
        formula: 'accepted_decisions / considered_decisions',
      },
      avg_days: {
        matched_start_count: dayDeltas.length,
        formula: 'sum(day_deltas) / matched_start_count',
      },
      blocker_frequency: {
        denominator: sample_size,
        formula: 'blocker_count / sample_size',
      },
      probability_adjustment: {
        base_acceptance: baseAcceptance,
        observed_acceptance_rate: acceptance_rate,
        raw_delta: round(rawProbabilityDelta, 4),
        bounded_delta: boundedProbabilityDelta,
        max_abs_delta: MAX_ACCEPTANCE_ADJUSTMENT,
        formula: 'clamp(observed_acceptance_rate - base_acceptance, -max_abs_delta, max_abs_delta)',
      },
      time_adjustment: {
        base_startability: baseStartability,
        observed_avg_days: avg_days,
        blend_weight,
        sample_cap: TIME_BLEND_SAMPLE_CAP,
        formula: 'base_startability * (1 - blend_weight) + observed_avg_days * blend_weight',
      },
    },
  };
}

export function computeDecisionCapsuleLearningSignals(
  capsules: readonly DecisionCapsuleLearningInput[],
): DecisionCapsuleLearningSignal {
  const result = computeDeterministicLearningSignals({
    capsules,
    base_acceptance: 0,
    base_startability: null,
  });

  return {
    acceptance_rate: result.acceptance_rate,
    avg_days_to_start: result.avg_days,
    common_blockers: result.blocker_frequency.map(({ blocker, count }) => ({
      blocker,
      count,
    })),
  };
}

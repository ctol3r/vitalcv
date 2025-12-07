import type { ClinicianFeatureSource, JobFeatureSource } from './features';

export interface CompactWeightOptions {
  clinician: ClinicianFeatureSource;
  job: JobFeatureSource & {
    requiredStates?: string[] | null;
    telehealth?: boolean | null;
    travelRequired?: boolean | null;
  };
}

const TELEHEALTH_MULTIPLIER = 1.75;
const NON_COMPACT_PENALTY = 0.7;

export function applyCompactWeight(baseScore: number, options: CompactWeightOptions): number {
  const requiresMultiState = jobNeedsMultiState(options.job);
  if (!requiresMultiState) {
    return baseScore;
  }

  const hasCompact = (options.clinician.compactEligibleStates?.length ?? 0) > 0;
  if (hasCompact) {
    return Math.min(1, baseScore * TELEHEALTH_MULTIPLIER);
  }
  return Math.max(0, baseScore * NON_COMPACT_PENALTY);
}

function jobNeedsMultiState(job: CompactWeightOptions['job']): boolean {
  if (job.telehealth) return true;
  if (job.travelRequired) return true;
  if ((job.requiredStates?.length ?? 0) > 1) return true;
  return false;
}












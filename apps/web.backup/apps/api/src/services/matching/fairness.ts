import { clamp01 } from './features';

export type FairnessScope = 'verifyOnly' | 'issueOnly';

export interface FairnessCandidateProfile {
  clinicianId: string;
  baseScore: number;
  specialty: string;
  gender?: string | null;
  locationRegion?: string | null;
  readinessScore?: number;
  historicalHireRate?: number;
}

export interface FairnessOptions {
  biasThreshold?: number;
  minRepresentation?: number;
}

export interface FairnessAdjustment {
  clinicianId: string;
  fairnessScore: number;
  adjustedScore: number;
  boundary: {
    lower: number;
    upper: number;
  };
  biasAlerts: string[];
}

interface RepresentationSnapshot {
  group: string;
  share: number;
  expected: number;
  delta: number;
}

const DEFAULT_THRESHOLD = 0.12;

export function applyFairnessGuardrail(
  candidates: FairnessCandidateProfile[],
  options: FairnessOptions = {},
): FairnessAdjustment[] {
  if (!candidates.length) {
    return [];
  }

  const biasThreshold = options.biasThreshold ?? DEFAULT_THRESHOLD;
  const specialtyStats = computeRepresentation(candidates, (candidate) => candidate.specialty);
  const genderStats = computeRepresentation(candidates, (candidate) =>
    (candidate.gender ?? 'unspecified').toLowerCase(),
  );
  const regionStats = computeRepresentation(
    candidates,
    (candidate) => (candidate.locationRegion ?? 'unknown').toUpperCase(),
  );

  return candidates.map((candidate) => {
    const specialtyBias = lookupBias(specialtyStats, candidate.specialty);
    const genderBias = lookupBias(genderStats, (candidate.gender ?? 'unspecified').toLowerCase());
    const regionBias = lookupBias(regionStats, (candidate.locationRegion ?? 'unknown').toUpperCase());

    const biasAlerts: string[] = [];
    const specialtyFactor = deriveFactor(specialtyBias, biasThreshold, 'Specialty', biasAlerts);
    const genderFactor = deriveFactor(genderBias, biasThreshold, 'Gender', biasAlerts);
    const regionFactor = deriveFactor(regionBias, biasThreshold, 'Region', biasAlerts);

    const fairnessMultiplier = clamp01(
      (specialtyFactor + genderFactor + regionFactor) / 3,
    );

    const decisionBoundary = buildDecisionBoundary(candidate.baseScore);
    const adjustedScore = clamp01(candidate.baseScore * fairnessMultiplier);
    const boundedScore = Math.min(Math.max(adjustedScore, decisionBoundary.lower), decisionBoundary.upper);

    const readinessLift = candidate.readinessScore ?? candidate.baseScore;
    const historicalBoost = candidate.historicalHireRate ?? readinessLift;
    const fairnessScore = clamp01((fairnessMultiplier + readinessLift + historicalBoost) / 3);

    return {
      clinicianId: candidate.clinicianId,
      fairnessScore,
      adjustedScore: Number(boundedScore.toFixed(4)),
      boundary: decisionBoundary,
      biasAlerts,
    };
  });
}

function computeRepresentation(
  candidates: FairnessCandidateProfile[],
  groupSelector: (candidate: FairnessCandidateProfile) => string,
): RepresentationSnapshot[] {
  const totals = new Map<string, number>();
  candidates.forEach((candidate) => {
    const group = groupSelector(candidate) || 'unknown';
    totals.set(group, (totals.get(group) ?? 0) + 1);
  });

  const totalCount = candidates.length;
  const expectedShare = 1 / Math.max(totals.size, 1);

  return Array.from(totals.entries()).map(([group, count]) => {
    const share = count / totalCount;
    return {
      group,
      share,
      expected: expectedShare,
      delta: share - expectedShare,
    };
  });
}

function lookupBias(snapshots: RepresentationSnapshot[], group: string): RepresentationSnapshot | null {
  if (!snapshots.length) {
    return null;
  }
  return snapshots.find((snapshot) => snapshot.group === group) ?? null;
}

function deriveFactor(
  snapshot: RepresentationSnapshot | null,
  threshold: number,
  label: string,
  alerts: string[],
): number {
  if (!snapshot) {
    return 1;
  }

  if (snapshot.delta < -threshold) {
    alerts.push(`${label} under-represented by ${(snapshot.delta * -100).toFixed(1)}%`);
    return clamp01(1.05);
  }

  if (snapshot.delta > threshold) {
    alerts.push(`${label} saturation detected (+${(snapshot.delta * 100).toFixed(1)}%)`);
    return clamp01(0.9);
  }

  return 1;
}

function buildDecisionBoundary(baseScore: number) {
  const margin = 0.15;
  return {
    lower: clamp01(baseScore - margin),
    upper: clamp01(baseScore + margin),
  };
}












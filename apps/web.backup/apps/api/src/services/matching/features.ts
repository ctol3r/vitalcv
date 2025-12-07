import type { SpecialtyRequirement } from '@prisma/client';

export interface BoardCertificationRecord {
  specialty: string;
  status: string;
  expiresAt?: Date | string | null;
  verifiedAt?: Date | string | null;
}

export interface SanctionRecord {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  active: boolean;
  resolvedAt?: Date | string | null;
}

export interface ClinicianFeatureSource {
  id: string;
  primarySpecialty: string;
  secondarySpecialties?: string[];
  yearsExperience?: number;
  boardCertifications?: BoardCertificationRecord[];
  compactEligibleStates?: string[];
  sanctions?: SanctionRecord[];
  lastVerifiedAt?: Date | string | null;
}

export interface JobFeatureSource {
  id: string;
  orgId?: string;
  specialty: string;
  minYearsExperience?: number;
  requiresBoardCertified?: boolean;
  compactPreferred?: boolean;
  updatedAt?: Date | string | null;
}

export interface FeatureContext {
  clinician: ClinicianFeatureSource;
  job: JobFeatureSource;
  requirements: SpecialtyRequirement[];
}

export interface FeatureVector {
  specialtyMatch: number;
  experience: number;
  boardStatus: number;
  compactFit: number;
  sanctionsRisk: number;
  recency: number;
}

export function experienceYears(
  clinicianYears?: number,
  minYears?: number,
  cap: number = 25,
): number {
  const experience = Math.max(0, clinicianYears ?? 0);
  const requirement = Math.max(0, minYears ?? 0);
  if (requirement === 0) {
    return clamp01(experience / cap);
  }

  if (experience >= requirement) {
    const surplus = Math.min(experience - requirement, cap);
    return clamp01(0.6 + (surplus / cap) * 0.4);
  }

  return clamp01((experience / requirement) * 0.8);
}

export function boardStatusScore(
  certifications: BoardCertificationRecord[] = [],
  specialty?: string,
): number {
  if (!certifications.length) {
    return 0.2;
  }

  const normalizedSpecialty = specialty?.toLowerCase();
  const statuses = certifications.map((cert) => {
    const normalizedStatus = cert.status.toLowerCase();
    const specialtyMatch =
      normalizedSpecialty && cert.specialty?.toLowerCase() === normalizedSpecialty;

    if (normalizedStatus === 'active' && specialtyMatch) return 1;
    if (normalizedStatus === 'active') return 0.9;
    if (normalizedStatus === 'pending' || normalizedStatus === 'in_progress') return 0.6;
    if (normalizedStatus === 'expired' && !cert.expiresAt) return 0.4;
    return 0.2;
  });

  return clamp01(Math.max(...statuses));
}

export function compactEligibilityScore(
  compactStates: string[] = [],
  job: JobFeatureSource,
  requirements: SpecialtyRequirement[],
): number {
  const hasCompactCapacity = compactStates.length > 0;
  const requiresCompact = job.compactPreferred === true;
  const acceptsCompact = requirements.some((req) => req.compactOk) || job.compactPreferred;

  if (requiresCompact) {
    return hasCompactCapacity ? 1 : 0;
  }

  if (acceptsCompact) {
    return hasCompactCapacity ? 0.95 : 0.45;
  }

  return hasCompactCapacity ? 0.75 : 0.6;
}

export function sanctionsPenalty(sanctions: SanctionRecord[] = []): number {
  if (!sanctions.length) return 0;

  const severityWeight: Record<SanctionRecord['severity'], number> = {
    low: 0.15,
    medium: 0.4,
    high: 0.75,
    critical: 0.95,
  };

  const now = Date.now();
  let penalty = 0;

  for (const sanction of sanctions) {
    const weight = severityWeight[sanction.severity] ?? 0.3;
    if (!sanction.active && sanction.resolvedAt) {
      const resolvedAt = new Date(sanction.resolvedAt).getTime();
      const monthsAgo = (now - resolvedAt) / (1000 * 60 * 60 * 24 * 30);
      const decay = Math.min(monthsAgo / 12, 1);
      penalty = Math.max(penalty, weight * (1 - decay));
      continue;
    }
    penalty = Math.max(penalty, sanction.active ? weight : weight * 0.6);
  }

  return clamp01(penalty);
}

export function buildFeatureVector(context: FeatureContext): FeatureVector {
  const { clinician, job } = context;
  const requirements = context.requirements ?? [];

  const specialtyMatch = computeSpecialtyMatch(
    clinician.primarySpecialty,
    clinician.secondarySpecialties,
    job.specialty,
    requirements,
  );

  const minYearsFromRequirements =
    requirements.reduce((max, req) => Math.max(max, req.minYears ?? 0), 0) || undefined;

  const experience = experienceYears(
    clinician.yearsExperience,
    job.minYearsExperience ?? minYearsFromRequirements,
  );

  const boardStatus = boardStatusScore(clinician.boardCertifications ?? [], job.specialty);
  const compactFit = compactEligibilityScore(
    clinician.compactEligibleStates ?? [],
    job,
    requirements,
  );
  const penalty = sanctionsPenalty(clinician.sanctions ?? []);
  const recency = recencyScore(clinician.lastVerifiedAt, job.updatedAt);

  return {
    specialtyMatch,
    experience,
    boardStatus,
    compactFit,
    sanctionsRisk: 1 - penalty,
    recency,
  };
}

function computeSpecialtyMatch(
  primary: string,
  secondary: string[] | undefined,
  jobSpecialty: string,
  requirements: SpecialtyRequirement[],
): number {
  const normalizedJob = jobSpecialty.toLowerCase();
  const normalizedPrimary = primary.toLowerCase();

  if (normalizedJob === normalizedPrimary) {
    return 1;
  }

  if (secondary?.some((spec) => spec.toLowerCase() === normalizedJob)) {
    return 0.9;
  }

  if (requirements.some((req) => req.specialty.toLowerCase() === normalizedJob)) {
    return 0.8;
  }

  return 0.5;
}

function recencyScore(
  lastVerifiedAt?: Date | string | null,
  jobUpdatedAt?: Date | string | null,
): number {
  const lastActive = lastVerifiedAt ? new Date(lastVerifiedAt).getTime() : null;
  const jobFreshness = jobUpdatedAt ? new Date(jobUpdatedAt).getTime() : null;
  const reference = Math.max(lastActive ?? 0, jobFreshness ?? 0);
  if (!reference) {
    return 0.6;
  }

  const days = (Date.now() - reference) / (1000 * 60 * 60 * 24);
  if (days <= 30) return 1;
  if (days <= 90) return 0.85;
  if (days <= 180) return 0.7;
  if (days <= 365) return 0.5;
  return 0.3;
}

export function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}











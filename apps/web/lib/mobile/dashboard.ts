import type { OpportunitySummary } from '@/lib/launch/marketplace';
import {
  mobileApplicationStatusLabel,
  mobileApplicationStatusTone,
} from '@/lib/mobile/summaries';

export type MobileTrustBand = 'L0' | 'L1' | 'L2' | 'L3';
export type MobileMatchBand = 'CLEAR' | 'NEAR_CLEAR' | 'PARTIAL' | 'INELIGIBLE';

export interface MobileTrustState {
  npi: string;
  readinessLevel: MobileTrustBand;
  readinessScore: number;
  readinessStatus: string;
  trustBand: MobileTrustBand;
  trustScore: number;
  gapSummary: string[];
  computedAt: string | null;
  cached: boolean;
}

export interface MobileApplicationReadiness {
  readinessScore: number;
  readinessLevel: MobileTrustBand;
  readinessStatus: string;
  gapSummary: string[];
  keyCredentials: string[];
  trustSignals: string[];
}

export interface MobileApplication {
  id: string;
  opportunityId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
  employer: {
    organizationId: string | null;
    name: string | null;
  };
  opportunity: {
    id: string;
    organizationId: string | null;
    organizationName: string | null;
    title: string;
    specialty: string;
    hiringType: string;
    state: string;
    payRange: string | null;
    status: string | null;
  };
  provider: {
    npi: string | null;
    fullName: string | null;
    specialty: string | null;
    stateOfPractice: string | null;
  } | null;
  readiness: MobileApplicationReadiness | null;
  latestRecommendation: {
    actionType: string | null;
    label: string | null;
    explanation: string | null;
  } | null;
  timeline: Array<{
    stage: string;
    occurredAt: string | null;
    description: string;
  }>;
  systemBehavesAutonomously: boolean;
}

export interface MobileOpportunityMatch {
  opportunityId: string;
  band: MobileMatchBand;
  score: number;
  blockers: Array<{
    label: string;
    action?: string;
  }>;
  fitReasons: string[];
}

export interface MobileMatchPayload {
  npi: string;
  clinicianName: string | null;
  specialty: string | null;
  state: string | null;
  missingForHigherMatches: string[];
  matches: MobileOpportunityMatch[];
}

export interface MobileOpportunityCard extends OpportunitySummary {
  application: MobileApplication | null;
  match: MobileOpportunityMatch | null;
}

export interface MobileDashboardData {
  signedIn: boolean;
  workspace: {
    personProfile: {
      npi: string | null;
      firstName: string | null;
      lastName: string | null;
      specialty: string | null;
      stateOfPractice: string | null;
      completeness: number | null;
    } | null;
  } | null;
  trustState: MobileTrustState | null;
  applications: MobileApplication[];
  opportunities: MobileOpportunityCard[];
  missingForHigherMatches: string[];
  refreshedAt: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => asString(entry))
    .filter((entry): entry is string => Boolean(entry));
}

function normalizeTrustBand(value: unknown): MobileTrustBand | null {
  return value === 'L0' || value === 'L1' || value === 'L2' || value === 'L3'
    ? value
    : null;
}

function normalizeMatchBand(value: unknown): MobileMatchBand | null {
  return value === 'CLEAR'
    || value === 'NEAR_CLEAR'
    || value === 'PARTIAL'
    || value === 'INELIGIBLE'
    ? value
    : null;
}

export function normalizeMobileTrustState(raw: unknown): MobileTrustState | null {
  if (!isRecord(raw)) {
    return null;
  }

  const readinessLevel = normalizeTrustBand(raw.readiness_level) ?? normalizeTrustBand(raw.trustBand);
  if (!readinessLevel) {
    return null;
  }

  const readinessScore = asFiniteNumber(raw.readiness_score) ?? asFiniteNumber(raw.trustScore) ?? 0;
  const trustBand = normalizeTrustBand(raw.trustBand) ?? readinessLevel;
  const trustScore = asFiniteNumber(raw.trustScore) ?? readinessScore;
  const npi = asString(raw.npi) ?? '';

  return {
    npi,
    readinessLevel,
    readinessScore,
    readinessStatus: asString(raw.readiness_status) ?? 'Readiness is computing.',
    trustBand,
    trustScore,
    gapSummary: normalizeStringArray(raw.gap_summary),
    computedAt: asString(raw.computedAt) ?? asString(raw.computed_at),
    cached: raw.cached === true,
  };
}

function normalizeApplicationReadiness(raw: unknown): MobileApplicationReadiness | null {
  if (!isRecord(raw)) {
    return null;
  }

  const readinessLevel = normalizeTrustBand(raw.readinessLevel);
  const readinessScore = asFiniteNumber(raw.readinessScore);
  const readinessStatus = asString(raw.readinessStatus);

  if (!readinessLevel || readinessScore === null || !readinessStatus) {
    return null;
  }

  return {
    readinessLevel,
    readinessScore,
    readinessStatus,
    gapSummary: normalizeStringArray(raw.gapSummary),
    keyCredentials: normalizeStringArray(raw.keyCredentials),
    trustSignals: normalizeStringArray(raw.trustSignals),
  };
}

export function normalizeClinicianApplication(raw: unknown): MobileApplication | null {
  if (!isRecord(raw)) {
    return null;
  }

  const opportunity = isRecord(raw.opportunity) ? raw.opportunity : null;
  if (!opportunity) {
    return null;
  }

  const id = asString(raw.id);
  const opportunityId = asString(raw.opportunityId) ?? asString(opportunity.id);
  const status = asString(raw.status);
  const createdAt = asString(raw.createdAt);
  const updatedAt = asString(raw.updatedAt);
  const reviewedAt = asString(raw.reviewedAt);
  const reviewNote = asString(raw.reviewNote);

  if (!id || !opportunityId || !status || !createdAt || !updatedAt) {
    return null;
  }

  const employer = isRecord(raw.employer) ? raw.employer : null;
  const provider = isRecord(raw.provider) ? raw.provider : null;
  const latestRecommendation = isRecord(raw.latestRecommendation) ? raw.latestRecommendation : null;
  const timeline = Array.isArray(raw.timeline)
    ? raw.timeline
        .map((entry) => {
          if (!isRecord(entry)) {
            return null;
          }

          const stage = asString(entry.stage);
          const description = asString(entry.description);
          if (!stage || !description) {
            return null;
          }

          return {
            stage,
            occurredAt: asString(entry.occurredAt),
            description,
          };
        })
        .filter((entry): entry is { stage: string; occurredAt: string | null; description: string } => Boolean(entry))
    : [];

  return {
    id,
    opportunityId,
    status,
    createdAt,
    updatedAt,
    reviewedAt,
    reviewNote,
    employer: {
      organizationId: asString(employer?.organizationId),
      name: asString(employer?.name),
    },
    opportunity: {
      id: asString(opportunity.id) ?? opportunityId,
      organizationId: asString(opportunity.organizationId),
      organizationName: asString(opportunity.organizationName),
      title: asString(opportunity.title) ?? 'Opportunity',
      specialty: asString(opportunity.specialty) ?? 'Unknown specialty',
      hiringType: asString(opportunity.hiringType) ?? 'unknown',
      state: asString(opportunity.state) ?? 'Unknown state',
      payRange: asString(opportunity.payRange),
      status: asString(opportunity.status),
    },
    provider: provider
      ? {
          npi: asString(provider.npi),
          fullName: asString(provider.fullName),
          specialty: asString(provider.specialty),
          stateOfPractice: asString(provider.stateOfPractice),
        }
      : null,
    readiness: normalizeApplicationReadiness(raw.readiness),
    latestRecommendation: latestRecommendation
      ? {
          actionType: asString(latestRecommendation.actionType),
          label: asString(latestRecommendation.label),
          explanation: asString(latestRecommendation.explanation),
        }
      : null,
    timeline,
    systemBehavesAutonomously: raw.systemBehavesAutonomously === true,
  };
}

export function normalizeClinicianApplications(raw: unknown): MobileApplication[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((entry) => normalizeClinicianApplication(entry))
    .filter((entry): entry is MobileApplication => Boolean(entry));
}

export function normalizeMatchPayload(raw: unknown): MobileMatchPayload | null {
  if (!isRecord(raw)) {
    return null;
  }

  const npi = asString(raw.npi);
  if (!npi) {
    return null;
  }

  const matches = Array.isArray(raw.matches)
    ? raw.matches
        .map((entry) => {
          if (!isRecord(entry)) {
            return null;
          }

          const opportunityId = asString(entry.opportunityId);
          const band = normalizeMatchBand(entry.band);
          const score = asFiniteNumber(entry.score);

          if (!opportunityId || !band || score === null) {
            return null;
          }

          const blockers = Array.isArray(entry.blockers)
            ? entry.blockers
                .map((blocker) => {
                  if (!isRecord(blocker)) {
                    return null;
                  }

                  const label = asString(blocker.label);
                  if (!label) {
                    return null;
                  }

                  return {
                    label,
                    ...(asString(blocker.action) ? { action: asString(blocker.action)! } : {}),
                  };
                })
                .filter((blocker): blocker is { label: string; action?: string } => Boolean(blocker))
            : [];

          return {
            opportunityId,
            band,
            score,
            blockers,
            fitReasons: normalizeStringArray(entry.fitReasons),
          };
        })
        .filter((entry): entry is MobileOpportunityMatch => Boolean(entry))
    : [];

  const profileCompleteness = isRecord(raw.profileCompleteness) ? raw.profileCompleteness : null;

  return {
    npi,
    clinicianName: asString(raw.clinicianName),
    specialty: asString(raw.specialty),
    state: asString(raw.state),
    missingForHigherMatches: normalizeStringArray(profileCompleteness?.missingForHigherMatches),
    matches,
  };
}

export function upsertClinicianApplication(
  current: readonly MobileApplication[],
  next: MobileApplication,
): MobileApplication[] {
  const existingIndex = current.findIndex((application) => application.id === next.id);

  if (existingIndex === -1) {
    return [next, ...current];
  }

  return current.map((application, index) => (index === existingIndex ? next : application));
}

function opportunityPriority(
  opportunity: OpportunitySummary,
  specialty: string | null,
  state: string | null,
): number {
  let priority = 0;

  if (specialty && opportunity.specialty.toLowerCase() === specialty.toLowerCase()) {
    priority += 2;
  }

  if (state && opportunity.state.toLowerCase() === state.toLowerCase()) {
    priority += 1;
  }

  return priority;
}

export function buildMobileOpportunityCards(input: {
  opportunities: readonly OpportunitySummary[];
  applications: readonly MobileApplication[];
  matchPayload: MobileMatchPayload | null;
  specialty?: string | null;
  state?: string | null;
}): MobileOpportunityCard[] {
  const applicationByOpportunityId = new Map(
    input.applications.map((application) => [application.opportunityId, application]),
  );
  const matches = input.matchPayload?.matches ?? [];
  const matchByOpportunityId = new Map(matches.map((match) => [match.opportunityId, match]));
  const matchOrder = new Map(matches.map((match, index) => [match.opportunityId, index]));

  return [...input.opportunities]
    .map((opportunity) => ({
      ...opportunity,
      application: applicationByOpportunityId.get(opportunity.id) ?? null,
      match: matchByOpportunityId.get(opportunity.id) ?? null,
    }))
    .sort((left, right) => {
      const leftMatchOrder = matchOrder.get(left.id);
      const rightMatchOrder = matchOrder.get(right.id);

      if (leftMatchOrder !== undefined || rightMatchOrder !== undefined) {
        return (leftMatchOrder ?? Number.MAX_SAFE_INTEGER) - (rightMatchOrder ?? Number.MAX_SAFE_INTEGER);
      }

      const leftPriority = opportunityPriority(left, input.specialty ?? null, input.state ?? null);
      const rightPriority = opportunityPriority(right, input.specialty ?? null, input.state ?? null);
      if (leftPriority !== rightPriority) {
        return rightPriority - leftPriority;
      }

      return Date.parse(right.createdAt) - Date.parse(left.createdAt);
    });
}

export function applicationStatusLabel(status: string): string {
  return mobileApplicationStatusLabel(status);
}

export function applicationStatusTone(status: string): 'emerald' | 'sky' | 'amber' | 'rose' | 'zinc' {
  return mobileApplicationStatusTone(status);
}

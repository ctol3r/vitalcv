import { getBackendBase } from '@/lib/api';

export interface EmployerRequirement {
  label: string;
  level: string;
  note?: string;
}

export interface EmployerSummary {
  id: string;
  slug: string;
  name: string;
  facilityType: string;
  tagline: string;
  specialties: string[];
  states: string[];
  openRoles: number;
  trustScore: number;
  hiringStatus: string;
  verified: boolean;
  trustIndicators: string[];
}

export interface EmployerDetail extends EmployerSummary {
  description: string;
  timeToStart: string;
  timeToOnboard: string;
  hiringTypes: string[];
  requirements: EmployerRequirement[];
  clearToStartThreshold: string;
  payTransparency: boolean;
  payRange: string | null;
  recentHires: number;
  website: string | null;
  verifiedSince: string | null;
}

export interface EmployerListPayload {
  employers: EmployerSummary[];
  total: number;
}

export interface OpportunitySummary {
  id: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  title: string;
  specialty: string;
  profession?: 'physician' | 'advanced_practice' | 'nursing' | 'behavioral_health' | 'allied_health' | 'not_stated';
  schedule?: 'full_time' | 'part_time' | 'per_diem' | 'flexible' | 'not_stated';
  hiringType: string;
  state: string;
  payRange: string | null;
  requirementLevel: string;
  description: string | null;
  remote: boolean;
  status: string;
  createdAt: string;
  updatedAt?: string;
  employerType?: string | null;
  payModel?: 'salary' | 'hourly' | 'locums' | 'shift' | 'unknown';
  payUnit?: 'year' | 'hour' | 'shift' | 'unknown';
  payRangeMin?: number | null;
  payRangeMax?: number | null;
  visaSponsorshipStatus?: 'available' | 'case_by_case' | 'not_available' | 'not_stated';
  visaSponsorshipSummary?: string | null;
  benefitsAvailability?: 'listed' | 'limited' | 'not_listed';
  benefitsSummary?: string | null;
  benefitsItems?: string[];
  startTimeline?: string | null;
  startUrgency?: 'immediate' | 'within_2_weeks' | 'within_month' | 'flexible' | 'unknown';
  speedToStartDays?: number | null;
  credentialRequirements?: Array<{
    label: string;
    level: string;
    note?: string | null;
    key?: string | null;
    priority?: 'required' | 'preferred';
    state?: string | null;
    specialty?: string | null;
  }>;
  trustIndicators?: string[];
  freshness?: {
    listingStatus: 'fresh' | 'aging' | 'stale';
    employerDataStatus: 'complete' | 'partial' | 'limited';
    completenessScore: number;
    isStale: boolean;
    isUncertain: boolean;
    lastUpdatedAt: string;
    compensationVerifiedAt?: string | null;
    benefitsVerifiedAt?: string | null;
    visaVerifiedAt?: string | null;
  };
  source?: {
    kind: 'employer_profile' | 'opportunity' | 'public_feed';
    label: string;
    updatedAt: string;
    /** Original feed posting or the canonical VitalCV opportunity record. */
    url?: string | null;
    /** Feed listings only: when the feed was read — a fetch, not a check. */
    fetchedAt?: string | null;
  };
  /**
   * True when the row was copied from a public job feed rather than posted by
   * an employer who claimed a Type 2 NPI. Such a listing carries no
   * employer-stated requirements and no readiness comparison, and applying
   * means going to the original posting rather than through VitalCV.
   */
  isFeedListing?: boolean;
  availability?: {
    state: 'open' | 'stale' | 'closed' | 'source_unavailable';
    confidence: 'recent_observation' | 'aging_observation' | 'stale_observation' | 'not_observed';
    observedAt: string | null;
    limitation: string;
  };
  applicationMode?: 'external' | 'vitalcv';
  compensationProvenance?: {
    state: 'supplied' | 'not_supplied';
    method: 'structured_source' | 'source_text' | 'not_supplied';
    sourceLabel: string;
    observedAt: string | null;
  };
  transparency?: {
    hiringState: string;
    speedToStartEstimate: string;
    sponsorshipSupport: string;
    benefitsVisibility: string;
    listingFreshness: string;
    employerDataCompleteness: string;
    evidence: string[];
  };
  comparison?: {
    clinicianNpi: string;
    status: 'ready_now' | 'needs_review' | 'requirements_missing';
    satisfied: Array<{ label: string; detail: string; key?: string | null; level?: string | null; nextStep?: string | null }>;
    missing: Array<{ label: string; detail: string; key?: string | null; level?: string | null; nextStep?: string | null }>;
    unknown: Array<{ label: string; detail: string; key?: string | null; level?: string | null; nextStep?: string | null }>;
    fitIndicators: string[];
    estimatedGap: string;
    shortestPath: string;
  } | null;
  explanation?: {
    whyThisMayFit: string[];
    whatMayBlockYou: string[];
    resolveNext: string[];
    stillUnknown: string[];
  };
}

export interface OpportunityListPayload {
  opportunities: OpportunitySummary[];
  total: number;
  truncated?: boolean;
  /** False only when the server could not read the opportunity service. */
  available?: boolean;
}

async function fetchMarketplace<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${getBackendBase()}${path}`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    return await response.json() as T;
  } catch {
    return null;
  }
}

export async function fetchLaunchEmployers(limit = 12): Promise<EmployerListPayload> {
  return await fetchMarketplace<EmployerListPayload>(`/api/employers?limit=${limit}`)
    ?? { employers: [], total: 0 };
}

export async function fetchLaunchEmployer(slug: string): Promise<EmployerDetail | null> {
  const payload = await fetchMarketplace<{ employer?: EmployerDetail }>(
    `/api/employers/${encodeURIComponent(slug)}`,
  );

  return payload?.employer ?? null;
}

export async function fetchLaunchOpportunities(filters: {
  q?: string;
  specialty?: string;
  profession?: 'physician' | 'advanced_practice' | 'nursing' | 'behavioral_health' | 'allied_health' | 'not_stated';
  schedule?: 'full_time' | 'part_time' | 'per_diem' | 'flexible' | 'not_stated';
  state?: string;
  hiringType?: string;
  organizationSlug?: string;
  remote?: boolean;
  payModel?: 'salary' | 'hourly' | 'locums' | 'shift' | 'unknown';
  payMin?: number;
  payMax?: number;
  visaSponsorship?: 'available' | 'case_by_case' | 'not_available' | 'not_stated';
  benefits?: 'listed' | 'limited' | 'not_listed';
  employerType?: string;
  startUrgency?: 'immediate' | 'within_2_weeks' | 'within_month' | 'flexible' | 'unknown';
  readinessStatus?: 'ready_now' | 'needs_review' | 'requirements_missing';
  missingRequirement?: string;
  npi?: string;
  limit?: number;
} = {}): Promise<OpportunityListPayload> {
  const params = new URLSearchParams();

  if (filters.q) {
    params.set('q', filters.q);
  }
  if (filters.specialty) {
    params.set('specialty', filters.specialty);
  }
  if (filters.profession) {
    params.set('profession', filters.profession);
  }
  if (filters.schedule) {
    params.set('schedule', filters.schedule);
  }
  if (filters.state) {
    params.set('state', filters.state);
  }
  if (filters.hiringType) {
    params.set('hiringType', filters.hiringType);
  }
  if (filters.organizationSlug) {
    params.set('organizationSlug', filters.organizationSlug);
  }
  if (filters.remote) {
    params.set('remote', '1');
  }
  if (filters.payModel) {
    params.set('payModel', filters.payModel);
  }
  if (typeof filters.payMin === 'number') {
    params.set('payMin', String(filters.payMin));
  }
  if (typeof filters.payMax === 'number') {
    params.set('payMax', String(filters.payMax));
  }
  if (filters.visaSponsorship) {
    params.set('visaSponsorship', filters.visaSponsorship);
  }
  if (filters.benefits) {
    params.set('benefits', filters.benefits);
  }
  if (filters.employerType) {
    params.set('employerType', filters.employerType);
  }
  if (filters.startUrgency) {
    params.set('startUrgency', filters.startUrgency);
  }
  if (filters.readinessStatus) {
    params.set('readinessStatus', filters.readinessStatus);
  }
  if (filters.missingRequirement) {
    params.set('missingRequirement', filters.missingRequirement);
  }
  if (filters.npi) {
    params.set('npi', filters.npi);
  }
  params.set('limit', String(filters.limit ?? 20));

  return await fetchMarketplace<OpportunityListPayload>(`/api/opportunities?${params.toString()}`)
    ?? { opportunities: [], total: 0 };
}

/** Server-render the same filtered public field the client will refresh. */
export async function fetchPublicOpportunityField(
  params: URLSearchParams,
): Promise<OpportunityListPayload> {
  try {
    const response = await fetch(
      `${getBackendBase()}/api/opportunities?${params.toString()}`,
      { next: { revalidate: 300 } },
    );
    if (!response.ok) throw new Error('Opportunity service unavailable');
    const payload = await response.json() as OpportunityListPayload;
    return { ...payload, available: true };
  } catch {
    return { opportunities: [], total: 0, truncated: false, available: false };
  }
}

export async function fetchLaunchOpportunity(id: string, filters: {
  npi?: string;
} = {}): Promise<OpportunitySummary | null> {
  const params = new URLSearchParams();
  if (filters.npi) {
    params.set('npi', filters.npi);
  }

  const payload = await fetchMarketplace<{ opportunity?: OpportunitySummary }>(
    `/api/opportunities/${encodeURIComponent(id)}${params.toString() ? `?${params.toString()}` : ''}`,
  );

  return payload?.opportunity ?? null;
}

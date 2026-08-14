import {
  HIRING_TYPE_LABEL,
  PROFESSION_LABEL,
  SCHEDULE_LABEL,
} from '@/lib/explore/board-filters';
import type { OpportunitySummary } from '@/lib/launch/marketplace';

export type OpportunityAvailability = NonNullable<OpportunitySummary['availability']>;

export interface OpportunityMatchExplanation {
  fitReasons?: string[];
  blockers?: Array<{ label: string; action?: string }>;
}

export interface SignedOpportunityExplanation {
  whyThisMayFit: string[];
  evidenceGaps: string[];
  resolveNext: string[];
  stillUnknown: string[];
}

export const AVAILABILITY_LABEL: Record<OpportunityAvailability['state'], string> = {
  open: 'Recently observed',
  stale: 'Stale observation',
  closed: 'Closed',
  source_unavailable: 'Source page unavailable',
};

export const AVAILABILITY_GLYPH: Record<OpportunityAvailability['state'], string> = {
  open: '●',
  stale: '△',
  closed: '×',
  source_unavailable: '○',
};

export const CONFIDENCE_LABEL: Record<OpportunityAvailability['confidence'], string> = {
  recent_observation: 'Recent source observation',
  aging_observation: 'Aging source observation',
  stale_observation: 'Stale source observation',
  not_observed: 'Observation time unavailable',
};

function unique(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const normalized = value?.trim();
    if (!normalized) continue;
    const key = normalized.toLocaleLowerCase('en-US');
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(normalized);
  }
  return output;
}

export function opportunityAvailability(
  opportunity: OpportunitySummary,
): OpportunityAvailability {
  return opportunity.availability ?? {
    state: opportunity.status === 'CLOSED'
      ? 'closed'
      : opportunity.freshness?.isStale
        ? 'stale'
        : opportunity.isFeedListing && !opportunity.source?.url
          ? 'source_unavailable'
          : 'open',
    confidence: opportunity.freshness?.isStale
      ? 'stale_observation'
      : opportunity.source?.fetchedAt || opportunity.updatedAt
        ? 'recent_observation'
        : 'not_observed',
    observedAt: opportunity.source?.fetchedAt ?? opportunity.updatedAt ?? null,
    limitation: 'Confirm the current listing at its source before acting.',
  };
}

export function opportunityApplicationMode(
  opportunity: OpportunitySummary,
): 'external' | 'vitalcv' {
  return opportunity.applicationMode ?? (opportunity.isFeedListing ? 'external' : 'vitalcv');
}

export function opportunityIsActionable(opportunity: OpportunitySummary): boolean {
  const state = opportunityAvailability(opportunity).state;
  return state !== 'closed' && state !== 'source_unavailable';
}

export function formatOpportunityPay(opportunity: OpportunitySummary): string | null {
  if (opportunity.compensationProvenance?.state !== 'supplied') return null;
  if (opportunity.payRange) return opportunity.payRange;

  const min = opportunity.payRangeMin;
  const max = opportunity.payRangeMax;
  if (min == null && max == null) return null;
  const unit = opportunity.payUnit === 'hour'
    ? '/hr'
    : opportunity.payUnit === 'shift'
      ? '/shift'
      : opportunity.payUnit === 'year'
        ? '/year'
        : ' · unit not stated';
  const money = (value: number) => `$${Math.round(value).toLocaleString('en-US')}`;
  if (min != null && max != null) return `${money(min)}–${money(max)}${unit}`;
  return `${money((min ?? max) as number)}${unit}`;
}

export function formatOpportunityObserved(iso: string | null | undefined): string {
  if (!iso) return 'Observation time unavailable';
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return 'Observation time unavailable';
  return `Observed ${value.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  })}`;
}

export function opportunityCompensationMethod(opportunity: OpportunitySummary): string {
  if (opportunity.compensationProvenance?.method === 'structured_source') {
    return 'Structured source data';
  }
  if (opportunity.compensationProvenance?.method === 'source_text') {
    return 'Source-published text';
  }
  return 'Not supplied by source';
}

export function opportunityLocation(opportunity: OpportunitySummary): string {
  if (opportunity.remote) {
    return opportunity.state ? `Remote · ${opportunity.state}` : 'Remote';
  }
  return opportunity.state || 'Location not stated';
}

export function opportunityProfession(opportunity: OpportunitySummary): string {
  return PROFESSION_LABEL[opportunity.profession ?? 'not_stated']
    ?? 'Profession not stated';
}

export function opportunitySchedule(opportunity: OpportunitySummary): string {
  return SCHEDULE_LABEL[opportunity.schedule ?? 'not_stated']
    ?? 'Schedule not stated';
}

export function opportunityEmployment(opportunity: OpportunitySummary): string {
  return HIRING_TYPE_LABEL[opportunity.hiringType]
    ?? opportunity.hiringType
    ?? 'Employment type not stated';
}

export function buildSignedOpportunityExplanation(
  opportunity: OpportunitySummary,
  match?: OpportunityMatchExplanation | null,
): SignedOpportunityExplanation {
  const explanation = opportunity.explanation;
  return {
    whyThisMayFit: unique([
      ...(explanation?.whyThisMayFit ?? []),
      ...(match?.fitReasons ?? []),
    ]),
    evidenceGaps: unique([
      ...(explanation?.whatMayBlockYou ?? []),
      ...(match?.blockers?.map((blocker) => blocker.label) ?? []),
    ]),
    resolveNext: unique([
      ...(explanation?.resolveNext ?? []),
      ...(match?.blockers?.map((blocker) => blocker.action) ?? []),
    ]),
    stillUnknown: unique(explanation?.stillUnknown ?? []),
  };
}

export function opportunityFromPayload(value: unknown): OpportunitySummary | null {
  if (!value || typeof value !== 'object') return null;
  const raw = (value as { opportunity?: unknown }).opportunity ?? value;
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  if (typeof record.id !== 'string' || typeof record.title !== 'string') return null;
  return raw as OpportunitySummary;
}

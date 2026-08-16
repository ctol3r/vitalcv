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

/**
 * The placeholder the ingestion path writes when a feed published no specialty.
 * `Opportunity.specialty` is non-nullable, so silence needs a stored value —
 * see SPECIALTY_NOT_STATED in the backend's ingestion types. Compared as a
 * whole string, never a substring: a real specialty could contain these words.
 */
const SPECIALTY_SILENCE = 'Not stated';

export interface OpportunityRowFacts {
  /** Facts the source actually published, in reading order. */
  stated: Array<{ label: string; value: string }>;
  /** Field names the source said nothing about, lowercase for one prose line. */
  unstated: string[];
}

/**
 * Split a row's facts into what the source stated and what it did not.
 *
 * Statedness is read from the DATA, never from the rendered label. The display
 * helpers return prose like "Schedule not stated", and matching on that string
 * would break the moment someone rewords it — and would misfire on a real
 * value that happened to contain the words.
 *
 * The silent fields are returned, not dropped. A row that simply omitted them
 * would read as though the employer had answered and we were hiding it; the
 * board's whole claim is that silence is visible. One line naming all of them
 * says the same thing as six cells, and leaves the stated facts scannable.
 */
export function opportunityRowFacts(opportunity: OpportunitySummary): OpportunityRowFacts {
  const stated: Array<{ label: string; value: string }> = [];
  const unstated: string[] = [];

  const push = (label: string, isStated: boolean, value: string) => {
    if (isStated) stated.push({ label, value });
    else unstated.push(label.toLowerCase());
  };

  const professionStated = Boolean(opportunity.profession)
    && opportunity.profession !== 'not_stated';
  push('Profession', professionStated, opportunityProfession(opportunity));

  const locationStated = opportunity.remote === true || Boolean(opportunity.state);
  push('Location', locationStated, opportunityLocation(opportunity));

  const scheduleStated = Boolean(opportunity.schedule)
    && opportunity.schedule !== 'not_stated';
  push('Schedule', scheduleStated, opportunitySchedule(opportunity));

  // Employment is deliberately NOT tested for statedness here. Feed rows carry
  // a hardcoded hiringType, so "Permanent" is a default rather than something
  // the employer said — but correcting that is a read-path change with its own
  // blast radius, tracked separately. Presenting it exactly as before keeps
  // this pass to density and avoids contradicting that fix mid-flight.
  stated.push({ label: 'Employment', value: opportunityEmployment(opportunity) });

  const specialtyStated = Boolean(opportunity.specialty)
    && opportunity.specialty !== SPECIALTY_SILENCE;
  push('Specialty', specialtyStated, opportunity.specialty || SPECIALTY_SILENCE);

  const pay = formatOpportunityPay(opportunity);
  push('Compensation', pay !== null, pay ?? '');

  return { stated, unstated };
}

/** "schedule, specialty and compensation" — a list a person reads aloud. */
export function formatUnstatedFields(fields: string[]): string {
  if (fields.length <= 1) return fields[0] ?? '';
  return `${fields.slice(0, -1).join(', ')} and ${fields[fields.length - 1]}`;
}

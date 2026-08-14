'use client';

import Link from 'next/link';
import type { OpportunitySummary } from '@/lib/launch/marketplace';
import {
  HIRING_TYPE_LABEL,
  PROFESSION_LABEL,
  SCHEDULE_LABEL,
} from '@/lib/explore/board-filters';

const AVAILABILITY_LABEL = {
  open: 'Recently observed',
  stale: 'Stale observation',
  closed: 'Closed',
  source_unavailable: 'Source page unavailable',
} as const;

const AVAILABILITY_GLYPH = {
  open: '●',
  stale: '△',
  closed: '×',
  source_unavailable: '○',
} as const;

const CONFIDENCE_LABEL = {
  recent_observation: 'Recent source observation',
  aging_observation: 'Aging source observation',
  stale_observation: 'Stale source observation',
  not_observed: 'Observation time unavailable',
} as const;

function formatPay(opportunity: OpportunitySummary): string | null {
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

function formatObserved(iso: string | null | undefined): string {
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

function sourceMethod(opportunity: OpportunitySummary): string {
  if (opportunity.compensationProvenance?.method === 'structured_source') {
    return 'Structured source data';
  }
  if (opportunity.compensationProvenance?.method === 'source_text') {
    return 'Source-published text';
  }
  return 'Not supplied by source';
}

export function BoardResultRow({
  opportunity,
  ordinal,
}: {
  opportunity: OpportunitySummary;
  ordinal: number;
}) {
  const availability = opportunity.availability ?? {
    state: opportunity.freshness?.isStale ? 'stale' as const : 'open' as const,
    confidence: opportunity.freshness?.isStale ? 'stale_observation' as const : 'not_observed' as const,
    observedAt: opportunity.source?.fetchedAt ?? opportunity.updatedAt ?? null,
    limitation: 'Confirm the current listing at its source before acting.',
  };
  const applicationMode = opportunity.applicationMode
    ?? (opportunity.isFeedListing ? 'external' : 'vitalcv');
  const sourceUrl = opportunity.source?.url ?? null;
  const sourceLabel = opportunity.source?.label ?? 'Source not stated';
  const compensation = formatPay(opportunity);
  const location = opportunity.remote
    ? opportunity.state ? `Remote · ${opportunity.state}` : 'Remote'
    : opportunity.state || 'Location not stated';
  const profession = PROFESSION_LABEL[opportunity.profession ?? 'not_stated'] ?? 'Profession not stated';
  const schedule = SCHEDULE_LABEL[opportunity.schedule ?? 'not_stated'] ?? 'Schedule not stated';
  const employment = HIRING_TYPE_LABEL[opportunity.hiringType] ?? opportunity.hiringType;

  return (
    <article
      data-opportunity-id={opportunity.id}
      data-application-mode={applicationMode}
      data-availability-state={availability.state}
      className="opf-role"
    >
      <div className="opf-role-index" aria-hidden="true">
        {String(ordinal).padStart(2, '0')}
      </div>

      <div className="opf-role-main">
        <div className="opf-role-heading">
          <div>
            <p className="opf-role-org">{opportunity.organizationName}</p>
            <h3 className="opf-role-title">{opportunity.title}</h3>
          </div>
          <p className="opf-availability" data-state={availability.state}>
            <span aria-hidden="true">{AVAILABILITY_GLYPH[availability.state]}</span>{' '}
            {AVAILABILITY_LABEL[availability.state]}
          </p>
        </div>

        <dl className="opf-role-facts">
          <div>
            <dt>Profession</dt>
            <dd>{profession}</dd>
          </div>
          <div>
            <dt>Location</dt>
            <dd>{location}</dd>
          </div>
          <div>
            <dt>Schedule</dt>
            <dd>{schedule}</dd>
          </div>
          <div>
            <dt>Employment</dt>
            <dd>{employment}</dd>
          </div>
          <div>
            <dt>Specialty</dt>
            <dd>{opportunity.specialty || 'Not stated'}</dd>
          </div>
          <div>
            <dt>Compensation</dt>
            <dd>{compensation ?? 'Not supplied by source'}</dd>
          </div>
        </dl>

        <div className="opf-role-proof">
          <div>
            <p className="opf-proof-label">Source</p>
            {sourceUrl ? (
              applicationMode === 'external' ? (
                <a href={sourceUrl} target="_blank" rel="noopener noreferrer nofollow">
                  {sourceLabel}
                </a>
              ) : (
                <Link href={sourceUrl}>{sourceLabel}</Link>
              )
            ) : (
              <p>{sourceLabel} · source page unavailable</p>
            )}
          </div>
          <div>
            <p className="opf-proof-label">Observation</p>
            <p>{formatObserved(availability.observedAt)}</p>
            <p>{CONFIDENCE_LABEL[availability.confidence]}</p>
          </div>
          <div>
            <p className="opf-proof-label">Compensation source</p>
            <p>{sourceMethod(opportunity)}</p>
          </div>
        </div>

        <p className="opf-role-limitation">{availability.limitation}</p>

        <div className="opf-role-action">
          {applicationMode === 'external' ? (
            sourceUrl ? (
              <a href={sourceUrl} target="_blank" rel="noopener noreferrer nofollow">
                View original listing <span aria-hidden="true">↗</span>
              </a>
            ) : (
              <span aria-disabled="true">Original listing unavailable</span>
            )
          ) : (
            <Link href={`/opportunities/${opportunity.id}`}>Apply with VitalCV</Link>
          )}
        </div>
      </div>
    </article>
  );
}

export default BoardResultRow;

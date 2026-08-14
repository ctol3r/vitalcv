'use client';

import { Fragment } from 'react';
import Link from 'next/link';
import type { OpportunitySummary } from '@/lib/launch/marketplace';
import {
  AVAILABILITY_GLYPH,
  AVAILABILITY_LABEL,
  CONFIDENCE_LABEL,
  formatOpportunityObserved,
  formatOpportunityPay,
  opportunityApplicationMode,
  opportunityAvailability,
  opportunityCompensationMethod,
  opportunityEmployment,
  opportunityLocation,
  opportunityProfession,
  opportunitySchedule,
} from '@/lib/explore/opportunity-display';

export function BoardResultRow({
  opportunity,
  ordinal,
}: {
  opportunity: OpportunitySummary;
  ordinal: number;
}) {
  const availability = opportunityAvailability(opportunity);
  const applicationMode = opportunityApplicationMode(opportunity);
  const sourceUrl = opportunity.source?.url ?? null;
  const sourceLabel = opportunity.source?.label ?? 'Source not stated';
  const compensation = formatOpportunityPay(opportunity);
  const location = opportunityLocation(opportunity);
  const profession = opportunityProfession(opportunity);
  const schedule = opportunitySchedule(opportunity);
  const employment = opportunityEmployment(opportunity);

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
            <h3 className="opf-role-title">
              <Link href={`/opportunities/${opportunity.id}`}>
                {opportunity.title.split('/').map((segment, index) => (
                  <Fragment key={`${segment}-${index}`}>
                    {index > 0 ? <>/<wbr /></> : null}
                    {segment}
                  </Fragment>
                ))}
              </Link>
            </h3>
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
            <p>{formatOpportunityObserved(availability.observedAt)}</p>
            <p>{CONFIDENCE_LABEL[availability.confidence]}</p>
          </div>
          <div>
            <p className="opf-proof-label">Compensation source</p>
            <p>{opportunityCompensationMethod(opportunity)}</p>
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

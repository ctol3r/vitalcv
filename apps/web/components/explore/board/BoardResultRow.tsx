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
  opportunityRowFacts,
  formatUnstatedFields,
} from '@/lib/explore/opportunity-display';

export function BoardResultRow({
  opportunity,
  ordinal,
  onFilterEmployer,
}: {
  opportunity: OpportunitySummary;
  ordinal: number;
  /**
   * Narrow the field to this employer. Optional: without it the name renders as
   * plain text, which is what a row outside the filterable board should do.
   */
  onFilterEmployer?: (organizationSlug: string) => void;
}) {
  const availability = opportunityAvailability(opportunity);
  const applicationMode = opportunityApplicationMode(opportunity);
  const sourceUrl = opportunity.source?.url ?? null;
  const sourceLabel = opportunity.source?.label ?? 'Source not stated';
  const facts = opportunityRowFacts(opportunity);
  // Provenance for a figure that does not exist is noise: when the source
  // published no pay, this cell repeated the same "not supplied" the fact list
  // already carried. It earns its place only when there IS a figure to source.
  const showCompensationSource = facts.stated.some((f) => f.label === 'Compensation');

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
            <p className="opf-role-org">
              {onFilterEmployer && opportunity.organizationSlug ? (
                <button
                  type="button"
                  className="opf-role-org-filter"
                  onClick={() => onFilterEmployer(opportunity.organizationSlug as string)}
                  aria-label={`Show only roles at ${opportunity.organizationName}`}
                >
                  {opportunity.organizationName}
                </button>
              ) : (
                opportunity.organizationName
              )}
            </p>
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
          {facts.stated.map((fact) => (
            <div key={fact.label}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>

        {facts.unstated.length > 0 ? (
          <p className="opf-role-silence">
            Source didn&rsquo;t state {formatUnstatedFields(facts.unstated)}.
          </p>
        ) : null}

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
          {showCompensationSource ? (
            <div>
              <p className="opf-proof-label">Compensation source</p>
              <p>{opportunityCompensationMethod(opportunity)}</p>
            </div>
          ) : null}
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

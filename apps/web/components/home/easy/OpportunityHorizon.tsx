'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import MatchExplanationFigure from '@/components/home/easy/figures/MatchExplanationFigure';
import { Button } from '@/components/ui/button';
import type { OpportunitySummary } from '@/lib/launch/marketplace';

type HorizonState =
  | { phase: 'loading'; opportunities: [] }
  | { phase: 'ready'; opportunities: OpportunitySummary[] }
  | { phase: 'error'; opportunities: [] };

function observedLabel(value: string | null | undefined): string {
  if (!value) return 'Observation time unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Observation time unavailable';
  return `Observed ${date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })}`;
}

function availability(opportunity: OpportunitySummary): { glyph: string; label: string } {
  const status = opportunity.status?.toLowerCase();
  if (status && status !== 'open' && status !== 'active') {
    return { glyph: '○', label: 'Availability needs review' };
  }
  if (opportunity.freshness?.isStale) {
    return { glyph: '△', label: 'Listing may be out of date' };
  }
  if (opportunity.freshness?.listingStatus === 'aging') {
    return { glyph: '△', label: 'Listing is aging' };
  }
  return { glyph: '●', label: 'Listed as open' };
}

function placement(opportunity: OpportunitySummary): string {
  return [
    opportunity.remote ? 'Remote' : opportunity.state,
    opportunity.hiringType,
    opportunity.payRange,
  ].filter(Boolean).join(' · ');
}

export default function OpportunityHorizon() {
  const [state, setState] = useState<HorizonState>({ phase: 'loading', opportunities: [] });

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/opportunities?limit=3', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('opportunity feed unavailable');
        return await response.json() as { opportunities?: OpportunitySummary[] };
      })
      .then((payload) => {
        const opportunities = Array.isArray(payload.opportunities)
          ? payload.opportunities.slice(0, 3)
          : [];
        setState({ phase: 'ready', opportunities });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setState({ phase: 'error', opportunities: [] });
      });

    return () => controller.abort();
  }, []);

  return (
    <section
      className="ezh-opportunities"
      data-home-opportunity-horizon=""
      data-header-theme="light"
      aria-labelledby="ezh-opportunities-heading"
    >
      <div className="ezh-wrap">
        <div className="ezh-opportunity-head">
          <div>
            <span className="ezh-k">Roles</span>
            <h2 id="ezh-opportunities-heading">
              A job board that reads your credentials, not your keywords.
            </h2>
            <p className="ezh-sec-sub">
              Most boards match the words on your r&eacute;sum&eacute;. VitalCV scores a role
              against what your record already shows &mdash; and names what stands between you
              and it, before you apply. When nothing fits, it says nothing fits instead of
              padding the list.
            </p>
          </div>
          <Link className="ezh-opportunity-all" href="/explore">
            Explore all opportunities <span aria-hidden="true">↗</span>
          </Link>
        </div>

        <MatchExplanationFigure />

        {state.phase === 'loading' ? (
          <div className="ezh-opportunity-state" role="status">
            Reading the current opportunity feed…
          </div>
        ) : null}

        {state.phase === 'error' ? (
          <div className="ezh-opportunity-state" role="status">
            Current listings could not be read.{' '}
            <Link href="/explore">Open the opportunity field</Link> to try again.
          </div>
        ) : null}

        {state.phase === 'ready' && state.opportunities.length === 0 ? (
          <div className="ezh-opportunity-state" role="status">
            No current listings are available. VitalCV will not substitute illustrative jobs.
          </div>
        ) : null}

        {state.phase === 'ready' && state.opportunities.length > 0 ? (
          <ol className="ezh-opportunity-list">
            {state.opportunities.map((opportunity) => {
              const sourceUrl = opportunity.source?.url ?? null;
              const external = opportunity.isFeedListing === true;
              const sourceObservedAt = opportunity.source?.fetchedAt
                ?? opportunity.source?.updatedAt
                ?? opportunity.updatedAt
                ?? opportunity.createdAt;
              const currentAvailability = availability(opportunity);

              return (
                <li key={opportunity.id} className="ezh-opportunity-row">
                  <div className="ezh-opportunity-copy">
                    <div className="ezh-opportunity-titleline">
                      <h3>{opportunity.title}</h3>
                      <span className="ezh-opportunity-org">{opportunity.organizationName}</span>
                    </div>
                    {placement(opportunity) ? (
                      <p className="ezh-opportunity-meta">{placement(opportunity)}</p>
                    ) : null}
                    <p className="ezh-opportunity-source">
                      <span>{opportunity.source?.label ?? 'Source not named'}</span>
                      <span aria-hidden="true"> · </span>
                      <span>{observedLabel(sourceObservedAt)}</span>
                      <span aria-hidden="true"> · </span>
                      <span>
                        <i aria-hidden="true">{currentAvailability.glyph}</i>{' '}
                        {currentAvailability.label}
                      </span>
                    </p>
                  </div>

                  {external && sourceUrl ? (
                    <Button asChild className="ezh-opportunity-action" variant="outline">
                      <a href={sourceUrl} target="_blank" rel="noopener noreferrer nofollow">
                        View original listing
                      </a>
                    </Button>
                  ) : external ? (
                    <Button className="ezh-opportunity-action" variant="outline" disabled>
                      Original listing unavailable
                    </Button>
                  ) : (
                    <Button asChild className="ezh-opportunity-action">
                      <Link href={`/opportunities/${opportunity.id}`}>Apply with VitalCV</Link>
                    </Button>
                  )}
                </li>
              );
            })}
          </ol>
        ) : null}

        <p className="ezh-opportunity-boundary">
          Public-feed roles open at their original source. Apply with VitalCV appears only for
          opportunities connected to VitalCV.
        </p>
      </div>
    </section>
  );
}

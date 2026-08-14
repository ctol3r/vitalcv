import Link from 'next/link';
import { PageFrame } from '@/components/layout/PageFrame';
import { VisualScene } from '@/components/visual-scene/VisualScene';
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
  opportunityIsActionable,
  opportunityLocation,
  opportunityProfession,
  opportunitySchedule,
} from '@/lib/explore/opportunity-display';
import type { OpportunitySummary } from '@/lib/launch/marketplace';

function sourceLink(opportunity: OpportunitySummary, className?: string) {
  const sourceUrl = opportunity.source?.url;
  const sourceLabel = opportunity.source?.label ?? 'Source not stated';
  if (!sourceUrl) return <span>{sourceLabel} · source page unavailable</span>;
  if (opportunityApplicationMode(opportunity) === 'external') {
    return (
      <a
        href={sourceUrl}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className={className}
      >
        {sourceLabel} <span aria-hidden="true">↗</span>
      </a>
    );
  }
  return <Link href={sourceUrl} className={className}>{sourceLabel}</Link>;
}

export function PublicOpportunityDetail({
  opportunity,
}: {
  opportunity: OpportunitySummary;
}) {
  const availability = opportunityAvailability(opportunity);
  const applicationMode = opportunityApplicationMode(opportunity);
  const actionable = opportunityIsActionable(opportunity);
  const sourceUrl = opportunity.source?.url ?? null;
  const compensation = formatOpportunityPay(opportunity);
  const facts = [
    ['Profession', opportunityProfession(opportunity)],
    ['Specialty', opportunity.specialty || 'Not stated'],
    ['Location', opportunityLocation(opportunity)],
    ['Schedule', opportunitySchedule(opportunity)],
    ['Employment', opportunityEmployment(opportunity)],
    ['Clinical setting', opportunity.employerType || 'Not stated'],
    ['Compensation', compensation ?? 'Not supplied by source'],
  ] as const;

  return (
    <div
      className="vod-public"
      data-surface-tier="public"
      data-application-mode={applicationMode}
      data-availability-state={availability.state}
    >
      <PageFrame as="main" mode="marketing" className="vod-public-frame">
        <Link href="/explore" className="vod-back-link">
          <span aria-hidden="true">←</span> Explore clinician opportunities
        </Link>

        <header className="vod-public-hero">
          <div className="vod-public-copy">
            <p className="vod-eyebrow">Clinical opportunity · source attached</p>
            <p className="vod-availability" data-state={availability.state}>
              <span aria-hidden="true">{AVAILABILITY_GLYPH[availability.state]}</span>{' '}
              {AVAILABILITY_LABEL[availability.state]}
            </p>
            <h1>{opportunity.title}</h1>
            <p className="vod-org">{opportunity.organizationName}</p>
            <p className="vod-public-lede">
              Review the role, the source that supplied it, and the current application path
              before you decide what to do next.
            </p>
            <div className="vod-actions">
              {actionable && applicationMode === 'external' && sourceUrl ? (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="vod-primary-action"
                >
                  View original listing <span aria-hidden="true">↗</span>
                </a>
              ) : actionable && applicationMode === 'vitalcv' ? (
                <Link
                  href={`/holder/opportunities/${encodeURIComponent(opportunity.id)}`}
                  className="vod-primary-action"
                  data-testid="apply-with-vitalcv"
                >
                  Apply with VitalCV <span aria-hidden="true">→</span>
                </Link>
              ) : (
                <span className="vod-unavailable-action" aria-disabled="true">
                  {availability.state === 'closed'
                    ? 'This role is recorded as closed'
                    : 'Original listing unavailable'}
                </span>
              )}
              <Link href="/explore" className="vod-secondary-action">Keep exploring</Link>
            </div>
          </div>

          <div className="vod-public-media">
            <VisualScene
              scene="journey_film"
              kind="process"
              routeVariant="opportunity_detail_documentary"
              priority="hero"
              mode="static"
            />
            <div className="vod-source-ticket">
              <p>Source record</p>
              <strong>{opportunity.source?.label ?? 'Source not stated'}</strong>
              <span>{formatOpportunityObserved(availability.observedAt)}</span>
            </div>
          </div>
        </header>

        <section className="vod-public-register" aria-labelledby="role-facts-heading">
          <div className="vod-section-heading">
            <p>01 · Role record</p>
            <h2 id="role-facts-heading">The supplied facts, without a fit verdict.</h2>
          </div>
          <dl className="vod-facts">
            {facts.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="vod-public-columns">
          <section aria-labelledby="about-role-heading" className="vod-paper-section">
            <p className="vod-section-number">02 · About the role</p>
            <h2 id="about-role-heading">What the listing says</h2>
            {opportunity.description ? (
              <p className="vod-description">{opportunity.description}</p>
            ) : (
              <p className="vod-description vod-muted">
                No role description was supplied by the source.
              </p>
            )}
          </section>

          <aside className="vod-proof-sheet" aria-labelledby="source-receipt-heading">
            <p className="vod-section-number">03 · Source receipt</p>
            <h2 id="source-receipt-heading">What is known about this listing</h2>
            <dl>
              <div>
                <dt>Source</dt>
                <dd>{sourceLink(opportunity)}</dd>
              </div>
              <div>
                <dt>Observation</dt>
                <dd>{formatOpportunityObserved(availability.observedAt)}</dd>
              </div>
              <div>
                <dt>Confidence</dt>
                <dd>{CONFIDENCE_LABEL[availability.confidence]}</dd>
              </div>
              <div>
                <dt>Compensation source</dt>
                <dd>{opportunityCompensationMethod(opportunity)}</dd>
              </div>
              <div>
                <dt>Application path</dt>
                <dd>
                  {applicationMode === 'external'
                    ? 'Continue at the original listing'
                    : 'Clinician-controlled VitalCV application'}
                </dd>
              </div>
            </dl>
            <p className="vod-limitation">{availability.limitation}</p>
          </aside>
        </div>

        <footer className="vod-public-boundary">
          <p>
            VitalCV presents the listing source and its observation state. It does not endorse
            the opening or make a public eligibility decision. Institution review remains.
          </p>
          <Link href="/explore">Return to the opportunity field <span aria-hidden="true">→</span></Link>
        </footer>
      </PageFrame>
    </div>
  );
}

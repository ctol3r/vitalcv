'use client';

/**
 * Signed-in opportunity detail.
 *
 * MATCHA explains fit and gaps without an automatic eligibility verdict.
 * Integrated opportunities continue into the existing ApplyModal disclosure
 * flow. Feed roles always return to their original source.
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronRight, Loader2 } from 'lucide-react';
import { PageFrame } from '@/components/layout/PageFrame';
import { useClinicianMobile } from '@/components/mobile/ClinicianMobileProvider';
import { CaptureInWorkbench } from '@/components/workbench/CaptureInWorkbench';
import {
  AVAILABILITY_GLYPH,
  AVAILABILITY_LABEL,
  CONFIDENCE_LABEL,
  buildSignedOpportunityExplanation,
  formatOpportunityObserved,
  formatOpportunityPay,
  opportunityApplicationMode,
  opportunityAvailability,
  opportunityCompensationMethod,
  opportunityEmployment,
  opportunityFromPayload,
  opportunityIsActionable,
  opportunityLocation,
  opportunityProfession,
  opportunitySchedule,
} from '@/lib/explore/opportunity-display';
import type { OpportunitySummary } from '@/lib/launch/marketplace';
import type { MobileOpportunityCard } from '@/lib/mobile/dashboard';

type FallbackState = 'idle' | 'loading' | 'not_found' | 'error';

export default function OpportunityDetailSurface({ opportunityId }: { opportunityId: string }) {
  const { data } = useClinicianMobile();
  const card: MobileOpportunityCard | null = useMemo(
    () => data.opportunities.find((opportunity) => opportunity.id === opportunityId) ?? null,
    [data.opportunities, opportunityId],
  );
  const [fallback, setFallback] = useState<OpportunitySummary | null>(null);
  const [fallbackState, setFallbackState] = useState<FallbackState>('idle');

  useEffect(() => {
    if (card) return;
    let cancelled = false;

    async function loadFallback() {
      setFallbackState('loading');
      try {
        const response = await fetch(`/api/opportunities/${encodeURIComponent(opportunityId)}`, {
          cache: 'no-store',
        });
        if (cancelled) return;
        if (response.status === 404) {
          setFallbackState('not_found');
          return;
        }
        if (!response.ok) {
          setFallbackState('error');
          return;
        }
        const parsed = opportunityFromPayload(await response.json());
        if (cancelled) return;
        if (!parsed) {
          setFallbackState('not_found');
          return;
        }
        setFallback(parsed);
        setFallbackState('idle');
      } catch {
        if (!cancelled) setFallbackState('error');
      }
    }

    void loadFallback();
    return () => {
      cancelled = true;
    };
  }, [card, opportunityId]);

  if (!card && fallbackState === 'loading') {
    return <LoadingState />;
  }

  if (!card && fallbackState === 'not_found') {
    return (
      <Shell>
        <BackLink />
        <StatePanel
          title="This role could not be found"
          description="The record may have been removed. Return to the opportunity field for current roles and their source state."
        />
      </Shell>
    );
  }

  if (!card && fallbackState === 'error') {
    return (
      <Shell>
        <BackLink />
        <StatePanel
          title="Couldn’t load this role"
          description="This is a system state, not a change to the role or your fit explanation. Try again shortly."
        />
      </Shell>
    );
  }

  const opportunity = card ?? fallback;
  if (!opportunity) return <LoadingState />;

  const match = card?.match ?? null;
  const application = card?.application ?? null;
  const explanation = buildSignedOpportunityExplanation(opportunity, match);
  const availability = opportunityAvailability(opportunity);
  const applicationMode = opportunityApplicationMode(opportunity);
  const actionable = opportunityIsActionable(opportunity);
  const sourceUrl = opportunity.source?.url ?? null;
  const compensation = formatOpportunityPay(opportunity);

  return (
    <Shell>
      <BackLink />

      <header
        className="vod-product-header"
        data-application-mode={applicationMode}
        data-availability-state={availability.state}
      >
        <p className="vod-product-kicker">
          {AVAILABILITY_GLYPH[availability.state]} {AVAILABILITY_LABEL[availability.state]}
          {' · '}{opportunity.organizationName}
        </p>
        <div className="vod-product-heading">
          <h1>{opportunity.title}</h1>
          <CaptureInWorkbench context={`Role: ${opportunity.title} — ${opportunity.state}`} />
        </div>

        <dl className="vod-product-facts">
          <div>
            <dt>Profession</dt>
            <dd>{opportunityProfession(opportunity)}</dd>
          </div>
          <div>
            <dt>Specialty</dt>
            <dd>{opportunity.specialty || 'Not stated'}</dd>
          </div>
          <div>
            <dt>Location</dt>
            <dd>{opportunityLocation(opportunity)}</dd>
          </div>
          <div>
            <dt>Schedule</dt>
            <dd>{opportunitySchedule(opportunity)}</dd>
          </div>
          <div>
            <dt>Employment</dt>
            <dd>{opportunityEmployment(opportunity)}</dd>
          </div>
          <div>
            <dt>Compensation</dt>
            <dd>{compensation ?? 'Not supplied by source'}</dd>
          </div>
        </dl>

        <div className="vod-product-actions">
          {application ? (
            <Link
              href={`/holder/applications/${encodeURIComponent(application.id)}`}
              className="mz-btn mz-btn-ghost min-h-12"
            >
              View submitted application <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          ) : actionable && applicationMode === 'external' && sourceUrl ? (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="mz-btn min-h-12"
            >
              View original listing <span aria-hidden="true">↗</span>
            </a>
          ) : actionable && applicationMode === 'vitalcv' ? (
            <Link
              href={`/holder/opportunities?apply=${encodeURIComponent(opportunity.id)}`}
              className="mz-btn min-h-12"
            >
              Review evidence and apply <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          ) : (
            <span className="vod-product-status" aria-disabled="true">
              {availability.state === 'closed'
                ? 'This role is recorded as closed'
                : 'Original listing unavailable'}
            </span>
          )}
        </div>
      </header>

      <section className="vod-product-section" aria-labelledby="matcha-heading">
        <p className="vod-product-label">Role fit · clinician-side explanation</p>
        <h2 id="matcha-heading">Why this role may fit—and what remains uncertain.</h2>
        <p className="vod-product-note">
          VitalCV compares the role record with evidence and preferences in your profile. It does
          not decide eligibility, rank you for an employer, or send anything without your choice.
        </p>
      </section>

      <div className="vod-product-grid">
        <ExplanationSection
          label="Why this may fit"
          title="Signals worth considering"
          values={explanation.whyThisMayFit}
          empty="No role-specific fit reason is available from the current record."
        />
        <ExplanationSection
          label="Evidence gaps"
          title="What may need your attention"
          values={explanation.evidenceGaps}
          empty="No evidence gap is stated in the current explanation."
        />
        <ExplanationSection
          label="Still unknown"
          title="What the source does not settle"
          values={explanation.stillUnknown}
          empty="No additional uncertainty was returned. Confirm role details with the source."
        />
        <ExplanationSection
          label="Clinician-controlled next steps"
          title="What you can choose to do"
          values={explanation.resolveNext}
          empty={applicationMode === 'external'
            ? 'Review the original listing and decide whether to continue there.'
            : 'Review the exact evidence packet before choosing whether to submit.'}
        />
      </div>

      <section className="vod-product-section" aria-labelledby="role-description-heading">
        <p className="vod-product-label">Role description</p>
        <h2 id="role-description-heading">What the listing says</h2>
        {opportunity.description ? (
          <p className="mt-4 whitespace-pre-line mz-body">{opportunity.description}</p>
        ) : (
          <p className="vod-product-empty">No role description was supplied by the source.</p>
        )}
      </section>

      <aside className="vod-product-proof" aria-labelledby="role-source-heading">
        <p className="vod-product-label">Source and application continuity</p>
        <h2 id="role-source-heading">The source stays attached to your next step.</h2>
        <dl>
          <div>
            <dt>Source</dt>
            <dd>{renderSource(opportunity)}</dd>
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
            <dt>Application path</dt>
            <dd>
              {applicationMode === 'external'
                ? 'Continue at original source'
                : 'Preview, choose, consent, then seal'}
            </dd>
          </div>
          <div>
            <dt>Compensation source</dt>
            <dd>{opportunityCompensationMethod(opportunity)}</dd>
          </div>
          <div>
            <dt>Availability</dt>
            <dd>{AVAILABILITY_LABEL[availability.state]}</dd>
          </div>
        </dl>
        <p className="vod-product-note">{availability.limitation}</p>
      </aside>
    </Shell>
  );
}

function ExplanationSection({
  label,
  title,
  values,
  empty,
}: {
  label: string;
  title: string;
  values: string[];
  empty: string;
}) {
  return (
    <section className="vod-product-section">
      <p className="vod-product-label">{label}</p>
      <h2>{title}</h2>
      {values.length > 0 ? (
        <ul className="vod-product-list">
          {values.map((value) => <li key={value}>{value}</li>)}
        </ul>
      ) : (
        <p className="vod-product-empty">{empty}</p>
      )}
    </section>
  );
}

function renderSource(opportunity: OpportunitySummary) {
  const url = opportunity.source?.url;
  const label = opportunity.source?.label ?? 'Source not stated';
  if (!url) return <span>{label} · source page unavailable</span>;
  if (opportunityApplicationMode(opportunity) === 'external') {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer nofollow">
        {label} <span aria-hidden="true">↗</span>
      </a>
    );
  }
  return <Link href={url}>{label}</Link>;
}

function LoadingState() {
  return (
    <Shell>
      <div className="flex flex-col items-center gap-3 py-16" role="status" aria-live="polite">
        <Loader2 className="h-7 w-7 animate-spin text-[var(--ink-400)]" aria-hidden />
        <p className="mz-small">Loading role…</p>
      </div>
    </Shell>
  );
}

function StatePanel({ title, description }: { title: string; description: string }) {
  return (
    <div className="vod-product-section py-12 text-center">
      <h1 className="mz-h1">{title}</h1>
      <p className="mx-auto mt-3 max-w-xl mz-body">{description}</p>
      <Link href="/holder/opportunities" className="mz-btn mt-5 min-h-12">
        See current roles <ChevronRight className="h-4 w-4" aria-hidden />
      </Link>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="vod-product mz mz-paper mz-ambient min-h-screen w-full">
      <PageFrame mode="product" className="vcv-page-frame--mobile-nav max-w-5xl flex flex-col gap-5">
        {children}
      </PageFrame>
    </main>
  );
}

function BackLink() {
  return (
    <Link
      href="/holder/opportunities"
      className="inline-flex min-h-12 w-fit items-center gap-1.5 mz-small transition hover:text-[var(--ink-900)]"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden /> All roles
    </Link>
  );
}

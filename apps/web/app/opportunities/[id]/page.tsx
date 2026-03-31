import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CircleAlert,
  Clock3,
  DollarSign,
  FileCheck2,
  MapPin,
  Sparkles,
  Stethoscope,
  Users,
} from 'lucide-react';
import { getBackendBase } from '@/lib/api';
import {
  fetchLaunchEmployer,
  fetchLaunchOpportunity,
  type OpportunitySummary,
} from '@/lib/launch/marketplace';
import { buildMarketplaceHeaders } from '@/lib/server/marketplace-proxy';
import OpportunityViewedTracker from '@/components/mobile/OpportunityViewedTracker';
import { SupportActionButton } from '@/components/pilot-ops/SupportActionButton';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const LEVEL_COLOR: Record<string, string> = {
  L3: 'border-red-500/20 bg-red-500/10 text-red-300',
  L2: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
  L1: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
};

const READINESS_STATUS_LABELS: Record<string, string> = {
  ready_now: 'Ready now',
  needs_review: 'Needs review',
  requirements_missing: 'Requirements missing',
};

function formatHiringType(value: string): string {
  switch (value) {
    case 'perm':
      return 'Permanent';
    case 'locums':
      return 'Locums';
    case 'telehealth':
      return 'Telehealth';
    case 'contract':
      return 'Contract';
    case 'per_diem':
      return 'Per diem';
    default:
      return value.replace(/_/g, ' ');
  }
}

function formatPayModel(value: OpportunitySummary['payModel']): string {
  switch (value) {
    case 'salary':
      return 'Salary';
    case 'hourly':
      return 'Hourly';
    case 'locums':
      return 'Locums';
    case 'shift':
      return 'Per shift';
    default:
      return 'Not stated';
  }
}

function formatVisaStatus(value: OpportunitySummary['visaSponsorshipStatus']): string {
  switch (value) {
    case 'available':
      return 'Sponsor support available';
    case 'case_by_case':
      return 'Case-by-case sponsorship';
    case 'not_available':
      return 'No sponsor support';
    default:
      return 'Not stated';
  }
}

function formatBenefitsStatus(value: OpportunitySummary['benefitsAvailability'], summary: string | null | undefined): string {
  switch (value) {
    case 'listed':
      return summary ?? 'Benefits/support listed';
    case 'limited':
      return summary ?? 'Some support details listed';
    default:
      return 'Benefits not listed';
  }
}

function formatFreshness(value: OpportunitySummary['freshness']): string {
  switch (value?.listingStatus) {
    case 'fresh':
      return 'Fresh listing';
    case 'aging':
      return 'Aging listing';
    case 'stale':
      return 'Potentially stale';
    default:
      return 'Freshness unknown';
  }
}

function formatDate(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

function firstQueryValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

async function fetchOpportunityDetail(id: string, npi?: string): Promise<OpportunitySummary | null> {
  const session = await auth();
  const params = new URLSearchParams();
  if (npi) {
    params.set('npi', npi);
  }

  try {
    const response = await fetch(
      `${getBackendBase()}/api/opportunities/${encodeURIComponent(id)}${params.toString() ? `?${params.toString()}` : ''}`,
      {
        cache: 'no-store',
        headers: buildMarketplaceHeaders(session, {
          'Content-Type': 'application/json',
        }),
      },
    );

    if (!response.ok) {
      return null;
    }

    const payload = await response.json() as { opportunity?: OpportunitySummary };
    return payload.opportunity ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Pick<Props, 'params'>): Promise<Metadata> {
  const { id } = await params;
  const opportunity = await fetchLaunchOpportunity(id);

  if (!opportunity) {
    return {
      title: 'Opportunity Not Found — VitalCV',
    };
  }

  return {
    title: `${opportunity.title} — VitalCV`,
    description: opportunity.description ?? `${opportunity.title} at ${opportunity.organizationName}`,
  };
}

export default async function OpportunityDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const npi = firstQueryValue(resolvedSearchParams.npi);
  const opportunity = await fetchOpportunityDetail(id, npi);

  if (!opportunity) {
    notFound();
  }

  const employer = await fetchLaunchEmployer(opportunity.organizationSlug);
  const exploreParams = new URLSearchParams({
    apply: opportunity.id,
    organizationSlug: opportunity.organizationSlug,
  });

  if (npi) {
    exploreParams.set('npi', npi);
  }
  if (opportunity.specialty) {
    exploreParams.set('specialty', opportunity.specialty);
  }
  if (opportunity.state) {
    exploreParams.set('state', opportunity.state);
  }

  const applyHref = `/explore?${exploreParams.toString()}`;
  const onboardingHref = `/onboarding?returnTo=${encodeURIComponent(applyHref)}`;
  const sourceUpdatedAt = formatDate(opportunity.source?.updatedAt ?? opportunity.freshness?.lastUpdatedAt ?? opportunity.updatedAt);
  const comparison = opportunity.comparison ?? null;
  const explanation = opportunity.explanation ?? {
    whyThisMayFit: [],
    whatMayBlockYou: [],
    resolveNext: [],
    stillUnknown: [],
  };

  return (
    <div className="min-h-screen bg-ops-gradient text-white surface-operator">
      <OpportunityViewedTracker
        opportunityId={opportunity.id}
        organizationName={opportunity.organizationName}
        title={opportunity.title}
      />
      <div className="mx-auto max-w-7xl px-6 py-10">
        <nav className="flex flex-wrap items-center gap-2 text-xs text-white/45">
          <Link href="/" className="transition hover:text-white/70">Home</Link>
          <span>/</span>
          <Link href="/explore" className="transition hover:text-white/70">Explore</Link>
          <span>/</span>
          <span className="text-white/70">{opportunity.title}</span>
        </nav>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(18rem,0.95fr)]">
          <section className="space-y-6">
            <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-4xl">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-white/75">
                      <Building2 className="h-7 w-7" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h1 className="text-3xl font-semibold tracking-tight text-white">{opportunity.title}</h1>
                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${LEVEL_COLOR[opportunity.requirementLevel] ?? LEVEL_COLOR.L1}`}>
                          {opportunity.requirementLevel}
                        </span>
                        {comparison ? (
                          <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-200">
                            {READINESS_STATUS_LABELS[comparison.status] ?? 'Comparison ready'}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm text-white/60">{opportunity.organizationName}</p>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4 text-sm text-white/70">
                    <DetailChip icon={<MapPin className="h-4 w-4" />} label={opportunity.remote ? `Remote (${opportunity.state})` : opportunity.state} />
                    <DetailChip icon={<Users className="h-4 w-4" />} label={formatHiringType(opportunity.hiringType)} />
                    <DetailChip icon={<DollarSign className="h-4 w-4" />} label={opportunity.payRange ?? 'Pay not disclosed'} />
                    <DetailChip icon={<Clock3 className="h-4 w-4" />} label={opportunity.startTimeline ?? employer?.timeToStart ?? 'Start timing not stated'} />
                  </div>

                  <div className="mt-6 flex flex-wrap gap-2 text-xs text-white/70">
                    <TagPill>{opportunity.specialty}</TagPill>
                    <TagPill>{formatPayModel(opportunity.payModel)}</TagPill>
                    <TagPill>{formatVisaStatus(opportunity.visaSponsorshipStatus)}</TagPill>
                    <TagPill>{formatFreshness(opportunity.freshness)}</TagPill>
                  </div>

                  <p className="mt-6 text-sm leading-7 text-white/75">
                    {opportunity.description ?? 'This active role is live in the opportunities feed. VitalCV is surfacing the employer requirements, compensation visibility, and readiness context from the current source-backed record.'}
                  </p>

                  {sourceUpdatedAt ? (
                    <p className="mt-4 text-xs text-white/45">
                      Source updated {sourceUpdatedAt}
                    </p>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-right">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-white/45">Market truth</p>
                  <p className="mt-1 text-lg font-semibold text-white">{opportunity.transparency?.employerDataCompleteness ?? 'Source coverage unavailable'}</p>
                  <p className="mt-2 text-xs text-white/50">{opportunity.transparency?.listingFreshness ?? 'Freshness not stated'}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
              <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">What This Job Is, Really</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Clarity before you spend time</h2>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <TruthCard
                    icon={<DollarSign className="h-4 w-4" />}
                    title="Compensation"
                    value={opportunity.payRange ?? 'Not disclosed'}
                    detail={`Pay model: ${formatPayModel(opportunity.payModel)}`}
                  />
                  <TruthCard
                    icon={<CircleAlert className="h-4 w-4" />}
                    title="Visa Sponsorship"
                    value={formatVisaStatus(opportunity.visaSponsorshipStatus)}
                    detail={opportunity.visaSponsorshipSummary ?? 'Current employer data does not state sponsorship support.'}
                  />
                  <TruthCard
                    icon={<Sparkles className="h-4 w-4" />}
                    title="Benefits / Support"
                    value={formatBenefitsStatus(opportunity.benefitsAvailability, opportunity.benefitsSummary)}
                    detail={opportunity.benefitsItems?.length ? opportunity.benefitsItems.join(', ') : 'No additional benefits were explicitly listed in the current source data.'}
                  />
                  <TruthCard
                    icon={<Clock3 className="h-4 w-4" />}
                    title="Speed To Start"
                    value={opportunity.startTimeline ?? 'Not stated'}
                    detail={opportunity.transparency?.speedToStartEstimate ?? employer?.timeToOnboard ?? 'Onboarding timing not stated.'}
                  />
                </div>
              </section>

              <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Employer Transparency</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">What the current record proves</h2>
                <div className="mt-6 grid gap-3">
                  <SignalRow label="Hiring state" value={opportunity.transparency?.hiringState ?? employer?.hiringStatus ?? 'unknown'} />
                  <SignalRow label="Listing freshness" value={opportunity.transparency?.listingFreshness ?? 'unknown'} />
                  <SignalRow label="Benefits visibility" value={opportunity.transparency?.benefitsVisibility ?? 'unknown'} />
                  <SignalRow label="Sponsorship support" value={opportunity.transparency?.sponsorshipSupport ?? 'unknown'} />
                  <SignalRow label="Employer data" value={opportunity.transparency?.employerDataCompleteness ?? 'unknown'} />
                </div>
                {opportunity.transparency?.evidence?.length ? (
                  <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">Evidence</p>
                    <div className="mt-3 space-y-2 text-sm text-white/70">
                      {opportunity.transparency.evidence.map((entry) => (
                        <p key={entry}>{entry}</p>
                      ))}
                    </div>
                  </div>
                ) : null}
              </section>
            </div>

            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Readiness-To-Opportunity</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">
                    {comparison ? 'What you already satisfy, what is still in the way' : 'What this employer checks before you start'}
                  </h2>
                </div>
                {comparison ? (
                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs text-emerald-100">
                    <FileCheck2 className="h-3.5 w-3.5" />
                    {READINESS_STATUS_LABELS[comparison.status] ?? 'Comparison ready'}
                  </div>
                ) : null}
              </div>

              {comparison ? (
                <>
                  <div className="mt-5 grid gap-4 lg:grid-cols-3">
                    <ComparisonColumn
                      title="Already Satisfied"
                      items={comparison.satisfied}
                      emptyLabel="No verified matches are confirmed yet."
                      tone="success"
                    />
                    <ComparisonColumn
                      title="Missing"
                      items={comparison.missing}
                      emptyLabel="No confirmed blockers from the current record."
                      tone="warning"
                    />
                    <ComparisonColumn
                      title="Unknown"
                      items={comparison.unknown}
                      emptyLabel="No remaining unknowns from the current record."
                      tone="neutral"
                    />
                  </div>

                  <div className="mt-5 grid gap-4 lg:grid-cols-2">
                    <SummaryPanel
                      title="Estimated Readiness Gap"
                      value={comparison.estimatedGap}
                      icon={<CircleAlert className="h-4 w-4" />}
                    />
                    <SummaryPanel
                      title="Shortest Path"
                      value={comparison.shortestPath}
                      icon={<ArrowRight className="h-4 w-4" />}
                    />
                  </div>
                </>
              ) : (
                <div className="mt-5 rounded-3xl border border-amber-400/20 bg-amber-400/10 p-5">
                  <h3 className="text-lg font-semibold text-white">Clinician comparison is not attached yet</h3>
                  <p className="mt-2 text-sm leading-6 text-white/70">
                    VitalCV can still show the employer&apos;s stated requirements, but a clinician-specific gap view needs a signed-in clinician context or an `npi` query on this detail page.
                  </p>
                </div>
              )}

              <div className="mt-5 space-y-3">
                {opportunity.credentialRequirements?.map((requirement) => (
                  <div
                    key={`${requirement.label}-${requirement.level}-${requirement.key ?? 'unmapped'}`}
                    className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-white">{requirement.label}</p>
                      <p className="mt-1 text-xs leading-5 text-white/50">
                        {requirement.note ?? (requirement.priority === 'preferred' ? 'Employer marked this as preferred.' : 'Employer marked this as required.')}
                      </p>
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${LEVEL_COLOR[requirement.level] ?? LEVEL_COLOR.L1}`}>
                      {requirement.level}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Why This Fits / Doesn&apos;t Fit</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Inspectable reasoning only</h2>
              <div className="mt-6 grid gap-4 xl:grid-cols-2">
                <ExplanationCard title="Why this may fit" items={explanation.whyThisMayFit} />
                <ExplanationCard title="What may block you" items={explanation.whatMayBlockYou} />
                <ExplanationCard title="What to resolve next" items={explanation.resolveNext} />
                <ExplanationCard title="What is still unknown" items={explanation.stillUnknown} />
              </div>
            </section>
          </section>

          <aside className="space-y-5">
            <div className="rounded-3xl border border-emerald-500/25 bg-emerald-500/10 p-5">
              <div className="flex items-center gap-2">
                <BriefcaseBusiness className="h-5 w-5 text-emerald-300" />
                <p className="text-sm font-semibold text-white">Apply with context</p>
              </div>
              <p className="mt-3 text-sm leading-6 text-emerald-100/85">
                You should know the pay visibility, requirement gap, freshness, and employer transparency before you spend time here.
              </p>
              <div className="mt-4 space-y-3">
                <Link
                  href={applyHref}
                  className="inline-flex w-full items-center justify-between rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-black transition hover:bg-emerald-400"
                >
                  <span>Apply now</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href={onboardingHref}
                  className="inline-flex items-center gap-2 text-sm font-medium text-emerald-100/85 transition hover:text-white"
                >
                  <span>Check readiness first</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Employer</p>
              <h2 className="mt-2 text-xl font-semibold text-white">{opportunity.organizationName}</h2>
              <div className="mt-4 space-y-3 text-sm text-white/65">
                <p>{employer?.tagline ?? 'Live employer profile is linked to this opportunity.'}</p>
                {employer ? (
                  <>
                    <p>{employer.timeToOnboard} onboarding window</p>
                    <p>{employer.recentHires} recent hire{employer.recentHires === 1 ? '' : 's'} on the current employer profile</p>
                  </>
                ) : null}
              </div>
              <Link
                href={`/employers/${opportunity.organizationSlug}`}
                className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-emerald-300 transition hover:text-emerald-200"
              >
                Review employer profile
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {!employer ? (
              <div className="rounded-3xl border border-amber-400/20 bg-amber-400/10 p-5">
                <h3 className="text-lg font-semibold text-white">Employer detail fallback</h3>
                <p className="mt-2 text-sm leading-6 text-white/65">
                  The opportunity truth model is live, but the linked employer profile payload did not load for this page.
                </p>
                <div className="mt-4">
                  <SupportActionButton
                    label="Contact support"
                    title="Opportunity detail missing employer profile"
                    messagePrefill={`Opportunity ${opportunity.id} did not load linked employer profile details.`}
                    className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-white/75 transition hover:text-white"
                  />
                </div>
              </div>
            ) : null}

            <Link
              href="/explore"
              className="inline-flex items-center gap-2 text-sm text-white/45 transition hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to live roles
            </Link>
          </aside>
        </div>
      </div>
    </div>
  );
}

function DetailChip({
  icon,
  label,
}: {
  icon: ReactNode;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
      {icon}
      {label}
    </span>
  );
}

function TagPill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
      {children}
    </span>
  );
}

function TruthCard({
  icon,
  title,
  value,
  detail,
}: {
  icon: ReactNode;
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-white/45">
        {icon}
        {title}
      </div>
      <p className="mt-3 text-lg font-semibold text-white">{value}</p>
      <p className="mt-2 text-sm leading-6 text-white/65">{detail}</p>
    </div>
  );
}

function SignalRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm">
      <span className="text-white/50">{label}</span>
      <span className="max-w-[16rem] text-right text-white/80">{value}</span>
    </div>
  );
}

function ComparisonColumn({
  title,
  items,
  emptyLabel,
  tone,
}: {
  title: string;
  items: Array<{ label: string; detail: string; nextStep?: string | null }>;
  emptyLabel: string;
  tone: 'success' | 'warning' | 'neutral';
}) {
  const toneClasses = tone === 'success'
    ? 'border-emerald-400/20 bg-emerald-400/10'
    : tone === 'warning'
      ? 'border-amber-400/20 bg-amber-400/10'
      : 'border-white/10 bg-black/20';

  return (
    <div className={`rounded-3xl border p-4 ${toneClasses}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">{title}</p>
      <div className="mt-4 space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-white/60">{emptyLabel}</p>
        ) : (
          items.map((item) => (
            <div key={`${title}-${item.label}-${item.detail}`} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
              <p className="text-sm font-medium text-white">{item.label}</p>
              <p className="mt-1 text-sm leading-6 text-white/65">{item.detail}</p>
              {item.nextStep ? (
                <p className="mt-2 text-xs font-medium text-emerald-200">{item.nextStep}</p>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function SummaryPanel({
  title,
  value,
  icon,
}: {
  title: string;
  value: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-white/45">
        {icon}
        {title}
      </div>
      <p className="mt-3 text-sm leading-6 text-white/75">{value}</p>
    </div>
  );
}

function ExplanationCard({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
      <div className="flex items-center gap-2">
        {title === 'Why this may fit' ? <Sparkles className="h-4 w-4 text-emerald-300" /> : null}
        {title === 'What may block you' ? <CircleAlert className="h-4 w-4 text-amber-300" /> : null}
        {title === 'What to resolve next' ? <ArrowRight className="h-4 w-4 text-cyan-300" /> : null}
        {title === 'What is still unknown' ? <Stethoscope className="h-4 w-4 text-white/60" /> : null}
        <h3 className="text-lg font-semibold text-white">{title}</h3>
      </div>
      <div className="mt-4 space-y-3 text-sm leading-6 text-white/70">
        {items.length === 0 ? (
          <p>No additional signal is available from the current source data.</p>
        ) : (
          items.map((item) => <p key={`${title}-${item}`}>{item}</p>)
        )}
      </div>
    </div>
  );
}

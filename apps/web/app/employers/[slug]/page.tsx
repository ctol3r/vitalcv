import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  Clock,
  MapPin,
  ShieldCheck,
  Stethoscope,
} from 'lucide-react';
import RequirementsTable from '@/components/employers/RequirementsTable';
import {
  fetchLaunchEmployer,
  fetchLaunchOpportunities,
} from '@/lib/launch/marketplace';

interface Props {
  params: Promise<{ slug: string }>;
}

function hiringStatusLabel(value: string): string {
  switch (value) {
    case 'HIRING_NOW':
      return 'Hiring now';
    case 'ACTIVELY_HIRING':
      return 'Actively hiring';
    case 'ACCEPTING_APPLICATIONS':
      return 'Accepting applications';
    case 'NOT_HIRING':
      return 'Not hiring';
    default:
      return value.replace(/_/g, ' ').toLowerCase();
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const employer = await fetchLaunchEmployer(slug);

  if (!employer) {
    return {
      title: 'Employer Not Found — VitalCV',
    };
  }

  return {
    title: `${employer.name} — VitalCV`,
    description: employer.tagline,
  };
}

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-sm text-white/55">{detail}</p>
    </div>
  );
}

export default async function EmployerProfilePage({ params }: Props) {
  const { slug } = await params;
  const [employer, opportunityPayload] = await Promise.all([
    fetchLaunchEmployer(slug),
    fetchLaunchOpportunities({
      organizationSlug: slug,
      limit: 20,
    }),
  ]);

  if (!employer) {
    notFound();
  }

  const scopedExploreHref = `/explore?organizationSlug=${encodeURIComponent(employer.slug)}`;
  const scopedOnboardingHref = `/onboarding?returnTo=${encodeURIComponent(scopedExploreHref)}`;

  return (
    <div className="min-h-screen bg-ops-gradient text-white surface-operator">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <nav className="flex flex-wrap items-center gap-2 text-xs text-white/45">
          <Link href="/" className="transition hover:text-white/70">Home</Link>
          <span>/</span>
          <Link href="/employers" className="transition hover:text-white/70">Employers</Link>
          <span>/</span>
          <span className="text-white/70">{employer.name}</span>
        </nav>

        <section className="mt-6 rounded-[28px] border border-white/10 bg-white/[0.04] p-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-white/75">
                  <Building2 className="h-7 w-7" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-3xl font-semibold tracking-tight text-white">{employer.name}</h1>
                    <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-300">
                      {hiringStatusLabel(employer.hiringStatus)}
                    </span>
                    {employer.verifiedSince ? (
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/65">
                        Verified
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm text-white/55">{employer.facilityType}</p>
                </div>
              </div>

              <p className="mt-6 text-lg leading-8 text-white/75">{employer.tagline}</p>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-white/60">{employer.description}</p>

              <div className="mt-5 flex flex-wrap gap-2">
                {employer.specialties.slice(0, 5).map((specialty) => (
                  <span
                    key={specialty}
                    className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-100"
                  >
                    {specialty}
                  </span>
                ))}
              </div>
            </div>

            <div className="w-full max-w-sm space-y-3">
              <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Current actions</p>
                <div className="mt-4 flex flex-col gap-3">
                  <Link
                    href={scopedOnboardingHref}
                    className="inline-flex items-center justify-between rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-black transition hover:bg-emerald-400"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Stethoscope className="h-4 w-4" />
                      Clinician onboarding
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href="/verifier/inbox"
                    className="inline-flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-white/75 transition hover:text-white"
                  >
                    <span className="inline-flex items-center gap-2">
                      <BriefcaseBusiness className="h-4 w-4" />
                      Employer workspace
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href="/intelligence?view=dashboard"
                    className="inline-flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-white/75 transition hover:text-white"
                  >
                    <span className="inline-flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4" />
                      Operator dashboard
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>

              {employer.trustIndicators.length > 0 ? (
                <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Trust registry</p>
                  <div className="mt-4 space-y-2">
                    {employer.trustIndicators.map((indicator) => (
                      <p key={indicator} className="text-sm text-white/65">{indicator}</p>
                    ))}
                  </div>
                  <Link href={`/employers/${employer.slug}#proof`} className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-emerald-300 transition hover:text-emerald-200">
                    <ShieldCheck className="h-4 w-4" />
                    View proof
                  </Link>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-4">
          <StatCard
            label="Open roles"
            value={String(opportunityPayload.total > 0 ? opportunityPayload.total : employer.openRoles)}
            detail="Current public roles tied to this employer."
          />
          <StatCard
            label="Trust score"
            value={String(employer.trustScore)}
            detail="Current public employer trust signal."
          />
          <StatCard
            label="Time to start"
            value={employer.timeToStart}
            detail={`Onboarding: ${employer.timeToOnboard}`}
          />
          <StatCard
            label="Recent hires"
            value={String(employer.recentHires)}
            detail={employer.payTransparency && employer.payRange ? employer.payRange : 'Pay range shared on request.'}
          />
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <section className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Clear-to-start threshold</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">What this employer requires</h2>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/65">
                  <Clock className="h-3.5 w-3.5" />
                  {employer.timeToOnboard}
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-white/65">{employer.clearToStartThreshold}</p>
              <div className="mt-6">
                <RequirementsTable requirements={employer.requirements} />
              </div>
            </div>

            <div id="roles" className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Current opportunity feed</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">Current roles from this employer</h2>
                </div>
                <Link
                  href={scopedExploreHref}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-white/75 transition hover:text-white"
                >
                  Open this employer&apos;s roles
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              {opportunityPayload.opportunities.length === 0 ? (
                <div className="mt-5 rounded-3xl border border-amber-400/20 bg-amber-400/10 p-5">
                  <h3 className="text-lg font-semibold text-white">No current public roles are attached right now</h3>
                  <p className="mt-2 text-sm leading-6 text-white/65">
                    The employer profile is available, but no active public opportunities are currently attached to this organization slug.
                    Next step: confirm opportunity seeding or browse the broader explore feed.
                  </p>
                </div>
              ) : (
                <div className="mt-5 space-y-4">
                  {opportunityPayload.opportunities.map((opportunity) => (
                    <article
                      key={opportunity.id}
                      className="rounded-3xl border border-white/10 bg-black/20 p-5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0">
                          <h3 className="text-lg font-semibold text-white">{opportunity.title}</h3>
                          <p className="mt-2 text-sm text-white/60">
                            {opportunity.remote ? `Remote (${opportunity.state})` : opportunity.state}
                            {' · '}
                            {opportunity.specialty}
                            {' · '}
                            {opportunity.hiringType}
                          </p>
                        </div>
                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">
                          {opportunity.requirementLevel}
                        </span>
                      </div>

                      {opportunity.description ? (
                        <p className="mt-4 text-sm leading-6 text-white/65">{opportunity.description}</p>
                      ) : null}

                      <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-white/60">
                        {opportunity.payRange ? (
                          <span>{opportunity.payRange}</span>
                        ) : (
                          <span>Compensation shared during review</span>
                        )}
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          {opportunity.state}
                        </span>
                      </div>

                      <div className="mt-5 flex flex-wrap gap-3">
                        <Link
                          href={`${scopedExploreHref}&apply=${encodeURIComponent(opportunity.id)}`}
                          className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-emerald-400"
                        >
                          Apply from explore
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                        <Link
                          href={`/onboarding?returnTo=${encodeURIComponent(`${scopedExploreHref}&apply=${encodeURIComponent(opportunity.id)}`)}`}
                          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-white/75 transition hover:text-white"
                        >
                          Check clinician readiness
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>

          <aside className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Coverage</p>
              <h2 className="mt-2 text-xl font-semibold text-white">Hiring footprint</h2>
              <div className="mt-5 flex flex-wrap gap-2">
                {employer.states.map((state) => (
                  <span
                    key={state}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-white/70"
                  >
                    {state}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Hiring model</p>
              <h2 className="mt-2 text-xl font-semibold text-white">Operational details</h2>
              <div className="mt-5 space-y-3 text-sm text-white/65">
                <p>Hiring types: {employer.hiringTypes.join(', ') || 'Not disclosed'}</p>
                <p>Time to start: {employer.timeToStart}</p>
                <p>Time to onboard: {employer.timeToOnboard}</p>
                <p>Verified since: {employer.verifiedSince ? employer.verifiedSince.slice(0, 10) : 'Seeded launch profile'}</p>
                <p>
                  Website:{' '}
                  {employer.website ? (
                    <a
                      href={employer.website}
                      target="_blank"
                      rel="noreferrer"
                      className="text-emerald-300 transition hover:text-emerald-200"
                    >
                      {employer.website}
                    </a>
                  ) : (
                    'Not published'
                  )}
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

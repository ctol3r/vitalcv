'use client';

import Link from 'next/link';
import { ArrowRight, BriefcaseBusiness, ClipboardList } from 'lucide-react';
import { useClinicianMobile } from '@/components/mobile/ClinicianMobileProvider';
import { applicationStatusLabel, applicationStatusTone } from '@/lib/mobile/dashboard';
import { buildMobileFreshnessState } from '@/lib/mobile/freshness';
import { buildApplicationProofMoments, buildClinicianProofSummary } from '@/lib/proof/proof-model';

function toneClasses(tone: ReturnType<typeof applicationStatusTone>): string {
  switch (tone) {
    case 'emerald':
      return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100';
    case 'sky':
      return 'border-sky-400/20 bg-sky-400/10 text-sky-100';
    case 'rose':
      return 'border-rose-400/20 bg-rose-400/10 text-rose-100';
    case 'zinc':
      return 'border-white/10 bg-white/5 text-white/70';
    case 'amber':
    default:
      return 'border-amber-400/20 bg-amber-400/10 text-amber-100';
  }
}

function formatTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Updated recently';
  }

  return parsed.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function nextActionForApplication(applicationId: string, blockerHref: string | null): {
  href: string;
  label: string;
} {
  if (blockerHref) {
    return {
      href: blockerHref,
      label: 'Resolve blocker',
    };
  }

  return {
    href: `/holder/applications/${encodeURIComponent(applicationId)}`,
    label: 'Open application',
  };
}

export default function ClinicianApplicationsSurface() {
  const { data } = useClinicianMobile();

  const activeApplications = data.activeApplications;
  const followUpCount = data.blockers.filter((blocker) => blocker.relatedApplicationId).length;
  const acceptedCount = activeApplications.filter((application) => application.status === 'ACCEPTED').length;
  const freshestOpportunity = data.availableOpportunities[0] ?? data.opportunities.find((opportunity) => !opportunity.application) ?? null;
  const freshness = buildMobileFreshnessState(data.refreshedAt);
  const proof = buildClinicianProofSummary(data);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 pb-28 pt-6 sm:px-6 sm:pb-12 lg:px-8">
      <header>
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/80">
          <BriefcaseBusiness className="h-3.5 w-3.5" />
          Live status
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white">Applications</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">
          Track what is in motion, what needs action, and what happens next.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Active</p>
          <p className="mt-2 text-3xl font-semibold text-white">{activeApplications.length}</p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Accepted</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-100">{acceptedCount}</p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Needs follow-up</p>
          <p className="mt-2 text-3xl font-semibold text-amber-100">{followUpCount}</p>
        </div>
      </section>

      <section className={`rounded-[32px] border p-5 shadow-[0_20px_60px_rgba(0,0,0,0.28)] ${
        freshness.isStale
          ? 'border-amber-400/20 bg-amber-400/10'
          : freshness.isAging
            ? 'border-sky-400/20 bg-sky-400/10'
            : 'border-emerald-400/20 bg-emerald-400/10'
      }`}>
        <p className={`text-[11px] uppercase tracking-[0.18em] ${
          freshness.isStale
            ? 'text-amber-100/80'
            : freshness.isAging
              ? 'text-sky-100/80'
              : 'text-emerald-100/80'
        }`}>
          Utility continuity
        </p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <h2 className="text-2xl font-semibold text-white">
              {activeApplications[0]
                ? 'Application state stays attached to your readiness'
                : 'No application is in motion yet'}
            </h2>
            <p className="mt-2 text-sm leading-6 text-white/85">
              {activeApplications[0]
                ? freshness.detail
                : freshestOpportunity
                  ? `Next recorded step: ${freshestOpportunity.title}`
                  : data.recommendedAction?.description ?? freshness.detail}
            </p>
            {freshestOpportunity && !activeApplications[0] ? (
              <p className="mt-3 text-xs uppercase tracking-[0.16em] text-white/65">Apply now</p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-3">
            {freshestOpportunity && !activeApplications[0] ? (
              <>
                <Link
                  href={`/holder/opportunities?apply=${encodeURIComponent(freshestOpportunity.id)}`}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-semibold text-zinc-950 transition hover:bg-white/90"
                >
                  Apply to best match
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href={`/opportunities/${encodeURIComponent(freshestOpportunity.id)}`}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-white/[0.08]"
                >
                  Apply now
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-[32px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">What completed because of VitalCV</p>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/60">
              Application progress is recorded against your verified profile, readiness, and follow-up state.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-right">
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">Moving now</p>
            <p className="mt-2 text-2xl font-semibold text-white">{proof.applicationsMoving}</p>
            <p className="mt-1 text-sm text-white/55">
              {proof.applicationsSubmitted} total submitted
            </p>
          </div>
        </div>

        {proof.completedWithVitalCv.length > 0 ? (
          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {proof.completedWithVitalCv.map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <p className="text-sm text-white/80">{item}</p>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {activeApplications.length > 0 ? (
        <section className="space-y-4">
          {activeApplications.map((application) => {
            const relatedBlocker = data.blockers.find((blocker) => blocker.relatedApplicationId === application.id) ?? null;
            const nextAction = nextActionForApplication(application.id, relatedBlocker?.href ?? null);
            const proofMoments = buildApplicationProofMoments(application);

            return (
              <article
                key={application.id}
                className="rounded-[32px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.28)]"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-lg font-semibold text-white">{application.opportunity.title}</p>
                    <p className="mt-1 text-sm text-white/65">
                      {application.employer.name ?? application.opportunity.organizationName ?? 'Employer context'} · {application.opportunity.state}
                    </p>
                  </div>
                  <span className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-semibold ${toneClasses(applicationStatusTone(application.status))}`}>
                    {applicationStatusLabel(application.status)}
                  </span>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-4">
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">Submitted</p>
                    <p className="mt-2 text-sm text-white">{formatTimestamp(application.createdAt)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">Updated</p>
                    <p className="mt-2 text-sm text-white">{formatTimestamp(application.updatedAt)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">Readiness</p>
                    <p className="mt-2 text-sm text-white">
                      {application.readiness ? `${application.readiness.readinessLevel} · ${application.readiness.readinessScore}/100` : 'Pending'}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">Next step</p>
                    <p className="mt-2 text-sm text-white">
                      {relatedBlocker?.detail ?? application.latestRecommendation?.label ?? 'Monitor employer review'}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
                  <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Readiness attached</p>
                    <p className="mt-3 text-sm font-semibold text-white">
                      {application.readiness?.readinessStatus ?? 'Pending refresh.'}
                    </p>
                    {application.readiness?.trustSignals.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {application.readiness.trustSignals.slice(0, 3).map((signal) => (
                          <span
                            key={signal}
                            className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-xs text-white/75"
                          >
                            {signal}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-100/80">Next step</p>
                    <p className="mt-3 text-sm font-semibold text-white">
                      {relatedBlocker?.title ?? application.latestRecommendation?.label ?? 'Open application detail'}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-emerald-50/80">
                      {relatedBlocker?.detail ?? application.latestRecommendation?.explanation ?? 'View application details for more info.'}
                    </p>
                  </div>
                </div>

                {proofMoments.length > 0 ? (
                  <div className="mt-4 rounded-3xl border border-white/10 bg-black/20 p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">State change summary</p>
                    <div className="mt-3 space-y-2">
                      {proofMoments.map((moment) => (
                        <p key={moment} className="text-sm leading-6 text-white/75">
                          {moment}
                        </p>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href={`/holder/applications/${encodeURIComponent(application.id)}`}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-semibold text-zinc-950 transition hover:bg-white/90"
                  >
                    View application
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href={nextAction.href}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-white/[0.08]"
                  >
                    {nextAction.label}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-emerald-500/10 text-emerald-100">
            <ClipboardList className="h-7 w-7" />
          </div>
          <h2 className="mt-5 text-2xl font-semibold text-white">No live applications yet</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">
            {freshestOpportunity
              ? `Next recorded step: ${freshestOpportunity.title}`
              : 'Your submitted applications and every status change will appear here.'}
          </p>
          <Link
            href="/holder/opportunities"
            className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-semibold text-zinc-950 transition hover:bg-white/90"
          >
            View opportunities
            <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      )}
    </main>
  );
}

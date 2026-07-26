'use client';

import Link from 'next/link';
import { ArrowRight, BriefcaseBusiness, ClipboardList } from 'lucide-react';
import { useClinicianMobile } from '@/components/mobile/ClinicianMobileProvider';
import { applicationStatusLabel, applicationStatusTone } from '@/lib/mobile/dashboard';
import { buildApplicationProofMoments, buildClinicianProofSummary } from '@/lib/proof/proof-model';

function toneClasses(tone: ReturnType<typeof applicationStatusTone>): string {
  switch (tone) {
    case 'emerald':
      return 'mz-chip mz-chip-ok';
    case 'sky':
      return 'mz-chip mz-chip-unknown';
    case 'rose':
      return 'mz-chip mz-chip-p0';
    case 'zinc':
      return 'mz-chip mz-chip-unknown';
    case 'amber':
    default:
      return 'mz-chip mz-chip-watch';
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
  const proof = buildClinicianProofSummary(data);

  return (
    <main className="mz mz-paper mz-ambient min-h-screen w-full">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 pb-28 pt-6 sm:px-6 sm:pb-12 lg:px-8">
        <header>
          <div className="mz-eyebrow">
            <BriefcaseBusiness className="h-3.5 w-3.5" />
            Live status
          </div>
          <h1 className="mz-h1 mt-4">Applications</h1>
          <p className="mt-2 max-w-2xl mz-body">
            Track what is in motion, what needs action, and what happens next.
          </p>
        </header>

        <section className="grid gap-3 sm:grid-cols-3">
          <div className="mz-glass p-4">
            <p className="mz-mono text-[11px] uppercase tracking-[0.18em] opacity-60">Active</p>
            <p className="mt-2 text-3xl font-semibold mz-mono">{activeApplications.length}</p>
          </div>
          <div className="mz-glass p-4">
            <p className="mz-mono text-[11px] uppercase tracking-[0.18em] opacity-60">Accepted</p>
            <p className="mt-2 text-3xl font-semibold mz-mono text-[var(--ok)]">{acceptedCount}</p>
          </div>
          <div className="mz-glass p-4">
            <p className="mz-mono text-[11px] uppercase tracking-[0.18em] opacity-60">Needs follow-up</p>
            <p className="mt-2 text-3xl font-semibold mz-mono text-[var(--watch)]">{followUpCount}</p>
          </div>
        </section>

        <section className="mz-glass p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="mz-eyebrow">What completed because of VitalCV</p>
              <p className="mt-2 max-w-3xl mz-body">
                Application progress is recorded against your source-backed profile, readiness, and follow-up state.
              </p>
            </div>
            <div className="mz-glass-inset rounded-[8px] px-4 py-3 text-right">
              <p className="mz-mono text-[10px] uppercase tracking-[0.16em] opacity-60">Moving now</p>
              <p className="mt-2 text-2xl font-semibold mz-mono">{proof.applicationsMoving}</p>
              <p className="mt-1 mz-small">
                {proof.applicationsSubmitted} total submitted
              </p>
            </div>
          </div>

          {proof.completedWithVitalCv.length > 0 ? (
            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              {proof.completedWithVitalCv.map((item) => (
                <div key={item} className="mz-inset px-4 py-3">
                  <p className="mz-body">{item}</p>
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
                  className="mz-glass p-5"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="mz-h2">{application.opportunity.title}</p>
                      <p className="mt-1 mz-small">
                        {application.employer.name ?? application.opportunity.organizationName ?? 'Employer context'} · {application.opportunity.state}
                      </p>
                    </div>
                    <span className={`w-fit ${toneClasses(applicationStatusTone(application.status))}`}>
                      <span className="mz-gl" />
                      {applicationStatusLabel(application.status)}
                    </span>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-4">
                    <div className="mz-inset px-4 py-3">
                      <p className="mz-mono text-[10px] uppercase tracking-[0.16em] opacity-60">Submitted</p>
                      <p className="mt-2 text-sm text-[var(--ink-800)]">{formatTimestamp(application.createdAt)}</p>
                    </div>
                    <div className="mz-inset px-4 py-3">
                      <p className="mz-mono text-[10px] uppercase tracking-[0.16em] opacity-60">Updated</p>
                      <p className="mt-2 text-sm text-[var(--ink-800)]">{formatTimestamp(application.updatedAt)}</p>
                    </div>
                    <div className="mz-inset px-4 py-3">
                      <p className="mz-mono text-[10px] uppercase tracking-[0.16em] opacity-60">Readiness</p>
                      <p className="mt-2 text-sm text-[var(--ink-800)]">
                        {application.readiness ? `${application.readiness.readinessLevel} · ${application.readiness.readinessScore}/100` : 'Pending'}
                      </p>
                    </div>
                    <div className="mz-inset px-4 py-3">
                      <p className="mz-mono text-[10px] uppercase tracking-[0.16em] opacity-60">Next step</p>
                      <p className="mt-2 text-sm text-[var(--ink-800)]">
                        {relatedBlocker?.detail ?? application.latestRecommendation?.label ?? 'Monitor employer review'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
                    <div className="mz-inset p-4">
                      <p className="mz-mono text-[11px] uppercase tracking-[0.18em] opacity-60">Readiness attached</p>
                      <p className="mt-3 text-sm font-semibold text-[var(--ink-900)]">
                        {application.readiness?.readinessStatus ?? 'Pending refresh.'}
                      </p>
                      {application.readiness?.trustSignals.length ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {application.readiness.trustSignals.slice(0, 3).map((signal) => (
                            <span
                              key={signal}
                              className="rounded-[2px] border border-[var(--rule)] bg-[var(--card)] px-2.5 py-1 text-[11px] text-[var(--ink-700)]"
                            >
                              {signal}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div className="mz-inset p-4">
                      <p className="mz-mono text-[11px] uppercase tracking-[0.18em] text-[var(--accent)]">Next step</p>
                      <p className="mt-3 text-sm font-semibold text-[var(--ink-900)]">
                        {relatedBlocker?.title ?? application.latestRecommendation?.label ?? 'Open application detail'}
                      </p>
                      <p className="mt-2 mz-body">
                        {relatedBlocker?.detail ?? application.latestRecommendation?.explanation ?? 'View application details for more info.'}
                      </p>
                    </div>
                  </div>

                  {proofMoments.length > 0 ? (
                    <div className="mt-4 mz-inset p-4">
                      <p className="mz-mono text-[11px] uppercase tracking-[0.18em] opacity-60">State change summary</p>
                      <div className="mt-3 space-y-2">
                        {proofMoments.map((moment) => (
                          <p key={moment} className="mz-body">
                            {moment}
                          </p>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                    <Link
                      href={`/holder/applications/${encodeURIComponent(application.id)}`}
                      className="mz-btn min-h-11 justify-center"
                    >
                      View application
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                    <Link
                      href={nextAction.href}
                      className="mz-btn mz-btn-ghost min-h-11 justify-center"
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
          <section className="mz-glass p-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-[14px] border border-[var(--rule-soft)] bg-[var(--paper-2)] text-[var(--accent)]">
              <ClipboardList className="h-7 w-7" />
            </div>
            <h2 className="mt-5 mz-h1">No live applications yet</h2>
            <p className="mt-3 max-w-2xl mz-body">
              Your submitted applications and every status change will appear here.
            </p>
            <Link
              href="/holder/opportunities"
              className="mt-5 mz-btn min-h-11 justify-center"
            >
              View opportunities
              <ArrowRight className="h-4 w-4" />
            </Link>
          </section>
        )}
      </div>
    </main>
  );
}

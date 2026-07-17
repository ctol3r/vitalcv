'use client';

import * as React from 'react';
import Link from 'next/link';
import { notFound, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { ApplicationEvidenceView } from '@/components/applications/ApplicationEvidenceView';
import { useClinicianMobile } from '@/components/mobile/ClinicianMobileProvider';
import { applicationStatusLabel, applicationStatusTone, type MobileApplication } from '@/lib/mobile/dashboard';
import { trackClinicianEventOncePerSession } from '@/lib/mobile/analytics';
import { buildApplicationProofMoments } from '@/lib/proof/proof-model';
import type { ApplicationEvidenceLoadResult } from '@/lib/applications/evidenceView';

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

function formatTimestamp(value: string | null): string {
  if (!value) {
    return 'Awaiting update';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Awaiting update';
  }

  return parsed.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function buildProgressSteps(application: MobileApplication): Array<{
  label: string;
  time: string | null;
  state: 'complete' | 'current' | 'upcoming';
}> {
  if (application.status === 'REVIEWED') {
    return [
      { label: 'Submitted', time: application.createdAt, state: 'complete' },
      { label: 'In review', time: application.reviewedAt ?? application.updatedAt, state: 'current' },
      { label: 'Decision', time: null, state: 'upcoming' },
    ];
  }

  if (application.status === 'ACCEPTED' || application.status === 'DECLINED') {
    return [
      { label: 'Submitted', time: application.createdAt, state: 'complete' },
      { label: 'In review', time: application.reviewedAt ?? application.updatedAt, state: 'complete' },
      { label: application.status === 'ACCEPTED' ? 'Accepted' : 'Declined', time: application.updatedAt, state: 'current' },
    ];
  }

  return [
    { label: 'Submitted', time: application.createdAt, state: 'current' },
    { label: 'In review', time: null, state: 'upcoming' },
    { label: 'Decision', time: null, state: 'upcoming' },
  ];
}

function applicationSummary(input: {
  application: MobileApplication;
  hasBlocker: boolean;
}): { title: string; detail: string } {
  if (input.hasBlocker) {
    return {
      title: 'One clear item is holding this application up',
      detail: 'Resolve the blocker and we will reflect the change here as soon as the requirement clears.',
    };
  }

  switch (input.application.status) {
    case 'REVIEWED':
      return {
        title: 'The employer is actively reviewing your verified profile',
        detail: input.application.latestRecommendation?.explanation ?? 'No extra action is required right now. We will keep this page updated as review moves forward.',
      };
    case 'ACCEPTED':
      return {
        title: 'This application has been accepted',
        detail: 'Keep this page for the final record and any next-step details from the employer.',
      };
    case 'DECLINED':
      return {
        title: 'This application has reached a final decision',
        detail: 'You can review the role details or keep momentum by returning to your matched opportunities.',
      };
    case 'PENDING':
    default:
      return {
        title: 'Your application was submitted and is waiting for review',
        detail: 'We will show the first employer update here as soon as it lands.',
      };
  }
}

export default function ClinicianApplicationDetailSurface({
  applicationId,
  evidenceResult,
}: {
  applicationId: string;
  evidenceResult: ApplicationEvidenceLoadResult;
}) {
  const {
    data,
    visibleNotifications,
    markNotificationRead,
  } = useClinicianMobile();
  const searchParams = useSearchParams();

  const application = data.activeApplications.find((entry) => entry.id === applicationId) ?? null;
  const relatedBlocker = data.blockers.find((blocker) => (
    blocker.relatedApplicationId === applicationId
    || (application?.readiness?.gapSummary ?? []).includes(blocker.label)
  )) ?? null;
  const relatedNotifications = visibleNotifications.filter((notification) => (
    notification.relatedApplicationId === applicationId
    || (relatedBlocker ? notification.relatedBlockerId === relatedBlocker.id : false)
  ));
  const npi = data.workspace?.personProfile?.npi ?? 'unknown';
  const progressSteps = application ? buildProgressSteps(application) : [];
  const proofMoments = application ? buildApplicationProofMoments(application, data.proof) : [];
  const summary = application
    ? applicationSummary({
        application,
        hasBlocker: Boolean(relatedBlocker),
      })
    : null;
  const submittedNow = searchParams.get('submitted') === '1';

  useEffect(() => {
    relatedNotifications.forEach((notification) => {
      markNotificationRead(notification.id);
    });
  }, [markNotificationRead, relatedNotifications]);

  useEffect(() => {
    if (!application) {
      return;
    }

    void trackClinicianEventOncePerSession(`application-detail:${npi}:${application.id}`, 'clinician.application_detail_viewed', {
      npi,
      applicationId: application.id,
      opportunityId: application.opportunityId,
      blockerId: relatedBlocker?.id ?? null,
      status: application.status,
    });
  }, [application, npi, relatedBlocker?.id]);

  if (!application) {
    notFound();
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 pb-28 pt-6 sm:px-6 sm:pb-12 lg:px-8">
      <Link
        href="/holder/applications"
        className="inline-flex items-center gap-2 text-sm text-white/65 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Applications
      </Link>

      {submittedNow ? (
        <section className="rounded-[32px] border border-emerald-400/20 bg-emerald-400/10 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.24)]">
          <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-100/80">Application submitted</p>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <h2 className="text-2xl font-semibold text-white">
                {application.opportunity.title} is now in your application queue
              </h2>
              <p className="mt-2 text-sm leading-6 text-emerald-50/85">
                Submitted {formatTimestamp(application.createdAt)} to {application.employer.name ?? application.opportunity.organizationName ?? 'the employer'}.
                Current status: {applicationStatusLabel(application.status)}.
              </p>
            </div>
            <Link
              href={relatedBlocker?.href ?? '/holder/applications'}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white px-5 text-sm font-semibold text-zinc-950 transition hover:bg-white/90"
            >
              {relatedBlocker ? relatedBlocker.nextActionLabel : 'View application queue'}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      ) : null}

      <header className="rounded-[32px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
              {application.employer.name ?? application.opportunity.organizationName ?? 'Employer context'}
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">{application.opportunity.title}</h1>
            <p className="mt-2 text-sm leading-6 text-white/65">
              {application.opportunity.state} · {application.opportunity.specialty}
            </p>
            <p className="mt-2 text-sm leading-6 text-white/55">
              Submitted {formatTimestamp(application.createdAt)} · Last update {formatTimestamp(application.updatedAt)}
            </p>
          </div>
          <span className={`inline-flex w-fit rounded-full border px-3 py-1 text-sm font-semibold ${toneClasses(applicationStatusTone(application.status))}`}>
            {applicationStatusLabel(application.status)}
          </span>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">Employer</p>
            <p className="mt-2 text-sm text-white">{application.employer.name ?? application.opportunity.organizationName ?? 'Unavailable'}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">Submitted</p>
            <p className="mt-2 text-sm text-white">{formatTimestamp(application.createdAt)}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">Current status</p>
            <p className="mt-2 text-sm text-white">{applicationStatusLabel(application.status)}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">Next step</p>
            <p className="mt-2 text-sm text-white">
              {relatedBlocker?.detail ?? application.latestRecommendation?.label ?? 'Reviewing'}
            </p>
          </div>
        </div>
      </header>

      <ApplicationEvidenceView result={evidenceResult} />

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
        <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-5">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Application activity</p>

          <div className="mt-4 rounded-3xl border border-white/10 bg-black/20 p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Timeline</p>
            {application.timeline.length > 0 ? (
              <div className="mt-4 space-y-4">
                {application.timeline.map((event) => (
                  <div key={`${event.stage}-${event.occurredAt ?? 'pending'}`} className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-white">{event.description}</p>
                      <span className="text-xs text-white/40">{formatTimestamp(event.occurredAt)}</span>
                    </div>
                    <p className="mt-2 text-xs uppercase tracking-[0.16em] text-white/40">{event.stage}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-white/60">
                Your timeline will update here automatically. We are actively monitoring for changes.
              </p>
            )}
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
        </div>

        <div className="space-y-5">
          <section className="rounded-[32px] border border-emerald-400/20 bg-emerald-400/10 p-5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-100/80">What happens now</p>
            <p className="mt-3 text-lg font-semibold text-white">
              {summary?.title ?? 'Your application is active and under review'}
            </p>
            <p className="mt-2 text-sm leading-6 text-emerald-50/80">
              {summary?.detail ?? 'No immediate action required.'}
            </p>
            <div className="mt-4 flex flex-col gap-3">
              {relatedBlocker ? (
                <Link
                  href={relatedBlocker.href}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-semibold text-zinc-950 transition hover:bg-white/90"
                >
                  {relatedBlocker.nextActionLabel}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : null}
              <Link
                href={`/holder/opportunities/${encodeURIComponent(application.opportunity.id)}`}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-4 text-sm font-semibold text-white transition hover:border-white/20"
              >
                View role details
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </section>

          <section className="rounded-[32px] border border-white/10 bg-white/[0.04] p-5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Status progression</p>
            <div className="mt-4 space-y-3">
              {progressSteps.map((step) => (
                <div
                  key={step.label}
                  className={`rounded-2xl border px-4 py-3 ${
                    step.state === 'complete'
                      ? 'border-emerald-400/20 bg-emerald-400/10'
                      : step.state === 'current'
                        ? 'border-sky-400/20 bg-sky-400/10'
                        : 'border-white/10 bg-black/20'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white">{step.label}</p>
                    <span className="text-xs text-white/50">{step.time ? formatTimestamp(step.time) : 'Pending'}</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm leading-6 text-white/60">
              This page updates as soon as a new employer status or blocker is recorded.
            </p>
          </section>

          <section className="rounded-[32px] border border-white/10 bg-white/[0.04] p-5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Related alerts</p>
            {relatedNotifications.length > 0 ? (
              <div className="mt-4 space-y-3">
                {relatedNotifications.map((notification) => (
                  <Link
                    key={notification.id}
                    href={notification.href}
                    className="block rounded-2xl border border-white/10 bg-black/20 px-4 py-3 transition hover:border-white/20"
                  >
                    <p className="text-sm font-semibold text-white">{notification.title}</p>
                    <p className="mt-2 text-sm leading-6 text-white/65">{notification.body}</p>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-white/60">
                No alerts.
              </p>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}

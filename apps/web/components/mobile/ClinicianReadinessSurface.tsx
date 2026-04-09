'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  RefreshCw,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { ClinicianStatusBanner } from '@/components/mobile/ClinicianStatusBanner';
import { ClinicianSupportCard } from '@/components/mobile/ClinicianSupportCard';
import { PilotFailureSignal } from '@/components/pilot-ops/PilotFailureSignal';
import { SupportActionButton } from '@/components/pilot-ops/SupportActionButton';
import { useClinicianMobile } from '@/components/mobile/ClinicianMobileProvider';
import { trackClinicianEventOncePerSession } from '@/lib/mobile/analytics';
import { buildMobileFreshnessState } from '@/lib/mobile/freshness';
import { trackPilotEvent } from '@/lib/pilot-ops/client';
import { trackPilotFunnelEvent } from '@/lib/pilot-ops/funnel';
import { buildClinicianProofSummary } from '@/lib/proof/proof-model';

function deltaCopy(deltaScore: number | null): string {
  if (deltaScore === null) {
    return 'Establishing baseline';
  }

  if (deltaScore > 0) {
    return `+${deltaScore}`;
  }

  if (deltaScore < 0) {
    return `${deltaScore}`;
  }

  return '0';
}

function formatWhen(value: string | null): string {
  if (!value) {
    return 'Pending';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Pending';
  }

  return parsed.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function countCompletedProfileChecks(
  dimensions: {
    npiVerified: boolean;
    resumeUploaded: boolean;
    linksAdded: boolean;
    workAuthProvided: boolean;
    credentialsImported: boolean;
  } | null | undefined,
): number {
  if (!dimensions) {
    return 0;
  }

  return Object.values(dimensions).filter(Boolean).length;
}

export default function ClinicianReadinessSurface() {
  const {
    data,
    refreshTrustState,
    isRefreshing,
    refreshError,
  } = useClinicianMobile();
  const searchParams = useSearchParams();

  const current = data.trustHistory[0] ?? null;
  const previous = data.trustHistory[1] ?? null;
  const proof = buildClinicianProofSummary(data);
  const npi = data.workspace?.personProfile?.npi ?? 'unknown';
  const completedProfileChecks = countCompletedProfileChecks(data.profileCompleteness?.dimensions);
  const fromOnboarding = searchParams.get('from') === 'onboarding';
  const freshness = buildMobileFreshnessState(data.refreshedAt);
  const primaryAction = data.blockers[0]
    ? {
        eyebrow: data.blockers.length === 1 && (current?.readinessScore ?? 0) >= 80 ? 'You are close' : 'What\'s left',
        title: data.blockers.length === 1 && (current?.readinessScore ?? 0) >= 80
          ? 'One item left before you feel ready'
          : `${data.blockers.length} item${data.blockers.length === 1 ? '' : 's'} still holding this up`,
        detail: 'Resolve the next blocker and we will reflect the change in readiness and any affected applications.',
        href: data.blockers[0].href,
        label: data.blockers[0].nextActionLabel,
      }
    : current
      ? {
          eyebrow: 'Ready to move',
          title: 'Your readiness is clear enough to keep going',
          detail: 'You can use this verified state in matched opportunities, and every future change will land here.',
          href: data.recommendedAction?.kind === 'apply_now'
            ? data.recommendedAction.href
            : '/holder/opportunities',
          label: data.recommendedAction?.kind === 'apply_now'
            ? data.recommendedAction.ctaLabel
            : 'View opportunities',
        }
      : {
          eyebrow: 'Keep building',
          title: 'Finish setup to unlock your readiness baseline',
          detail: 'Complete onboarding and we will start turning your profile into a readiness state you can use.',
          href: '/onboarding',
          label: 'Continue onboarding',
        };

  React.useEffect(() => {
    void trackClinicianEventOncePerSession(`readiness:${npi}`, 'clinician.readiness_viewed', {
      npi,
      readinessLevel: current?.readinessLevel ?? null,
      blockerCount: data.blockers.length,
    });
    void trackPilotFunnelEvent({
      eventType: 'readiness_viewed',
      npi,
      entity: {
        kind: 'passport',
        id: npi,
        label: npi,
        objectType: 'passport',
      },
      dedupeKey: `readiness-viewed:clinician:${npi}`,
      details: {
        readinessLevel: current?.readinessLevel ?? null,
        blockerCount: data.blockers.length,
        surface: 'clinician_readiness',
      },
    });

    if (data.blockers[0]) {
      void trackPilotEvent({
        eventType: 'blocker_opened',
        severity: 'high',
        entity: {
          kind: 'passport',
          id: npi,
          label: npi,
          objectType: 'passport',
        },
        details: {
          blockerId: data.blockers[0].id,
          blockerTitle: data.blockers[0].title,
          blockerCount: data.blockers.length,
        },
        dedupeKey: `blocker-opened:${npi}:${data.blockers[0].id}`,
      });
    }

    if (current?.resolvedGaps?.[0]) {
      void trackPilotEvent({
        eventType: 'blocker_resolved',
        entity: {
          kind: 'passport',
          id: npi,
          label: npi,
          objectType: 'passport',
        },
        details: {
          resolvedBlockers: current.resolvedGaps,
          resolvedCount: current.resolvedGaps.length,
        },
        dedupeKey: `blocker-resolved:${npi}:${current.id}`,
      });
    }
  }, [current?.id, current?.readinessLevel, current?.resolvedGaps, data.blockers, npi]);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 pb-28 pt-6 sm:px-6 sm:pb-12 lg:px-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-100">
            <ShieldCheck className="h-3.5 w-3.5" />
            Active
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white">Readiness</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">
            See how close you are to ready and what moves you forward.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void refreshTrustState()}
          disabled={isRefreshing}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh readiness
        </button>
      </header>

      {refreshError ? (
        <div className="space-y-3">
          <PilotFailureSignal
            title="Readiness refresh failed"
            message={refreshError}
            queueItem={{ source: 'route_failure' }}
            dedupeKey={`readiness-refresh:${npi}:${refreshError}`}
          />
          <ClinicianStatusBanner
            tone="error"
            title="Readiness could not refresh"
            detail={refreshError}
            actionHref="/holder/home"
            actionLabel="Return home"
          />
          <SupportActionButton
            label="Contact support"
            title="Readiness refresh failed"
            messagePrefill={refreshError}
            className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-white/[0.08]"
          />
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2">
        <div className={`rounded-[24px] border p-4 ${
          freshness.isStale
            ? 'border-amber-400/20 bg-amber-400/10'
            : freshness.isAging
              ? 'border-sky-400/20 bg-sky-400/10'
              : 'border-emerald-400/20 bg-emerald-400/10'
        }`}>
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">Freshness</p>
          <p className="mt-3 text-lg font-semibold text-white">{freshness.label}</p>
          <p className="mt-2 text-sm leading-6 text-white/75">{freshness.detail}</p>
        </div>
        <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">Profile and passport progress</p>
          <p className="mt-3 text-lg font-semibold text-white">{completedProfileChecks}/5 checks completed</p>
          <p className="mt-2 text-sm leading-6 text-white/75">
            Your profile completion and readiness history move together so the next required step stays visible on repeat visits.
          </p>
        </div>
      </section>

      {fromOnboarding ? (
        <section className="rounded-[28px] border border-emerald-400/20 bg-emerald-400/10 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.24)]">
          <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-100/80">Onboarding complete</p>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <h2 className="text-2xl font-semibold text-white">
                {current ? `You landed in readiness at ${current.readinessLevel} · ${current.readinessScore}/100` : 'Your readiness workspace is ready'}
              </h2>
              <p className="mt-2 text-sm leading-6 text-emerald-50/85">
                {data.blockers[0]
                  ? `Shortest path to ready: ${data.blockers[0].detail}`
                  : 'You can go straight into live opportunities from here.'}
              </p>
            </div>
            <Link
              href={data.blockers[0]?.href ?? data.recommendedAction?.href ?? '/holder/opportunities'}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white px-5 text-sm font-semibold text-zinc-950 transition hover:bg-white/90"
            >
              {data.blockers[0] ? data.blockers[0].nextActionLabel : data.recommendedAction?.ctaLabel ?? 'View opportunities'}
              <ShieldCheck className="h-4 w-4" />
            </Link>
          </div>
        </section>
      ) : null}

      {!fromOnboarding ? (
        <section className={`rounded-[28px] border p-5 shadow-[0_20px_60px_rgba(0,0,0,0.24)] ${
        data.blockers[0]
          ? 'border-amber-400/20 bg-amber-400/10'
          : 'border-emerald-400/20 bg-emerald-400/10'
      }`}>
        <p className={`text-[11px] uppercase tracking-[0.18em] ${
          data.blockers[0] ? 'text-amber-100/80' : 'text-emerald-100/80'
        }`}>
          {primaryAction.eyebrow}
        </p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <h2 className="text-2xl font-semibold text-white">{primaryAction.title}</h2>
            <p className={`mt-2 text-sm leading-6 ${
              data.blockers[0] ? 'text-amber-50/85' : 'text-emerald-50/85'
            }`}>
              {primaryAction.detail}
            </p>
            {current?.computedAt ? (
              <p className={`mt-3 text-xs ${
                data.blockers[0] ? 'text-amber-100/70' : 'text-emerald-100/70'
              }`}>
                Last readiness update {formatWhen(current.computedAt)}
              </p>
            ) : null}
          </div>
          <Link
            href={primaryAction.href}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white px-5 text-sm font-semibold text-zinc-950 transition hover:bg-white/90"
          >
            {primaryAction.label}
            <ShieldCheck className="h-4 w-4" />
          </Link>
        </div>
        </section>
      ) : null}

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Readiness</p>
          <div className="mt-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold text-white">
                {current?.readinessStatus ?? 'Building your readiness profile...'}
              </h2>
              <p className="mt-2 text-sm text-white/60">
                Updated {formatWhen(current?.computedAt ?? null)}
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-right">
              <p className="text-[10px] uppercase tracking-[0.16em] text-white/45">Level</p>
              <p className="mt-2 text-2xl font-semibold text-white">{current?.readinessLevel ?? 'L0'}</p>
              <p className="mt-1 text-sm text-emerald-100">{current ? `${current.readinessScore}/100` : 'Pending'}</p>
            </div>
          </div>

          <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-sky-400 to-cyan-300"
              style={{ width: `${Math.max(8, current?.readinessScore ?? 8)}%` }}
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/70">
              {completedProfileChecks}/5 profile checks complete
            </span>
            <p className="text-sm text-white/70">
              {data.blockers.length > 0
                ? `${data.blockers.length} item${data.blockers.length === 1 ? '' : 's'} left to clear.`
                : 'No blockers are holding you up right now.'}
            </p>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">Recent delta</p>
              <div className="mt-2 flex items-center gap-2 text-white">
                {(current?.deltaScore ?? 0) >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-emerald-200" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-rose-200" />
                )}
                <span className="text-lg font-semibold">{deltaCopy(current?.deltaScore ?? null)}</span>
                <span className="text-sm text-white/60">
                  {previous ? `vs ${previous.readinessScore}/100` : 'from previous state'}
                </span>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">Progress</p>
              <p className="mt-2 text-sm leading-6 text-white/70">
                {data.blockers[0]
                  ? `${data.blockers[0].detail} Every action you take here increases your trust level and application priority.`
                  : current?.reason ?? 'Your readiness is clear enough to keep moving into live opportunities.'}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">What&apos;s left</p>
          {data.blockers.length > 0 ? (
            <div className="mt-4 space-y-3">
              {data.blockers.slice(0, 5).map((blocker) => (
                <Link
                  key={blocker.id}
                  href={blocker.href}
                  className="block rounded-2xl border border-amber-400/15 bg-amber-400/10 px-4 py-3 text-sm text-amber-50 transition hover:border-amber-300/30"
                >
                  <p className="font-semibold text-white">{blocker.title}</p>
                  <p className="mt-1">{blocker.detail}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.16em] text-amber-100/70">
                    {blocker.nextActionLabel}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm leading-6 text-white/60">
              No blockers. You&apos;re ready to keep moving.
            </p>
          )}
          <Link
            href={data.blockers[0]?.href ?? '/holder/opportunities'}
            className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-white/[0.08]"
          >
            {data.blockers[0] ? data.blockers[0].nextActionLabel : 'View opportunities'}
          </Link>
        </div>
      </section>

      <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">What changed because of VitalCV</p>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/60">
              Each line below is tied to a recorded readiness or application state change.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-right">
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">Blockers resolved</p>
            <p className="mt-2 text-2xl font-semibold text-white">{proof.blockersResolvedCount}</p>
            <p className="mt-1 text-sm text-white/55">
              {proof.applicationsSubmitted} application{proof.applicationsSubmitted === 1 ? '' : 's'} submitted
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">Baseline</p>
            <p className="mt-2 text-lg font-semibold text-white">
              {proof.readinessBaselineLevel ?? 'L0'}{proof.readinessBaselineScore !== null ? ` · ${proof.readinessBaselineScore}/100` : ''}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">Current</p>
            <p className="mt-2 text-lg font-semibold text-white">
              {proof.readinessCurrentLevel ?? 'L0'}{proof.readinessCurrentScore !== null ? ` · ${proof.readinessCurrentScore}/100` : ''}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">Readiness delta</p>
            <p className="mt-2 text-lg font-semibold text-white">
              {proof.readinessDeltaScore === null
                ? 'Baseline'
                : proof.readinessDeltaScore >= 0
                  ? `+${proof.readinessDeltaScore}`
                  : `${proof.readinessDeltaScore}`}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">Applications moving</p>
            <p className="mt-2 text-lg font-semibold text-white">{proof.applicationsMoving}</p>
          </div>
        </div>

        {proof.completedWithVitalCv.length > 0 ? (
          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {proof.completedWithVitalCv.map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3">
                <p className="text-sm text-white/80">{item}</p>
              </div>
            ))}
          </div>
        ) : null}

        {proof.recentChanges.length > 0 ? (
          <div className="mt-5 space-y-3">
            {proof.recentChanges.slice(0, 3).map((change) => (
              <Link
                key={change.id}
                href={change.href}
                className="block rounded-2xl border border-white/10 bg-black/20 px-4 py-3 transition hover:border-white/20"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{change.title}</p>
                    <p className="mt-1 text-sm leading-6 text-white/65">{change.summary}</p>
                  </div>
                  <p className="text-xs text-white/40">{formatWhen(change.occurredAt)}</p>
                </div>
              </Link>
            ))}
          </div>
        ) : null}
      </section>

      <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">History</p>
            <p className="mt-2 text-sm leading-6 text-white/60">
              Each update shows what changed so progress never disappears into a score.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {data.trustHistory.length > 0 ? data.trustHistory.map((entry) => (
            <article key={entry.id} className="rounded-3xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">
                    {entry.readinessLevel} · {entry.readinessScore}/100
                  </p>
                  <p className="mt-2 text-sm leading-6 text-white/65">{entry.readinessStatus}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-white/40">{formatWhen(entry.computedAt)}</p>
                  <p className="mt-2 text-sm font-semibold text-white">{deltaCopy(entry.deltaScore)}</p>
                </div>
              </div>

              {entry.reason ? (
                <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-white/40">Reason / linked signal</p>
                  <p className="mt-2 text-sm text-white/75">{entry.reason}</p>
                </div>
              ) : null}

              {entry.newGaps.length > 0 || entry.resolvedGaps.length > 0 ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {entry.newGaps.length > 0 ? (
                    <div className="rounded-2xl border border-amber-400/15 bg-amber-400/10 px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-amber-50/70">New gaps</p>
                      <p className="mt-2 text-sm text-amber-50">{entry.newGaps.join(' • ')}</p>
                    </div>
                  ) : null}
                  {entry.resolvedGaps.length > 0 ? (
                    <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/10 px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-emerald-50/70">Resolved</p>
                      <p className="mt-2 text-sm text-emerald-50">{entry.resolvedGaps.join(' • ')}</p>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </article>
          )) : (
            <div className="rounded-3xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">
              Your readiness history will build here over time.
            </div>
          )}
        </div>
      </section>

      <ClinicianSupportCard
        topic="readiness"
        detail="If you need help resolving a blocker, contact our support team."
        primaryHref={data.blockers[0]?.href ?? '/holder/opportunities'}
        primaryLabel={data.blockers[0] ? data.blockers[0].nextActionLabel : 'View opportunities'}
      />
    </main>
  );
}

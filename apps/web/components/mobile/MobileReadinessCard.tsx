'use client';

import Link from 'next/link';
import { AlertTriangle, ArrowRight, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

type ReadinessLevel = 'L0' | 'L1' | 'L2' | 'L3';

interface TrustStateResponse {
  readiness_level: ReadinessLevel;
  readiness_score: number;
  readiness_status: string;
  gap_summary: string[];
  computed_at?: string;
}

interface MobileReadinessCardProps {
  npi?: string | null;
  className?: string;
  readyActionHref?: string;
  readyActionLabel?: string;
}

const LEVEL_STYLES: Record<ReadinessLevel, string> = {
  L3: 'border-emerald-500/30 bg-emerald-500/12 text-emerald-200',
  L2: 'border-sky-500/30 bg-sky-500/12 text-sky-200',
  L1: 'border-amber-500/30 bg-amber-500/12 text-amber-200',
  L0: 'border-rose-500/30 bg-rose-500/12 text-rose-200',
};

function formatUpdatedAt(value?: string): string {
  if (!value) {
    return 'Update time unavailable';
  }

  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return 'Update time unavailable';
  }
}

function deriveNextAction(
  trustState: TrustStateResponse,
  readyActionHref: string,
  readyActionLabel: string,
) {
  const topGap = trustState.gap_summary[0] ?? null;

  if (topGap) {
    return {
      href: '/holder/readiness',
      label: 'Review blockers',
      detail: topGap,
    };
  }

  if (trustState.readiness_level === 'L0' || trustState.readiness_level === 'L1') {
    return {
      href: '/holder/readiness',
      label: 'Improve readiness',
      detail: 'Your live passport is building towards clear to start.',
    };
  }

  if (trustState.readiness_level === 'L2') {
    return {
      href: '/holder/readiness',
      label: 'Open readiness details',
      detail: 'You are close. Adding missing credentials will get you to clear to start.',
    };
  }

  return {
    href: readyActionHref,
    label: readyActionLabel,
    detail: 'Your readiness is attached and ready to use in the clinician flow.',
  };
}

export function MobileReadinessCard({
  npi,
  className,
  readyActionHref = '/explore',
  readyActionLabel = 'Explore roles',
}: MobileReadinessCardProps) {
  const [trustState, setTrustState] = useState<TrustStateResponse | null>(null);
  const [loading, setLoading] = useState(Boolean(npi));
  const [error, setError] = useState<string | null>(null);

  const loadTrustState = useCallback(async () => {
    if (!npi) {
      setTrustState(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/trust-state/${encodeURIComponent(npi)}`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error('Live readiness is not available right now.');
      }

      const payload = await response.json() as TrustStateResponse;
      setTrustState(payload);
    } catch (loadError) {
      setTrustState(null);
      setError(loadError instanceof Error ? loadError.message : 'Live readiness is unavailable right now.');
    } finally {
      setLoading(false);
    }
  }, [npi]);

  useEffect(() => {
    void loadTrustState();
  }, [loadTrustState]);

  const nextAction = useMemo(() => {
    if (!trustState) {
      return null;
    }

    return deriveNextAction(trustState, readyActionHref, readyActionLabel);
  }, [readyActionHref, readyActionLabel, trustState]);

  if (!npi) {
    return (
      <section
        className={cn(
          'rounded-[28px] border border-zinc-800 bg-zinc-900/75 p-5 text-white shadow-sm',
          className,
        )}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Mobile Readiness
        </p>
        <h2 className="mt-3 text-xl font-semibold tracking-tight text-white">
          Complete onboarding to unlock your passport.
        </h2>
        <p className="mt-2 text-sm leading-6 text-zinc-300">
          Your clinician workspace is not fully linked yet, so readiness cannot be attached to applications.
        </p>
        <Link
          href="/onboarding"
          className="mt-5 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 text-sm font-semibold text-black transition hover:bg-emerald-400 active:scale-[0.98]"
        >
          Finish onboarding
          <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    );
  }

  return (
    <section
      className={cn(
        'rounded-[28px] border border-zinc-800 bg-zinc-900/75 p-5 text-white shadow-sm',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Mobile Readiness
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">
            Am I cleared?
          </h2>
          <p className="mt-1 text-xs text-zinc-400">
            NPI <span className="font-mono text-zinc-200">{npi}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadTrustState()}
          disabled={loading}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-zinc-700 bg-zinc-950/70 text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Refresh readiness"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </button>
      </div>

      {loading ? (
        <div className="mt-5 rounded-3xl border border-zinc-800 bg-zinc-950/70 p-4">
          <div className="flex items-center gap-3 text-sm text-zinc-300">
            <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
            Computing live readiness...
          </div>
        </div>
      ) : error ? (
        <div className="mt-5 space-y-4 rounded-3xl border border-amber-500/20 bg-amber-500/10 p-4">
          <div className="flex items-start gap-3 text-amber-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-white">Computation interrupted</p>
              <p className="mt-1 text-sm leading-6 text-amber-100/85">The readiness engine is temporarily paused. Your profile remains active.</p>
            </div>
          </div>
          <Link
            href="/holder/readiness"
            className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-950/80 px-4 text-sm font-semibold text-white transition hover:border-zinc-500 active:scale-[0.98]"
          >
            Open readiness page
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : trustState ? (
        <>
          <div className="mt-5 rounded-3xl border border-zinc-800 bg-zinc-950/70 p-4 relative overflow-hidden backdrop-blur-md bg-white/5 border-white/10 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Readiness Index
                </p>
                <div className="flex items-end gap-3 mt-3">
                  <div className="relative w-14 h-14">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                      <path className="text-white/10" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                      <path className="text-emerald-400" strokeDasharray={`${Math.max(6, Math.min(100, trustState.readiness_score))}, 100`} strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-sm font-bold tabular-nums text-white">{trustState.readiness_score}</span>
                    </div>
                  </div>
                  <div className="pb-1">
                    <p className="text-sm font-semibold tracking-tight text-white">
                      {trustState.readiness_status}
                    </p>
                  </div>
                </div>
              </div>
              <span className={cn(
                'rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] flex items-center gap-1',
                LEVEL_STYLES[trustState.readiness_level],
              )}>
                <ShieldCheck className="w-3 h-3" />
                {trustState.readiness_level}
              </span>
            </div>

            <div className="mt-4 flex items-center gap-2 text-xs text-zinc-400">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
              Verified cryptographically {formatUpdatedAt(trustState.computed_at)}
            </div>
          </div>

          <div className="mt-4 rounded-3xl border border-zinc-800 bg-zinc-950/70 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Pending items
            </p>
            {trustState.gap_summary.length > 0 ? (
              <ul className="mt-3 space-y-2 text-sm text-zinc-200">
                {trustState.gap_summary.slice(0, 3).map((gap) => (
                  <li key={gap} className="flex items-start gap-2 leading-6">
                    <span className="mt-2 block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                    <span>{gap}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm leading-6 text-zinc-300">
                You're clear to start for matched roles.
              </p>
            )}
          </div>

          {nextAction ? (
            <div className="mt-4 rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200/80">
                Next best action
              </p>
              <p className="mt-2 text-sm font-semibold text-white">{nextAction.label}</p>
              <p className="mt-1 text-sm leading-6 text-emerald-50/80">{nextAction.detail}</p>
              <Link
                href={nextAction.href}
                className="mt-4 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200 active:scale-[0.98]"
              >
                {nextAction.label}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

export default MobileReadinessCard;

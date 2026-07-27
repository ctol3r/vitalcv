'use client';

import Link from 'next/link';
import { AlertTriangle, ArrowRight, Loader2, RefreshCw, ShieldAlert, ShieldCheck, ShieldX } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { trackClinicianEventOncePerSession } from '@/lib/mobile/analytics';
import { PilotFailureSignal } from '@/components/pilot-ops/PilotFailureSignal';
import { SupportActionButton } from '@/components/pilot-ops/SupportActionButton';
import { MonitoringStatusBadge } from '@/components/trust-state/MonitoringStatusBadge';
import { SanctionRiskBadge } from '@/components/trust-state/SanctionRiskBadge';

type ReadinessLevel = 'L0' | 'L1' | 'L2' | 'L3';
type LicensureStatus = 'verified' | 'pending' | 'expired' | 'unknown';

interface CanonicalFactSummary {
  factType: string;
  source: string;
  status: string;
  verifiedAt?: string;
  expiresAt?: string;
  details?: string;
}

interface TrustStateResponse {
  npi: string;
  identityVerified: boolean;
  licensureStatus: LicensureStatus;
  exclusionClear: boolean;
  credentialCount: number;
  readiness_level: ReadinessLevel;
  readiness_status: string;
  readiness_score: number;
  gap_summary: string[];
  computed_at: string;
  facts: CanonicalFactSummary[];
}

const LEVEL_STYLES: Record<ReadinessLevel, string> = {
  L3: 'border-emerald-500/25 bg-emerald-500/12 text-emerald-200',
  L2: 'border-sky-500/25 bg-sky-500/12 text-sky-200',
  L1: 'border-amber-500/25 bg-amber-500/12 text-amber-200',
  L0: 'border-rose-500/25 bg-rose-500/12 text-rose-200',
};

const FACT_STATUS_STYLES: Record<string, string> = {
  VERIFIED: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200',
  ACTIVE: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200',
  CLEAR: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200',
  PENDING: 'border-amber-500/20 bg-amber-500/10 text-amber-200',
  EXPIRED: 'border-rose-500/20 bg-rose-500/10 text-rose-200',
  EXCLUDED: 'border-rose-500/20 bg-rose-500/10 text-rose-200',
};

function formatDateTime(value?: string): string {
  if (!value) {
    return 'Unavailable';
  }

  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatFactLabel(value: string): string {
  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatStatusLabel(value: string): string {
  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function licensureLabel(value: LicensureStatus): string {
  switch (value) {
    case 'verified':
      return 'Issuer-confirmed';
    case 'pending':
      return 'Pending review';
    case 'expired':
      return 'Expired';
    default:
      return 'Unavailable';
  }
}

function trustIcon(level: ReadinessLevel) {
  if (level === 'L3') {
    return ShieldCheck;
  }

  if (level === 'L0') {
    return ShieldX;
  }

  return ShieldAlert;
}

export function WalletPassport({
  npi,
  pollIntervalMs = 30_000,
}: {
  /** Required: this component must never guess whose passport it is rendering. */
  npi: string;
  pollIntervalMs?: number;
}) {
  const [trustState, setTrustState] = useState<TrustStateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTrustState = useCallback(async (isRefresh = false) => {
    if (!npi) {
      setTrustState(null);
      setError('Clinician NPI is required to load the wallet.');
      setLoading(false);
      return;
    }

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const response = await fetch(`/api/trust-state/${encodeURIComponent(npi)}`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error('Live trust state is unavailable.');
      }

      const payload = await response.json() as TrustStateResponse;
      setTrustState(payload);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Live trust state is unavailable.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [npi]);

  useEffect(() => {
    void loadTrustState();
  }, [loadTrustState]);

  useEffect(() => {
    if (!pollIntervalMs || pollIntervalMs <= 0) {
      return;
    }

    const interval = window.setInterval(() => {
      void loadTrustState(true);
    }, pollIntervalMs);

    return () => window.clearInterval(interval);
  }, [loadTrustState, pollIntervalMs]);

  useEffect(() => {
    if (!trustState) {
      return;
    }

    void trackClinicianEventOncePerSession(`wallet:${trustState.npi}`, 'clinician.wallet_viewed', {
      npi: trustState.npi,
      readinessLevel: trustState.readiness_level,
      readinessScore: trustState.readiness_score,
    });
  }, [trustState]);

  const topFacts = useMemo(() => {
    return trustState?.facts.slice(0, 4) ?? [];
  }, [trustState?.facts]);

  if (loading && !trustState) {
    return (
      <div className="rounded-[28px] border border-zinc-800 bg-zinc-900/75 p-5 text-foreground">
        <div className="flex items-center gap-3 text-sm text-zinc-300">
          <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
          Loading your live wallet passport...
        </div>
      </div>
    );
  }

  if (error && !trustState) {
    return (
      <div className="rounded-[28px] border border-rose-500/20 bg-rose-500/10 p-5 text-foreground">
        <PilotFailureSignal
          title="Passport sync interrupted"
          message={error}
          queueItem={{ source: 'route_failure' }}
          dedupeKey={`wallet-passport:${npi}:${error}`}
        />
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-200" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Passport sync interrupted</p>
            <p className="mt-1 text-sm leading-6 text-rose-100/80">The connection to the trust engine was interrupted. Your passport is safe and will retry shortly.</p>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => void loadTrustState(true)}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200 active:scale-[0.98]"
          >
            Retry
            <RefreshCw className="h-4 w-4" />
          </button>
          <Link
            href="/holder/readiness"
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-border bg-white/[0.03] px-4 text-sm font-semibold text-foreground transition hover:bg-white/[0.08] active:scale-[0.98]"
          >
            Open readiness
            <ArrowRight className="h-4 w-4" />
          </Link>
          <SupportActionButton
            label="Contact support"
            title="Passport sync interrupted"
            messagePrefill={error}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-border bg-white/[0.03] px-4 text-sm font-semibold text-foreground transition hover:bg-white/[0.08] active:scale-[0.98]"
          />
        </div>
      </div>
    );
  }

  if (!trustState) {
    return null;
  }

  const TrustIcon = trustIcon(trustState.readiness_level);

  return (
    <div className="space-y-4 rounded-[28px] border border-zinc-800 bg-zinc-900/75 p-5 text-foreground shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Your readiness
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
            Source-backed credential state
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            NPI <span className="font-mono text-zinc-200">{trustState.npi}</span> - Updated {formatDateTime(trustState.computed_at)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SanctionRiskBadge
            hasRisk={!trustState.exclusionClear}
            label={trustState.exclusionClear ? 'Sanctions clear' : 'Sanctions need review'}
          />
          <MonitoringStatusBadge active lastMonitoredAt={trustState.computed_at} />
          <button
            type="button"
            onClick={() => void loadTrustState(true)}
            disabled={refreshing}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-zinc-700 bg-zinc-950/60 text-zinc-300 transition hover:border-zinc-500 hover:text-foreground disabled:opacity-50"
            aria-label="Refresh wallet passport"
          >
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <section className="rounded-[24px] border border-zinc-800 bg-zinc-950/70 p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-muted">
                <TrustIcon className="h-5 w-5 text-emerald-300" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Live trust state
                </p>
                <p className="mt-1 text-lg font-semibold text-foreground">{trustState.readiness_status}</p>
              </div>
            </div>
          </div>
          <span className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${LEVEL_STYLES[trustState.readiness_level]}`}>
            {trustState.readiness_level}
          </span>
        </div>

        <div className="mt-5 flex items-end gap-2">
          <span className="text-4xl font-semibold tracking-tight text-foreground">{trustState.readiness_score}</span>
          <span className="pb-1 text-lg text-zinc-500">/100</span>
        </div>

        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300 transition-all duration-700"
            style={{ width: `${Math.max(6, Math.min(100, trustState.readiness_score))}%` }}
          />
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Identity</p>
            <p className="mt-2 text-sm text-foreground">{trustState.identityVerified ? 'Identity confirmed by issuer' : 'Identity needs review'}</p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Licensure</p>
            <p className="mt-2 text-sm text-foreground">{licensureLabel(trustState.licensureStatus)}</p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Credential artifacts</p>
            <p className="mt-2 text-sm text-foreground">{trustState.credentialCount}</p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Top blocker</p>
            <p className="mt-2 text-sm text-foreground">{trustState.gap_summary[0] ?? 'No blocking gaps detected'}</p>
          </div>
        </div>
      </section>

      <section className="rounded-[24px] border border-zinc-800 bg-zinc-950/70 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
          Source-backed facts
        </p>
        {topFacts.length > 0 ? (
          <div className="mt-4 space-y-3">
            {topFacts.map((fact) => {
              const statusKey = fact.status.trim().toUpperCase();
              const factStatusStyle = FACT_STATUS_STYLES[statusKey] ?? 'border-border bg-white/[0.03] text-foreground/70';

              return (
                <div
                  key={`${fact.factType}-${fact.source}-${fact.verifiedAt ?? fact.expiresAt ?? fact.status}`}
                  className="rounded-2xl border border-white/8 bg-black/20 px-4 py-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{formatFactLabel(fact.factType)}</p>
                      <p className="mt-1 text-xs text-zinc-400">{fact.source}</p>
                    </div>
                    <span className={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${factStatusStyle}`}>
                      {formatStatusLabel(fact.status)}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-3 text-xs text-zinc-300 sm:grid-cols-2">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Last confirmed</p>
                      <p className="mt-1">{formatDateTime(fact.verifiedAt)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Expires</p>
                      <p className="mt-1">{fact.expiresAt ? formatDateTime(fact.expiresAt) : 'Not provided'}</p>
                    </div>
                  </div>
                  {fact.details ? (
                    <p className="mt-3 text-xs leading-6 text-zinc-400">{fact.details}</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-3 text-sm leading-6 text-zinc-300">
            Source-confirmed facts will populate here as your credentials are corroborated.
          </p>
        )}
      </section>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/holder/readiness"
          className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200 active:scale-[0.98]"
        >
          Open readiness
          <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          href={`/passport/${trustState.npi}`}
          className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-2xl border border-border bg-white/[0.03] px-4 text-sm font-semibold text-foreground transition hover:bg-white/[0.08] active:scale-[0.98]"
        >
          Open public passport
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

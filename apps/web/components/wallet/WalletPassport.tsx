'use client';

import Link from 'next/link';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
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
  L3: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  L2: 'border-sky-300 bg-sky-50 text-sky-800',
  L1: 'border-amber-300 bg-amber-50 text-amber-800',
  L0: 'border-rose-300 bg-rose-50 text-rose-800',
};

const FACT_STATUS_STYLES: Record<string, string> = {
  VERIFIED: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  ACTIVE: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  CLEAR: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  PENDING: 'border-amber-300 bg-amber-50 text-amber-800',
  EXPIRED: 'border-rose-300 bg-rose-50 text-rose-800',
  EXCLUDED: 'border-rose-300 bg-rose-50 text-rose-800',
};

function titleCase(value: string): string {
  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDateTime(value?: string): string {
  if (!value) return 'Unavailable';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(parsed);
}

function licensureLabel(value: LicensureStatus): string {
  if (value === 'verified') return 'Confirmed by a licensing source';
  if (value === 'pending') return 'State-board review pending';
  if (value === 'expired') return 'Expired according to the licensing source';
  return 'No state-board result available';
}

export function WalletPassport({
  npi,
  pollIntervalMs = 30_000,
}: {
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
      setError('Clinician NPI is required to load verification status.');
      setLoading(false);
      return;
    }

    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const response = await fetch(`/api/trust-state/${encodeURIComponent(npi)}`, {
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('Live verification status is unavailable.');
      setTrustState((await response.json()) as TrustStateResponse);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Live verification status is unavailable.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [npi]);

  useEffect(() => {
    void loadTrustState();
  }, [loadTrustState]);

  useEffect(() => {
    if (!pollIntervalMs || pollIntervalMs <= 0) return;
    const interval = window.setInterval(() => void loadTrustState(true), pollIntervalMs);
    return () => window.clearInterval(interval);
  }, [loadTrustState, pollIntervalMs]);

  useEffect(() => {
    if (!trustState) return;
    void trackClinicianEventOncePerSession(`wallet:${trustState.npi}`, 'clinician.wallet_viewed', {
      npi: trustState.npi,
      readinessLevel: trustState.readiness_level,
      readinessScore: trustState.readiness_score,
    });
  }, [trustState]);

  if (loading && !trustState) {
    return (
      <div className="rounded-[28px] border border-[var(--vt-border)] bg-[var(--vt-surface)] p-5">
        <div className="flex items-center gap-3 text-sm text-[var(--vt-text-secondary)]">
          <Loader2 className="h-4 w-4 animate-spin text-[var(--vt-accent-emerald)]" />
          Loading verification status…
        </div>
      </div>
    );
  }

  if (error && !trustState) {
    return (
      <div className="rounded-[28px] border border-rose-300 bg-rose-50 p-5 text-rose-950">
        <PilotFailureSignal
          title="Verification sync interrupted"
          message={error}
          queueItem={{ source: 'route_failure' }}
          dedupeKey={`wallet-passport:${npi}:${error}`}
        />
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-700" />
          <div>
            <p className="text-sm font-semibold">Verification status could not load</p>
            <p className="mt-1 text-sm leading-6 text-rose-800">{error} No credential conclusion was made.</p>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => void loadTrustState(true)}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-rose-800 px-4 text-sm font-semibold text-white"
          >
            Retry <RefreshCw className="h-4 w-4" />
          </button>
          <SupportActionButton
            label="Contact support"
            title="Verification sync interrupted"
            messagePrefill={error}
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-rose-300 bg-white px-4 text-sm font-semibold text-rose-900"
          />
        </div>
      </div>
    );
  }

  if (!trustState) return null;

  const statusRows = [
    {
      label: 'Identity',
      value: trustState.identityVerified ? 'Confirmed by an identity source' : 'Needs source review',
    },
    {
      label: 'State license verification',
      value: licensureLabel(trustState.licensureStatus),
    },
    {
      label: 'Federal sanctions',
      value: trustState.exclusionClear ? 'No exclusion found in the current screening' : 'Needs review',
    },
    {
      label: 'Attached credential evidence',
      value: `${trustState.credentialCount} item${trustState.credentialCount === 1 ? '' : 's'}`,
    },
  ];

  return (
    <div className="rounded-[28px] border border-[var(--vt-border)] bg-[var(--vt-surface)] p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${LEVEL_STYLES[trustState.readiness_level]}`}>
              {trustState.readiness_status}
            </span>
            <span className="rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface-subtle)] px-3 py-1 text-xs font-semibold text-[var(--vt-text-secondary)]">
              Readiness {trustState.readiness_score}/100
            </span>
          </div>
          <p className="mt-3 text-sm text-[var(--vt-text-secondary)]">
            Updated {formatDateTime(trustState.computed_at)}
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
            aria-label="Refresh verification status"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface-subtle)] text-[var(--vt-text-secondary)] transition hover:text-foreground disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <dl className="mt-5 divide-y divide-[var(--vt-border)] border-y border-[var(--vt-border)]">
        {statusRows.map((row) => (
          <div key={row.label} className="grid gap-1 py-3 sm:grid-cols-[190px_1fr] sm:gap-5">
            <dt className="text-xs font-semibold uppercase tracking-[0.13em] text-[var(--vt-text-secondary)]">
              {row.label}
            </dt>
            <dd className="text-sm text-foreground">{row.value}</dd>
          </div>
        ))}
      </dl>

      {trustState.gap_summary.length > 0 ? (
        <div className="mt-5 rounded-2xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-950">Still needed</p>
          <ul className="mt-2 space-y-1 text-sm leading-6 text-amber-900">
            {trustState.gap_summary.map((gap) => <li key={gap}>• {gap}</li>)}
          </ul>
        </div>
      ) : null}

      <details className="mt-5 rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface-subtle)] p-4">
        <summary className="min-h-[36px] cursor-pointer text-sm font-semibold text-foreground">
          Source evidence ({trustState.facts.length})
        </summary>
        {trustState.facts.length > 0 ? (
          <div className="mt-3 divide-y divide-[var(--vt-border)] border-t border-[var(--vt-border)]">
            {trustState.facts.map((fact) => {
              const style = FACT_STATUS_STYLES[fact.status.trim().toUpperCase()] ??
                'border-[var(--vt-border)] bg-white text-[var(--vt-text-secondary)]';
              return (
                <div key={`${fact.factType}-${fact.source}-${fact.verifiedAt ?? fact.expiresAt ?? fact.status}`} className="py-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{titleCase(fact.factType)}</p>
                      <p className="mt-1 text-xs text-[var(--vt-text-secondary)]">{fact.source}</p>
                    </div>
                    <span className={`w-fit rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] ${style}`}>
                      {titleCase(fact.status)}
                    </span>
                  </div>
                  {fact.details ? <p className="mt-2 text-sm text-[var(--vt-text-secondary)]">{fact.details}</p> : null}
                  <p className="mt-2 text-xs text-[var(--vt-text-secondary)]">
                    {fact.verifiedAt ? `Observed ${formatDateTime(fact.verifiedAt)}` : 'Observation time unavailable'}
                    {fact.expiresAt ? ` · Expires ${formatDateTime(fact.expiresAt)}` : ''}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-2 text-sm text-[var(--vt-text-secondary)]">No source facts are available yet.</p>
        )}
      </details>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <Link
          href="/holder/readiness"
          className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface-subtle)] px-4 text-sm font-semibold text-foreground transition hover:bg-[var(--vt-surface-dim)]"
        >
          Review readiness details
        </Link>
        <Link
          href="/clinician/profile"
          className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface)] px-4 text-sm font-semibold text-foreground transition hover:bg-[var(--vt-surface-subtle)]"
        >
          Add missing career details
        </Link>
      </div>
    </div>
  );
}

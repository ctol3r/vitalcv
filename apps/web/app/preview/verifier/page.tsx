'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { apiRoute, getApiBase } from '@/lib/api';
import {
  type TrustStateResponse,
  normalizeTrustStateResponse,
} from '@/components/trust-state/types';

const CLINICIAN_ID = 'clinician:alice';
const EMPLOYER_ID = 'employer:alpha';
const FACILITY_ID = 'facility:main';
const ROLE = 'Registered Nurse';

function formatIso(iso: string | undefined): string {
  if (!iso) return '-';
  try {
    return new Date(iso).toISOString();
  } catch {
    return '-';
  }
}

function displayBand(band: string): string {
  if (band === 'YELLOW') return 'AMBER';
  return band || 'UNKNOWN';
}

function bandColor(band: string): string {
  switch (band) {
    case 'GREEN':
      return 'text-green-700';
    case 'YELLOW':
      return 'text-yellow-700';
    case 'RED':
      return 'text-red-700';
    default:
      return 'text-neutral-500';
  }
}

const BLOCKING_REASON_LABELS: Record<string, string> = {
  MISSING_PSV: 'No primary source verification on record',
  EXPIRED_PSV: 'PSV receipt has expired',
  REVOKED_PSV: 'PSV receipt has been revoked',
  FAILED_VERIFICATION: 'Failed verification on record',
  IDENTITY_CONFLICT: 'Unresolved identity conflict',
  MISSING_RECOGNITION: 'Not recognized by the trust network',
  MISSING_ACCEPTANCE: 'No employer acceptance for this scope',
  CRS_BELOW_THRESHOLD: 'Trust score below start threshold',
  ACTIVE_SANCTIONS: 'Active sanctions detected',
  NO_ACTIVE_LICENSE: 'No active license found',
  START_ALREADY_ATTESTED: 'Start already attested for this scope',
  VERIFICATION_EXPIRED: 'Verification has expired',
};

export default function VerifierPreviewPage() {
  const trustStateRoute = apiRoute('/trust-state');
  const isApiConfigured = Boolean(getApiBase());

  const [state, setState] = useState<TrustStateResponse>(() =>
    normalizeTrustStateResponse(null),
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolvedAt, setResolvedAt] = useState<string | null>(null);

  const fetchTrustState = useCallback(async () => {
    if (!isApiConfigured || !trustStateRoute || trustStateRoute.includes('undefined')) {
      setError('API not configured');
      setLoading(false);
      return;
    }

    try {
      const params = new URLSearchParams({
        clinician_id: CLINICIAN_ID,
        employer_id: EMPLOYER_ID,
      });
      const res = await fetch(`${trustStateRoute}?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json().catch(() => null);
      const normalized = normalizeTrustStateResponse(data);
      setState(normalized);
      setResolvedAt(new Date().toISOString());
      setError(null);
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : 'Unable to reach trust-state resolver',
      );
      setState(normalizeTrustStateResponse(null));
    } finally {
      setLoading(false);
    }
  }, [isApiConfigured, trustStateRoute]);

  useEffect(() => {
    fetchTrustState();
  }, [fetchTrustState]);

  const verificationEventCount = state.timeline_preview.filter(
    (e) => e.type === 'VERIFICATION_COMPLETED' || e.type === 'VERIFICATION_FAILED',
  ).length;

  const hasDecay = state.blocking_reasons.some((r) =>
    ['EXPIRED_PSV', 'REVOKED_PSV', 'VERIFICATION_EXPIRED'].includes(r),
  );

  return (
    <main className="mx-auto max-w-3xl px-6 py-16 font-mono text-sm sm:px-10 sm:py-20">
      <header className="border-b border-neutral-200 pb-8">
        <p className="text-xs tracking-wide text-neutral-400">Read-only. No authentication required.</p>
        <h1 className="mt-3 font-sans text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">
          Verification Result
        </h1>
      </header>

      {loading && (
        <section className="mt-12 space-y-4">
          <div className="h-4 w-72 bg-neutral-200 rounded animate-shimmer" />
          <div className="h-3 w-40 bg-neutral-200 rounded animate-shimmer" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded border border-neutral-200 p-3 space-y-2">
              <div className="h-3 w-24 bg-neutral-200 rounded animate-shimmer" />
              <div className="h-6 w-16 bg-neutral-100 rounded animate-shimmer" />
            </div>
            <div className="rounded border border-neutral-200 p-3 space-y-2">
              <div className="h-3 w-24 bg-neutral-200 rounded animate-shimmer" />
              <div className="h-6 w-16 bg-neutral-100 rounded animate-shimmer" />
            </div>
            <div className="rounded border border-neutral-200 p-3 space-y-2">
              <div className="h-3 w-24 bg-neutral-200 rounded animate-shimmer" />
              <div className="h-6 w-16 bg-neutral-100 rounded animate-shimmer" />
            </div>
          </div>
        </section>
      )}

      {!loading && error && (
        <div className="mt-12 space-y-4">
          <div className="border border-neutral-200 bg-neutral-50 px-4 py-3">
            <p className="text-neutral-700">Trust-state resolver unavailable.</p>
            <p className="mt-1 text-xs text-neutral-500">
              {error === 'API not configured'
                ? 'Set NEXT_PUBLIC_BACKEND_URL or NEXT_PUBLIC_API_BASE to connect.'
                : `Error: ${error}`}
            </p>
          </div>
          <p className="text-xs text-neutral-400">This page renders live trust-state data. Start the backend to see results.</p>
        </div>
      )}

      {!loading && !error && (
        <div className="mt-10 space-y-10">
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-400">Verdict</h2>
            <div className="mt-4 space-y-3">
              <div className="flex items-baseline justify-between">
                <span className="text-neutral-500">START READY</span>
                <span className={`text-lg font-bold ${state.start_ready ? 'text-green-700' : 'text-red-700'}`}>
                  {state.start_ready ? 'TRUE' : 'FALSE'}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-neutral-500">TRUST</span>
                <span className={`text-lg font-bold ${bandColor(state.crs.band)}`}>
                  {displayBand(state.crs.band)}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-neutral-500">CRS</span>
                <span className="text-lg font-bold text-neutral-950">{state.crs.score}</span>
              </div>
              {!state.start_ready && state.blocking_reasons.length > 0 && (
                <p className="pt-1 text-xs text-red-700">
                  {state.blocking_reasons.length} blocking reason
                  {state.blocking_reasons.length !== 1 ? 's' : ''} detected.
                </p>
              )}
            </div>
          </section>

          <p className="text-neutral-600">
            {state.start_ready
              ? 'This clinician may begin work under the specified scope.'
              : 'This clinician may not begin work until blocking reasons are resolved.'}
          </p>

          <p className="text-neutral-500">Scope: Employer = {EMPLOYER_ID} * Role = {ROLE}</p>

          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-400">Blocking Reasons</h2>
            {state.blocking_reasons.length > 0 ? (
              <ul className="mt-3 space-y-1.5">
                {state.blocking_reasons.map((reason) => (
                  <li key={reason} className="text-xs">
                    <span className="text-red-700">{reason}</span>
                    <span className="text-neutral-400"> -- {BLOCKING_REASON_LABELS[reason] ?? reason}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-xs text-neutral-500">No blocking reasons detected.</p>
            )}
          </section>

          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-400">Key Facts</h2>
            <div className="mt-3 flex flex-wrap gap-x-8 gap-y-2 text-xs">
              <div>
                <span className="text-neutral-400">Resolved </span>
                <span className="text-neutral-700">{resolvedAt ?? '-'}</span>
              </div>
              <div>
                <span className="text-neutral-400">Recognition </span>
                <span className="text-neutral-700">{state.recognitionId ?? '-'}</span>
              </div>
              <div>
                <span className="text-neutral-400">Checks evaluated </span>
                <span className="text-neutral-700">{verificationEventCount}</span>
              </div>
            </div>
          </section>

          <details className="group">
            <summary className="cursor-pointer list-none text-xs font-semibold uppercase tracking-widest text-neutral-400 transition-colors hover:text-neutral-600 [&::-webkit-details-marker]:hidden">
              <span className="group-open:hidden">+ </span>
              <span className="hidden group-open:inline">- </span>
              How this decision was made
            </summary>

            <div className="mt-6 space-y-8 border-l border-neutral-200 pl-5">
              <div>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-400">Scope Evaluated</h3>
                <dl className="space-y-1.5">
                  {[
                    ['clinician_id', CLINICIAN_ID],
                    ['employer_id', EMPLOYER_ID],
                    ['facility_id', FACILITY_ID],
                    ['role', ROLE],
                  ].map(([k, v]) => (
                    <div key={k} className="flex gap-4">
                      <dt className="w-28 shrink-0 text-neutral-500">{k}</dt>
                      <dd className="text-neutral-950">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-400">Verification Checks</h3>
                {state.crs.factors && Object.keys(state.crs.factors).length > 0 ? (
                  <dl className="space-y-1.5">
                    {Object.entries(state.crs.factors).map(([key, value]) => (
                      <div key={key} className="flex gap-4">
                        <dt className="w-28 shrink-0 text-neutral-500">{key}</dt>
                        <dd className="text-neutral-950">{String(value)}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="text-xs text-neutral-500">No CRS factor data available.</p>
                )}
                <dl className="mt-3 space-y-1.5 border-t border-neutral-100 pt-3">
                  <div className="flex gap-4">
                    <dt className="w-28 shrink-0 text-neutral-500">recognized</dt>
                    <dd className="text-neutral-950">{String(state.recognized)}</dd>
                  </div>
                  <div className="flex gap-4">
                    <dt className="w-28 shrink-0 text-neutral-500">accepted</dt>
                    <dd className="text-neutral-950">{String(state.accepted)}</dd>
                  </div>
                  <div className="flex gap-4">
                    <dt className="w-28 shrink-0 text-neutral-500">started</dt>
                    <dd className="text-neutral-950">{String(state.started)}</dd>
                  </div>
                </dl>
              </div>

              <div>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-400">Receipt References</h3>
                {state.timeline_preview.length > 0 ? (
                  <div className="space-y-3">
                    {state.timeline_preview.map((event) => (
                      <div key={event.id} className="border-l-2 border-neutral-200 py-1 pl-4">
                        <div className="flex items-baseline justify-between gap-4">
                          <span className="text-neutral-950">{event.type}</span>
                          <span className="shrink-0 text-xs text-neutral-400">{formatIso(event.timestamp)}</span>
                        </div>
                        <p className="mt-0.5 text-xs text-neutral-500">{event.label}</p>
                        {(event.employer || event.facility) && (
                          <p className="mt-0.5 text-xs text-neutral-400">{[event.employer, event.facility].filter(Boolean).join(' / ')}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-neutral-500">No audit events recorded.</p>
                )}
              </div>

              <div>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-400">Audit Statement</h3>
                <p className="text-xs text-neutral-500">
                  {hasDecay
                    ? 'Active decay. One or more receipts have expired or been revoked.'
                    : 'No decay detected. All receipts within validity window.'}
                </p>
                {state.acceptanceDetails && (
                  <dl className="mt-3 space-y-1.5 border-t border-neutral-100 pt-3">
                    <div className="flex gap-4">
                      <dt className="w-28 shrink-0 text-neutral-500">employer_id</dt>
                      <dd className="text-neutral-950">{state.acceptanceDetails.employerId}</dd>
                    </div>
                    <div className="flex gap-4">
                      <dt className="w-28 shrink-0 text-neutral-500">facility_id</dt>
                      <dd className="text-neutral-950">{state.acceptanceDetails.facilityId}</dd>
                    </div>
                    <div className="flex gap-4">
                      <dt className="w-28 shrink-0 text-neutral-500">accepted_at</dt>
                      <dd className="text-neutral-950">{formatIso(state.acceptanceDetails.acceptedAt)}</dd>
                    </div>
                  </dl>
                )}
              </div>
            </div>
          </details>
        </div>
      )}

      <div className="mt-14">
        <Link
          href="/preview"
          className="font-sans text-sm font-medium text-neutral-700 underline underline-offset-4 hover:text-neutral-900 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 focus-visible:ring-offset-2"
        >
          Back to Preview Mode
        </Link>
      </div>

      <footer className="mt-10 border-t border-neutral-200 pt-6">
        <p className="text-xs text-neutral-400">
          This is a read-only verification result. No data was modified by viewing this page.
        </p>
      </footer>
    </main>
  );
}

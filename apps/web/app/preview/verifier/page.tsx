'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

/* ------------------------------------------------------------------ */
/*  Hardcoded scope — first real truth-rendering surface.              */
/*  These match the synthetic seed data in the backend.                */
/*  Replace with URL params when authentication is introduced.         */
/* ------------------------------------------------------------------ */
const CLINICIAN_ID = 'clinician:alice';
const EMPLOYER_ID = 'employer:alpha';
const FACILITY_ID = 'facility:main';
const ROLE = 'Registered Nurse';

type TrustBand = 'GREEN' | 'YELLOW' | 'RED';

type TimelineEvent = {
  id: string;
  type: string;
  label: string;
  timestamp: string;
  employer: string | null;
  facility: string | null;
  metadata: Record<string, unknown>;
};

type TrustStateResponse = {
  recognized: boolean;
  accepted: boolean;
  started: boolean;
  start_ready: boolean;
  crs: {
    score: number;
    band: TrustBand;
    factors: Record<string, unknown>;
  } | null;
  blocking_reasons: string[];
  timeline_preview: TimelineEvent[];
  recognitionId?: string;
  acceptanceId?: string;
  startId?: string;
  recognizedAt?: string;
  acceptedAt?: string;
  attestedAt?: string;
  acceptanceDetails?: {
    employerId: string;
    facilityId: string;
    role: string;
    acceptedAt: string;
  } | null;
};

function formatIso(iso: string | undefined): string {
  if (!iso) return '\u2014';
  try {
    return new Date(iso).toISOString();
  } catch {
    return '\u2014';
  }
}

function bandColor(band: TrustBand | undefined): string {
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
  MISSING_PSV: 'Missing required primary source verification',
  EXPIRED_PSV: 'PSV receipt expired',
  REVOKED_PSV: 'PSV receipt revoked',
  FAILED_VERIFICATION: 'Failed verification on record',
  IDENTITY_CONFLICT: 'Unresolved identity conflict',
  MISSING_RECOGNITION: 'Missing network recognition',
  MISSING_ACCEPTANCE: 'Missing employer acceptance',
  CRS_BELOW_THRESHOLD: 'CRS below start threshold',
  ACTIVE_SANCTIONS: 'Active sanctions detected',
  NO_ACTIVE_LICENSE: 'No active license found',
  START_ALREADY_ATTESTED: 'Start already attested for this scope',
  VERIFICATION_EXPIRED: 'Verification expired',
};

function Row({
  label,
  value,
  valueClass,
  border = true,
}: {
  label: string;
  value: string;
  valueClass?: string;
  border?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between py-2.5 ${border ? 'border-b border-neutral-100' : ''}`}
    >
      <dt className="text-neutral-500">{label}</dt>
      <dd className={valueClass ?? 'text-neutral-950'}>{value}</dd>
    </div>
  );
}

export default function VerifierPreviewPage() {
  const backendUrl =
    process.env.NEXT_PUBLIC_API_BASE ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    '';

  const [state, setState] = useState<TrustStateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [resolvedAt, setResolvedAt] = useState<string | null>(null);

  const fetchTrustState = useCallback(async () => {
    if (!backendUrl) {
      setError('API not configured');
      setLoading(false);
      return;
    }

    try {
      const params = new URLSearchParams({
        clinician_id: CLINICIAN_ID,
        employer_id: EMPLOYER_ID,
      });
      const res = await fetch(
        `${backendUrl}/trust-state?${params.toString()}`,
      );
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data: TrustStateResponse = await res.json();
      setState(data);
      setResolvedAt(new Date().toISOString());
      setError(null);
    } catch (e: unknown) {
      setError(
        e instanceof Error
          ? e.message
          : 'Unable to reach trust-state resolver',
      );
      setState(null);
    } finally {
      setLoading(false);
    }
  }, [backendUrl]);

  useEffect(() => {
    fetchTrustState();
  }, [fetchTrustState]);

  const hasDecay = state?.blocking_reasons.some((r) =>
    ['EXPIRED_PSV', 'REVOKED_PSV', 'VERIFICATION_EXPIRED'].includes(r),
  );

  return (
    <main className="mx-auto max-w-3xl px-6 py-16 font-mono text-sm sm:px-10 sm:py-20">
      {/* ── Header ── */}
      <header className="border-b border-neutral-200 pb-8">
        <p className="text-xs tracking-wide text-neutral-400">
          Read-only verification result. No authentication required.
        </p>
        <h1 className="mt-3 font-sans text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">
          Verification Result
        </h1>
      </header>

      {/* ── Loading ── */}
      {loading && (
        <p className="mt-12 text-neutral-400">
          Resolving trust state\u2026
        </p>
      )}

      {/* ── Error / API unavailable ── */}
      {!loading && error && (
        <div className="mt-12 space-y-4">
          <div className="border border-neutral-200 bg-neutral-50 px-4 py-3">
            <p className="text-neutral-700">
              Trust-state resolver unavailable.
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              {error === 'API not configured'
                ? 'Set NEXT_PUBLIC_BACKEND_URL or NEXT_PUBLIC_API_BASE to connect.'
                : `Error: ${error}`}
            </p>
          </div>
          <p className="text-xs text-neutral-400">
            This page renders live trust-state data. Start the backend to
            see results.
          </p>
        </div>
      )}

      {/* ── Verdict ── */}
      {!loading && state && (
        <div className="mt-10 space-y-12">
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
              Verdict
            </h2>

            <dl className="mt-4">
              <Row
                label="trust_band"
                value={state.crs?.band ?? 'UNKNOWN'}
                valueClass={`font-semibold ${bandColor(state.crs?.band)}`}
              />
              <Row
                label="crs_score"
                value={String(state.crs?.score ?? '\u2014')}
              />
              <Row
                label="start_ready"
                value={String(state.start_ready)}
                valueClass={
                  state.start_ready ? 'text-green-700' : 'text-red-700'
                }
              />

              {/* Blocking Reasons */}
              <div className="border-b border-neutral-100 py-2.5">
                <div className="flex items-baseline justify-between">
                  <dt className="text-neutral-500">blocking_reasons</dt>
                  <dd className="text-neutral-950">
                    {state.blocking_reasons.length === 0
                      ? 'none'
                      : `${state.blocking_reasons.length} active`}
                  </dd>
                </div>
                {state.blocking_reasons.length > 0 && (
                  <ul className="mt-2 space-y-1 pl-4">
                    {state.blocking_reasons.map((reason) => (
                      <li key={reason} className="text-xs text-red-700">
                        {reason}
                        <span className="text-neutral-400">
                          {' \u2014 '}
                          {BLOCKING_REASON_LABELS[reason] ?? reason}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <Row
                label="recognized"
                value={String(state.recognized)}
              />
              <Row
                label="accepted"
                value={String(state.accepted)}
              />
              <Row
                label="started"
                value={String(state.started)}
              />
              <Row
                label="resolved_at"
                value={resolvedAt ?? '\u2014'}
                border={false}
              />
            </dl>
          </section>

          {/* ── Explainer toggle ── */}
          <section>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-neutral-400 transition-colors hover:text-neutral-600"
            >
              <span className="inline-block w-3 text-center">
                {expanded ? '\u2212' : '+'}
              </span>
              How this decision was made
            </button>

            {expanded && (
              <div className="mt-6 space-y-8 border-l border-neutral-200 pl-5">
                {/* Scope */}
                <div>
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-400">
                    Scope
                  </h3>
                  <dl className="space-y-1.5">
                    {[
                      ['clinician_id', CLINICIAN_ID],
                      ['employer_id', EMPLOYER_ID],
                      ['facility_id', FACILITY_ID],
                      ['role', ROLE],
                    ].map(([k, v]) => (
                      <div key={k} className="flex gap-4">
                        <dt className="w-28 shrink-0 text-neutral-500">
                          {k}
                        </dt>
                        <dd className="text-neutral-950">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </div>

                {/* CRS Factors */}
                {state.crs?.factors &&
                  Object.keys(state.crs.factors).length > 0 && (
                    <div>
                      <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-400">
                        CRS Factors
                      </h3>
                      <dl className="space-y-1.5">
                        {Object.entries(state.crs.factors).map(
                          ([key, value]) => (
                            <div key={key} className="flex gap-4">
                              <dt className="w-28 shrink-0 text-neutral-500">
                                {key}
                              </dt>
                              <dd className="text-neutral-950">
                                {String(value)}
                              </dd>
                            </div>
                          ),
                        )}
                      </dl>
                    </div>
                  )}

                {/* Acceptance Record */}
                {state.acceptanceDetails && (
                  <div>
                    <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-400">
                      Acceptance Record
                    </h3>
                    <dl className="space-y-1.5">
                      {[
                        ['employer_id', state.acceptanceDetails.employerId],
                        ['facility_id', state.acceptanceDetails.facilityId],
                        ['role', state.acceptanceDetails.role],
                        [
                          'accepted_at',
                          formatIso(state.acceptanceDetails.acceptedAt),
                        ],
                      ].map(([k, v]) => (
                        <div key={k} className="flex gap-4">
                          <dt className="w-28 shrink-0 text-neutral-500">
                            {k}
                          </dt>
                          <dd className="text-neutral-950">{v}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}

                {/* Audit Trail */}
                {state.timeline_preview &&
                  state.timeline_preview.length > 0 && (
                    <div>
                      <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-400">
                        Audit Trail ({state.timeline_preview.length} events)
                      </h3>
                      <div className="space-y-3">
                        {state.timeline_preview.map((event) => (
                          <div
                            key={event.id}
                            className="border-l-2 border-neutral-200 py-1 pl-4"
                          >
                            <div className="flex items-baseline justify-between gap-4">
                              <span className="text-neutral-950">
                                {event.type}
                              </span>
                              <span className="shrink-0 text-xs text-neutral-400">
                                {formatIso(event.timestamp)}
                              </span>
                            </div>
                            <p className="mt-0.5 text-xs text-neutral-500">
                              {event.label}
                            </p>
                            {(event.employer || event.facility) && (
                              <p className="mt-0.5 text-xs text-neutral-400">
                                {[event.employer, event.facility]
                                  .filter(Boolean)
                                  .join(' / ')}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Decay Checks */}
                <div>
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-400">
                    Decay Checks
                  </h3>
                  {hasDecay ? (
                    <p className="text-xs text-red-700">
                      Active decay detected. One or more verification receipts
                      have expired or been revoked.
                    </p>
                  ) : (
                    <p className="text-xs text-neutral-500">
                      No decay detected. All verification receipts are within
                      validity window.
                    </p>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {/* ── Navigation ── */}
      <div className="mt-14">
        <Link
          href="/preview"
          className="font-sans text-sm font-medium text-neutral-700 underline underline-offset-4 hover:text-neutral-900 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 focus-visible:ring-offset-2"
        >
          All participants
        </Link>
      </div>

      {/* ── Footer ── */}
      <footer className="mt-10 border-t border-neutral-200 pt-6">
        <p className="text-xs text-neutral-400">
          Synthetic data over production code paths.
        </p>
      </footer>
    </main>
  );
}

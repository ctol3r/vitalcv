/**
 * /internal/validation — operator-only validation dashboard.
 *
 * Surfaces: last monitoring / drift run, active drift cases, unacked
 * trust alerts (anomalies). When any anomaly is unacked or any active
 * drift case exists, the page renders a degraded-status banner and
 * prompts human investigation.
 *
 * INTERNAL ONLY. This page is not linked from any user-facing surface
 * and its data is read-through over existing tables (AuditEvent,
 * DriftEvent, TrustAlertRecord).
 */

import type { Metadata } from 'next';

const BACKEND =
  process.env.NEXT_PUBLIC_API_BASE
  ?? process.env.NEXT_PUBLIC_BACKEND_URL
  ?? 'http://localhost:3001';

interface Anomaly {
  id: string;
  subject: string;
  severity: string;
  reason: string;
  createdAt: string;
  acknowledged: boolean;
}

interface DriftCase {
  id: string;
  subjectNpi: string;
  source: string;
  driftType: string;
  detectedAt: string;
}

interface ValidationSummary {
  status: 'ok' | 'degraded';
  generatedAt: string;
  lastRun: { type: string; createdAt: string; npi: string | null } | null;
  anomalies: Anomaly[];
  driftCases: DriftCase[];
}

export const metadata: Metadata = {
  title: 'Validation — VitalCV Internal',
  robots: { index: false, follow: false },
};

async function fetchValidationSummary(): Promise<ValidationSummary | null> {
  try {
    const res = await fetch(`${BACKEND}/api/internal/validation`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return (await res.json()) as ValidationSummary;
  } catch {
    return null;
  }
}

function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function maskNpi(npi: string | null): string {
  if (!npi) return '—';
  if (npi.length < 4) return npi;
  return `${npi.slice(0, 4)}····`;
}

const SEVERITY_TONE: Record<string, string> = {
  high: 'text-red-700',
  HIGH: 'text-red-700',
  medium: 'text-amber-700',
  MEDIUM: 'text-amber-700',
  low: 'text-slate-700',
  LOW: 'text-slate-700',
};

function severityClass(severity: string): string {
  return SEVERITY_TONE[severity] ?? 'text-slate-700';
}

export default async function InternalValidationPage() {
  const summary = await fetchValidationSummary();

  if (!summary) {
    return (
      <main className="min-h-screen bg-background px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-2xl font-bold text-foreground">Validation</h1>
          <div className="mt-6 rounded-lg border-2 border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-800">
            Validation summary unavailable — backend unreachable or returned an
            error. Mark system degraded until resolved.
          </div>
        </div>
      </main>
    );
  }

  const isDegraded = summary.status === 'degraded';
  const unackedAnomalies = summary.anomalies.filter((a) => !a.acknowledged);

  return (
    <main className="min-h-screen bg-background px-6 py-16">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Operator · Internal
            </p>
            <h1 className="mt-1 text-3xl font-bold text-foreground">Validation</h1>
          </div>
          <p className="text-xs text-muted-foreground tabular-nums">
            Generated {formatDateTime(summary.generatedAt)}
          </p>
        </header>

        {isDegraded ? (
          <div
            role="status"
            aria-live="polite"
            className="rounded-lg border-2 border-red-500/40 bg-red-500/10 px-5 py-4 text-red-800"
          >
            <p className="text-xs font-semibold uppercase tracking-widest">
              System degraded — investigation required
            </p>
            <p className="mt-1 text-sm">
              {unackedAnomalies.length} unacknowledged anomal
              {unackedAnomalies.length === 1 ? 'y' : 'ies'}; {summary.driftCases.length} active drift case
              {summary.driftCases.length === 1 ? '' : 's'}. Operator must triage before promoting any
              downstream artifacts.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-green-500/40 bg-green-500/10 px-5 py-4 text-green-800">
            <p className="text-xs font-semibold uppercase tracking-widest">
              System status: OK
            </p>
            <p className="mt-1 text-sm">
              No unacknowledged anomalies or active drift cases surfaced by the baseline checks.
            </p>
          </div>
        )}

        <section className="rounded-lg border border-border bg-card p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Last monitoring / drift run
          </p>
          {summary.lastRun ? (
            <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Event</dt>
                <dd className="mt-0.5 font-mono text-foreground">{summary.lastRun.type}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">When</dt>
                <dd className="mt-0.5 text-foreground tabular-nums">
                  {formatDateTime(summary.lastRun.createdAt)}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Subject NPI</dt>
                <dd className="mt-0.5 font-mono text-foreground">
                  {maskNpi(summary.lastRun.npi)}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              No monitoring / drift runs recorded yet.
            </p>
          )}
        </section>

        <section className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Anomalies
            </p>
            <p className="text-[11px] tabular-nums text-muted-foreground">
              {unackedAnomalies.length} unacked · {summary.anomalies.length} total
            </p>
          </div>
          {summary.anomalies.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No anomalies recorded.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {summary.anomalies.map((a) => (
                <li key={a.id} className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-baseline sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium ${severityClass(a.severity)}`}>
                      <span className="mr-2 text-[10px] font-semibold uppercase tracking-widest opacity-75">
                        {a.severity}
                      </span>
                      {a.reason}
                      {!a.acknowledged && (
                        <span className="ml-2 rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-semibold text-red-800">
                          Unacked
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Subject: <span className="font-mono">{maskNpi(a.subject)}</span>
                    </p>
                  </div>
                  <p className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                    {formatDateTime(a.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Drift cases
            </p>
            <p className="text-[11px] tabular-nums text-muted-foreground">
              {summary.driftCases.length} active
            </p>
          </div>
          {summary.driftCases.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No drift cases — baseline matches current across all monitored sources.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {summary.driftCases.map((d) => (
                <li key={d.id} className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-baseline sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">
                      <span className="mr-2 text-[10px] font-semibold uppercase tracking-widest text-amber-700">
                        {d.driftType}
                      </span>
                      Source: <span className="font-mono">{d.source}</span>
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Subject NPI: <span className="font-mono">{maskNpi(d.subjectNpi)}</span>
                    </p>
                  </div>
                  <p className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                    {formatDateTime(d.detectedAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <footer className="text-center text-[11px] text-muted-foreground">
          Internal observability only — this page is never linked from user-facing surfaces.
        </footer>
      </div>
    </main>
  );
}

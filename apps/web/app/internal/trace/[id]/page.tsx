/**
 * /internal/trace/[id] — operator-only decision trace viewer.
 *
 * Thin-wraps the existing auditReplay API:
 *   GET /api/decisions/:id/evidence   (verification + claim evidence)
 *   GET /api/decisions/:id/chain      (audit-chain events)
 *
 * Renders a step-by-step, human-readable layered view of:
 *   1. Authority evidence
 *   2. Organization policy influence
 *   3. Learning influence
 *   4. Overrides applied
 *   5. Audit chain
 *
 * INTERNAL ONLY — robots noindex/nofollow; not linked from any
 * user-facing surface. NO user exposure.
 */

import type { Metadata } from 'next';

const BACKEND =
  process.env.NEXT_PUBLIC_API_BASE
  ?? process.env.NEXT_PUBLIC_BACKEND_URL
  ?? 'http://localhost:3001';

export const metadata: Metadata = {
  title: 'Decision Trace — VitalCV Internal',
  robots: { index: false, follow: false },
};

async function fetchJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function maskNpi(npi: unknown): string {
  if (typeof npi !== 'string' || npi.length < 4) return '—';
  return `${npi.slice(0, 4)}····`;
}

export default async function DecisionTracePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [evidence, chain] = await Promise.all([
    fetchJson(`${BACKEND}/api/decisions/${encodeURIComponent(id)}/evidence`),
    fetchJson(`${BACKEND}/api/decisions/${encodeURIComponent(id)}/chain`),
  ]);

  const evidenceRec = isRecord(evidence) ? evidence : null;
  const chainRec = isRecord(chain) ? chain : null;

  const capsule = isRecord(evidenceRec?.capsule) ? evidenceRec!.capsule : evidenceRec;
  const decisionType =
    (capsule && typeof capsule.decisionType === 'string' && capsule.decisionType) || '—';
  const status =
    (capsule && typeof capsule.status === 'string' && capsule.status) || '—';
  const decisionTimestamp =
    (capsule && typeof capsule.decisionTimestamp === 'string' && capsule.decisionTimestamp) || null;
  const subjectNpi =
    capsule && typeof (capsule as { subjectNpi?: unknown }).subjectNpi === 'string'
      ? (capsule as { subjectNpi: string }).subjectNpi
      : null;

  const sourcesConsulted = Array.isArray(evidenceRec?.sourcesConsulted)
    ? evidenceRec!.sourcesConsulted.filter(isRecord)
    : [];
  const attestations = Array.isArray(evidenceRec?.attestations)
    ? evidenceRec!.attestations.filter(isRecord)
    : [];
  const reasoningSteps = Array.isArray(evidenceRec?.reasoningSteps)
    ? evidenceRec!.reasoningSteps.filter(isRecord)
    : [];
  const trustStateAtDecision = isRecord(evidenceRec?.trustStateAtDecision)
    ? evidenceRec!.trustStateAtDecision
    : null;
  const chainEvents = Array.isArray(chainRec?.events)
    ? chainRec!.events.filter(isRecord)
    : Array.isArray(chainRec)
      ? (chainRec as unknown[]).filter(isRecord)
      : [];

  const notFound = !evidenceRec && !chainRec;

  return (
    <main className="min-h-screen bg-background px-6 py-16">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Operator · Internal · Decision Trace
            </p>
            <h1 className="mt-1 text-3xl font-bold text-foreground">
              Trace <span className="font-mono text-xl opacity-75">{id}</span>
            </h1>
          </div>
          <p className="text-xs text-muted-foreground tabular-nums">
            Subject NPI: <span className="font-mono">{maskNpi(subjectNpi)}</span>
          </p>
        </header>

        {notFound ? (
          <div className="rounded-lg border-2 border-red-500/40 bg-red-500/10 px-5 py-4 text-sm text-red-800">
            No evidence or chain records available for this trace id. Confirm the capsule id
            or check upstream audit store.
          </div>
        ) : (
          <>
            <section className="rounded-lg border border-border bg-card p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Decision summary
              </p>
              <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Type</dt>
                  <dd className="mt-0.5 font-mono text-foreground">{decisionType}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Status</dt>
                  <dd className="mt-0.5 font-mono text-foreground">{status}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">When</dt>
                  <dd className="mt-0.5 text-foreground tabular-nums">
                    {decisionTimestamp ? formatDateTime(decisionTimestamp) : '—'}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="rounded-lg border border-border bg-card p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Step 1 · Authority evidence
              </p>
              {sourcesConsulted.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  No sources recorded against this decision.
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-border">
                  {sourcesConsulted.map((s, idx) => (
                    <li key={idx} className="py-2.5 text-sm">
                      <p className="font-medium text-foreground">
                        <span className="mr-2 font-mono text-xs opacity-75">
                          {String(s.source ?? '—')}
                        </span>
                        {String(s.label ?? '')}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        Outcome: {String(s.outcome ?? '—')} ·{' '}
                        Consulted:{' '}
                        {typeof s.consultedAt === 'string'
                          ? formatDateTime(s.consultedAt)
                          : '—'}
                        {typeof s.confidence === 'number'
                          ? ` · Confidence ${(s.confidence * 100).toFixed(0)}%`
                          : ''}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-lg border border-border bg-card p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Step 2 · Trust state at decision time
              </p>
              {trustStateAtDecision ? (
                <pre className="mt-3 max-h-64 overflow-auto rounded border border-border bg-muted/40 p-3 text-[11px] text-foreground">
                  {JSON.stringify(trustStateAtDecision, null, 2)}
                </pre>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">
                  No trust-state snapshot captured.
                </p>
              )}
            </section>

            <section className="rounded-lg border border-border bg-card p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Step 3 · Reasoning steps (policy + learning influence)
              </p>
              {reasoningSteps.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  No reasoning trace attached.
                </p>
              ) : (
                <ol className="mt-3 list-inside list-decimal space-y-2 text-sm text-foreground">
                  {reasoningSteps.map((r, idx) => (
                    <li key={idx}>
                      <span className="font-medium">
                        {String(r.label ?? r.step ?? `Step ${idx + 1}`)}
                      </span>
                      {typeof r.description === 'string' && r.description && (
                        <span className="ml-2 text-muted-foreground">{r.description}</span>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section className="rounded-lg border border-border bg-card p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Step 4 · Overrides / attestations
              </p>
              {attestations.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  No manual overrides or countersignatures recorded.
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-border">
                  {attestations.map((a, idx) => (
                    <li key={idx} className="py-2.5 text-sm text-foreground">
                      <p className="font-medium">
                        {String(a.actor ?? 'unknown actor')} ·{' '}
                        <span className="text-xs opacity-75">
                          {String(a.type ?? 'attestation')}
                        </span>
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {typeof a.timestamp === 'string'
                          ? formatDateTime(a.timestamp)
                          : '—'}
                        {typeof a.note === 'string' && a.note ? ` · ${a.note}` : ''}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-lg border border-border bg-card p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Step 5 · Audit chain
              </p>
              {chainEvents.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  No chain events recorded.
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-border">
                  {chainEvents.map((e, idx) => (
                    <li key={idx} className="py-2.5 text-sm">
                      <p className="font-mono text-xs text-foreground">
                        {String(e.event ?? e.type ?? 'event')}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
                        {typeof e.timestamp === 'string'
                          ? formatDateTime(e.timestamp)
                          : '—'}
                        {typeof e.actor === 'string' && e.actor ? ` · ${e.actor}` : ''}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}

        <footer className="text-center text-[11px] text-muted-foreground">
          Internal observability only — this page is never linked from user-facing surfaces.
        </footer>
      </div>
    </main>
  );
}

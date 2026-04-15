/**
 * /internal/snapshots/[id] — operator-only snapshot viewer.
 *
 * Renders a DecisionAttestation row verbatim as it was captured at
 * decision time. NO mutation, NO recompute — the displayed values are
 * the exact bytes that were canonically hashed and stored.
 *
 * INTERNAL ONLY — robots noindex/nofollow, not linked from any
 * user-facing surface.
 */

import type { Metadata } from 'next';

const BACKEND =
  process.env.NEXT_PUBLIC_API_BASE
  ?? process.env.NEXT_PUBLIC_BACKEND_URL
  ?? 'http://localhost:3001';

interface SnapshotResponse {
  id: string;
  clinicianNpi: string;
  actionTaken: string;
  decisionState: string;
  decisionTimestamp: string;
  snapshot: unknown;
  hash: string;
  actorId: string | null;
  organizationId: string | null;
  createdAt: string;
}

export const metadata: Metadata = {
  title: 'Snapshot — VitalCV Internal',
  robots: { index: false, follow: false },
};

async function fetchSnapshot(id: string): Promise<SnapshotResponse | null> {
  try {
    const res = await fetch(
      `${BACKEND}/api/internal/snapshots/${encodeURIComponent(id)}`,
      {
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!res.ok) return null;
    return (await res.json()) as SnapshotResponse;
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
      second: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function maskNpi(npi: string | null | undefined): string {
  if (!npi || npi.length < 4) return '—';
  return `${npi.slice(0, 4)}····`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function extractFreshness(snapshot: unknown): {
  capturedAt: string | null;
  checks: Array<{ sourceId: string; state: string; checkedAt: string | null }>;
} {
  if (!isRecord(snapshot)) return { capturedAt: null, checks: [] };
  const capturedAt =
    typeof snapshot.capturedAt === 'string' ? snapshot.capturedAt : null;
  const coverage = snapshot.coverage ?? snapshot.evidence;
  const rawChecks = isRecord(coverage) && Array.isArray(coverage.checks)
    ? coverage.checks
    : [];
  const checks = rawChecks
    .filter(isRecord)
    .map((c) => ({
      sourceId: typeof c.sourceId === 'string' ? c.sourceId : '',
      state: typeof c.state === 'string' ? c.state : 'unknown',
      checkedAt: typeof c.checkedAt === 'string' ? c.checkedAt : null,
    }));
  return { capturedAt, checks };
}

export default async function SnapshotViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const snap = await fetchSnapshot(id);

  return (
    <main className="min-h-screen bg-background px-6 py-16">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Operator · Internal · Snapshot
            </p>
            <h1 className="mt-1 text-3xl font-bold text-foreground">
              Snapshot <span className="font-mono text-xl opacity-75">{id}</span>
            </h1>
          </div>
          {snap && (
            <p className="text-xs text-muted-foreground tabular-nums">
              Captured {formatDateTime(snap.createdAt)}
            </p>
          )}
        </header>

        {!snap ? (
          <div className="rounded-lg border-2 border-red-500/40 bg-red-500/10 px-5 py-4 text-sm text-red-800">
            Snapshot not found, unreadable, or upstream error. Confirm the
            snapshot id.
          </div>
        ) : (
          <>
            <section className="rounded-lg border border-border bg-card p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Decision outcome
              </p>
              <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Action</dt>
                  <dd className="mt-0.5 font-mono text-foreground">{snap.actionTaken}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Decision state</dt>
                  <dd className="mt-0.5 font-mono text-foreground">{snap.decisionState}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Decided at</dt>
                  <dd className="mt-0.5 text-foreground tabular-nums">
                    {formatDateTime(snap.decisionTimestamp)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Subject NPI</dt>
                  <dd className="mt-0.5 font-mono text-foreground">
                    {maskNpi(snap.clinicianNpi)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Actor</dt>
                  <dd className="mt-0.5 font-mono text-foreground">
                    {snap.actorId ?? '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Organization</dt>
                  <dd className="mt-0.5 font-mono text-foreground">
                    {snap.organizationId ?? '—'}
                  </dd>
                </div>
              </dl>
              <p className="mt-3 break-all text-[11px] text-muted-foreground">
                Hash (sha256): <span className="font-mono">{snap.hash}</span>
              </p>
            </section>

            <section className="rounded-lg border border-border bg-card p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Freshness at time T
              </p>
              {(() => {
                const { capturedAt, checks } = extractFreshness(snap.snapshot);
                return (
                  <>
                    <p className="mt-3 text-sm text-muted-foreground">
                      Captured: {capturedAt ? formatDateTime(capturedAt) : '—'}
                    </p>
                    {checks.length === 0 ? (
                      <p className="mt-2 text-sm text-muted-foreground">
                        No coverage checks recorded in this snapshot.
                      </p>
                    ) : (
                      <ul className="mt-3 divide-y divide-border">
                        {checks.map((c, idx) => (
                          <li key={idx} className="flex flex-col gap-0.5 py-2 sm:flex-row sm:items-baseline sm:justify-between">
                            <span className="font-mono text-xs text-foreground">
                              {c.sourceId || '—'}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              state: <span className="font-semibold">{c.state}</span>
                              {' · '}
                              last check:{' '}
                              <span className="tabular-nums">
                                {c.checkedAt ? formatDateTime(c.checkedAt) : '—'}
                              </span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                );
              })()}
            </section>

            <section className="rounded-lg border border-border bg-card p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Full data at time T
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Raw snapshot bytes (read-only). Values are exactly what was
                canonicalized and hashed at decision time — no recompute.
              </p>
              <pre className="mt-3 max-h-[500px] overflow-auto rounded border border-border bg-muted/40 p-3 text-[11px] text-foreground">
                {JSON.stringify(snap.snapshot, null, 2)}
              </pre>
            </section>
          </>
        )}

        <footer className="text-center text-[11px] text-muted-foreground">
          Internal observability only — this page is never linked from
          user-facing surfaces. Snapshot values are immutable; this view does
          not recompute or mutate.
        </footer>
      </div>
    </main>
  );
}

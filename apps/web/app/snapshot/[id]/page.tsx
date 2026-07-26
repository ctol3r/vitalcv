/**
 * /snapshot/[id] — Wave M. Public viewer for a persisted readiness snapshot:
 * the share-once / reuse-by-many evidence artifact.
 *
 * Honesty rules on this surface:
 *  - the content renders AS ISSUED (immutable, pinned by contentHash);
 *  - a read-time freshness overlay labels every source check past its
 *    refresh window as stale and recommends requesting a refreshed share —
 *    stale data is never presented as current;
 *  - revoked snapshots fail closed with no content;
 *  - every access is written to the audit log by the backend.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Readiness snapshot — VitalCV',
  description:
    'A source-backed readiness snapshot, served as issued with read-time freshness labeling.',
};

const BACKEND =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:4000';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface CoverageCheck {
  sourceId?: string;
  state?: string;
  checkedAt?: string | null;
}

interface SnapshotPayload {
  ok: boolean;
  snapshotId: string;
  npi: string;
  issuedAt: string;
  contentHash: string;
  snapshot: {
    readiness?: { level?: string; score?: number; status?: string; checkedAt?: string };
    sourceCoverage?: { checks?: CoverageCheck[] };
  };
  scope?: { organizationName?: string; purposeOfUse?: string } | null;
  freshness: {
    evaluatedAt: string;
    staleSources: Array<{ sourceId: string; checkedAt: string; freshnessWindowHours: number }>;
    unevaluatedSources: string[];
    reverifyRecommended: boolean;
    note: string;
  };
}

async function fetchSnapshot(id: string): Promise<{ status: number; payload: SnapshotPayload | null }> {
  try {
    const response = await fetch(`${BACKEND}/api/snapshot/${id}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
    const payload = (await response.json().catch(() => null)) as SnapshotPayload | null;
    return { status: response.status, payload };
  } catch {
    return { status: 503, payload: null };
  }
}

export default async function SnapshotPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  if (!UUID_RE.test(id)) notFound();

  const { status, payload } = await fetchSnapshot(id);
  if (status === 404) notFound();

  if (status === 410) {
    return (
      <Shell>
        <h1 className="text-2xl font-semibold text-foreground">This snapshot was revoked</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The clinician revoked this share. Revoked snapshots fail closed and serve no content. Ask
          the clinician to share a fresh snapshot if you still need their evidence.
        </p>
      </Shell>
    );
  }

  if (!payload?.ok) {
    return (
      <Shell>
        <h1 className="text-2xl font-semibold text-foreground">Snapshot is temporarily unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This is a system state — nothing about the snapshot changed. Try again shortly.
        </p>
      </Shell>
    );
  }

  const staleIds = new Set(payload.freshness.staleSources.map((s) => s.sourceId));
  const checks = payload.snapshot.sourceCoverage?.checks ?? [];
  const readiness = payload.snapshot.readiness;

  return (
    <Shell>
      <header>
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
          Readiness snapshot — as issued
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-foreground">NPI {payload.npi}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Issued {new Date(payload.issuedAt).toLocaleString()}
          {payload.scope?.organizationName ? <> · shared with {payload.scope.organizationName}</> : null}
          {payload.scope?.purposeOfUse ? <> · {payload.scope.purposeOfUse}</> : null}
        </p>
        <p className="mt-1 font-mono text-[11px] text-muted-foreground/70">
          content hash {payload.contentHash.slice(0, 16)}… — identical on every read
        </p>
      </header>

      {/* Freshness overlay — read-time, never rewrites the snapshot */}
      <section
        aria-label="Freshness"
        className={`rounded-xl border p-4 text-sm ${
          payload.freshness.reverifyRecommended
            ? 'border-amber-500/40 bg-amber-500/5 text-foreground'
            : 'border-border text-muted-foreground'
        }`}
      >
        <p className="font-medium">{payload.freshness.note}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Freshness evaluated {new Date(payload.freshness.evaluatedAt).toLocaleString()} against each
          source&rsquo;s refresh window. The snapshot itself is immutable.
        </p>
      </section>

      {/* Readiness as issued */}
      {readiness ? (
        <section aria-label="Readiness as issued" className="rounded-xl border border-border p-4">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Readiness at issue time</p>
          <p className="mt-2 text-lg font-semibold text-foreground">
            {readiness.level ?? '—'} · {typeof readiness.score === 'number' ? `${readiness.score}/100` : '—'}
          </p>
          <p className="text-sm text-muted-foreground">
            {readiness.status ?? ''}
            {readiness.checkedAt ? <> — checked {new Date(readiness.checkedAt).toLocaleString()}</> : null}
          </p>
        </section>
      ) : null}

      {/* Per-source coverage with last-checked + read-time staleness */}
      <section aria-label="Source coverage" className="rounded-xl border border-border">
        <div className="border-b border-border px-4 py-3">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Source checks as issued
          </p>
        </div>
        {checks.length === 0 ? (
          <p className="px-4 py-4 text-sm text-muted-foreground">
            No source checks were recorded in this snapshot.
          </p>
        ) : (
          <ul>
            {checks.map((check, index) => {
              const sourceId = check.sourceId ?? `source-${index}`;
              const stale = staleIds.has(sourceId);
              return (
                <li
                  key={`${sourceId}-${index}`}
                  className="flex flex-wrap items-center gap-2 border-b border-border/60 px-4 py-2.5 text-sm last:border-b-0"
                >
                  <span className="font-medium text-foreground">{sourceId}</span>
                  <span className="text-muted-foreground">{check.state ?? 'unknown'}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {check.checkedAt
                      ? `last checked ${new Date(check.checkedAt).toLocaleString()}`
                      : 'no check timestamp'}
                  </span>
                  {stale ? (
                    <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                      stale — re-verify before relying on this
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <footer className="text-xs leading-relaxed text-muted-foreground">
        <p>
          This snapshot shows evidence exactly as it was issued; it is not a live verification and
          not a credentialing decision — reviewers always decide. To get current evidence, ask the
          clinician to share a refreshed snapshot. Every access to this page is recorded in the
          audit log.
        </p>
      </footer>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-12" data-testid="snapshot-page">
      {children}
    </main>
  );
}

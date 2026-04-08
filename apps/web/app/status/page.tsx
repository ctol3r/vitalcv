import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, ShieldCheck } from 'lucide-react';
import type { SourceOpsEntry, SourceOpsReport } from '@/lib/mission-ops/sourceOpsTypes';
import { getSourceOpsReportWithFallback } from '@/lib/status/sourceOps';

export const dynamic = 'force-dynamic';

// ── Last-known-good cache (persists within warm lambda instances) ─────
let cachedReport: SourceOpsReport | null = null;
let cachedAt: number | null = null;

export const metadata: Metadata = {
  title: 'Status',
  description:
    'Current launch-lane source status and coverage posture for VitalCV.',
  openGraph: {
    title: 'Status',
    description:
      'Current launch-lane source status and coverage posture for VitalCV.',
    url: 'https://vitalcv.com/status',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Status',
    description:
      'Current launch-lane source status and coverage posture for VitalCV.',
  },
};

function coverageTone(state: SourceOpsEntry['coverageState']): string {
  switch (state) {
    case 'checked':
      return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400';
    case 'stale':
    case 'reviewRequired':
      return 'border-amber-500/20 bg-amber-500/10 text-amber-400';
    case 'gated':
    case 'accessRequired':
      return 'border-sky-500/20 bg-sky-500/10 text-sky-400';
    case 'unavailable':
      return 'border-rose-500/20 bg-rose-500/10 text-rose-400';
    default:
      return 'border-border bg-card text-muted-foreground';
  }
}

function spineTone(status: SourceOpsReport['spineStatus']): string {
  switch (status) {
    case 'HEALTHY':
      return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400';
    case 'DEGRADED':
    case 'STALE':
      return 'border-amber-500/20 bg-amber-500/10 text-amber-400';
    case 'CRITICAL':
      return 'border-rose-500/20 bg-rose-500/10 text-rose-400';
    default:
      return 'border-border bg-card text-muted-foreground';
  }
}

function formatRelativeAge(value: string | null): string {
  if (!value) return 'No successful fetch recorded';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Timestamp unavailable';

  const diffMs = Date.now() - parsed.getTime();
  const diffHours = Math.floor(diffMs / 3_600_000);

  if (diffHours < 1) {
    const diffMinutes = Math.max(1, Math.floor(diffMs / 60_000));
    return `${diffMinutes}m ago`;
  }

  if (diffHours < 48) {
    return `${diffHours}h ago`;
  }

  return `${Math.floor(diffHours / 24)}d ago`;
}

function selectPublicSources(sources: SourceOpsEntry[]): SourceOpsEntry[] {
  return sources
    .filter((source) => (
      source.isSpine
      || source.coverageState === 'gated'
      || source.coverageState === 'accessRequired'
      || source.coverageState === 'stale'
      || source.coverageState === 'unavailable'
    ))
    .sort((a, b) => {
      if (a.isSpine !== b.isSpine) {
        return a.isSpine ? -1 : 1;
      }

      return a.name.localeCompare(b.name);
    });
}

export default async function StatusPage() {
  const { report, isFallback, error } = await getSourceOpsReportWithFallback();
  const sources = selectPublicSources(report.sources);

  const cacheAgeLabel = fromCache && cachedAt
    ? formatRelativeAge(new Date(cachedAt).toISOString())
    : null;

  return (
    <main className="min-h-screen bg-background px-6 py-16 text-foreground">
      <div className="mx-auto max-w-6xl space-y-10">
        <header className="space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-400">
            <ShieldCheck className="h-3.5 w-3.5" />
            Launch-lane status
          </div>
          <div className="max-w-3xl space-y-3">
            <h1 className="text-4xl font-semibold tracking-tight">
              Current source status for the VitalCV wedge.
            </h1>
            <p className="text-base leading-7 text-muted-foreground">
              This page stays narrow on purpose. It reports only the current launch-lane source posture:
              checked, stale, gated, access required, unavailable, or pending. Unsupported sources are not upgraded into stronger claims.
            </p>
          </div>
          <div className={`inline-flex rounded-full border px-4 py-2 text-sm font-semibold ${spineTone(report.spineStatus)}`}>
            Spine status: {report.spineStatus}
          </div>
        </header>

        {isFallback ? (
          <section className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-400" />
              <div className="space-y-2">
                <h2 className="text-lg font-semibold">Showing configured fallback posture</h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  VitalCV could not load the live source report after multiple retries. This page is showing the
                  configured launch-lane posture instead of a blank failure state.
                </p>
                <p className="text-xs text-muted-foreground/70">
                  Fallback generated at {new Date(report.timestamp).toISOString()}
                  {error ? ' · Automated recovery attempted.' : ''}
                </p>
              </div>
            </div>
          </section>
        ) : null}

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Connected today
            </p>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              NPPES identity and OIG / LEIE stay in the live spine. PECOS and institutional authority lanes remain explicit about freshness and access boundaries.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Never implied
            </p>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Unsupported sources do not appear here as verified. Gated or unavailable lanes remain visibly incomplete until a real source run succeeds.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Operator detail
            </p>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Detailed remediation and pilot operations stay in the internal operator surfaces. This page is the public or semi-public truth layer.
            </p>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          {sources.map((source) => (
            <article key={source.sourceId} className="rounded-2xl border border-border bg-card p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold">{source.name}</h2>
                    {source.isSpine ? (
                      <span className="rounded-full border border-border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Spine source
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {source.coverageReason}
                  </p>
                </div>
                <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${coverageTone(source.coverageState)}`}>
                  {source.coverageState}
                </span>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border/80 bg-background px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Last success
                  </p>
                  <p className="mt-2 text-sm font-medium">{formatRelativeAge(source.lastSuccessAt)}</p>
                  {source.lastSuccessAt ? (
                    <p className="mt-1 text-xs text-muted-foreground">{new Date(source.lastSuccessAt).toISOString()}</p>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {isFallback ? 'No live heartbeat available in fallback mode.' : 'No successful fetch recorded yet.'}
                    </p>
                  )}
                </div>
                <div className="rounded-xl border border-border/80 bg-background px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Feature flag
                  </p>
                  <p className="mt-2 text-sm font-medium">
                    {source.featureFlag.key} = {source.featureFlag.enabled ? 'true' : 'false'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Operator status: {source.operatorStatus}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </section>

        {report.alerts.length > 0 ? (
          <section className="rounded-2xl border border-border bg-card p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Current alerts
            </p>
            <div className="mt-4 space-y-2">
              {report.alerts.map((alert: string) => (
                <div key={alert} className="rounded-xl border border-border/80 bg-background px-4 py-3 text-sm leading-6 text-muted-foreground">
                  {alert}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6">
          <h2 className="text-lg font-semibold">Use the live wedge</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            When the source spine is healthy, start with NPI entry, then carry the same truth into passport, employer review, and pilot measurement.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/passport"
              className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-emerald-400"
            >
              Open NPI entry
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/pilot"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground/75 transition hover:text-foreground"
            >
              Request pilot
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

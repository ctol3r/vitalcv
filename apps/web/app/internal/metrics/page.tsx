import Link from 'next/link';

type YcMetrics = {
  totalNPIs: number;
  shareLinks: number;
  verifierViews: number;
  exports: number;
  avgTimeToView: number;
  verifierAcceptances: number;
  estimatedStartDateAccelerationDays: number | null;
};

const DEFAULT_BACKEND_URL = 'http://localhost:4000';

function formatMinutes(minutes: number): string {
  if (!Number.isFinite(minutes)) {
    return '0';
  }

  return `${minutes.toFixed(1)}m`;
}

async function getMetrics(): Promise<YcMetrics | null> {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || DEFAULT_BACKEND_URL;
  try {
    const res = await fetch(`${backendUrl}/api/metrics/yc`, {
      cache: 'no-store',
    });
    if (!res.ok) {
      return null;
    }
    return (await res.json()) as YcMetrics;
  } catch {
    return null;
  }
}

export default async function InternalMetricsPage() {
  const metrics = await getMetrics();

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-16 text-neutral-900">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-[0.2em] text-neutral-400">YC Pilot</p>
        <h1 className="text-3xl font-semibold">Internal metrics</h1>
      </header>

      <section className="mt-10 grid gap-4 sm:grid-cols-2">
        <MetricItem label="Total NPIs" value={metrics?.totalNPIs ?? '—'} />
        <MetricItem label="Share links" value={metrics?.shareLinks ?? '—'} />
        <MetricItem label="Verifier views" value={metrics?.verifierViews ?? '—'} />
        <MetricItem label="Verifier acceptances" value={metrics?.verifierAcceptances ?? '—'} />
        <MetricItem label="Exports" value={metrics?.exports ?? '—'} />
        <MetricItem label="Avg time to view" value={metrics ? formatMinutes(metrics.avgTimeToView) : '—'} />
        <MetricItem
          label="Estimated acceleration (days)"
          value={metrics == null ? '—' : metrics.estimatedStartDateAccelerationDays === null ? 'Insufficient pilot data.' : `${metrics.estimatedStartDateAccelerationDays}d`}
        />
      </section>

      <p className="mt-8 text-sm text-neutral-600">
        This page is read-only and is intended for operational monitoring.
      </p>
      <p className="mt-2 text-sm text-neutral-600">
        <Link href="/internal/yc" className="underline underline-offset-4">
          Open YC dashboard
        </Link>
      </p>
      <p className="mt-2 text-sm text-neutral-600">
        <Link href="/internal/pilots" className="underline underline-offset-4">
          Open Pilot dashboard
        </Link>
      </p>
    </main>
  );
}

function MetricItem({ label, value }: { label: string; value: string | number }) {
  return (
    <article className="rounded border border-neutral-200 p-4">
      <p className="text-xs uppercase tracking-[0.14em] text-neutral-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-neutral-900">{value}</p>
    </article>
  );
}

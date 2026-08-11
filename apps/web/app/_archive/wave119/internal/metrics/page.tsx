import Link from 'next/link';

type YcMetrics = {
  totalNPIs: number;
  shareLinks: number;
  verifierViews: number;
  exports: number;
  avgTimeToView: number;
  estimatedStartDateAccelerationDays: number | null;
};

const DEFAULT_BACKEND_URL = process.env.NEXT_PUBLIC_API_BASE || '';

function normalizeOrganizationId(
  value?: string | string[] | undefined,
): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (Array.isArray(value)) {
    const first = value[0];
    if (typeof first !== 'string') {
      return undefined;
    }
    const trimmed = first.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  return undefined;
}

function formatMinutes(minutes: number): string {
  if (!Number.isFinite(minutes)) {
    return '0';
  }

  return `${minutes.toFixed(1)}m`;
}

async function getMetrics(organizationId?: string): Promise<YcMetrics | null> {
  const query = organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : '';
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || DEFAULT_BACKEND_URL;
  try {
    const res = await fetch(`${backendUrl}/api/metrics/yc${query}`, {
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

export default async function InternalMetricsPage({
  searchParams,
}: {
  searchParams: Promise<{ organizationId?: string | string[] }>;
}) {
  const resolvedSearchParams = await searchParams;
  const organizationId = normalizeOrganizationId(resolvedSearchParams.organizationId);
  const metrics = await getMetrics(organizationId);
  const orgQuery = organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : '';

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-16 text-foreground">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">YC Pilot</p>
        <h1 className="text-3xl font-semibold">Internal metrics</h1>
      </header>

      <section className="mt-10 grid gap-4 sm:grid-cols-2">
        <MetricItem label="Total NPIs" value={metrics?.totalNPIs ?? '—'} />
        <MetricItem label="Share links" value={metrics?.shareLinks ?? '—'} />
        <MetricItem label="Verifier views" value={metrics?.verifierViews ?? '—'} />
        <MetricItem label="Exports" value={metrics?.exports ?? '—'} />
        <MetricItem label="Avg time to view" value={metrics ? formatMinutes(metrics.avgTimeToView) : '—'} />
        <MetricItem
          label="Estimated acceleration (days)"
          value={metrics == null ? '—' : metrics.estimatedStartDateAccelerationDays === null ? 'Insufficient pilot data.' : `${metrics.estimatedStartDateAccelerationDays}d`}
        />
      </section>

      <p className="mt-8 text-sm text-muted-foreground">
        This page is read-only and is intended for operational monitoring.
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        <Link href={`/internal/yc${orgQuery}`} className="underline underline-offset-4">
          Open YC dashboard
        </Link>
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        <Link href={`/internal/pilots${orgQuery}`} className="underline underline-offset-4">
          Open Pilot dashboard
        </Link>
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        <Link href="/internal/pilot-ops" className="underline underline-offset-4">
          Open pilot ops console
        </Link>
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        <Link href={`/internal/enterprise${orgQuery}`} className="underline underline-offset-4">
          Open enterprise signals
        </Link>
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        <Link href="/internal/funnel-debug" className="underline underline-offset-4">
          Open conversion funnel
        </Link>
      </p>
    </main>
  );
}

function MetricItem({ label, value }: { label: string; value: string | number }) {
  return (
    <article className="rounded border border-border p-4">
      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
    </article>
  );
}

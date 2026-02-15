import Link from 'next/link';

type MonitoringFlags = {
  firstViewTracking: boolean;
  artifactGenerationTracking: boolean;
  pilotOrgTracking: boolean;
};

type YcMetrics = {
  totalNPIs: number;
  shareLinks: number;
  verifierViews: number;
  exports: number;
  avgTimeToView: number;
  verifierAcceptances: number;
  estimatedStartDateAccelerationDays: number | null;
  bundlesGenerated: number;
  activePilotOrgs: number;
  estimatedRevenueImpact: number;
  pilotOrgCount: number;
  monitoringFlags: MonitoringFlags;
  verifierConversionRate: number;
  pilotActivationRate: number;
  avgArtifactViewTime: number;
  isDemoMode?: boolean;
};

const DEFAULT_BACKEND_URL = 'http://localhost:4000';

async function fetchYcMetrics(): Promise<YcMetrics | null> {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || DEFAULT_BACKEND_URL;
  try {
    const response = await fetch(`${backendUrl}/api/metrics/yc`, {
      cache: 'no-store',
    });
    if (!response.ok) return null;
    return (await response.json()) as YcMetrics;
  } catch {
    return null;
  }
}

function minutesToHours(minutes: number): string {
  const roundedMinutes = Math.max(0, Number(minutes.toFixed(1)));
  const hours = roundedMinutes / 60;
  if (!Number.isFinite(hours)) return '0h';
  return `${roundedMinutes}m (${hours.toFixed(1)}h)`;
}

function formatCurrency(value: number): string {
  if (!Number.isFinite(value)) return '$0';
  return `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function formatAcceleration(days: number | null): string {
  if (days === null) {
    return 'Insufficient pilot data.';
  }

  return `${days} days`;
}

function percent(value: number): string {
  if (!Number.isFinite(value)) {
    return '0%';
  }
  return `${(value * 100).toFixed(1)}%`;
}

function monitoringLabel(flag: keyof MonitoringFlags): string {
  switch (flag) {
    case 'firstViewTracking':
      return 'First-view tracking';
    case 'artifactGenerationTracking':
      return 'Artifact generation';
    case 'pilotOrgTracking':
      return 'Pilot org tracking';
    default:
      return 'Monitoring flag';
  }
}

export default async function YcDashboardPage() {
  const metrics = await fetchYcMetrics();

  return (
    <main className="min-h-screen bg-white px-6 py-16 text-black">
      <div className="mx-auto max-w-5xl space-y-10">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">YC metrics</p>
          <h1 className="text-3xl font-semibold">YC Pilot Dashboard</h1>
          <p className="text-sm text-neutral-600">
            Black/white readout for pilot readiness and verifier traction.
          </p>
        </header>

        {metrics ? (
          <>
            <section className="grid gap-3 sm:grid-cols-3">
              <Stat label="Total NPIs" value={metrics.totalNPIs} />
              <Stat label="Share links" value={metrics.shareLinks} />
              <Stat label="Verifier views" value={metrics.verifierViews} />
              <Stat label="Pilot orgs" value={metrics.pilotOrgCount} />
              <Stat label="Verifier acceptances" value={metrics.verifierAcceptances} />
              <Stat
                label="Verifier conversion"
                value={percent(metrics.verifierConversionRate)}
              />
              <Stat
                label="Pilot activation"
                value={percent(metrics.pilotActivationRate)}
              />
              <Stat
                label="Avg artifact view time"
                value={minutesToHours(metrics.avgArtifactViewTime)}
              />
              <Stat
                label="Estimated Start-Date Acceleration"
                value={formatAcceleration(metrics.estimatedStartDateAccelerationDays)}
              />
            </section>

            <section className="grid gap-3 sm:grid-cols-3">
              <Stat label="Active pilot orgs" value={metrics.activePilotOrgs} />
              <Stat label="Bundles generated" value={metrics.bundlesGenerated} />
              <Stat label="Estimated revenue impact" value={formatCurrency(metrics.estimatedRevenueImpact)} />
            </section>

            <section className="grid gap-3 sm:grid-cols-3">
              {(Object.entries(metrics.monitoringFlags) as Array<[keyof MonitoringFlags, boolean]>).map(
                ([key, enabled]) => (
                  <Stat
                    key={key}
                    label={monitoringLabel(key)}
                    value={enabled ? 'enabled' : 'disabled'}
                  />
                ),
              )}
            </section>
          </>
        ) : (
          <p className="rounded border border-neutral-300 px-4 py-3 text-sm text-neutral-700">
            Metrics backend unavailable. Configure NEXT_PUBLIC_BACKEND_URL.
          </p>
        )}

        {metrics?.isDemoMode ? (
          <p className="inline-flex items-center rounded-full border border-neutral-400 px-3 py-1 text-xs uppercase tracking-wide text-neutral-600">
            Demo Mode
          </p>
        ) : null}

        <p className="text-xs text-neutral-500">
          No UI experiments. Read-only display only.
        </p>

        <p className="text-sm">
          <Link href="/internal/metrics" className="underline underline-offset-4">
            Open raw internal metrics
          </Link>
        </p>
        <p className="text-sm">
          <Link href="/internal/pilots" className="underline underline-offset-4">
            Open pilot org dashboard
          </Link>
        </p>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <article className="border border-neutral-300 p-4">
      <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-500">{label}</p>
      <p className="mt-3 text-xl font-semibold">{value}</p>
    </article>
  );
}

import Link from 'next/link';

type MonitoringFlags = {
  firstViewTracking: boolean;
  artifactGenerationTracking: boolean;
  pilotOrgTracking: boolean;
};

type FunnelMetrics = {
  totalVerifierViews: number;
  totalPilotClicks: number;
  totalActivations: number;
  conversionRateByVariant: Record<string, number>;
};

type TrustStateDistribution = {
  verified: number;
  verified_monitoring: number;
  expiring_soon: number;
  needs_review: number;
  expired: number;
};

type EnterpriseComplianceSummary = {
  ncqaAlignment: boolean;
  monitoringEnabled: boolean;
  trustLedgerAppendOnly: boolean;
  lifecycleEnforced: boolean;
  multiTenantScoped: boolean;
};

type YcMetrics = {
  totalNPIs: number;
  shareLinks: number;
  verifierViews: number;
  exports: number;
  avgTimeToView: number;
  estimatedStartDateAccelerationDays: number | null;
  bundlesGenerated: number;
  activePilotOrgs: number;
  estimatedRevenueImpact: number;
  pilotOrgCount: number;
  monitoringFlags: MonitoringFlags;
  verifierConversionRate: number;
  pilotActivationRate: number;
  avgArtifactViewTime: number;
  timeFromRegistrationToPilotActivation: number | null;
  isDemoMode?: boolean;
  verifierFunnelMetrics?: FunnelMetrics;
  revenueRecoveryEstimate?: number;
  trustStateDistribution?: TrustStateDistribution;
  monitoringDeltaFrequency?: number;
  enterpriseComplianceSummary?: EnterpriseComplianceSummary;
  pilotReady?: boolean;
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

async function fetchYcMetrics(organizationId?: string): Promise<YcMetrics | null> {
  const query = organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : '';
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || DEFAULT_BACKEND_URL;
  try {
    const response = await fetch(`${backendUrl}/api/metrics/yc${query}`, {
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

function formatDays(days: number | null): string {
  if (days === null) {
    return 'No completed pilot activations yet.';
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

export default async function YcDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ organizationId?: string | string[] }>;
}) {
  const resolvedSearchParams = await searchParams;
  const organizationId = normalizeOrganizationId(resolvedSearchParams.organizationId);
  const metrics = await fetchYcMetrics(organizationId);
  const orgQuery = organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : '';

  return (
    <main className="min-h-screen bg-background px-6 py-16 text-foreground">
      <div className="mx-auto max-w-5xl space-y-10">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">YC metrics</p>
          <h1 className="text-3xl font-semibold">YC Pilot Dashboard</h1>
          <p className="text-sm text-muted-foreground">
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
                label="Avg reg→pilot activation"
                value={formatDays(metrics.timeFromRegistrationToPilotActivation)}
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

            {metrics.verifierFunnelMetrics ? (
              <section>
                <p className="mb-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">Verifier funnel</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Stat label="Funnel views" value={metrics.verifierFunnelMetrics.totalVerifierViews} />
                  <Stat label="Pilot clicks" value={metrics.verifierFunnelMetrics.totalPilotClicks} />
                  <Stat label="Activations" value={metrics.verifierFunnelMetrics.totalActivations} />
                </div>
              </section>
            ) : null}

            {metrics.trustStateDistribution ? (
              <section>
                <p className="mb-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">Trust state distribution</p>
                <div className="grid gap-3 sm:grid-cols-5">
                  <Stat label="Verified" value={metrics.trustStateDistribution.verified} />
                  <Stat label="Monitoring" value={metrics.trustStateDistribution.verified_monitoring} />
                  <Stat label="Expiring soon" value={metrics.trustStateDistribution.expiring_soon} />
                  <Stat label="Needs review" value={metrics.trustStateDistribution.needs_review} />
                  <Stat label="Expired" value={metrics.trustStateDistribution.expired} />
                </div>
              </section>
            ) : null}

            <section className="grid gap-3 sm:grid-cols-3">
              {typeof metrics.revenueRecoveryEstimate === 'number' ? (
                <Stat label="Revenue recovery estimate" value={formatCurrency(metrics.revenueRecoveryEstimate)} />
              ) : null}
              {typeof metrics.monitoringDeltaFrequency === 'number' ? (
                <Stat label="Monitoring delta events" value={metrics.monitoringDeltaFrequency} />
              ) : null}
              {typeof metrics.pilotReady === 'boolean' ? (
                <Stat label="Pilot ready" value={metrics.pilotReady ? 'true' : 'false'} />
              ) : null}
            </section>

            {metrics.enterpriseComplianceSummary ? (
              <section>
                <p className="mb-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">Enterprise compliance</p>
                <div className="grid gap-3 sm:grid-cols-5">
                  {(Object.entries(metrics.enterpriseComplianceSummary) as Array<[string, boolean]>).map(
                    ([key, value]) => (
                      <Stat key={key} label={key} value={value ? 'pass' : 'fail'} />
                    ),
                  )}
                </div>
              </section>
            ) : null}
          </>
        ) : (
          <p className="rounded border border-border px-4 py-3 text-sm text-muted-foreground">
            Metrics backend unavailable. Configure NEXT_PUBLIC_BACKEND_URL.
          </p>
        )}

        {metrics?.isDemoMode ? (
          <p className="inline-flex items-center rounded-full border border-border px-3 py-1 text-xs uppercase tracking-wide text-muted-foreground">
            Demo Mode
          </p>
        ) : null}

        <p className="text-xs text-muted-foreground">
          No UI experiments. Read-only display only.
        </p>

        <p className="text-sm">
          <Link href={`/internal/metrics${orgQuery}`} className="underline underline-offset-4">
            Open raw internal metrics
          </Link>
        </p>
        <p className="text-sm">
          <Link href={`/internal/pilots${orgQuery}`} className="underline underline-offset-4">
            Open pilot org dashboard
          </Link>
        </p>
        <p className="text-sm">
          <Link href={`/internal/enterprise${orgQuery}`} className="underline underline-offset-4">
            Open enterprise signals
          </Link>
        </p>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <article className="border border-border p-4">
      <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-3 text-xl font-semibold">{value}</p>
    </article>
  );
}

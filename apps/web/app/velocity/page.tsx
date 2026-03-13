'use client';

import React from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Building2,
  Clock3,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Zap,
} from 'lucide-react';

type TrendPoint = {
  month: string;
  avgDays: number | null;
  sampleSize: number;
};

type DistributionPoint = {
  band: 'L0' | 'L1' | 'L2' | 'L3';
  count: number;
  rate: number;
};

type CountPoint = {
  month: string;
  count: number;
};

type StartAccelerationPoint = {
  month: string;
  avgDays: number | null;
  daysSaved: number | null;
  sampleSize: number;
};

type VelocitySummary = {
  scope: 'system' | 'organization';
  avgTimeToStartDays: number | null;
  timeToStartSampleSize: number;
  insufficientDataReason?: string;
  industryAvgDays: number;
  compressionRatio: number | null;
  credentialReadinessRate: number;
  monitoringCoverageRate: number;
  verificationReuseRate: number;
  totalApplications: number;
  totalAccepted: number;
  totalDecisionCapsules: number;
  trend: TrendPoint[];
  readinessDistribution: DistributionPoint[];
  verificationReuseEvents: CountPoint[];
  monitoringAlerts: CountPoint[];
  startAccelerationEstimates: StartAccelerationPoint[];
  computedAt: string;
};

type OrganizationVelocityDashboard = VelocitySummary & {
  scope: 'organization';
  organization: {
    organizationId: string;
    organizationName: string;
  };
  systemComparison: {
    avgTimeToStartDays: number | null;
    timeToStartSampleSize: number;
    credentialReadinessRate: number;
    monitoringCoverageRate: number;
    verificationReuseRate: number;
  };
};

type EmployerProfile = {
  organizationId: string;
};

function formatValue(value: number | null, suffix = '', decimals = 1): string {
  if (value === null) {
    return '--';
  }
  return `${value.toFixed(decimals)}${suffix}`;
}

function MetricCard({
  label,
  value,
  meta,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  meta?: string;
  icon: React.ElementType;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className={`mb-3 inline-flex rounded-xl p-2 ${accent}`}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-white/40">{label}</p>
      {meta ? <p className="mt-2 text-xs text-white/45">{meta}</p> : null}
    </div>
  );
}

function TrendChart({ data, reference }: { data: TrendPoint[]; reference: number }) {
  const plotted = data.filter((point) => point.avgDays !== null);
  if (plotted.length === 0) {
    return <div className="flex h-44 items-center justify-center text-sm text-white/35">No attested start data yet</div>;
  }

  const width = 640;
  const height = 180;
  const padding = { top: 20, right: 20, bottom: 30, left: 44 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const values = plotted.map((point) => point.avgDays ?? 0);
  const maxValue = Math.max(reference, ...values, 10);
  const minValue = 0;
  const xStep = plotted.length > 1 ? innerWidth / (plotted.length - 1) : innerWidth;

  const xFor = (index: number) => padding.left + index * xStep;
  const yFor = (value: number) => padding.top + innerHeight - ((value - minValue) / (maxValue - minValue || 1)) * innerHeight;
  const linePoints = plotted.map((point, index) => `${xFor(index)},${yFor(point.avgDays ?? 0)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-44 w-full" aria-label="Average time-to-start trend">
      {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
        const value = Math.round(minValue + (maxValue - minValue) * tick);
        const y = padding.top + innerHeight - tick * innerHeight;
        return (
          <g key={tick}>
            <line x1={padding.left} y1={y} x2={padding.left + innerWidth} y2={y} stroke="rgba(255,255,255,0.06)" />
            <text x={padding.left - 8} y={y + 4} fontSize="9" textAnchor="end" fill="rgba(255,255,255,0.4)">
              {value}d
            </text>
          </g>
        );
      })}

      <line
        x1={padding.left}
        y1={yFor(reference)}
        x2={padding.left + innerWidth}
        y2={yFor(reference)}
        stroke="rgba(248,113,113,0.55)"
        strokeDasharray="4 4"
      />

      <polyline
        points={linePoints}
        fill="none"
        stroke="#22d3ee"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {plotted.map((point, index) => (
        <g key={point.month}>
          <circle cx={xFor(index)} cy={yFor(point.avgDays ?? 0)} r="3.5" fill="#22d3ee" />
          <text
            x={xFor(index)}
            y={padding.top + innerHeight + 16}
            fontSize="9"
            textAnchor="middle"
            fill="rgba(255,255,255,0.45)"
          >
            {point.month.slice(5)}
          </text>
        </g>
      ))}
    </svg>
  );
}

function DistributionChart({ data }: { data: DistributionPoint[] }) {
  return (
    <div className="space-y-3">
      {data.map((point) => (
        <div key={point.band} className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-white/55">
            <span className="font-semibold text-white/75">{point.band}</span>
            <span>{point.count} clinicians</span>
          </div>
          <div className="h-2 rounded-full bg-white/6">
            <div
              className="h-2 rounded-full bg-emerald-400"
              style={{ width: `${Math.max(point.rate * 100, point.count > 0 ? 6 : 0)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function CountBars({ data, color }: { data: CountPoint[]; color: string }) {
  const max = Math.max(...data.map((point) => point.count), 1);
  return (
    <div className="grid grid-cols-12 gap-2">
      {data.map((point) => (
        <div key={point.month} className="flex flex-col items-center gap-2">
          <div className="flex h-28 items-end">
            <div
              className={`w-4 rounded-t-full ${color}`}
              style={{ height: `${(point.count / max) * 100}%`, minHeight: point.count > 0 ? 8 : 2 }}
            />
          </div>
          <span className="text-[10px] text-white/35">{point.month.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

function AccelerationTable({ data }: { data: StartAccelerationPoint[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left text-xs uppercase tracking-[0.14em] text-white/35">
            <th className="pb-2 pr-4 font-medium">Month</th>
            <th className="pb-2 pr-4 font-medium text-right">Avg Days</th>
            <th className="pb-2 pr-4 font-medium text-right">Days Saved</th>
            <th className="pb-2 text-right font-medium">Samples</th>
          </tr>
        </thead>
        <tbody>
          {data.map((point) => (
            <tr key={point.month} className="border-b border-white/5">
              <td className="py-2.5 pr-4 font-medium text-white/80">{point.month}</td>
              <td className="py-2.5 pr-4 text-right text-white/60">
                {point.avgDays === null ? '--' : `${point.avgDays.toFixed(1)}d`}
              </td>
              <td className="py-2.5 pr-4 text-right">
                <span className={point.daysSaved !== null && point.daysSaved >= 0 ? 'text-emerald-300' : 'text-red-300'}>
                  {point.daysSaved === null ? '--' : `${point.daysSaved.toFixed(1)}d`}
                </span>
              </td>
              <td className="py-2.5 text-right text-white/60">{point.sampleSize}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function VelocityPage() {
  const [system, setSystem] = useState<VelocitySummary | null>(null);
  const [organization, setOrganization] = useState<OrganizationVelocityDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [orgLoading, setOrgLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const systemRes = await fetch('/api/velocity');
        const systemData = await systemRes.json();
        if (!systemRes.ok) {
          throw new Error(systemData.error ?? 'Failed to load velocity dashboard');
        }
        if (!cancelled) {
          setSystem(systemData as VelocitySummary);
        }

        setOrgLoading(true);
        const profileRes = await fetch('/api/employer/profile', { cache: 'no-store' });
        if (profileRes.ok) {
          const profile = await profileRes.json() as EmployerProfile;
          if (profile.organizationId) {
            const orgRes = await fetch(`/api/velocity/${encodeURIComponent(profile.organizationId)}`, { cache: 'no-store' });
            const orgData = await orgRes.json().catch(() => null);
            if (orgRes.ok && !cancelled) {
              setOrganization(orgData as OrganizationVelocityDashboard);
            }
          }
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load velocity dashboard');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setOrgLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const summary = system;
  const headline = useMemo(() => {
    if (!summary) {
      return { current: '--', delta: '--' };
    }
    return {
      current: formatValue(summary.avgTimeToStartDays, ' days', 1),
      delta: summary.compressionRatio === null ? '--' : `${summary.compressionRatio.toFixed(2)}x faster`,
    };
  }, [summary]);

  return (
    <main className="min-h-screen bg-[#080e1a] text-white">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <header className="mb-12 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-400/10 px-4 py-1.5 text-xs font-medium text-cyan-300">
            <Zap className="h-3 w-3" />
            Time-to-Start Intelligence
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Velocity Dashboard</h1>
          <p className="mt-3 text-base text-white/50">
            Real trust-state snapshots, attested starts, and reusable proof metrics aggregated for hospital operators.
          </p>
        </header>

        {loading ? (
          <div className="flex items-center justify-center py-32">
            <RefreshCw className="h-7 w-7 animate-spin text-cyan-400" />
          </div>
        ) : null}

        {error ? (
          <div className="rounded-xl border border-red-400/20 bg-red-400/10 px-6 py-4 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        {summary ? (
          <>
            <section
              className="mb-10 rounded-3xl border border-white/10 p-8 text-center"
              style={{
                background:
                  'linear-gradient(135deg, rgba(34,211,238,0.08) 0%, rgba(8,14,26,0.6) 100%)',
              }}
            >
              <p className="mb-4 text-sm font-medium uppercase tracking-[0.22em] text-white/40">Average Time-to-Start</p>
              <div className="flex flex-wrap items-center justify-center gap-4 text-5xl font-black sm:text-7xl">
                <span className="text-red-400">{summary.industryAvgDays} days</span>
                <TrendingUp className="h-10 w-10 rotate-180 text-white/30 sm:h-14 sm:w-14" />
                <span className="text-cyan-300">{headline.current}</span>
              </div>
              <p className="mt-3 text-sm text-white/40">Industry average → VitalCV actual attested starts</p>
              <div className="mt-6 inline-flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-6 py-2.5">
                <Zap className="h-5 w-5 text-emerald-300" />
                <span className="text-xl font-extrabold text-emerald-300">{headline.delta}</span>
              </div>
              {summary.insufficientDataReason ? (
                <p className="mt-4 text-xs italic text-white/35">{summary.insufficientDataReason}</p>
              ) : (
                <p className="mt-4 text-xs text-white/35">
                  {summary.timeToStartSampleSize} attested starts in sample
                </p>
              )}
            </section>

            <section className="mb-10 grid grid-cols-1 gap-4 md:grid-cols-4">
              <MetricCard
                label="Credential Readiness"
                value={`${(summary.credentialReadinessRate * 100).toFixed(1)}%`}
                meta="Latest persisted trust bands at L2-L3"
                icon={ShieldCheck}
                accent="bg-cyan-400/15 text-cyan-300"
              />
              <MetricCard
                label="Monitoring Coverage"
                value={`${(summary.monitoringCoverageRate * 100).toFixed(1)}%`}
                meta="Monitored verification artifacts in scope"
                icon={Activity}
                accent="bg-violet-400/15 text-violet-300"
              />
              <MetricCard
                label="Verification Reuse"
                value={`${(summary.verificationReuseRate * 100).toFixed(1)}%`}
                meta={`${summary.totalDecisionCapsules} decision capsules analyzed`}
                icon={Zap}
                accent="bg-emerald-400/15 text-emerald-300"
              />
              <MetricCard
                label="Attested Starts"
                value={String(summary.timeToStartSampleSize)}
                meta={`${summary.totalApplications} applications · ${summary.totalAccepted} accepted`}
                icon={Clock3}
                accent="bg-amber-400/15 text-amber-300"
              />
            </section>

            <section className="mb-10 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="mb-1 text-base font-semibold">Historical Trend</h2>
              <p className="mb-5 text-xs text-white/35">Trailing 12 months of actual attested acceptance-to-start durations</p>
              <TrendChart data={summary.trend} reference={summary.industryAvgDays} />
            </section>

            <section className="mb-10 grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                <h2 className="mb-1 text-base font-semibold">Credential Readiness Distribution</h2>
                <p className="mb-5 text-xs text-white/35">Latest persisted trust-state band per clinician</p>
                <DistributionChart data={summary.readinessDistribution} />
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                <h2 className="mb-1 text-base font-semibold">Verification Reuse Events</h2>
                <p className="mb-5 text-xs text-white/35">Monthly capsule events that reused previously verified artifacts</p>
                <CountBars data={summary.verificationReuseEvents} color="bg-emerald-400/80" />
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                <h2 className="mb-1 text-base font-semibold">Monitoring Alerts</h2>
                <p className="mb-5 text-xs text-white/35">Monthly trust alert records for clinicians in scope</p>
                <CountBars data={summary.monitoringAlerts} color="bg-amber-400/80" />
              </div>
            </section>

            <section className="mb-10 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="mb-1 text-base font-semibold">Start Acceleration Estimates</h2>
              <p className="mb-5 text-xs text-white/35">Arithmetic delta versus the 94-day industry baseline</p>
              <AccelerationTable data={summary.startAccelerationEstimates} />
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold">Organization Drilldown</h2>
                  <p className="text-xs text-white/35">
                    Signed-in employer users see a private comparison against the system baseline.
                  </p>
                </div>
                {orgLoading ? <RefreshCw className="h-4 w-4 animate-spin text-white/35" /> : null}
              </div>

              {organization ? (
                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/6 p-5">
                    <div className="mb-3 flex items-center gap-2 text-cyan-300">
                      <Building2 className="h-4 w-4" />
                      <span className="text-sm font-semibold">{organization.organization.organizationName}</span>
                    </div>
                    <p className="text-2xl font-bold text-white">
                      {organization.avgTimeToStartDays === null ? '--' : `${organization.avgTimeToStartDays.toFixed(1)} days`}
                    </p>
                    <p className="mt-2 text-xs text-white/45">
                      {organization.timeToStartSampleSize} attested starts · readiness {(organization.credentialReadinessRate * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                    <p className="text-sm font-semibold text-white">System comparison</p>
                    <div className="mt-3 space-y-2 text-sm text-white/60">
                      <div className="flex items-center justify-between">
                        <span>Average time-to-start</span>
                        <span>{organization.systemComparison.avgTimeToStartDays === null ? '--' : `${organization.systemComparison.avgTimeToStartDays.toFixed(1)} days`}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Readiness rate</span>
                        <span>{(organization.systemComparison.credentialReadinessRate * 100).toFixed(1)}%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Monitoring coverage</span>
                        <span>{(organization.systemComparison.monitoringCoverageRate * 100).toFixed(1)}%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Reuse rate</span>
                        <span>{(organization.systemComparison.verificationReuseRate * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="mt-5 text-sm text-white/45">
                  Sign in with an employer workspace to unlock your organization-level readiness and start-speed metrics.
                </p>
              )}
            </section>

            <p className="mt-8 text-center text-xs text-white/25">
              Computed at {new Date(summary.computedAt).toLocaleString()}
            </p>
          </>
        ) : null}
      </div>
    </main>
  );
}

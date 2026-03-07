'use client';

/**
 * NetworkTelemetryIntelligence.tsx — Wave 140: Network Telemetry Intelligence
 *
 * Live charts for the trust network:
 *   - Credential verifications sparkline + success rate
 *   - Revocation rate sparkline + trend delta
 *   - Issuer activity breakdown table
 *   - Decision capsule generation sparkline
 *
 * Data: GET /api/network/telemetry
 * Refresh: every 60 seconds
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  Award,
  Building,
  CheckCircle,
  GitBranch,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import TimeSeriesChart, { type TimeSeriesPoint } from './TimeSeriesChart';
import { getApiBase } from '@/lib/api';

// ── Types ──────────────────────────────────────────────────────────────────────

interface TimeBucket {
  date: string;
  value: number;
}

interface VerificationRate {
  totalVerifications: number;
  successfulVerifications: number;
  successRate: number;
  dailyBuckets: TimeBucket[];
  windowDays: number;
}

interface RevocationRate {
  totalCredentials: number;
  totalRevoked: number;
  revocationRate: number;
  dailyBuckets: TimeBucket[];
  trendDelta: number;
}

interface IssuerActivity {
  issuerId: string;
  issuerName: string;
  credentialsIssued: number;
  activeCredentials: number;
  revokedCredentials: number;
  activityScore: number;
}

interface DecisionCapsuleRate {
  totalCapsules: number;
  dailyBuckets: TimeBucket[];
  avgPerDay: number;
}

interface NetworkTelemetrySummary {
  verificationRate: VerificationRate;
  revocationRate: RevocationRate;
  issuerActivity: {
    issuers: IssuerActivity[];
    totalActive: number;
    topIssuerId: string | null;
  };
  decisionCapsuleRate: DecisionCapsuleRate;
  computedAt: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function bucketsToSeries(buckets: TimeBucket[]): TimeSeriesPoint[] {
  return buckets.map((b) => ({
    t: new Date(b.date).getTime(),
    v: b.value,
  }));
}

function trendColor(delta: number): string {
  if (delta > 0) return 'text-red-400';
  if (delta < 0) return 'text-emerald-400';
  return 'text-zinc-500';
}

// ── Chart Card ────────────────────────────────────────────────────────────────

function ChartCard({
  icon: Icon,
  title,
  value,
  sub,
  series,
  color,
  trend,
  trendLabel,
}: {
  icon: React.ElementType;
  title: string;
  value: string | number;
  sub?: string;
  series: TimeSeriesPoint[];
  color: string;
  trend?: 'up' | 'down' | 'flat';
  trendLabel?: string;
}) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : null;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-zinc-500" />
        <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">{title}</span>
      </div>

      <div className="flex items-end justify-between">
        <div>
          <p className="text-2xl font-bold text-zinc-200">{value}</p>
          {sub && <p className="text-[10px] text-zinc-600 mt-0.5">{sub}</p>}
        </div>
        {TrendIcon && trendLabel && (
          <div className={`flex items-center gap-1 text-[10px] ${trendColor(trend === 'up' ? 1 : -1)}`}>
            <TrendIcon className="h-3 w-3" />
            {trendLabel}
          </div>
        )}
      </div>

      <TimeSeriesChart
        data={series}
        color={color}
        height={52}
        className="w-full"
      />
    </div>
  );
}

// ── Issuer Activity Table ─────────────────────────────────────────────────────

function IssuerActivityTable({ issuers }: { issuers: IssuerActivity[] }) {
  if (issuers.length === 0) {
    return (
      <div className="text-center py-4">
        <Building className="h-5 w-5 text-zinc-700 mx-auto mb-1.5" />
        <p className="text-[10px] text-zinc-600">No issuer data</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {issuers.slice(0, 6).map((issuer) => {
        const scoreColor =
          issuer.activityScore >= 80
            ? 'text-emerald-400'
            : issuer.activityScore >= 60
              ? 'text-blue-400'
              : 'text-amber-400';

        return (
          <div key={issuer.issuerId} className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-zinc-300 truncate">{issuer.issuerName}</span>
                <span className={`text-[10px] font-mono shrink-0 ml-2 ${scoreColor}`}>
                  {issuer.activityScore}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${issuer.activityScore}%`,
                      background:
                        issuer.activityScore >= 80
                          ? '#10b981'
                          : issuer.activityScore >= 60
                            ? '#60a5fa'
                            : '#f59e0b',
                    }}
                  />
                </div>
                <div className="flex items-center gap-2 text-[9px] shrink-0">
                  <span className="text-emerald-400">{issuer.activeCredentials}✓</span>
                  {issuer.revokedCredentials > 0 && (
                    <span className="text-red-400">{issuer.revokedCredentials}✗</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function NetworkTelemetryIntelligence({ windowDays = 30 }: { windowDays?: number }) {
  const [data, setData] = useState<NetworkTelemetrySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const apiBase = getApiBase();

  const fetchTelemetry = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`${apiBase}/api/network/telemetry?days=${windowDays}`);
      if (res.ok) {
        const json = await res.json() as NetworkTelemetrySummary;
        setData(json);
        setLastRefresh(new Date());
      } else {
        setError(`API ${res.status}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, [apiBase, windowDays]);

  useEffect(() => {
    fetchTelemetry();
    timerRef.current = setInterval(fetchTelemetry, 60_000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchTelemetry]);

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800 bg-zinc-900/60">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-blue-400" />
          <span className="text-sm font-semibold text-zinc-200">Network Telemetry Intelligence</span>
          <span className="text-[10px] font-mono text-zinc-600">{windowDays}d window</span>
        </div>
        <div className="flex items-center gap-2">
          {lastRefresh && (
            <span className="text-[10px] text-zinc-600">
              {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          <button
            type="button"
            onClick={fetchTelemetry}
            className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-5 py-2 bg-amber-500/10 border-b border-amber-500/20 text-xs text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {error} — showing cached data
        </div>
      )}

      {loading && !data ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-5 animate-pulse">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 rounded-xl bg-zinc-800/40" />
          ))}
        </div>
      ) : data ? (
        <div className="p-5 space-y-5">
          {/* Sparkline charts — 4 across */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-3"
          >
            {/* Credential Verifications */}
            <ChartCard
              icon={CheckCircle}
              title="Verifications"
              value={data.verificationRate.totalVerifications}
              sub={`${data.verificationRate.successRate}% success rate`}
              series={bucketsToSeries(data.verificationRate.dailyBuckets)}
              color="#10b981"
              trend={data.verificationRate.successRate >= 80 ? 'up' : 'down'}
              trendLabel={`${data.verificationRate.successRate}%`}
            />

            {/* Revocations */}
            <ChartCard
              icon={AlertTriangle}
              title="Revocations"
              value={`${data.revocationRate.revocationRate}%`}
              sub={`${data.revocationRate.totalRevoked} of ${data.revocationRate.totalCredentials} total`}
              series={bucketsToSeries(data.revocationRate.dailyBuckets)}
              color={data.revocationRate.revocationRate > 10 ? '#ef4444' : '#f59e0b'}
              trend={data.revocationRate.trendDelta > 0 ? 'up' : data.revocationRate.trendDelta < 0 ? 'down' : 'flat'}
              trendLabel={
                data.revocationRate.trendDelta !== 0
                  ? `${data.revocationRate.trendDelta > 0 ? '+' : ''}${data.revocationRate.trendDelta} vs prior period`
                  : undefined
              }
            />

            {/* Issuer Activity */}
            <ChartCard
              icon={Building}
              title="Active Credentials"
              value={data.issuerActivity.totalActive}
              sub={`across ${data.issuerActivity.issuers.length} issuers`}
              series={bucketsToSeries(data.verificationRate.dailyBuckets)}
              color="#8b5cf6"
            />

            {/* Decision Capsules */}
            <ChartCard
              icon={GitBranch}
              title="Decision Capsules"
              value={data.decisionCapsuleRate.totalCapsules}
              sub={`${data.decisionCapsuleRate.avgPerDay}/day avg`}
              series={bucketsToSeries(data.decisionCapsuleRate.dailyBuckets)}
              color="#06b6d4"
            />
          </motion.div>

          {/* Issuer activity table */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4"
          >
            <div className="flex items-center gap-2 mb-3">
              <Award className="h-3.5 w-3.5 text-zinc-500" />
              <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
                Issuer Activity Breakdown
              </p>
            </div>
            <IssuerActivityTable issuers={data.issuerActivity.issuers} />
          </motion.div>
        </div>
      ) : (
        <div className="flex items-center justify-center h-32">
          <p className="text-xs text-zinc-600">No telemetry data available</p>
        </div>
      )}
    </div>
  );
}

'use client';

/**
 * OpsTelemetryPanel — Wave CC-146: Operator Telemetry Surface
 *
 * Live metrics connected to real backend APIs:
 *   - Verification rate   → GET /api/network/telemetry/verifications
 *   - Revocation rate     → GET /api/network/telemetry/revocations
 *   - Issuer health       → GET /api/network/telemetry/issuers
 *   - Cluster status      → GET /api/network/global/performance
 *
 * Renders 4 MetricCards with sparklines. Auto-refreshes every 60s.
 */

import MetricCard, { type MetricCardProps } from '@/components/telemetry/MetricCard';
import type { TimeSeriesPoint } from '@/components/telemetry/TimeSeriesChart';
import { Cpu, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

interface TimeBucket {
  date: string;
  value: number;
}

interface VerificationData {
  totalVerifications: number;
  successfulVerifications: number;
  successRate: number;
  dailyBuckets: TimeBucket[];
}

interface RevocationData {
  totalCredentials: number;
  totalRevoked: number;
  revocationRate: number;
  dailyBuckets: TimeBucket[];
  trendDelta: number;
}

interface IssuerActivityItem {
  issuerId: string;
  issuerName: string;
  activityScore: number;
}

interface IssuerData {
  issuers: IssuerActivityItem[];
  totalActive: number;
}

interface ClusterPerformance {
  renderTimeMs?: number;
  nodeCount?: number;
  edgeCount?: number;
  clusterCount?: number;
  fps?: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function bucketsToSeries(buckets: TimeBucket[]): TimeSeriesPoint[] {
  return buckets.map((b) => ({ t: new Date(b.date).getTime(), v: b.value }));
}

function avgScore(issuers: IssuerActivityItem[]): number {
  if (issuers.length === 0) return 0;
  return Math.round(issuers.reduce((s, i) => s + i.activityScore, 0) / issuers.length);
}

// ── Component ────────────────────────────────────────────────────────────────

export default function OpsTelemetryPanel() {
  const [verifications, setVerifications] = useState<VerificationData | null>(null);
  const [revocations, setRevocations] = useState<RevocationData | null>(null);
  const [issuerData, setIssuerData] = useState<IssuerData | null>(null);
  const [cluster, setCluster] = useState<ClusterPerformance | null>(null);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAll = useCallback(async () => {
    const headers = { Accept: 'application/json' };
    const results = await Promise.allSettled([
      fetch('/api/network/telemetry/verifications', { headers }),
      fetch('/api/network/telemetry/revocations', { headers }),
      fetch('/api/network/telemetry/issuers', { headers }),
      fetch('/api/network/global/performance', { headers }),
    ]);

    if (results[0].status === 'fulfilled' && results[0].value.ok) {
      setVerifications(await results[0].value.json());
    }
    if (results[1].status === 'fulfilled' && results[1].value.ok) {
      setRevocations(await results[1].value.json());
    }
    if (results[2].status === 'fulfilled' && results[2].value.ok) {
      setIssuerData(await results[2].value.json());
    }
    if (results[3].status === 'fulfilled' && results[3].value.ok) {
      setCluster(await results[3].value.json());
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    timerRef.current = setInterval(fetchAll, 60_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [fetchAll]);

  // ── Build metric cards ──────────────────────────────────────────────────

  const metrics: MetricCardProps[] = [];

  // 1. Verification rate
  if (verifications) {
    metrics.push({
      title: 'Verification Rate',
      value: `${verifications.successRate}%`,
      trend: verifications.successRate >= 90 ? 'up' : verifications.successRate >= 70 ? 'flat' : 'down',
      delta: `${verifications.totalVerifications} total`,
      series: bucketsToSeries(verifications.dailyBuckets),
      color: '#10b981',
    });
  } else {
    metrics.push({ title: 'Verification Rate', value: '—', trend: 'flat', color: '#10b981' });
  }

  // 2. Revocation rate
  if (revocations) {
    const trendDir = revocations.trendDelta > 0 ? 'up' as const : revocations.trendDelta < 0 ? 'down' as const : 'flat' as const;
    metrics.push({
      title: 'Revocation Rate',
      value: `${revocations.revocationRate}%`,
      trend: trendDir,
      trendPositive: false, // up is bad for revocations
      delta: revocations.trendDelta !== 0
        ? `${revocations.trendDelta > 0 ? '+' : ''}${revocations.trendDelta}%`
        : undefined,
      series: bucketsToSeries(revocations.dailyBuckets),
      color: revocations.revocationRate > 10 ? '#ef4444' : '#f59e0b',
    });
  } else {
    metrics.push({ title: 'Revocation Rate', value: '—', trend: 'flat', color: '#f59e0b' });
  }

  // 3. Issuer health
  if (issuerData) {
    const avg = avgScore(issuerData.issuers);
    metrics.push({
      title: 'Issuer Health',
      value: avg,
      unit: 'avg',
      trend: avg >= 80 ? 'up' : avg >= 60 ? 'flat' : 'down',
      delta: `${issuerData.issuers.length} issuers`,
      color: '#8b5cf6',
    });
  } else {
    metrics.push({ title: 'Issuer Health', value: '—', trend: 'flat', color: '#8b5cf6' });
  }

  // 4. Cluster status
  if (cluster) {
    metrics.push({
      title: 'Cluster Status',
      value: cluster.nodeCount ?? 0,
      unit: 'nodes',
      trend: 'flat',
      delta: cluster.clusterCount ? `${cluster.clusterCount} clusters` : undefined,
      color: '#06b6d4',
    });
  } else {
    metrics.push({ title: 'Cluster Status', value: '—', trend: 'flat', color: '#06b6d4' });
  }

  return (
    <div className="rounded-2xl border border-vt-neutral-800 bg-vt-surface-ops-raised/30 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-vt-neutral-800 bg-vt-surface-ops-raised/60">
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-cyan-400" />
          <span className="heading-sm text-vt-neutral-100">Operator Telemetry</span>
          <span className="code text-vt-neutral-600 border border-vt-neutral-800 rounded px-1.5 py-0.5">
            CC-146
          </span>
        </div>
        <button
          type="button"
          onClick={fetchAll}
          className="p-1 text-vt-neutral-400 hover:text-vt-neutral-100 transition-colors"
          title="Refresh telemetry"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading && !verifications ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-5 animate-pulse">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-vt-neutral-800/40" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-5">
          {metrics.map((m) => (
            <MetricCard key={m.title} {...m} />
          ))}
        </div>
      )}
    </div>
  );
}

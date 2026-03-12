'use client';

/**
 * CapacityPanel.tsx — Wave 240
 *
 * Displays the organization's Capacity Score as a glass-card dashboard panel:
 * - Circular progress ring (0-100)
 * - "X more physicians can start this quarter" headline
 * - Key metrics: Open Positions, Pipeline Depth, Avg Review Days,
 *   Credential Readiness %, Starts Enabled
 */

import { useEffect, useState } from 'react';
import { Activity, Briefcase, Clock, ShieldCheck, Users } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────

interface CapacityScore {
  organizationId: string;
  computedAt: string;
  openPositions: number;
  pipelineDepth: number;
  acceptedThisQuarter: number;
  avgReviewDays: number;
  credentialReadiness: number;
  capacityScore: number;
  startsEnabled: number;
}

// ─── Circular Ring ────────────────────────────────────────────

function CircularRing({ score }: { score: number }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const clampedScore = Math.min(100, Math.max(0, score));
  const strokeDashoffset = circumference * (1 - clampedScore / 100);

  const color =
    clampedScore >= 70
      ? '#10b981' // emerald-500
      : clampedScore >= 40
        ? '#f59e0b' // amber-500
        : '#ef4444'; // red-500

  return (
    <div className="relative flex items-center justify-center" style={{ width: 132, height: 132 }}>
      <svg width="132" height="132" viewBox="0 0 132 132" className="rotate-[-90deg]">
        {/* Track */}
        <circle
          cx="66"
          cy="66"
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="10"
        />
        {/* Progress */}
        <circle
          cx="66"
          cy="66"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      {/* Score text */}
      <div className="absolute flex flex-col items-center">
        <span className="text-3xl font-black text-white leading-none">{clampedScore}</span>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mt-0.5">
          score
        </span>
      </div>
    </div>
  );
}

// ─── Metric Row ───────────────────────────────────────────────

function MetricRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0">
      <div className="flex items-center gap-2 text-white/50">
        <Icon className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="text-xs">{label}</span>
      </div>
      <span className="text-sm font-semibold text-white">{value}</span>
    </div>
  );
}

// ─── CapacityPanel ────────────────────────────────────────────

interface CapacityPanelProps {
  organizationId: string;
  /** If true, fetches from /api/capacity/system instead (no org auth needed). */
  systemMode?: boolean;
}

export default function CapacityPanel({ organizationId, systemMode = false }: CapacityPanelProps) {
  const [data, setData] = useState<CapacityScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const url = systemMode
      ? '/api/capacity/system'
      : `/api/capacity/${organizationId}`;

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<CapacityScore>;
      })
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [organizationId, systemMode]);

  return (
    <div
      className="rounded-2xl border border-white/8 p-6"
      style={{
        background: 'rgba(255,255,255,0.03)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-5">
        <Activity className="h-4 w-4 text-emerald-400" />
        <h3 className="text-sm font-bold uppercase tracking-widest text-white/50">
          Capacity Score
        </h3>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-32">
          <div className="text-white/30 text-sm animate-pulse">Computing…</div>
        </div>
      )}

      {error && !loading && (
        <div className="flex items-center justify-center h-32">
          <p className="text-red-400 text-xs">{error}</p>
        </div>
      )}

      {data && !loading && (
        <>
          {/* Ring + headline */}
          <div className="flex items-center gap-6 mb-6">
            <CircularRing score={data.capacityScore} />
            <div className="flex-1">
              <p className="text-2xl font-black text-white leading-tight">
                {data.startsEnabled}
              </p>
              <p className="text-xs text-white/40 mt-1 leading-snug">
                more physicians can start this quarter
              </p>
              {data.acceptedThisQuarter > 0 && (
                <p className="mt-2 text-[10px] text-emerald-400/70 font-semibold uppercase tracking-wider">
                  {data.acceptedThisQuarter} accepted this quarter
                </p>
              )}
            </div>
          </div>

          {/* Metric rows */}
          <div>
            <MetricRow
              icon={Briefcase}
              label="Open Positions"
              value={data.openPositions}
            />
            <MetricRow
              icon={Users}
              label="Pipeline Depth"
              value={data.pipelineDepth}
            />
            <MetricRow
              icon={Clock}
              label="Avg Review Days"
              value={
                data.avgReviewDays === 0 ? '—' : `${data.avgReviewDays}d`
              }
            />
            <MetricRow
              icon={ShieldCheck}
              label="Credential Readiness"
              value={
                data.credentialReadiness === 0
                  ? '—'
                  : `${Math.round(data.credentialReadiness * 100)}%`
              }
            />
            <MetricRow
              icon={Activity}
              label="Starts Enabled"
              value={data.startsEnabled}
            />
          </div>

          {/* Footer */}
          <p className="mt-4 text-[10px] text-white/20 text-right">
            Computed {new Date(data.computedAt).toLocaleTimeString()}
          </p>
        </>
      )}
    </div>
  );
}

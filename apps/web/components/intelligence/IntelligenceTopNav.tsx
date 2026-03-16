'use client';

import type { ReactNode } from 'react';
import { Bot, Network, RefreshCw, ShieldCheck } from 'lucide-react';
import type { IntelligenceGraphStats, IntelligenceTone } from '@/lib/intelligence/contracts';
import { ToneBadge } from './shared';

interface IntelligenceTopNavProps {
  overallHealth: IntelligenceTone;
  focusLabel: string;
  graphStats: IntelligenceGraphStats | null;
  providerCount: number;
  findingCount: number;
  storylineCount: number;
  actionCount: number;
  onRefreshAll: () => void;
}

export function IntelligenceTopNav({
  overallHealth,
  focusLabel,
  graphStats,
  providerCount,
  findingCount,
  storylineCount,
  actionCount,
  onRefreshAll,
}: IntelligenceTopNavProps) {
  return (
    <nav className="vital-topnav" role="navigation" aria-label="Intelligence workspace navigation">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/45">
          VitalCV Intelligence
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold text-white">Intelligence Console</h1>
          <ToneBadge tone={overallHealth} label={focusLabel} />
        </div>
        <p className="mt-2 max-w-2xl text-sm text-white/60">
          Investigators, findings, storylines, trust graph, and Copilot — one operational surface.
        </p>
      </div>

      <div className="vital-topnav__metrics">
        <MetricPill icon={<ShieldCheck className="h-3.5 w-3.5" />} label="Providers" value={providerCount} />
        <MetricPill icon={<Bot className="h-3.5 w-3.5" />} label="Findings" value={findingCount} />
        <MetricPill icon={<Network className="h-3.5 w-3.5" />} label="Storylines" value={storylineCount} />
        <MetricPill icon={<Network className="h-3.5 w-3.5" />} label="Actions" value={actionCount} />
        {graphStats ? <MetricPill icon={<Network className="h-3.5 w-3.5" />} label="Graph" value={graphStats.totalNodes} suffix="nodes" /> : null}
        <button
          type="button"
          onClick={onRefreshAll}
          className="vital-action-button"
          aria-label="Refresh all intelligence panels"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Refresh all</span>
        </button>
      </div>
    </nav>
  );
}

function MetricPill({
  icon,
  label,
  value,
  suffix,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-2">
      <div className="flex items-center gap-2 text-xs text-white/55">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-1 text-sm font-semibold text-white">
        {value} {suffix ?? ''}
      </p>
    </div>
  );
}

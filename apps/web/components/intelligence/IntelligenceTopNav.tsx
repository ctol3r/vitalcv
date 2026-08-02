'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Activity, Bot, Command, Network, RefreshCw, ShieldCheck } from 'lucide-react';
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
  lastUpdatedSignature: string;
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
  lastUpdatedSignature,
  onRefreshAll,
}: IntelligenceTopNavProps) {
  const [pulseActive, setPulseActive] = useState(false);

  useEffect(() => {
    if (!lastUpdatedSignature) {
      return;
    }

    setPulseActive(true);
    const timeoutId = window.setTimeout(() => setPulseActive(false), 950);
    return () => window.clearTimeout(timeoutId);
  }, [lastUpdatedSignature]);

  return (
    <nav className="vital-topnav" role="navigation" aria-label="Intelligence workspace navigation">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--vt-text-3)]">
          VitalCV Intelligence
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold text-[var(--vt-text-1)]">Intelligence Console</h1>
          <ToneBadge tone={overallHealth} label={focusLabel} />
        </div>
        <p className="mt-2 max-w-2xl text-sm text-[var(--vt-text-1)]/60">
          Investigators, findings, storylines, trust graph, and Copilot in one operator surface.
        </p>
      </div>

      <div className="vital-topnav__command">
        <button
          type="button"
          className="vital-command-trigger"
          onClick={() => window.dispatchEvent(new Event('vital:open-command-palette'))}
          aria-label="Open command palette"
        >
          <Command className="h-4 w-4" aria-hidden />
          <span>Search providers, findings, storylines</span>
          <kbd>⌘K</kbd>
        </button>
        <p className="vital-topnav__command-copy">
          Jump views, open workbench context, or seed Copilot without leaving the current operator flow.
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
        <div className={`vital-topnav__pulse ${pulseActive ? 'vital-topnav__pulse--active' : ''}`} aria-hidden>
          <Activity className="h-3.5 w-3.5" />
        </div>
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
    <div className="rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface-2)] px-3 py-2">
      <div className="flex items-center gap-2 text-xs text-[var(--vt-text-1)]/55">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-1 text-sm font-semibold text-[var(--vt-text-1)]">
        {value} {suffix ?? ''}
      </p>
    </div>
  );
}

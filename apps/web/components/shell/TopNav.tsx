'use client';

import { Activity, Bot, RefreshCw, Search, Target } from 'lucide-react';
import { startTransition, useEffect, useState } from 'react';
import type { GraphLayer } from '@/components/graph-system/types';
import type { GraphStats, GraphViewMode } from '@/components/graph/state/graphDisplayState';
import { CopilotSearchBar } from '@/components/copilot/CopilotSearchBar';

interface TopNavProps {
  layer: GraphLayer;
  viewMode: GraphViewMode;
  stats: GraphStats;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onReload: () => void;
  onRunAiLinks: () => void;
  onResetLayout: () => void;
  onNavigateToNpi?: (npi: string) => void;
}

export function TopNav({
  layer,
  viewMode,
  stats,
  onReload,
  onRunAiLinks,
  onResetLayout,
  onNavigateToNpi,
}: TopNavProps) {
  return (
    <nav className="vital-topnav">
      <div className="vital-topnav__brand">
        <div className="vital-topnav__identity">
          <p className="vital-topnav__eyebrow">VitalCV Graph Ops</p>
          <div className="vital-topnav__title-row">
            <h1 className="vital-topnav__title">Trust Graph Runtime</h1>
            <span className="vital-status-pill">{layer}</span>
            <span className="vital-status-pill">{viewMode}</span>
          </div>
        </div>
      </div>

      <div className="vital-topnav__search">
        <CopilotSearchBar
          compact
          sessionId="graph-copilot"
          onNavigateToNpi={onNavigateToNpi}
        />
      </div>

      <div className="vital-topnav__metrics">
        <div className="vital-topnav__metric">
          <span className="vital-topnav__metric-label">Nodes</span>
          <span className="vital-topnav__metric-value">{stats.totalNodes}</span>
        </div>
        <div className="vital-topnav__metric">
          <span className="vital-topnav__metric-label">Edges</span>
          <span className="vital-topnav__metric-value">{stats.totalEdges}</span>
        </div>
        <div className="vital-topnav__metric">
          <span className="vital-topnav__metric-label">AI Links</span>
          <span className="vital-topnav__metric-value">{stats.aiSuggestedLinks}</span>
        </div>
        <div className="vital-topnav__divider" />
        <button className="vital-action-button" onClick={onReload} type="button">
          <RefreshCw className="h-3.5 w-3.5" /> Rebuild
        </button>
        <button className="vital-action-button" onClick={onRunAiLinks} type="button">
          <Bot className="h-3.5 w-3.5" /> AI Sweep
        </button>
        <button className="vital-action-button" onClick={onResetLayout} type="button">
          <Target className="h-3.5 w-3.5" /> Reset
        </button>
        <div className="vital-topnav__pulse">
          <Activity className="h-3.5 w-3.5" />
        </div>
      </div>
    </nav>
  );
}

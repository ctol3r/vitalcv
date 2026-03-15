'use client';

import { Activity, Bot, Command, RefreshCw, Target } from 'lucide-react';
import type { GraphLayer } from '@/components/graph-system/types';
import type { GraphZoomBand } from '@/components/graph-system/viewportModel';
import type { GraphStats, GraphViewMode } from '@/components/graph/state/graphDisplayState';

interface TopNavProps {
  layer: GraphLayer;
  viewMode: GraphViewMode;
  stats: GraphStats;
  zoomBand: GraphZoomBand;
  onOpenCommandPalette: () => void;
  onReload: () => void;
  onRunAiLinks: () => void;
  onResetLayout: () => void;
}

export function TopNav({
  layer,
  viewMode,
  stats,
  zoomBand,
  onOpenCommandPalette,
  onReload,
  onRunAiLinks,
  onResetLayout,
}: TopNavProps) {
  return (
    <nav className="vital-topnav" role="navigation" aria-label="Graph workspace navigation">
      <div className="vital-topnav__brand">
        <div className="vital-topnav__identity">
          <p className="vital-topnav__eyebrow">VitalCV Intelligence Interface</p>
          <div className="vital-topnav__title-row">
            <h1 className="vital-topnav__title">Three-panel trust workspace</h1>
            <span className="vital-status-pill">{layer}</span>
            <span className="vital-status-pill">{viewMode}</span>
            <span className="vital-status-pill">{zoomBand}</span>
          </div>
        </div>
      </div>

      <div className="vital-topnav__command">
        <button
          type="button"
          className="vital-command-trigger"
          onClick={onOpenCommandPalette}
          aria-label="Open command palette"
        >
          <Command className="h-4 w-4" aria-hidden />
          <span>Command palette</span>
          <kbd>⌘K</kbd>
        </button>
        <p className="vital-topnav__command-copy">
          Search providers, ask Copilot, run verification, or navigate the system.
        </p>
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
        <div className="vital-topnav__separator" aria-hidden />
        <button className="vital-action-button" onClick={onReload} type="button" aria-label="Rebuild graph">
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          <span>Rebuild</span>
        </button>
        <button className="vital-action-button" onClick={onRunAiLinks} type="button" aria-label="Run AI link sweep">
          <Bot className="h-3.5 w-3.5" aria-hidden />
          <span>AI Sweep</span>
        </button>
        <button className="vital-action-button" onClick={onResetLayout} type="button" aria-label="Reset layout">
          <Target className="h-3.5 w-3.5" aria-hidden />
          <span>Reset</span>
        </button>
        <div className="vital-topnav__pulse" aria-hidden>
          <Activity className="h-3.5 w-3.5" />
        </div>
      </div>
    </nav>
  );
}

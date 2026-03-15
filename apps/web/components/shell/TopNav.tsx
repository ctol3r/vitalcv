'use client';

import { Button, InputGroup, Navbar, NavbarDivider, NavbarGroup, Tag } from '@blueprintjs/core';
import { Activity, Bot, RefreshCw, Search, Target } from 'lucide-react';
import type { GraphLayer } from '@/components/graph-system/types';
import type { GraphStats, GraphViewMode } from '@/components/graph/state/graphDisplayState';

interface TopNavProps {
  layer: GraphLayer;
  viewMode: GraphViewMode;
  stats: GraphStats;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onReload: () => void;
  onRunAiLinks: () => void;
  onResetLayout: () => void;
}

export function TopNav({
  layer,
  viewMode,
  stats,
  searchValue,
  onSearchChange,
  onReload,
  onRunAiLinks,
  onResetLayout,
}: TopNavProps) {
  return (
    <Navbar className="vital-topnav">
      <NavbarGroup align="left" className="vital-topnav__brand">
        <div className="vital-topnav__identity">
          <p className="vital-topnav__eyebrow">VitalCV Graph Ops</p>
          <div className="vital-topnav__title-row">
            <h1 className="vital-topnav__title">Trust Graph Runtime</h1>
            <Tag minimal className="vital-status-pill">
              {layer}
            </Tag>
            <Tag minimal className="vital-status-pill">
              {viewMode}
            </Tag>
          </div>
        </div>
      </NavbarGroup>
      <NavbarGroup align="left" className="vital-topnav__search">
        <InputGroup
          large
          leftElement={<Search className="h-4 w-4 text-[var(--vital-ops-text-muted)]" />}
          onValueChange={onSearchChange}
          placeholder="Search nodes, institutions, evidence..."
          value={searchValue}
          className="vital-search-input"
        />
      </NavbarGroup>
      <NavbarGroup align="right" className="vital-topnav__metrics">
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
        <NavbarDivider />
        <Button
          className="vital-action-button"
          icon={<RefreshCw className="h-3.5 w-3.5" />}
          onClick={onReload}
          small
          text="Rebuild"
        />
        <Button
          className="vital-action-button"
          icon={<Bot className="h-3.5 w-3.5" />}
          onClick={onRunAiLinks}
          small
          text="AI Sweep"
        />
        <Button
          className="vital-action-button"
          icon={<Target className="h-3.5 w-3.5" />}
          onClick={onResetLayout}
          small
          text="Reset"
        />
        <div className="vital-topnav__pulse">
          <Activity className="h-3.5 w-3.5" />
        </div>
      </NavbarGroup>
    </Navbar>
  );
}

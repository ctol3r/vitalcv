'use client';

import { ChevronDown, ChevronRight, RefreshCw, Save, Sparkles } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { GraphLayer, NodeType } from '@/components/graph-system/types';
import { GRAPH_PHYSICS_PRESETS } from '@/components/graph/physics/presets';
import {
  formatGraphNodeType,
  GRAPH_COLOR_MODE_LABELS,
  GRAPH_LINK_CLASS_LABELS,
  GRAPH_LINK_CLASS_ORDER,
  type GraphClusterMode,
  type GraphColorMode,
  type GraphFilterState,
  type GraphLinkClass,
  type GraphPhysicsPresetId,
  type GraphPhysicsState,
  type GraphStats,
  type GraphViewMode,
  type GraphVisualState,
} from '@/components/graph/state/graphDisplayState';

// ── Shared sub-components ──────────────────────────────────────────────────────

function ControlSection({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="vital-panel vital-panel--dense">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="vital-action-button vital-action-button--full"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        <span>{title}</span>
      </button>
      {open && <div className="mt-3 flex flex-col gap-3">{children}</div>}
    </div>
  );
}

function VitalSlider({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="vital-status-pill">{label}</span>
        <span className="text-[11px] font-mono text-[var(--vital-ops-text-muted)]">{value}</span>
      </div>
      <input
        type="range"
        className="gf-slider w-full"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

function VitalSwitch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between cursor-pointer py-0.5 group">
      <span className="text-[12px] text-[var(--vital-ops-text-secondary)] group-hover:text-[var(--vital-ops-text-primary)] transition-colors">
        {label}
      </span>
      <div className="relative">
        <input
          type="checkbox"
          className="sr-only peer"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <div className="w-8 h-[18px] rounded-full bg-[var(--vital-ops-border)] peer-checked:bg-[var(--vital-ops-accent-cyan)] transition-colors" />
        <div className="absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full bg-[var(--vital-ops-text-primary)] peer-checked:translate-x-[14px] transition-transform shadow-sm" />
      </div>
    </label>
  );
}

function Separator() {
  return <div className="h-px bg-[var(--vital-ops-border-subtle)] my-1" />;
}

// ── Main component ─────────────────────────────────────────────────────────────

interface GraphControlsProps {
  layer: GraphLayer;
  viewMode: GraphViewMode;
  filters: GraphFilterState;
  visuals: GraphVisualState;
  physics: GraphPhysicsState;
  stats: GraphStats;
  availableNodeTypes: NodeType[];
  availableTrustTiers: string[];
  canUseLocalMode: boolean;
  onLayerChange: (layer: GraphLayer) => void;
  onViewModeChange: (mode: GraphViewMode) => void;
  onFiltersChange: (filters: GraphFilterState) => void;
  onVisualsChange: (visuals: GraphVisualState) => void;
  onPhysicsChange: (physics: GraphPhysicsState) => void;
  onPresetChange: (preset: GraphPhysicsPresetId) => void;
  onResetLayout: () => void;
  onRunAiLinks: () => void;
  onRebuild: () => void;
  onSavePreset?: (name: string) => void;
  hideLayerControls?: boolean;
  hideTrustTierFilters?: boolean;
  tertiaryMetricLabel?: string;
  tertiaryMetricValue?: string | number;
}

export function GraphControls({
  layer,
  viewMode,
  filters,
  visuals,
  physics,
  stats,
  availableNodeTypes,
  availableTrustTiers,
  canUseLocalMode,
  onLayerChange,
  onViewModeChange,
  onFiltersChange,
  onVisualsChange,
  onPhysicsChange,
  onPresetChange,
  onResetLayout,
  onRunAiLinks,
  onRebuild,
  onSavePreset,
  hideLayerControls = false,
  hideTrustTierFilters = false,
  tertiaryMetricLabel = 'AI suggestions',
  tertiaryMetricValue = stats.aiSuggestedLinks,
}: GraphControlsProps) {
  const [presetName, setPresetName] = useState('');

  const toggleNodeType = (nodeType: NodeType) => {
    const next = filters.nodeTypes.includes(nodeType)
      ? filters.nodeTypes.filter((c) => c !== nodeType)
      : [...filters.nodeTypes, nodeType];
    onFiltersChange({ ...filters, nodeTypes: next });
  };

  const toggleLinkClass = (linkClass: GraphLinkClass) => {
    const next = filters.linkClasses.includes(linkClass)
      ? filters.linkClasses.filter((c) => c !== linkClass)
      : [...filters.linkClasses, linkClass];
    onFiltersChange({ ...filters, linkClasses: next });
  };

  const toggleTrustTier = (tier: string) => {
    const next = filters.trustTiers.includes(tier)
      ? filters.trustTiers.filter((c) => c !== tier)
      : [...filters.trustTiers, tier];
    onFiltersChange({ ...filters, trustTiers: next });
  };

  const updateVisual = <K extends keyof GraphVisualState>(key: K, value: GraphVisualState[K]) => {
    onVisualsChange({ ...visuals, [key]: value });
  };

  const updatePhysics = <K extends keyof GraphPhysicsState>(key: K, value: GraphPhysicsState[K]) => {
    onPhysicsChange({ ...physics, [key]: value });
  };

  return (
    <>
      {/* KPI strip */}
      <div className="vital-panel vital-panel--dense">
        <div className="vital-kpi-grid">
          <div className="vital-kpi">
            <span className="vital-kpi__label">Visible nodes</span>
            <span className="vital-kpi__value">{stats.totalNodes}</span>
          </div>
          <div className="vital-kpi">
            <span className="vital-kpi__label">Visible edges</span>
            <span className="vital-kpi__value">{stats.totalEdges}</span>
          </div>
          <div className="vital-kpi">
            <span className="vital-kpi__label">{tertiaryMetricLabel}</span>
            <span className="vital-kpi__value">{tertiaryMetricValue}</span>
          </div>
        </div>
      </div>

      {/* Workspace Modes */}
      <ControlSection title="Workspace Modes">
        {!hideLayerControls ? (
          <div className="flex flex-col gap-2">
            <span className="vital-panel__eyebrow">Layer</span>
            <div className="vital-btn-group">
              {(['blended', 'trust', 'knowledge'] as GraphLayer[]).map((l) => (
                <button
                  key={l}
                  type="button"
                  className={`vital-action-button ${layer === l ? 'vital-action-button--active' : ''}`}
                  onClick={() => onLayerChange(l)}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <div className="flex flex-col gap-2">
          <span className="vital-panel__eyebrow">View mode</span>
          <div className="vital-btn-group">
            <button
              type="button"
              className={`vital-action-button ${viewMode === 'global' ? 'vital-action-button--active' : ''}`}
              onClick={() => onViewModeChange('global')}
            >
              Global
            </button>
            <button
              type="button"
              className={`vital-action-button ${viewMode === 'local' ? 'vital-action-button--active' : ''}`}
              disabled={!canUseLocalMode}
              onClick={() => onViewModeChange('local')}
            >
              Local
            </button>
          </div>
        </div>
      </ControlSection>

      {/* Filters */}
      <ControlSection title="Filters">
        <div className="flex flex-col gap-2">
          <span className="vital-panel__eyebrow">Link types</span>
          <div className="vital-chip-list">
            {GRAPH_LINK_CLASS_ORDER.map((lc) => (
              <button
                key={lc}
                type="button"
                className={`vital-chip ${filters.linkClasses.includes(lc) ? 'vital-chip--active' : ''}`}
                onClick={() => toggleLinkClass(lc)}
              >
                {GRAPH_LINK_CLASS_LABELS[lc]}
              </button>
            ))}
          </div>
        </div>
        <Separator />
        <div className="flex flex-col gap-2">
          <span className="vital-panel__eyebrow">Node types</span>
          <div className="vital-chip-list">
            {availableNodeTypes.map((nt) => (
              <button
                key={nt}
                type="button"
                className={`vital-chip ${filters.nodeTypes.includes(nt) ? 'vital-chip--active' : ''}`}
                onClick={() => toggleNodeType(nt)}
              >
                {formatGraphNodeType(nt)}
              </button>
            ))}
          </div>
        </div>
        {!hideTrustTierFilters && availableTrustTiers.length > 0 && (
          <>
            <Separator />
            <div className="flex flex-col gap-2">
              <span className="vital-panel__eyebrow">Trust tiers</span>
              <div className="vital-chip-list">
                {availableTrustTiers.map((tier) => (
                  <button
                    key={tier}
                    type="button"
                    className={`vital-chip ${filters.trustTiers.includes(tier) ? 'vital-chip--active' : ''}`}
                    onClick={() => toggleTrustTier(tier)}
                  >
                    {tier}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
        <VitalSwitch label="Show orphan nodes" checked={filters.showOrphans} onChange={(v) => onFiltersChange({ ...filters, showOrphans: v })} />
        <VitalSwitch label="Keep directed edges" checked={filters.showDirected} onChange={(v) => onFiltersChange({ ...filters, showDirected: v })} />
      </ControlSection>

      {/* Display */}
      <ControlSection title="Display">
        <VitalSwitch label="Node labels" checked={visuals.showLabels} onChange={(v) => updateVisual('showLabels', v)} />
        <VitalSwitch label="Directional arrows" checked={visuals.showArrows} onChange={(v) => updateVisual('showArrows', v)} />
        <VitalSwitch label="Animation" checked={visuals.animate} onChange={(v) => updateVisual('animate', v)} />
        <div className="flex flex-col gap-2">
          <span className="vital-panel__eyebrow">Color mode</span>
          <div className="vital-chip-list">
            {(Object.keys(GRAPH_COLOR_MODE_LABELS) as GraphColorMode[]).map((cm) => (
              <button
                key={cm}
                type="button"
                className={`vital-chip ${visuals.colorMode === cm ? 'vital-chip--active' : ''}`}
                onClick={() => updateVisual('colorMode', cm)}
              >
                {GRAPH_COLOR_MODE_LABELS[cm]}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <span className="vital-panel__eyebrow">Cluster mode</span>
          <div className="vital-chip-list">
            {(['none', 'type', 'group', 'tier'] as GraphClusterMode[]).map((cm) => (
              <button
                key={cm}
                type="button"
                className={`vital-chip ${visuals.clusterMode === cm ? 'vital-chip--active' : ''}`}
                onClick={() => updateVisual('clusterMode', cm)}
              >
                {cm}
              </button>
            ))}
          </div>
        </div>
        <VitalSlider label="Node size" min={4} max={18} step={1} value={visuals.nodeSize} onChange={(v) => updateVisual('nodeSize', v)} />
      </ControlSection>

      {/* Physics */}
      <ControlSection title="Physics">
        <div className="flex flex-col gap-2">
          <span className="vital-panel__eyebrow">Presets</span>
          <div className="vital-chip-list">
            {(Object.keys(GRAPH_PHYSICS_PRESETS) as GraphPhysicsPresetId[]).map((p) => (
              <button
                key={p}
                type="button"
                className={`vital-chip ${physics.preset === p ? 'vital-chip--active' : ''}`}
                onClick={() => onPresetChange(p)}
              >
                {GRAPH_PHYSICS_PRESETS[p].label}
              </button>
            ))}
          </div>
        </div>
        <VitalSwitch label="Freeze layout" checked={physics.frozen} onChange={(v) => updatePhysics('frozen', v)} />
        <VitalSlider label="Link distance" min={90} max={220} step={2} value={physics.linkDistance} onChange={(v) => updatePhysics('linkDistance', v)} />
        <VitalSlider label="Repel force" min={80} max={320} step={5} value={physics.repelForce} onChange={(v) => updatePhysics('repelForce', v)} />
        <VitalSlider label="Cluster force" min={0} max={0.14} step={0.005} value={physics.clusterForce} onChange={(v) => updatePhysics('clusterForce', v)} />
      </ControlSection>

      {/* Actions */}
      <ControlSection title="Actions" defaultOpen={false}>
        <button type="button" className="vital-action-button vital-action-button--full" onClick={onRunAiLinks}>
          <Sparkles className="h-3.5 w-3.5" />
          <span>Generate AI link suggestions</span>
        </button>
        <button type="button" className="vital-action-button vital-action-button--full" onClick={onRebuild}>
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Rebuild graph</span>
        </button>
        <button type="button" className="vital-action-button vital-action-button--full" onClick={onResetLayout}>
          <span>Reset layout</span>
        </button>
        {onSavePreset && (
          <>
            <Separator />
            <input
              type="text"
              className="vital-search-input__field"
              placeholder="Preset name"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
            />
            <button
              type="button"
              className="vital-action-button vital-action-button--full"
              disabled={presetName.trim().length === 0}
              onClick={() => {
                if (presetName.trim()) {
                  onSavePreset(presetName.trim());
                  setPresetName('');
                }
              }}
            >
              <Save className="h-3.5 w-3.5" />
              <span>Save current preset</span>
            </button>
          </>
        )}
      </ControlSection>
    </>
  );
}

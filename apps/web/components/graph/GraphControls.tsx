'use client';

import {
  Button,
  ButtonGroup,
  Card,
  Collapse,
  Divider,
  InputGroup,
  Slider,
  Switch,
  Tag,
} from '@blueprintjs/core';
import { ChevronDown, ChevronRight, RefreshCw, Save, Sparkles } from 'lucide-react';
import { useState } from 'react';
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

function ControlSection({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card className="vital-panel vital-panel--dense">
      <Button
        minimal
        onClick={() => setOpen((current) => !current)}
        className="vital-action-button vital-action-button--full"
        icon={open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        text={title}
      />
      <Collapse isOpen={open}>
        <div className="mt-3 flex flex-col gap-3">{children}</div>
      </Collapse>
    </Card>
  );
}

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
}: GraphControlsProps) {
  const [presetName, setPresetName] = useState('');

  const toggleNodeType = (nodeType: NodeType) => {
    const nextNodeTypes = filters.nodeTypes.includes(nodeType)
      ? filters.nodeTypes.filter((current) => current !== nodeType)
      : [...filters.nodeTypes, nodeType];

    onFiltersChange({ ...filters, nodeTypes: nextNodeTypes });
  };

  const toggleLinkClass = (linkClass: GraphLinkClass) => {
    const nextLinkClasses = filters.linkClasses.includes(linkClass)
      ? filters.linkClasses.filter((current) => current !== linkClass)
      : [...filters.linkClasses, linkClass];

    onFiltersChange({ ...filters, linkClasses: nextLinkClasses });
  };

  const toggleTrustTier = (trustTier: string) => {
    const nextTrustTiers = filters.trustTiers.includes(trustTier)
      ? filters.trustTiers.filter((current) => current !== trustTier)
      : [...filters.trustTiers, trustTier];

    onFiltersChange({ ...filters, trustTiers: nextTrustTiers });
  };

  const updateVisual = <Key extends keyof GraphVisualState>(key: Key, value: GraphVisualState[Key]) => {
    onVisualsChange({ ...visuals, [key]: value });
  };

  const updatePhysics = <Key extends keyof GraphPhysicsState>(key: Key, value: GraphPhysicsState[Key]) => {
    onPhysicsChange({ ...physics, [key]: value });
  };

  return (
    <>
      <Card className="vital-panel vital-panel--dense">
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
            <span className="vital-kpi__label">AI suggestions</span>
            <span className="vital-kpi__value">{stats.aiSuggestedLinks}</span>
          </div>
        </div>
      </Card>

      <ControlSection title="Workspace Modes">
        <div className="flex flex-col gap-2">
          <span className="vital-panel__eyebrow">Layer</span>
          <ButtonGroup fill>
            {(['blended', 'trust', 'knowledge'] as GraphLayer[]).map((currentLayer) => (
              <Button
                key={currentLayer}
                active={layer === currentLayer}
                className="vital-action-button"
                onClick={() => onLayerChange(currentLayer)}
                text={currentLayer}
              />
            ))}
          </ButtonGroup>
        </div>
        <div className="flex flex-col gap-2">
          <span className="vital-panel__eyebrow">View mode</span>
          <ButtonGroup fill>
            <Button
              active={viewMode === 'global'}
              className="vital-action-button"
              onClick={() => onViewModeChange('global')}
              text="Global"
            />
            <Button
              active={viewMode === 'local'}
              className="vital-action-button"
              disabled={!canUseLocalMode}
              onClick={() => onViewModeChange('local')}
              text="Local"
            />
          </ButtonGroup>
        </div>
      </ControlSection>

      <ControlSection title="Filters">
        <div className="flex flex-col gap-2">
          <span className="vital-panel__eyebrow">Link types</span>
          <div className="vital-chip-list">
            {GRAPH_LINK_CLASS_ORDER.map((linkClass) => (
              <button
                key={linkClass}
                type="button"
                className={`vital-chip ${filters.linkClasses.includes(linkClass) ? 'vital-chip--active' : ''}`}
                onClick={() => toggleLinkClass(linkClass)}
              >
                {GRAPH_LINK_CLASS_LABELS[linkClass]}
              </button>
            ))}
          </div>
        </div>
        <Divider />
        <div className="flex flex-col gap-2">
          <span className="vital-panel__eyebrow">Node types</span>
          <div className="vital-chip-list">
            {availableNodeTypes.map((nodeType) => (
              <button
                key={nodeType}
                type="button"
                className={`vital-chip ${filters.nodeTypes.includes(nodeType) ? 'vital-chip--active' : ''}`}
                onClick={() => toggleNodeType(nodeType)}
              >
                {formatGraphNodeType(nodeType)}
              </button>
            ))}
          </div>
        </div>
        {availableTrustTiers.length > 0 ? (
          <>
            <Divider />
            <div className="flex flex-col gap-2">
              <span className="vital-panel__eyebrow">Trust tiers</span>
              <div className="vital-chip-list">
                {availableTrustTiers.map((trustTier) => (
                  <button
                    key={trustTier}
                    type="button"
                    className={`vital-chip ${filters.trustTiers.includes(trustTier) ? 'vital-chip--active' : ''}`}
                    onClick={() => toggleTrustTier(trustTier)}
                  >
                    {trustTier}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : null}
        <Switch
          checked={filters.showOrphans}
          className="text-sm"
          label="Show orphan nodes"
          onChange={(event) => onFiltersChange({ ...filters, showOrphans: event.currentTarget.checked })}
        />
        <Switch
          checked={filters.showDirected}
          className="text-sm"
          label="Keep directed edges"
          onChange={(event) => onFiltersChange({ ...filters, showDirected: event.currentTarget.checked })}
        />
      </ControlSection>

      <ControlSection title="Display">
        <Switch
          checked={visuals.showLabels}
          label="Node labels"
          onChange={(event) => updateVisual('showLabels', event.currentTarget.checked)}
        />
        <Switch
          checked={visuals.showArrows}
          label="Directional arrows"
          onChange={(event) => updateVisual('showArrows', event.currentTarget.checked)}
        />
        <Switch
          checked={visuals.animate}
          label="Animation"
          onChange={(event) => updateVisual('animate', event.currentTarget.checked)}
        />
        <div className="flex flex-col gap-2">
          <span className="vital-panel__eyebrow">Color mode</span>
          <div className="vital-chip-list">
            {(Object.keys(GRAPH_COLOR_MODE_LABELS) as GraphColorMode[]).map((colorMode) => (
              <button
                key={colorMode}
                type="button"
                className={`vital-chip ${visuals.colorMode === colorMode ? 'vital-chip--active' : ''}`}
                onClick={() => updateVisual('colorMode', colorMode)}
              >
                {GRAPH_COLOR_MODE_LABELS[colorMode]}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <span className="vital-panel__eyebrow">Cluster mode</span>
          <div className="vital-chip-list">
            {(['none', 'type', 'group', 'tier'] as GraphClusterMode[]).map((clusterMode) => (
              <button
                key={clusterMode}
                type="button"
                className={`vital-chip ${visuals.clusterMode === clusterMode ? 'vital-chip--active' : ''}`}
                onClick={() => updateVisual('clusterMode', clusterMode)}
              >
                {clusterMode}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Tag minimal className="vital-status-pill">Node size</Tag>
          <Slider
            min={4}
            max={18}
            stepSize={1}
            labelStepSize={7}
            onChange={(value) => updateVisual('nodeSize', value)}
            value={visuals.nodeSize}
          />
        </div>
      </ControlSection>

      <ControlSection title="Physics">
        <div className="flex flex-col gap-2">
          <span className="vital-panel__eyebrow">Presets</span>
          <div className="vital-chip-list">
            {(Object.keys(GRAPH_PHYSICS_PRESETS) as GraphPhysicsPresetId[]).map((preset) => (
              <button
                key={preset}
                type="button"
                className={`vital-chip ${physics.preset === preset ? 'vital-chip--active' : ''}`}
                onClick={() => onPresetChange(preset)}
              >
                {GRAPH_PHYSICS_PRESETS[preset].label}
              </button>
            ))}
          </div>
        </div>
        <Switch
          checked={physics.frozen}
          label="Freeze layout"
          onChange={(event) => updatePhysics('frozen', event.currentTarget.checked)}
        />
        <div className="flex flex-col gap-2">
          <Tag minimal className="vital-status-pill">Link distance</Tag>
          <Slider
            min={90}
            max={220}
            stepSize={2}
            labelStepSize={26}
            onChange={(value) => updatePhysics('linkDistance', value)}
            value={physics.linkDistance}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Tag minimal className="vital-status-pill">Repel force</Tag>
          <Slider
            min={80}
            max={320}
            stepSize={5}
            labelStepSize={60}
            onChange={(value) => updatePhysics('repelForce', value)}
            value={physics.repelForce}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Tag minimal className="vital-status-pill">Cluster force</Tag>
          <Slider
            min={0}
            max={0.14}
            stepSize={0.005}
            labelStepSize={0.03}
            onChange={(value) => updatePhysics('clusterForce', value)}
            value={physics.clusterForce}
          />
        </div>
      </ControlSection>

      <ControlSection title="Actions" defaultOpen={false}>
        <Button
          className="vital-action-button vital-action-button--full"
          icon={<Sparkles className="h-3.5 w-3.5" />}
          onClick={onRunAiLinks}
          text="Generate AI link suggestions"
        />
        <Button
          className="vital-action-button vital-action-button--full"
          icon={<RefreshCw className="h-3.5 w-3.5" />}
          onClick={onRebuild}
          text="Rebuild graph"
        />
        <Button
          className="vital-action-button vital-action-button--full"
          onClick={onResetLayout}
          text="Reset layout"
        />
        {onSavePreset ? (
          <>
            <Divider />
            <InputGroup
              placeholder="Preset name"
              value={presetName}
              onValueChange={setPresetName}
            />
            <Button
              className="vital-action-button vital-action-button--full"
              disabled={presetName.trim().length === 0}
              icon={<Save className="h-3.5 w-3.5" />}
              onClick={() => {
                if (presetName.trim().length === 0) {
                  return;
                }

                onSavePreset(presetName.trim());
                setPresetName('');
              }}
              text="Save current preset"
            />
          </>
        ) : null}
      </ControlSection>
    </>
  );
}

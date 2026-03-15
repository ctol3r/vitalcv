'use client';

/**
 * GraphControls.tsx — Floating left-side control panel
 *
 * Collapsible sections: Filters, Display, Physics, AI Links
 * Every control is real and wired to graph behavior.
 */

import { useState, useCallback } from 'react';
import type {
  FilterConfig, DisplayConfig, PhysicsConfig,
  NodeType, EdgeType, GraphLayer, ColorMode, ClusterMode,
} from './types';

interface Props {
  filters: FilterConfig;
  display: DisplayConfig;
  physics: PhysicsConfig;
  layer: GraphLayer;
  stats: { totalNodes: number; totalEdges: number; orphanCount: number; aiSuggestedLinks: number };
  onFiltersChange: (f: FilterConfig) => void;
  onDisplayChange: (d: DisplayConfig) => void;
  onPhysicsChange: (p: PhysicsConfig) => void;
  onLayerChange: (l: GraphLayer) => void;
  onRebuild: () => void;
  onRunAiLinks: () => void;
  onResetLayout: () => void;
  onSavePreset: (name: string) => void;
}

// ── Collapsible section ───────────────────────────────────────────────────────

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-200 transition-colors"
      >
        <span>{title}</span>
        <span className="text-[10px]">{open ? '▼' : '▶'}</span>
      </button>
      {open && <div className="px-3 pb-3 space-y-2">{children}</div>}
    </div>
  );
}

// ── Slider ────────────────────────────────────────────────────────────────────

function Slider({ label, value, min, max, step, onChange }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-[11px] text-slate-500 w-20 shrink-0">{label}</label>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="flex-1 h-1 accent-cyan-500 bg-slate-700 rounded-full appearance-none cursor-pointer"
      />
      <span className="text-[10px] text-slate-600 w-8 text-right font-mono">{value}</span>
    </div>
  );
}

// ── Toggle ────────────────────────────────────────────────────────────────────

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer group">
      <div className={`w-7 h-4 rounded-full transition-colors ${checked ? 'bg-cyan-600' : 'bg-slate-700'} relative`}>
        <div className={`w-3 h-3 rounded-full bg-white absolute top-0.5 transition-transform ${checked ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
      </div>
      <span className="text-[11px] text-slate-400 group-hover:text-slate-200 transition-colors">{label}</span>
    </label>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function GraphControls({
  filters, display, physics, layer, stats,
  onFiltersChange, onDisplayChange, onPhysicsChange, onLayerChange,
  onRebuild, onRunAiLinks, onResetLayout, onSavePreset,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [presetName, setPresetName] = useState('');

  const updateFilter = useCallback(<K extends keyof FilterConfig>(key: K, value: FilterConfig[K]) => {
    onFiltersChange({ ...filters, [key]: value });
  }, [filters, onFiltersChange]);

  const updateDisplay = useCallback(<K extends keyof DisplayConfig>(key: K, value: DisplayConfig[K]) => {
    onDisplayChange({ ...display, [key]: value });
  }, [display, onDisplayChange]);

  const updatePhysics = useCallback(<K extends keyof PhysicsConfig>(key: K, value: PhysicsConfig[K]) => {
    onPhysicsChange({ ...physics, [key]: value });
  }, [physics, onPhysicsChange]);

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="fixed left-4 top-20 z-50 w-8 h-8 rounded-lg bg-slate-800/90 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white hover:border-cyan-600 transition-all"
        title="Open controls"
      >
        ⚙
      </button>
    );
  }

  return (
    <div className="fixed left-4 top-20 z-50 w-64 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-xl bg-slate-900/95 border border-slate-700/50 backdrop-blur-sm shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800">
        <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Graph Controls</span>
        <div className="flex gap-1">
          <span className="text-[9px] text-slate-600 font-mono">{stats.totalNodes}n {stats.totalEdges}e</span>
          <button onClick={() => setCollapsed(true)} className="text-slate-500 hover:text-white text-xs ml-2">✕</button>
        </div>
      </div>

      {/* Layer selector */}
      <div className="px-3 py-2 border-b border-slate-800">
        <div className="flex gap-1">
          {(['blended', 'trust', 'knowledge'] as GraphLayer[]).map(l => (
            <button
              key={l}
              onClick={() => onLayerChange(l)}
              className={`flex-1 text-[10px] py-1 rounded-md font-medium transition-colors ${
                layer === l
                  ? 'bg-cyan-600/30 text-cyan-300 border border-cyan-600/50'
                  : 'bg-slate-800 text-slate-500 border border-transparent hover:text-slate-300'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-slate-800">
        <input
          type="text"
          placeholder="Search nodes…"
          value={filters.searchTerm}
          onChange={e => updateFilter('searchTerm', e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded-md px-2 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-600"
        />
      </div>

      {/* Filters */}
      <Section title="Filters">
        <Toggle label="Orphans" checked={filters.showOrphans} onChange={v => updateFilter('showOrphans', v)} />
        <Toggle label="Attachments" checked={filters.showAttachments} onChange={v => updateFilter('showAttachments', v)} />
        <Toggle label="Explicit links" checked={filters.showExplicit} onChange={v => updateFilter('showExplicit', v)} />
        <Toggle label="Inferred links" checked={filters.showInferred} onChange={v => updateFilter('showInferred', v)} />
        <Toggle label="AI links" checked={filters.showAiLinks} onChange={v => updateFilter('showAiLinks', v)} />
        <Toggle label="Directed edges" checked={filters.showDirected} onChange={v => updateFilter('showDirected', v)} />

        {/* Trust tier filter */}
        <div className="flex gap-1 mt-1">
          {['GOLD', 'SILVER', 'BRONZE'].map(tier => (
            <button
              key={tier}
              onClick={() => {
                const current = filters.trustTiers;
                const next = current.includes(tier)
                  ? current.filter(t => t !== tier)
                  : [...current, tier];
                updateFilter('trustTiers', next);
              }}
              className={`flex-1 text-[9px] py-0.5 rounded font-medium ${
                filters.trustTiers.includes(tier)
                  ? tier === 'GOLD' ? 'bg-amber-900/40 text-amber-400'
                    : tier === 'SILVER' ? 'bg-slate-600/40 text-slate-300'
                    : 'bg-orange-900/40 text-orange-400'
                  : 'bg-slate-800 text-slate-600'
              }`}
            >
              {tier}
            </button>
          ))}
        </div>
      </Section>

      {/* Display */}
      <Section title="Display">
        <Toggle label="Arrows" checked={display.showArrows} onChange={v => updateDisplay('showArrows', v)} />
        <Toggle label="Labels" checked={display.showLabels} onChange={v => updateDisplay('showLabels', v)} />
        <Toggle label="Animation" checked={display.animate} onChange={v => updateDisplay('animate', v)} />
        <Slider label="Node size" value={display.nodeSize} min={1} max={20} step={1} onChange={v => updateDisplay('nodeSize', v)} />
        <Slider label="Link width" value={display.linkThickness} min={0.5} max={6} step={0.5} onChange={v => updateDisplay('linkThickness', v)} />
        <Slider label="Label fade" value={display.textFadeThreshold} min={0.1} max={2} step={0.1} onChange={v => updateDisplay('textFadeThreshold', v)} />

        {/* Color mode */}
        <div className="flex gap-1 mt-1">
          {(['type', 'group', 'tier'] as ColorMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => updateDisplay('colorMode', mode)}
              className={`flex-1 text-[9px] py-0.5 rounded ${
                display.colorMode === mode ? 'bg-cyan-600/30 text-cyan-300' : 'bg-slate-800 text-slate-600'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>

        {/* Cluster mode */}
        <div className="flex gap-1 mt-1">
          {(['none', 'type', 'group', 'tier'] as ClusterMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => updateDisplay('clusterMode', mode)}
              className={`flex-1 text-[9px] py-0.5 rounded ${
                display.clusterMode === mode ? 'bg-violet-600/30 text-violet-300' : 'bg-slate-800 text-slate-600'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </Section>

      {/* Physics */}
      <Section title="Physics" defaultOpen={false}>
        <Toggle label="Freeze layout" checked={physics.frozen} onChange={v => updatePhysics('frozen', v)} />
        <Slider label="Center" value={physics.centerForce} min={0} max={1} step={0.05} onChange={v => updatePhysics('centerForce', v)} />
        <Slider label="Repel" value={physics.repelForce} min={0} max={500} step={10} onChange={v => updatePhysics('repelForce', v)} />
        <Slider label="Link pull" value={physics.linkForce} min={0} max={1} step={0.05} onChange={v => updatePhysics('linkForce', v)} />
        <Slider label="Link dist" value={physics.linkDistance} min={10} max={500} step={10} onChange={v => updatePhysics('linkDistance', v)} />
        <Slider label="Cluster" value={physics.clusterSpacing} min={0} max={200} step={5} onChange={v => updatePhysics('clusterSpacing', v)} />
      </Section>

      {/* AI Links */}
      <Section title="AI Links" defaultOpen={false}>
        {stats.aiSuggestedLinks > 0 && (
          <div className="text-[10px] text-amber-400 mb-1">
            {stats.aiSuggestedLinks} pending suggestion{stats.aiSuggestedLinks > 1 ? 's' : ''}
          </div>
        )}
        <button
          onClick={onRunAiLinks}
          className="w-full text-[10px] py-1.5 rounded-md bg-cyan-900/30 text-cyan-400 border border-cyan-800/50 hover:bg-cyan-800/40 transition-colors"
        >
          Generate AI Link Suggestions
        </button>
      </Section>

      {/* Actions */}
      <Section title="Actions" defaultOpen={false}>
        <button onClick={onResetLayout} className="w-full text-[10px] py-1.5 rounded-md bg-slate-800 text-slate-400 hover:text-white border border-slate-700 transition-colors mb-1">
          Reset Layout
        </button>
        <button onClick={onRebuild} className="w-full text-[10px] py-1.5 rounded-md bg-slate-800 text-slate-400 hover:text-white border border-slate-700 transition-colors mb-1">
          Rebuild Graph
        </button>
        <div className="flex gap-1">
          <input
            type="text" placeholder="Preset name…" value={presetName}
            onChange={e => setPresetName(e.target.value)}
            className="flex-1 bg-slate-800 border border-slate-700 rounded-md px-2 py-1 text-[10px] text-slate-300 placeholder-slate-600"
          />
          <button
            onClick={() => { if (presetName) { onSavePreset(presetName); setPresetName(''); } }}
            className="text-[10px] px-2 py-1 rounded-md bg-emerald-900/30 text-emerald-400 border border-emerald-800/50 hover:bg-emerald-800/40"
          >
            Save
          </button>
        </div>
      </Section>
    </div>
  );
}

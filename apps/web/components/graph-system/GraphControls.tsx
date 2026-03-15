'use client';

/**
 * GraphControls.tsx — Foundry-style graph control panel
 *
 * Named physics presets, semantic controls, dense UI.
 * All controls are wired to real graph state.
 */

import { useState, useCallback } from 'react';
import type {
  FilterConfig, DisplayConfig, PhysicsConfig,
  GraphLayer, ColorMode, ClusterMode, PhysicsPreset,
} from './types';
import { PHYSICS_PRESETS } from './types';

interface Props {
  filters:          FilterConfig;
  display:          DisplayConfig;
  physics:          PhysicsConfig;
  layer:            GraphLayer;
  stats:            { totalNodes: number; totalEdges: number; orphanCount: number; aiSuggestedLinks: number };
  onFiltersChange:  (f: FilterConfig) => void;
  onDisplayChange:  (d: DisplayConfig) => void;
  onPhysicsChange:  (p: PhysicsConfig) => void;
  onLayerChange:    (l: GraphLayer) => void;
  onPresetChange:   (preset: PhysicsPreset) => void;
  onRebuild:        () => void;
  onRunAiLinks:     () => void;
  onResetLayout:    () => void;
  onSavePreset:     (name: string) => void;
}

// ── Collapsible section ───────────────────────────────────────────────────────

function Section({ title, children, defaultOpen = true }: {
  title: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 transition-colors group"
        style={{ fontFamily: 'var(--gf-font-ui)' }}
      >
        <span className="gf-section-title group-hover:text-slate-300 transition-colors">{title}</span>
        <span className="text-[8px] text-slate-700">{open ? '▼' : '▶'}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2 border-b border-white/5">{children}</div>
      )}
    </div>
  );
}

// ── Slider ────────────────────────────────────────────────────────────────────

function Slider({ label, value, min, max, step, onChange, accent = 'cyan' }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; accent?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <label
        className="text-[10px] shrink-0 w-[72px]"
        style={{ color: 'var(--gf-text-tertiary)', fontFamily: 'var(--gf-font-ui)' }}
      >
        {label}
      </label>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="gf-slider flex-1"
      />
      <span
        className="text-[10px] w-7 text-right font-mono shrink-0"
        style={{ color: 'var(--gf-text-tertiary)' }}
      >
        {value}
      </span>
    </div>
  );
}

// ── Toggle ────────────────────────────────────────────────────────────────────

function Toggle({ label, checked, onChange }: {
  label: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer group">
      <div className={`w-7 h-4 rounded-full transition-colors relative shrink-0 ${
        checked ? 'bg-cyan-700' : 'bg-slate-800'
      }`}>
        <div className={`w-3 h-3 rounded-full bg-white absolute top-0.5 transition-transform ${
          checked ? 'translate-x-3.5' : 'translate-x-0.5'
        }`} />
      </div>
      <span
        className="text-[11px] group-hover:text-slate-200 transition-colors"
        style={{ color: 'var(--gf-text-secondary)', fontFamily: 'var(--gf-font-ui)' }}
      >
        {label}
      </span>
    </label>
  );
}

// ── Physics Preset Button ─────────────────────────────────────────────────────

function PresetButton({
  preset, active, onClick,
}: { preset: PhysicsPreset; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={preset.description}
      className={`flex-1 py-1.5 rounded-md text-[10px] font-semibold transition-all border ${
        active
          ? 'bg-cyan-900/30 text-cyan-300 border-cyan-700/50'
          : 'bg-slate-900 border-transparent hover:border-slate-700'
      }`}
      style={{
        color: active ? undefined : 'var(--gf-text-tertiary)',
        fontFamily: 'var(--gf-font-ui)',
      }}
    >
      {preset.label}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function GraphControls({
  filters, display, physics, layer, stats,
  onFiltersChange, onDisplayChange, onPhysicsChange, onLayerChange,
  onPresetChange, onRebuild, onRunAiLinks, onResetLayout, onSavePreset,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [activePreset, setActivePreset] = useState<string | null>('balanced');

  const updateFilter = useCallback(<K extends keyof FilterConfig>(key: K, value: FilterConfig[K]) => {
    onFiltersChange({ ...filters, [key]: value });
  }, [filters, onFiltersChange]);

  const updateDisplay = useCallback(<K extends keyof DisplayConfig>(key: K, value: DisplayConfig[K]) => {
    onDisplayChange({ ...display, [key]: value });
  }, [display, onDisplayChange]);

  const updatePhysics = useCallback(<K extends keyof PhysicsConfig>(key: K, value: PhysicsConfig[K]) => {
    setActivePreset(null); // manual change clears preset highlight
    onPhysicsChange({ ...physics, [key]: value });
  }, [physics, onPhysicsChange]);

  const handlePreset = useCallback((preset: PhysicsPreset) => {
    setActivePreset(preset.name);
    onPresetChange(preset);
  }, [onPresetChange]);

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="fixed left-4 top-20 z-50 w-9 h-9 rounded-xl flex items-center justify-center transition-all"
        style={{
          background: 'var(--gf-panel)',
          border: '1px solid var(--gf-panel-border)',
          boxShadow: 'var(--gf-panel-shadow)',
          color: 'var(--gf-text-secondary)',
        }}
        title="Open controls"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M2 5h12M2 8h12M2 11h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>
    );
  }

  return (
    <div
      className="fixed left-4 top-20 z-50 overflow-y-auto rounded-xl"
      style={{
        width: 'var(--gf-panel-width)',
        maxHeight: 'calc(100vh - 6rem)',
        background: 'var(--gf-panel)',
        border: '1px solid var(--gf-panel-border)',
        boxShadow: 'var(--gf-panel-shadow)',
        fontFamily: 'var(--gf-font-ui)',
        backdropFilter: 'blur(10px)',
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="gf-panel-header">
        <div className="flex items-center gap-2">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <circle cx="5" cy="5" r="4" stroke="#38bdf8" strokeWidth="1.2"/>
            <circle cx="5" cy="5" r="1.5" fill="#38bdf8"/>
          </svg>
          <span>Graph Explorer</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[9px]" style={{ color: 'var(--gf-text-tertiary)' }}>
            {stats.totalNodes}N {stats.totalEdges}E
          </span>
          <button
            onClick={() => setCollapsed(true)}
            className="text-slate-600 hover:text-slate-300 transition-colors text-[10px] ml-1"
          >
            ✕
          </button>
        </div>
      </div>

      {/* ── Layer selector ──────────────────────────────────────────────── */}
      <div className="px-3 py-2 border-b border-white/5">
        <div className="flex gap-1">
          {(['blended', 'trust', 'knowledge'] as GraphLayer[]).map(l => (
            <button
              key={l}
              onClick={() => onLayerChange(l)}
              className={`flex-1 text-[10px] py-1.5 rounded-md font-semibold transition-all border ${
                layer === l
                  ? 'bg-cyan-900/30 text-cyan-300 border-cyan-700/50'
                  : 'border-transparent hover:border-slate-800'
              }`}
              style={{ color: layer === l ? undefined : 'var(--gf-text-tertiary)' }}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* ── Physics Presets ─────────────────────────────────────────────── */}
      <div className="px-3 py-2 border-b border-white/5">
        <div className="gf-section-title mb-2">Presets</div>
        <div className="flex gap-1 mb-1.5">
          {PHYSICS_PRESETS.slice(0, 3).map(p => (
            <PresetButton key={p.name} preset={p} active={activePreset === p.name} onClick={() => handlePreset(p)} />
          ))}
        </div>
        <div className="flex gap-1">
          {PHYSICS_PRESETS.slice(3).map(p => (
            <PresetButton key={p.name} preset={p} active={activePreset === p.name} onClick={() => handlePreset(p)} />
          ))}
        </div>
      </div>

      {/* ── Search ──────────────────────────────────────────────────────── */}
      <div className="px-3 py-2 border-b border-white/5">
        <input
          type="text"
          placeholder="Search nodes…"
          value={filters.searchTerm}
          onChange={e => updateFilter('searchTerm', e.target.value)}
          className="w-full rounded-md px-2.5 py-1.5 text-[11px] placeholder-slate-600 focus:outline-none transition-colors"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--gf-panel-border)',
            color: 'var(--gf-text-primary)',
            fontFamily: 'var(--gf-font-ui)',
          }}
          onFocus={e => e.target.style.borderColor = 'rgba(56,189,248,0.4)'}
          onBlur={e => e.target.style.borderColor = 'var(--gf-panel-border)'}
        />
      </div>

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <Section title="Filters">
        <Toggle label="Orphans" checked={filters.showOrphans} onChange={v => updateFilter('showOrphans', v)} />
        <Toggle label="Explicit links" checked={filters.showExplicit} onChange={v => updateFilter('showExplicit', v)} />
        <Toggle label="Inferred links" checked={filters.showInferred} onChange={v => updateFilter('showInferred', v)} />
        <Toggle label="AI links" checked={filters.showAiLinks} onChange={v => updateFilter('showAiLinks', v)} />
        <Toggle label="Directed edges" checked={filters.showDirected} onChange={v => updateFilter('showDirected', v)} />
        {/* Trust tier chips */}
        <div className="flex gap-1 pt-1">
          {['GOLD', 'SILVER', 'BRONZE'].map(tier => {
            const active = filters.trustTiers.includes(tier);
            const cls = {
              GOLD: active ? 'gf-badge-gold' : 'text-slate-600',
              SILVER: active ? 'gf-badge-silver' : 'text-slate-600',
              BRONZE: active ? 'gf-badge-bronze' : 'text-slate-600',
            }[tier];
            return (
              <button
                key={tier}
                onClick={() => {
                  const next = filters.trustTiers.includes(tier)
                    ? filters.trustTiers.filter(t => t !== tier)
                    : [...filters.trustTiers, tier];
                  updateFilter('trustTiers', next);
                }}
                className={`flex-1 gf-badge justify-center ${cls} cursor-pointer transition-all`}
              >
                {tier}
              </button>
            );
          })}
        </div>
      </Section>

      {/* ── Display ─────────────────────────────────────────────────────── */}
      <Section title="Display" defaultOpen={false}>
        <Toggle label="Arrows" checked={display.showArrows} onChange={v => updateDisplay('showArrows', v)} />
        <Toggle label="Labels" checked={display.showLabels} onChange={v => updateDisplay('showLabels', v)} />
        <Toggle label="Cluster hulls" checked={display.showClusterHulls} onChange={v => updateDisplay('showClusterHulls', v)} />
        <Toggle label="Animation" checked={display.animate} onChange={v => updateDisplay('animate', v)} />
        <Slider label="Node size" value={display.nodeSize} min={1} max={20} step={1} onChange={v => updateDisplay('nodeSize', v)} />
        <Slider label="Link width" value={display.linkThickness} min={0.5} max={6} step={0.5} onChange={v => updateDisplay('linkThickness', v)} />
        <Slider label="Label fade" value={display.textFadeThreshold} min={0.1} max={2} step={0.1} onChange={v => updateDisplay('textFadeThreshold', v)} />

        {/* Color mode */}
        <div>
          <div className="gf-section-title mb-1">Color by</div>
          <div className="flex gap-1">
            {(['type', 'group', 'tier'] as ColorMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => updateDisplay('colorMode', mode)}
                className={`flex-1 text-[9px] py-1 rounded-md border transition-all ${
                  display.colorMode === mode
                    ? 'bg-cyan-900/25 text-cyan-400 border-cyan-700/40'
                    : 'border-transparent text-slate-600 hover:text-slate-400'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {/* Cluster mode */}
        <div>
          <div className="gf-section-title mb-1">Cluster by</div>
          <div className="flex gap-1">
            {(['none', 'type', 'group', 'tier'] as ClusterMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => updateDisplay('clusterMode', mode)}
                className={`flex-1 text-[9px] py-1 rounded-md border transition-all ${
                  display.clusterMode === mode
                    ? 'bg-violet-900/25 text-violet-400 border-violet-700/40'
                    : 'border-transparent text-slate-600 hover:text-slate-400'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </Section>

      {/* ── Physics ─────────────────────────────────────────────────────── */}
      <Section title="Physics" defaultOpen={false}>
        <Toggle label="Freeze layout" checked={physics.frozen} onChange={v => updatePhysics('frozen', v)} />
        <Slider label="Center" value={physics.centerForce} min={0} max={1} step={0.05} onChange={v => updatePhysics('centerForce', v)} />
        <Slider label="Repel" value={physics.repelForce} min={0} max={500} step={10} onChange={v => updatePhysics('repelForce', v)} />
        <Slider label="Link pull" value={physics.linkForce} min={0} max={1} step={0.05} onChange={v => updatePhysics('linkForce', v)} />
        <Slider label="Link dist" value={physics.linkDistance} min={10} max={500} step={10} onChange={v => updatePhysics('linkDistance', v)} />
        <Slider label="Cluster Δ" value={physics.clusterSpacing} min={0} max={200} step={5} onChange={v => updatePhysics('clusterSpacing', v)} />
        <Slider label="Cluster G" value={physics.clusterGravity} min={0} max={1} step={0.05} onChange={v => updatePhysics('clusterGravity', v)} />
        <Slider label="Collision" value={physics.collisionRadius} min={0} max={60} step={2} onChange={v => updatePhysics('collisionRadius', v)} />
      </Section>

      {/* ── AI Links ────────────────────────────────────────────────────── */}
      <Section title="AI Links" defaultOpen={false}>
        {stats.aiSuggestedLinks > 0 && (
          <div className="gf-badge gf-badge-ai w-full justify-center mb-2">
            {stats.aiSuggestedLinks} pending suggestion{stats.aiSuggestedLinks !== 1 ? 's' : ''}
          </div>
        )}
        <button onClick={onRunAiLinks} className="gf-btn gf-btn-ai w-full text-center">
          Generate AI Suggestions
        </button>
      </Section>

      {/* ── Actions ─────────────────────────────────────────────────────── */}
      <Section title="Actions" defaultOpen={false}>
        <button onClick={onResetLayout} className="gf-btn gf-btn-ghost w-full text-center mb-1">
          Reset Layout
        </button>
        <button onClick={onRebuild} className="gf-btn gf-btn-primary w-full text-center mb-2">
          Rebuild Graph
        </button>
        <div className="flex gap-1">
          <input
            type="text"
            placeholder="Preset name…"
            value={presetName}
            onChange={e => setPresetName(e.target.value)}
            className="flex-1 rounded-md px-2 py-1.5 text-[10px] placeholder-slate-700 focus:outline-none"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--gf-panel-border)',
              color: 'var(--gf-text-primary)',
            }}
          />
          <button
            onClick={() => { if (presetName) { onSavePreset(presetName); setPresetName(''); } }}
            className="gf-btn gf-btn-primary px-3"
          >
            Save
          </button>
        </div>
      </Section>

      {/* ── Status footer ───────────────────────────────────────────────── */}
      <div
        className="px-3 py-2 border-t border-white/5 flex items-center justify-between gf-statusbar"
        style={{ color: 'var(--gf-text-tertiary)' }}
      >
        <span className="font-mono">{stats.orphanCount > 0 ? `${stats.orphanCount} orphans` : 'no orphans'}</span>
        <span className="uppercase tracking-wide">{layer}</span>
      </div>
    </div>
  );
}

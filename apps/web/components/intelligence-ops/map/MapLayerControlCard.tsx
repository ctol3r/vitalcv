'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight, Layers2, Sparkles } from 'lucide-react';
import type { MapLayerKey } from '@/lib/intelligence/map-contracts';
import { cn } from '@/lib/utils';

const LAYER_COPY: Array<{
  key: MapLayerKey;
  label: string;
  detail: string;
}> = [
  { key: 'momentum', label: 'Institutional Momentum', detail: 'State rings and live operator motion.' },
  { key: 'collaboration', label: 'Collaboration Networks', detail: 'Cross-region collaboration arcs.' },
  { key: 'shortage', label: 'Specialty Shortage Heatmap', detail: 'Pressure overlays for constrained markets.' },
  { key: 'rising', label: 'Rising Investigators', detail: 'Emerging investigator clusters.' },
];

export function MapLegendStrip() {
  return (
    <div className="space-y-2">
      <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--vital-map-text-muted)]">Legend</p>
      <div className="grid gap-2 text-[11px] text-[var(--vital-map-text)]">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--vital-map-node-institution)]" />
            Institution
          </span>
          <span className="flex items-center gap-2">
            <span className="h-3.5 w-3.5 rounded-full border border-[var(--vital-map-ring-rising)]" />
            Rising
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--vital-map-node-cluster)]" />
            Cluster
          </span>
          <span className="flex items-center gap-2">
            <span className="h-3.5 w-3.5 rounded-full border border-[var(--vital-map-ring-stable)]" />
            Stable
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <span className="block h-[2px] w-9 rounded-full bg-[var(--vital-map-arc)] opacity-35" />
            Weak arc
          </span>
          <span className="flex items-center gap-2">
            <span className="block h-[2px] w-9 rounded-full bg-[var(--vital-map-arc-active)] opacity-80" />
            Strong arc
          </span>
        </div>
      </div>
    </div>
  );
}

export function MapLayerControlCard({
  collapsed,
  flaggedRegionCount,
  layerState,
  onSetCollapsed,
  onToggleLayer,
}: {
  collapsed: boolean;
  flaggedRegionCount: number;
  layerState: Record<MapLayerKey, boolean>;
  onSetCollapsed: (next: boolean) => void;
  onToggleLayer: (key: MapLayerKey) => void;
}) {
  if (collapsed) {
    return (
      <div className="vital-map-panel flex flex-col items-center gap-3 rounded-[1.2rem] px-2 py-3">
        <button
          type="button"
          onClick={() => onSetCollapsed(false)}
          className="vital-map-control-button"
          aria-label="Expand map layers"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <div className="flex flex-col gap-2">
          {LAYER_COPY.map((layer) => (
            <button
              key={layer.key}
              type="button"
              aria-pressed={layerState[layer.key]}
              onClick={() => onToggleLayer(layer.key)}
              className={cn(
                'vital-map-control-button',
                layerState[layer.key] ? 'vital-map-control-button--active' : 'vital-map-control-button--muted',
              )}
            >
              {layer.key === 'rising' ? <Sparkles className="h-4 w-4" /> : <Layers2 className="h-4 w-4" />}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <section className="vital-map-panel w-[min(20rem,calc(100vw-2rem))] rounded-[1.25rem] px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--vital-map-text-muted)]">Global Intelligence Map</p>
          <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-[var(--vital-map-text-subtle)]">
            live · {flaggedRegionCount} regions flagged
          </p>
        </div>
        <button
          type="button"
          onClick={() => onSetCollapsed(true)}
          className="vital-map-control-button"
          aria-label="Collapse map layers"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 space-y-3">
        <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--vital-map-text-muted)]">Layers</p>
        {LAYER_COPY.map((layer) => (
          <button
            key={layer.key}
            type="button"
            aria-pressed={layerState[layer.key]}
            onClick={() => onToggleLayer(layer.key)}
            className={cn(
              'flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition',
              layerState[layer.key]
                ? 'border-[var(--vital-map-accent)] bg-[var(--vital-map-accent-soft)] text-[var(--vital-map-text-strong)]'
                : 'border-[var(--vital-map-border)] bg-[var(--vital-map-panel-raised)] text-[var(--vital-map-text)]',
            )}
          >
            <span className={cn(
              'mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[0.35rem] border text-[10px] font-semibold',
              layerState[layer.key]
                ? 'border-[var(--vital-map-accent)] bg-[var(--vital-map-accent)] text-[var(--vital-map-ocean)]'
                : 'border-[var(--vital-map-border)] text-[var(--vital-map-text-subtle)]',
            )}>
              {layerState[layer.key] ? '✓' : ''}
            </span>
            <span className="min-w-0">
              <span className="block text-[11px] font-semibold">{layer.label}</span>
              <span className="mt-1 block text-[10px] leading-4 text-[var(--vital-map-text-muted)]">{layer.detail}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="mt-4 border-t border-[var(--vital-map-border)] pt-4">
        <MapLegendStrip />
      </div>
    </section>
  );
}

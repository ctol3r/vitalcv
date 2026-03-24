'use client';

import * as React from 'react';
import { Activity, Radar, Signal } from 'lucide-react';
import type { MapLayerKey } from '@/lib/intelligence/map-contracts';
import { formatRelativeTime } from '@/lib/intelligence/time';

const LAYER_LABELS: Record<MapLayerKey, string> = {
  momentum: 'Momentum',
  collaboration: 'Collaboration',
  shortage: 'Shortage',
  rising: 'Rising investigators',
};

export function MapStatusBar({
  activeLayers,
  flaggedRegionCount,
  statusMessage,
  updatedAt,
}: {
  activeLayers: MapLayerKey[];
  flaggedRegionCount: number;
  statusMessage: string;
  updatedAt: string;
}) {
  return (
    <div className="vital-map-panel flex max-w-[min(92vw,58rem)] flex-wrap items-center gap-2 rounded-full px-3 py-2">
      <span className="vital-map-status-pill">
        <Activity className="h-3.5 w-3.5" />
        live
      </span>
      <span className="vital-map-status-pill vital-map-status-pill--neutral">
        <Signal className="h-3.5 w-3.5" />
        {flaggedRegionCount} regions flagged
      </span>
      <span className="vital-map-status-pill vital-map-status-pill--neutral">
        <Radar className="h-3.5 w-3.5" />
        {activeLayers.map((layer) => LAYER_LABELS[layer]).join(' · ')}
      </span>
      <span className="truncate text-[11px] uppercase tracking-[0.18em] text-[var(--vital-map-text-muted)]">
        {statusMessage}
      </span>
      <span className="ml-auto text-[11px] font-mono text-[var(--vital-map-text-subtle)]">
        updated {formatRelativeTime(updatedAt)}
      </span>
    </div>
  );
}

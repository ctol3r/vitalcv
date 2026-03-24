'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { Crosshair, Minus, Plus, RefreshCw } from 'lucide-react';
import type { MapInstitution, MapInstitutionLayer } from '@/app/api/map/institutions/route';
import type { MapNetworkEdge, MapNetworkLayer, MapNetworkNode } from '@/app/api/map/network/route';
import type { MapShortageLayer, MapStateShortage } from '@/app/api/map/shortages/route';
import type { MapLayerKey, MapViewportState } from '@/lib/intelligence/map-contracts';
import { buildGlobalIntelligenceMapModel } from '@/lib/intelligence/map-model';
import { formatAbsoluteTime, formatRelativeTime } from '@/lib/intelligence/time';
import { OpsCard, SurfaceBanner, SurfaceErrorState } from './primitives';
import { OperationsShell } from './shell';
import { GeoNodeTooltip } from './map/GeoNodeTooltip';
import { MapLayerControlCard } from './map/MapLayerControlCard';
import { MapStatusBar } from './map/MapStatusBar';
import { RegionDetailDrawer } from './map/RegionDetailDrawer';

const GeoMapCanvas = dynamic(
  () => import('./map/GeoMapCanvas').then((module) => ({ default: module.GeoMapCanvas })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[42rem] items-center justify-center text-sm text-[var(--vt-text-3)]">
        Loading global intelligence map…
      </div>
    ),
  },
);

const DEFAULT_VIEW_STATE: MapViewportState = {
  center: [-20, 26],
  zoom: 1.04,
};

const DEFAULT_LAYER_STATE: Record<MapLayerKey, boolean> = {
  momentum: true,
  collaboration: true,
  shortage: true,
  rising: false,
};

interface GlobalMapResponse {
  institutions: MapInstitution[];
  shortages: MapStateShortage[];
  networkNodes: MapNetworkNode[];
  networkEdges: MapNetworkEdge[];
  updatedAt: string;
}

function clampZoom(value: number) {
  return Math.min(2.2, Math.max(0.9, Number(value.toFixed(2))));
}

async function fetchJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Request failed for ${url}: HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function combinedUpdatedAt(values: Array<string | undefined>) {
  return [...values]
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0]
    ?? new Date().toISOString();
}

function useGlobalMapData() {
  const [data, setData] = useState<GlobalMapResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);

    try {
      const controller = signal ? null : new AbortController();
      const resolvedSignal = signal ?? controller?.signal;
      if (!resolvedSignal) {
        throw new Error('Missing abort signal');
      }

      const [institutions, shortages, network] = await Promise.all([
        fetchJson<MapInstitutionLayer>('/api/map/institutions', resolvedSignal),
        fetchJson<MapShortageLayer>('/api/map/shortages', resolvedSignal),
        fetchJson<MapNetworkLayer>('/api/map/network', resolvedSignal),
      ]);

      setData({
        institutions: institutions.institutions,
        shortages: shortages.states,
        networkNodes: network.nodes,
        networkEdges: network.edges,
        updatedAt: combinedUpdatedAt([institutions.lastUpdated, shortages.lastUpdated, network.lastUpdated]),
      });
    } catch (nextError) {
      if (nextError instanceof Error && nextError.name === 'AbortError') {
        return;
      }
      setError(nextError instanceof Error ? nextError.message : 'Failed to load map data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);

    const interval = window.setInterval(() => {
      void load();
    }, 60_000);

    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, [load]);

  return { data, error, loading, refresh: () => load() };
}

export function GlobalIntelligenceMapSurface() {
  const reducedMotion = useReducedMotion() ?? false;
  const { data, error, loading, refresh } = useGlobalMapData();
  const [layerState, setLayerState] = useState(DEFAULT_LAYER_STATE);
  const [controlCollapsed, setControlCollapsed] = useState(false);
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
  const [hoveredClusterId, setHoveredClusterId] = useState<string | null>(null);
  const [hoveredConnectionId, setHoveredConnectionId] = useState<string | null>(null);
  const [tooltipAnchor, setTooltipAnchor] = useState<{ x: number; y: number } | null>(null);
  const [viewState, setViewState] = useState(DEFAULT_VIEW_STATE);
  const [viewportWidth, setViewportWidth] = useState(1440);

  useEffect(() => {
    const updateViewportWidth = () => setViewportWidth(window.innerWidth);
    updateViewportWidth();
    window.addEventListener('resize', updateViewportWidth);
    return () => window.removeEventListener('resize', updateViewportWidth);
  }, []);

  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedClusterId(null);
      }
    };

    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, []);

  const model = useMemo(() => {
    if (!data) {
      return null;
    }

    return {
      ...buildGlobalIntelligenceMapModel({
        institutions: data.institutions,
        shortages: data.shortages,
        networkNodes: data.networkNodes,
        networkEdges: data.networkEdges,
      }),
      updatedAt: data.updatedAt,
    };
  }, [data]);

  const allClusters = useMemo(() => {
    if (!model) {
      return new Map<string, ReturnType<typeof buildGlobalIntelligenceMapModel>['clusters'][number]>();
    }

    return new Map([
      ...model.clusters.map((cluster) => [cluster.id, cluster] as const),
      ...model.risingInvestigators.map((cluster) => [cluster.id, cluster] as const),
    ]);
  }, [model]);

  const activeLayers = useMemo(
    () => (Object.entries(layerState)
      .filter(([, active]) => active)
      .map(([key]) => key as MapLayerKey)),
    [layerState],
  );

  const hoveredCluster = hoveredClusterId ? allClusters.get(hoveredClusterId) ?? null : null;
  const selectedDetail = model && selectedClusterId ? model.detailByClusterId[selectedClusterId] ?? null : null;
  const hoveredConnection = model?.connections.find((connection) => connection.id === hoveredConnectionId) ?? null;
  const statusMessage = useMemo(() => {
    if (hoveredConnection && model) {
      const source = model.clusters.find((cluster) => cluster.id === hoveredConnection.sourceClusterId);
      const target = model.clusters.find((cluster) => cluster.id === hoveredConnection.targetClusterId);
      return `${source?.geography ?? 'Source'} ↔ ${target?.geography ?? 'Target'} · ${hoveredConnection.relationshipCount} pathways · ${hoveredConnection.strengthLabel}`;
    }
    if (hoveredCluster) {
      return `${hoveredCluster.label} · ${hoveredCluster.topSpecialty} · ${hoveredCluster.topInstitutions[0] ?? 'No lead institution'}`;
    }
    if (selectedDetail) {
      return `${selectedDetail.regionLabel} selected · ${selectedDetail.topSpecialty} · ${selectedDetail.providerCount.toLocaleString()} providers in scope`;
    }
    return 'Hover a region to inspect networks, or click a cluster to open region detail.';
  }, [hoveredCluster, hoveredConnection, model, selectedDetail]);

  const handleHoverCluster = useCallback((clusterId: string | null, anchor: { x: number; y: number } | null) => {
    setHoveredConnectionId(null);
    setHoveredClusterId(clusterId);
    setTooltipAnchor(anchor);
  }, []);

  const handleHoverConnection = useCallback((connectionId: string | null, _anchor: { x: number; y: number } | null) => {
    void _anchor;
    setHoveredClusterId(null);
    setTooltipAnchor(null);
    setHoveredConnectionId(connectionId);
  }, []);

  const handleSelectCluster = useCallback((clusterId: string) => {
    setHoveredConnectionId(null);
    setHoveredClusterId(clusterId);
    setTooltipAnchor(null);
    setSelectedClusterId(clusterId);
  }, []);

  const drawerWidth = viewportWidth < 920 ? 'full' : 'detail';

  return (
    <OperationsShell
      activeHref="/intelligence?view=graph"
      activeNavKey="graph"
      title="Global Intelligence Map"
      description="Geospatial collaboration pressure, institution momentum, and shortage overlays in a command-center map."
      breadcrumbs={[{ label: 'Global Map' }]}
      meta={(
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--vt-text-3)]">Map state</p>
          <p>{model?.clusters.length ?? 0} regions · {model?.connections.length ?? 0} active networks</p>
          {model?.updatedAt ? (
            <p title={formatAbsoluteTime(model.updatedAt)}>Updated {formatRelativeTime(model.updatedAt)}</p>
          ) : null}
        </div>
      )}
      actions={(
        <button
          type="button"
          onClick={refresh}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface-2)] px-4 py-2 text-sm font-medium text-[var(--vt-text-1)] transition hover:bg-[var(--vt-surface-2)]"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      )}
      banner={(
        error && model ? (
          <SurfaceBanner tone="warning">
            Live map refresh failed. Showing the last confirmed regional snapshot while the data plane recovers.
          </SurfaceBanner>
        ) : undefined
      )}
    >
      {!model && error ? (
        <SurfaceErrorState
          title="Global intelligence map unavailable"
          description={error}
          onRetry={refresh}
        />
      ) : (
        <OpsCard className="overflow-hidden p-0">
          <div className="vital-map-stage">
            {model ? (
              <GeoMapCanvas
                clusters={model.clusters}
                connections={model.connections}
                hoveredClusterId={hoveredClusterId}
                hoveredConnectionId={hoveredConnectionId}
                layers={layerState}
                reducedMotion={reducedMotion}
                risingInvestigators={model.risingInvestigators}
                selectedClusterId={selectedClusterId}
                viewState={viewState}
                onHoverCluster={handleHoverCluster}
                onHoverConnection={handleHoverConnection}
                onSelectCluster={handleSelectCluster}
                onViewStateChange={setViewState}
              />
            ) : (
              <div className="flex h-full min-h-[42rem] items-center justify-center text-sm text-[var(--vt-text-3)]">
                Preparing geospatial intelligence…
              </div>
            )}

            <div className="absolute left-4 top-4 z-10">
              <MapLayerControlCard
                collapsed={controlCollapsed}
                flaggedRegionCount={model?.flaggedRegionCount ?? 0}
                layerState={layerState}
                onSetCollapsed={setControlCollapsed}
                onToggleLayer={(key) => setLayerState((current) => ({ ...current, [key]: !current[key] }))}
              />
            </div>

            <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setViewState((current) => ({ ...current, zoom: clampZoom(current.zoom + 0.16) }))}
                className="vital-map-control-button vital-map-control-button--active"
                aria-label="Zoom in"
              >
                <Plus className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewState((current) => ({ ...current, zoom: clampZoom(current.zoom - 0.16) }))}
                className="vital-map-control-button"
                aria-label="Zoom out"
              >
                <Minus className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewState(DEFAULT_VIEW_STATE)}
                className="vital-map-control-button"
                aria-label="Recenter map"
              >
                <Crosshair className="h-4 w-4" />
              </button>
            </div>

            {model ? (
              <div className="absolute bottom-4 left-4 z-10 max-w-[calc(100%-8rem)]">
                <MapStatusBar
                  activeLayers={activeLayers}
                  flaggedRegionCount={model.flaggedRegionCount}
                  statusMessage={statusMessage}
                  updatedAt={model.updatedAt}
                />
              </div>
            ) : null}

            {!loading && model ? (
              <GeoNodeTooltip
                anchor={tooltipAnchor}
                cluster={hoveredCluster}
              />
            ) : null}
          </div>
        </OpsCard>
      )}

      <RegionDetailDrawer
        detail={selectedDetail}
        open={Boolean(selectedDetail)}
        onClose={() => setSelectedClusterId(null)}
        width={drawerWidth}
      />
    </OperationsShell>
  );
}

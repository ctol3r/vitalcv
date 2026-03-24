'use client';

import * as React from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  Graticule,
  Line,
  Marker,
  Sphere,
  ZoomableGroup,
} from 'react-simple-maps';
import type { KeyboardEvent, MouseEvent } from 'react';
import type {
  GeoClusterSummary,
  GeoConnection,
  MapLayerKey,
  MapViewportState,
} from '@/lib/intelligence/map-contracts';

const WORLD_TOPO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

function nodeRadius(influenceScore: number) {
  if (influenceScore >= 88) {
    return 14;
  }
  if (influenceScore >= 76) {
    return 10;
  }
  if (influenceScore >= 58) {
    return 7;
  }
  return 4;
}

function glowRadius(influenceScore: number) {
  if (influenceScore >= 88) {
    return 20;
  }
  if (influenceScore >= 76) {
    return 14;
  }
  if (influenceScore >= 58) {
    return 10;
  }
  return 6;
}

function heatRadii(severity: GeoClusterSummary['shortageSeverity']) {
  switch (severity) {
    case 'critical':
      return [54, 34, 18] as const;
    case 'high':
      return [46, 28, 16] as const;
    case 'moderate':
      return [36, 22, 12] as const;
    case 'low':
      return [24, 16, 8] as const;
    case 'none':
    case 'unknown':
    default:
      return [0, 0, 0] as const;
  }
}

function nodeColor(entityType: GeoClusterSummary['entityType']) {
  switch (entityType) {
    case 'institution':
      return 'var(--vital-map-node-institution)';
    case 'investigator_cluster':
      return 'var(--vital-map-node-investigator)';
    case 'pressure_hub':
      return 'var(--vital-map-node-pressure)';
    case 'regional_cluster':
    default:
      return 'var(--vital-map-node-cluster)';
  }
}

function ringColor(momentumState: GeoClusterSummary['momentumState']) {
  switch (momentumState) {
    case 'rising':
      return 'var(--vital-map-ring-rising)';
    case 'cooling':
      return 'var(--vital-map-ring-cooling)';
    case 'declining':
      return 'var(--vital-map-ring-critical)';
    case 'stable':
    default:
      return 'var(--vital-map-ring-stable)';
  }
}

function selectedClusterIdForNode(clusterId: string) {
  return clusterId.endsWith(':rising') ? clusterId.replace(/:rising$/, '') : clusterId;
}

function pointerAnchor(event: MouseEvent<SVGElement>) {
  return { x: event.clientX, y: event.clientY };
}

function keyboardSelect(event: KeyboardEvent<SVGGElement>, onSelect: () => void) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    onSelect();
  }
}

export function ShortageHeatLayer({
  clusters,
}: {
  clusters: GeoClusterSummary[];
}) {
  return (
    <>
      {clusters.map((cluster) => {
        const [outerRadius, middleRadius, innerRadius] = heatRadii(cluster.shortageSeverity);
        if (outerRadius <= 0) {
          return null;
        }

        return (
          <Marker key={`heat:${cluster.id}`} coordinates={[cluster.coordinates.lng, cluster.coordinates.lat]}>
            <g pointerEvents="none">
              <circle r={outerRadius} fill="var(--vital-map-heat-outer)" opacity={0.1} />
              <circle r={middleRadius} fill="var(--vital-map-heat-mid)" opacity={0.18} />
              <circle r={innerRadius} fill="var(--vital-map-heat-core)" opacity={0.24} />
            </g>
          </Marker>
        );
      })}
    </>
  );
}

export function NetworkArcLayer({
  activeClusterIds,
  connections,
  connectionLookup,
  hoveredConnectionId,
  hoveredClusterId,
  onHoverConnection,
}: {
  activeClusterIds: Set<string>;
  connections: GeoConnection[];
  connectionLookup: Map<string, GeoClusterSummary>;
  hoveredConnectionId: string | null;
  hoveredClusterId: string | null;
  onHoverConnection: (connectionId: string | null, anchor: { x: number; y: number } | null) => void;
}) {
  return (
    <>
      {connections.map((connection) => {
        const source = connectionLookup.get(connection.sourceClusterId);
        const target = connectionLookup.get(connection.targetClusterId);
        if (!source || !target) {
          return null;
        }

        const active = hoveredConnectionId === connection.id || (
          hoveredClusterId !== null
          && (connection.sourceClusterId === hoveredClusterId || connection.targetClusterId === hoveredClusterId)
        );
        const dimmed = activeClusterIds.size > 0 && !active && !activeClusterIds.has(connection.sourceClusterId) && !activeClusterIds.has(connection.targetClusterId);
        const strokeOpacity = dimmed ? 0.22 : active ? 0.68 : 0.16 + (connection.weight * 0.06);
        const strokeWidth = active ? 1.25 : 0.85 + (connection.weight * 0.6);

        return (
          <Line
            key={connection.id}
            from={[source.coordinates.lng, source.coordinates.lat]}
            to={[target.coordinates.lng, target.coordinates.lat]}
            stroke={active ? 'var(--vital-map-arc-active)' : 'var(--vital-map-arc)'}
            strokeOpacity={strokeOpacity}
            strokeWidth={strokeWidth}
            fill="none"
            onMouseEnter={(event) => onHoverConnection(connection.id, pointerAnchor(event))}
            onMouseMove={(event) => onHoverConnection(connection.id, pointerAnchor(event))}
            onMouseLeave={() => onHoverConnection(null, null)}
            style={{ cursor: 'pointer' }}
          />
        );
      })}
    </>
  );
}

export function SelectionHaloLayer({
  clusters,
  momentumVisible,
  reducedMotion,
  selectedClusterId,
  hoveredClusterId,
}: {
  clusters: GeoClusterSummary[];
  momentumVisible: boolean;
  reducedMotion: boolean;
  selectedClusterId: string | null;
  hoveredClusterId: string | null;
}) {
  return (
    <>
      {clusters.map((cluster) => {
        const selected = selectedClusterId === selectedClusterIdForNode(cluster.id);
        const hovered = hoveredClusterId === cluster.id;
        const ringRadius = nodeRadius(cluster.influenceScore) + 5;
        const pulseRadius = ringRadius + 4;

        if (!momentumVisible && !selected && !hovered) {
          return null;
        }

        return (
          <Marker key={`halo:${cluster.id}`} coordinates={[cluster.coordinates.lng, cluster.coordinates.lat]}>
            <g pointerEvents="none">
              <circle
                r={ringRadius}
                fill="none"
                stroke={selected ? 'var(--vital-map-accent-bright)' : ringColor(cluster.momentumState)}
                strokeWidth={selected ? 1.8 : 1.2}
                opacity={selected || hovered ? 0.95 : 0.68}
              />
              {!reducedMotion && momentumVisible && cluster.momentumState === 'rising' ? (
                <circle
                  r={pulseRadius}
                  fill="none"
                  stroke="var(--vital-map-ring-rising)"
                  strokeWidth={1.2}
                  opacity={0.42}
                  className="vital-map-node-pulse"
                />
              ) : null}
            </g>
          </Marker>
        );
      })}
    </>
  );
}

export function GeoNodeLayer({
  activeClusterIds,
  clusters,
  labelThresholdZoom,
  selectedClusterId,
  viewState,
  onHoverCluster,
  onSelectCluster,
}: {
  activeClusterIds: Set<string>;
  clusters: GeoClusterSummary[];
  labelThresholdZoom: number;
  selectedClusterId: string | null;
  viewState: MapViewportState;
  onHoverCluster: (clusterId: string | null, anchor: { x: number; y: number } | null) => void;
  onSelectCluster: (clusterId: string) => void;
}) {
  return (
    <>
      {clusters.map((cluster) => {
        const selected = selectedClusterId === selectedClusterIdForNode(cluster.id);
        const focused = selected || activeClusterIds.has(cluster.id);
        const dimmed = activeClusterIds.size > 0 && !focused;
        const radius = nodeRadius(cluster.influenceScore);
        const glow = glowRadius(cluster.influenceScore);
        const showLabel = selected || viewState.zoom >= labelThresholdZoom;

        return (
          <Marker key={cluster.id} coordinates={[cluster.coordinates.lng, cluster.coordinates.lat]}>
            <g
              role="button"
              tabIndex={0}
              aria-label={`Open ${cluster.label}`}
              onMouseEnter={(event) => onHoverCluster(cluster.id, pointerAnchor(event))}
              onMouseMove={(event) => onHoverCluster(cluster.id, pointerAnchor(event))}
              onMouseLeave={() => onHoverCluster(null, null)}
              onClick={() => onSelectCluster(selectedClusterIdForNode(cluster.id))}
              onKeyDown={(event) => keyboardSelect(event, () => onSelectCluster(selectedClusterIdForNode(cluster.id)))}
              style={{ cursor: 'pointer', opacity: dimmed ? 0.22 : 1 }}
            >
              <circle
                r={glow}
                fill={nodeColor(cluster.entityType)}
                opacity={focused ? 0.2 : 0.14}
              />
              <circle
                r={focused ? radius * 1.2 : radius}
                fill={nodeColor(cluster.entityType)}
                stroke="var(--vital-map-node-stroke)"
                strokeWidth={1}
              />
              {showLabel ? (
                <>
                  <text
                    y={-(radius + 8)}
                    textAnchor="middle"
                    className="vital-map-node__label"
                    fill="var(--vital-map-text-strong)"
                  >
                    {cluster.geography}
                  </text>
                  <text
                    y={radius + 14}
                    textAnchor="middle"
                    className="vital-map-node__metric"
                    fill="var(--vital-map-text-muted)"
                  >
                    {cluster.providerCount.toLocaleString()}
                  </text>
                </>
              ) : null}
            </g>
          </Marker>
        );
      })}
    </>
  );
}

export function GeoMapCanvas({
  clusters,
  connections,
  hoveredClusterId,
  hoveredConnectionId,
  layers,
  reducedMotion,
  risingInvestigators,
  selectedClusterId,
  viewState,
  onHoverCluster,
  onHoverConnection,
  onSelectCluster,
  onViewStateChange,
}: {
  clusters: GeoClusterSummary[];
  connections: GeoConnection[];
  hoveredClusterId: string | null;
  hoveredConnectionId: string | null;
  layers: Record<MapLayerKey, boolean>;
  reducedMotion: boolean;
  risingInvestigators: GeoClusterSummary[];
  selectedClusterId: string | null;
  viewState: MapViewportState;
  onHoverCluster: (clusterId: string | null, anchor: { x: number; y: number } | null) => void;
  onHoverConnection: (connectionId: string | null, anchor: { x: number; y: number } | null) => void;
  onSelectCluster: (clusterId: string) => void;
  onViewStateChange: (nextState: MapViewportState) => void;
}) {
  const clusterLookup = new Map(clusters.map((cluster) => [cluster.id, cluster]));
  const activeClusterIds = new Set<string>();
  const hoveredBaseClusterId = hoveredClusterId ? selectedClusterIdForNode(hoveredClusterId) : null;

  if (selectedClusterId) {
    activeClusterIds.add(selectedClusterId);
  }
  if (hoveredBaseClusterId) {
    activeClusterIds.add(hoveredBaseClusterId);
  }
  if (hoveredConnectionId) {
    const connection = connections.find((item) => item.id === hoveredConnectionId);
    if (connection) {
      activeClusterIds.add(connection.sourceClusterId);
      activeClusterIds.add(connection.targetClusterId);
    }
  }

  return (
    <ComposableMap
      width={1200}
      height={680}
      projection="geoEqualEarth"
      projectionConfig={{ scale: 230 }}
      style={{ width: '100%', height: '100%' }}
    >
      <Sphere fill="var(--vital-map-ocean)" stroke="var(--vital-map-border)" strokeWidth={0.4} />
      <ZoomableGroup
        zoom={viewState.zoom}
        center={viewState.center}
        onMoveEnd={({ zoom, coordinates }: { zoom: number; coordinates: [number, number] }) => {
          onViewStateChange({ zoom, center: coordinates });
        }}
      >
        <Graticule
          step={[20, 20]}
          stroke="var(--vital-map-grid)"
          strokeOpacity={0.55}
          strokeWidth={0.5}
        />
        <Geographies geography={WORLD_TOPO_URL}>
          {({ geographies }) => geographies.map((geo) => (
            <Geography
              key={geo.rsmKey}
              geography={geo}
              fill="var(--vital-map-land)"
              stroke="var(--vital-map-border)"
              strokeOpacity={0.45}
              strokeWidth={0.35}
              style={{
                default: { outline: 'none' },
                hover: { outline: 'none' },
                pressed: { outline: 'none' },
              }}
            />
          ))}
        </Geographies>

        {layers.shortage ? <ShortageHeatLayer clusters={clusters} /> : null}
        {layers.collaboration ? (
          <NetworkArcLayer
            activeClusterIds={activeClusterIds}
            connections={connections}
            connectionLookup={clusterLookup}
            hoveredConnectionId={hoveredConnectionId}
            hoveredClusterId={hoveredBaseClusterId}
            onHoverConnection={onHoverConnection}
          />
        ) : null}
        <SelectionHaloLayer
          clusters={clusters}
          momentumVisible={layers.momentum}
          reducedMotion={reducedMotion}
          selectedClusterId={selectedClusterId}
          hoveredClusterId={hoveredClusterId}
        />
        <GeoNodeLayer
          activeClusterIds={activeClusterIds}
          clusters={clusters}
          labelThresholdZoom={1.48}
          selectedClusterId={selectedClusterId}
          viewState={viewState}
          onHoverCluster={onHoverCluster}
          onSelectCluster={onSelectCluster}
        />
        {layers.rising ? (
          <GeoNodeLayer
            activeClusterIds={activeClusterIds}
            clusters={risingInvestigators}
            labelThresholdZoom={1.62}
            selectedClusterId={selectedClusterId}
            viewState={viewState}
            onHoverCluster={onHoverCluster}
            onSelectCluster={onSelectCluster}
          />
        ) : null}
      </ZoomableGroup>
    </ComposableMap>
  );
}

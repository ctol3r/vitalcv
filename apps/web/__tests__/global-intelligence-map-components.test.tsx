// @vitest-environment jsdom

import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('react-simple-maps', () => ({
  ComposableMap: ({
    children,
    projection,
    projectionConfig,
    ...props
  }: React.SVGProps<SVGSVGElement> & {
    children?: React.ReactNode;
    projection?: string;
    projectionConfig?: unknown;
  }) => {
    void projection;
    void projectionConfig;
    return <svg {...props}>{children}</svg>;
  },
  ZoomableGroup: ({ children }: { children?: React.ReactNode }) => <g>{children}</g>,
  Geographies: ({
    children,
  }: {
    children: (data: {
      geographies: Array<{ rsmKey: string; properties: Record<string, string> }>;
    }) => React.ReactNode;
  }) => <>{children({ geographies: [{ rsmKey: 'geo-1', properties: { name: 'Testland' } }] })}</>,
  Geography: ({
    geography,
    ...props
  }: React.SVGProps<SVGPathElement> & { geography: { rsmKey: string } }) => <path data-testid={geography.rsmKey} {...props} />,
  Marker: ({
    children,
    coordinates,
    ...props
  }: React.SVGProps<SVGGElement> & {
    children?: React.ReactNode;
    coordinates?: [number, number];
  }) => {
    void coordinates;
    return <g {...props}>{children}</g>;
  },
  Line: ({
    children,
    from,
    to,
    ...props
  }: React.SVGProps<SVGPathElement> & { from?: [number, number]; to?: [number, number] }) => (
    <path data-testid="map-line" {...props}>{children}</path>
  ),
  Sphere: (props: React.SVGProps<SVGPathElement>) => <path data-testid="sphere" {...props} />,
  Graticule: (props: React.SVGProps<SVGPathElement>) => <path data-testid="graticule" {...props} />,
}));

vi.mock('@/components/ui/Drawer', () => ({
  Drawer: ({
    children,
    open,
    title,
  }: {
    children?: React.ReactNode;
    open: boolean;
    title: React.ReactNode;
  }) => (
    open ? (
      <div data-testid="drawer">
        <div>{title}</div>
        <div>{children}</div>
      </div>
    ) : null
  ),
}));

import { GeoMapCanvas } from '@/components/intelligence-ops/map/GeoMapCanvas';
import { MapLayerControlCard } from '@/components/intelligence-ops/map/MapLayerControlCard';
import { RegionDetailDrawer } from '@/components/intelligence-ops/map/RegionDetailDrawer';
import type { GeoClusterSummary, GeoRegionDetailPayload } from '@/lib/intelligence/map-contracts';

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function render(node: React.ReactElement) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(node);
  });
  return container;
}

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = null;
  container?.remove();
  container = null;
  vi.clearAllMocks();
});

const CLUSTERS: GeoClusterSummary[] = [
  {
    id: 'region:CA',
    geography: 'CA',
    label: 'California Cluster',
    coordinates: { lng: -122.4, lat: 37.7 },
    entityType: 'regional_cluster',
    influenceScore: 82,
    providerCount: 1500,
    topInstitutions: ['UCSF Medical Center', 'Stanford Health Care'],
    topSpecialty: 'Oncology',
    momentumState: 'rising',
    shortageSeverity: 'moderate',
    institutionCount: 2,
    systemCount: 2,
    sourceInstitutionIds: ['inst-1', 'inst-12'],
    sourceNetworkNodeIds: ['stanford'],
    risingInvestigatorCount: 2,
  },
  {
    id: 'region:MA',
    geography: 'MA',
    label: 'Massachusetts Cluster',
    coordinates: { lng: -71.0, lat: 42.3 },
    entityType: 'institution',
    influenceScore: 76,
    providerCount: 1240,
    topInstitutions: ['Mass General Brigham'],
    topSpecialty: 'Cardiology',
    momentumState: 'stable',
    shortageSeverity: 'low',
    institutionCount: 1,
    systemCount: 1,
    sourceInstitutionIds: ['inst-2'],
    sourceNetworkNodeIds: ['mgb'],
    risingInvestigatorCount: 0,
  },
];

const RISING: GeoClusterSummary[] = [
  {
    ...CLUSTERS[0]!,
    id: 'region:CA:rising',
    label: 'Rising investigators · CA',
    entityType: 'investigator_cluster',
    coordinates: { lng: -120.1, lat: 36.8 },
    topSpecialty: 'Oncology',
    momentumState: 'rising',
  },
];

const DETAIL: GeoRegionDetailPayload = {
  clusterId: 'region:CA',
  regionLabel: 'California Cluster',
  providerCount: 1500,
  systemCount: 2,
  topSpecialty: 'Oncology',
  topInstitutions: ['UCSF Medical Center', 'Stanford Health Care'],
  momentumState: 'rising',
  shortageSeverity: 'moderate',
  momentumSummary: 'California is accelerating, led by UCSF Medical Center.',
  shortageSummary: 'Moderate pressure in California.',
  institutions: [
    {
      id: 'inst-1',
      name: 'UCSF Medical Center',
      city: 'San Francisco',
      state: 'CA',
      providerCount: 412,
      avgTrustScore: 82,
      topSpecialty: 'Oncology',
      momentumState: 'rising',
      readyCount: 318,
      partialCount: 72,
      blockedCount: 22,
    },
  ],
  providerCohorts: [
    {
      id: 'cohort-1',
      label: 'Oncology cohort',
      specialty: 'Oncology',
      providerCount: 182,
      trustScore: 82,
      momentumState: 'rising',
    },
  ],
  topSpecialties: [{ specialty: 'Oncology', providerCount: 182 }],
};

describe('global intelligence map components', () => {
  it('fires hover, selection, and connection callbacks from the map canvas', () => {
    const onHoverCluster = vi.fn();
    const onHoverConnection = vi.fn();
    const onSelectCluster = vi.fn();

    const view = render(
      <GeoMapCanvas
        clusters={CLUSTERS}
        connections={[{
          id: 'conn-1',
          sourceClusterId: 'region:CA',
          targetClusterId: 'region:MA',
          weight: 0.8,
          networkType: 'institutional',
          relationshipCount: 3,
          strengthLabel: 'strong',
        }]}
        hoveredClusterId={null}
        hoveredConnectionId={null}
        layers={{ momentum: true, collaboration: true, shortage: true, rising: true }}
        reducedMotion={false}
        risingInvestigators={RISING}
        selectedClusterId={null}
        viewState={{ center: [-20, 26], zoom: 1.4 }}
        onHoverCluster={onHoverCluster}
        onHoverConnection={onHoverConnection}
        onSelectCluster={onSelectCluster}
        onViewStateChange={() => undefined}
      />,
    );

    const california = view.querySelector('[aria-label="Open California Cluster"]');
    expect(california).toBeTruthy();

    act(() => {
      california?.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 120, clientY: 140 }));
    });
    expect(onHoverCluster).toHaveBeenCalledWith('region:CA', { x: 120, y: 140 });

    act(() => {
      california?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onSelectCluster).toHaveBeenCalledWith('region:CA');

    const line = view.querySelector('[data-testid="map-line"]');
    expect(line).toBeTruthy();
    act(() => {
      line?.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 210, clientY: 160 }));
    });
    expect(onHoverConnection).toHaveBeenCalledWith('conn-1', { x: 210, y: 160 });
  });

  it('removes pulsing rings when reduced motion is enabled', () => {
    const motionOff = render(
      <GeoMapCanvas
        clusters={CLUSTERS}
        connections={[]}
        hoveredClusterId="region:CA"
        hoveredConnectionId={null}
        layers={{ momentum: true, collaboration: false, shortage: false, rising: false }}
        reducedMotion
        risingInvestigators={[]}
        selectedClusterId="region:CA"
        viewState={{ center: [-20, 26], zoom: 1.6 }}
        onHoverCluster={() => undefined}
        onHoverConnection={() => undefined}
        onSelectCluster={() => undefined}
        onViewStateChange={() => undefined}
      />,
    );

    expect(motionOff.querySelector('.vital-map-node-pulse')).toBeNull();

    act(() => {
      root?.unmount();
    });
    container?.remove();

    const motionOn = render(
      <GeoMapCanvas
        clusters={CLUSTERS}
        connections={[]}
        hoveredClusterId="region:CA"
        hoveredConnectionId={null}
        layers={{ momentum: true, collaboration: false, shortage: false, rising: false }}
        reducedMotion={false}
        risingInvestigators={[]}
        selectedClusterId="region:CA"
        viewState={{ center: [-20, 26], zoom: 1.6 }}
        onHoverCluster={() => undefined}
        onHoverConnection={() => undefined}
        onSelectCluster={() => undefined}
        onViewStateChange={() => undefined}
      />,
    );

    expect(motionOn.querySelector('.vital-map-node-pulse')).not.toBeNull();
  });

  it('renders layer controls and the region detail drawer content', () => {
    const onToggleLayer = vi.fn();
    const onSetCollapsed = vi.fn();
    const view = render(
      <>
        <MapLayerControlCard
          collapsed={false}
          flaggedRegionCount={12}
          layerState={{ momentum: true, collaboration: true, shortage: true, rising: false }}
          onSetCollapsed={onSetCollapsed}
          onToggleLayer={onToggleLayer}
        />
        <RegionDetailDrawer
          detail={DETAIL}
          open
          onClose={() => undefined}
          width="detail"
        />
      </>,
    );

    expect(view.textContent).toContain('Global Intelligence Map');
    expect(view.textContent).toContain('Institutional Momentum');
    expect(view.textContent).toContain('Rising Investigators');
    expect(view.textContent).toContain('California Cluster');
    expect(view.textContent).toContain('UCSF Medical Center');
    expect(view.textContent).toContain('Oncology cohort');

    const toggleButtons = [...view.querySelectorAll('button')].filter((button) => button.textContent?.includes('Rising Investigators'));
    act(() => {
      toggleButtons[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onToggleLayer).toHaveBeenCalledWith('rising');
  });
});

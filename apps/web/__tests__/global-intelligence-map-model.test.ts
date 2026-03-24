import { describe, expect, it } from 'vitest';
import type { MapInstitution } from '@/app/api/map/institutions/route';
import type { MapNetworkEdge, MapNetworkNode } from '@/app/api/map/network/route';
import type { MapStateShortage } from '@/app/api/map/shortages/route';
import { buildGlobalIntelligenceMapModel } from '@/lib/intelligence/map-model';

const INSTITUTIONS: MapInstitution[] = [
  {
    id: 'inst-1',
    name: 'UCSF Medical Center',
    npi: '1003882564',
    lat: 37.7627,
    lng: -122.4573,
    state: 'CA',
    city: 'San Francisco',
    institutionType: 'hospital',
    providerCount: 412,
    readyCount: 318,
    partialCount: 72,
    blockedCount: 22,
    avgTrustScore: 82,
  },
  {
    id: 'inst-2',
    name: 'Mass General Brigham',
    npi: '1528060954',
    lat: 42.3629,
    lng: -71.0686,
    state: 'MA',
    city: 'Boston',
    institutionType: 'health_system',
    providerCount: 1240,
    readyCount: 1020,
    partialCount: 185,
    blockedCount: 35,
    avgTrustScore: 88,
  },
];

const SHORTAGES: MapStateShortage[] = [
  {
    state: 'CA',
    stateName: 'California',
    shortageLevel: 'moderate',
    hpsaDesignationCount: 412,
    projectedGapPcp: 3200,
    physiciansPerHundredK: 299,
    hasCriticalRural: false,
    contextLabel: 'Moderate pressure in California',
    decisionGrade: false,
  },
  {
    state: 'MA',
    stateName: 'Massachusetts',
    shortageLevel: 'low',
    hpsaDesignationCount: 62,
    projectedGapPcp: 140,
    physiciansPerHundredK: 356,
    hasCriticalRural: false,
    contextLabel: 'Low pressure in Massachusetts',
    decisionGrade: false,
  },
];

const NETWORK_NODES: MapNetworkNode[] = [
  {
    id: 'nppes',
    label: 'NPPES (CMS)',
    nodeType: 'government_source',
    lat: 38.8951,
    lng: -77.0364,
    state: 'DC',
    coverageScore: 100,
    providerCount: 7200000,
    isLaunchSpine: true,
  },
  {
    id: 'stanford',
    label: 'Stanford Health Care',
    nodeType: 'institution',
    lat: 37.4328,
    lng: -122.1745,
    state: 'CA',
    coverageScore: 87,
    providerCount: 840,
    isLaunchSpine: false,
  },
  {
    id: 'mgb',
    label: 'Mass General Brigham',
    nodeType: 'institution',
    lat: 42.3629,
    lng: -71.0686,
    state: 'MA',
    coverageScore: 88,
    providerCount: 1240,
    isLaunchSpine: false,
  },
];

const NETWORK_EDGES: MapNetworkEdge[] = [
  { sourceId: 'nppes', targetId: 'stanford', edgeType: 'verification_flow', strength: 0.95 },
  { sourceId: 'nppes', targetId: 'mgb', edgeType: 'verification_flow', strength: 0.95 },
];

describe('buildGlobalIntelligenceMapModel', () => {
  it('builds clusters, connections, and region detail payloads from map sources', () => {
    const model = buildGlobalIntelligenceMapModel({
      institutions: INSTITUTIONS,
      shortages: SHORTAGES,
      networkNodes: NETWORK_NODES,
      networkEdges: NETWORK_EDGES,
    });

    expect(model.clusters.length).toBeGreaterThanOrEqual(3);
    expect(model.connections.length).toBeGreaterThanOrEqual(2);
    expect(model.flaggedRegionCount).toBeGreaterThan(0);

    const california = model.clusters.find((cluster) => cluster.geography === 'CA');
    expect(california).toBeTruthy();
    expect(california?.topInstitutions).toContain('UCSF Medical Center');
    expect(california?.topSpecialty).toBeTruthy();

    const californiaDetail = california ? model.detailByClusterId[california.id] : null;
    expect(californiaDetail).toBeTruthy();
    expect(californiaDetail?.institutions.some((institution) => institution.name.includes('UCSF'))).toBe(true);
    expect(californiaDetail?.providerCohorts.length).toBeGreaterThan(0);
    expect(californiaDetail?.topSpecialties[0]?.providerCount).toBeGreaterThan(0);
  });
});

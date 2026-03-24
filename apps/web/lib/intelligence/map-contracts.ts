export type MapLayerKey = 'momentum' | 'collaboration' | 'shortage' | 'rising';

export type GeoEntityType =
  | 'institution'
  | 'regional_cluster'
  | 'investigator_cluster'
  | 'pressure_hub';

export type GeoMomentumState =
  | 'rising'
  | 'stable'
  | 'cooling'
  | 'declining';

export type GeoShortageSeverity =
  | 'critical'
  | 'high'
  | 'moderate'
  | 'low'
  | 'none'
  | 'unknown';

export type GeoConnectionType =
  | 'verification_flow'
  | 'federation_link'
  | 'data_provider'
  | 'institutional'
  | 'specialty_alignment';

export interface GeoCoordinate {
  lng: number;
  lat: number;
}

export interface GeoProviderCohort {
  id: string;
  label: string;
  specialty: string;
  providerCount: number;
  trustScore: number | null;
  momentumState: GeoMomentumState;
}

export interface GeoInstitutionDetail {
  id: string;
  name: string;
  city: string;
  state: string;
  providerCount: number;
  avgTrustScore: number | null;
  topSpecialty: string;
  momentumState: GeoMomentumState;
  readyCount: number;
  partialCount: number;
  blockedCount: number;
}

export interface GeoClusterSummary {
  id: string;
  geography: string;
  label: string;
  coordinates: GeoCoordinate;
  entityType: GeoEntityType;
  influenceScore: number;
  providerCount: number;
  topInstitutions: string[];
  topSpecialty: string;
  momentumState: GeoMomentumState;
  shortageSeverity: GeoShortageSeverity;
  institutionCount: number;
  systemCount: number;
  sourceInstitutionIds: string[];
  sourceNetworkNodeIds: string[];
  risingInvestigatorCount: number;
}

export interface GeoConnection {
  id: string;
  sourceClusterId: string;
  targetClusterId: string;
  weight: number;
  networkType: GeoConnectionType;
  relationshipCount: number;
  strengthLabel: string;
}

export interface GeoRegionDetailPayload {
  clusterId: string;
  regionLabel: string;
  providerCount: number;
  systemCount: number;
  topSpecialty: string;
  topInstitutions: string[];
  momentumState: GeoMomentumState;
  shortageSeverity: GeoShortageSeverity;
  momentumSummary: string;
  shortageSummary: string;
  institutions: GeoInstitutionDetail[];
  providerCohorts: GeoProviderCohort[];
  topSpecialties: Array<{
    specialty: string;
    providerCount: number;
  }>;
}

export interface GlobalIntelligenceMapModel {
  clusters: GeoClusterSummary[];
  risingInvestigators: GeoClusterSummary[];
  connections: GeoConnection[];
  detailByClusterId: Record<string, GeoRegionDetailPayload>;
  flaggedRegionCount: number;
  totalProviderCount: number;
  totalSystemCount: number;
  updatedAt: string;
}

export interface MapViewportState {
  center: [number, number];
  zoom: number;
}

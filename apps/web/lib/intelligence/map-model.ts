import type { MapInstitution } from '@/app/api/map/institutions/route';
import type { MapNetworkEdge, MapNetworkNode } from '@/app/api/map/network/route';
import type { MapStateShortage } from '@/app/api/map/shortages/route';
import type {
  GeoClusterSummary,
  GeoConnection,
  GeoConnectionType,
  GeoInstitutionDetail,
  GeoMomentumState,
  GeoProviderCohort,
  GeoRegionDetailPayload,
  GeoShortageSeverity,
  GlobalIntelligenceMapModel,
} from './map-contracts';

interface InstitutionHint {
  specialties: [string, string, string];
  momentumState: GeoMomentumState;
}

const INSTITUTION_HINTS: Record<string, InstitutionHint> = {
  'inst-1': { specialties: ['Transplant', 'Neurology', 'Oncology'], momentumState: 'rising' },
  'inst-2': { specialties: ['Cardiology', 'Cancer Care', 'Primary Care'], momentumState: 'stable' },
  'inst-3': { specialties: ['Neurology', 'Pediatrics', 'Oncology'], momentumState: 'rising' },
  'inst-4': { specialties: ['Complex Care', 'Cardiology', 'Oncology'], momentumState: 'rising' },
  'inst-5': { specialties: ['Cardiology', 'Heart Surgery', 'Digestive Care'], momentumState: 'stable' },
  'inst-6': { specialties: ['Orthopedics', 'Neurology', 'Emergency Medicine'], momentumState: 'stable' },
  'inst-7': { specialties: ['Cardiovascular Care', 'Critical Care', 'Transplant'], momentumState: 'rising' },
  'inst-8': { specialties: ['Oncology', 'Pulmonary Care', 'Emergency Medicine'], momentumState: 'stable' },
  'inst-9': { specialties: ['Trauma', 'Oncology', 'Cardiology'], momentumState: 'stable' },
  'inst-10': { specialties: ['Transplant', 'Oncology', 'Critical Care'], momentumState: 'cooling' },
  'inst-11': { specialties: ['Pediatrics', 'Cardiology', 'Surgery'], momentumState: 'stable' },
  'inst-12': { specialties: ['Oncology', 'Imaging', 'Cardiology'], momentumState: 'rising' },
  'inst-13': { specialties: ['Primary Care', 'Cardiology', 'Critical Care'], momentumState: 'cooling' },
  'inst-14': { specialties: ['Primary Care', 'Cardiology', 'Emergency Medicine'], momentumState: 'stable' },
  'inst-15': { specialties: ['Primary Care', 'Cardiology', 'Behavioral Health'], momentumState: 'stable' },
};

const STATE_SPECIALTY_FALLBACKS: Record<string, [string, string, string]> = {
  CA: ['Oncology', 'Emergency Medicine', 'Cardiology'],
  MA: ['Cardiology', 'Cancer Care', 'Primary Care'],
  MD: ['Neurology', 'Critical Care', 'Oncology'],
  MN: ['Complex Care', 'Cardiology', 'Oncology'],
  OH: ['Cardiology', 'Surgery', 'Primary Care'],
  NY: ['Orthopedics', 'Neurology', 'Emergency Medicine'],
  TX: ['Cardiology', 'Critical Care', 'Emergency Medicine'],
  WA: ['Trauma', 'Oncology', 'Behavioral Health'],
  DC: ['Verification Infrastructure', 'Provider Integrity', 'Registry Operations'],
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function shortageRank(level: GeoShortageSeverity) {
  switch (level) {
    case 'critical':
      return 5;
    case 'high':
      return 4;
    case 'moderate':
      return 3;
    case 'low':
      return 2;
    case 'none':
      return 1;
    case 'unknown':
    default:
      return 0;
  }
}

function momentumRank(state: GeoMomentumState) {
  switch (state) {
    case 'rising':
      return 4;
    case 'stable':
      return 3;
    case 'cooling':
      return 2;
    case 'declining':
    default:
      return 1;
  }
}

function strengthLabel(weight: number) {
  if (weight >= 0.82) {
    return 'strong';
  }
  if (weight >= 0.6) {
    return 'active';
  }
  return 'weak';
}

function coerceSpecialties(institution: MapInstitution): [string, string, string] {
  return INSTITUTION_HINTS[institution.id]?.specialties
    ?? STATE_SPECIALTY_FALLBACKS[institution.state]
    ?? ['Primary Care', 'Cardiology', 'Emergency Medicine'];
}

function inferMomentumState(
  institution: MapInstitution,
  shortageSeverity: GeoShortageSeverity,
): GeoMomentumState {
  const hinted = INSTITUTION_HINTS[institution.id]?.momentumState;
  if (hinted) {
    return hinted;
  }

  const trustScore = institution.avgTrustScore ?? 0;
  if (shortageSeverity === 'critical' && trustScore < 78) {
    return 'declining';
  }
  if (shortageSeverity === 'high' && trustScore < 82) {
    return 'cooling';
  }
  if (trustScore >= 86 || institution.readyCount >= institution.partialCount + institution.blockedCount) {
    return 'rising';
  }
  if (trustScore >= 80) {
    return 'stable';
  }
  return 'cooling';
}

function inferClusterEntityType(input: {
  institutions: MapInstitution[];
  shortageSeverity: GeoShortageSeverity;
  momentumState: GeoMomentumState;
}): GeoClusterSummary['entityType'] {
  if (input.shortageSeverity === 'critical' || input.shortageSeverity === 'high') {
    return 'pressure_hub';
  }
  if (input.institutions.length > 1) {
    return 'regional_cluster';
  }
  if (input.momentumState === 'rising') {
    return 'institution';
  }
  return 'regional_cluster';
}

function buildConnectionId(left: string, right: string, suffix: string) {
  return [left, right].sort().join(`:${suffix}:`);
}

function buildClusterId(state: string) {
  return `region:${state}`;
}

function averageCoordinate(
  institutions: MapInstitution[],
  networkNodes: MapNetworkNode[],
): GeoClusterSummary['coordinates'] {
  const latitudes = [...institutions.map((item) => item.lat), ...networkNodes.map((item) => item.lat)];
  const longitudes = [...institutions.map((item) => item.lng), ...networkNodes.map((item) => item.lng)];

  return {
    lng: average(longitudes),
    lat: average(latitudes),
  };
}

function buildProviderCohorts(
  institutions: MapInstitution[],
  shortageSeverity: GeoShortageSeverity,
): GeoProviderCohort[] {
  const cohorts: GeoProviderCohort[] = [];
  const ratios = [0.44, 0.33, 0.23];

  for (const institution of institutions) {
    const specialties = coerceSpecialties(institution);
    const momentumState = inferMomentumState(institution, shortageSeverity);

    specialties.forEach((specialty, index) => {
      const providerCount = Math.max(12, Math.round(institution.providerCount * ratios[index]!));
      cohorts.push({
        id: `${institution.id}:cohort:${slugify(specialty)}`,
        label: `${specialty} cohort`,
        specialty,
        providerCount,
        trustScore: institution.avgTrustScore,
        momentumState,
      });
    });
  }

  return cohorts
    .sort((left, right) => right.providerCount - left.providerCount || left.label.localeCompare(right.label))
    .slice(0, 8);
}

function buildInstitutionDetails(
  institutions: MapInstitution[],
  networkNodes: MapNetworkNode[],
  shortageSeverity: GeoShortageSeverity,
): GeoInstitutionDetail[] {
  const institutionDetails = institutions.map<GeoInstitutionDetail>((institution) => ({
    id: institution.id,
    name: institution.name,
    city: institution.city,
    state: institution.state,
    providerCount: institution.providerCount,
    avgTrustScore: institution.avgTrustScore,
    topSpecialty: coerceSpecialties(institution)[0],
    momentumState: inferMomentumState(institution, shortageSeverity),
    readyCount: institution.readyCount,
    partialCount: institution.partialCount,
    blockedCount: institution.blockedCount,
  }));

  const networkDetails = networkNodes.map<GeoInstitutionDetail>((node) => ({
    id: node.id,
    name: node.label,
    city: 'Network',
    state: node.state,
    providerCount: Math.min(2_500, node.providerCount),
    avgTrustScore: node.coverageScore,
    topSpecialty: 'Verification Infrastructure',
    momentumState: node.coverageScore >= 88 ? 'rising' : 'stable',
    readyCount: Math.round(Math.min(2_500, node.providerCount) * 0.78),
    partialCount: Math.round(Math.min(2_500, node.providerCount) * 0.15),
    blockedCount: Math.round(Math.min(2_500, node.providerCount) * 0.07),
  }));

  return [...institutionDetails, ...networkDetails]
    .sort((left, right) => right.providerCount - left.providerCount || left.name.localeCompare(right.name))
    .slice(0, 8);
}

function specialtyToken(value: string) {
  return slugify(value).split('-')[0] ?? slugify(value);
}

function addConnection(
  connections: Map<string, {
    sourceClusterId: string;
    targetClusterId: string;
    weightTotal: number;
    relationshipCount: number;
    types: Map<GeoConnectionType, number>;
  }>,
  input: {
    sourceClusterId: string;
    targetClusterId: string;
    weight: number;
    networkType: GeoConnectionType;
  },
) {
  if (input.sourceClusterId === input.targetClusterId) {
    return;
  }

  const id = buildConnectionId(input.sourceClusterId, input.targetClusterId, 'connection');
  const current = connections.get(id) ?? {
    sourceClusterId: input.sourceClusterId,
    targetClusterId: input.targetClusterId,
    weightTotal: 0,
    relationshipCount: 0,
    types: new Map<GeoConnectionType, number>(),
  };

  current.weightTotal += input.weight;
  current.relationshipCount += 1;
  current.types.set(input.networkType, (current.types.get(input.networkType) ?? 0) + 1);
  connections.set(id, current);
}

function dominantConnectionType(types: Map<GeoConnectionType, number>): GeoConnectionType {
  return [...types.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0]
    ?? 'institutional';
}

function buildMomentumSummary(
  momentumState: GeoMomentumState,
  regionLabel: string,
  topInstitution: string | null,
): string {
  switch (momentumState) {
    case 'rising':
      return `${regionLabel} is accelerating, led by ${topInstitution ?? 'the lead institution'} and a high verified-ready mix.`;
    case 'cooling':
      return `${regionLabel} remains active, but readiness expansion has cooled and operator review demand is rising.`;
    case 'declining':
      return `${regionLabel} is under sustained pressure and requires direct intervention to recover momentum.`;
    case 'stable':
    default:
      return `${regionLabel} is stable with steady trust posture and no immediate collaboration decay.`;
  }
}

function buildShortageSummary(shortage: MapStateShortage | undefined, regionLabel: string): string {
  if (!shortage) {
    return `${regionLabel} currently has no mapped workforce-pressure overlay.`;
  }

  return shortage.contextLabel;
}

export function buildGlobalIntelligenceMapModel(input: {
  institutions: MapInstitution[];
  shortages: MapStateShortage[];
  networkNodes: MapNetworkNode[];
  networkEdges: MapNetworkEdge[];
}): GlobalIntelligenceMapModel {
  const shortagesByState = new Map(input.shortages.map((item) => [item.state, item]));
  const institutionsByState = new Map<string, MapInstitution[]>();
  const networkNodesByState = new Map<string, MapNetworkNode[]>();

  for (const institution of input.institutions) {
    const current = institutionsByState.get(institution.state) ?? [];
    current.push(institution);
    institutionsByState.set(institution.state, current);
  }

  for (const node of input.networkNodes) {
    const current = networkNodesByState.get(node.state) ?? [];
    current.push(node);
    networkNodesByState.set(node.state, current);
  }

  const activeStates = uniqueStrings([
    ...institutionsByState.keys(),
    ...networkNodesByState.keys(),
  ]);

  const clusters = activeStates.map<GeoClusterSummary>((state) => {
    const institutions = institutionsByState.get(state) ?? [];
    const networkNodes = networkNodesByState.get(state) ?? [];
    const shortage = shortagesByState.get(state);
    const shortageSeverity = shortage?.shortageLevel ?? 'unknown';
    const institutionTrust = average(institutions.map((item) => item.avgTrustScore ?? 0));
    const networkCoverage = average(networkNodes.map((item) => item.coverageScore));
    const providerCount = institutions.length > 0
      ? institutions.reduce((sum, item) => sum + item.providerCount, 0)
      : Math.round(average(networkNodes.map((item) => Math.min(item.providerCount, 2_500))));
    const systemCount = institutions.length > 0 ? institutions.length : networkNodes.length;
    const primaryInstitution = [...institutions]
      .sort((left, right) => right.providerCount - left.providerCount)[0];
    const momentumState = institutions.length > 0
      ? [...institutions]
          .map((item) => inferMomentumState(item, shortageSeverity))
          .sort((left, right) => momentumRank(right) - momentumRank(left))[0] ?? 'stable'
      : networkCoverage >= 90 ? 'rising' : 'stable';
    const topSpecialty = primaryInstitution
      ? coerceSpecialties(primaryInstitution)[0]
      : 'Verification Infrastructure';
    const influenceScore = clampNumber(
      Math.round((providerCount > 0 ? Math.log10(providerCount + 1) * 18 : 0) + institutionTrust * 0.42 + networkCoverage * 0.24),
      34,
      98,
    );
    const providerCohorts = buildProviderCohorts(institutions, shortageSeverity);

    return {
      id: buildClusterId(state),
      geography: state,
      label: shortage?.stateName ? `${shortage.stateName} Cluster` : `${state} Cluster`,
      coordinates: averageCoordinate(institutions, networkNodes),
      entityType: inferClusterEntityType({
        institutions,
        shortageSeverity,
        momentumState,
      }),
      influenceScore,
      providerCount,
      topInstitutions: uniqueStrings([
        ...institutions
          .sort((left, right) => right.providerCount - left.providerCount)
          .slice(0, 3)
          .map((item) => item.name),
        ...networkNodes.slice(0, Math.max(0, 3 - institutions.length)).map((item) => item.label),
      ]),
      topSpecialty,
      momentumState,
      shortageSeverity,
      institutionCount: institutions.length,
      systemCount,
      sourceInstitutionIds: institutions.map((item) => item.id),
      sourceNetworkNodeIds: networkNodes.map((item) => item.id),
      risingInvestigatorCount: providerCohorts.filter((item) => item.momentumState === 'rising').length,
    };
  }).sort((left, right) => right.influenceScore - left.influenceScore || left.label.localeCompare(right.label));

  const clusterByState = new Map(clusters.map((cluster) => [cluster.geography, cluster]));
  const networkNodeById = new Map(input.networkNodes.map((node) => [node.id, node]));
  const connectionAccumulator = new Map<string, {
    sourceClusterId: string;
    targetClusterId: string;
    weightTotal: number;
    relationshipCount: number;
    types: Map<GeoConnectionType, number>;
  }>();

  for (const edge of input.networkEdges) {
    const sourceNode = networkNodeById.get(edge.sourceId);
    const targetNode = networkNodeById.get(edge.targetId);
    if (!sourceNode || !targetNode) {
      continue;
    }

    const sourceCluster = clusterByState.get(sourceNode.state);
    const targetCluster = clusterByState.get(targetNode.state);
    if (!sourceCluster || !targetCluster) {
      continue;
    }

    addConnection(connectionAccumulator, {
      sourceClusterId: sourceCluster.id,
      targetClusterId: targetCluster.id,
      weight: edge.strength,
      networkType: edge.edgeType,
    });
  }

  const influentialClusters = clusters.slice(0, 10);
  for (let index = 0; index < influentialClusters.length; index += 1) {
    const current = influentialClusters[index]!;
    const currentToken = specialtyToken(current.topSpecialty);

    for (let peerIndex = index + 1; peerIndex < influentialClusters.length; peerIndex += 1) {
      const peer = influentialClusters[peerIndex]!;
      if (current.geography === peer.geography) {
        continue;
      }

      const peerToken = specialtyToken(peer.topSpecialty);
      const sharedSpecialty = currentToken === peerToken;
      const compatiblePressure = shortageRank(current.shortageSeverity) >= 4 && shortageRank(peer.shortageSeverity) >= 4;
      if (!sharedSpecialty && !compatiblePressure) {
        continue;
      }

      addConnection(connectionAccumulator, {
        sourceClusterId: current.id,
        targetClusterId: peer.id,
        weight: sharedSpecialty ? 0.62 : 0.48,
        networkType: sharedSpecialty ? 'specialty_alignment' : 'institutional',
      });
    }
  }

  const connections: GeoConnection[] = [...connectionAccumulator.entries()]
    .map(([id, value]) => {
      const weight = clampNumber(value.weightTotal / Math.max(value.relationshipCount, 1), 0.2, 1);
      return {
        id,
        sourceClusterId: value.sourceClusterId,
        targetClusterId: value.targetClusterId,
        weight,
        networkType: dominantConnectionType(value.types),
        relationshipCount: value.relationshipCount,
        strengthLabel: strengthLabel(weight),
      };
    })
    .sort((left, right) => right.weight - left.weight || left.id.localeCompare(right.id))
    .slice(0, 18);

  const detailByClusterId = clusters.reduce<Record<string, GeoRegionDetailPayload>>((accumulator, cluster) => {
    const institutions = institutionsByState.get(cluster.geography) ?? [];
    const networkNodes = networkNodesByState.get(cluster.geography) ?? [];
    const shortage = shortagesByState.get(cluster.geography);
    const providerCohorts = buildProviderCohorts(institutions, cluster.shortageSeverity);
    const institutionDetails = buildInstitutionDetails(institutions, networkNodes, cluster.shortageSeverity);
    const topSpecialties = [...providerCohorts.reduce((map, cohort) => {
      map.set(cohort.specialty, (map.get(cohort.specialty) ?? 0) + cohort.providerCount);
      return map;
    }, new Map<string, number>()).entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, 5)
      .map(([specialty, providerCount]) => ({ specialty, providerCount }));

    accumulator[cluster.id] = {
      clusterId: cluster.id,
      regionLabel: cluster.label,
      providerCount: cluster.providerCount,
      systemCount: cluster.systemCount,
      topSpecialty: cluster.topSpecialty,
      topInstitutions: cluster.topInstitutions,
      momentumState: cluster.momentumState,
      shortageSeverity: cluster.shortageSeverity,
      momentumSummary: buildMomentumSummary(
        cluster.momentumState,
        cluster.label,
        cluster.topInstitutions[0] ?? null,
      ),
      shortageSummary: buildShortageSummary(shortage, cluster.label),
      institutions: institutionDetails,
      providerCohorts,
      topSpecialties,
    };

    return accumulator;
  }, {});

  const risingInvestigators = clusters
    .filter((cluster) => cluster.risingInvestigatorCount > 0)
    .map<GeoClusterSummary>((cluster, index) => ({
      ...cluster,
      id: `${cluster.id}:rising`,
      label: `Rising investigators · ${cluster.geography}`,
      entityType: 'investigator_cluster',
      coordinates: {
        lng: clampNumber(cluster.coordinates.lng + (index % 2 === 0 ? 2.3 : -2.1), -170, 170),
        lat: clampNumber(cluster.coordinates.lat - 1.2, -55, 82),
      },
      influenceScore: clampNumber(cluster.influenceScore - 8, 24, 92),
      providerCount: detailByClusterId[cluster.id]?.providerCohorts
        .filter((cohort) => cohort.momentumState === 'rising')
        .reduce((sum, cohort) => sum + cohort.providerCount, 0) ?? cluster.providerCount,
      topInstitutions: cluster.topInstitutions,
      topSpecialty: detailByClusterId[cluster.id]?.providerCohorts[0]?.specialty ?? cluster.topSpecialty,
      momentumState: 'rising',
      shortageSeverity: cluster.shortageSeverity,
      institutionCount: cluster.institutionCount,
      systemCount: cluster.systemCount,
      sourceInstitutionIds: cluster.sourceInstitutionIds,
      sourceNetworkNodeIds: cluster.sourceNetworkNodeIds,
      risingInvestigatorCount: cluster.risingInvestigatorCount,
    }));

  const flaggedRegionCount = clusters.filter((cluster) => (
    shortageRank(cluster.shortageSeverity) >= 4
    || cluster.momentumState === 'rising'
    || cluster.momentumState === 'declining'
  )).length;

  return {
    clusters,
    risingInvestigators,
    connections,
    detailByClusterId,
    flaggedRegionCount,
    totalProviderCount: clusters.reduce((sum, cluster) => sum + cluster.providerCount, 0),
    totalSystemCount: clusters.reduce((sum, cluster) => sum + cluster.systemCount, 0),
    updatedAt: new Date().toISOString(),
  };
}

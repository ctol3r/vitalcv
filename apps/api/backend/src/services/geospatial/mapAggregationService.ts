import Supercluster from 'supercluster';
import { Prisma, type PrismaClient } from '@prisma/client';
import prisma from '../../graphql/prisma_client';
import { computeExpertiseScarcity, type ScarcitySignal } from '../intelligence/workforceIntelligenceService';
import { createGraphNodeId } from '../graph-engine/ids';
import { log } from '../../obs/logger';
import { getCachedGeospatialPayload, getGeospatialDataVersion, setCachedGeospatialPayload } from './geospatialCache';
import {
  clusterPoints,
  clusterRadiusKm,
  feature,
  featureCollection,
  lineStringGeometry,
  pointGeometry,
  type BoundingBox,
  type ClusterablePoint,
  type GeoJsonFeatureCollection,
  type GeoJsonGeometry,
} from '../../../../../../core/geospatial';

const COLLABORATION_EDGE_TYPES = ['co_author', 'co_practice_group', 'shared_industry_relationship', 'co_trial'];
const MAX_RAW_INSTITUTION_POINTS = 400;
const GeocodeStatus = {
  GEOCODED: 'GEOCODED',
} as const;
const GeographicBoundaryType = {
  HPSA: 'HPSA',
  STATE: 'STATE',
} as const;

type MapQuery = {
  bbox: BoundingBox;
  zoom: number;
  state?: string;
  specialty?: string;
  limit: number;
  minMomentumScore?: number;
  minWeight?: number;
};

type VisibleInstitution = {
  id: string;
  canonicalName: string;
  slug: string;
  latitude: number;
  longitude: number;
  geocodePrecision: string;
  stateCode: string | null;
};

type InstitutionMomentumRow = {
  targetEntityId: string;
  targetEntityLabel: string | null;
  probability: number;
  confidence: number;
  explanation: string;
  evidenceSignals: Prisma.JsonValue;
  metadata: Prisma.JsonValue;
};

type InstitutionPointProperties = {
  kind: 'institution';
  institutionId: string;
  label: string;
  momentumScore: number;
  momentumState: string;
  providerCount: number;
  researchSignalCount: number;
  geocodePrecision: string;
  momentumSum: number;
  maxMomentumScore: number;
};

type InstitutionClusterAggregate = {
  momentumSum: number;
  maxMomentumScore: number;
};

type AggregatedInstitutionEdge = {
  edgeId: string;
  fromInstitutionId: string;
  toInstitutionId: string;
  fromLatitude: number;
  fromLongitude: number;
  toLatitude: number;
  toLongitude: number;
  weight: number;
  relationshipCount: number;
  sourceCount: number;
  avgMomentumScore: number;
};

type GroupedEndpoint = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  kind: 'institution' | 'cluster';
  institutionIds: string[];
};

type ClusterableInstitutionPoint = ClusterablePoint<{
  institutionId: string;
  label: string;
  momentumScore: number;
}>;

type ClusterIndexFeature = {
  type: 'Feature';
  id?: string | number;
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  properties: {
  institutionId: string;
  label: string;
  momentumScore: number;
  cluster?: boolean;
  cluster_id?: number;
  point_count?: number;
  };
};

type BoundaryRow = {
  id: string;
  boundaryType: string;
  stateCode: string | null;
  countyFips: string | null;
  centroidLat: Prisma.Decimal | null;
  centroidLng: Prisma.Decimal | null;
  bboxMinLat: Prisma.Decimal | null;
  bboxMinLng: Prisma.Decimal | null;
  bboxMaxLat: Prisma.Decimal | null;
  bboxMaxLng: Prisma.Decimal | null;
  geometryGeoJson: Prisma.JsonValue;
  metadata: Prisma.JsonValue;
  updatedAt: Date;
};

type InstitutionRow = {
  id: string;
  canonicalName: string;
  slug: string;
  latitude: Prisma.Decimal;
  longitude: Prisma.Decimal;
  geocodePrecision: string;
  stateCode: string | null;
};

type GeospatialPrismaClient = PrismaClient & {
  institution: {
    findMany(args: unknown): Promise<InstitutionRow[]>;
  };
  geographicBoundary: {
    findMany(args: unknown): Promise<BoundaryRow[]>;
  };
};

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeMomentumState(value: unknown): string {
  const raw = asString(value)?.toLowerCase();
  switch (raw) {
    case 'expanding':
    case 'stable':
    case 'contracting':
    case 'mixed':
      return raw;
    default:
      return 'insufficient_signal';
  }
}

function pressureStateFromScore(score: number | null): string {
  if (score === null) {
    return 'insufficient_signal';
  }

  if (score >= 80) return 'severe';
  if (score >= 60) return 'high';
  if (score >= 40) return 'moderate';
  return 'low';
}

function cacheOrCompute<T>(namespace: string, payload: unknown, compute: () => Promise<T>): Promise<T> {
  const cached = getCachedGeospatialPayload<T>(namespace, payload);
  if (cached) {
    return Promise.resolve(cached);
  }

  return compute().then((value) => setCachedGeospatialPayload(namespace, payload, value));
}

function overlapWhere(bbox: BoundingBox): Record<string, unknown> {
  return {
    bboxMinLng: { lte: bbox.maxLng },
    bboxMaxLng: { gte: bbox.minLng },
    bboxMinLat: { lte: bbox.maxLat },
    bboxMaxLat: { gte: bbox.minLat },
  };
}

function createEnvelope(
  schema: string,
  query: MapQuery,
  geojson: GeoJsonFeatureCollection<Record<string, unknown>>,
  stats: Record<string, unknown>,
) {
  return {
    schema,
    generatedAt: new Date().toISOString(),
    dataVersion: getGeospatialDataVersion(),
    viewport: {
      bbox: query.bbox,
      zoom: query.zoom,
    },
    stats,
    geojson,
  };
}

async function loadVisibleInstitutions(
  query: MapQuery,
  prismaClient: PrismaClient,
): Promise<VisibleInstitution[]> {
  const rows = await (prismaClient as GeospatialPrismaClient).institution.findMany({
    where: {
      geocodeStatus: GeocodeStatus.GEOCODED,
      latitude: {
        not: null,
        gte: new Prisma.Decimal(query.bbox.minLat),
        lte: new Prisma.Decimal(query.bbox.maxLat),
      },
      longitude: {
        not: null,
        gte: new Prisma.Decimal(query.bbox.minLng),
        lte: new Prisma.Decimal(query.bbox.maxLng),
      },
      ...(query.state ? { stateCode: query.state.toUpperCase() } : {}),
    },
    take: query.limit,
    orderBy: [
      { updatedAt: 'desc' },
      { canonicalName: 'asc' },
    ],
    select: {
      id: true,
      canonicalName: true,
      slug: true,
      latitude: true,
      longitude: true,
      geocodePrecision: true,
      stateCode: true,
    },
  });

  return rows.map((row) => ({
    id: row.id,
    canonicalName: row.canonicalName,
    slug: row.slug,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    geocodePrecision: row.geocodePrecision,
    stateCode: row.stateCode,
  }));
}

async function loadInstitutionMomentumMap(
  slugs: string[],
  prismaClient: PrismaClient,
): Promise<Map<string, InstitutionMomentumRow>> {
  if (slugs.length === 0) {
    return new Map();
  }

  const rows = await prismaClient.predictionInsight.findMany({
    where: {
      predictionType: 'INSTITUTION_MOMENTUM',
      targetEntityType: 'institution',
      targetEntityId: { in: slugs },
    },
    select: {
      targetEntityId: true,
      targetEntityLabel: true,
      probability: true,
      confidence: true,
      explanation: true,
      evidenceSignals: true,
      metadata: true,
    },
  });

  return new Map(rows.map((row) => [row.targetEntityId, row]));
}

async function loadInstitutionAffiliationRows(
  slugs: string[],
  prismaClient: PrismaClient,
): Promise<Array<{ subjectNpi: string; institutionSlug: string }>> {
  if (slugs.length === 0) {
    return [];
  }

  const slugList = Prisma.join(slugs);
  return prismaClient.$queryRaw<Array<{ subjectNpi: string; institutionSlug: string }>>(Prisma.sql`
    SELECT DISTINCT
      subject_npi AS "subjectNpi",
      trim(BOTH '-' FROM regexp_replace(lower(trim(coalesce(value->>'institution', ''))), '[^a-z0-9]+', '-', 'g')) AS "institutionSlug"
    FROM claim_records
    WHERE claim_type = 'INSTITUTION_AFFILIATION'
      AND status <> 'SUPERSEDED'
      AND trim(BOTH '-' FROM regexp_replace(lower(trim(coalesce(value->>'institution', ''))), '[^a-z0-9]+', '-', 'g')) IN (${slugList})
  `);
}

function createInstitutionPointProperties(
  institution: VisibleInstitution,
  momentumRow: InstitutionMomentumRow | undefined,
  providerCount: number,
): InstitutionPointProperties {
  const metadata = asRecord(momentumRow?.metadata);
  const researchSignals = Array.isArray(momentumRow?.evidenceSignals)
    ? momentumRow?.evidenceSignals.length
    : Array.isArray(asRecord(momentumRow?.evidenceSignals).signals)
      ? (asRecord(momentumRow?.evidenceSignals).signals as unknown[]).length
      : 0;
  const momentumScore = momentumRow ? clampScore(momentumRow.probability * 100) : 0;

  return {
    kind: 'institution',
    institutionId: institution.id,
    label: momentumRow?.targetEntityLabel ?? institution.canonicalName,
    momentumScore,
    momentumState: normalizeMomentumState(metadata.state),
    providerCount,
    researchSignalCount: researchSignals,
    geocodePrecision: institution.geocodePrecision,
    momentumSum: momentumScore,
    maxMomentumScore: momentumScore,
  };
}

function buildInstitutionClusterIndex(points: ClusterableInstitutionPoint[]): Supercluster<
  { institutionId: string; label: string; momentumScore: number },
  InstitutionClusterAggregate
> {
  const supercluster = new Supercluster<
    { institutionId: string; label: string; momentumScore: number },
    InstitutionClusterAggregate
  >({
    radius: 70,
    maxZoom: 20,
    map: (properties) => ({
      momentumSum: properties.momentumScore,
      maxMomentumScore: properties.momentumScore,
    }),
    reduce: (accumulated, next) => {
      accumulated.momentumSum += next.momentumSum;
      accumulated.maxMomentumScore = Math.max(accumulated.maxMomentumScore, next.maxMomentumScore);
    },
  });

  supercluster.load(points.map((point) => ({
    type: 'Feature',
    id: point.id,
    geometry: {
      type: 'Point',
      coordinates: [point.longitude, point.latitude],
    },
    properties: point.properties,
  })));

  return supercluster;
}

async function loadAggregatedInstitutionEdges(
  institutions: VisibleInstitution[],
  momentumBySlug: Map<string, InstitutionMomentumRow>,
  prismaClient: PrismaClient,
): Promise<AggregatedInstitutionEdge[]> {
  if (institutions.length === 0) {
    return [];
  }

  const institutionsBySlug = new Map(institutions.map((institution) => [institution.slug, institution]));
  const affiliations = await loadInstitutionAffiliationRows([...institutionsBySlug.keys()], prismaClient);
  const affiliationsByNpi = new Map<string, Set<string>>();

  for (const affiliation of affiliations) {
    const entry = affiliationsByNpi.get(affiliation.subjectNpi) ?? new Set<string>();
    entry.add(affiliation.institutionSlug);
    affiliationsByNpi.set(affiliation.subjectNpi, entry);
  }

  const npis = [...affiliationsByNpi.keys()];
  if (npis.length === 0) {
    return [];
  }

  const nodeIds = new Map<string, string>();
  for (const npi of npis) {
    nodeIds.set(createGraphNodeId({
      type: 'clinician',
      sourceKind: 'npi',
      sourceId: npi,
    }), npi);
  }

  const graphEdges = await prismaClient.graphEdge.findMany({
    where: {
      status: 'ACTIVE',
      edgeType: { in: COLLABORATION_EDGE_TYPES },
      sourceNodeId: { in: [...nodeIds.keys()] },
      targetNodeId: { in: [...nodeIds.keys()] },
    },
    select: {
      id: true,
      pairKey: true,
      edgeType: true,
      confidence: true,
      sourceNodeId: true,
      targetNodeId: true,
    },
  });

  const seenEdgePairs = new Set<string>();
  const aggregates = new Map<string, {
    fromInstitutionId: string;
    toInstitutionId: string;
    fromLatitude: number;
    fromLongitude: number;
    toLatitude: number;
    toLongitude: number;
    weight: number;
    relationshipCount: number;
    sourceTypes: Set<string>;
    avgMomentumAccumulator: number;
    avgMomentumCount: number;
  }>();

  for (const edge of graphEdges) {
    if (seenEdgePairs.has(edge.pairKey)) {
      continue;
    }
    seenEdgePairs.add(edge.pairKey);

    const sourceNpi = nodeIds.get(edge.sourceNodeId);
    const targetNpi = nodeIds.get(edge.targetNodeId);
    if (!sourceNpi || !targetNpi) {
      continue;
    }

    const sourceInstitutions = affiliationsByNpi.get(sourceNpi);
    const targetInstitutions = affiliationsByNpi.get(targetNpi);
    if (!sourceInstitutions || !targetInstitutions) {
      continue;
    }

    for (const sourceInstitutionSlug of sourceInstitutions) {
      for (const targetInstitutionSlug of targetInstitutions) {
        if (sourceInstitutionSlug === targetInstitutionSlug) {
          continue;
        }

        const sourceInstitution = institutionsBySlug.get(sourceInstitutionSlug);
        const targetInstitution = institutionsBySlug.get(targetInstitutionSlug);
        if (!sourceInstitution || !targetInstitution) {
          continue;
        }

        const ordered = [sourceInstitution, targetInstitution].sort((left, right) => left.id.localeCompare(right.id));
        const [fromInstitution, toInstitution] = ordered;
        const key = `${fromInstitution.id}:${toInstitution.id}`;
        const aggregate = aggregates.get(key) ?? {
          fromInstitutionId: fromInstitution.id,
          toInstitutionId: toInstitution.id,
          fromLatitude: fromInstitution.latitude,
          fromLongitude: fromInstitution.longitude,
          toLatitude: toInstitution.latitude,
          toLongitude: toInstitution.longitude,
          weight: 0,
          relationshipCount: 0,
          sourceTypes: new Set<string>(),
          avgMomentumAccumulator: 0,
          avgMomentumCount: 0,
        };
        aggregate.weight += edge.confidence;
        aggregate.relationshipCount += 1;
        aggregate.sourceTypes.add(edge.edgeType);

        const fromMomentum = momentumBySlug.get(fromInstitution.slug);
        const toMomentum = momentumBySlug.get(toInstitution.slug);
        if (fromMomentum) {
          aggregate.avgMomentumAccumulator += clampScore(fromMomentum.probability * 100);
          aggregate.avgMomentumCount += 1;
        }
        if (toMomentum) {
          aggregate.avgMomentumAccumulator += clampScore(toMomentum.probability * 100);
          aggregate.avgMomentumCount += 1;
        }

        aggregates.set(key, aggregate);
      }
    }
  }

  return [...aggregates.entries()]
    .map(([key, aggregate]) => ({
      edgeId: `institution-edge:${key}`,
      fromInstitutionId: aggregate.fromInstitutionId,
      toInstitutionId: aggregate.toInstitutionId,
      fromLatitude: aggregate.fromLatitude,
      fromLongitude: aggregate.fromLongitude,
      toLatitude: aggregate.toLatitude,
      toLongitude: aggregate.toLongitude,
      weight: Number(aggregate.weight.toFixed(4)),
      relationshipCount: aggregate.relationshipCount,
      sourceCount: aggregate.sourceTypes.size,
      avgMomentumScore: aggregate.avgMomentumCount === 0
        ? 0
        : Number((aggregate.avgMomentumAccumulator / aggregate.avgMomentumCount).toFixed(2)),
    }))
    .sort((left, right) => right.weight - left.weight);
}

function buildGroupingForInstitutions(
  institutions: VisibleInstitution[],
  momentumBySlug: Map<string, InstitutionMomentumRow>,
  bbox: BoundingBox,
  zoom: number,
): Map<string, GroupedEndpoint> {
  if (zoom >= 8 && institutions.length <= 150) {
    return new Map(institutions.map((institution) => [institution.id, {
      id: institution.id,
      label: institution.canonicalName,
      latitude: institution.latitude,
      longitude: institution.longitude,
      kind: 'institution' as const,
      institutionIds: [institution.id],
    }]));
  }

  const points: ClusterableInstitutionPoint[] = institutions.map((institution) => ({
    id: institution.id,
    latitude: institution.latitude,
    longitude: institution.longitude,
    properties: {
      institutionId: institution.id,
      label: institution.canonicalName,
      momentumScore: clampScore((momentumBySlug.get(institution.slug)?.probability ?? 0) * 100),
    },
  }));

  const index = buildInstitutionClusterIndex(points);
  const clusters = index.getClusters([bbox.minLng, bbox.minLat, bbox.maxLng, bbox.maxLat], zoom) as ClusterIndexFeature[];
  const groups = new Map<string, GroupedEndpoint>();

  for (const cluster of clusters) {
    const [longitude, latitude] = cluster.geometry.coordinates;
    if (cluster.properties.cluster && cluster.properties.cluster_id) {
      const leaves = index.getLeaves(cluster.properties.cluster_id, Infinity) as ClusterIndexFeature[];
      const clusterId = `cluster:${cluster.properties.cluster_id}`;
      const institutionIds = leaves
        .map((leaf) => leaf.properties.institutionId)
        .filter((value): value is string => typeof value === 'string');
      const preview = leaves
        .slice(0, 3)
        .map((leaf) => leaf.properties.label)
        .filter((value): value is string => typeof value === 'string')
        .join(', ');

      for (const institutionId of institutionIds) {
        groups.set(institutionId, {
          id: clusterId,
          label: preview || clusterId,
          latitude,
          longitude,
          kind: 'cluster',
          institutionIds,
        });
      }
      continue;
    }

    const institutionId = cluster.properties.institutionId;
    if (institutionId) {
      groups.set(institutionId, {
        id: institutionId,
        label: cluster.properties.label,
        latitude,
        longitude,
        kind: 'institution',
        institutionIds: [institutionId],
      });
    }
  }

  return groups;
}

export async function getMapInstitutions(
  query: MapQuery,
  prismaClient: PrismaClient = prisma,
) {
  return cacheOrCompute('map:institutions', query, async () => {
    const institutions = await loadVisibleInstitutions(query, prismaClient);
    const slugs = institutions.map((institution) => institution.slug);
    const [momentumBySlug, affiliations] = await Promise.all([
      loadInstitutionMomentumMap(slugs, prismaClient),
      loadInstitutionAffiliationRows(slugs, prismaClient),
    ]);

    const providerCounts = affiliations.reduce((map, row) => {
      map.set(row.institutionSlug, (map.get(row.institutionSlug) ?? 0) + 1);
      return map;
    }, new Map<string, number>());

    const points = institutions.map((institution) => ({
      id: institution.id,
      latitude: institution.latitude,
      longitude: institution.longitude,
      properties: createInstitutionPointProperties(
        institution,
        momentumBySlug.get(institution.slug),
        providerCounts.get(institution.slug) ?? 0,
      ),
    }));

    const clustered = clusterPoints<InstitutionPointProperties & InstitutionClusterAggregate>(
      points,
      query.bbox,
      query.zoom,
      (accumulated, next) => {
        accumulated.momentumSum += next.momentumSum;
        accumulated.maxMomentumScore = Math.max(accumulated.maxMomentumScore, next.maxMomentumScore);
      },
      () => ({
        kind: 'institution',
        institutionId: '',
        label: '',
        momentumScore: 0,
        momentumState: 'insufficient_signal',
        providerCount: 0,
        researchSignalCount: 0,
        geocodePrecision: 'UNRESOLVED',
        momentumSum: 0,
        maxMomentumScore: 0,
      }),
    );

    const useClusters = query.zoom < 8 || points.length > MAX_RAW_INSTITUTION_POINTS;
    const features: Array<ReturnType<typeof feature<Record<string, unknown>>>> = clustered
      .filter((entry) => useClusters || entry.pointCount === 1)
      .map((entry) => (
        entry.pointCount > 1
          ? feature<Record<string, unknown>>(
            pointGeometry(entry.longitude, entry.latitude),
            {
              clusterId: entry.id,
              pointCount: entry.pointCount,
              avgMomentumScore: Number((entry.properties.momentumSum / entry.pointCount).toFixed(2)),
              maxMomentumScore: entry.properties.maxMomentumScore,
            },
            entry.id,
          )
          : feature<Record<string, unknown>>(
            pointGeometry(entry.longitude, entry.latitude),
            {
              institutionId: entry.properties.institutionId,
              label: entry.properties.label,
              momentumScore: entry.properties.momentumScore,
              momentumState: entry.properties.momentumState,
              providerCount: entry.properties.providerCount,
              researchSignalCount: entry.properties.researchSignalCount,
              geocodePrecision: entry.properties.geocodePrecision,
            },
            entry.properties.institutionId,
          )
      ));

    return createEnvelope(
      'https://vitalcv.com/map/institutions/v1',
      query,
      featureCollection(features),
      {
        returned: features.length,
        rawPoints: points.length,
        clustered: useClusters,
        clusters: features.filter((item) => 'clusterId' in item.properties).length,
      },
    );
  });
}

export async function getMapClusters(
  query: MapQuery,
  prismaClient: PrismaClient = prisma,
) {
  return cacheOrCompute('map:clusters', query, async () => {
    const institutions = await loadVisibleInstitutions(query, prismaClient);
    const momentumBySlug = await loadInstitutionMomentumMap(
      institutions.map((institution) => institution.slug),
      prismaClient,
    );
    const edges = await loadAggregatedInstitutionEdges(institutions, momentumBySlug, prismaClient);
    const connectedInstitutionIds = new Set(edges.flatMap((edge) => [edge.fromInstitutionId, edge.toInstitutionId]));

    const minMomentumScore = query.minMomentumScore ?? 50;
    const qualifiedInstitutions = institutions.filter((institution) => {
      const momentum = momentumBySlug.get(institution.slug);
      const score = clampScore((momentum?.probability ?? 0) * 100);
      return connectedInstitutionIds.has(institution.id) && score >= minMomentumScore;
    });

    if (qualifiedInstitutions.length < 2) {
      return createEnvelope(
        'https://vitalcv.com/map/clusters/v1',
        query,
        featureCollection([]),
        {
          returned: 0,
          rawPoints: qualifiedInstitutions.length,
          clusters: 0,
        },
      );
    }

    const index = buildInstitutionClusterIndex(qualifiedInstitutions.map((institution) => ({
      id: institution.id,
      latitude: institution.latitude,
      longitude: institution.longitude,
      properties: {
        institutionId: institution.id,
        label: institution.canonicalName,
        momentumScore: clampScore((momentumBySlug.get(institution.slug)?.probability ?? 0) * 100),
      },
    })));

    const clusters = index.getClusters(
      [query.bbox.minLng, query.bbox.minLat, query.bbox.maxLng, query.bbox.maxLat],
      Math.max(0, query.zoom - 1),
    ) as ClusterIndexFeature[];

    const edgePairs = new Set(edges.map((edge) => (
      [edge.fromInstitutionId, edge.toInstitutionId].sort().join(':')
    )));

    const features = clusters
      .filter((cluster) => cluster.properties.cluster && (cluster.properties.point_count ?? 0) >= 2 && cluster.properties.cluster_id)
      .map((cluster) => {
        const leaves = index.getLeaves(cluster.properties.cluster_id!, Infinity) as ClusterIndexFeature[];
        const institutionIds = leaves.map((leaf) => leaf.properties.institutionId);
        const momentumScores = leaves.map((leaf) => leaf.properties.momentumScore);
        let internalEdgeCount = 0;
        const institutionIdSet = new Set(institutionIds);
        for (const left of institutionIds) {
          for (const right of institutionIds) {
            if (left >= right) {
              continue;
            }
            if (edgePairs.has([left, right].sort().join(':'))) {
              internalEdgeCount += 1;
            }
          }
        }

        const pairDenominator = institutionIds.length <= 1
          ? 1
          : (institutionIds.length * (institutionIds.length - 1)) / 2;
        const [longitude, latitude] = cluster.geometry.coordinates;

        return feature(
          pointGeometry(longitude, latitude),
          {
            clusterId: `cluster:${cluster.properties.cluster_id}`,
            radiusKm: clusterRadiusKm(leaves.map((leaf) => ({
              latitude: leaf.geometry.coordinates[1],
              longitude: leaf.geometry.coordinates[0],
            }))),
            institutionCount: institutionIds.length,
            avgMomentumScore: Number((momentumScores.reduce((sum, value) => sum + value, 0) / momentumScores.length).toFixed(2)),
            edgeDensity: Number((internalEdgeCount / pairDenominator).toFixed(4)),
            institutions: leaves
              .slice(0, 5)
              .map((leaf) => leaf.properties.label),
          },
          `cluster:${cluster.properties.cluster_id}`,
        );
      });

    return createEnvelope(
      'https://vitalcv.com/map/clusters/v1',
      query,
      featureCollection(features),
      {
        returned: features.length,
        rawPoints: qualifiedInstitutions.length,
        clusters: features.length,
      },
    );
  });
}

async function loadBoundarySupplyCounts(
  boundaryIds: string[],
  prismaClient: PrismaClient,
): Promise<Map<string, number>> {
  if (boundaryIds.length === 0) {
    return new Map();
  }

  const rows = await prismaClient.$queryRaw<Array<{ boundaryId: string; count: number }>>(Prisma.sql`
    SELECT
      pba.boundary_id AS "boundaryId",
      COUNT(*)::int AS "count"
    FROM provider_boundary_assignments pba
    JOIN provider_locations pl ON pl.id = pba.provider_location_id
    WHERE pba.boundary_id IN (${Prisma.join(boundaryIds)})
      AND pl.is_current = true
    GROUP BY pba.boundary_id
  `);

  return new Map(rows.map((row) => [row.boundaryId, row.count]));
}

function selectScarcityRows(
  scarcity: ScarcitySignal[],
  stateCode: string | null,
  specialty: string | undefined,
): ScarcitySignal[] {
  return scarcity.filter((entry) => {
    if (stateCode && entry.state.toUpperCase() !== stateCode.toUpperCase()) {
      return false;
    }
    if (specialty && entry.specialty.toLowerCase() !== specialty.toLowerCase()) {
      return false;
    }
    return true;
  });
}

export async function getMapShortages(
  query: MapQuery,
  prismaClient: PrismaClient = prisma,
) {
  return cacheOrCompute('map:shortages', query, async () => {
    const scarcity = await computeExpertiseScarcity(500);
    const geospatialPrisma = prismaClient as GeospatialPrismaClient;
    const hpsaBoundaries = await geospatialPrisma.geographicBoundary.findMany({
      where: {
        boundaryType: GeographicBoundaryType.HPSA,
        ...overlapWhere(query.bbox),
        ...(query.state ? { stateCode: query.state.toUpperCase() } : {}),
      },
      take: query.limit,
      orderBy: { updatedAt: 'desc' },
    });

    const boundaries = hpsaBoundaries.length > 0
      ? hpsaBoundaries
      : await geospatialPrisma.geographicBoundary.findMany({
        where: {
          boundaryType: GeographicBoundaryType.STATE,
          ...overlapWhere(query.bbox),
          ...(query.state ? { stateCode: query.state.toUpperCase() } : {}),
        },
        take: query.limit,
        orderBy: { updatedAt: 'desc' },
      });

    const boundaryType = hpsaBoundaries.length > 0 ? GeographicBoundaryType.HPSA : GeographicBoundaryType.STATE;
    const supplyCounts = boundaryType === GeographicBoundaryType.HPSA
      ? await loadBoundarySupplyCounts(boundaries.map((boundary) => boundary.id), prismaClient)
      : new Map<string, number>();

    const features = boundaries.map((boundary) => {
      const metadata = asRecord(boundary.metadata);
      const scarcityRows = selectScarcityRows(scarcity, boundary.stateCode, query.specialty);
      const maxScarcity = scarcityRows.length > 0
        ? Math.max(...scarcityRows.map((entry) => entry.scarcityScore))
        : null;
      const hpsaScore = asNumber(metadata.hpsaScore) ?? asNumber(metadata.HPSA_SCORE);
      const pressureScore = maxScarcity === null
        ? (hpsaScore === null ? null : clampScore((hpsaScore / 25) * 100))
        : boundaryType === GeographicBoundaryType.HPSA && hpsaScore !== null
          ? clampScore((maxScarcity * 0.7) + (((hpsaScore / 25) * 100) * 0.3))
          : maxScarcity;
      const verifiedSupplyCount = boundaryType === GeographicBoundaryType.HPSA
        ? (supplyCounts.get(boundary.id) ?? 0)
        : scarcityRows.reduce((sum, entry) => sum + entry.l2Count + entry.l3Count, 0);
      const geometry = boundary.geometryGeoJson as unknown as GeoJsonGeometry;
      const demandSignal = scarcityRows.find((entry) => entry.scarcityScore === maxScarcity)?.demandSignal ?? 'LOW';
      const properties = {
        boundaryId: boundary.id,
        boundaryType: boundary.boundaryType,
        specialty: query.specialty ?? null,
        pressureScore,
        pressureState: pressureStateFromScore(pressureScore),
        hpsaScore,
        verifiedSupplyCount,
        demandSignal,
        confidence: Number(Math.min(1, 0.4 + (scarcityRows.length > 0 ? 0.2 : 0) + (verifiedSupplyCount > 0 ? 0.2 : 0) + (hpsaScore !== null ? 0.2 : 0)).toFixed(2)),
      };

      if (geometry && (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon')) {
        return feature(geometry, properties, boundary.id);
      }

      return feature(
        pointGeometry(Number(boundary.centroidLng ?? 0), Number(boundary.centroidLat ?? 0)),
        properties,
        boundary.id,
      );
    });

    return createEnvelope(
      'https://vitalcv.com/map/shortages/v1',
      query,
      featureCollection(features),
      {
        returned: features.length,
        boundaryType,
      },
    );
  });
}

export async function getMapNetwork(
  query: MapQuery,
  prismaClient: PrismaClient = prisma,
) {
  return cacheOrCompute('map:network', query, async () => {
    const institutions = await loadVisibleInstitutions(query, prismaClient);
    const momentumBySlug = await loadInstitutionMomentumMap(
      institutions.map((institution) => institution.slug),
      prismaClient,
    );
    const rawEdges = await loadAggregatedInstitutionEdges(institutions, momentumBySlug, prismaClient);
    const minWeight = query.minWeight ?? 1;
    const filteredEdges = rawEdges.filter((edge) => edge.weight >= minWeight);
    const groups = buildGroupingForInstitutions(institutions, momentumBySlug, query.bbox, query.zoom);

    const bundled = new Map<string, {
      from: GroupedEndpoint;
      to: GroupedEndpoint;
      weight: number;
      relationshipCount: number;
      sourceCount: number;
      avgMomentumAccumulator: number;
      avgMomentumCount: number;
    }>();

    for (const edge of filteredEdges) {
      const from = groups.get(edge.fromInstitutionId);
      const to = groups.get(edge.toInstitutionId);
      if (!from || !to || from.id === to.id) {
        continue;
      }

      const ordered = [from, to].sort((left, right) => left.id.localeCompare(right.id));
      const key = `${ordered[0]!.id}:${ordered[1]!.id}`;
      const aggregate = bundled.get(key) ?? {
        from: ordered[0]!,
        to: ordered[1]!,
        weight: 0,
        relationshipCount: 0,
        sourceCount: 0,
        avgMomentumAccumulator: 0,
        avgMomentumCount: 0,
      };

      aggregate.weight += edge.weight;
      aggregate.relationshipCount += edge.relationshipCount;
      aggregate.sourceCount += edge.sourceCount;
      aggregate.avgMomentumAccumulator += edge.avgMomentumScore;
      aggregate.avgMomentumCount += 1;
      bundled.set(key, aggregate);
    }

    const features = [...bundled.entries()]
      .map(([key, aggregate]) => feature(
        lineStringGeometry([
          [aggregate.from.longitude, aggregate.from.latitude],
          [aggregate.to.longitude, aggregate.to.latitude],
        ]),
        {
          edgeId: `bundled:${key}`,
          fromInstitutionId: aggregate.from.id,
          toInstitutionId: aggregate.to.id,
          weight: Number(aggregate.weight.toFixed(4)),
          relationshipCount: aggregate.relationshipCount,
          sourceCount: aggregate.sourceCount,
          aggregationLevel: aggregate.from.kind === 'cluster' || aggregate.to.kind === 'cluster'
            ? 'cluster'
            : 'institution',
          avgMomentumScore: aggregate.avgMomentumCount === 0
            ? 0
            : Number((aggregate.avgMomentumAccumulator / aggregate.avgMomentumCount).toFixed(2)),
        },
        `bundled:${key}`,
      ))
      .sort((left, right) => (
        Number((right.properties.weight as number) ?? 0) - Number((left.properties.weight as number) ?? 0)
      ));

    return createEnvelope(
      'https://vitalcv.com/map/network/v1',
      query,
      featureCollection(features),
      {
        returned: features.length,
        rawEdges: filteredEdges.length,
        bundledEdges: features.length,
      },
    );
  }).catch((error) => {
    log('error', 'geospatial.network_aggregation_failed', {
      event: 'geospatial_network_aggregation_failed',
      error: error instanceof Error ? error.message : 'unknown',
    });
    throw error;
  });
}

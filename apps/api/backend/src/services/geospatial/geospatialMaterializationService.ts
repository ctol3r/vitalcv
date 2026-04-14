import fs from 'node:fs/promises';
import { Prisma, type PrismaClient } from '@prisma/client';
import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';
import {
  centroidForGeometry,
  computeBoundingBoxForGeometry,
  hashAddress,
  normalizeInstitutionKey,
  pointInBoundingBox,
  pointInGeometry,
  type GeoJsonGeometry,
} from '../../../../../../core/geospatial';

const DEFAULT_PROVIDER_LOCATION_SCAN_LIMIT = 25_000;
const DEFAULT_PROVIDER_LOCATION_PAGE_SIZE = 1_000;
const DEFAULT_INSTITUTION_SOURCE_LIMIT = 5_000;
const DEFAULT_ASSIGNMENT_LIMIT = 2_000;
const GeocodeStatus = {
  PENDING: 'PENDING',
  GEOCODED: 'GEOCODED',
  FAILED: 'FAILED',
} as const;
const GeocodePrecision = {
  ROOFTOP: 'ROOFTOP',
  STREET: 'STREET',
  UNRESOLVED: 'UNRESOLVED',
} as const;
const GeographicBoundaryType = {
  HPSA: 'HPSA',
  STATE: 'STATE',
} as const;
const BoundaryAssignmentMethod = {
  ZIP: 'ZIP',
  COUNTY_FIPS: 'COUNTY_FIPS',
  POINT_IN_POLYGON: 'POINT_IN_POLYGON',
  HRSA_LOOKUP: 'HRSA_LOOKUP',
} as const;
const ProviderLocationType = {
  PRACTICE: 'PRACTICE',
  MAILING: 'MAILING',
} as const;

type GeocodeStatus = (typeof GeocodeStatus)[keyof typeof GeocodeStatus];
type GeocodePrecision = (typeof GeocodePrecision)[keyof typeof GeocodePrecision];
type GeographicBoundaryType = (typeof GeographicBoundaryType)[keyof typeof GeographicBoundaryType];
type BoundaryAssignmentMethod = (typeof BoundaryAssignmentMethod)[keyof typeof BoundaryAssignmentMethod];
type ProviderLocationType = (typeof ProviderLocationType)[keyof typeof ProviderLocationType];

type ProviderLocationClaimRow = {
  id: string;
  personProfileId: string | null;
  subjectNpi: string;
  claimType: string;
  sourceId: string;
  trustTier: string;
  confidenceScore: number;
  observedAt: Date;
  value: Prisma.JsonValue;
  currentRank: number;
};

type InstitutionCandidate = {
  sourcePriority: number;
  canonicalName: string;
  slug: string;
  rorId: string | null;
  vcvEntityId: string | null;
  organizationProfileId: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  stateCode: string | null;
  postalCode: string | null;
  countryCode: string | null;
  latitude: number | null;
  longitude: number | null;
  metadata: Record<string, unknown>;
};

type GeoJsonFeatureInput = {
  type?: string;
  geometry?: GeoJsonGeometry;
  properties?: Record<string, unknown>;
};

type MaterializedBoundaryRecord = {
  id: string;
  boundaryType: GeographicBoundaryType;
  externalId: string;
  name: string;
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

type ProviderBoundaryAssignmentRow = {
  boundaryId: string;
};

type MaterializedProviderLocationRow = {
  id: string;
  countyFips: string | null;
  postalCode: string | null;
  latitude: Prisma.Decimal | null;
  longitude: Prisma.Decimal | null;
};

type GeospatialPrismaClient = PrismaClient & {
  institution: {
    upsert(args: unknown): Promise<unknown>;
  };
  providerLocation: {
    upsert(args: unknown): Promise<unknown>;
    findMany(args: unknown): Promise<MaterializedProviderLocationRow[]>;
  };
  geographicBoundary: {
    upsert(args: unknown): Promise<unknown>;
    findMany(args: unknown): Promise<MaterializedBoundaryRecord[]>;
  };
  providerBoundaryAssignment: {
    findMany(args: unknown): Promise<ProviderBoundaryAssignmentRow[]>;
    deleteMany(args: unknown): Promise<unknown>;
    upsert(args: unknown): Promise<unknown>;
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

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function readIntegerEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readBooleanEnv(name: string, fallback = false): boolean {
  const raw = process.env[name];
  if (raw == null) {
    return fallback;
  }

  return raw === '1' || raw === 'true';
}

function slugifyInstitutionName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function inferCountryCode(value: string | null): string {
  const normalized = value?.trim().toUpperCase();
  if (!normalized) {
    return 'US';
  }

  if (normalized === 'USA' || normalized === 'UNITED STATES' || normalized === 'US') {
    return 'US';
  }

  return normalized.slice(0, 2);
}

function parseCoordinates(value: Prisma.JsonValue): { latitude: number | null; longitude: number | null } {
  const record = asRecord(value);
  const latitude = asNumber(record.latitude) ?? asNumber(record.lat);
  const longitude = asNumber(record.longitude) ?? asNumber(record.lng) ?? asNumber(record.lon);
  return { latitude, longitude };
}

function parseProviderLocationPayload(
  value: Prisma.JsonValue,
): {
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  stateCode: string | null;
  postalCode: string | null;
  countryCode: string | null;
  countyFips: string | null;
  latitude: number | null;
  longitude: number | null;
} {
  const record = asRecord(value);
  const coordinates = parseCoordinates(value);
  const stateCode = (asString(record.state) ?? asString(record.stateCode) ?? asString(record.state_code))?.toUpperCase() ?? null;
  const postalCode = asString(record.zip) ?? asString(record.postalCode) ?? asString(record.postal_code);
  const countryCode = inferCountryCode(asString(record.country) ?? asString(record.countryCode));

  return {
    addressLine1: asString(record.address1) ?? asString(record.addressLine1) ?? asString(record.line1),
    addressLine2: asString(record.address2) ?? asString(record.addressLine2) ?? asString(record.line2),
    city: asString(record.city),
    stateCode,
    postalCode,
    countryCode,
    countyFips: asString(record.countyFips) ?? asString(record.county_fips),
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
  };
}

function parseInstitutionMetadata(
  value: unknown,
): {
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  stateCode: string | null;
  postalCode: string | null;
  countryCode: string | null;
  latitude: number | null;
  longitude: number | null;
  rorId: string | null;
} {
  const record = asRecord(value);
  const address = asRecord(record.address);
  const location = asRecord(record.location);
  const externalIds = asRecord(record.externalIds);

  const latitude = asNumber(record.latitude)
    ?? asNumber(record.lat)
    ?? asNumber(address.latitude)
    ?? asNumber(location.latitude);
  const longitude = asNumber(record.longitude)
    ?? asNumber(record.lng)
    ?? asNumber(record.lon)
    ?? asNumber(address.longitude)
    ?? asNumber(location.longitude);

  return {
    addressLine1: asString(record.address1)
      ?? asString(record.addressLine1)
      ?? asString(address.address1)
      ?? asString(address.line1)
      ?? asString(location.address1),
    addressLine2: asString(record.address2)
      ?? asString(record.addressLine2)
      ?? asString(address.address2)
      ?? asString(address.line2)
      ?? asString(location.address2),
    city: asString(record.city) ?? asString(address.city) ?? asString(location.city),
    stateCode: (
      asString(record.stateCode)
      ?? asString(record.state)
      ?? asString(address.state)
      ?? asString(location.state)
    )?.toUpperCase() ?? null,
    postalCode: asString(record.postalCode)
      ?? asString(record.zip)
      ?? asString(address.postalCode)
      ?? asString(address.zip)
      ?? asString(location.postalCode),
    countryCode: inferCountryCode(
      asString(record.countryCode)
      ?? asString(record.country)
      ?? asString(address.countryCode)
      ?? asString(address.country)
      ?? asString(location.countryCode),
    ),
    latitude,
    longitude,
    rorId: asString(record.rorId) ?? asString(externalIds.ROR_ID) ?? asString(externalIds.rorId),
  };
}

function institutionCandidateKey(candidate: InstitutionCandidate): string {
  return candidate.rorId ? `ror:${candidate.rorId}` : `slug:${candidate.slug}`;
}

function providerSourcePriority(sourceId: string, trustTier: string): number {
  if (sourceId === 'NPPES_BULK') return 500;
  if (sourceId === 'NPPES_API') return 450;
  if (trustTier === 'GOLD') return 400;
  if (trustTier === 'SILVER') return 250;
  if (trustTier === 'BRONZE') return 150;
  return 50;
}

function institutionSourcePriority(source: 'organization_profile' | 'vcv_entity' | 'claim' | 'residency'): number {
  switch (source) {
    case 'organization_profile':
      return 400;
    case 'vcv_entity':
      return 350;
    case 'claim':
      return 200;
    case 'residency':
    default:
      return 150;
  }
}

function mergeInstitutionCandidate(
  existing: InstitutionCandidate | undefined,
  candidate: InstitutionCandidate,
): InstitutionCandidate {
  if (!existing) {
    return candidate;
  }

  const primary = candidate.sourcePriority >= existing.sourcePriority ? candidate : existing;
  const secondary = primary === candidate ? existing : candidate;

  return {
    sourcePriority: Math.max(existing.sourcePriority, candidate.sourcePriority),
    canonicalName: primary.canonicalName,
    slug: primary.slug,
    rorId: existing.rorId ?? candidate.rorId,
    vcvEntityId: existing.vcvEntityId ?? candidate.vcvEntityId,
    organizationProfileId: existing.organizationProfileId ?? candidate.organizationProfileId,
    addressLine1: primary.addressLine1 ?? secondary.addressLine1,
    addressLine2: primary.addressLine2 ?? secondary.addressLine2,
    city: primary.city ?? secondary.city,
    stateCode: primary.stateCode ?? secondary.stateCode,
    postalCode: primary.postalCode ?? secondary.postalCode,
    countryCode: primary.countryCode ?? secondary.countryCode,
    latitude: primary.latitude ?? secondary.latitude,
    longitude: primary.longitude ?? secondary.longitude,
    metadata: {
      ...secondary.metadata,
      ...primary.metadata,
      sourceCandidates: Array.from(new Set([
        ...(Array.isArray(asRecord(secondary.metadata).sourceCandidates) ? asRecord(secondary.metadata).sourceCandidates as string[] : []),
        ...(Array.isArray(asRecord(primary.metadata).sourceCandidates) ? asRecord(primary.metadata).sourceCandidates as string[] : []),
      ])),
    },
  };
}

async function upsertInstitutionCandidate(
  prismaClient: PrismaClient,
  candidate: InstitutionCandidate,
): Promise<void> {
  const geospatialPrisma = prismaClient as GeospatialPrismaClient;
  const geocoded = candidate.latitude !== null && candidate.longitude !== null;
  const data = {
    canonicalName: candidate.canonicalName,
    slug: candidate.slug,
    rorId: candidate.rorId,
    vcvEntityId: candidate.vcvEntityId,
    organizationProfileId: candidate.organizationProfileId,
    addressLine1: candidate.addressLine1,
    addressLine2: candidate.addressLine2,
    city: candidate.city,
    stateCode: candidate.stateCode,
    postalCode: candidate.postalCode,
    countryCode: candidate.countryCode,
    latitude: candidate.latitude === null ? null : new Prisma.Decimal(candidate.latitude),
    longitude: candidate.longitude === null ? null : new Prisma.Decimal(candidate.longitude),
    geocodeStatus: geocoded ? GeocodeStatus.GEOCODED : GeocodeStatus.PENDING,
    geocodePrecision: geocoded ? GeocodePrecision.ROOFTOP : GeocodePrecision.UNRESOLVED,
    geocodeSource: geocoded ? 'SOURCE_COORDINATES' : null,
    lastGeocodedAt: geocoded ? new Date() : null,
    lastGeocodeError: null,
    metadata: toJsonValue(candidate.metadata),
  };

  if (candidate.vcvEntityId) {
    await geospatialPrisma.institution.upsert({
      where: { vcvEntityId: candidate.vcvEntityId },
      create: data,
      update: data,
    });
    return;
  }

  if (candidate.organizationProfileId) {
    await geospatialPrisma.institution.upsert({
      where: { organizationProfileId: candidate.organizationProfileId },
      create: data,
      update: data,
    });
    return;
  }

  if (candidate.rorId) {
    await geospatialPrisma.institution.upsert({
      where: { rorId: candidate.rorId },
      create: data,
      update: data,
    });
    return;
  }

  await geospatialPrisma.institution.upsert({
    where: { slug: candidate.slug },
    create: data,
    update: data,
  });
}

function boundarySourceConfig(boundaryType: GeographicBoundaryType): { path: string | null; url: string | null; version: string } {
  if (boundaryType === GeographicBoundaryType.STATE) {
    return {
      path: process.env.GEOSPATIAL_STATE_BOUNDARIES_PATH ?? null,
      url: process.env.GEOSPATIAL_STATE_BOUNDARIES_URL ?? null,
      version: process.env.GEOSPATIAL_STATE_BOUNDARIES_VERSION ?? new Date().toISOString().slice(0, 10),
    };
  }

  return {
    path: process.env.GEOSPATIAL_HPSA_BOUNDARIES_PATH ?? null,
    url: process.env.GEOSPATIAL_HPSA_BOUNDARIES_URL ?? null,
    version: process.env.GEOSPATIAL_HPSA_BOUNDARIES_VERSION ?? new Date().toISOString().slice(0, 10),
  };
}

async function readBoundarySource(pathOrUrl: string): Promise<string> {
  if (/^https?:\/\//i.test(pathOrUrl)) {
    const response = await fetch(pathOrUrl, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`Boundary source returned ${response.status}`);
    }
    return response.text();
  }

  return fs.readFile(pathOrUrl, 'utf8');
}

function normalizeBoundaryFeature(
  feature: GeoJsonFeatureInput,
  boundaryType: GeographicBoundaryType,
): null | {
  externalId: string;
  name: string;
  stateCode: string | null;
  countyFips: string | null;
  geometry: GeoJsonGeometry;
  properties: Record<string, unknown>;
} {
  if (feature.type !== 'Feature' || !feature.geometry) {
    return null;
  }

  const geometry = feature.geometry;
  if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') {
    return null;
  }

  const properties = asRecord(feature.properties);
  const stateCode = (
    asString(properties.stateCode)
    ?? asString(properties.state)
    ?? asString(properties.STATE_ABBR)
    ?? asString(properties.STUSPS)
  )?.toUpperCase() ?? null;
  const countyFips = asString(properties.countyFips)
    ?? asString(properties.county_fips)
    ?? asString(properties.COUNTY_FIPS_CODE)
    ?? asString(properties.COUNTYFP);

  const externalId = (
    asString(properties.externalId)
    ?? asString(properties.id)
    ?? asString(properties.hpsaId)
    ?? asString(properties.HPSA_ID)
    ?? (boundaryType === GeographicBoundaryType.STATE ? stateCode : null)
    ?? countyFips
  );
  const name = (
    asString(properties.name)
    ?? asString(properties.NAME)
    ?? asString(properties.hpsaName)
    ?? asString(properties.HPSA_NAME)
    ?? externalId
  );

  if (!externalId || !name) {
    return null;
  }

  return {
    externalId,
    name,
    stateCode,
    countyFips,
    geometry,
    properties,
  };
}

function geometryFromBoundary(boundary: Pick<
  MaterializedBoundaryRecord,
  'geometryGeoJson'
>): GeoJsonGeometry | null {
  const geometry = boundary.geometryGeoJson as unknown;
  const record = asRecord(geometry);
  if (record.type === 'Polygon' || record.type === 'MultiPolygon') {
    return record as unknown as GeoJsonGeometry;
  }

  return null;
}

async function upsertProviderAssignmentsForLocation(
  prismaClient: PrismaClient,
  location: {
    id: string;
    countyFips: string | null;
    postalCode: string | null;
    latitude: Prisma.Decimal | null;
    longitude: Prisma.Decimal | null;
  },
  boundaries: MaterializedBoundaryRecord[],
): Promise<number> {
  const latitude = location.latitude === null ? null : Number(location.latitude);
  const longitude = location.longitude === null ? null : Number(location.longitude);
  const postalCode = location.postalCode?.replace(/[^0-9]/g, '').slice(0, 5) ?? null;
  const matches: Array<{ boundaryId: string; assignmentMethod: BoundaryAssignmentMethod; confidence: number }> = [];

  for (const boundary of boundaries) {
    const metadata = asRecord(boundary.metadata);
    const zipCodes = Array.isArray(metadata.zipCodes)
      ? metadata.zipCodes
          .filter((value): value is string => typeof value === 'string')
          .map((value) => value.replace(/[^0-9]/g, '').slice(0, 5))
      : [];

    if (location.countyFips && boundary.countyFips && boundary.countyFips === location.countyFips) {
      matches.push({
        boundaryId: boundary.id,
        assignmentMethod: BoundaryAssignmentMethod.COUNTY_FIPS,
        confidence: 0.95,
      });
      continue;
    }

    if (postalCode && zipCodes.includes(postalCode)) {
      matches.push({
        boundaryId: boundary.id,
        assignmentMethod: BoundaryAssignmentMethod.ZIP,
        confidence: 0.85,
      });
      continue;
    }

    if (
      latitude !== null
      && longitude !== null
      && boundary.bboxMinLat
      && boundary.bboxMaxLat
      && boundary.bboxMinLng
      && boundary.bboxMaxLng
      && pointInBoundingBox(
        latitude,
        longitude,
        {
          minLat: Number(boundary.bboxMinLat),
          maxLat: Number(boundary.bboxMaxLat),
          minLng: Number(boundary.bboxMinLng),
          maxLng: Number(boundary.bboxMaxLng),
        },
      )
    ) {
      const geometry = geometryFromBoundary(boundary);
      if (geometry && pointInGeometry([longitude, latitude], geometry)) {
        matches.push({
          boundaryId: boundary.id,
          assignmentMethod: BoundaryAssignmentMethod.POINT_IN_POLYGON,
          confidence: 0.75,
        });
      }
    }
  }

  const geospatialPrisma = prismaClient as GeospatialPrismaClient;
  const existing = await geospatialPrisma.providerBoundaryAssignment.findMany({
    where: {
      providerLocationId: location.id,
    },
    select: {
      boundaryId: true,
    },
  });
  const nextBoundaryIds = new Set(matches.map((match) => match.boundaryId));
  const staleBoundaryIds = existing
    .map((assignment) => assignment.boundaryId)
    .filter((boundaryId) => !nextBoundaryIds.has(boundaryId));

  if (staleBoundaryIds.length > 0) {
    await geospatialPrisma.providerBoundaryAssignment.deleteMany({
      where: {
        providerLocationId: location.id,
        boundaryId: { in: staleBoundaryIds },
      },
    });
  }

  for (const match of matches) {
    await geospatialPrisma.providerBoundaryAssignment.upsert({
      where: {
        providerLocationId_boundaryId: {
          providerLocationId: location.id,
          boundaryId: match.boundaryId,
        },
      },
      create: {
        providerLocationId: location.id,
        boundaryId: match.boundaryId,
        assignmentMethod: match.assignmentMethod,
        confidence: match.confidence,
      },
      update: {
        assignmentMethod: match.assignmentMethod,
        confidence: match.confidence,
      },
    });
  }

  return matches.length;
}

export async function syncProviderLocations(
  options: {
    prismaClient?: PrismaClient;
    maxRecords?: number;
    pageSize?: number;
  } = {},
): Promise<{
    scanned: number;
    upserted: number;
    current: number;
  }> {
  const prismaClient = options.prismaClient ?? prisma;
  const maxRecords = Math.max(1, options.maxRecords ?? readIntegerEnv('GEOSPATIAL_PROVIDER_LOCATION_SCAN_LIMIT', DEFAULT_PROVIDER_LOCATION_SCAN_LIMIT));
  const pageSize = Math.max(1, options.pageSize ?? readIntegerEnv('GEOSPATIAL_PROVIDER_LOCATION_PAGE_SIZE', DEFAULT_PROVIDER_LOCATION_PAGE_SIZE));

  let scanned = 0;
  let upserted = 0;
  let current = 0;
  let offset = 0;
  const geospatialPrisma = prismaClient as GeospatialPrismaClient;

  while (scanned < maxRecords) {
    const remaining = Math.min(pageSize, maxRecords - scanned);
    const rows = await prismaClient.$queryRaw<ProviderLocationClaimRow[]>(Prisma.sql`
      SELECT
        id,
        person_profile_id AS "personProfileId",
        subject_npi AS "subjectNpi",
        claim_type AS "claimType",
        source_id AS "sourceId",
        trust_tier AS "trustTier",
        confidence_score AS "confidenceScore",
        observed_at AS "observedAt",
        value,
        ROW_NUMBER() OVER (
          PARTITION BY subject_npi, claim_type
          ORDER BY
            CASE
              WHEN source_id = 'NPPES_BULK' THEN 500
              WHEN source_id = 'NPPES_API' THEN 450
              WHEN trust_tier = 'GOLD' THEN 400
              WHEN trust_tier = 'SILVER' THEN 250
              WHEN trust_tier = 'BRONZE' THEN 150
              ELSE 50
            END DESC,
            confidence_score DESC,
            observed_at DESC,
            created_at DESC
        ) AS "currentRank"
      FROM claim_records
      WHERE claim_type IN ('PRACTICE_LOCATION', 'MAILING_ADDRESS')
        AND status <> 'SUPERSEDED'
      ORDER BY observed_at DESC, created_at DESC
      OFFSET ${offset}
      LIMIT ${remaining}
    `);

    if (rows.length === 0) {
      break;
    }

    scanned += rows.length;
    offset += rows.length;

    for (const row of rows) {
      const payload = parseProviderLocationPayload(row.value);
      if (!payload.addressLine1 && !payload.city && !payload.stateCode && !payload.postalCode) {
        continue;
      }

      const isCurrent = row.currentRank === 1;
      const locationType = row.claimType === 'MAILING_ADDRESS'
        ? ProviderLocationType.MAILING
        : ProviderLocationType.PRACTICE;

      const geocoded = payload.latitude !== null && payload.longitude !== null;

      await geospatialPrisma.providerLocation.upsert({
        where: {
          claimRecordId: row.id,
        },
        create: {
          subjectNpi: row.subjectNpi,
          personProfileId: row.personProfileId,
          claimRecordId: row.id,
          locationType,
          isCurrent,
          sourceId: row.sourceId,
          trustTier: row.trustTier,
          confidenceScore: row.confidenceScore,
          addressHash: hashAddress([
            payload.addressLine1,
            payload.addressLine2,
            payload.city,
            payload.stateCode,
            payload.postalCode,
            payload.countryCode,
          ]),
          addressLine1: payload.addressLine1,
          addressLine2: payload.addressLine2,
          city: payload.city,
          stateCode: payload.stateCode,
          postalCode: payload.postalCode,
          countryCode: payload.countryCode,
          countyFips: payload.countyFips,
          latitude: payload.latitude === null ? null : new Prisma.Decimal(payload.latitude),
          longitude: payload.longitude === null ? null : new Prisma.Decimal(payload.longitude),
          geocodeStatus: geocoded ? GeocodeStatus.GEOCODED : GeocodeStatus.PENDING,
          geocodePrecision: geocoded ? GeocodePrecision.ROOFTOP : GeocodePrecision.UNRESOLVED,
          geocodeSource: geocoded ? 'SOURCE_COORDINATES' : null,
          observedAt: row.observedAt,
          lastGeocodedAt: geocoded ? new Date() : null,
          metadata: toJsonValue({
            claimType: row.claimType,
            sourcePriority: providerSourcePriority(row.sourceId, row.trustTier),
          }),
        },
        update: {
          personProfileId: row.personProfileId,
          locationType,
          isCurrent,
          sourceId: row.sourceId,
          trustTier: row.trustTier,
          confidenceScore: row.confidenceScore,
          addressHash: hashAddress([
            payload.addressLine1,
            payload.addressLine2,
            payload.city,
            payload.stateCode,
            payload.postalCode,
            payload.countryCode,
          ]),
          addressLine1: payload.addressLine1,
          addressLine2: payload.addressLine2,
          city: payload.city,
          stateCode: payload.stateCode,
          postalCode: payload.postalCode,
          countryCode: payload.countryCode,
          countyFips: payload.countyFips,
          latitude: geocoded ? new Prisma.Decimal(payload.latitude ?? 0) : undefined,
          longitude: geocoded ? new Prisma.Decimal(payload.longitude ?? 0) : undefined,
          geocodeStatus: geocoded ? GeocodeStatus.GEOCODED : undefined,
          geocodePrecision: geocoded ? GeocodePrecision.ROOFTOP : undefined,
          geocodeSource: geocoded ? 'SOURCE_COORDINATES' : undefined,
          lastGeocodedAt: geocoded ? new Date() : undefined,
          observedAt: row.observedAt,
          metadata: toJsonValue({
            claimType: row.claimType,
            sourcePriority: providerSourcePriority(row.sourceId, row.trustTier),
          }),
        },
      });

      upserted += 1;
      if (isCurrent) {
        current += 1;
      }
    }
  }

  return { scanned, upserted, current };
}

export async function syncInstitutions(
  options: {
    prismaClient?: PrismaClient;
    sourceLimit?: number;
  } = {},
): Promise<{
    candidates: number;
    upserted: number;
  }> {
  const prismaClient = options.prismaClient ?? prisma;
  const sourceLimit = Math.max(1, options.sourceLimit ?? readIntegerEnv('GEOSPATIAL_INSTITUTION_SOURCE_LIMIT', DEFAULT_INSTITUTION_SOURCE_LIMIT));

  const [organizationProfiles, vcvEntities, affiliationClaims, residencies] = await Promise.all([
    prismaClient.organizationProfile.findMany({
      take: sourceLimit,
      include: {
        organization: {
          select: {
            name: true,
            slug: true,
          },
        },
      },
    }),
    prismaClient.vcvEntity.findMany({
      where: {
        entityType: {
          in: ['ORGANIZATION', 'FACILITY', 'EDUCATIONAL_INSTITUTION'],
        },
      },
      take: sourceLimit,
      select: {
        id: true,
        displayName: true,
        metadata: true,
      },
    }),
    prismaClient.claimRecord.findMany({
      where: {
        claimType: 'INSTITUTION_AFFILIATION',
        status: { not: 'SUPERSEDED' },
      },
      take: sourceLimit,
      orderBy: { observedAt: 'desc' },
      select: {
        id: true,
        sourceId: true,
        value: true,
      },
    }),
    // residencyProgram model removed — return empty array
    Promise.resolve([] as Array<{ acgme_code: string; hospital_affiliation: string; specialty: string }>),
  ]);

  const candidates = new Map<string, InstitutionCandidate>();

  for (const row of organizationProfiles) {
    const canonicalName = row.organization.name.trim();
    if (!canonicalName) {
      continue;
    }

    const stateCode = row.statesCovered.length === 1 ? row.statesCovered[0]!.trim().toUpperCase() : null;
    const candidate: InstitutionCandidate = {
      sourcePriority: institutionSourcePriority('organization_profile'),
      canonicalName,
      slug: row.organization.slug || slugifyInstitutionName(canonicalName),
      rorId: null,
      vcvEntityId: null,
      organizationProfileId: row.id,
      addressLine1: null,
      addressLine2: null,
      city: null,
      stateCode,
      postalCode: null,
      countryCode: 'US',
      latitude: null,
      longitude: null,
      metadata: {
        sourceCandidates: ['organization_profile'],
        facilityType: row.facilityType,
        specialties: row.specialties,
      },
    };
    candidates.set(institutionCandidateKey(candidate), mergeInstitutionCandidate(candidates.get(institutionCandidateKey(candidate)), candidate));
  }

  for (const row of vcvEntities) {
    const canonicalName = row.displayName.trim();
    if (!canonicalName) {
      continue;
    }

    const metadata = parseInstitutionMetadata(row.metadata);
    const candidate: InstitutionCandidate = {
      sourcePriority: institutionSourcePriority('vcv_entity'),
      canonicalName,
      slug: slugifyInstitutionName(canonicalName),
      rorId: metadata.rorId,
      vcvEntityId: row.id,
      organizationProfileId: null,
      addressLine1: metadata.addressLine1,
      addressLine2: metadata.addressLine2,
      city: metadata.city,
      stateCode: metadata.stateCode,
      postalCode: metadata.postalCode,
      countryCode: metadata.countryCode,
      latitude: metadata.latitude,
      longitude: metadata.longitude,
      metadata: {
        sourceCandidates: ['vcv_entity'],
      },
    };
    candidates.set(institutionCandidateKey(candidate), mergeInstitutionCandidate(candidates.get(institutionCandidateKey(candidate)), candidate));
  }

  for (const row of affiliationClaims) {
    const value = asRecord(row.value);
    const canonicalName = asString(value.institution);
    if (!canonicalName) {
      continue;
    }

    const institutionMeta = parseInstitutionMetadata(row.value);
    const candidate: InstitutionCandidate = {
      sourcePriority: institutionSourcePriority('claim'),
      canonicalName,
      slug: slugifyInstitutionName(canonicalName),
      rorId: institutionMeta.rorId,
      vcvEntityId: null,
      organizationProfileId: null,
      addressLine1: institutionMeta.addressLine1,
      addressLine2: institutionMeta.addressLine2,
      city: institutionMeta.city,
      stateCode: institutionMeta.stateCode,
      postalCode: institutionMeta.postalCode,
      countryCode: institutionMeta.countryCode,
      latitude: institutionMeta.latitude,
      longitude: institutionMeta.longitude,
      metadata: {
        sourceCandidates: ['claim'],
        sourceId: row.sourceId,
        normalizedKey: normalizeInstitutionKey(canonicalName),
      },
    };
    candidates.set(institutionCandidateKey(candidate), mergeInstitutionCandidate(candidates.get(institutionCandidateKey(candidate)), candidate));
  }

  for (const row of residencies) {
    const canonicalName = row.hospital_affiliation.trim();
    if (!canonicalName) {
      continue;
    }

    const candidate: InstitutionCandidate = {
      sourcePriority: institutionSourcePriority('residency'),
      canonicalName,
      slug: slugifyInstitutionName(canonicalName),
      rorId: null,
      vcvEntityId: null,
      organizationProfileId: null,
      addressLine1: null,
      addressLine2: null,
      city: null,
      stateCode: null,
      postalCode: null,
      countryCode: 'US',
      latitude: null,
      longitude: null,
      metadata: {
        sourceCandidates: ['residency'],
        acgmeCode: row.acgme_code,
        specialty: row.specialty,
      },
    };
    candidates.set(institutionCandidateKey(candidate), mergeInstitutionCandidate(candidates.get(institutionCandidateKey(candidate)), candidate));
  }

  let upserted = 0;
  const geospatialPrisma = prismaClient as GeospatialPrismaClient;
  for (const candidate of candidates.values()) {
    await upsertInstitutionCandidate(geospatialPrisma, candidate);
    upserted += 1;
  }

  return {
    candidates: candidates.size,
    upserted,
  };
}

export async function syncGeographicBoundaries(
  options: {
    prismaClient?: PrismaClient;
    boundaryTypes?: GeographicBoundaryType[];
  } = {},
): Promise<{
    loaded: number;
    upserted: number;
  }> {
  const prismaClient = options.prismaClient ?? prisma;
  const boundaryTypes = options.boundaryTypes ?? [GeographicBoundaryType.STATE, GeographicBoundaryType.HPSA];
  let loaded = 0;
  let upserted = 0;
  const geospatialPrisma = prismaClient as GeospatialPrismaClient;

  for (const boundaryType of boundaryTypes) {
    const config = boundarySourceConfig(boundaryType);
    const source = config.path ?? config.url;
    if (!source) {
      continue;
    }

    const raw = await readBoundarySource(source);
    const parsed = JSON.parse(raw) as { type?: string; features?: GeoJsonFeatureInput[] };
    const features = Array.isArray(parsed.features) ? parsed.features : [];

    for (const feature of features) {
      const normalized = normalizeBoundaryFeature(feature, boundaryType);
      if (!normalized) {
        continue;
      }

      loaded += 1;
      const bbox = computeBoundingBoxForGeometry(normalized.geometry);
      const [centroidLng, centroidLat] = centroidForGeometry(normalized.geometry);

      await geospatialPrisma.geographicBoundary.upsert({
        where: {
          boundaryType_externalId: {
            boundaryType,
            externalId: normalized.externalId,
          },
        },
        create: {
          boundaryType,
          externalId: normalized.externalId,
          name: normalized.name,
          stateCode: normalized.stateCode,
          countyFips: normalized.countyFips,
          centroidLat: new Prisma.Decimal(centroidLat),
          centroidLng: new Prisma.Decimal(centroidLng),
          bboxMinLat: new Prisma.Decimal(bbox.minLat),
          bboxMinLng: new Prisma.Decimal(bbox.minLng),
          bboxMaxLat: new Prisma.Decimal(bbox.maxLat),
          bboxMaxLng: new Prisma.Decimal(bbox.maxLng),
          geometryGeoJson: toJsonValue(normalized.geometry),
          sourceDataset: source,
          dataVersion: config.version,
          metadata: toJsonValue(normalized.properties),
        },
        update: {
          name: normalized.name,
          stateCode: normalized.stateCode,
          countyFips: normalized.countyFips,
          centroidLat: new Prisma.Decimal(centroidLat),
          centroidLng: new Prisma.Decimal(centroidLng),
          bboxMinLat: new Prisma.Decimal(bbox.minLat),
          bboxMinLng: new Prisma.Decimal(bbox.minLng),
          bboxMaxLat: new Prisma.Decimal(bbox.maxLat),
          bboxMaxLng: new Prisma.Decimal(bbox.maxLng),
          geometryGeoJson: toJsonValue(normalized.geometry),
          sourceDataset: source,
          dataVersion: config.version,
          metadata: toJsonValue(normalized.properties),
        },
      });

      upserted += 1;
    }
  }

  return { loaded, upserted };
}

export async function syncProviderBoundaryAssignments(
  options: {
    prismaClient?: PrismaClient;
    limit?: number;
  } = {},
): Promise<{
    processed: number;
    assignments: number;
  }> {
  const prismaClient = options.prismaClient ?? prisma;
  const limit = Math.max(1, options.limit ?? readIntegerEnv('GEOSPATIAL_BOUNDARY_ASSIGNMENT_LIMIT', DEFAULT_ASSIGNMENT_LIMIT));
  const geospatialPrisma = prismaClient as GeospatialPrismaClient;
  const [locations, boundaries] = await Promise.all([
    geospatialPrisma.providerLocation.findMany({
      where: {
        isCurrent: true,
      },
      select: {
        id: true,
        countyFips: true,
        postalCode: true,
        latitude: true,
        longitude: true,
      },
      take: limit,
      orderBy: { updatedAt: 'asc' },
    }),
    geospatialPrisma.geographicBoundary.findMany({
      where: {
        boundaryType: GeographicBoundaryType.HPSA,
      },
      orderBy: { updatedAt: 'asc' },
    }),
  ]);

  let assignments = 0;
  for (const location of locations) {
    assignments += await upsertProviderAssignmentsForLocation(prismaClient, location, boundaries);
  }

  return {
    processed: locations.length,
    assignments,
  };
}

export async function runGeospatialMaterializationCycle(
  options: {
    prismaClient?: PrismaClient;
  } = {},
): Promise<{
    institutions: Awaited<ReturnType<typeof syncInstitutions>>;
    providerLocations: Awaited<ReturnType<typeof syncProviderLocations>>;
    boundaries: Awaited<ReturnType<typeof syncGeographicBoundaries>>;
    assignments: Awaited<ReturnType<typeof syncProviderBoundaryAssignments>>;
  }> {
  const prismaClient = options.prismaClient ?? prisma;
  const [institutions, providerLocations, boundaries] = await Promise.all([
    syncInstitutions({ prismaClient }),
    syncProviderLocations({ prismaClient }),
    readBooleanEnv('GEOSPATIAL_BOUNDARY_SYNC_ENABLED', true)
      ? syncGeographicBoundaries({ prismaClient })
      : Promise.resolve({ loaded: 0, upserted: 0 }),
  ]);

  const assignments = readBooleanEnv('GEOSPATIAL_BOUNDARY_ASSIGNMENTS_ENABLED', true)
    ? await syncProviderBoundaryAssignments({ prismaClient })
    : { processed: 0, assignments: 0 };

  log('info', 'geospatial.materialization_completed', {
    event: 'geospatial_materialization_completed',
    institutionsUpserted: institutions.upserted,
    providerLocationsUpserted: providerLocations.upserted,
    boundariesUpserted: boundaries.upserted,
    assignments: assignments.assignments,
  });

  return {
    institutions,
    providerLocations,
    boundaries,
    assignments,
  };
}

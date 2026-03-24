import fs from 'node:fs/promises';
import { SpanStatusCode, trace, type Attributes } from '@opentelemetry/api';
import { Prisma, type PrismaClient } from '@prisma/client';
import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';
import { hashAddress, normalizeAddressPart } from '../../../../../../core/geospatial';

const geospatialTracer = trace.getTracer('vitalcv.geospatial');
const CENSUS_GEOCODER_URL = 'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress';
const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_CONCURRENCY = 4;
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_HTTP_TIMEOUT_MS = 8_000;
const DEFAULT_STALE_DAYS = 30;
const GeocodeStatus = {
  PENDING: 'PENDING',
  GEOCODED: 'GEOCODED',
  FAILED: 'FAILED',
} as const;
const GeocodePrecision = {
  ROOFTOP: 'ROOFTOP',
  STREET: 'STREET',
  ZIP_CENTROID: 'ZIP_CENTROID',
  STATE_CENTROID: 'STATE_CENTROID',
  UNRESOLVED: 'UNRESOLVED',
} as const;
const GeographicBoundaryType = {
  STATE: 'STATE',
} as const;

type GeocodeStatus = (typeof GeocodeStatus)[keyof typeof GeocodeStatus];
type GeocodePrecision = (typeof GeocodePrecision)[keyof typeof GeocodePrecision];

type GeocodingInstitutionRow = {
  id: string;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  stateCode: string | null;
  postalCode: string | null;
  countryCode: string | null;
  geocodeStatus: GeocodeStatus;
  geocodeAttempts: number;
  lastGeocodedAt: Date | null;
  latitude: Prisma.Decimal | null;
  longitude: Prisma.Decimal | null;
};

type GeocodingProviderLocationRow = {
  id: string;
  addressHash: string;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  stateCode: string | null;
  postalCode: string | null;
  countryCode: string | null;
  geocodeStatus: GeocodeStatus;
  geocodeAttempts: number;
  lastGeocodedAt: Date | null;
  latitude: Prisma.Decimal | null;
  longitude: Prisma.Decimal | null;
};

type GeocodingBoundaryRow = {
  stateCode: string | null;
  centroidLat: Prisma.Decimal | null;
  centroidLng: Prisma.Decimal | null;
};

type GeospatialPrismaClient = PrismaClient & {
  institution: {
    findMany(args: unknown): Promise<GeocodingInstitutionRow[]>;
    update(args: unknown): Promise<unknown>;
  };
  providerLocation: {
    findMany(args: unknown): Promise<GeocodingProviderLocationRow[]>;
    update(args: unknown): Promise<unknown>;
  };
  geographicBoundary: {
    findMany(args: unknown): Promise<GeocodingBoundaryRow[]>;
  };
};

type GeocodableRecord = {
  kind: 'institution' | 'provider_location';
  id: string;
  addressHash: string;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  stateCode: string | null;
  postalCode: string | null;
  countryCode: string | null;
  geocodeStatus: GeocodeStatus;
  geocodeAttempts: number;
  lastGeocodedAt: Date | null;
  latitude: Prisma.Decimal | null;
  longitude: Prisma.Decimal | null;
};

type StateCentroid = {
  latitude: number;
  longitude: number;
};

type ZipCentroid = StateCentroid & {
  stateCode: string | null;
};

type ZipCentroidIndex = Map<string, ZipCentroid>;

type GeocodeResolution = {
  status: GeocodeStatus;
  precision: GeocodePrecision;
  source: string | null;
  latitude: number | null;
  longitude: number | null;
  error: string | null;
};

type CensusResponse = {
  result?: {
    addressMatches?: Array<{
      matchedAddress?: string;
      coordinates?: {
        x?: number;
        y?: number;
      };
    }>;
  };
};

let zipCentroidIndexPromise: Promise<ZipCentroidIndex> | null = null;

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

function buildOneLineAddress(record: Pick<
  GeocodableRecord,
  'addressLine1' | 'addressLine2' | 'city' | 'stateCode' | 'postalCode'
>): string | null {
  const parts = [
    normalizeAddressPart(record.addressLine1),
    normalizeAddressPart(record.addressLine2),
    normalizeAddressPart(record.city),
    normalizeAddressPart(record.stateCode),
    normalizeAddressPart(record.postalCode),
  ].filter((part) => part.length > 0);

  return parts.length >= 3 ? parts.join(', ') : null;
}

function zip5(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const digits = value.replace(/[^0-9]/g, '');
  return digits.length >= 5 ? digits.slice(0, 5) : null;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function withGeospatialSpan<T>(
  name: string,
  attributes: Attributes,
  invoke: () => Promise<T>,
): Promise<T> {
  return geospatialTracer.startActiveSpan(name, async (span) => {
    span.setAttributes(attributes);
    try {
      const result = await invoke();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'geospatial operation failed',
      });
      throw error;
    } finally {
      span.end();
    }
  });
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'VitalCV/1.0 (+https://vitalcv.com)',
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function geocodeWithCensus(record: GeocodableRecord): Promise<GeocodeResolution | null> {
  const address = buildOneLineAddress(record);
  if (!address) {
    return null;
  }

  const timeoutMs = readIntegerEnv('GEOSPATIAL_GEOCODER_TIMEOUT_MS', DEFAULT_HTTP_TIMEOUT_MS);
  const maxAttempts = readIntegerEnv('GEOSPATIAL_GEOCODER_HTTP_ATTEMPTS', 2);
  let attempt = 0;

  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      const url = new URL(CENSUS_GEOCODER_URL);
      url.searchParams.set('benchmark', 'Public_AR_Current');
      url.searchParams.set('format', 'json');
      url.searchParams.set('address', address);

      const response = await withGeospatialSpan(
        'geospatial.geocode.http_census',
        {
          'geospatial.kind': record.kind,
          'geospatial.address_sha256': record.addressHash,
          'http.request.method': 'GET',
          'url.full': CENSUS_GEOCODER_URL,
          'geospatial.retry_attempt': attempt,
        },
        async () => fetchWithTimeout(url.toString(), timeoutMs),
      );

      if (!response.ok) {
        if (response.status === 429 || response.status >= 500) {
          throw new Error(`Census geocoder returned ${response.status}`);
        }

        return {
          status: GeocodeStatus.FAILED,
          precision: GeocodePrecision.UNRESOLVED,
          source: 'US_CENSUS',
          latitude: null,
          longitude: null,
          error: `Census geocoder returned ${response.status}`,
        };
      }

      const payload = await response.json() as CensusResponse;
      const match = payload.result?.addressMatches?.[0];
      const latitude = asNumber(match?.coordinates?.y);
      const longitude = asNumber(match?.coordinates?.x);

      if (latitude === null || longitude === null) {
        return null;
      }

      return {
        status: GeocodeStatus.GEOCODED,
        precision: GeocodePrecision.STREET,
        source: 'US_CENSUS',
        latitude,
        longitude,
        error: null,
      };
    } catch (error) {
      if (attempt >= maxAttempts) {
        return {
          status: GeocodeStatus.FAILED,
          precision: GeocodePrecision.UNRESOLVED,
          source: 'US_CENSUS',
          latitude: null,
          longitude: null,
          error: error instanceof Error ? error.message : 'Census geocoder failed',
        };
      }

      await delay(250 * (2 ** (attempt - 1)));
    }
  }

  return null;
}

async function readZipCentroidSource(source: string): Promise<string> {
  if (/^https?:\/\//i.test(source)) {
    const response = await fetch(source, {
      headers: { Accept: 'application/json,text/plain' },
    });
    if (!response.ok) {
      throw new Error(`ZIP centroid source returned ${response.status}`);
    }
    return response.text();
  }

  return fs.readFile(source, 'utf8');
}

function parseCsvZipCentroids(raw: string): ZipCentroidIndex {
  const [headerLine, ...rows] = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const headers = (headerLine ?? '').split(',').map((header) => header.trim().toLowerCase());
  const zipIndex = headers.indexOf('zip');
  const latitudeIndex = headers.indexOf('latitude');
  const longitudeIndex = headers.indexOf('longitude');
  const stateIndex = headers.indexOf('state');
  const result = new Map<string, ZipCentroid>();

  if (zipIndex < 0 || latitudeIndex < 0 || longitudeIndex < 0) {
    return result;
  }

  for (const row of rows) {
    const values = row.split(',').map((value) => value.trim());
    const zip = zip5(values[zipIndex] ?? null);
    const latitude = asNumber(values[latitudeIndex]);
    const longitude = asNumber(values[longitudeIndex]);
    if (!zip || latitude === null || longitude === null) {
      continue;
    }

    result.set(zip, {
      latitude,
      longitude,
      stateCode: asString(values[stateIndex] ?? null)?.toUpperCase() ?? null,
    });
  }

  return result;
}

function parseJsonZipCentroids(raw: string): ZipCentroidIndex {
  const parsed = JSON.parse(raw) as unknown;
  const entries = Array.isArray(parsed)
    ? parsed
    : Array.isArray(asRecord(parsed).rows)
      ? asRecord(parsed).rows as unknown[]
      : [];
  const result = new Map<string, ZipCentroid>();

  for (const entry of entries) {
    const record = asRecord(entry);
    const zip = zip5(
      asString(record.zip)
      ?? asString(record.postalCode)
      ?? asString(record.postal_code),
    );
    const latitude = asNumber(record.latitude) ?? asNumber(record.lat);
    const longitude = asNumber(record.longitude) ?? asNumber(record.lng) ?? asNumber(record.lon);
    if (!zip || latitude === null || longitude === null) {
      continue;
    }

    result.set(zip, {
      latitude,
      longitude,
      stateCode: (asString(record.stateCode) ?? asString(record.state) ?? asString(record.state_code))?.toUpperCase() ?? null,
    });
  }

  return result;
}

async function loadZipCentroids(): Promise<ZipCentroidIndex> {
  if (zipCentroidIndexPromise) {
    return zipCentroidIndexPromise;
  }

  zipCentroidIndexPromise = (async () => {
    const source = process.env.GEOSPATIAL_ZIP_CENTROIDS_PATH ?? process.env.GEOSPATIAL_ZIP_CENTROIDS_URL;
    if (!source) {
      return new Map<string, ZipCentroid>();
    }

    try {
      const raw = await readZipCentroidSource(source);
      const trimmed = raw.trim();
      return trimmed.startsWith('{') || trimmed.startsWith('[')
        ? parseJsonZipCentroids(trimmed)
        : parseCsvZipCentroids(trimmed);
    } catch (error) {
      log('warn', 'geospatial.zip_centroids_load_failed', {
        event: 'geospatial_zip_centroids_load_failed',
        error: error instanceof Error ? error.message : 'unknown',
      });
      return new Map<string, ZipCentroid>();
    }
  })();

  return zipCentroidIndexPromise;
}

async function loadStateCentroids(
  prismaClient: PrismaClient,
): Promise<Map<string, StateCentroid>> {
  const geospatialPrisma = prismaClient as GeospatialPrismaClient;
  const boundaries = await geospatialPrisma.geographicBoundary.findMany({
    where: {
      boundaryType: GeographicBoundaryType.STATE,
      stateCode: { not: null },
      centroidLat: { not: null },
      centroidLng: { not: null },
    },
    select: {
      stateCode: true,
      centroidLat: true,
      centroidLng: true,
    },
  });

  return new Map(
    boundaries
      .filter((boundary) => boundary.stateCode && boundary.centroidLat && boundary.centroidLng)
      .map((boundary) => [
        boundary.stateCode as string,
        {
          latitude: Number(boundary.centroidLat),
          longitude: Number(boundary.centroidLng),
        },
      ]),
  );
}

function fallbackGeocode(
  record: GeocodableRecord,
  zipCentroids: ZipCentroidIndex,
  stateCentroids: Map<string, StateCentroid>,
): GeocodeResolution {
  const zip = zip5(record.postalCode);
  const stateCode = record.stateCode?.toUpperCase() ?? null;

  if (zip) {
    const centroid = zipCentroids.get(zip);
    if (centroid) {
      return {
        status: GeocodeStatus.GEOCODED,
        precision: GeocodePrecision.ZIP_CENTROID,
        source: 'ZIP_CENTROID',
        latitude: centroid.latitude,
        longitude: centroid.longitude,
        error: null,
      };
    }
  }

  if (stateCode) {
    const centroid = stateCentroids.get(stateCode);
    if (centroid) {
      return {
        status: GeocodeStatus.GEOCODED,
        precision: GeocodePrecision.STATE_CENTROID,
        source: 'STATE_BOUNDARY_CENTROID',
        latitude: centroid.latitude,
        longitude: centroid.longitude,
        error: null,
      };
    }
  }

  return {
    status: GeocodeStatus.FAILED,
    precision: GeocodePrecision.UNRESOLVED,
    source: null,
    latitude: null,
    longitude: null,
    error: 'No reliable geocoding input was available',
  };
}

async function geocodeRecord(
  record: GeocodableRecord,
  zipCentroids: ZipCentroidIndex,
  stateCentroids: Map<string, StateCentroid>,
): Promise<GeocodeResolution> {
  const direct = await geocodeWithCensus(record);
  if (direct?.status === GeocodeStatus.GEOCODED) {
    return direct;
  }

  const fallback = fallbackGeocode(record, zipCentroids, stateCentroids);
  if (fallback.status === GeocodeStatus.GEOCODED) {
    return fallback;
  }

  return direct ?? fallback;
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  const queue = [...items];
  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (queue.length > 0) {
      const next = queue.shift();
      if (!next) {
        return;
      }

      await worker(next);
    }
  });

  await Promise.all(workers);
}

function isStale(lastGeocodedAt: Date | null, staleDays: number): boolean {
  if (!lastGeocodedAt) {
    return true;
  }

  return Date.now() - lastGeocodedAt.getTime() >= staleDays * 86_400_000;
}

async function loadPendingInstitutionRecords(
  prismaClient: PrismaClient,
  batchSize: number,
  maxAttempts: number,
  staleDays: number,
): Promise<GeocodableRecord[]> {
  const geospatialPrisma = prismaClient as GeospatialPrismaClient;
  const rows = await geospatialPrisma.institution.findMany({
    where: {
      geocodeAttempts: { lt: maxAttempts },
    },
    orderBy: [
      { geocodeStatus: 'asc' },
      { updatedAt: 'asc' },
    ],
    take: batchSize,
    select: {
      id: true,
      addressLine1: true,
      addressLine2: true,
      city: true,
      stateCode: true,
      postalCode: true,
      countryCode: true,
      geocodeStatus: true,
      geocodeAttempts: true,
      lastGeocodedAt: true,
      latitude: true,
      longitude: true,
    },
  });

  return rows
    .filter((row) => row.geocodeStatus !== GeocodeStatus.GEOCODED || isStale(row.lastGeocodedAt, staleDays))
    .filter((row) => Boolean(row.addressLine1 || row.city || row.stateCode || row.postalCode))
    .map((row) => ({
      kind: 'institution' as const,
      id: row.id,
      addressHash: hashAddress([
        row.addressLine1,
        row.addressLine2,
        row.city,
        row.stateCode,
        row.postalCode,
        row.countryCode,
      ]),
      addressLine1: row.addressLine1,
      addressLine2: row.addressLine2,
      city: row.city,
      stateCode: row.stateCode,
      postalCode: row.postalCode,
      countryCode: row.countryCode,
      geocodeStatus: row.geocodeStatus,
      geocodeAttempts: row.geocodeAttempts,
      lastGeocodedAt: row.lastGeocodedAt,
      latitude: row.latitude,
      longitude: row.longitude,
    }));
}

async function loadPendingProviderLocationRecords(
  prismaClient: PrismaClient,
  batchSize: number,
  maxAttempts: number,
  staleDays: number,
): Promise<GeocodableRecord[]> {
  const geospatialPrisma = prismaClient as GeospatialPrismaClient;
  const rows = await geospatialPrisma.providerLocation.findMany({
    where: {
      geocodeAttempts: { lt: maxAttempts },
      isCurrent: true,
    },
    orderBy: [
      { geocodeStatus: 'asc' },
      { updatedAt: 'asc' },
    ],
    take: batchSize,
    select: {
      id: true,
      addressHash: true,
      addressLine1: true,
      addressLine2: true,
      city: true,
      stateCode: true,
      postalCode: true,
      countryCode: true,
      geocodeStatus: true,
      geocodeAttempts: true,
      lastGeocodedAt: true,
      latitude: true,
      longitude: true,
    },
  });

  return rows
    .filter((row) => row.geocodeStatus !== GeocodeStatus.GEOCODED || isStale(row.lastGeocodedAt, staleDays))
    .filter((row) => Boolean(row.addressLine1 || row.city || row.stateCode || row.postalCode))
    .map((row) => ({
      kind: 'provider_location' as const,
      id: row.id,
      addressHash: row.addressHash,
      addressLine1: row.addressLine1,
      addressLine2: row.addressLine2,
      city: row.city,
      stateCode: row.stateCode,
      postalCode: row.postalCode,
      countryCode: row.countryCode,
      geocodeStatus: row.geocodeStatus,
      geocodeAttempts: row.geocodeAttempts,
      lastGeocodedAt: row.lastGeocodedAt,
      latitude: row.latitude,
      longitude: row.longitude,
    }));
}

async function applyInstitutionGeocodeResult(
  prismaClient: PrismaClient,
  record: GeocodableRecord,
  resolution: GeocodeResolution,
): Promise<void> {
  const now = new Date();
  const preserveExisting = record.geocodeStatus === GeocodeStatus.GEOCODED && record.latitude && record.longitude;

  await (prismaClient as GeospatialPrismaClient).institution.update({
    where: { id: record.id },
    data: resolution.status === GeocodeStatus.GEOCODED
      ? {
        geocodeStatus: resolution.status,
        geocodePrecision: resolution.precision,
        geocodeSource: resolution.source,
        latitude: new Prisma.Decimal(resolution.latitude ?? 0),
        longitude: new Prisma.Decimal(resolution.longitude ?? 0),
        geocodeAttempts: { increment: 1 },
        lastGeocodedAt: now,
        lastGeocodeError: null,
      }
      : {
        ...(preserveExisting
          ? {}
          : {
            geocodeStatus: GeocodeStatus.FAILED,
            geocodePrecision: GeocodePrecision.UNRESOLVED,
          }),
        geocodeAttempts: { increment: 1 },
        ...(preserveExisting ? {} : { geocodeSource: resolution.source }),
        ...(preserveExisting ? {} : { lastGeocodedAt: now }),
        lastGeocodeError: resolution.error?.slice(0, 500) ?? 'Unresolved geocoding result',
      },
  });
}

async function applyProviderLocationGeocodeResult(
  prismaClient: PrismaClient,
  record: GeocodableRecord,
  resolution: GeocodeResolution,
): Promise<void> {
  const now = new Date();
  const preserveExisting = record.geocodeStatus === GeocodeStatus.GEOCODED && record.latitude && record.longitude;

  await (prismaClient as GeospatialPrismaClient).providerLocation.update({
    where: { id: record.id },
    data: resolution.status === GeocodeStatus.GEOCODED
      ? {
        geocodeStatus: resolution.status,
        geocodePrecision: resolution.precision,
        geocodeSource: resolution.source,
        latitude: new Prisma.Decimal(resolution.latitude ?? 0),
        longitude: new Prisma.Decimal(resolution.longitude ?? 0),
        geocodeAttempts: { increment: 1 },
        lastGeocodedAt: now,
        lastGeocodeError: null,
      }
      : {
        ...(preserveExisting
          ? {}
          : {
            geocodeStatus: GeocodeStatus.FAILED,
            geocodePrecision: GeocodePrecision.UNRESOLVED,
          }),
        geocodeAttempts: { increment: 1 },
        ...(preserveExisting ? {} : { geocodeSource: resolution.source }),
        ...(preserveExisting ? {} : { lastGeocodedAt: now }),
        lastGeocodeError: resolution.error?.slice(0, 500) ?? 'Unresolved geocoding result',
      },
  });
}

export async function runGeocodingBatch(
  options: {
    prismaClient?: PrismaClient;
    batchSize?: number;
    concurrency?: number;
    includeInstitutions?: boolean;
    includeProviderLocations?: boolean;
  } = {},
): Promise<{
    processed: number;
    geocoded: number;
    failed: number;
    dedupedAddresses: number;
  }> {
  const prismaClient = options.prismaClient ?? prisma;
  const batchSize = Math.max(1, options.batchSize ?? readIntegerEnv('GEOSPATIAL_GEOCODE_BATCH_SIZE', DEFAULT_BATCH_SIZE));
  const concurrency = Math.max(1, options.concurrency ?? readIntegerEnv('GEOSPATIAL_GEOCODE_CONCURRENCY', DEFAULT_CONCURRENCY));
  const maxAttempts = readIntegerEnv('GEOSPATIAL_GEOCODE_MAX_ATTEMPTS', DEFAULT_MAX_ATTEMPTS);
  const staleDays = readIntegerEnv('GEOSPATIAL_GEOCODE_STALE_DAYS', DEFAULT_STALE_DAYS);

  return withGeospatialSpan(
    'geospatial.geocode.batch',
    {
      'geospatial.batch_size': batchSize,
      'geospatial.concurrency': concurrency,
      'geospatial.max_attempts': maxAttempts,
    },
    async () => {
      const [institutions, providerLocations, zipCentroids, stateCentroids] = await Promise.all([
        options.includeInstitutions === false
          ? Promise.resolve([])
          : loadPendingInstitutionRecords(prismaClient, batchSize, maxAttempts, staleDays),
        options.includeProviderLocations === false
          ? Promise.resolve([])
          : loadPendingProviderLocationRecords(prismaClient, batchSize, maxAttempts, staleDays),
        loadZipCentroids(),
        loadStateCentroids(prismaClient),
      ]);

      const targets = [...institutions, ...providerLocations];
      if (targets.length === 0) {
        return {
          processed: 0,
          geocoded: 0,
          failed: 0,
          dedupedAddresses: 0,
        };
      }

      const uniqueTargets = new Map<string, GeocodableRecord>();
      for (const target of targets) {
        if (!uniqueTargets.has(target.addressHash)) {
          uniqueTargets.set(target.addressHash, target);
        }
      }

      const resolutions = new Map<string, GeocodeResolution>();
      await runWithConcurrency([...uniqueTargets.values()], concurrency, async (target) => {
        const resolution = await geocodeRecord(target, zipCentroids, stateCentroids);
        resolutions.set(target.addressHash, resolution);

        log(
          resolution.status === GeocodeStatus.GEOCODED ? 'info' : 'warn',
          'geospatial.geocode_result',
          {
            event: 'geospatial_geocode_result',
            kind: target.kind,
            addressHash: target.addressHash,
            status: resolution.status,
            precision: resolution.precision,
            source: resolution.source,
          },
        );
      });

      let geocoded = 0;
      let failed = 0;

      for (const target of targets) {
        const resolution = resolutions.get(target.addressHash);
        if (!resolution) {
          failed += 1;
          continue;
        }

        if (resolution.status === GeocodeStatus.GEOCODED) {
          geocoded += 1;
        } else {
          failed += 1;
        }

        if (target.kind === 'institution') {
          await applyInstitutionGeocodeResult(prismaClient, target, resolution);
        } else {
          await applyProviderLocationGeocodeResult(prismaClient, target, resolution);
        }
      }

      return {
        processed: targets.length,
        geocoded,
        failed,
        dedupedAddresses: uniqueTargets.size,
      };
    },
  );
}

export function isGeocodingEnabled(): boolean {
  return readBooleanEnv('GEOSPATIAL_GEOCODING_ENABLED', true);
}

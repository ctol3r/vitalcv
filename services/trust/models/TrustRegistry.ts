import type {
  AccreditationStatus as PrismaAccreditationStatus,
  Prisma,
  PrismaClient,
  TrustEntityType as PrismaTrustEntityType,
  TrustRegistry as PrismaTrustRegistry,
} from '@prisma/client';
import { AccreditationStatus, TrustEntityType } from '@prisma/client';
import { z } from 'zod';
import {
  TrustMetricsSchema,
  calculateTrustScore,
  type TrustMetrics,
  type TrustScoreBreakdown,
  type TrustTier,
  withDefaultMetrics,
} from '../trustScoreEngine';

const DidSchema = z.string().min(6, 'DID is required').regex(/^did:/, 'must provide a DID identifier');
const PublicKeySchema = z.string().min(30, 'public key must be at least 30 chars');
const DisplayNameSchema = z.string().min(3).max(160);
const OptionalDisplayNameSchema = DisplayNameSchema.optional();

const MetadataSchema = z
  .record(z.any())
  .optional()
  .transform((value) => (value ? value : undefined));

const MetricsSchema = TrustMetricsSchema.partial();

const TrustRegistryInputSchema = z.object({
  entityId: z.string().min(2),
  entityType: z.nativeEnum(TrustEntityType),
  did: DidSchema,
  publicKeys: z.array(PublicKeySchema).min(1),
  jurisdiction: z
    .string()
    .min(2)
    .max(64)
    .optional()
    .transform((value) => (value ? value.toUpperCase() : undefined)),
  accreditationStatus: z.nativeEnum(AccreditationStatus),
  displayName: OptionalDisplayNameSchema,
  metadata: MetadataSchema,
  metrics: MetricsSchema,
});

export type TrustRegistryInput = z.infer<typeof TrustRegistryInputSchema>;

export interface TrustRegistryFilters {
  entityType?: PrismaTrustEntityType | PrismaTrustEntityType[];
  jurisdiction?: string;
  accreditationStatus?: PrismaAccreditationStatus | PrismaAccreditationStatus[];
  search?: string;
}

export interface TrustRegistryView {
  id: string;
  entityId: string;
  entityType: PrismaTrustEntityType;
  did: string;
  publicKeys: string[];
  jurisdiction: string | null;
  accreditationStatus: PrismaAccreditationStatus;
  displayName: string;
  metadata: Record<string, unknown>;
  metrics: TrustMetrics;
  score: TrustScoreBreakdown;
  trustScore: number;
  tier: TrustTier;
  updatedAt: string;
  source: 'registry' | 'globalFallback';
}

type JsonValue = Prisma.InputJsonValue;

const DEFAULT_DISPLAY = (entityId: string) =>
  entityId
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

function buildMetadataPayload(
  metadata?: Record<string, unknown>,
  displayName?: string,
  metrics?: Partial<TrustMetrics>
): JsonValue | undefined {
  const payload: Record<string, unknown> = metadata ? { ...metadata } : {};

  if (displayName) {
    payload.displayName = displayName;
  }

  if (metrics && Object.keys(metrics).length > 0) {
    const existingMetrics =
      payload.metrics && typeof payload.metrics === 'object' && !Array.isArray(payload.metrics)
        ? (payload.metrics as Record<string, unknown>)
        : {};
    payload.metrics = { ...existingMetrics, ...metrics };
  }

  return Object.keys(payload).length > 0 ? (payload as JsonValue) : undefined;
}

function extractMetadata(record: PrismaTrustRegistry): Record<string, unknown> {
  if (!record.metadata || typeof record.metadata !== 'object' || Array.isArray(record.metadata)) {
    return {};
  }

  return record.metadata as Record<string, unknown>;
}

function extractMetrics(metadata: Record<string, unknown>): TrustMetrics {
  const raw = metadata.metrics;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return withDefaultMetrics();
  }

  const candidate: Partial<TrustMetrics> = {};
  if (typeof (raw as any).verificationAccuracy === 'number') {
    candidate.verificationAccuracy = (raw as any).verificationAccuracy;
  }
  if (typeof (raw as any).freshnessHours === 'number') {
    candidate.freshnessHours = (raw as any).freshnessHours;
  }
  if (typeof (raw as any).uptimePercentage === 'number') {
    candidate.uptimePercentage = (raw as any).uptimePercentage;
  }
  return withDefaultMetrics(candidate);
}

export function hydrateTrustRegistryRecord(
  record: PrismaTrustRegistry,
  opts: { source?: 'registry' | 'globalFallback' } = {}
): TrustRegistryView {
  const metadata = extractMetadata(record);
  const displayName = typeof metadata.displayName === 'string' ? (metadata.displayName as string) : DEFAULT_DISPLAY(record.entityId);
  const metrics = extractMetrics(metadata);
  const score = calculateTrustScore(metrics);

  return {
    id: record.id,
    entityId: record.entityId,
    entityType: record.entityType,
    did: record.did,
    publicKeys: record.publicKeys,
    jurisdiction: record.jurisdiction ?? null,
    accreditationStatus: record.accreditationStatus,
    displayName,
    metadata,
    metrics,
    score,
    trustScore: score.overallScore,
    tier: score.tier,
    updatedAt: record.updatedAt.toISOString(),
    source: opts.source ?? 'registry',
  };
}

export async function registerTrustEntity(
  prisma: PrismaClient,
  input: TrustRegistryInput
): Promise<TrustRegistryView> {
  const parsed = TrustRegistryInputSchema.parse(input);
  const metadataPayload = buildMetadataPayload(parsed.metadata, parsed.displayName, parsed.metrics);

  const createData: Prisma.TrustRegistryCreateInput = {
    entityId: parsed.entityId.toLowerCase(),
    entityType: parsed.entityType,
    did: parsed.did,
    publicKeys: parsed.publicKeys,
    jurisdiction: parsed.jurisdiction ?? null,
    accreditationStatus: parsed.accreditationStatus,
    ...(metadataPayload ? { metadata: metadataPayload } : {}),
  };

  const updateData: Prisma.TrustRegistryUpdateInput = {
    did: parsed.did,
    publicKeys: parsed.publicKeys,
    jurisdiction: parsed.jurisdiction ?? null,
    accreditationStatus: parsed.accreditationStatus,
    ...(metadataPayload ? { metadata: metadataPayload } : {}),
  };

  const record = await prisma.trustRegistry.upsert({
    where: {
      entityId_entityType: {
        entityId: parsed.entityId.toLowerCase(),
        entityType: parsed.entityType,
      },
    },
    create: createData,
    update: updateData,
  });

  return hydrateTrustRegistryRecord(record);
}

export async function listTrustRegistryEntries(
  prisma: PrismaClient,
  filters: TrustRegistryFilters = {}
): Promise<TrustRegistryView[]> {
  const where: Prisma.TrustRegistryWhereInput = {};

  if (filters.entityType) {
    if (Array.isArray(filters.entityType)) {
      where.entityType = { in: filters.entityType };
    } else {
      where.entityType = filters.entityType;
    }
  }

  if (filters.jurisdiction) {
    where.jurisdiction = filters.jurisdiction.toUpperCase();
  }

  if (filters.accreditationStatus) {
    if (Array.isArray(filters.accreditationStatus)) {
      where.accreditationStatus = { in: filters.accreditationStatus };
    } else {
      where.accreditationStatus = filters.accreditationStatus;
    }
  }

  const records = await prisma.trustRegistry.findMany({
    where,
    orderBy: [{ entityType: 'asc' }, { entityId: 'asc' }],
  });

  let views = records.map((record) => hydrateTrustRegistryRecord(record));

  if (filters.search) {
    const query = filters.search.toLowerCase();
    views = views.filter((view) => {
      return (
        view.entityId.toLowerCase().includes(query) ||
        view.displayName.toLowerCase().includes(query) ||
        view.did.toLowerCase().includes(query) ||
        (view.jurisdiction ?? '').toLowerCase().includes(query)
      );
    });
  }

  return views;
}

export async function getTrustEntityByDid(
  prisma: PrismaClient,
  did: string
): Promise<TrustRegistryView | null> {
  const record = await prisma.trustRegistry.findUnique({
    where: { did },
  });

  if (!record) {
    return null;
  }

  return hydrateTrustRegistryRecord(record);
}


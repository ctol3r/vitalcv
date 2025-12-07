import { createHash } from 'crypto';
import type { PrismaClient, Prisma } from '@prisma/client';
import { PrismaClient as DefaultPrismaClient } from '@prisma/client';
import {
  type IdentityConflict,
  type IdentityFusionOptions,
  type IdentityFusionPayload,
  type IdentityIngestionResult,
  type IdentityLineageGraph,
  type IdentityMatchEntry,
  type IdentityReliabilityBreakdown,
  type IdentitySourceRecord,
  type IdentitySourceType,
} from './types';
import { anchorEvent, type AnchorRecord } from '../audit/anchor';
import { ProviderLifecycleEngine } from '../lifecycle/provider';

const prisma = new DefaultPrismaClient();
const lifecycleEngine = new ProviderLifecycleEngine(prisma);

const GLOBAL_REGULATOR_MAP: Record<string, IdentitySourceType> = {
  AHPRA: 'ahpra',
  'AHPRA - AUSTRALIA': 'ahpra',
  GMC: 'gmc',
  'GENERAL MEDICAL COUNCIL': 'gmc',
  NMC: 'nmc',
  'NURSING AND MIDWIFERY COUNCIL': 'nmc',
};

interface IngestionOptions {
  prisma?: PrismaClient;
  now?: Date;
}

export async function ingestIdentitySources(
  clinicianId: string,
  options: IngestionOptions = {},
): Promise<IdentityIngestionResult> {
  if (!clinicianId) {
    throw new Error('clinicianId is required for identity ingestion');
  }

  const client = options.prisma ?? prisma;
  const now = options.now ?? new Date();

  const [clinician, npiValidations, stateLicenses, npdbEvents, safetySignals, globalLicenses] =
    await Promise.all([
      client.clinicianProfile.findUnique({
        where: { id: clinicianId },
        include: { user: true },
      }),
      client.nPIValidation.findMany({
        where: { clinicianId },
        orderBy: { updatedAt: 'desc' },
        take: 3,
      }),
      client.stateLicenseVerification.findMany({
        where: { clinicianId },
        orderBy: { updatedAt: 'desc' },
        take: 25,
      }),
      client.riskEvent.findMany({
        where: { clinicianId, type: 'npdb' },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      client.privilegeSafetySignal.findMany({
        where: { clinicianId, signalType: 'NPDB_FLAG' },
        orderBy: { detectedAt: 'desc' },
        take: 10,
      }),
      client.globalLicense.findMany({
        where: { clinicianId },
        orderBy: { updatedAt: 'desc' },
        take: 25,
      }),
    ]);

  if (!clinician) {
    throw new Error(`Clinician ${clinicianId} not found`);
  }

  const sources: IdentitySourceRecord[] = [];

  if (npiValidations.length) {
    const primary = npiValidations[0];
    sources.push({
      source: 'nppes',
      clinicianId,
      referenceId: primary.id,
      fetchedAt: primary.updatedAt.toISOString(),
      confidence: clamp(primary.score ?? 0.75, 0, 1),
      attributes: {
        name: coerceString((primary.crossRefs as Record<string, unknown> | null)?.['name']) ?? clinician.displayName ?? clinician.user?.name ?? null,
        aliases: collectAliasCandidates(primary),
        birthDate: coerceString((primary.crossRefs as Record<string, unknown> | null)?.['dob']),
        specialties: extractStringArray((primary.crossRefs as Record<string, unknown> | null)?.['specialties']),
        graduationYear: coerceNumber((primary.crossRefs as Record<string, unknown> | null)?.['graduationYear']),
        location: {
          city: coerceString((primary.crossRefs as Record<string, unknown> | null)?.['city']),
          state: coerceString((primary.crossRefs as Record<string, unknown> | null)?.['state']),
          country: 'US',
        },
        metadata: {
          npi: primary.npi,
          score: primary.score,
        },
      },
      raw: serialize(primary),
    });
  }

  stateLicenses.forEach((license) => {
    sources.push({
      source: 'state_board',
      clinicianId,
      referenceId: license.id,
      fetchedAt: (license.updatedAt ?? license.verifiedAt ?? license.createdAt ?? now).toISOString(),
      confidence: deriveLicenseConfidence(license),
      attributes: {
        name: coerceString((license.metadata as Record<string, unknown> | null)?.['name']),
        graduationYear: coerceNumber((license.metadata as Record<string, unknown> | null)?.['graduationYear']),
        specialties: normalizeList([
          (license.metadata as Record<string, unknown> | null)?.['specialty'] as string | undefined,
          (license.metadata as Record<string, unknown> | null)?.['classification'] as string | undefined,
        ]),
        licenseNumbers: license.licenseNumber ? [license.licenseNumber] : [],
        location: {
          state: license.state,
          country: 'US',
        },
        metadata: {
          status: license.status,
          expiresAt: license.expiryDate?.toISOString() ?? null,
        },
      },
      raw: serialize(license),
    });
  });

  const npdbConfidenceBase = safetySignals.some((signal) => signal.severity === 'CRITICAL') ? 0.35 : 0.65;
  if (npdbEvents.length || safetySignals.length) {
    sources.push({
      source: 'npdb',
      clinicianId,
      referenceId: npdbEvents[0]?.id ?? safetySignals[0]?.id ?? `npdb:${clinicianId}`,
      fetchedAt: (npdbEvents[0]?.createdAt ?? safetySignals[0]?.detectedAt ?? now).toISOString(),
      confidence: clamp(npdbConfidenceBase, 0, 1),
      attributes: {
        name: clinician.displayName ?? clinician.user?.name ?? null,
        aliases: safetySignals.flatMap((signal) => {
          const alias = coerceString((signal.details as Record<string, unknown> | null)?.['alias']);
          return alias ? [alias] : [];
        }),
        specialties: [],
        metadata: {
          events: npdbEvents.map((event) => ({
            id: event.id,
            severity: event.severity,
            createdAt: event.createdAt.toISOString(),
          })),
          signals: safetySignals.map((signal) => ({
            id: signal.id,
            severity: signal.severity,
            detectedAt: signal.detectedAt?.toISOString() ?? signal.createdAt.toISOString(),
          })),
        },
      },
      raw: {
        events: npdbEvents,
        signals: safetySignals,
      },
    });
  }

  globalLicenses
    .filter((license) => {
      if (!license.authority) return false;
      const normalized = license.authority.toUpperCase();
      return Boolean(Object.keys(GLOBAL_REGULATOR_MAP).find((key) => normalized.includes(key)));
    })
    .forEach((license) => {
      const source = resolveGlobalSource(license.authority);
      if (!source) return;
      sources.push({
        source,
        clinicianId,
        referenceId: license.id,
        fetchedAt: (license.updatedAt ?? license.lastVerified ?? now).toISOString(),
        confidence: clamp((license.provenanceScore ?? 70) / 100, 0, 1),
        attributes: {
          name: coerceString((license.payload as Record<string, unknown> | null)?.['name']),
          graduationYear: coerceNumber((license.payload as Record<string, unknown> | null)?.['graduationYear']),
          specialties: extractStringArray((license.payload as Record<string, unknown> | null)?.['specialties']),
          licenseNumbers: license.licenseNumber ? [license.licenseNumber] : [],
          location: {
            country: license.country,
          },
          metadata: {
            authority: license.authority,
            status: license.status,
          },
        },
        raw: serialize(license),
      });
    });

  return {
    clinicianId,
    fetchedAt: now.toISOString(),
    sources,
  };
}

export async function runIdentityFusion(
  clinicianId: string,
  options: IdentityFusionOptions = {},
): Promise<{
  snapshotId: string | null;
  payload: IdentityFusionPayload;
  anchor?: AnchorRecord;
}> {
  if (!clinicianId) {
    throw new Error('clinicianId is required for identity fusion');
  }

  const client = (options.prisma ?? prisma) as PrismaClient;
  const now = options.now ?? new Date();

  const previousSnapshot = await client.identityFusionSnapshot.findFirst({
    where: { clinicianId },
    orderBy: { timestamp: 'desc' },
  });

  const ingestion = await ingestIdentitySources(clinicianId, { prisma: client, now });
  const matches = scoreIdentityOverlap(ingestion.sources);
  const conflicts = resolveIdentityConflicts(ingestion.sources, matches);
  const lineage = buildIdentityLineage(ingestion.sources);
  const reliability = computeIdentityReliability({
    sources: ingestion.sources,
    conflicts,
    now,
  });
  const transparency = buildTransparency(ingestion.sources, conflicts);

  const fusedPayload: IdentityFusionPayload = {
    clinicianId,
    generatedAt: now.toISOString(),
    primaryName: pickBestValue('name', ingestion.sources),
    normalizedName: normalizeName(pickBestValue('name', ingestion.sources)),
    aliases: dedupeStrings(ingestion.sources.flatMap((record) => record.attributes.aliases ?? [])),
    birthDate: pickBestValue('birthDate', ingestion.sources),
    graduationYear: pickNumericValue('graduationYear', ingestion.sources),
    specialties: dedupeStrings(ingestion.sources.flatMap((record) => record.attributes.specialties ?? [])),
    sourceBreakdown: buildSourceBreakdown(ingestion.sources),
    reliability,
    matchMatrix: matches,
    conflicts,
    lineage,
    transparency,
  };

  let anchor: AnchorRecord | undefined;
  if (!options.skipAnchor) {
    anchor = anchorIdentityFusion({
      clinicianId,
      snapshotHash: hashValue(fusedPayload),
      sourceCount: ingestion.sources.length,
      conflictCount: conflicts.length,
      reliability: reliability.overall,
    });
  }

  let snapshotId: string | null = null;
  if (options.persist !== false) {
    const snapshot = await client.identityFusionSnapshot.create({
      data: {
        clinicianId,
        fused: fusedPayload,
        confidence: reliability.overall,
        timestamp: now,
      },
    });
    snapshotId = snapshot.id;
    await recordIdentityEvents(client, {
      clinicianId,
      snapshotId,
      previousPayload: (previousSnapshot?.fused as IdentityFusionPayload | null) ?? null,
      nextPayload: fusedPayload,
    });
  }

  try {
    await lifecycleEngine.evaluateAndTransition(clinicianId);
  } catch (error) {
    console.warn('[identity][lifecycle] provider lifecycle evaluation failed', {
      clinicianId,
      error,
    });
  }

  return {
    snapshotId,
    payload: fusedPayload,
    anchor,
  };
}

export function scoreIdentityOverlap(sources: IdentitySourceRecord[]): IdentityMatchEntry[] {
  const entries: IdentityMatchEntry[] = [];
  for (let i = 0; i < sources.length; i += 1) {
    for (let j = i + 1; j < sources.length; j += 1) {
      const a = sources[i];
      const b = sources[j];
      const features = deriveMatchFeatures(a, b);
      const probability = applyBayes(features);
      if (probability < 0.05) continue;
      entries.push({
        sourceA: a.source,
        sourceB: b.source,
        probability,
        evidence: features.filter((feature) => feature.observed).map((feature) => feature.label),
      });
    }
  }
  return entries;
}

export function resolveIdentityConflicts(
  sources: IdentitySourceRecord[],
  matches: IdentityMatchEntry[],
): IdentityConflict[] {
  const conflicts: IdentityConflict[] = [];
  const graduationConflict = detectGraduationConflict(sources);
  if (graduationConflict) {
    conflicts.push(graduationConflict);
  }
  const specialtyConflict = detectSpecialtyConflict(sources);
  if (specialtyConflict) {
    conflicts.push(specialtyConflict);
  }
  const nameConflict = detectNameConflict(sources, matches);
  if (nameConflict) {
    conflicts.push(nameConflict);
  }
  return conflicts;
}

export function buildIdentityLineage(sources: IdentitySourceRecord[]): IdentityLineageGraph {
  const nodes: IdentityLineageGraph['nodes'] = [];
  const edges: IdentityLineageGraph['edges'] = [];
  const fieldNodes = new Map<string, IdentityLineageGraph['nodes'][number]>();

  sources.forEach((source) => {
    nodes.push({
      id: source.referenceId,
      label: source.source.toUpperCase(),
      type: 'source',
      weight: Number(source.confidence.toFixed(3)),
    });
    Object.entries(source.attributes).forEach(([field, value]) => {
      if (value === null || value === undefined) return;
      const nodeId = `field:${field}`;
      if (!fieldNodes.has(nodeId)) {
        const newNode = {
          id: nodeId,
          label: field,
          type: 'field' as const,
          weight: 1,
        };
        fieldNodes.set(nodeId, newNode);
        nodes.push(newNode);
      }
      edges.push({
        id: `${source.referenceId}->${nodeId}`,
        fromSource: source.source,
        toField: field,
        weight: Number((source.confidence * 0.8 + 0.2).toFixed(3)),
        fromNodeId: source.referenceId,
        toNodeId: nodeId,
        evidence: summarizeEvidence(field, value),
      });
    });
  });

  return { nodes, edges };
}

export function computeIdentityReliability(params: {
  sources: IdentitySourceRecord[];
  conflicts: IdentityConflict[];
  now: Date;
}): IdentityReliabilityBreakdown {
  const sourceCount = params.sources.length;
  const coverage = sourceCount ? Math.min(1, sourceCount / 4) : 0;
  const conflictPenalty =
    params.conflicts.reduce((sum, conflict) => {
      if (conflict.severity === 'high') return sum + 0.3;
      if (conflict.severity === 'medium') return sum + 0.15;
      return sum + 0.05;
    }, 0) ?? 0;
  const agreement = Math.max(0, 1 - conflictPenalty);
  const recency =
    params.sources.length === 0
      ? 0
      : clamp(
          params.sources.reduce((sum, source) => {
            const ageDays = Math.max(1, (params.now.getTime() - Date.parse(source.fetchedAt)) / (1000 * 60 * 60 * 24));
            const score = ageDays <= 30 ? 1 : Math.max(0.2, 1 - ageDays / 365);
            return sum + score;
          }, 0) / params.sources.length,
          0,
          1,
        );
  const validationDensity =
    params.sources.length === 0
      ? 0
      : params.sources.filter((source) => source.confidence >= 0.8).length / params.sources.length;

  const overall = clamp(
    coverage * 0.25 + agreement * 0.3 + recency * 0.2 + validationDensity * 0.25,
    0,
    1,
  );

  return {
    overall: Number(overall.toFixed(4)),
    coverage: Number(coverage.toFixed(4)),
    agreement: Number(agreement.toFixed(4)),
    recency: Number(recency.toFixed(4)),
    validationDensity: Number(validationDensity.toFixed(4)),
  };
}

async function recordIdentityEvents(
  client: PrismaClient,
  params: {
    clinicianId: string;
    snapshotId: string;
    previousPayload: IdentityFusionPayload | null;
    nextPayload: IdentityFusionPayload;
  },
) {
  const comparableFields: Array<keyof Pick<IdentityFusionPayload, 'primaryName' | 'birthDate' | 'graduationYear' | 'specialties'>> =
    ['primaryName', 'birthDate', 'graduationYear', 'specialties'];

  const events: Prisma.IdentityEventLogCreateManyInput[] = [];

  comparableFields.forEach((field) => {
    const beforeValue = normalizeComparable(params.previousPayload?.[field]);
    const afterValue = normalizeComparable(params.nextPayload[field]);
    if (isEqual(beforeValue, afterValue)) {
      return;
    }
    const changeHash = hashValue({
      clinicianId: params.clinicianId,
      snapshotId: params.snapshotId,
      field,
      beforeValue,
      afterValue,
    });
    events.push({
      clinicianId: params.clinicianId,
      snapshotId: params.snapshotId,
      eventType: params.previousPayload ? 'identity_field_changed' : 'identity_snapshot_created',
      field,
      oldValue: beforeValue as Prisma.JsonValue,
      newValue: afterValue as Prisma.JsonValue,
      changeHash,
      createdAt: new Date(),
    });
  });

  if (!events.length) {
    return;
  }

  await client.identityEventLog.createMany({ data: events });
}

function anchorIdentityFusion(payload: {
  clinicianId: string;
  snapshotHash: string;
  sourceCount: number;
  conflictCount: number;
  reliability: number;
}) {
  return anchorEvent('identityFusionAnchored', {
    clinicianId: payload.clinicianId,
    snapshotHash: payload.snapshotHash,
    sourceCount: payload.sourceCount,
    conflictCount: payload.conflictCount,
    reliability: Number(payload.reliability.toFixed(4)),
  });
}

function buildTransparency(
  sources: IdentitySourceRecord[],
  conflicts: IdentityConflict[],
): IdentityFusionPayload['transparency'] {
  const conflictFields = new Set(conflicts.map((conflict) => conflict.field));
  const trackedFields: Array<keyof IdentitySourceRecord['attributes']> = [
    'name',
    'birthDate',
    'graduationYear',
    'specialties',
  ];

  return trackedFields.map((field) => {
    const contenders = sources
      .map((record) => ({
        source: record.source,
        value: record.attributes[field],
        confidence: record.confidence,
      }))
      .filter((entry) => entry.value !== undefined && entry.value !== null);
    if (!contenders.length) {
      return {
        field,
        winningSource: null,
        supportingSources: [],
        rationale: ['No signals collected for this attribute'],
        confidence: 0,
      };
    }
    contenders.sort((a, b) => b.confidence - a.confidence);
    const winning = contenders[0];
    const supporting = contenders
      .slice(1)
      .filter((entry) => isEqual(normalizeComparable(entry.value), normalizeComparable(winning.value)))
      .map((entry) => entry.source);

    const rationale = [
      `Selected ${winning.source.toUpperCase()} source (confidence ${winning.confidence.toFixed(2)})`,
    ];
    if (supporting.length) {
      rationale.push(`Supported by ${supporting.length} additional sources`);
    }
    if (conflictFields.has(field === 'name' ? 'name' : (field as IdentityConflict['field']))) {
      rationale.push('Conflict detected; awaiting reviewer acknowledgement');
    }

    return {
      field,
      winningSource: winning.source,
      supportingSources: supporting,
      rationale,
      confidence: Number(winning.confidence.toFixed(3)),
    };
  });
}

function detectGraduationConflict(sources: IdentitySourceRecord[]): IdentityConflict | null {
  const values = new Map<number, { confidence: number; sources: IdentitySourceType[] }>();
  sources.forEach((record) => {
    const value = record.attributes.graduationYear;
    if (!value) return;
    const existing = values.get(value) ?? { confidence: 0, sources: [] };
    existing.confidence = Math.max(existing.confidence, record.confidence);
    existing.sources.push(record.source);
    values.set(value, existing);
  });
  if (values.size <= 1) {
    return null;
  }
  const contenders = Array.from(values.entries()).map(([year, stats]) => ({
    source: stats.sources[0],
    value: year,
    confidence: stats.confidence,
  }));
  contenders.sort((a, b) => b.confidence - a.confidence);
  const delta = Math.max(...contenders.map((entry) => Number(entry.value))) - Math.min(...contenders.map((entry) => Number(entry.value)));
  return {
    id: `conflict:graduationYear`,
    type: 'graduation_year_mismatch',
    field: 'graduationYear',
    severity: delta > 3 ? 'high' : 'medium',
    summary: `Graduation year differs by ${delta} years across sources.`,
    contenders,
    resolution: {
      value: contenders[0]?.value ?? null,
      confidence: contenders[0]?.confidence ?? 0,
      rationale: ['Selected most recent and highest confidence graduation year'],
    },
  };
}

function detectSpecialtyConflict(sources: IdentitySourceRecord[]): IdentityConflict | null {
  const specialtyCounts = new Map<string, number>();
  sources.forEach((record) => {
    (record.attributes.specialties ?? []).forEach((specialty) => {
      const normalized = normalizeSpecialty(specialty);
      if (!normalized) return;
      specialtyCounts.set(normalized, (specialtyCounts.get(normalized) ?? 0) + 1);
    });
  });
  if (!specialtyCounts.size) {
    return null;
  }
  const entries = Array.from(specialtyCounts.entries()).sort((a, b) => b[1] - a[1]);
  if (entries.length === 1) {
    return null;
  }
  return {
    id: 'conflict:specialties',
    type: 'specialty_inconsistent',
    field: 'specialties',
    severity: entries[1][1] >= entries[0][1] ? 'high' : 'medium',
    summary: 'Multiple specialties recorded with similar weight.',
    contenders: entries.map(([specialty, count]) => ({
      source: 'state_board',
      value: specialty,
      confidence: clamp(count / sources.length, 0, 1),
    })),
    resolution: {
      value: entries[0][0],
      confidence: clamp(entries[0][1] / sources.length, 0, 1),
      rationale: ['Selected specialty with highest frequency across sources'],
    },
  };
}

function detectNameConflict(
  sources: IdentitySourceRecord[],
  matches: IdentityMatchEntry[],
): IdentityConflict | null {
  const names = dedupeStrings(
    sources
      .map((record) => record.attributes.name)
      .filter((value): value is string => Boolean(value))
      .map((value) => value.trim()),
  );
  if (names.length <= 1) {
    return null;
  }
  const severity = matches.some((entry) => entry.probability < 0.5) ? 'high' : 'medium';
  return {
    id: 'conflict:names',
    type: 'name_variation',
    field: 'name',
    severity,
    summary: `Detected ${names.length} name variations across sources.`,
    contenders: names.map((value) => ({
      source: 'nppes',
      value,
      confidence: 0.5,
    })),
    resolution: undefined,
  };
}

function deriveMatchFeatures(a: IdentitySourceRecord, b: IdentitySourceRecord) {
  const nameSim = computeNameSimilarity(a.attributes.name, b.attributes.name);
  const gradYearDelta = deriveYearDelta(a.attributes.graduationYear, b.attributes.graduationYear);
  const specialtyOverlap = computeSpecialtyOverlap(a.attributes.specialties ?? [], b.attributes.specialties ?? []);
  const birthDateMatch =
    a.attributes.birthDate && b.attributes.birthDate && a.attributes.birthDate === b.attributes.birthDate;
  return [
    { label: 'Name similarity', observed: nameSim >= 0.75, weight: 0.45, odds: nameSim >= 0.75 ? 8 : 0.5 },
    { label: 'Graduation year proximity', observed: gradYearDelta <= 2, weight: 0.2, odds: gradYearDelta <= 2 ? 4 : 0.7 },
    { label: 'Specialty overlap', observed: specialtyOverlap >= 0.5, weight: 0.2, odds: specialtyOverlap >= 0.5 ? 3.5 : 0.8 },
    { label: 'Birth date match', observed: birthDateMatch, weight: 0.15, odds: birthDateMatch ? 10 : 0.9 },
  ];
}

function applyBayes(features: ReturnType<typeof deriveMatchFeatures>): number {
  let odds = 0.7 / 0.3; // prior 70%
  features.forEach((feature) => {
    odds *= feature.observed ? feature.odds : 1 / Math.max(feature.odds, 0.1);
  });
  const probability = odds / (1 + odds);
  return Number(clamp(probability, 0, 1).toFixed(4));
}

function pickBestValue(field: keyof IdentitySourceRecord['attributes'], sources: IdentitySourceRecord[]) {
  const contenders = sources
    .map((record) => ({
      value: record.attributes[field],
      confidence: record.confidence,
    }))
    .filter((entry) => entry.value !== undefined && entry.value !== null);
  if (!contenders.length) {
    return null;
  }
  contenders.sort((a, b) => b.confidence - a.confidence);
  return contenders[0]?.value ?? null;
}

function pickNumericValue(field: keyof IdentitySourceRecord['attributes'], sources: IdentitySourceRecord[]) {
  const value = pickBestValue(field, sources);
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string' && /^\d{4}$/.test(value)) {
    return Number(value);
  }
  return null;
}

function buildSourceBreakdown(sources: IdentitySourceRecord[]) {
  return sources.reduce<Record<IdentitySourceType, number>>((acc, record) => {
    acc[record.source] = Number((acc[record.source] ?? 0 + record.confidence).toFixed(4));
    return acc;
  }, {} as Record<IdentitySourceType, number>);
}

function summarizeEvidence(field: string, value: unknown) {
  if (field === 'specialties' && Array.isArray(value)) {
    return value.slice(0, 3).join(', ');
  }
  if (value && typeof value === 'object') {
    return JSON.stringify(value).slice(0, 120);
  }
  return String(value ?? '');
}

function computeNameSimilarity(a?: string | null, b?: string | null) {
  if (!a || !b) return 0;
  const tokensA = normalizeName(a)?.split(' ') ?? [];
  const tokensB = normalizeName(b)?.split(' ') ?? [];
  if (!tokensA.length || !tokensB.length) return 0;
  const intersection = tokensA.filter((token) => tokensB.includes(token));
  return intersection.length / Math.max(tokensA.length, tokensB.length);
}

function normalizeName(value?: string | null) {
  if (!value) return null;
  return value
    .toUpperCase()
    .replace(/[^A-Z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function deriveYearDelta(a?: number | null, b?: number | null) {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  return Math.abs(a - b);
}

function computeSpecialtyOverlap(a: string[], b: string[]) {
  if (!a.length || !b.length) return 0;
  const normalizedA = a.map(normalizeSpecialty).filter(Boolean) as string[];
  const normalizedB = b.map(normalizeSpecialty).filter(Boolean) as string[];
  const intersection = normalizedA.filter((value) => normalizedB.includes(value));
  return intersection.length / Math.max(normalizedA.length, normalizedB.length);
}

function normalizeSpecialty(value?: string | null) {
  if (!value) return null;
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function hashValue(value: unknown) {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  return createHash('sha256').update(serialized).digest('hex');
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function serialize<T>(value: T): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value ?? {}));
}

function coerceString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim().length) {
    return value.trim();
  }
  return null;
}

function coerceNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    return Number(value);
  }
  return null;
}

function normalizeList(values: Array<string | undefined>) {
  return dedupeStrings(values.filter(Boolean) as string[]);
}

function extractStringArray(input: unknown): string[] {
  if (!input) return [];
  if (Array.isArray(input)) {
    return dedupeStrings(
      input
        .map((value) => (typeof value === 'string' ? value : null))
        .filter((value): value is string => Boolean(value)),
    );
  }
  if (typeof input === 'string') {
    return dedupeStrings(input.split(',').map((token) => token.trim()).filter(Boolean));
  }
  return [];
}

function collectAliasCandidates(validation: Prisma.NPIValidationGetPayload<{}>) {
  const crossRefs = validation.crossRefs as Record<string, unknown> | null;
  const aliases = extractStringArray(crossRefs?.['aliases']);
  if (validation.npi) {
    aliases.push(validation.npi);
  }
  return dedupeStrings(aliases);
}

function deriveLicenseConfidence(license: Prisma.StateLicenseVerificationGetPayload<{}>) {
  const base = license.status?.toLowerCase().includes('active') ? 0.85 : 0.6;
  const anchorBonus = (license.metadata as Record<string, unknown> | null)?.['anchorTxHash'] ? 0.1 : 0;
  return clamp(base + anchorBonus, 0, 1);
}

function resolveGlobalSource(authority?: string | null): IdentitySourceType | null {
  if (!authority) return null;
  const normalized = authority.toUpperCase();
  const key = Object.keys(GLOBAL_REGULATOR_MAP).find((candidate) => normalized.includes(candidate));
  return key ? GLOBAL_REGULATOR_MAP[key] : null;
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  values.forEach((value) => {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    result.push(normalized);
  });
  return result;
}

function normalizeComparable(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeComparable(entry));
  }
  if (value && typeof value === 'object') {
    return JSON.parse(JSON.stringify(value));
  }
  if (typeof value === 'string') {
    return value.trim();
  }
  return value ?? null;
}

function isEqual(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b);
}



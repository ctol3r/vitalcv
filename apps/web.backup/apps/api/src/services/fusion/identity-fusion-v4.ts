import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';
import { ingestIdentitySources, type IngestedIdentity } from './ingestion-v3';
import { scoreMultipleMatches, type MatchCandidate } from './matcher';
import { resolveIdentityConflicts, type ConflictResolution } from './conflict-resolver-v3';
import { buildIdentityLineage, type IdentityLineage } from './lineage-tracker';
import { computeReliabilityIndex, type ReliabilityMetrics } from './reliability-index';
import { anchorIdentityFusion, type AnchorRecord } from '../audit/anchor';

export interface IdentityFusionResult {
  clinicianId: string;
  fused: Record<string, unknown>;
  confidence: number;
  sources: IngestedIdentity['sources'];
  conflicts: ConflictResolution;
  lineage: IdentityLineage;
  reliability: ReliabilityMetrics;
  eventLogHash: string;
  anchor?: AnchorRecord;
}

/**
 * Main identity fusion v4 pipeline
 */
export async function runIdentityFusion(
  clinicianId: string,
  options: { prisma?: PrismaClient; skipAnchor?: boolean } = {},
): Promise<IdentityFusionResult> {
  const prisma = options.prisma ?? new PrismaClient();

  // Step 1: Ingest from all sources
  const ingested = await ingestIdentitySources(clinicianId, { prisma });

  // Step 2: Build match candidates and score
  const matchCandidates: MatchCandidate[] = ingested.sources.map((source) => ({
    sourceId: source.sourceId,
    sourceType: source.sourceType,
    fields: source.data,
    confidence: source.confidence,
  }));

  // Use first source as reference for matching
  if (matchCandidates.length > 1) {
    const reference = matchCandidates[0];
    const others = matchCandidates.slice(1);
    const matchScores = scoreMultipleMatches(others, reference);
    // Match scores can be used for validation, but we proceed with fusion
  }

  // Step 3: Resolve conflicts
  const conflicts = resolveIdentityConflicts(ingested.sources);

  // Step 4: Build lineage
  const lineage = buildIdentityLineage(clinicianId, ingested.sources);

  // Step 5: Compute reliability
  const reliability = computeReliabilityIndex(ingested.sources, lineage);

  // Step 6: Create event log entry
  const eventLogHash = await createIdentityEventLog(clinicianId, {
    fused: ingested.fused,
    confidence: ingested.confidence,
    sources: ingested.sources,
    conflicts,
    reliability,
  }, prisma);

  // Step 7: Persist snapshot
  await persistIdentityFusionSnapshot(clinicianId, {
    fused: ingested.fused,
    confidence: ingested.confidence,
  }, prisma);

  // Step 8: Anchor
  let anchor: AnchorRecord | undefined;
  if (!options.skipAnchor) {
    anchor = anchorIdentityFusion({
      clinicianId,
      rootHash: eventLogHash,
      sourceCount: ingested.sources.length,
      conflictCount: conflicts.conflicts.length,
      resolvedCount: conflicts.resolved.length,
      reliabilityScore: reliability.overallScore,
    });
  }

  return {
    clinicianId,
    fused: ingested.fused,
    confidence: ingested.confidence,
    sources: ingested.sources,
    conflicts,
    lineage,
    reliability,
    eventLogHash,
    anchor,
  };
}

async function createIdentityEventLog(
  clinicianId: string,
  data: {
    fused: Record<string, unknown>;
    confidence: number;
    sources: IngestedIdentity['sources'];
    conflicts: ConflictResolution;
    reliability: ReliabilityMetrics;
  },
  prisma: PrismaClient,
): Promise<string> {
  const payload = {
    fused: data.fused,
    confidence: data.confidence,
    sourceCount: data.sources.length,
    conflictCount: data.conflicts.conflicts.length,
    reliability: data.reliability.overallScore,
    timestamp: new Date().toISOString(),
  };

  const hash = createHash('sha256').update(JSON.stringify(payload)).digest('hex');

  await prisma.identityEventLog.create({
    data: {
      clinicianId,
      eventType: 'identityFusionSnapshot',
      changeHash: hash,
      metadata: payload,
      timestamp: new Date(),
    },
  });

  return hash;
}

async function persistIdentityFusionSnapshot(
  clinicianId: string,
  data: {
    fused: Record<string, unknown>;
    confidence: number;
  },
  prisma: PrismaClient,
): Promise<void> {
  await prisma.identityFusionSnapshot.upsert({
    where: { clinicianId },
    create: {
      clinicianId,
      fused: data.fused as any,
      confidence: data.confidence,
      timestamp: new Date(),
    },
    update: {
      fused: data.fused as any,
      confidence: data.confidence,
      timestamp: new Date(),
    },
  });
}


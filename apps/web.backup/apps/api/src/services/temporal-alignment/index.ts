/**
 * Batch 430 — Credential Temporal Alignment Engine v7
 * Ensure all credential timestamps, validity windows, renewals, and expirations align across systems
 */

import { PrismaClient } from '@prisma/client';
import { anchorEvent } from '../audit/anchor';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

export interface TimestampSource {
  source: string; // 'issuance' | 'audit' | 'anchor' | 'document'
  timestamp: string;
  system: string;
  region?: string;
}

export interface TemporalAlignmentResult {
  credentialId: string;
  alignment: {
    issuanceTimestamps: TimestampSource[];
    auditTimestamps: TimestampSource[];
    anchorTimestamps: TimestampSource[];
    documentTimestamps: TimestampSource[];
  };
  consistency: {
    score: number; // 0-100
    gaps: Array<{
      type: string;
      magnitude: number; // seconds
      severity: 'low' | 'medium' | 'high';
    }>;
    conflicts: Array<{
      field: string;
      values: string[];
      systems: string[];
    }>;
  };
  clockDrift: {
    detected: boolean;
    corrections: Array<{
      system: string;
      offsetSeconds: number;
      corrected: boolean;
    }>;
  };
  renewalTimeline: {
    sources: string[];
    aligned: boolean;
    nextRenewal: string | null;
    conflicts: string[];
  };
  validityWindows: {
    windows: Array<{
      start: string;
      end: string;
      source: string;
    }>;
    conflicts: Array<{
      window1: number;
      window2: number;
      conflict: string;
    }>;
  };
  expirationRisk: {
    predictedExpiration: string | null;
    riskLevel: 'low' | 'medium' | 'high';
    factors: string[];
  };
  crossChainTime: {
    networks: Array<{
      network: string;
      timestamp: string;
      blockTime: string;
    }>;
    consensus: boolean;
    variance: number; // seconds
  };
  updatedAt: string;
}

/**
 * Compare timestamps from different sources
 */
function compareTimestamps(timestamps: TimestampSource[]): TemporalAlignmentResult['consistency'] {
  const gaps: TemporalAlignmentResult['consistency']['gaps'] = [];
  const conflicts: TemporalAlignmentResult['consistency']['conflicts'] = [];
  let score = 100;

  // Sort by timestamp
  const sorted = [...timestamps].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Check for gaps
  for (let i = 1; i < sorted.length; i++) {
    const gap = (new Date(sorted[i].timestamp).getTime() - new Date(sorted[i - 1].timestamp).getTime()) / 1000;
    if (gap > 3600) {
      // More than 1 hour gap
      const severity = gap > 86400 ? 'high' : gap > 3600 ? 'medium' : 'low';
      gaps.push({
        type: 'temporal_gap',
        magnitude: gap,
        severity,
      });
      score -= severity === 'high' ? 20 : severity === 'medium' ? 10 : 5;
    }
  }

  // Check for conflicts (same source, different values)
  const bySource = timestamps.reduce((acc, ts) => {
    if (!acc[ts.source]) acc[ts.source] = [];
    acc[ts.source].push(ts);
    return acc;
  }, {} as Record<string, TimestampSource[]>);

  for (const [source, values] of Object.entries(bySource)) {
    if (values.length > 1) {
      const uniqueValues = [...new Set(values.map((v) => v.timestamp))];
      if (uniqueValues.length > 1) {
        conflicts.push({
          field: source,
          values: uniqueValues,
          systems: values.map((v) => v.system),
        });
        score -= 15;
      }
    }
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    gaps,
    conflicts,
  };
}

/**
 * Fix clock-drift inconsistencies
 */
function correctClockDrift(timestamps: TimestampSource[]): TemporalAlignmentResult['clockDrift'] {
  const corrections: TemporalAlignmentResult['clockDrift']['corrections'] = [];

  // Group by system
  const bySystem = timestamps.reduce((acc, ts) => {
    if (!acc[ts.system]) acc[ts.system] = [];
    acc[ts.system].push(ts);
    return acc;
  }, {} as Record<string, TimestampSource[]>);

  // Detect drift by comparing to reference (most common timestamp)
  const allTimes = timestamps.map((ts) => new Date(ts.timestamp).getTime());
  const medianTime = allTimes.sort((a, b) => a - b)[Math.floor(allTimes.length / 2)];

  let detected = false;
  for (const [system, systemTimestamps] of Object.entries(bySystem)) {
    const systemTimes = systemTimestamps.map((ts) => new Date(ts.timestamp).getTime());
    const avgSystemTime = systemTimes.reduce((a, b) => a + b, 0) / systemTimes.length;
    const offsetSeconds = (avgSystemTime - medianTime) / 1000;

    if (Math.abs(offsetSeconds) > 60) {
      // More than 1 minute offset
      detected = true;
      corrections.push({
        system,
        offsetSeconds,
        corrected: false, // Would be set to true after correction
      });
    }
  }

  return {
    detected,
    corrections,
  };
}

/**
 * Align renewals across multiple regulatory sources
 */
function harmonizeRenewals(sources: string[]): TemporalAlignmentResult['renewalTimeline'] {
  // In real implementation, would fetch renewal dates from each source
  const aligned = sources.length <= 1 || sources.every((s) => s === sources[0]);
  const conflicts: string[] = [];

  if (!aligned) {
    conflicts.push('Renewal dates do not align across sources');
  }

  return {
    sources,
    aligned,
    nextRenewal: sources.length > 0 ? sources[0] : null,
    conflicts,
  };
}

/**
 * Flag mismatched validity windows
 */
function detectValidityWindowConflicts(): TemporalAlignmentResult['validityWindows'] {
  // In real implementation, would check validity windows from different sources
  return {
    windows: [],
    conflicts: [],
  };
}

/**
 * Forecast early credential expiration risks
 */
function predictExpirationRisk(credentialId: string): TemporalAlignmentResult['expirationRisk'] {
  // In real implementation, would analyze renewal patterns and predict expiration
  return {
    predictedExpiration: null,
    riskLevel: 'low',
    factors: [],
  };
}

/**
 * Verify timestamps consistent across networks
 */
function verifyCrossChainTimeConsensus(): TemporalAlignmentResult['crossChainTime'] {
  // In real implementation, would check timestamps across multiple blockchain networks
  return {
    networks: [],
    consensus: true,
    variance: 0,
  };
}

/**
 * Generate temporal alignment profile
 */
export async function generateTemporalAlignment(credentialId: string): Promise<TemporalAlignmentResult> {
  // Collect timestamps from various sources (simplified)
  const issuanceTimestamps: TimestampSource[] = [
    { source: 'issuance', timestamp: new Date().toISOString(), system: 'issuer-api' },
  ];
  const auditTimestamps: TimestampSource[] = [];
  const anchorTimestamps: TimestampSource[] = [];
  const documentTimestamps: TimestampSource[] = [];

  const allTimestamps = [...issuanceTimestamps, ...auditTimestamps, ...anchorTimestamps, ...documentTimestamps];

  const consistency = compareTimestamps(allTimestamps);
  const clockDrift = correctClockDrift(allTimestamps);
  const renewalTimeline = harmonizeRenewals([]);
  const validityWindows = detectValidityWindowConflicts();
  const expirationRisk = predictExpirationRisk(credentialId);
  const crossChainTime = verifyCrossChainTimeConsensus();

  const result: TemporalAlignmentResult = {
    credentialId,
    alignment: {
      issuanceTimestamps,
      auditTimestamps,
      anchorTimestamps,
      documentTimestamps,
    },
    consistency,
    clockDrift,
    renewalTimeline,
    validityWindows,
    expirationRisk,
    crossChainTime,
    updatedAt: new Date().toISOString(),
  };

  // Save to database
  await prisma.temporalAlignment.upsert({
    where: { credentialId },
    create: {
      credentialId,
      alignment: result as any,
    },
    update: {
      alignment: result as any,
    },
  });

  return result;
}

/**
 * Export temporal alignment dossier
 */
export async function exportTemporalAlignmentDossier(credentialId: string): Promise<{
  alignment: TemporalAlignmentResult;
  exportHash: string;
  chainOfTime: {
    events: Array<{
      timestamp: string;
      source: string;
      hash: string;
    }>;
  };
  generatedAt: string;
}> {
  const record = await prisma.temporalAlignment.findFirst({
    where: { credentialId },
    orderBy: { updatedAt: 'desc' },
  });

  if (!record) {
    throw new Error(`No temporal alignment found for credential ${credentialId}`);
  }

  const alignment = record.alignment as any as TemporalAlignmentResult;

  // Build chain-of-time proof bundle
  const chainOfTime = {
    events: [
      ...alignment.alignment.issuanceTimestamps.map((ts) => ({
        timestamp: ts.timestamp,
        source: ts.source,
        hash: createHash('sha256').update(`${ts.timestamp}:${ts.source}`).digest('hex'),
      })),
      ...alignment.alignment.auditTimestamps.map((ts) => ({
        timestamp: ts.timestamp,
        source: ts.source,
        hash: createHash('sha256').update(`${ts.timestamp}:${ts.source}`).digest('hex'),
      })),
    ],
  };

  // Anchor snapshot
  anchorEvent('temporalAlignmentAnchored', {
    credentialId,
    alignmentHash: createHash('sha256').update(JSON.stringify(alignment)).digest('hex'),
    consistencyScore: alignment.consistency.score,
    conflictCount: alignment.consistency.conflicts.length,
  });

  return {
    alignment,
    exportHash: `temporal_${credentialId}_${Date.now()}`,
    chainOfTime,
    generatedAt: new Date().toISOString(),
  };
}









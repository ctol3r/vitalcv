import { prisma } from '@/lib/prisma';
import { anchorEvent } from '../audit/anchor';
import { createHash } from 'crypto';

/**
 * Batch 222 — Skills & Procedure Volume Engine v3
 * Tracks clinician procedure volume, recency, competency proof, and risk-adjusted performance
 */

export interface ProcedureIngestionSource {
  source: 'logs' | 'privileges' | 'case_reports';
  data: Record<string, unknown>;
}

/**
 * Ingest procedures from logs, privileges, case reports
 */
export async function ingestProcedures(
  clinicianId: string,
  sources: ProcedureIngestionSource[],
): Promise<{
  ingested: number;
  procedures: Array<{ procedure: string; count: number }>;
}> {
  const procedures: Map<string, number> = new Map();

  sources.forEach((source) => {
    if (source.source === 'logs') {
      // Extract procedure codes from logs
      const logData = source.data as any;
      if (logData.procedures) {
        (logData.procedures as string[]).forEach((proc) => {
          procedures.set(proc, (procedures.get(proc) || 0) + 1);
        });
      }
    } else if (source.source === 'privileges') {
      // Extract from privilege assignments
      const privData = source.data as any;
      if (privData.privilegeCodes) {
        (privData.privilegeCodes as string[]).forEach((code) => {
          procedures.set(code, (procedures.get(code) || 0) + 1);
        });
      }
    } else if (source.source === 'case_reports') {
      // Extract from case reports
      const caseData = source.data as any;
      if (caseData.procedureCode) {
        procedures.set(caseData.procedureCode, (procedures.get(caseData.procedureCode) || 0) + 1);
      }
    }
  });

  // Store in database
  const periodStart = new Date();
  periodStart.setMonth(periodStart.getMonth() - 1); // Last month
  const periodEnd = new Date();

  for (const [procedure, count] of procedures.entries()) {
    await prisma.procedureVolume.upsert({
      where: {
        clinicianId_procedure_periodStart_periodEnd: {
          clinicianId,
          procedure,
          periodStart,
          periodEnd,
        },
      },
      create: {
        clinicianId,
        procedure,
        count,
        periodStart,
        periodEnd,
        sources: sources as any,
        createdAt: new Date(),
      },
      update: {
        count: {
          increment: count,
        },
      },
    });
  }

  return {
    ingested: procedures.size,
    procedures: Array.from(procedures.entries()).map(([procedure, count]) => ({ procedure, count })),
  };
}

/**
 * Calculate recency-of-practice index (weighted score based on last performed)
 */
export async function calculateRecencyIndex(
  clinicianId: string,
  procedure: string,
): Promise<{
  recencyScore: number;
  lastPerformed?: Date;
  daysSinceLast: number;
}> {
  const volumes = await prisma.procedureVolume.findMany({
    where: {
      clinicianId,
      procedure,
    },
    orderBy: {
      periodEnd: 'desc',
    },
    take: 1,
  });

  if (volumes.length === 0) {
    return {
      recencyScore: 0,
      daysSinceLast: Infinity,
    };
  }

  const lastVolume = volumes[0];
  const lastPerformed = lastVolume.periodEnd;
  const daysSinceLast = Math.floor((Date.now() - lastPerformed.getTime()) / (1000 * 60 * 60 * 24));

  // Calculate recency score (decay over time)
  // Score = 1.0 if performed today, decays to 0 over 365 days
  const recencyScore = Math.max(0, 1 - daysSinceLast / 365);

  return {
    recencyScore,
    lastPerformed,
    daysSinceLast,
  };
}

/**
 * Map procedures to specialties
 */
export function mapProcedureToSpecialty(procedure: string): {
  specialty: string;
  confidence: number;
} {
  // Simplified mapping (would use actual taxonomy in production)
  const mappings: Record<string, { specialty: string; confidence: number }> = {
    'CPT-99213': { specialty: 'Internal Medicine', confidence: 0.9 },
    'CPT-99214': { specialty: 'Internal Medicine', confidence: 0.9 },
    'CPT-27447': { specialty: 'Orthopedic Surgery', confidence: 0.95 },
    'CPT-45378': { specialty: 'Gastroenterology', confidence: 0.9 },
    // Add more mappings as needed
  };

  return mappings[procedure] || { specialty: 'General', confidence: 0.5 };
}

/**
 * Check if clinician meets minimum privilege volume
 */
export async function validateMinimumVolume(
  clinicianId: string,
  procedure: string,
  minimumCount: number,
  periodMonths: number = 12,
): Promise<{
  meetsMinimum: boolean;
  actualCount: number;
  requiredCount: number;
}> {
  const periodStart = new Date();
  periodStart.setMonth(periodStart.getMonth() - periodMonths);

  const volumes = await prisma.procedureVolume.findMany({
    where: {
      clinicianId,
      procedure,
      periodStart: {
        gte: periodStart,
      },
    },
  });

  const actualCount = volumes.reduce((sum, v) => sum + v.count, 0);

  return {
    meetsMinimum: actualCount >= minimumCount,
    actualCount,
    requiredCount: minimumCount,
  };
}

/**
 * Forecast future volume trends
 */
export async function predictVolumeTrends(
  clinicianId: string,
  procedure: string,
  horizonMonths: number = 6,
): Promise<{
  predictedCount: number;
  confidence: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}> {
  const volumes = await prisma.procedureVolume.findMany({
    where: {
      clinicianId,
      procedure,
    },
    orderBy: {
      periodStart: 'desc',
    },
    take: 12, // Last 12 periods
  });

  if (volumes.length < 2) {
    return {
      predictedCount: 0,
      confidence: 0,
      trend: 'stable',
    };
  }

  // Simple linear regression
  const counts = volumes.map((v) => v.count);
  const avgCount = counts.reduce((sum, c) => sum + c, 0) / counts.length;

  // Calculate trend
  const recentAvg = counts.slice(0, Math.floor(counts.length / 2)).reduce((sum, c) => sum + c, 0) / Math.floor(counts.length / 2);
  const olderAvg = counts.slice(Math.floor(counts.length / 2)).reduce((sum, c) => sum + c, 0) / Math.ceil(counts.length / 2);

  let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
  if (recentAvg > olderAvg * 1.1) {
    trend = 'increasing';
  } else if (recentAvg < olderAvg * 0.9) {
    trend = 'decreasing';
  }

  // Predict future count
  const predictedCount = Math.max(0, Math.round(avgCount * horizonMonths));

  return {
    predictedCount,
    confidence: volumes.length >= 6 ? 0.8 : 0.5,
    trend,
  };
}

/**
 * Adjust volume score using safety graph signals
 */
export async function calculateRiskAdjustedVolumeScore(
  clinicianId: string,
  procedure: string,
): Promise<{
  baseScore: number;
  riskAdjustment: number;
  finalScore: number;
}> {
  const recency = await calculateRecencyIndex(clinicianId, procedure);
  const baseScore = recency.recencyScore;

  // Get safety signals
  const safetySignals = await prisma.privilegeSafetySignal.findMany({
    where: {
      clinicianId,
      privilegeCodes: {
        has: procedure,
      },
    },
    take: 10,
  });

  // Calculate risk adjustment (negative for safety issues)
  let riskAdjustment = 0;
  safetySignals.forEach((signal) => {
    const severityWeight: Record<string, number> = {
      LOW: -0.05,
      MED: -0.15,
      HIGH: -0.3,
      CRITICAL: -0.5,
    };
    riskAdjustment += severityWeight[signal.severity] || 0;
  });

  const finalScore = Math.max(0, Math.min(1, baseScore + riskAdjustment));

  return {
    baseScore,
    riskAdjustment,
    finalScore,
  };
}

/**
 * Identify missing or low-volume areas
 */
export async function analyzeProcedureGaps(
  clinicianId: string,
  requiredProcedures: string[],
): Promise<{
  gaps: Array<{ procedure: string; gap: 'missing' | 'low_volume'; details: Record<string, unknown> }>;
  recommendations: string[];
}> {
  const gaps: Array<{ procedure: string; gap: 'missing' | 'low_volume'; details: Record<string, unknown> }> = [];
  const recommendations: string[] = [];

  for (const procedure of requiredProcedures) {
    const volumes = await prisma.procedureVolume.findMany({
      where: {
        clinicianId,
        procedure,
      },
      orderBy: {
        periodEnd: 'desc',
      },
      take: 1,
    });

    if (volumes.length === 0) {
      gaps.push({
        procedure,
        gap: 'missing',
        details: {
          lastPerformed: null,
          count: 0,
        },
      });
      recommendations.push(`Consider performing ${procedure} to meet requirements`);
    } else {
      const lastVolume = volumes[0];
      const recency = await calculateRecencyIndex(clinicianId, procedure);

      if (recency.daysSinceLast > 180) {
        gaps.push({
          procedure,
          gap: 'low_volume',
          details: {
            lastPerformed: lastVolume.periodEnd,
            daysSinceLast: recency.daysSinceLast,
            count: lastVolume.count,
          },
        });
        recommendations.push(`Refresh practice in ${procedure} (last performed ${recency.daysSinceLast} days ago)`);
      }
    }
  }

  return { gaps, recommendations };
}

/**
 * Anchor volume snapshot
 */
export async function anchorVolumeSnapshot(clinicianId: string): Promise<void> {
  const volumes = await prisma.procedureVolume.findMany({
    where: {
      clinicianId,
    },
    take: 100,
  });

  const snapshot = {
    clinicianId,
    procedureCount: volumes.length,
    totalProcedures: volumes.reduce((sum, v) => sum + v.count, 0),
    procedures: volumes.map((v) => ({
      procedure: v.procedure,
      count: v.count,
      periodStart: v.periodStart.toISOString(),
      periodEnd: v.periodEnd.toISOString(),
    })),
  };

  const snapshotHash = createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');

  anchorEvent('procedureVolumeAnchored', {
    clinicianId,
    snapshotHash,
    procedureCount: volumes.length,
    timestamp: new Date().toISOString(),
  });
}









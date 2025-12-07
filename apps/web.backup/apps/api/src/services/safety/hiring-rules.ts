import { PrismaClient } from '@prisma/client';
import { getOrCreateSafetyGraph } from './graph';

const prisma = new PrismaClient();

export interface HiringRuleResult {
  allowed: boolean;
  reason: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  restrictions?: string[];
}

const RISK_THRESHOLDS = {
  low: 0.3,
  medium: 0.6,
  high: 0.8,
  critical: 0.95,
};

/**
 * Check if clinician should be restricted from auto-matches based on safety
 */
export async function evaluateHiringSafety(clinicianId: string): Promise<HiringRuleResult> {
  const graph = await getOrCreateSafetyGraph(clinicianId);
  const riskScore = graph.riskScore ?? 0;

  // Check for critical sanctions
  const criticalSanctions = await prisma.riskEvent.findMany({
    where: {
      clinicianId,
      type: 'sanctions',
      severity: { gte: 0.9 },
    },
    take: 1,
  });

  if (criticalSanctions.length > 0) {
    return {
      allowed: false,
      reason: 'Critical sanctions detected',
      riskLevel: 'critical',
      restrictions: ['auto-match', 'privileging', 'emergency-privileges'],
    };
  }

  // Check for recent NPDB flags
  const recentNpdb = await prisma.riskEvent.findMany({
    where: {
      clinicianId,
      type: 'npdb',
      createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }, // Last 90 days
    },
    take: 1,
  });

  if (recentNpdb.length > 0) {
    return {
      allowed: false,
      reason: 'Recent NPDB flags detected',
      riskLevel: 'high',
      restrictions: ['auto-match'],
    };
  }

  // Risk score-based restrictions
  if (riskScore >= RISK_THRESHOLDS.critical) {
    return {
      allowed: false,
      reason: 'Critical safety risk score',
      riskLevel: 'critical',
      restrictions: ['auto-match', 'privileging'],
    };
  }

  if (riskScore >= RISK_THRESHOLDS.high) {
    return {
      allowed: true,
      reason: 'High risk - manual review required',
      riskLevel: 'high',
      restrictions: ['auto-match'],
    };
  }

  if (riskScore >= RISK_THRESHOLDS.medium) {
    return {
      allowed: true,
      reason: 'Medium risk - standard review',
      riskLevel: 'medium',
    };
  }

  return {
    allowed: true,
    reason: 'Low risk - eligible for auto-match',
    riskLevel: 'low',
  };
}

/**
 * Check if clinician can be auto-matched to a job
 */
export async function canAutoMatch(clinicianId: string, jobId: string): Promise<boolean> {
  const result = await evaluateHiringSafety(clinicianId);
  return result.allowed && !result.restrictions?.includes('auto-match');
}


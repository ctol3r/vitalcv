import { PrismaClient } from '@prisma/client';
import { ChainClient } from '../chain/client';

const prisma = new PrismaClient();

const chainClient = new ChainClient();

export interface TrustMetrics {
  correctVerification: number;
  misuseFlags: number;
  responseTime: number; // milliseconds
  complianceScore: number;
}

/**
 * Calculate employer compliance signals
 */
export async function calculateComplianceSignals(orgId: string): Promise<TrustMetrics> {
  // Fetch verification events (simplified - in production, query actual verification logs)
  const verifications = await prisma.auditEvent.findMany({
    where: {
      eventType: { contains: 'verification' },
      // In production, filter by orgId from event details
    },
    take: 100,
  });

  // Simplified metrics calculation
  const correctVerification = verifications.length * 0.9; // Assume 90% correct
  const misuseFlags = verifications.length * 0.05; // Assume 5% misuse
  const responseTime = 500; // Average response time in ms
  const complianceScore = Math.max(0, Math.min(1, correctVerification / (verifications.length || 1)));

  return {
    correctVerification,
    misuseFlags,
    responseTime,
    complianceScore,
  };
}

/**
 * Calculate trust score v3 (weighted by safety impact)
 */
export async function calculateTrustScore(orgId: string): Promise<{
  score: number;
  metrics: TrustMetrics;
  factors: Array<{
    factor: string;
    weight: number;
    value: number;
    contribution: number;
  }>;
}> {
  const metrics = await calculateComplianceSignals(orgId);

  // Weighted scoring
  const factors = [
    {
      factor: 'correctVerification',
      weight: 0.4,
      value: metrics.correctVerification,
      contribution: metrics.correctVerification * 0.4,
    },
    {
      factor: 'misuseFlags',
      weight: -0.3, // Negative weight for misuse
      value: metrics.misuseFlags,
      contribution: -metrics.misuseFlags * 0.3,
    },
    {
      factor: 'responseTime',
      weight: 0.2,
      value: metrics.responseTime < 1000 ? 1 : 0.5, // Fast response = good
      contribution: (metrics.responseTime < 1000 ? 1 : 0.5) * 0.2,
    },
    {
      factor: 'complianceScore',
      weight: 0.1,
      value: metrics.complianceScore,
      contribution: metrics.complianceScore * 0.1,
    },
  ];

  const score = Math.max(0, Math.min(1, factors.reduce((sum, f) => sum + f.contribution, 0)));

  // Save trust score
  await prisma.employerTrust.upsert({
    where: { orgId },
    create: {
      orgId,
      score,
      metrics: metrics as any,
    },
    update: {
      score,
      metrics: metrics as any,
    },
  });

  return { score, metrics, factors };
}

/**
 * Detect misuse patterns
 */
export async function detectMisuse(orgId: string): Promise<{
  detected: boolean;
  patterns: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
  }>;
}> {
  const trust = await prisma.employerTrust.findUnique({
    where: { orgId },
  });

  if (!trust) {
    return { detected: false, patterns: [] };
  }

  const metrics = trust.metrics as TrustMetrics;
  const patterns: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
  }> = [];

  // Check for high misuse flags
  if (metrics.misuseFlags > 10) {
    patterns.push({
      type: 'high_misuse',
      severity: 'high',
      description: `${metrics.misuseFlags} misuse flags detected`,
    });
  }

  // Check for slow response times
  if (metrics.responseTime > 5000) {
    patterns.push({
      type: 'slow_response',
      severity: 'medium',
      description: `Average response time: ${metrics.responseTime}ms`,
    });
  }

  // Check for low compliance score
  if (metrics.complianceScore < 0.5) {
    patterns.push({
      type: 'low_compliance',
      severity: 'high',
      description: `Compliance score: ${(metrics.complianceScore * 100).toFixed(1)}%`,
    });
  }

  return {
    detected: patterns.length > 0,
    patterns,
  };
}

/**
 * Get trust history
 */
export async function getTrustHistory(orgId: string): Promise<{
  history: Array<{
    timestamp: string;
    score: number;
    metrics: TrustMetrics;
  }>;
}> {
  // In production, this would query a history table
  // For now, return current state
  const trust = await prisma.employerTrust.findUnique({
    where: { orgId },
  });

  if (!trust) {
    return { history: [] };
  }

  return {
    history: [
      {
        timestamp: trust.updatedAt.toISOString(),
        score: trust.score,
        metrics: trust.metrics as TrustMetrics,
      },
    ],
  };
}

/**
 * Enforce trust restrictions
 */
export async function enforceTrustRestrictions(orgId: string): Promise<{
  restricted: boolean;
  restrictions: string[];
}> {
  const trust = await prisma.employerTrust.findUnique({
    where: { orgId },
  });

  if (!trust) {
    return { restricted: false, restrictions: [] };
  }

  const restrictions: string[] = [];

  if (trust.score < 0.3) {
    restrictions.push('Limited API access');
    restrictions.push('Manual review required');
  } else if (trust.score < 0.5) {
    restrictions.push('Rate limiting applied');
  }

  return {
    restricted: restrictions.length > 0,
    restrictions,
  };
}

/**
 * Anchor employer trust snapshot
 */
export async function anchorTrustSnapshot(orgId: string): Promise<string | null> {
  try {
    const trust = await prisma.employerTrust.findUnique({
      where: { orgId },
    });

    if (!trust) {
      return null;
    }

    const receipt = await chainClient.submitAuditEvent({
      eventType: 'employerTrustAnchored',
      payload: {
        orgId,
        score: trust.score,
        metrics: trust.metrics,
      },
    });

    return receipt.txHash;
  } catch (error) {
    console.error('[EmployerTrust] Failed to anchor trust snapshot', error);
    return null;
  }
}


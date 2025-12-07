import { PrismaClient } from '@prisma/client';
import { ChainClient } from '../chain/client';

const prisma = new PrismaClient();

const chainClient = new ChainClient();

/**
 * Calculate market liquidity v4 (supply-demand imbalance)
 */
export async function calculateMarketLiquidity(
  role: string,
  region: string,
): Promise<{
  liquidity: number;
  supply: number;
  demand: number;
  imbalance: number;
}> {
  // Fetch market signals
  const signal = await prisma.marketSignal.findFirst({
    where: { region, specialty: role },
  });

  if (signal) {
    const imbalance = signal.demand - signal.supply;
    const liquidity = signal.supply > 0 ? signal.demand / signal.supply : 0;

    return {
      liquidity,
      supply: signal.supply,
      demand: signal.demand,
      imbalance,
    };
  }

  // Default values if no signal found
  return {
    liquidity: 0.5,
    supply: 100,
    demand: 100,
    imbalance: 0,
  };
}

/**
 * Predict candidate responsiveness
 */
export async function predictResponsiveness(
  clinicianId: string,
): Promise<{
  responseTime: number; // hours
  engagement: number; // 0-1
  factors: Array<{
    factor: string;
    impact: number;
  }>;
}> {
  // Fetch liquidity signals for clinician
  const signals = await prisma.liquiditySignal.findMany({
    where: { clinicianId },
    orderBy: { updatedAt: 'desc' },
    take: 10,
  });

  // Simplified prediction
  const avgResponseTime = signals.length > 0
    ? signals.reduce((sum, s) => sum + (s.value || 24), 0) / signals.length
    : 24;

  const engagement = Math.max(0, Math.min(1, 1 - (avgResponseTime / 72))); // Inverse relationship

  return {
    responseTime: avgResponseTime,
    engagement,
    factors: [
      { factor: 'historical_response', impact: 0.6 },
      { factor: 'market_demand', impact: 0.4 },
    ],
  };
}

/**
 * Calculate offer competitiveness index
 */
export async function calculateOfferCompetitiveness(
  jobId: string,
): Promise<{
  index: number; // 0-1
  factors: Array<{
    factor: string;
    score: number;
    weight: number;
  }>;
}> {
  // Simplified calculation
  const factors = [
    { factor: 'salary', score: 0.8, weight: 0.4 },
    { factor: 'benefits', score: 0.7, weight: 0.2 },
    { factor: 'location', score: 0.6, weight: 0.2 },
    { factor: 'schedule', score: 0.9, weight: 0.2 },
  ];

  const index = factors.reduce((sum, f) => sum + f.score * f.weight, 0);

  return { index, factors };
}

/**
 * Dynamic role-boosting when shortages spike
 */
export async function boostRole(
  role: string,
  region: string,
  boostAmount: number = 1.5,
): Promise<{
  boosted: boolean;
  newRank: number;
}> {
  // In production, update job ranking/visibility
  return {
    boosted: true,
    newRank: 1, // Simplified
  };
}

/**
 * Automated candidate nudging
 */
export async function nudgeCandidate(
  clinicianId: string,
  jobId: string,
): Promise<{
  nudged: boolean;
  nextNudgeAt?: string;
}> {
  // In production, send notification/email
  const nextNudgeAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  return {
    nudged: true,
    nextNudgeAt,
  };
}

/**
 * Score marketplace health per region
 */
export async function scoreMarketplaceHealth(
  region: string,
): Promise<{
  health: number; // 0-1
  metrics: {
    liquidity: number;
    responseRate: number;
    conversionRate: number;
  };
}> {
  const signals = await prisma.marketSignal.findMany({
    where: { region },
  });

  const avgLiquidity = signals.length > 0
    ? signals.reduce((sum, s) => sum + (s.demand / (s.supply || 1)), 0) / signals.length
    : 0.5;

  // Simplified health calculation
  const health = Math.max(0, Math.min(1, avgLiquidity));

  return {
    health,
    metrics: {
      liquidity: avgLiquidity,
      responseRate: 0.7, // Simplified
      conversionRate: 0.3, // Simplified
    },
  };
}

/**
 * Adjust ranking based on liquidity
 */
export async function adjustRankingByLiquidity(
  clinicianId: string,
  jobId: string,
): Promise<{
  adjusted: boolean;
  newRank: number;
  boost: number;
}> {
  // Fetch liquidity signals
  const signals = await prisma.liquiditySignal.findMany({
    where: { clinicianId },
    take: 5,
  });

  const avgLiquidity = signals.length > 0
    ? signals.reduce((sum, s) => sum + s.value, 0) / signals.length
    : 0.5;

  // Higher liquidity = higher rank boost
  const boost = avgLiquidity > 0.7 ? 1.5 : avgLiquidity > 0.5 ? 1.2 : 1.0;

  return {
    adjusted: true,
    newRank: Math.floor(100 / boost), // Simplified
    boost,
  };
}

/**
 * Anchor liquidity snapshot
 */
export async function anchorLiquiditySnapshot(region: string): Promise<string | null> {
  try {
    const signals = await prisma.marketSignal.findMany({
      where: { region },
    });

    const receipt = await chainClient.submitAuditEvent({
      eventType: 'liquiditySnapshotAnchored',
      payload: {
        region,
        signals: signals.map((s) => ({
          specialty: s.specialty,
          demand: s.demand,
          supply: s.supply,
        })),
      },
    });

    return receipt.txHash;
  } catch (error) {
    console.error('[MarketplaceLiquidity] Failed to anchor liquidity snapshot', error);
    return null;
  }
}


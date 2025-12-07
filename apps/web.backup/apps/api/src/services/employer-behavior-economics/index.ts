import { PrismaClient } from '@prisma/client';
import { anchorEvent } from '../audit/anchor';

const prisma = new PrismaClient();

export interface EmployerBehaviorSignals {
  offerElasticity: number; // How compensation affects decisions
  hiringThresholds: {
    experience: number;
    boardCert: boolean;
    cme: number;
  };
  responseTime: {
    average: number; // hours
    median: number;
    p95: number;
  };
  offerAcceptanceRate: number;
  frictionCost: number; // Cost of slow verification
  demandElasticity: number; // Job posting frequency vs market
  riskIndex: number; // Risk to candidate trust (0-100)
  lastUpdated: string;
}

/**
 * Get employer behavior economics
 */
export async function getEmployerBehaviorEconomics(orgId: string): Promise<EmployerBehaviorSignals | null> {
  const record = await prisma.employerBehaviorEconomics.findUnique({
    where: { orgId },
  });

  if (!record) {
    return null;
  }

  return record.signals as EmployerBehaviorSignals;
}

/**
 * Update employer behavior economics
 */
export async function updateEmployerBehaviorEconomics(
  orgId: string,
  signals: EmployerBehaviorSignals,
): Promise<void> {
  await prisma.employerBehaviorEconomics.upsert({
    where: { orgId },
    create: {
      orgId,
      signals: signals as any,
      updatedAt: new Date(),
    },
    update: {
      signals: signals as any,
      updatedAt: new Date(),
    },
  });
}

/**
 * Analyze offer elasticity (how compensation affects decisions)
 */
export async function analyzeOfferElasticity(orgId: string, offers: Array<{
  compensation: number;
  accepted: boolean;
  timestamp: string;
}>): Promise<number> {
  if (offers.length < 2) {
    return 0.5; // Default neutral elasticity
  }

  const acceptedOffers = offers.filter((o) => o.accepted);
  const avgCompAccepted = acceptedOffers.reduce((sum, o) => sum + o.compensation, 0) / acceptedOffers.length;
  const avgCompAll = offers.reduce((sum, o) => sum + o.compensation, 0) / offers.length;

  // Elasticity = (acceptance rate change) / (compensation change)
  const acceptanceRate = acceptedOffers.length / offers.length;
  const compRatio = avgCompAccepted / avgCompAll;

  return Math.min(1, Math.max(0, acceptanceRate * compRatio));
}

/**
 * Detect hiring thresholds (experience, board-cert, CME)
 */
export async function detectHiringThresholds(orgId: string, hires: Array<{
  experience: number;
  boardCert: boolean;
  cme: number;
  hired: boolean;
}>): Promise<{
  experience: number;
  boardCert: boolean;
  cme: number;
}> {
  const hired = hires.filter((h) => h.hired);
  if (hired.length === 0) {
    return {
      experience: 0,
      boardCert: false,
      cme: 0,
    };
  }

  const minExperience = Math.min(...hired.map((h) => h.experience));
  const boardCertRequired = hired.every((h) => h.boardCert);
  const minCme = Math.min(...hired.map((h) => h.cme));

  return {
    experience: minExperience,
    boardCert: boardCertRequired,
    cme: minCme,
  };
}

/**
 * Predict employer response time
 */
export async function predictResponseTime(orgId: string, historicalData: Array<{
  timestamp: string;
  responseTime: number; // hours
}>): Promise<{
  average: number;
  median: number;
  p95: number;
}> {
  if (historicalData.length === 0) {
    return {
      average: 48, // Default 2 days
      median: 48,
      p95: 120, // Default 5 days
    };
  }

  const times = historicalData.map((d) => d.responseTime).sort((a, b) => a - b);
  const average = times.reduce((sum, t) => sum + t, 0) / times.length;
  const median = times[Math.floor(times.length / 2)];
  const p95Index = Math.floor(times.length * 0.95);
  const p95 = times[p95Index] || times[times.length - 1];

  return { average, median, p95 };
}

/**
 * Predict offer-vs-hire outcome probability
 */
export async function predictOfferAcceptance(
  orgId: string,
  offer: {
    compensation: number;
    experience: number;
    boardCert: boolean;
    cme: number;
  },
): Promise<number> {
  const behavior = await getEmployerBehaviorEconomics(orgId);
  if (!behavior) {
    return 0.5; // Default 50%
  }

  let probability = 0.5;

  // Adjust based on compensation elasticity
  const compFactor = offer.compensation / 200000; // Normalize to $200k
  probability += behavior.offerElasticity * compFactor * 0.2;

  // Adjust based on thresholds
  if (offer.experience >= behavior.hiringThresholds.experience) {
    probability += 0.1;
  }
  if (offer.boardCert === behavior.hiringThresholds.boardCert) {
    probability += 0.1;
  }
  if (offer.cme >= behavior.hiringThresholds.cme) {
    probability += 0.1;
  }

  // Use historical acceptance rate as baseline
  probability = probability * 0.5 + behavior.offerAcceptanceRate * 0.5;

  return Math.min(1, Math.max(0, probability));
}

/**
 * Calculate employer friction cost (cost of slow verification)
 */
export async function calculateFrictionCost(orgId: string, verificationData: Array<{
  step: string;
  duration: number; // hours
  cost: number; // dollars
}>): Promise<number> {
  const totalCost = verificationData.reduce((sum, d) => sum + d.cost, 0);
  const totalDuration = verificationData.reduce((sum, d) => sum + d.duration, 0);

  // Friction cost = total cost + opportunity cost (time * hourly rate)
  const hourlyRate = 100; // Average hourly cost
  const opportunityCost = totalDuration * hourlyRate;

  return totalCost + opportunityCost;
}

/**
 * Model demand elasticity (job posting frequency vs market conditions)
 */
export async function modelDemandElasticity(orgId: string, marketData: Array<{
  timestamp: string;
  jobPostings: number;
  marketCondition: 'high' | 'medium' | 'low';
}>): Promise<number> {
  if (marketData.length < 2) {
    return 0.5; // Default neutral
  }

  const highMarket = marketData.filter((d) => d.marketCondition === 'high');
  const lowMarket = marketData.filter((d) => d.marketCondition === 'low');

  if (highMarket.length === 0 || lowMarket.length === 0) {
    return 0.5;
  }

  const avgHigh = highMarket.reduce((sum, d) => sum + d.jobPostings, 0) / highMarket.length;
  const avgLow = lowMarket.reduce((sum, d) => sum + d.jobPostings, 0) / lowMarket.length;

  // Elasticity = (posting change) / (market change)
  const postingChange = (avgHigh - avgLow) / avgLow;
  const marketChange = 1; // High to low = 1 unit change

  return Math.min(1, Math.max(0, postingChange / marketChange));
}

/**
 * Calculate behavioral risk index (risk to candidate trust, 0-100)
 */
export async function calculateBehavioralRiskIndex(orgId: string): Promise<number> {
  const behavior = await getEmployerBehaviorEconomics(orgId);
  if (!behavior) {
    return 50; // Default medium risk
  }

  let risk = 0;

  // High friction cost increases risk
  if (behavior.frictionCost > 10000) {
    risk += 20;
  } else if (behavior.frictionCost > 5000) {
    risk += 10;
  }

  // Slow response time increases risk
  if (behavior.responseTime.average > 120) {
    risk += 20;
  } else if (behavior.responseTime.average > 72) {
    risk += 10;
  }

  // Low offer acceptance rate increases risk
  if (behavior.offerAcceptanceRate < 0.3) {
    risk += 20;
  } else if (behavior.offerAcceptanceRate < 0.5) {
    risk += 10;
  }

  // High risk index from signals
  risk += behavior.riskIndex * 0.5;

  return Math.min(100, Math.max(0, risk));
}

/**
 * Anchor economics engine snapshot
 */
export async function anchorEconomicsSnapshot(orgId: string): Promise<void> {
  const behavior = await getEmployerBehaviorEconomics(orgId);
  if (!behavior) {
    return;
  }

  const riskIndex = await calculateBehavioralRiskIndex(orgId);

  anchorEvent('employerBehaviorEconomicsAnchored', {
    orgId,
    offerElasticity: behavior.offerElasticity,
    responseTimeAvg: behavior.responseTime.average,
    offerAcceptanceRate: behavior.offerAcceptanceRate,
    frictionCost: behavior.frictionCost,
    riskIndex,
    timestamp: new Date().toISOString(),
  });
}


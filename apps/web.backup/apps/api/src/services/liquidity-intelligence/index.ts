import { PrismaClient } from '@prisma/client';
import { shortageClassifier } from './shortage-classifier';
import { roleVelocityTracker } from './velocity-tracker';
import { responsivenessEngine } from './responsiveness';
import { frictionDetector } from './friction-detector';
import { liquidityAutomation } from './automation';
import { crossMarketModeling } from './cross-market';
import { liquidityForecast } from './forecast';
import { anchorLiquidityIntelligence } from './anchor';

const prisma = new PrismaClient();

export interface LiquidityIntelligenceData {
  shortages: any[];
  abundances: any[];
  velocity: Record<string, number>;
  responsiveness: Record<string, number>;
}

export async function getLiquidityIntelligence(region: string) {
  const existing = await prisma.liquidityIntelligence.findUnique({
    where: { region },
  });

  if (existing) {
    return { id: existing.id, intel: existing.intel as LiquidityIntelligenceData };
  }

  const created = await prisma.liquidityIntelligence.create({
    data: {
      region,
      intel: {
        shortages: [],
        abundances: [],
        velocity: {},
        responsiveness: {},
      },
    },
  });

  return { id: created.id, intel: created.intel as LiquidityIntelligenceData };
}

export async function classifyShortageAbundance(region: string, specialty: string) {
  return shortageClassifier(region, specialty);
}

export async function trackRoleVelocity(region: string, specialty: string) {
  return roleVelocityTracker(region, specialty);
}

export async function scoreEmployerResponsiveness(orgId: string) {
  return responsivenessEngine(orgId);
}

export async function detectFriction(region: string) {
  return frictionDetector(region);
}

export async function boostLiquidity(region: string, specialty: string) {
  return liquidityAutomation(region, specialty);
}

export async function modelCrossMarketLiquidity(regions: string[]) {
  return crossMarketModeling(regions);
}

export async function forecastLiquidity(region: string, specialty: string, days: number) {
  return liquidityForecast(region, specialty, days);
}

export async function anchorLiquidity(region: string) {
  const intel = await prisma.liquidityIntelligence.findUnique({
    where: { region },
  });

  if (!intel) {
    throw new Error(`Liquidity intelligence for region ${region} not found`);
  }

  return anchorLiquidityIntelligence(intel);
}

export {
  shortageClassifier,
  roleVelocityTracker,
  responsivenessEngine,
  frictionDetector,
  liquidityAutomation,
  crossMarketModeling,
  liquidityForecast,
  anchorLiquidityIntelligence,
};









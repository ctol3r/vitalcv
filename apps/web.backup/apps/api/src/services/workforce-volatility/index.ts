/**
 * Batch 434 — Workforce Predictive Volatility Engine v7
 * Model and predict workforce volatility due to shortages, burnout, compensation shifts & policy changes
 */

import { PrismaClient } from '@prisma/client';
import { anchorEvent } from '../audit/anchor';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

export interface VolatilitySignal {
  type: 'burnout_risk' | 'employer_instability' | 'regulatory_shift' | 'specialty_scarcity';
  value: number; // 0-100
  region: string;
  specialty?: string;
  timestamp: string;
}

export interface WorkforceVolatilityResult {
  region: string;
  volatility: {
    index: number; // 0-100, higher = more volatile
    signals: VolatilitySignal[];
    byType: Record<string, number>; // signal type -> average value
    forecast: {
      nearTerm: number; // 0-30 days
      midTerm: number; // 30-90 days
      longTerm: number; // 90-180 days
    };
  };
  forecasting: {
    turbulence: Array<{
      date: string;
      predictedVolatility: number;
      factors: string[];
    }>;
    mitigationPaths: Array<{
      strategy: string;
      expectedReduction: number;
      priority: 'low' | 'medium' | 'high';
    }>;
  };
  clustering: {
    regions: string[];
    patterns: Array<{
      clusterId: string;
      regions: string[];
      pattern: string;
      volatility: number;
    }>;
  };
  specialtyOverlay: {
    specialties: string[];
    volatilityBySpecialty: Record<string, number>;
  };
  updatedAt: string;
}

/**
 * Extract volatility signals
 */
function extractVolatilitySignals(signals: VolatilitySignal[]): Record<string, VolatilitySignal[]> {
  return signals.reduce((acc, signal) => {
    if (!acc[signal.type]) acc[signal.type] = [];
    acc[signal.type].push(signal);
    return acc;
  }, {} as Record<string, VolatilitySignal[]>);
}

/**
 * Compute volatility index 0–100
 */
function computeVolatilityIndex(signals: VolatilitySignal[]): number {
  if (signals.length === 0) return 50; // Default neutral

  const weights: Record<string, number> = {
    burnout_risk: 0.3,
    employer_instability: 0.25,
    regulatory_shift: 0.25,
    specialty_scarcity: 0.2,
  };

  const weightedSum = signals.reduce((sum, signal) => {
    const weight = weights[signal.type] || 0.25;
    return sum + signal.value * weight;
  }, 0);

  return Math.round(Math.min(100, weightedSum));
}

/**
 * Predict near-future turbulence
 */
function forecastTurbulence(
  signals: VolatilitySignal[],
  region: string
): WorkforceVolatilityResult['forecasting']['turbulence'] {
  const turbulence: WorkforceVolatilityResult['forecasting']['turbulence'] = [];

  // Predict for next 30, 60, 90 days
  const intervals = [30, 60, 90];
  const baseVolatility = computeVolatilityIndex(signals);

  intervals.forEach((days) => {
    const futureDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    // Simplified: volatility increases over time if signals are high
    const predictedVolatility = Math.min(100, baseVolatility + (days / 30) * 5);

    turbulence.push({
      date: futureDate.toISOString(),
      predictedVolatility: Math.round(predictedVolatility),
      factors: signals.filter((s) => s.value > 70).map((s) => s.type),
    });
  });

  return turbulence;
}

/**
 * Suggest strategic placements/reinforcements
 */
function suggestMitigationPaths(
  volatility: number
): WorkforceVolatilityResult['forecasting']['mitigationPaths'] {
  const paths: WorkforceVolatilityResult['forecasting']['mitigationPaths'] = [];

  if (volatility > 70) {
    paths.push({
      strategy: 'Deploy additional resources to high-volatility regions',
      expectedReduction: 20,
      priority: 'high',
    });
    paths.push({
      strategy: 'Implement retention incentives',
      expectedReduction: 15,
      priority: 'high',
    });
  } else if (volatility > 50) {
    paths.push({
      strategy: 'Monitor workforce trends closely',
      expectedReduction: 10,
      priority: 'medium',
    });
    paths.push({
      strategy: 'Prepare contingency plans',
      expectedReduction: 5,
      priority: 'medium',
    });
  } else {
    paths.push({
      strategy: 'Maintain current stability measures',
      expectedReduction: 0,
      priority: 'low',
    });
  }

  return paths;
}

/**
 * Group regions/employers by volatility patterns
 */
function clusterVolatilityPatterns(
  regions: string[],
  signals: VolatilitySignal[]
): WorkforceVolatilityResult['clustering'] {
  const patterns: WorkforceVolatilityResult['clustering']['patterns'] = [];

  regions.forEach((region) => {
    const regionSignals = signals.filter((s) => s.region === region);
    if (regionSignals.length > 0) {
      const volatility = computeVolatilityIndex(regionSignals);
      patterns.push({
        clusterId: `cluster_${region}`,
        regions: [region],
        pattern: volatility > 70 ? 'high_volatility' : volatility > 50 ? 'moderate_volatility' : 'stable',
        volatility,
      });
    }
  });

  return {
    regions,
    patterns,
  };
}

/**
 * Generate volatility profile
 */
export async function generateVolatilityProfile(
  region: string,
  signals: VolatilitySignal[]
): Promise<WorkforceVolatilityResult> {
  const index = computeVolatilityIndex(signals);
  const byType = extractVolatilitySignals(signals);

  const byTypeAverages: Record<string, number> = {};
  Object.entries(byType).forEach(([type, typeSignals]) => {
    byTypeAverages[type] = typeSignals.reduce((sum, s) => sum + s.value, 0) / typeSignals.length;
  });

  const turbulence = forecastTurbulence(signals, region);
  const nearTerm = turbulence.find((t) => t.date === turbulence[0]?.date)?.predictedVolatility ?? index;
  const midTerm = turbulence.find((t) => t.date === turbulence[1]?.date)?.predictedVolatility ?? index;
  const longTerm = turbulence.find((t) => t.date === turbulence[2]?.date)?.predictedVolatility ?? index;

  const mitigationPaths = suggestMitigationPaths(index);
  const clustering = clusterVolatilityPatterns([region], signals);

  const specialtySignals = signals.filter((s) => s.specialty);
  const specialties = [...new Set(specialtySignals.map((s) => s.specialty!))];
  const volatilityBySpecialty: Record<string, number> = {};
  specialties.forEach((specialty) => {
    const specialtySigs = specialtySignals.filter((s) => s.specialty === specialty);
    volatilityBySpecialty[specialty] = computeVolatilityIndex(specialtySigs);
  });

  const result: WorkforceVolatilityResult = {
    region,
    volatility: {
      index,
      signals,
      byType: byTypeAverages,
      forecast: {
        nearTerm,
        midTerm,
        longTerm,
      },
    },
    forecasting: {
      turbulence,
      mitigationPaths,
    },
    clustering,
    specialtyOverlay: {
      specialties,
      volatilityBySpecialty,
    },
    updatedAt: new Date().toISOString(),
  };

  // Save to database
  await prisma.workforceVolatility.upsert({
    where: { region },
    create: {
      region,
      volatility: result as any,
    },
    update: {
      volatility: result as any,
    },
  });

  return result;
}

/**
 * Export volatility pack
 */
export async function exportVolatilityPack(region: string): Promise<{
  volatility: WorkforceVolatilityResult;
  exportHash: string;
  generatedAt: string;
}> {
  const record = await prisma.workforceVolatility.findUnique({
    where: { region },
  });

  if (!record) {
    throw new Error(`No volatility profile found for region ${region}`);
  }

  const volatility = record.volatility as any as WorkforceVolatilityResult;

  // Anchor snapshot
  anchorEvent('workforceVolatilityAnchored', {
    region,
    volatilityHash: createHash('sha256').update(JSON.stringify(volatility)).digest('hex'),
    volatilityIndex: volatility.volatility.index,
    specialtyCount: volatility.specialtyOverlay.specialties.length,
  });

  return {
    volatility,
    exportHash: `volatility_${region}_${Date.now()}`,
    generatedAt: new Date().toISOString(),
  };
}









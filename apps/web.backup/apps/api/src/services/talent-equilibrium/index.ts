/**
 * Batch 402 — Employer Talent Equilibrium Network v7
 * Equilibrium model predicting talent flows between employers
 */

import { PrismaClient } from '@prisma/client';
import { anchorEvent } from '../audit/anchor';

const prisma = new PrismaClient();

export interface TalentFlow {
  fromEmployer: string;
  toEmployer: string;
  clinicianCount: number;
  factors: string[];
}

export interface EquilibriumResult {
  region: string;
  network: {
    employers: Array<{ id: string; pullStrength: number; talentMass: number }>;
    flows: TalentFlow[];
    equilibrium: number; // 0-100, higher = more balanced
  };
  drift: {
    detected: boolean;
    magnitude: number;
    direction: 'improving' | 'declining';
  };
  forecast: {
    horizonDays: number;
    predictedEquilibrium: number;
    recommendations: string[];
  };
  updatedAt: string;
}

export async function calculateEquilibrium(region: string, flows: TalentFlow[]): Promise<EquilibriumResult> {
  // Calculate employer pull strength and talent mass
  const employers = new Map<string, { pullStrength: number; talentMass: number }>();

  for (const flow of flows) {
    // Pull strength = net inflow
    const currentFrom = employers.get(flow.fromEmployer) || { pullStrength: 0, talentMass: 0 };
    const currentTo = employers.get(flow.toEmployer) || { pullStrength: 0, talentMass: 0 };

    employers.set(flow.fromEmployer, {
      pullStrength: currentFrom.pullStrength - flow.clinicianCount,
      talentMass: currentFrom.talentMass - flow.clinicianCount,
    });

    employers.set(flow.toEmployer, {
      pullStrength: currentTo.pullStrength + flow.clinicianCount,
      talentMass: currentTo.talentMass + flow.clinicianCount,
    });
  }

  const employerArray = Array.from(employers.entries()).map(([id, data]) => ({ id, ...data }));

  // Calculate equilibrium (inverse of variance in pull strength)
  const pullStrengths = employerArray.map((e) => e.pullStrength);
  const mean = pullStrengths.reduce((a, b) => a + b, 0) / pullStrengths.length;
  const variance = pullStrengths.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / pullStrengths.length;
  const equilibrium = Math.max(0, 100 - Math.sqrt(variance) * 10);

  // Detect drift
  const drift = {
    detected: variance > 100,
    magnitude: Math.sqrt(variance),
    direction: variance > 200 ? 'declining' : 'improving',
  };

  // Forecast
  const forecast = {
    horizonDays: 90,
    predictedEquilibrium: equilibrium + (drift.direction === 'improving' ? 5 : -5),
    recommendations: variance > 100 ? ['Address talent flow imbalances', 'Review employer competitive positioning'] : [],
  };

  const result: EquilibriumResult = {
    region,
    network: {
      employers: employerArray,
      flows,
      equilibrium: Math.round(equilibrium * 100) / 100,
    },
    drift,
    forecast,
    updatedAt: new Date().toISOString(),
  };

  await prisma.talentEquilibriumNetwork.upsert({
    where: { region },
    create: { region, network: result as any },
    update: { network: result as any },
  });

  return result;
}

export async function generateEquilibriumExport(region: string) {
  const record = await prisma.talentEquilibriumNetwork.findUnique({ where: { region } });
  if (!record) throw new Error(`No equilibrium data for region ${region}`);

  anchorEvent('talentEquilibriumAnchored', {
    region,
    equilibriumHash: JSON.stringify(record.network).substring(0, 64),
    equilibrium: (record.network as any).equilibrium || 0,
  });

  return { network: record.network, exportHash: `equilibrium_${region}_${Date.now()}`, generatedAt: new Date().toISOString() };
}


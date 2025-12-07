/**
 * Batch 403 — Regulator Impact Propagation Grid v8
 * Model how rule changes propagate through workflows, compliance, and workforce flows
 */

import { PrismaClient } from '@prisma/client';
import { anchorEvent } from '../audit/anchor';

const prisma = new PrismaClient();

export interface RegulatoryChange {
  authorityCode: string;
  ruleId: string;
  changeType: 'new' | 'modified' | 'removed';
  severity: 1 | 2 | 3 | 4 | 5;
  affectedDomains: string[];
}

export interface ImpactResult {
  region: string;
  grid: {
    changes: RegulatoryChange[];
    propagation: Array<{ domain: string; impact: number; workloadDelta: number }>;
    severity: number; // 1-5
    crossBorder: {
      affectedRegions: string[];
      harmonization: boolean;
    };
    workload: {
      current: number;
      predicted: number;
      delta: number;
    };
    recommendations: string[];
  };
  updatedAt: string;
}

export async function calculateRegImpact(region: string, changes: RegulatoryChange[]): Promise<ImpactResult> {
  const propagation = changes.flatMap((change) =>
    change.affectedDomains.map((domain) => ({
      domain,
      impact: change.severity * 20, // Scale 1-5 to 0-100
      workloadDelta: change.severity * 10,
    }))
  );

  const avgSeverity = changes.reduce((sum, c) => sum + c.severity, 0) / changes.length;
  const totalWorkload = propagation.reduce((sum, p) => sum + p.workloadDelta, 0);
  const predictedWorkload = totalWorkload * 1.2; // 20% overhead

  const crossBorder = {
    affectedRegions: ['US', 'EU'], // Simplified
    harmonization: avgSeverity < 3,
  };

  const recommendations: string[] = [];
  if (avgSeverity >= 4) {
    recommendations.push('High-impact changes detected - prioritize compliance review');
  }
  if (!crossBorder.harmonization) {
    recommendations.push('Consider cross-border harmonization strategies');
  }

  const result: ImpactResult = {
    region,
    grid: {
      changes,
      propagation,
      severity: Math.round(avgSeverity * 100) / 100,
      crossBorder,
      workload: {
        current: totalWorkload,
        predicted: predictedWorkload,
        delta: predictedWorkload - totalWorkload,
      },
      recommendations,
    },
    updatedAt: new Date().toISOString(),
  };

  await prisma.regImpactGrid.upsert({
    where: { region },
    create: { region, grid: result as any },
    update: { grid: result as any },
  });

  return result;
}

export async function generateRegImpactExport(region: string) {
  const record = await prisma.regImpactGrid.findUnique({ where: { region } });
  if (!record) throw new Error(`No impact data for region ${region}`);

  anchorEvent('regImpactGridAnchored', {
    region,
    impactHash: JSON.stringify(record.grid).substring(0, 64),
    severity: (record.grid as any).severity || 0,
  });

  return { grid: record.grid, exportHash: `reg_impact_${region}_${Date.now()}`, generatedAt: new Date().toISOString() };
}


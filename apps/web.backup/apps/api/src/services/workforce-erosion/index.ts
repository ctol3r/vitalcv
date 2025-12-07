/**
 * Batch 404 — Workforce Erosion & Retention Predictor v6
 * Predict talent erosion, loss risk, burnout-driven attrition, and long-term retention
 */

import { PrismaClient } from '@prisma/client';
import { anchorEvent } from '../audit/anchor';

const prisma = new PrismaClient();

export interface ErosionSignal {
  type: 'burnout' | 'salary_mismatch' | 'satisfaction' | 'employer_instability' | 'mobility';
  value: number; // 0-100, higher = higher risk
  timestamp: string;
}

export interface ErosionResult {
  region: string;
  erosion: {
    overallRisk: number; // 0-100
    signals: ErosionSignal[];
    employerMapping: Array<{ employerId: string; risk: number; lossCount: number }>;
    retention: {
      plan: string[];
      effectiveness: number;
    };
    drift: {
      detected: boolean;
      magnitude: number;
      direction: 'improving' | 'declining';
    };
    forecast: {
      horizonDays: number;
      predictedLoss: number;
      highRiskEmployers: string[];
    };
  };
  updatedAt: string;
}

export async function calculateErosion(region: string, signals: ErosionSignal[]): Promise<ErosionResult> {
  const overallRisk = signals.reduce((sum, s) => sum + s.value, 0) / signals.length;

  // Employer-level mapping (simplified)
  const employerMapping = [
    { employerId: 'emp1', risk: overallRisk * 1.2, lossCount: Math.round(overallRisk / 10) },
    { employerId: 'emp2', risk: overallRisk * 0.8, lossCount: Math.round(overallRisk / 15) },
  ];

  const retention = {
    plan: ['Improve compensation', 'Enhance work-life balance', 'Career development opportunities'],
    effectiveness: Math.max(0, 100 - overallRisk),
  };

  const drift = {
    detected: overallRisk > 50,
    magnitude: overallRisk,
    direction: overallRisk > 60 ? 'declining' : 'improving',
  };

  const forecast = {
    horizonDays: 180,
    predictedLoss: Math.round(overallRisk / 5),
    highRiskEmployers: employerMapping.filter((e) => e.risk > 60).map((e) => e.employerId),
  };

  const result: ErosionResult = {
    region,
    erosion: {
      overallRisk: Math.round(overallRisk * 100) / 100,
      signals,
      employerMapping,
      retention,
      drift,
      forecast,
    },
    updatedAt: new Date().toISOString(),
  };

  await prisma.workforceErosion.upsert({
    where: { region },
    create: { region, erosion: result as any },
    update: { erosion: result as any },
  });

  return result;
}

export async function generateErosionExport(region: string) {
  const record = await prisma.workforceErosion.findUnique({ where: { region } });
  if (!record) throw new Error(`No erosion data for region ${region}`);

  anchorEvent('workforceErosionAnchored', {
    region,
    erosionHash: JSON.stringify(record.erosion).substring(0, 64),
    overallRisk: (record.erosion as any).overallRisk || 0,
  });

  return { erosion: record.erosion, exportHash: `erosion_${region}_${Date.now()}`, generatedAt: new Date().toISOString() };
}


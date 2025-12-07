import { PrismaClient } from '@prisma/client';
import { rigorAnalyzer } from './rigor-analyzer';
import { automationIndex } from './automation-index';
import { safetyAlignment } from './safety-alignment';
import { gapAnalyzer } from './gap-analyzer';
import { pathwayGenerator } from './pathway-generator';
import { benchmarkingEngine } from './benchmarking';
import { maturityRouting } from './routing';
import { anchorMaturity } from './anchor';

const prisma = new PrismaClient();

export async function getCredentialMaturity(orgId: string) {
  const existing = await prisma.credentialMaturity.findUnique({
    where: { orgId },
  });

  if (existing) {
    return { id: existing.id, score: existing.score, signals: existing.signals };
  }

  const created = await prisma.credentialMaturity.create({
    data: {
      orgId,
      score: 0.5,
      signals: {},
    },
  });

  return { id: created.id, score: created.score, signals: created.signals };
}

export async function analyzeRigor(orgId: string) {
  return rigorAnalyzer(orgId);
}

export async function calculateAutomationIndex(orgId: string) {
  return automationIndex(orgId);
}

export async function calculateSafetyAlignment(orgId: string) {
  return safetyAlignment(orgId);
}

export async function analyzeGaps(orgId: string) {
  return gapAnalyzer(orgId);
}

export async function generateCompliancePathway(orgId: string) {
  return pathwayGenerator(orgId);
}

export async function benchmarkMaturity(orgId: string) {
  return benchmarkingEngine(orgId);
}

export async function routeByMaturity(orgId: string, clinicianId: string) {
  return maturityRouting(orgId, clinicianId);
}

export async function anchorMaturitySnapshot(orgId: string) {
  const maturity = await prisma.credentialMaturity.findUnique({
    where: { orgId },
  });

  if (!maturity) {
    throw new Error(`Maturity score for org ${orgId} not found`);
  }

  return anchorMaturity(maturity);
}

export {
  rigorAnalyzer,
  automationIndex,
  safetyAlignment,
  gapAnalyzer,
  pathwayGenerator,
  benchmarkingEngine,
  maturityRouting,
  anchorMaturity,
};









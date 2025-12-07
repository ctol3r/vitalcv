import { PrismaClient } from '@prisma/client';
import { anchorEvent } from '../audit/anchor';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

export interface ResonanceFactors {
  cognitive: number;
  skill: number;
  readiness: number;
  trajectory: number;
}

export interface CulturalFit {
  values: number;
  communication: number;
  workStyle: number;
  overall: number;
}

export interface TalentResonance {
  clinicianId: string;
  employerId: string;
  resonance: {
    factors: ResonanceFactors;
    matchQuality: number;
    culturalFit: CulturalFit;
    drift: Array<{
      date: string;
      resonance: number;
      change: number;
    }>;
    optimizations: Array<{
      intervention: string;
      impact: number;
      effort: number;
    }>;
    riskBlend: {
      resonance: number;
      compliance: number;
      safety: number;
      overall: number;
    };
    updatedAt: string;
  };
  updatedAt: string;
}

/**
 * Task 356.2 — Resonance factor extractor v3
 * Extract cognitive, skill, readiness & trajectory alignment
 */
export async function extractResonanceFactors(
  clinicianId: string,
  employerId: string,
): Promise<ResonanceFactors> {
  // Get clinician readiness
  const readiness = await prisma.clinicianReadinessScore.findFirst({
    where: { clinicianId },
  });

  // Get clinician skills
  const skills = await prisma.skillNode.findMany({
    where: {},
    take: 20,
  });

  // Get employer requirements
  const jobPostings = await prisma.jobPosting.findMany({
    where: { orgId: employerId },
    take: 10,
  });

  // Compute factors
  const cognitive = readiness ? readiness.score * 0.3 : 0.5;
  const skill = skills.length > 0 ? Math.min(skills.length / 10, 1) : 0.5;
  const readinessScore = readiness ? readiness.score : 0.5;
  const trajectory = jobPostings.length > 0 ? 0.7 : 0.5;

  return {
    cognitive,
    skill,
    readiness: readinessScore,
    trajectory,
  };
}

/**
 * Task 356.3 — Match quality predictor v4
 * Predict hiring success accuracy
 */
export async function predictMatchQuality(
  factors: ResonanceFactors,
  culturalFit: CulturalFit,
): Promise<number> {
  // Weighted combination
  const resonanceScore =
    factors.cognitive * 0.25 +
    factors.skill * 0.25 +
    factors.readiness * 0.25 +
    factors.trajectory * 0.25;

  const culturalScore =
    culturalFit.values * 0.3 +
    culturalFit.communication * 0.3 +
    culturalFit.workStyle * 0.4;

  // Final match quality
  return resonanceScore * 0.6 + culturalScore * 0.4;
}

/**
 * Task 356.5 — Cultural fit inference engine
 * Infer soft compatibility factors (no PHI)
 */
export async function inferCulturalFit(
  clinicianId: string,
  employerId: string,
): Promise<CulturalFit> {
  // Get clinician preferences
  const marketplace = await prisma.marketplaceProfile.findFirst({
    where: { clinicianId },
  });

  // Get employer profile
  const employer = await prisma.employerTrust.findFirst({
    where: { orgId: employerId },
  });

  // Infer values alignment
  const values = marketplace && employer ? 0.7 : 0.5;

  // Infer communication style
  const communication = 0.6; // Default estimate

  // Infer work style
  const workStyle = marketplace ? 0.7 : 0.5;

  const overall = (values + communication + workStyle) / 3;

  return {
    values,
    communication,
    workStyle,
    overall,
  };
}

/**
 * Task 356.6 — Resonance drift monitor
 * Track changes in resonance over time
 */
export async function monitorResonanceDrift(
  clinicianId: string,
  employerId: string,
): Promise<Array<{ date: string; resonance: number; change: number }>> {
  const drift: Array<{ date: string; resonance: number; change: number }> = [];

  const resonances = await prisma.talentResonance.findMany({
    where: { clinicianId, employerId },
    orderBy: { updatedAt: 'asc' },
    take: 20,
  });

  let previousResonance = 0.5;

  for (const resonance of resonances) {
    const data = resonance.resonance as TalentResonance['resonance'];
    const currentResonance = data.matchQuality;

    drift.push({
      date: resonance.updatedAt.toISOString(),
      resonance: currentResonance,
      change: currentResonance - previousResonance,
    });

    previousResonance = currentResonance;
  }

  return drift;
}

/**
 * Task 356.7 — Resonance optimization recommender
 * Suggest interventions to increase match quality
 */
export async function recommendResonanceOptimizations(
  clinicianId: string,
  employerId: string,
  factors: ResonanceFactors,
): Promise<Array<{ intervention: string; impact: number; effort: number }>> {
  const optimizations: Array<{ intervention: string; impact: number; effort: number }> = [];

  // Check readiness
  if (factors.readiness < 0.7) {
    optimizations.push({
      intervention: 'Improve clinician readiness through credential completion',
      impact: 0.3,
      effort: 0.6,
    });
  }

  // Check skills
  if (factors.skill < 0.7) {
    optimizations.push({
      intervention: 'Enhance skill alignment through targeted training',
      impact: 0.4,
      effort: 0.7,
    });
  }

  // Check trajectory
  if (factors.trajectory < 0.7) {
    optimizations.push({
      intervention: 'Align career trajectory with employer needs',
      impact: 0.3,
      effort: 0.5,
    });
  }

  return optimizations;
}

/**
 * Task 356.8 — Resonance risk blend
 * Blend resonance with compliance & safety risk
 */
export async function blendResonanceRisk(
  clinicianId: string,
  employerId: string,
  resonance: number,
): Promise<{ resonance: number; compliance: number; safety: number; overall: number }> {
  // Get compliance risk
  const complianceChecks = await prisma.complianceCheck.findMany({
    where: { clinicianId },
    take: 10,
  });

  const complianceRisk =
    complianceChecks.length > 0
      ? complianceChecks.reduce((sum, c) => {
          const result = c.result as { risk?: number };
          return sum + (result?.risk || 0.5);
        }, 0) / complianceChecks.length
      : 0.5;

  // Get safety risk
  const safetySignals = await prisma.safetySignal.findMany({
    where: { clinicianId },
    take: 10,
  });

  const safetyRisk =
    safetySignals.length > 0
      ? safetySignals.reduce((sum, s) => {
          const severity = s.severity === 'high' ? 0.8 : s.severity === 'moderate' ? 0.5 : 0.2;
          return sum + severity;
        }, 0) / safetySignals.length
      : 0.3;

  // Overall risk (lower is better, so we invert)
  const overall = (resonance * 0.5 + (1 - complianceRisk) * 0.3 + (1 - safetyRisk) * 0.2);

  return {
    resonance,
    compliance: 1 - complianceRisk,
    safety: 1 - safetyRisk,
    overall,
  };
}

/**
 * Task 356.1 — Get or create talent resonance
 */
export async function getOrCreateTalentResonance(
  clinicianId: string,
  employerId: string,
): Promise<TalentResonance> {
  const existing = await prisma.talentResonance.findFirst({
    where: { clinicianId, employerId },
    orderBy: { updatedAt: 'desc' },
  });

  if (existing) {
    return {
      clinicianId,
      employerId,
      resonance: existing.resonance as TalentResonance['resonance'],
      updatedAt: existing.updatedAt.toISOString(),
    };
  }

  // Create new resonance
  const factors = await extractResonanceFactors(clinicianId, employerId);
  const culturalFit = await inferCulturalFit(clinicianId, employerId);
  const matchQuality = await predictMatchQuality(factors, culturalFit);
  const drift = await monitorResonanceDrift(clinicianId, employerId);
  const optimizations = await recommendResonanceOptimizations(clinicianId, employerId, factors);
  const riskBlend = await blendResonanceRisk(clinicianId, employerId, matchQuality);

  const resonance: TalentResonance = {
    clinicianId,
    employerId,
    resonance: {
      factors,
      matchQuality,
      culturalFit,
      drift,
      optimizations,
      riskBlend,
      updatedAt: new Date().toISOString(),
    },
    updatedAt: new Date().toISOString(),
  };

  await prisma.talentResonance.create({
    data: {
      clinicianId,
      employerId,
      resonance: resonance.resonance as unknown as Record<string, unknown>,
    },
  });

  return resonance;
}

/**
 * Task 356.9 — Export resonance bundle
 */
export async function exportResonanceBundle(
  clinicianId: string,
  employerId: string,
): Promise<{
  summary: string;
  pdfData: string;
}> {
  const resonance = await getOrCreateTalentResonance(clinicianId, employerId);

  const summary = `
Talent Resonance Report
Clinician: ${clinicianId}
Employer: ${employerId}
Generated: ${resonance.resonance.updatedAt}

Match Quality: ${(resonance.resonance.matchQuality * 100).toFixed(1)}%

Resonance Factors:
  Cognitive: ${(resonance.resonance.factors.cognitive * 100).toFixed(1)}%
  Skill: ${(resonance.resonance.factors.skill * 100).toFixed(1)}%
  Readiness: ${(resonance.resonance.factors.readiness * 100).toFixed(1)}%
  Trajectory: ${(resonance.resonance.factors.trajectory * 100).toFixed(1)}%

Cultural Fit:
  Values: ${(resonance.resonance.culturalFit.values * 100).toFixed(1)}%
  Communication: ${(resonance.resonance.culturalFit.communication * 100).toFixed(1)}%
  Work Style: ${(resonance.resonance.culturalFit.workStyle * 100).toFixed(1)}%
  Overall: ${(resonance.resonance.culturalFit.overall * 100).toFixed(1)}%

Risk Blend:
  Resonance: ${(resonance.resonance.riskBlend.resonance * 100).toFixed(1)}%
  Compliance: ${(resonance.resonance.riskBlend.compliance * 100).toFixed(1)}%
  Safety: ${(resonance.resonance.riskBlend.safety * 100).toFixed(1)}%
  Overall: ${(resonance.resonance.riskBlend.overall * 100).toFixed(1)}%

Optimizations: ${resonance.resonance.optimizations.length}
Drift Points: ${resonance.resonance.drift.length}
  `.trim();

  const pdfData = JSON.stringify(resonance, null, 2);

  return { summary, pdfData };
}

/**
 * Task 356.10 — Anchor resonance snapshot
 */
export async function anchorResonanceSnapshot(
  clinicianId: string,
  employerId: string,
): Promise<void> {
  const resonance = await getOrCreateTalentResonance(clinicianId, employerId);

  const resonanceHash = createHash('sha256')
    .update(JSON.stringify(resonance))
    .digest('hex');

  anchorEvent('talentResonanceAnchored', {
    clinicianId,
    employerId,
    resonanceHash,
    matchQuality: resonance.resonance.matchQuality,
    overallRisk: resonance.resonance.riskBlend.overall,
    timestamp: new Date().toISOString(),
  });
}


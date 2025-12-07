import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface PathwayStep {
  id: string;
  type: 'license' | 'board_cert' | 'cme' | 'training' | 'documentation' | 'verification';
  title: string;
  description: string;
  status: 'complete' | 'missing' | 'in_progress' | 'not_required';
  estimatedDays: number;
  dependencies?: string[];
  evidence?: unknown;
}

export interface PathwayPlan {
  clinicianId: string;
  targetRole: string;
  steps: PathwayStep[];
  totalEstimatedDays: number;
  readinessScore: number;
  constraints: string[];
}

/**
 * Determine what credentials are needed for target role
 */
export async function mapJobToCredentials(jobId: string): Promise<Array<{ type: string; requirement: string }>> {
  const job = await prisma.jobPosting.findUnique({
    where: { id: jobId },
    include: { specialtyRequirements: true },
  });

  if (!job) {
    return [];
  }

  const requirements: Array<{ type: string; requirement: string }> = [];

  // License requirements
  requirements.push({ type: 'license', requirement: 'Active medical license' });

  // Specialty requirements
  for (const spec of job.specialtyRequirements) {
    requirements.push({
      type: 'board_cert',
      requirement: `${spec.specialty} board certification`,
    });
  }

  // DEA if required
  requirements.push({ type: 'dea', requirement: 'DEA license' });

  return requirements;
}

/**
 * Identify missing licenses, board certs, CME
 */
export async function identifyMissingEvidence(clinicianId: string, targetRole: string): Promise<PathwayStep[]> {
  const steps: PathwayStep[] = [];

  // Check licenses
  const licenses = await prisma.globalLicense.findMany({
    where: { clinicianId, status: 'active' },
  });

  if (licenses.length === 0) {
    steps.push({
      id: 'step-license',
      type: 'license',
      title: 'Obtain Medical License',
      description: 'Active medical license required',
      status: 'missing',
      estimatedDays: 60,
    });
  }

  // Check board certifications
  const boardCerts = await prisma.walletCredential.findMany({
    where: { clinicianId, type: 'board_certification', revokedAt: null },
  });

  if (boardCerts.length === 0) {
    steps.push({
      id: 'step-board',
      type: 'board_cert',
      title: 'Obtain Board Certification',
      description: 'Board certification required for target role',
      status: 'missing',
      estimatedDays: 90,
      dependencies: ['step-license'],
    });
  }

  // Check DEA
  const deaCreds = await prisma.dEACredential.findMany({
    where: { clinicianId },
  });

  const activeDEA = deaCreds.find((d) => d.expiration > new Date());
  if (!activeDEA) {
    steps.push({
      id: 'step-dea',
      type: 'license',
      title: 'Obtain DEA License',
      description: 'DEA license required',
      status: 'missing',
      estimatedDays: 30,
      dependencies: ['step-license'],
    });
  }

  // Check CME (mock)
  steps.push({
    id: 'step-cme',
    type: 'cme',
    title: 'Complete CME Requirements',
    description: '50 hours of CME required',
    status: 'in_progress',
    estimatedDays: 15,
  });

  return steps;
}

/**
 * Predict days required to fill gaps
 */
export async function estimateTimeToReadiness(clinicianId: string, targetRole: string): Promise<number> {
  const steps = await identifyMissingEvidence(clinicianId, targetRole);

  // Calculate critical path (considering dependencies)
  const completedSteps = new Set<string>();
  let totalDays = 0;
  const stepMap = new Map(steps.map((s) => [s.id, s]));

  const processStep = (stepId: string): number => {
    if (completedSteps.has(stepId)) return 0;

    const step = stepMap.get(stepId);
    if (!step || step.status === 'complete') {
      completedSteps.add(stepId);
      return 0;
    }

    completedSteps.add(stepId);
    let maxDependencyDays = 0;

    if (step.dependencies) {
      for (const depId of step.dependencies) {
        maxDependencyDays = Math.max(maxDependencyDays, processStep(depId));
      }
    }

    return maxDependencyDays + (step.status === 'missing' ? step.estimatedDays : 0);
  };

  for (const step of steps) {
    totalDays = Math.max(totalDays, processStep(step.id));
  }

  return totalDays;
}

/**
 * Suggest fastest route to readiness
 */
export async function recommendFastestPathway(clinicianId: string, targetRole: string): Promise<PathwayStep[]> {
  const steps = await identifyMissingEvidence(clinicianId, targetRole);

  // Sort by estimated days and dependencies
  const sorted = [...steps].sort((a, b) => {
    // Process dependencies first
    if (a.dependencies && a.dependencies.length > 0 && !b.dependencies) return -1;
    if (b.dependencies && b.dependencies.length > 0 && !a.dependencies) return 1;
    return a.estimatedDays - b.estimatedDays;
  });

  return sorted;
}

/**
 * Generate multiple pathways for career progression
 */
export async function generateMultiRolePathways(
  clinicianId: string,
  targetRoles: string[]
): Promise<Record<string, PathwayPlan>> {
  const pathways: Record<string, PathwayPlan> = {};

  for (const role of targetRoles) {
    const steps = await identifyMissingEvidence(clinicianId, role);
    const estimatedDays = await estimateTimeToReadiness(clinicianId, role);

    const completedSteps = steps.filter((s) => s.status === 'complete').length;
    const readinessScore = steps.length > 0 ? completedSteps / steps.length : 1.0;

    pathways[role] = {
      clinicianId,
      targetRole: role,
      steps,
      totalEstimatedDays: estimatedDays,
      readinessScore,
      constraints: [],
    };
  }

  return pathways;
}

/**
 * Filter out impossible pathways based on regulatory constraints
 */
export async function applyRegulatoryConstraints(
  clinicianId: string,
  steps: PathwayStep[]
): Promise<PathwayStep[]> {
  const constraints: string[] = [];
  const filtered: PathwayStep[] = [];

  // Check license status
  const licenses = await prisma.globalLicense.findMany({
    where: { clinicianId },
  });

  const hasActiveLicense = licenses.some((l) => l.status === 'active');

  for (const step of steps) {
    // Skip steps that require active license if none exists
    if (step.type === 'board_cert' && !hasActiveLicense) {
      constraints.push(`Cannot obtain board certification without active license`);
      continue;
    }

    // Check for expired licenses that block progress
    const expiredLicenses = licenses.filter((l) => l.status === 'expired');
    if (expiredLicenses.length > 0 && step.dependencies?.includes('step-license')) {
      constraints.push('Expired licenses must be renewed first');
    }

    filtered.push(step);
  }

  return filtered;
}

/**
 * Generate pathway plan
 */
export async function generatePathwayPlan(clinicianId: string, targetRole: string): Promise<PathwayPlan> {
  let steps = await identifyMissingEvidence(clinicianId, targetRole);
  steps = await applyRegulatoryConstraints(clinicianId, steps);

  const estimatedDays = await estimateTimeToReadiness(clinicianId, targetRole);
  const completedSteps = steps.filter((s) => s.status === 'complete').length;
  const readinessScore = steps.length > 0 ? completedSteps / steps.length : 1.0;

  const constraints: string[] = [];
  if (steps.some((s) => s.status === 'missing' && s.estimatedDays > 90)) {
    constraints.push('Long timeline - some steps require 90+ days');
  }

  return {
    clinicianId,
    targetRole,
    steps,
    totalEstimatedDays: estimatedDays,
    readinessScore,
    constraints,
  };
}

/**
 * Export pathway report (PDF-ready data)
 */
export async function exportPathwayReport(clinicianId: string, targetRole: string): Promise<{
  clinicianId: string;
  targetRole: string;
  generatedAt: string;
  requirements: Array<{ type: string; description: string; status: string }>;
  timeline: { estimatedDays: number; startDate: string; targetDate: string };
  evidence: unknown[];
  recommendations: string[];
}> {
  const plan = await generatePathwayPlan(clinicianId, targetRole);

  const requirements = plan.steps.map((s) => ({
    type: s.type,
    description: s.description,
    status: s.status,
  }));

  const startDate = new Date();
  const targetDate = new Date(startDate.getTime() + plan.totalEstimatedDays * 24 * 60 * 60 * 1000);

  const recommendations: string[] = [];
  if (plan.readinessScore < 0.5) {
    recommendations.push('Focus on completing prerequisite steps first');
  }
  if (plan.totalEstimatedDays > 180) {
    recommendations.push('Consider parallel processing of independent steps');
  }

  return {
    clinicianId,
    targetRole,
    generatedAt: new Date().toISOString(),
    requirements,
    timeline: {
      estimatedDays: plan.totalEstimatedDays,
      startDate: startDate.toISOString(),
      targetDate: targetDate.toISOString(),
    },
    evidence: plan.steps.map((s) => s.evidence).filter((e) => e !== undefined),
    recommendations,
  };
}


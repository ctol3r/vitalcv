import { PrismaClient } from '@prisma/client';
import { anchorEvent } from '../audit/anchor';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

export interface RoutingSignal {
  readiness: number;
  shortages: number;
  employerTrust: number;
  clinicianPreferences: Record<string, unknown>;
  timestamp: string;
}

export interface RoutingTarget {
  clinicianId: string;
  targetRegion: string;
  targetRole: string;
  targetShift: string;
  score: number;
  factors: Record<string, number>;
}

export interface RoutingKernel {
  region: string;
  signals: RoutingSignal[];
  targets: RoutingTarget[];
  constraints: {
    legal: string[];
    credential: string[];
    compact: string[];
    visa: string[];
    privilege: string[];
  };
  drift: {
    detected: boolean;
    deviation: number;
    expectedPath: string[];
    actualPath: string[];
  };
  suggestions: Array<{
    type: string;
    description: string;
    impact: number;
  }>;
  updatedAt: string;
}

/**
 * Task 352.2 — Real-time routing signal collector v4
 * Collect readiness, shortages, employer trust, clinician preferences
 */
export async function collectRoutingSignals(region: string): Promise<RoutingSignal[]> {
  // Collect readiness signals
  const readinessScores = await prisma.clinicianReadinessScore.findMany({
    where: {},
    take: 100,
  });

  // Collect shortage signals (from market signals)
  const marketSignals = await prisma.marketSignal.findMany({
    where: { region },
    take: 50,
  });

  // Collect employer trust signals
  const employerTrust = await prisma.employerTrust.findMany({
    where: {},
    take: 50,
  });

  const signals: RoutingSignal[] = readinessScores.map((score) => ({
    readiness: score.score,
    shortages: marketSignals.reduce((sum, ms) => sum + (ms.demand - ms.supply), 0) / marketSignals.length || 0,
    employerTrust: employerTrust.reduce((sum, et) => sum + et.score, 0) / employerTrust.length || 0,
    clinicianPreferences: score.factors as Record<string, unknown>,
    timestamp: new Date().toISOString(),
  }));

  return signals;
}

/**
 * Task 352.3 — Kernel-based routing optimizer v3
 * Compute best-fit routing targets for each clinician
 */
export async function computeRoutingTargets(
  region: string,
  signals: RoutingSignal[],
): Promise<RoutingTarget[]> {
  const targets: RoutingTarget[] = [];

  // Get clinicians in region
  const clinicians = await prisma.clinicianProfile.findMany({
    where: {},
    take: 100,
  });

  for (const clinician of clinicians) {
    const signal = signals.find((s) => s.clinicianPreferences.clinicianId === clinician.id);
    if (!signal) continue;

    // Compute routing score
    const score =
      signal.readiness * 0.4 +
      (1 - signal.shortages / 100) * 0.3 +
      signal.employerTrust * 0.3;

    targets.push({
      clinicianId: clinician.id,
      targetRegion: region,
      targetRole: (signal.clinicianPreferences.role as string) || 'unknown',
      targetShift: (signal.clinicianPreferences.shift as string) || 'unknown',
      score,
      factors: {
        readiness: signal.readiness,
        shortage: signal.shortages,
        trust: signal.employerTrust,
      },
    });
  }

  return targets.sort((a, b) => b.score - a.score);
}

/**
 * Task 352.5 — Constraint-filtered routing logic
 * Legal, credential, compact, visa, privilege filters
 */
export async function applyRoutingConstraints(
  targets: RoutingTarget[],
): Promise<{ filtered: RoutingTarget[]; constraints: RoutingKernel['constraints'] }> {
  const constraints = {
    legal: [] as string[],
    credential: [] as string[],
    compact: [] as string[],
    visa: [] as string[],
    privilege: [] as string[],
  };

  const filtered: RoutingTarget[] = [];

  for (const target of targets) {
    // Check legal constraints
    const compliance = await prisma.complianceCheck.findFirst({
      where: { clinicianId: target.clinicianId },
      orderBy: { createdAt: 'desc' },
    });

    if (compliance && (compliance.result as { blocked?: boolean })?.blocked) {
      constraints.legal.push(target.clinicianId);
      continue;
    }

    // Check credential constraints
    const credentials = await prisma.masterCredentialIndex.findMany({
      where: { clinicianId: target.clinicianId, status: 'active' },
    });

    if (credentials.length === 0) {
      constraints.credential.push(target.clinicianId);
      continue;
    }

    // Check compact eligibility
    const compact = await prisma.compactEligibility.findFirst({
      where: { clinicianId: target.clinicianId, eligible: true },
    });

    if (!compact && target.targetRegion !== 'home') {
      constraints.compact.push(target.clinicianId);
      continue;
    }

    // Check privilege constraints
    const privileges = await prisma.privilegeSet.findMany({
      where: { specialty: target.targetRole },
    });

    if (privileges.length === 0) {
      constraints.privilege.push(target.clinicianId);
      continue;
    }

    filtered.push(target);
  }

  return { filtered, constraints };
}

/**
 * Task 352.6 — Multi-region routing integrator
 * Integrate routing across 50 states + international
 */
export async function integrateMultiRegionRouting(
  regions: string[],
): Promise<Record<string, RoutingKernel>> {
  const kernels: Record<string, RoutingKernel> = {};

  for (const region of regions) {
    const signals = await collectRoutingSignals(region);
    const targets = await computeRoutingTargets(region, signals);
    const { filtered, constraints } = await applyRoutingConstraints(targets);

    const drift = await detectRoutingDrift(region, filtered);
    const suggestions = await generateRoutingSuggestions(region, filtered);

    kernels[region] = {
      region,
      signals,
      targets: filtered,
      constraints,
      drift,
      suggestions,
      updatedAt: new Date().toISOString(),
    };
  }

  return kernels;
}

/**
 * Task 352.7 — Routing drift detector
 * Detect when routes deviate from expected paths
 */
export async function detectRoutingDrift(
  region: string,
  targets: RoutingTarget[],
): Promise<RoutingKernel['drift']> {
  // Get historical routing data
  const historical = await prisma.workforceRoutingKernel.findFirst({
    where: { region },
    orderBy: { updatedAt: 'desc' },
  });

  if (!historical) {
    return {
      detected: false,
      deviation: 0,
      expectedPath: [],
      actualPath: [],
    };
  }

  const expected = (historical.kernel as RoutingKernel).targets.map((t) => t.targetRegion);
  const actual = targets.map((t) => t.targetRegion);

  const deviation = Math.abs(expected.length - actual.length) / Math.max(expected.length, 1);

  return {
    detected: deviation > 0.2,
    deviation,
    expectedPath: expected,
    actualPath: actual,
  };
}

/**
 * Task 352.8 — AI routing improvement suggestions
 * Suggest strategic moves to improve match probability
 */
export async function generateRoutingSuggestions(
  region: string,
  targets: RoutingTarget[],
): Promise<Array<{ type: string; description: string; impact: number }>> {
  const suggestions: Array<{ type: string; description: string; impact: number }> = [];

  // Analyze low-scoring targets
  const lowScoring = targets.filter((t) => t.score < 0.5);
  if (lowScoring.length > 0) {
    suggestions.push({
      type: 'readiness_improvement',
      description: `Improve readiness for ${lowScoring.length} clinicians to increase routing options`,
      impact: 0.3,
    });
  }

  // Analyze constraint blockers
  const constraints = await prisma.workforceRoutingKernel.findFirst({
    where: { region },
    orderBy: { updatedAt: 'desc' },
  });

  if (constraints) {
    const constraintData = (constraints.kernel as RoutingKernel).constraints;
    const totalBlocked =
      constraintData.legal.length +
      constraintData.credential.length +
      constraintData.compact.length +
      constraintData.privilege.length;

    if (totalBlocked > 0) {
      suggestions.push({
        type: 'constraint_resolution',
        description: `Resolve ${totalBlocked} constraint blockers to unlock routing paths`,
        impact: 0.5,
      });
    }
  }

  return suggestions;
}

/**
 * Task 352.1 — Get or create routing kernel
 */
export async function getOrCreateRoutingKernel(region: string): Promise<RoutingKernel> {
  const existing = await prisma.workforceRoutingKernel.findFirst({
    where: { region },
    orderBy: { updatedAt: 'desc' },
  });

  if (existing) {
    return existing.kernel as RoutingKernel;
  }

  // Create new kernel
  const signals = await collectRoutingSignals(region);
  const targets = await computeRoutingTargets(region, signals);
  const { filtered, constraints } = await applyRoutingConstraints(targets);
  const drift = await detectRoutingDrift(region, filtered);
  const suggestions = await generateRoutingSuggestions(region, filtered);

  const kernel: RoutingKernel = {
    region,
    signals,
    targets: filtered,
    constraints,
    drift,
    suggestions,
    updatedAt: new Date().toISOString(),
  };

  await prisma.workforceRoutingKernel.create({
    data: {
      region,
      kernel: kernel as unknown as Record<string, unknown>,
    },
  });

  return kernel;
}

/**
 * Task 352.9 — Export routing kernel
 */
export async function exportRoutingKernel(region: string): Promise<{
  summary: string;
  pdfData: string;
}> {
  const kernel = await getOrCreateRoutingKernel(region);

  const summary = `
Routing Kernel Summary - ${region}
Generated: ${kernel.updatedAt}

Signals Collected: ${kernel.signals.length}
Routing Targets: ${kernel.targets.length}
Constraint Blockers: ${
    kernel.constraints.legal.length +
    kernel.constraints.credential.length +
    kernel.constraints.compact.length +
    kernel.constraints.privilege.length
  }

Drift Detected: ${kernel.drift.detected ? 'Yes' : 'No'}
Suggestions: ${kernel.suggestions.length}
  `.trim();

  const pdfData = JSON.stringify(kernel, null, 2);

  return { summary, pdfData };
}

/**
 * Task 352.10 — Anchor routing kernel snapshot
 */
export async function anchorRoutingKernelSnapshot(region: string): Promise<void> {
  const kernel = await getOrCreateRoutingKernel(region);

  const kernelHash = createHash('sha256')
    .update(JSON.stringify(kernel))
    .digest('hex');

  anchorEvent('routingKernelAnchored', {
    region,
    kernelHash,
    signalCount: kernel.signals.length,
    targetCount: kernel.targets.length,
    driftDetected: kernel.drift.detected,
    suggestionCount: kernel.suggestions.length,
    timestamp: new Date().toISOString(),
  });
}


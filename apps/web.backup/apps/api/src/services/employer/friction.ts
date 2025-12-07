import type { PrismaClient } from '@prisma/client';

export interface FrictionMatrix {
  drag: number;
  kineticResistance: number;
  matrix: Record<string, number>;
}

/**
 * Task 518.1 — FrictionPhysicsMatrix model
 * Models organizational friction (drag, kinetic resistance)
 */
export async function calculateFrictionMatrix(
  options: { prisma: PrismaClient; orgId?: string }
): Promise<FrictionMatrix> {
  const { prisma, orgId } = options;

  // Get or create friction matrix
  let matrix = await prisma.frictionPhysicsMatrix.findFirst({
    where: { orgId: orgId || null },
    orderBy: { updatedAt: 'desc' },
  });

  if (!matrix) {
    // Calculate friction based on hiring patterns
    const hiringFrictions = await prisma.hiringFriction.findMany({
      where: { orgId: orgId || undefined },
    });

    const avgFriction = hiringFrictions.length > 0
      ? hiringFrictions.reduce((sum, hf) => sum + hf.frictionScore, 0) / hiringFrictions.length
      : 0.5;

    const drag = Math.min(avgFriction, 1.0);
    const kineticResistance = drag * 0.8;

    const frictionMatrix: Record<string, number> = {
      hiring: avgFriction,
      privilege: 0.5,
      compliance: 0.6,
    };

    matrix = await prisma.frictionPhysicsMatrix.create({
      data: {
        orgId: orgId || null,
        drag,
        kineticResistance,
        matrix: frictionMatrix,
      },
    });
  }

  return {
    drag: matrix.drag,
    kineticResistance: matrix.kineticResistance,
    matrix: matrix.matrix as Record<string, number>,
  };
}

/**
 * Task 518.2 — Hiring friction detector
 * Detects friction between ATS and actual outcomes
 */
export async function detectHiringFriction(
  options: {
    prisma: PrismaClient;
    orgId: string;
    atsId?: string;
    outcomeMismatch: number;
  }
): Promise<{ frictionScore: number }> {
  const { prisma, orgId, atsId, outcomeMismatch } = options;

  // Calculate friction score (higher mismatch = higher friction)
  const frictionScore = Math.min(outcomeMismatch, 1.0);

  await prisma.hiringFriction.create({
    data: {
      orgId,
      atsId: atsId || null,
      outcomeMismatch,
      frictionScore,
    },
  });

  return { frictionScore };
}

/**
 * Task 518.3 — Privilege issuance friction model
 * Models friction in privilege issuance processes
 */
export async function calculatePrivilegeFriction(
  options: {
    prisma: PrismaClient;
    orgId: string;
    privilegeCode: string;
  }
): Promise<{ friction: number }> {
  const { prisma, orgId, privilegeCode } = options;

  // Get existing friction or calculate new
  let friction = await prisma.privilegeIssuanceFriction.findFirst({
    where: { orgId, privilegeCode },
  });

  if (!friction) {
    // Calculate friction based on safety signals
    const safetySignals = await prisma.privilegeSafetySignal.count({
      where: {
        privilegeCodes: { has: privilegeCode },
      },
    });

    const frictionValue = Math.min(safetySignals * 0.1, 1.0);

    friction = await prisma.privilegeIssuanceFriction.create({
      data: {
        orgId,
        privilegeCode,
        friction: frictionValue,
        factors: { safetySignals },
      },
    });
  }

  return { friction: friction.friction };
}

/**
 * Task 518.7 — Compliance resonance wave detector
 * Detects compliance resonance patterns
 */
export async function detectComplianceResonance(
  options: { prisma: PrismaClient; orgId?: string; region?: string }
): Promise<{ resonance: number; wave: unknown }> {
  const { prisma, orgId, region } = options;

  // Calculate resonance based on compliance checks
  const complianceChecks = await prisma.complianceCheck.findMany({
    where: {
      // Add filters if needed
    },
    take: 100,
  });

  const resonance = complianceChecks.length > 0
    ? Math.min(complianceChecks.length / 100, 1.0)
    : 0.5;

  const wave = {
    frequency: resonance,
    amplitude: complianceChecks.length,
    pattern: 'sine',
  };

  await prisma.complianceResonance.create({
    data: {
      orgId: orgId || null,
      region: region || null,
      resonance,
      wave,
    },
  });

  return { resonance, wave };
}

/**
 * Task 518.13 — SafetyPrivilegeReactor
 * Reacts to safety and privilege alignment
 */
export async function calculateSafetyPrivilegeReactor(
  options: {
    prisma: PrismaClient;
    orgId?: string;
    clinicianId?: string;
  }
): Promise<{ safetyScore: number; privilegeScore: number }> {
  const { prisma, orgId, clinicianId } = options;

  // Calculate safety score
  let safetyScore = 0.8;
  if (clinicianId) {
    const safetySignals = await prisma.privilegeSafetySignal.count({
      where: { clinicianId },
    });
    safetyScore = Math.max(0, 1.0 - safetySignals * 0.1);
  }

  // Calculate privilege score
  const privilegeScore = 0.7; // Can be enhanced with actual privilege data

  const reactor = {
    safetyScore,
    privilegeScore,
    alignment: Math.abs(safetyScore - privilegeScore),
  };

  await prisma.safetyPrivilegeReactor.create({
    data: {
      orgId: orgId || null,
      clinicianId: clinicianId || null,
      reactor,
      safetyScore,
      privilegeScore,
    },
  });

  return { safetyScore, privilegeScore };
}


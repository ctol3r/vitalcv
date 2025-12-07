import { PrismaClient } from '@prisma/client';
import { ChainClient } from '../chain/client';

const prisma = new PrismaClient();
const chainClient = new ChainClient();

export interface GravityNode {
  id: string;
  type: 'role' | 'employer' | 'region' | 'specialty';
  gravity: number;
  metadata: Record<string, unknown>;
}

export interface GravityData {
  nodes: GravityNode[];
  collisions: Array<{ node1: string; node2: string; conflict: string }>;
  shifts: Array<{ node: string; oldGravity: number; newGravity: number; reason: string }>;
  migration: Array<{ from: string; to: string; count: number }>;
}

/**
 * Task 344.2 — Role-level gravity scorer v3
 * Score each role's pull on clinicians.
 */
export async function scoreRoleGravity(roleId: string): Promise<number> {
  // Check job postings for this role
  const jobPostings = await prisma.jobPosting.findMany({
    where: { id: roleId },
  });

  // Check hiring events for this role
  const hiringEvents = await prisma.hiringEvent.findMany({
    where: {
      metadata: { path: ['roleId'], equals: roleId },
    },
  });

  // Calculate gravity based on:
  // - Number of applications
  // - Acceptance rate
  // - Time to fill
  let gravity = 0.5;

  const applicationCount = hiringEvents.filter((e) => e.eventType === 'applied').length;
  gravity += Math.min(0.3, applicationCount / 100);

  const acceptanceRate =
    hiringEvents.filter((e) => e.eventType === 'offerAccepted').length /
    Math.max(1, hiringEvents.filter((e) => e.eventType === 'applied').length);
  gravity += acceptanceRate * 0.2;

  return Math.max(0, Math.min(1, gravity));
}

/**
 * Task 344.3 — Employer gravity scorer
 * Employer attractiveness scoring.
 */
export async function scoreEmployerGravity(orgId: string): Promise<number> {
  // Check hiring success
  const hiringEvents = await prisma.hiringEvent.findMany({
    where: { employerId: orgId },
  });

  // Check onboarding efficiency
  const onboarding = await prisma.onboardingKinetics.findMany({
    where: {
      clinicianId: { in: hiringEvents.map((e) => e.clinicianId) },
    },
  });

  let gravity = 0.5;

  // High acceptance rate = attractive employer
  const acceptanceRate =
    hiringEvents.filter((e) => e.eventType === 'offerAccepted').length /
    Math.max(1, hiringEvents.filter((e) => e.eventType === 'applied').length);
  gravity += acceptanceRate * 0.3;

  // Fast onboarding = attractive
  const avgOnboardingDays =
    onboarding.reduce((sum, o) => sum + o.durationDays, 0) / Math.max(1, onboarding.length);
  if (avgOnboardingDays < 30) {
    gravity += 0.2;
  }

  return Math.max(0, Math.min(1, gravity));
}

/**
 * Task 344.5 — Specialty gravity analysis
 * Which specialties gravitate where.
 */
export async function analyzeSpecialtyGravity(specialty: string): Promise<{
  regions: Array<{ region: string; gravity: number }>;
  employers: Array<{ orgId: string; gravity: number }>;
}> {
  // Get job postings for this specialty
  const jobPostings = await prisma.jobPosting.findMany({
    where: {
      metadata: { path: ['specialty'], equals: specialty },
    },
  });

  // Group by region and employer
  const regionGravity: Record<string, number> = {};
  const employerGravity: Record<string, number> = {};

  for (const job of jobPostings) {
    const region = (job.metadata as any)?.region || 'unknown';
    const orgId = (job.metadata as any)?.orgId || 'unknown';

    regionGravity[region] = (regionGravity[region] || 0) + 1;
    employerGravity[orgId] = (employerGravity[orgId] || 0) + 1;
  }

  return {
    regions: Object.entries(regionGravity)
      .map(([region, count]) => ({ region, gravity: count / 10 }))
      .sort((a, b) => b.gravity - a.gravity),
    employers: Object.entries(employerGravity)
      .map(([orgId, count]) => ({ orgId, gravity: count / 5 }))
      .sort((a, b) => b.gravity - a.gravity),
  };
}

/**
 * Task 344.6 — Gravity collision detector
 * Detect conflicting pulls across roles.
 */
export function detectGravityCollisions(nodes: GravityNode[]): Array<{
  node1: string;
  node2: string;
  conflict: string;
}> {
  const collisions: Array<{ node1: string; node2: string; conflict: string }> = [];

  // Check for roles with similar gravity competing for same clinicians
  const roles = nodes.filter((n) => n.type === 'role');
  for (let i = 0; i < roles.length; i++) {
    for (let j = i + 1; j < roles.length; j++) {
      const role1 = roles[i];
      const role2 = roles[j];
      if (Math.abs(role1.gravity - role2.gravity) < 0.1 && role1.gravity > 0.7) {
        collisions.push({
          node1: role1.id,
          node2: role2.id,
          conflict: 'High gravity roles competing for same talent pool',
        });
      }
    }
  }

  return collisions;
}

/**
 * Task 344.7 — Gravity shift predictor
 * Forecast gravity changes based on market signals.
 */
export function predictGravityShifts(
  nodes: GravityNode[],
  marketSignals: Array<{ type: string; impact: number }>,
): Array<{ node: string; oldGravity: number; newGravity: number; reason: string }> {
  const shifts: Array<{ node: string; oldGravity: number; newGravity: number; reason: string }> = [];

  for (const node of nodes) {
    let newGravity = node.gravity;

    // Apply market signal impacts
    for (const signal of marketSignals) {
      if (signal.type === 'demand_increase' && node.type === 'role') {
        newGravity += signal.impact * 0.1;
      } else if (signal.type === 'supply_decrease' && node.type === 'region') {
        newGravity += signal.impact * 0.15;
      }
    }

    if (Math.abs(newGravity - node.gravity) > 0.05) {
      shifts.push({
        node: node.id,
        oldGravity: node.gravity,
        newGravity: Math.max(0, Math.min(1, newGravity)),
        reason: 'Market signal impact',
      });
    }
  }

  return shifts;
}

/**
 * Task 344.1 — Get or create gravity data
 */
export async function getOrCreateGravityData(): Promise<GravityData> {
  let gravity = await prisma.talentGravity.findFirst({
    orderBy: { updatedAt: 'desc' },
  });

  if (!gravity) {
    // Get roles and employers
    const jobPostings = await prisma.jobPosting.findMany({
      take: 50,
    });

    const nodes: GravityNode[] = [];

    // Score role gravity
    for (const job of jobPostings) {
      const roleGravity = await scoreRoleGravity(job.id);
      nodes.push({
        id: job.id,
        type: 'role',
        gravity: roleGravity,
        metadata: job.metadata as Record<string, unknown>,
      });
    }

    // Score employer gravity
    const orgIds = Array.from(
      new Set(jobPostings.map((j) => (j.metadata as any)?.orgId).filter(Boolean)),
    );
    for (const orgId of orgIds) {
      const employerGravity = await scoreEmployerGravity(orgId);
      nodes.push({
        id: orgId,
        type: 'employer',
        gravity: employerGravity,
        metadata: {},
      });
    }

    const collisions = detectGravityCollisions(nodes);
    const shifts: Array<{ node: string; oldGravity: number; newGravity: number; reason: string }> =
      [];
    const migration: Array<{ from: string; to: string; count: number }> = [];

    // Analyze clinician movement
    const hiringEvents = await prisma.hiringEvent.findMany({
      take: 100,
      orderBy: { createdAt: 'desc' },
    });

    const movement = hiringEvents.reduce((acc, event) => {
      const from = (event.metadata as any)?.previousEmployer || 'unknown';
      const to = event.employerId;
      const key = `${from}-${to}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    for (const [key, count] of Object.entries(movement)) {
      const [from, to] = key.split('-');
      migration.push({ from, to, count });
    }

    const gravityData: GravityData = {
      nodes,
      collisions,
      shifts,
      migration,
    };

    gravity = await prisma.talentGravity.create({
      data: {
        gravity: gravityData,
      },
    });
  }

  return gravity.gravity as GravityData;
}

/**
 * Task 344.9 — Gravity export pack
 * Analytical gravity report.
 */
export function exportGravityPack(gravity: GravityData): {
  format: string;
  data: Record<string, unknown>;
  hash: string;
} {
  const report = {
    nodes: gravity.nodes,
    collisions: gravity.collisions,
    shifts: gravity.shifts,
    migration: gravity.migration,
    exportedAt: new Date().toISOString(),
  };

  const hash = require('crypto')
    .createHash('sha256')
    .update(JSON.stringify(report))
    .digest('hex');

  return {
    format: 'talent_gravity_v1',
    data: report,
    hash: `0x${hash}`,
  };
}

/**
 * Task 344.10 — Anchor gravity snapshot
 */
export async function anchorGravitySnapshot(): Promise<string | null> {
  try {
    const gravity = await prisma.talentGravity.findFirst({
      orderBy: { updatedAt: 'desc' },
    });

    if (!gravity) {
      return null;
    }

    const gravityData = gravity.gravity as GravityData;

    const receipt = await chainClient.submitAuditEvent({
      eventType: 'talentGravityAnchored',
      payload: {
        nodeCount: gravityData.nodes.length,
        collisionCount: gravityData.collisions.length,
        shiftCount: gravityData.shifts.length,
        migrationCount: gravityData.migration.length,
      },
    });

    return receipt.txHash;
  } catch (error) {
    console.error('[gravity] anchor failed', error);
    return null;
  }
}


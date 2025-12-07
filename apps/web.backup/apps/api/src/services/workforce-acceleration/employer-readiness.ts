import { prisma } from '@/lib/prisma';

export interface EmployerReadiness {
  orgId: string;
  ready: boolean;
  score: number;
  blockers: string[];
  readyClinicians: number;
}

/**
 * Detect which hospitals are ready to accept clinicians today
 */
export async function detectEmployerReadiness(orgId: string): Promise<EmployerReadiness> {
  // Check onboarding capacity, credentialing speed, etc.
  const onboardingCheckpoints = await prisma.onboardingCheckpoint.findMany({
    where: {
      // Would filter by orgId if available
    },
    take: 10,
  });

  const blockers: string[] = [];
  let ready = true;
  let score = 1.0;

  // Check for common blockers
  const blockedCheckpoints = onboardingCheckpoints.filter((c) => c.status === 'blocked');
  if (blockedCheckpoints.length > 5) {
    ready = false;
    score -= 0.3;
    blockers.push('High number of blocked onboarding checkpoints');
  }

  // Check credentialing speed
  const avgCheckpointTime = calculateAvgCheckpointTime(onboardingCheckpoints);
  if (avgCheckpointTime > 7) {
    ready = false;
    score -= 0.2;
    blockers.push('Slow credentialing process');
  }

  const readyClinicians = onboardingCheckpoints.filter((c) => c.status === 'completed').length;

  return {
    orgId,
    ready: ready && score > 0.7,
    score,
    blockers,
    readyClinicians,
  };
}

function calculateAvgCheckpointTime(checkpoints: any[]): number {
  // Mock calculation
  return 5; // days
}


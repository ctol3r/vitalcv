import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface GovernancePolicy {
  agentId: string;
  allowedActions: string[];
  escalationRules: Array<{ condition: string; action: string }>;
  hitlOverrides: Array<{ trigger: string; required: boolean }>;
}

/**
 * Get governance policy for agent
 */
export async function getGovernancePolicy(agentId: string): Promise<GovernancePolicy | null> {
  const sentinel = await prisma.aIRiskSentinel.findUnique({
    where: { agentId },
  });

  if (!sentinel) return null;

  const config = sentinel.config as Record<string, unknown>;
  return {
    agentId,
    allowedActions: (config.allowedActions as string[]) || [],
    escalationRules: (config.escalationRules as Array<{ condition: string; action: string }>) || [],
    hitlOverrides: (config.hitlOverrides as Array<{ trigger: string; required: boolean }>) || [],
  };
}

/**
 * Check if action is allowed
 */
export async function isActionAllowed(agentId: string, action: string): Promise<boolean> {
  const policy = await getGovernancePolicy(agentId);
  if (!policy) return false;
  return policy.allowedActions.includes(action) || policy.allowedActions.includes('*');
}


import { PrismaClient } from '@prisma/client';
import { applyRiskTags } from '../services/ai/risk-tags';

const prisma = new PrismaClient();

export interface AIActionLog {
  agentId: string;
  actionType: string;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  riskTags: Array<{ category: string; severity: string; description: string }>;
  timestamp: Date;
}

/**
 * Log AI action
 */
export async function logAIAction(
  agentId: string,
  actionType: string,
  inputs: Record<string, unknown>,
  outputs: Record<string, unknown>,
): Promise<void> {
  const riskTags = applyRiskTags(actionType, inputs, outputs);

  // Store in audit log (would use dedicated AI log table in production)
  const log: AIActionLog = {
    agentId,
    actionType,
    inputs,
    outputs,
    riskTags,
    timestamp: new Date(),
  };

  // Update sentinel config with latest action
  await prisma.aIRiskSentinel.upsert({
    where: { agentId },
    create: {
      agentId,
      config: {
        lastAction: log,
        riskHistory: [log],
      },
    },
    update: {
      config: {
        lastAction: log,
        riskHistory: [
          ...((await prisma.aIRiskSentinel.findUnique({ where: { agentId } }))?.config as any)?.riskHistory || []),
          log,
        ].slice(-100), // Keep last 100
      },
      updatedAt: new Date(),
    },
  });
}


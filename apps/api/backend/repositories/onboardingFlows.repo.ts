import { Prisma } from '@prisma/client';
import prisma from '../src/graphql/prisma_client';
import type { OnboardingFlow, OnboardingStage } from '../src/services/missionOps/onboardingFlows';

export interface OnboardingFlowsRepository {
  listFlows(): Promise<OnboardingFlow[]>;
  upsertFlow(flow: OnboardingFlow): Promise<OnboardingFlow>;
  getFlow(role: OnboardingFlow['role'], entityId: string): Promise<OnboardingFlow | null>;
}

type OnboardingFlowRow = {
  role: string;
  entityId: string;
  entityName: string;
  stages: Prisma.JsonValue;
  overallProgress: number;
  createdAt: Date;
  lastUpdated: Date;
};

function isOnboardingStageArray(value: Prisma.JsonValue): value is Prisma.JsonArray {
  return Array.isArray(value);
}

function toDomainStages(value: Prisma.JsonValue): OnboardingStage[] {
  if (!isOnboardingStageArray(value)) {
    return [];
  }

  return value
    .filter((stage): stage is Prisma.JsonObject => typeof stage === 'object' && stage !== null && !Array.isArray(stage))
    .map((stage) => ({
      id: String(stage.id ?? ''),
      name: String(stage.name ?? ''),
      description: String(stage.description ?? ''),
      status: String(stage.status ?? 'PENDING') as OnboardingStage['status'],
      ...(typeof stage.completedAt === 'string' ? { completedAt: stage.completedAt } : {}),
      ...(typeof stage.blockedReason === 'string' ? { blockedReason: stage.blockedReason } : {}),
    }));
}

function toDomainFlow(row: OnboardingFlowRow): OnboardingFlow {
  return {
    role: row.role as OnboardingFlow['role'],
    entityId: row.entityId,
    entityName: row.entityName,
    stages: toDomainStages(row.stages),
    overallProgress: row.overallProgress,
    createdAt: row.createdAt.toISOString(),
    lastUpdated: row.lastUpdated.toISOString(),
  };
}

function sortFlows(flows: readonly OnboardingFlow[]): OnboardingFlow[] {
  return [...flows].sort(
    (left, right) => new Date(right.lastUpdated).getTime() - new Date(left.lastUpdated).getTime(),
  );
}

function toStagesJson(stages: readonly OnboardingStage[]): Prisma.InputJsonValue {
  return stages.map((stage) => ({
    id: stage.id,
    name: stage.name,
    description: stage.description,
    status: stage.status,
    ...(stage.completedAt ? { completedAt: stage.completedAt } : {}),
    ...(stage.blockedReason ? { blockedReason: stage.blockedReason } : {}),
  }));
}

export class PrismaOnboardingFlowsRepository implements OnboardingFlowsRepository {
  async listFlows(): Promise<OnboardingFlow[]> {
    const rows = await prisma.missionOpsOnboardingFlow.findMany({
      orderBy: { lastUpdated: 'desc' },
    });
    return sortFlows(rows.map((row) => toDomainFlow(row)));
  }

  async upsertFlow(flow: OnboardingFlow): Promise<OnboardingFlow> {
    const row = await prisma.missionOpsOnboardingFlow.upsert({
      where: {
        role_entityId: {
          role: flow.role,
          entityId: flow.entityId,
        },
      },
      update: {
        entityName: flow.entityName,
        stages: toStagesJson(flow.stages),
        overallProgress: flow.overallProgress,
        lastUpdated: new Date(flow.lastUpdated),
      },
      create: {
        role: flow.role,
        entityId: flow.entityId,
        entityName: flow.entityName,
        stages: toStagesJson(flow.stages),
        overallProgress: flow.overallProgress,
        createdAt: new Date(flow.createdAt),
        lastUpdated: new Date(flow.lastUpdated),
      },
    });

    return toDomainFlow(row);
  }

  async getFlow(role: OnboardingFlow['role'], entityId: string): Promise<OnboardingFlow | null> {
    const row = await prisma.missionOpsOnboardingFlow.findUnique({
      where: {
        role_entityId: {
          role,
          entityId,
        },
      },
    });
    return row ? toDomainFlow(row) : null;
  }
}

export class InMemoryOnboardingFlowsRepository implements OnboardingFlowsRepository {
  private readonly flows = new Map<string, OnboardingFlow>();

  constructor(initialFlows: readonly OnboardingFlow[] = []) {
    for (const flow of initialFlows) {
      this.flows.set(this.key(flow.role, flow.entityId), structuredClone(flow));
    }
  }

  async listFlows(): Promise<OnboardingFlow[]> {
    return sortFlows(Array.from(this.flows.values()).map((flow) => structuredClone(flow)));
  }

  async upsertFlow(flow: OnboardingFlow): Promise<OnboardingFlow> {
    const stored = structuredClone(flow);
    this.flows.set(this.key(flow.role, flow.entityId), stored);
    return structuredClone(stored);
  }

  async getFlow(role: OnboardingFlow['role'], entityId: string): Promise<OnboardingFlow | null> {
    const flow = this.flows.get(this.key(role, entityId));
    return flow ? structuredClone(flow) : null;
  }

  private key(role: OnboardingFlow['role'], entityId: string): string {
    return `${role}:${entityId}`;
  }
}

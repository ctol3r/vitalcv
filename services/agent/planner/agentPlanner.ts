import { CredentialAgentTaskType, PrismaClient } from '@prisma/client';
import {
  EvidenceAssessment,
  EvidenceGap,
  EvidenceSeverity,
  evaluateEvidenceCompleteness,
} from '../oracle/evidenceCompleteness.js';
import { getOpenAgentTasks } from '../models/CredentialAgentTask.js';

const prisma = new PrismaClient();

const SEVERITY_WEIGHT: Record<EvidenceSeverity, number> = {
  HIGH: 0,
  MEDIUM: 1,
  LOW: 2,
};

export interface PlannerOptions {
  prismaClient?: PrismaClient;
  deterministic?: boolean;
  existingTaskTypes?: CredentialAgentTaskType[];
}

export interface PlannedCredentialAgentTask {
  taskType: CredentialAgentTaskType;
  priority: number;
  severity: EvidenceSeverity;
  reason: string;
  payload?: Record<string, unknown>;
}

export interface CredentialAgentPlan {
  clinicianId: string;
  orderedTasks: PlannedCredentialAgentTask[];
  assessment: EvidenceAssessment;
}

export async function generateCredentialAgentPlan(
  clinicianId: string,
  options: PlannerOptions = {}
): Promise<CredentialAgentPlan> {
  const client = options.prismaClient ?? prisma;
  const existingTypes =
    options.existingTaskTypes ??
    (await getOpenAgentTasks(clinicianId, { prismaClient: client })).map((task) => task.taskType);
  const existingSet = new Set(existingTypes);

  const assessment = await evaluateEvidenceCompleteness(clinicianId, {
    prismaClient: client,
    deterministicNarrative: options.deterministic ?? false,
  });

  const actionableGaps = Object.values(assessment.results).filter(isActionableGap);
  const planned: PlannedCredentialAgentTask[] = actionableGaps
    .filter((gap) => !existingSet.has(gap.taskType))
    .map((gap) => ({
      taskType: gap.taskType,
      priority: 0,
      severity: gap.severity,
      reason: gap.reason,
      payload: gap.payloadHints ?? undefined,
    }));

  for (const finding of assessment.narrativeFindings) {
    if (existingSet.has(finding.recommendedTask)) {
      continue;
    }
    const alreadyPlanned = planned.some((task) => task.taskType === finding.recommendedTask);
    if (alreadyPlanned) {
      continue;
    }

    planned.push({
      taskType: finding.recommendedTask,
      priority: 0,
      severity: 'MEDIUM',
      reason: finding.description,
      payload: undefined,
    });
  }

  planned.sort((a, b) => {
    const severityDelta = SEVERITY_WEIGHT[a.severity] - SEVERITY_WEIGHT[b.severity];
    if (severityDelta !== 0) {
      return severityDelta;
    }
    return a.taskType.localeCompare(b.taskType);
  });

  planned.forEach((task, index) => {
    task.priority = index + 1;
  });

  return {
    clinicianId,
    orderedTasks: planned,
    assessment,
  };
}

export function isActionableGap(gap: EvidenceGap): boolean {
  return gap.status === 'MISSING' || gap.status === 'STALE' || gap.status === 'FAILED';
}


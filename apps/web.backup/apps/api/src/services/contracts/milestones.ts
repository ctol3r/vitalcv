import type { ContractEscrow, Prisma } from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import { anchorEvent } from '../audit/anchor';

const prisma = new PrismaClient();

export const CONTRACT_MILESTONES = [
  { key: 'credentialVerified', label: 'Credential verified' },
  { key: 'privilegesGranted', label: 'Privileges granted' },
  { key: 'firstShiftCompleted', label: 'First shift completed' },
] as const;

export type ContractMilestone = (typeof CONTRACT_MILESTONES)[number]['key'];

export interface MilestoneState {
  key: ContractMilestone;
  label: string;
  completed: boolean;
  completedAt?: string;
  actor?: string;
  evidence?: string;
}

export interface MarkMilestoneInput {
  contractId: string;
  milestone: ContractMilestone;
  actor: string;
  evidence?: string;
}

export interface MilestoneUpdateResult {
  contract: ContractEscrow;
  milestones: MilestoneState[];
  autoReleased: boolean;
}

export async function markContractMilestone(
  input: MarkMilestoneInput,
  options: { prisma?: PrismaClient } = {},
): Promise<MilestoneUpdateResult> {
  const client = options.prisma ?? prisma;

  const contract = await client.contractEscrow.findUnique({
    where: { id: input.contractId },
  });
  if (!contract) {
    throw new Error(`Contract ${input.contractId} not found`);
  }

  const metadata = normalizeMetadata(contract.metadata);
  const now = new Date().toISOString();
  metadata.milestones[input.milestone] = {
    completed: true,
    completedAt: now,
    actor: input.actor,
    evidence: input.evidence ?? null,
  };

  let statusUpdate: Prisma.ContractEscrowUpdateInput = { metadata };
  let autoReleased = false;

  if (contract.status === 'locked' && areAllMilestonesComplete(metadata)) {
    statusUpdate = {
      ...statusUpdate,
      status: 'released',
    };
    autoReleased = true;
    anchorEvent('contractRelease', {
      contractId: contract.id,
      clinicianId: contract.clinicianId,
      employerId: contract.employerId,
      amount: contract.amount,
      currency: contract.currency,
    });
  }

  const updated = await client.contractEscrow.update({
    where: { id: contract.id },
    data: statusUpdate,
  });

  return {
    contract: updated,
    milestones: buildMilestoneStates(metadata),
    autoReleased,
  };
}

export function buildMilestoneStates(
  metadata: ContractMetadata | null | undefined,
): MilestoneState[] {
  const normalized = normalizeMetadata(metadata);
  return CONTRACT_MILESTONES.map((milestone) => {
    const state = normalized.milestones[milestone.key];
    return {
      key: milestone.key,
      label: milestone.label,
      completed: state?.completed ?? false,
      completedAt: state?.completedAt ?? undefined,
      actor: state?.actor ?? undefined,
      evidence: state?.evidence ?? undefined,
    };
  });
}

interface ContractMetadata {
  milestones: Record<
    ContractMilestone,
    {
      completed: boolean;
      completedAt?: string | null;
      actor?: string | null;
      evidence?: string | null;
    }
  >;
  [key: string]: unknown;
}

function normalizeMetadata(metadata: Prisma.JsonValue | null | undefined): ContractMetadata {
  if (!metadata || typeof metadata !== 'object') {
    return {
      milestones: {} as ContractMetadata['milestones'],
    };
  }
  const value = metadata as ContractMetadata;
  return {
    milestones: value.milestones ?? ({} as ContractMetadata['milestones']),
    ...value,
  };
}

function areAllMilestonesComplete(metadata: ContractMetadata): boolean {
  return CONTRACT_MILESTONES.every((milestone) => metadata.milestones[milestone.key]?.completed);
}












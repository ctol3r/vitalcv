/**
 * B251A-CON-009: ContractSchedule Model
 *
 * Defines milestones: id, contractId (FK), milestoneName, dueDate,
 * status (pending/completed), completedAt (nullable), createdAt;
 * used to track deliverables
 */

import { PrismaClient, MilestoneStatus } from '@prisma/client';

export interface ContractScheduleInput {
  contractId: string;
  milestoneName: string;
  dueDate: Date;
  status?: MilestoneStatus;
}

export interface ContractSchedule {
  id: string;
  contractId: string;
  milestoneName: string;
  dueDate: Date;
  status: MilestoneStatus;
  completedAt: Date | null;
  createdAt: Date;
}

/**
 * Create a new contract schedule milestone
 */
export async function createContractSchedule(
  prisma: PrismaClient,
  input: ContractScheduleInput
): Promise<ContractSchedule> {
  if (!input.milestoneName || input.milestoneName.trim().length === 0) {
    throw new Error('Milestone name cannot be empty');
  }

  // Verify contract exists
  const contract = await prisma.contract.findUnique({
    where: { id: input.contractId },
  });
  if (!contract) {
    throw new Error(`Contract with id "${input.contractId}" not found`);
  }

  return prisma.contractSchedule.create({
    data: {
      contractId: input.contractId,
      milestoneName: input.milestoneName,
      dueDate: input.dueDate,
      status: input.status || MilestoneStatus.PENDING,
    },
  });
}

/**
 * Get contract schedule by ID
 */
export async function getContractSchedule(
  prisma: PrismaClient,
  scheduleId: string
): Promise<ContractSchedule | null> {
  return prisma.contractSchedule.findUnique({
    where: { id: scheduleId },
  });
}

/**
 * List schedule milestones for a contract
 */
export async function listContractSchedules(
  prisma: PrismaClient,
  contractId: string,
  status?: MilestoneStatus
): Promise<ContractSchedule[]> {
  const where: any = { contractId };
  if (status) {
    where.status = status;
  }

  return prisma.contractSchedule.findMany({
    where,
    orderBy: { dueDate: 'asc' },
  });
}

/**
 * Get overdue milestones for a contract
 */
export async function getOverdueMilestones(
  prisma: PrismaClient,
  contractId: string
): Promise<ContractSchedule[]> {
  const now = new Date();
  return prisma.contractSchedule.findMany({
    where: {
      contractId,
      status: MilestoneStatus.PENDING,
      dueDate: { lt: now },
    },
    orderBy: { dueDate: 'asc' },
  });
}

/**
 * Mark milestone as completed
 */
export async function completeMilestone(
  prisma: PrismaClient,
  scheduleId: string
): Promise<ContractSchedule> {
  return prisma.contractSchedule.update({
    where: { id: scheduleId },
    data: {
      status: MilestoneStatus.COMPLETED,
      completedAt: new Date(),
    },
  });
}

/**
 * Update contract schedule milestone
 */
export async function updateContractSchedule(
  prisma: PrismaClient,
  scheduleId: string,
  updates: Partial<Pick<ContractScheduleInput, 'milestoneName' | 'dueDate' | 'status'>>
): Promise<ContractSchedule> {
  if (updates.milestoneName && updates.milestoneName.trim().length === 0) {
    throw new Error('Milestone name cannot be empty');
  }

  const data: any = {
    ...(updates.milestoneName && { milestoneName: updates.milestoneName }),
    ...(updates.dueDate && { dueDate: updates.dueDate }),
  };

  if (updates.status) {
    data.status = updates.status;
    if (updates.status === MilestoneStatus.COMPLETED) {
      data.completedAt = new Date();
    } else if (updates.status === MilestoneStatus.PENDING) {
      data.completedAt = null;
    }
  }

  return prisma.contractSchedule.update({
    where: { id: scheduleId },
    data,
  });
}

/**
 * Delete contract schedule milestone
 */
export async function deleteContractSchedule(
  prisma: PrismaClient,
  scheduleId: string
): Promise<void> {
  await prisma.contractSchedule.delete({
    where: { id: scheduleId },
  });
}


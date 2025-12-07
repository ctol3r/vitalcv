/**
 * B251A-CON-007: ContractAuditLog Model
 *
 * Tracks contract events: id, contractId (FK), eventType (created/signed/revised/terminated),
 * userId, timestamp, details (JSON)
 */

import { PrismaClient, ContractEventType } from '@prisma/client';

export interface ContractAuditLogInput {
  contractId: string;
  eventType: ContractEventType;
  userId?: string;
  details?: any; // JSON object with additional event details
}

export interface ContractAuditLog {
  id: string;
  contractId: string;
  eventType: ContractEventType;
  userId: string | null;
  timestamp: Date;
  details: any | null;
}

/**
 * Create a new audit log entry
 */
export async function createContractAuditLog(
  prisma: PrismaClient,
  input: ContractAuditLogInput
): Promise<ContractAuditLog> {
  // Verify contract exists
  const contract = await prisma.contract.findUnique({
    where: { id: input.contractId },
  });
  if (!contract) {
    throw new Error(`Contract with id "${input.contractId}" not found`);
  }

  return prisma.contractAuditLog.create({
    data: {
      contractId: input.contractId,
      eventType: input.eventType,
      userId: input.userId || null,
      details: input.details ? JSON.parse(JSON.stringify(input.details)) : null,
    },
  });
}

/**
 * Get audit log by ID
 */
export async function getContractAuditLog(
  prisma: PrismaClient,
  logId: string
): Promise<ContractAuditLog | null> {
  return prisma.contractAuditLog.findUnique({
    where: { id: logId },
  });
}

/**
 * List audit logs for a contract
 */
export async function listContractAuditLogs(
  prisma: PrismaClient,
  contractId: string,
  options?: {
    eventType?: ContractEventType;
    userId?: string;
    limit?: number;
  }
): Promise<ContractAuditLog[]> {
  const where: any = { contractId };

  if (options?.eventType) {
    where.eventType = options.eventType;
  }
  if (options?.userId) {
    where.userId = options.userId;
  }

  const query: any = {
    where,
    orderBy: { timestamp: 'desc' },
  };

  if (options?.limit) {
    query.take = options.limit;
  }

  return prisma.contractAuditLog.findMany(query);
}

/**
 * Get audit logs by event type
 */
export async function getAuditLogsByEventType(
  prisma: PrismaClient,
  eventType: ContractEventType,
  limit?: number
): Promise<ContractAuditLog[]> {
  const query: any = {
    where: { eventType },
    orderBy: { timestamp: 'desc' },
  };

  if (limit) {
    query.take = limit;
  }

  return prisma.contractAuditLog.findMany(query);
}


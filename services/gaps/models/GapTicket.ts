/**
 * S72-POST-3B-001: GapTicket Model
 *
 * Model for tracking gaps/technical debt in the codebase.
 * Supports tracking gaps by area, severity, and status.
 */

import { PrismaClient, GapTicketStatus, GapTicketSeverity } from '@prisma/client';

export type GapTicketArea =
  | 'identity'
  | 'psv'
  | 'privileging'
  | 'jobs'
  | 'payer'
  | 'ehr'
  | 'governance';

export interface GapTicketInput {
  area: GapTicketArea;
  severity: GapTicketSeverity;
  description: string;
  status?: GapTicketStatus;
  filePath?: string;
  lineNumber?: number;
}

export interface GapTicket {
  id: string;
  area: string;
  severity: GapTicketSeverity;
  description: string;
  status: GapTicketStatus;
  filePath: string | null;
  lineNumber: number | null;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
}

/**
 * Validate that area is one of the allowed values
 */
export function validateArea(area: string): area is GapTicketArea {
  const validAreas: GapTicketArea[] = [
    'identity',
    'psv',
    'privileging',
    'jobs',
    'payer',
    'ehr',
    'governance',
  ];
  return validAreas.includes(area as GapTicketArea);
}

/**
 * Create a new GapTicket
 */
export async function createGapTicket(
  prisma: PrismaClient,
  input: GapTicketInput
): Promise<GapTicket> {
  if (!validateArea(input.area)) {
    throw new Error(`Invalid area: ${input.area}. Must be one of: identity, psv, privileging, jobs, payer, ehr, governance`);
  }

  return prisma.gapTicket.create({
    data: {
      area: input.area,
      severity: input.severity,
      description: input.description,
      status: input.status || 'OPEN',
      filePath: input.filePath ?? null,
      lineNumber: input.lineNumber ?? null,
    },
  });
}

/**
 * Get a GapTicket by ID
 */
export async function getGapTicket(
  prisma: PrismaClient,
  id: string
): Promise<GapTicket | null> {
  return prisma.gapTicket.findUnique({
    where: { id },
  });
}

/**
 * Update GapTicket status
 */
export async function updateGapTicketStatus(
  prisma: PrismaClient,
  id: string,
  status: GapTicketStatus
): Promise<GapTicket> {
  const updateData: any = {
    status,
    updatedAt: new Date(),
  };

  // Set resolvedAt when status changes to RESOLVED
  if (status === 'RESOLVED') {
    updateData.resolvedAt = new Date();
  } else {
    // Clear resolvedAt if status changes away from RESOLVED
    updateData.resolvedAt = null;
  }

  return prisma.gapTicket.update({
    where: { id },
    data: updateData,
  });
}

/**
 * List GapTickets with optional filtering
 */
export async function listGapTickets(
  prisma: PrismaClient,
  options?: {
    status?: GapTicketStatus;
    area?: GapTicketArea;
    severity?: GapTicketSeverity;
  }
): Promise<GapTicket[]> {
  const where: any = {};

  if (options?.status) {
    where.status = options.status;
  }

  if (options?.area) {
    if (!validateArea(options.area)) {
      throw new Error(`Invalid area: ${options.area}`);
    }
    where.area = options.area;
  }

  if (options?.severity) {
    where.severity = options.severity;
  }

  return prisma.gapTicket.findMany({
    where,
    orderBy: [
      { severity: 'desc' }, // CRITICAL first
      { createdAt: 'desc' }, // Newest first
    ],
  });
}

/**
 * Group GapTickets by area
 */
export async function listGapTicketsGroupedByArea(
  prisma: PrismaClient,
  options?: {
    status?: GapTicketStatus;
  }
): Promise<Record<string, GapTicket[]>> {
  const tickets = await listGapTickets(prisma, options);

  const grouped: Record<string, GapTicket[]> = {};

  for (const ticket of tickets) {
    if (!grouped[ticket.area]) {
      grouped[ticket.area] = [];
    }
    grouped[ticket.area].push(ticket);
  }

  return grouped;
}


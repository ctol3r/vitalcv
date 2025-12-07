/**
 * Incident Model
 * B245B-OBS-015: Defines incidents created by alerting or manually
 */

import { PrismaClient, Incident as PrismaIncident, IncidentStatus } from '@prisma/client';

export interface IncidentCreateInput {
  alertRuleId?: string;
  startTime?: Date;
  status?: IncidentStatus;
  notes?: string;
  assignedTo?: string;
}

export interface IncidentUpdateInput {
  endTime?: Date;
  status?: IncidentStatus;
  notes?: string;
  assignedTo?: string;
}

export interface IncidentWithAlertRule extends PrismaIncident {
  alertRule?: {
    id: string;
    name: string;
    metricName: string;
    threshold: number;
  } | null;
}

export class IncidentModel {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new incident
   */
  async create(data: IncidentCreateInput): Promise<PrismaIncident> {
    return this.prisma.incident.create({
      data: {
        alertRuleId: data.alertRuleId,
        startTime: data.startTime ?? new Date(),
        status: data.status ?? 'OPEN',
        notes: data.notes,
        assignedTo: data.assignedTo,
      },
    });
  }

  /**
   * Get incident by ID
   */
  async findById(id: string): Promise<IncidentWithAlertRule | null> {
    return this.prisma.incident.findUnique({
      where: { id },
      include: {
        alertRule: {
          select: {
            id: true,
            name: true,
            metricName: true,
            threshold: true,
          },
        },
      },
    });
  }

  /**
   * List incidents with optional filters
   */
  async list(filters?: {
    status?: IncidentStatus;
    alertRuleId?: string;
    assignedTo?: string;
    startTimeFrom?: Date;
    startTimeTo?: Date;
  }): Promise<IncidentWithAlertRule[]> {
    return this.prisma.incident.findMany({
      where: {
        ...(filters?.status && { status: filters.status }),
        ...(filters?.alertRuleId && { alertRuleId: filters.alertRuleId }),
        ...(filters?.assignedTo && { assignedTo: filters.assignedTo }),
        ...(filters?.startTimeFrom &&
          filters?.startTimeTo && {
            startTime: {
              gte: filters.startTimeFrom,
              lte: filters.startTimeTo,
            },
          }),
        ...(filters?.startTimeFrom &&
          !filters?.startTimeTo && {
            startTime: {
              gte: filters.startTimeFrom,
            },
          }),
        ...(filters?.startTimeTo &&
          !filters?.startTimeFrom && {
            startTime: {
              lte: filters.startTimeTo,
            },
          }),
      },
      include: {
        alertRule: {
          select: {
            id: true,
            name: true,
            metricName: true,
            threshold: true,
          },
        },
      },
      orderBy: { startTime: 'desc' },
    });
  }

  /**
   * Get open incidents
   */
  async findOpen(): Promise<IncidentWithAlertRule[]> {
    return this.list({ status: 'OPEN' });
  }

  /**
   * Get incidents for a specific alert rule
   */
  async findByAlertRule(alertRuleId: string): Promise<IncidentWithAlertRule[]> {
    return this.list({ alertRuleId });
  }

  /**
   * Update incident
   */
  async update(id: string, data: IncidentUpdateInput): Promise<PrismaIncident> {
    return this.prisma.incident.update({
      where: { id },
      data: {
        ...(data.endTime !== undefined && { endTime: data.endTime }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.assignedTo !== undefined && { assignedTo: data.assignedTo }),
      },
    });
  }

  /**
   * Close an incident
   */
  async close(id: string, notes?: string): Promise<PrismaIncident> {
    return this.update(id, {
      status: 'CLOSED',
      endTime: new Date(),
      notes,
    });
  }

  /**
   * Get incidents assigned to a user
   */
  async findByAssignee(userId: string): Promise<IncidentWithAlertRule[]> {
    return this.list({ assignedTo: userId });
  }
}


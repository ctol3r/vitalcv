/**
 * IncidentService
 * B245B-OBS-015: Manages incidents created by alerting or manually
 */

import { PrismaClient, IncidentStatus } from '@prisma/client';
import { IncidentModel } from '../models/Incident';

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

/**
 * Service for managing incidents
 */
export class IncidentService {
  private incidentModel: IncidentModel;

  constructor(private prisma: PrismaClient) {
    this.incidentModel = new IncidentModel(prisma);
  }

  /**
   * Create a new incident
   */
  async create(data: IncidentCreateInput) {
    return this.incidentModel.create(data);
  }

  /**
   * Get incident by ID
   */
  async findById(id: string) {
    return this.incidentModel.findById(id);
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
  }) {
    return this.incidentModel.list(filters);
  }

  /**
   * Get open incidents
   */
  async findOpen() {
    return this.incidentModel.findOpen();
  }

  /**
   * Get incidents for a specific alert rule
   */
  async findByAlertRule(alertRuleId: string) {
    return this.incidentModel.findByAlertRule(alertRuleId);
  }

  /**
   * Update incident
   */
  async update(id: string, data: IncidentUpdateInput) {
    return this.incidentModel.update(id, data);
  }

  /**
   * Close an incident
   */
  async close(id: string, notes?: string) {
    return this.incidentModel.close(id, notes);
  }

  /**
   * Assign incident to a user
   */
  async assign(id: string, userId: string) {
    return this.incidentModel.update(id, { assignedTo: userId });
  }

  /**
   * Add note to incident
   */
  async addNote(id: string, note: string) {
    const incident = await this.incidentModel.findById(id);
    if (!incident) {
      throw new Error('Incident not found');
    }

    const updatedNotes = incident.notes
      ? `${incident.notes}\n[${new Date().toISOString()}] ${note}`
      : `[${new Date().toISOString()}] ${note}`;

    return this.incidentModel.update(id, { notes: updatedNotes });
  }

  /**
   * Get incidents assigned to a user
   */
  async findByAssignee(userId: string) {
    return this.incidentModel.findByAssignee(userId);
  }
}


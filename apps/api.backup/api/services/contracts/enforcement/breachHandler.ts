/**
 * B231B-CON-009: ContractBreachHandler
 *
 * Handles contract breach events: logs incident, notifies parties,
 * suspends services if necessary, and triggers legal follow-up workflows.
 */

import { PrismaClient } from '@prisma/client';
import { ComplianceResult, Violation } from '../enforcementEngine';
import { SLABreachEvent } from '../sla/serviceLevelMonitor';

export type BreachSeverity = 'low' | 'medium' | 'high' | 'critical';

export type BreachType = 'compliance' | 'sla' | 'financial' | 'data_sharing' | 'usage_limit';

export interface BreachIncident {
  id: string;
  contractId: string;
  breachType: BreachType;
  severity: BreachSeverity;
  description: string;
  violations: Violation[];
  slaBreaches?: SLABreachEvent[];
  occurredAt: Date;
  detectedAt: Date;
  status: 'detected' | 'investigating' | 'resolved' | 'escalated';
  actionsTaken: string[];
  notificationsSent: string[];
  serviceSuspended: boolean;
  legalWorkflowTriggered: boolean;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationRecipient {
  orgId: string;
  email?: string;
  role: 'contract_owner' | 'counterparty' | 'legal' | 'admin';
}

export interface ServiceSuspension {
  contractId: string;
  serviceType: string;
  suspended: boolean;
  suspendedAt?: Date;
  reason: string;
}

/**
 * ContractBreachHandler - Handles contract breach events
 */
export class ContractBreachHandler {
  constructor(private prisma: PrismaClient) {}

  /**
   * Handle compliance breach from ContractEnforcementEngine
   */
  async handleComplianceBreach(
    contractId: string,
    complianceResult: ComplianceResult
  ): Promise<BreachIncident> {
    if (complianceResult.status !== 'breach') {
      throw new Error('Compliance result is not a breach');
    }

    const incident = await this.createBreachIncident({
      contractId,
      breachType: 'compliance',
      severity: this.determineSeverity(complianceResult.violations),
      description: `Compliance breach detected: ${complianceResult.violations.length} violation(s)`,
      violations: complianceResult.violations,
      occurredAt: complianceResult.evaluatedAt,
    });

    await this.processBreachIncident(incident);

    return incident;
  }

  /**
   * Handle SLA breach from ServiceLevelMonitor
   */
  async handleSLABreach(
    contractId: string,
    slaBreaches: SLABreachEvent[]
  ): Promise<BreachIncident> {
    if (slaBreaches.length === 0) {
      throw new Error('No SLA breaches provided');
    }

    const severity = this.determineSLASeverity(slaBreaches);
    const incident = await this.createBreachIncident({
      contractId,
      breachType: 'sla',
      severity,
      description: `SLA breach detected: ${slaBreaches.length} breach(es)`,
      slaBreaches,
      occurredAt: slaBreaches[0].occurredAt,
    });

    await this.processBreachIncident(incident);

    return incident;
  }

  /**
   * Create breach incident record
   */
  private async createBreachIncident(data: {
    contractId: string;
    breachType: BreachType;
    severity: BreachSeverity;
    description: string;
    violations?: Violation[];
    slaBreaches?: SLABreachEvent[];
    occurredAt: Date;
  }): Promise<BreachIncident> {
    const contract = await this.prisma.partnerContract.findUnique({
      where: { id: data.contractId },
    });

    if (!contract) {
      throw new Error(`Contract ${data.contractId} not found`);
    }

    const incidentId = `breach_${data.contractId}_${Date.now()}`;

    // In production, this would create a record in ContractBreachIncident table
    // For now, we'll create a structured object
    const incident: BreachIncident = {
      id: incidentId,
      contractId: data.contractId,
      breachType: data.breachType,
      severity: data.severity,
      description: data.description,
      violations: data.violations || [],
      slaBreaches: data.slaBreaches,
      occurredAt: data.occurredAt,
      detectedAt: new Date(),
      status: 'detected',
      actionsTaken: [],
      notificationsSent: [],
      serviceSuspended: false,
      legalWorkflowTriggered: false,
      metadata: {
        contractOrgId: contract.orgId,
        counterpartyId: contract.counterpartyId,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Log incident
    await this.logIncident(incident);

    return incident;
  }

  /**
   * Process breach incident - take actions based on severity
   */
  private async processBreachIncident(incident: BreachIncident): Promise<void> {
    // Log incident
    incident.actionsTaken.push('incident_logged');

    // Send notifications
    await this.notifyParties(incident);
    incident.actionsTaken.push('notifications_sent');

    // Suspend services if critical
    if (incident.severity === 'critical' || incident.severity === 'high') {
      await this.suspendServices(incident);
      incident.serviceSuspended = true;
      incident.actionsTaken.push('services_suspended');
    }

    // Trigger legal workflow if needed
    if (incident.severity === 'critical') {
      await this.triggerLegalWorkflow(incident);
      incident.legalWorkflowTriggered = true;
      incident.actionsTaken.push('legal_workflow_triggered');
    }

    // Update incident status
    incident.status = incident.serviceSuspended ? 'investigating' : 'detected';
    incident.updatedAt = new Date();

    // Save updated incident (would update database in production)
    await this.updateIncident(incident);
  }

  /**
   * Log incident to audit log
   */
  private async logIncident(incident: BreachIncident): Promise<void> {
    // Log to contract audit log
    // In production, this would integrate with ContractAuditLog service
    console.log('[ContractBreachHandler] Breach incident logged:', {
      id: incident.id,
      contractId: incident.contractId,
      breachType: incident.breachType,
      severity: incident.severity,
      detectedAt: incident.detectedAt,
    });

    // TODO: Integrate with ContractAuditLog service
    // const auditLog = new ContractAuditLog(this.prisma);
    // await auditLog.recordAction({
    //   contractId: incident.contractId,
    //   action: 'breach_detected',
    //   details: incident,
    // });
  }

  /**
   * Notify parties about breach
   */
  private async notifyParties(incident: BreachIncident): Promise<void> {
    const contract = await this.prisma.partnerContract.findUnique({
      where: { id: incident.contractId },
    });

    if (!contract) {
      return;
    }

    const recipients: NotificationRecipient[] = [
      {
        orgId: contract.orgId,
        role: 'contract_owner',
      },
      {
        orgId: contract.counterpartyId,
        role: 'counterparty',
      },
    ];

    // Add legal team if severity is high or critical
    if (incident.severity === 'high' || incident.severity === 'critical') {
      recipients.push({
        orgId: 'legal_team',
        role: 'legal',
      });
    }

    // Send notifications
    for (const recipient of recipients) {
      await this.sendNotification(incident, recipient);
      incident.notificationsSent.push(`${recipient.orgId}_${recipient.role}`);
    }
  }

  /**
   * Send notification to recipient
   */
  private async sendNotification(
    incident: BreachIncident,
    recipient: NotificationRecipient
  ): Promise<void> {
    // In production, this would integrate with notification service
    console.log('[ContractBreachHandler] Sending notification:', {
      recipient: recipient.orgId,
      role: recipient.role,
      incidentId: incident.id,
      severity: incident.severity,
    });

    // TODO: Integrate with notification service
    // const notificationService = new NotificationService();
    // await notificationService.send({
    //   to: recipient.email || recipient.orgId,
    //   subject: `Contract Breach Alert: ${incident.contractId}`,
    //   template: 'contract_breach',
    //   data: {
    //     incident,
    //     recipientRole: recipient.role,
    //   },
    // });
  }

  /**
   * Suspend services for contract
   */
  private async suspendServices(incident: BreachIncident): Promise<void> {
    // In production, this would integrate with service management system
    console.log('[ContractBreachHandler] Suspending services:', {
      contractId: incident.contractId,
      reason: incident.description,
    });

    // TODO: Integrate with service suspension API
    // const serviceManager = new ServiceManager();
    // await serviceManager.suspendContractServices(incident.contractId, {
    //   reason: incident.description,
    //   severity: incident.severity,
    // });
  }

  /**
   * Trigger legal workflow
   */
  private async triggerLegalWorkflow(incident: BreachIncident): Promise<void> {
    // In production, this would trigger legal workflow system
    console.log('[ContractBreachHandler] Triggering legal workflow:', {
      contractId: incident.contractId,
      incidentId: incident.id,
    });

    // TODO: Integrate with legal workflow system
    // const legalWorkflow = new LegalWorkflowService();
    // await legalWorkflow.createCase({
    //   contractId: incident.contractId,
    //   incidentId: incident.id,
    //   severity: incident.severity,
    //   description: incident.description,
    // });
  }

  /**
   * Update incident record
   */
  private async updateIncident(incident: BreachIncident): Promise<void> {
    // In production, this would update database record
    // For now, just log
    console.log('[ContractBreachHandler] Updating incident:', {
      id: incident.id,
      status: incident.status,
      actionsTaken: incident.actionsTaken,
    });

    // TODO: Update database record
    // await this.prisma.contractBreachIncident.update({
    //   where: { id: incident.id },
    //   data: {
    //     status: incident.status,
    //     actionsTaken: incident.actionsTaken,
    //     serviceSuspended: incident.serviceSuspended,
    //     legalWorkflowTriggered: incident.legalWorkflowTriggered,
    //     updatedAt: new Date(),
    //   },
    // });
  }

  /**
   * Determine severity from violations
   */
  private determineSeverity(violations: Violation[]): BreachSeverity {
    if (violations.some((v) => v.severity === 'critical')) {
      return 'critical';
    }
    if (violations.some((v) => v.severity === 'high')) {
      return 'high';
    }
    if (violations.some((v) => v.severity === 'medium')) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Determine severity from SLA breaches
   */
  private determineSLASeverity(breaches: SLABreachEvent[]): BreachSeverity {
    if (breaches.some((b) => b.severity === 'critical')) {
      return 'critical';
    }
    if (breaches.some((b) => b.severity === 'high')) {
      return 'high';
    }
    if (breaches.some((b) => b.severity === 'medium')) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Resolve breach incident
   */
  async resolveIncident(incidentId: string, resolution: string): Promise<BreachIncident> {
    // In production, this would update the incident record
    console.log('[ContractBreachHandler] Resolving incident:', {
      incidentId,
      resolution,
    });

    // TODO: Update database record
    // const incident = await this.prisma.contractBreachIncident.update({
    //   where: { id: incidentId },
    //   data: {
    //     status: 'resolved',
    //     resolution,
    //     resolvedAt: new Date(),
    //     updatedAt: new Date(),
    //   },
    // });

    // Return mock incident for now
    return {} as BreachIncident;
  }

  /**
   * Get breach incidents for a contract
   */
  async getContractIncidents(
    contractId: string,
    filters?: {
      breachType?: BreachType;
      severity?: BreachSeverity;
      status?: string;
    }
  ): Promise<BreachIncident[]> {
    // In production, this would query database
    // For now, return empty array
    return [];

    // TODO: Query database
    // return await this.prisma.contractBreachIncident.findMany({
    //   where: {
    //     contractId,
    //     ...(filters?.breachType && { breachType: filters.breachType }),
    //     ...(filters?.severity && { severity: filters.severity }),
    //     ...(filters?.status && { status: filters.status }),
    //   },
    //   orderBy: { detectedAt: 'desc' },
    // });
  }
}


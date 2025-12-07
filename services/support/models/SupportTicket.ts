/**
 * SupportTicket Model
 *
 * Tracks support tickets raised by organizations and users
 * with categorization, severity levels, and status tracking.
 */

export enum TicketStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED'
}

export enum TicketSeverity {
  SEV1 = 'SEV1', // Critical - System down, major business impact
  SEV2 = 'SEV2', // High - Significant feature unavailable
  SEV3 = 'SEV3', // Medium - Minor feature issue or workaround available
  SEV4 = 'SEV4'  // Low - Enhancement request or cosmetic issue
}

export enum TicketCategory {
  TECHNICAL = 'TECHNICAL',
  BILLING = 'BILLING',
  ACCESS = 'ACCESS',
  DATA = 'DATA',
  COMPLIANCE = 'COMPLIANCE',
  FEATURE_REQUEST = 'FEATURE_REQUEST',
  INTEGRATION = 'INTEGRATION',
  OTHER = 'OTHER'
}

export interface SupportTicket {
  id: string;
  orgId: string;
  userId: string;

  // Ticket details
  category: TicketCategory;
  severity: TicketSeverity;
  status: TicketStatus;

  // Content
  title: string;
  description: string;

  // Assignment
  assignedTo?: string; // Support team member ID

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  closedAt?: Date;

  // Audit trail
  statusHistory: TicketStatusChange[];

  // Related resources
  relatedIncidentId?: string;
  attachments?: TicketAttachment[];

  // SLA tracking
  slaDeadline?: Date;
  firstResponseAt?: Date;
}

export interface TicketStatusChange {
  fromStatus: TicketStatus;
  toStatus: TicketStatus;
  changedBy: string;
  changedAt: Date;
  notes?: string;
}

export interface TicketAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  uploadedAt: Date;
  url: string;
}

/**
 * Severity Level Documentation
 *
 * SEV1 (Critical):
 * - Platform is completely unavailable
 * - Data loss or corruption affecting multiple orgs
 * - Security breach or vulnerability actively exploited
 * - SLA: 15 minutes first response, 4 hours resolution target
 *
 * SEV2 (High):
 * - Major feature unavailable (credential issuance, verification)
 * - Performance degradation affecting multiple users
 * - Single org experiencing critical issues
 * - SLA: 1 hour first response, 24 hours resolution target
 *
 * SEV3 (Medium):
 * - Minor feature not working as expected
 * - Workaround available
 * - Single user affected
 * - SLA: 4 hours first response, 5 business days resolution target
 *
 * SEV4 (Low):
 * - Cosmetic issues
 * - Enhancement requests
 * - Documentation updates
 * - SLA: 1 business day first response, best effort resolution
 */

export interface SLAConfig {
  severity: TicketSeverity;
  firstResponseMinutes: number;
  resolutionTargetHours: number;
}

export const DEFAULT_SLA_CONFIG: Record<TicketSeverity, SLAConfig> = {
  [TicketSeverity.SEV1]: {
    severity: TicketSeverity.SEV1,
    firstResponseMinutes: 15,
    resolutionTargetHours: 4
  },
  [TicketSeverity.SEV2]: {
    severity: TicketSeverity.SEV2,
    firstResponseMinutes: 60,
    resolutionTargetHours: 24
  },
  [TicketSeverity.SEV3]: {
    severity: TicketSeverity.SEV3,
    firstResponseMinutes: 240,
    resolutionTargetHours: 120 // 5 business days
  },
  [TicketSeverity.SEV4]: {
    severity: TicketSeverity.SEV4,
    firstResponseMinutes: 1440, // 1 business day
    resolutionTargetHours: 0 // Best effort
  }
};

/**
 * Calculate SLA deadline based on ticket creation time and severity
 */
export function calculateSLADeadline(createdAt: Date, severity: TicketSeverity): Date {
  const config = DEFAULT_SLA_CONFIG[severity];
  const deadline = new Date(createdAt);
  deadline.setMinutes(deadline.getMinutes() + config.firstResponseMinutes);
  return deadline;
}

/**
 * Check if ticket is breaching SLA
 */
export function isBreachingSLA(ticket: SupportTicket): boolean {
  if (!ticket.slaDeadline) return false;
  if (ticket.firstResponseAt) return false; // SLA met if first response provided
  return new Date() > ticket.slaDeadline;
}


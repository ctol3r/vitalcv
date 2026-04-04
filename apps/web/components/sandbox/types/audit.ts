/**
 * VitalCV Audit Trail Types
 * Secure, immutable event logging for employer decisions.
 */

export enum DecisionType {
  ACCEPT = "ACCEPT",
  REFRESH = "REFRESH",
  MANUAL_REVIEW = "MANUAL_REVIEW",
  AUDIT_PACKET_SHARED = "AUDIT_PACKET_SHARED",
}

export interface EmployerDecisionEvent {
  auditId: string;
  npi: string;
  employerId: string;
  decision: DecisionType;
  timestamp: string;
  packetHash: string;
  shareUrl?: string;
}

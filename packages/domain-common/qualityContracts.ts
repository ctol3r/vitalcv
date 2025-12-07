/**
 * B196B-CONTRACT-010
 * Quality contracts for OPPE, FPPE, and procedure event sharing.
 */

type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject {
  [key: string]: JsonValue;
}

export const OPPE_CASE_STATUS_VALUES = ['OPEN', 'REVIEWING', 'COMPLETED', 'FAILED'] as const;
export type OPPECaseStatus = (typeof OPPE_CASE_STATUS_VALUES)[number];

export interface OPPECaseMetrics {
  caseCount: number;
  complications: number;
  issuesFlagged: number;
  licenseIssues: number;
  boardAlerts: number;
  deaFindings: number;
  lastEventAt?: string;
}

export interface OPPECaseRecord {
  id: string;
  clinicianId: string;
  orgId: string;
  privilegeCode: string;
  scheduleId: string;
  privilegeGrantedId?: string | null;
  periodStart: string;
  periodEnd: string;
  status: OPPECaseStatus;
  metrics: OPPECaseMetrics;
  reviewerId?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export const FPPE_STATUS_VALUES = ['OPEN', 'COMPLETED', 'CANCELLED'] as const;
export type FPPEStatus = (typeof FPPE_STATUS_VALUES)[number];

export interface FPPERecord {
  id: string;
  privilegeGrantedId: string;
  startAt: string;
  endAt?: string | null;
  status: FPPEStatus;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export const PROCEDURE_EVENT_SEVERITIES = ['info', 'warning', 'critical'] as const;
export type ProcedureEventSeverity = (typeof PROCEDURE_EVENT_SEVERITIES)[number];

export interface ProcedureEvent {
  id: string;
  clinicianId: string;
  privilegeCode?: string;
  occurredAt: string;
  severity: ProcedureEventSeverity;
  summary: string;
  details?: string;
  facility?: string;
  metric?: string;
  metadata?: JsonObject;
}



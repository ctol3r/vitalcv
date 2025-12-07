import type { EhrSynchronizationStatusType } from '../models/EHRSynchronization.js';

export interface EhrPrivilegeAssignmentRequest {
  clinicianId: string;
  privilegeCode: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}

export interface EhrPrivilegeAssignmentResult {
  success: boolean;
  status: EhrSynchronizationStatusType;
  message?: string;
  rawResponse: Record<string, unknown>;
  error?: string;
}

export interface EhrAdapter {
  assignPrivilege(request: EhrPrivilegeAssignmentRequest): Promise<EhrPrivilegeAssignmentResult>;
}

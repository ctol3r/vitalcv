/**
 * B135A-PRIV-001: PrivilegeRenewal Model
 * TypeScript types for privilege renewal tracking
 */

export enum RenewalStatus {
  PENDING = 'PENDING',
  COMPLETE = 'COMPLETE',
  OVERDUE = 'OVERDUE'
}

export interface PrivilegeRenewalData {
  id: string;
  privilegeGrantedId: string;
  dueDate: Date;
  status: RenewalStatus;
  lastNotifiedAt?: Date;
  notificationsSent: number;
  renewalCriteriaMet?: boolean;
  renewalCriteriaDetails?: any;
  reviewerDid?: string;
  reviewNotes?: string;
  completedAt?: Date;
  nextRenewalId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateRenewalParams {
  privilegeGrantedId: string;
  dueDate: Date;
}

export interface UpdateRenewalParams {
  status?: RenewalStatus;
  lastNotifiedAt?: Date;
  notificationsSent?: number;
  renewalCriteriaMet?: boolean;
  renewalCriteriaDetails?: any;
  reviewerDid?: string;
  reviewNotes?: string;
  completedAt?: Date;
}


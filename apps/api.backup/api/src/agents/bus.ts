import { EventEmitter } from 'events';

export const bus = new EventEmitter();

export type DomainEvent =
  | { type: 'CLAIM_START'; npi: string }
  | { type: 'CLAIM_VERIFY_PIN'; npi: string }
  | { type: 'CLAIM_DOC_UPLOAD'; npi: string }
  | { type: 'ATTEST_REQUESTED'; npi: string }
  | { type: 'ATTEST_APPROVE'; npi: string }
  | { type: 'NPLOOKUP_VIEW'; npi: string }
  | { type: 'OPPORTUNITY_CREATED'; opportunityId: string; partnerId: string; assignedTo?: string }
  | { type: 'OPPORTUNITY_STATUS_CHANGED'; opportunityId: string; partnerId: string; oldStatus: string; newStatus: string }
  | { type: 'OPPORTUNITY_ASSIGNED'; opportunityId: string; partnerId: string; assignedTo: string }
  | { type: 'PROPOSAL_SUBMITTED'; proposalId: string; opportunityId: string }
  | { type: 'PROPOSAL_DECISION'; proposalId: string; opportunityId: string; status: string }
  | { type: 'CAMPAIGN_STARTED'; campaignId: string; partnerId: string }
  | { type: 'TASK_CREATED'; taskId: string; partnerId: string; assignedTo?: string }
  | { type: 'TASK_STATUS_CHANGED'; taskId: string; partnerId: string; status: string }
  | { type: 'ENROLLMENT_CREATED'; userId: string; courseId: string; enrollmentId: string }
  | { type: 'ENROLLMENT_CANCELLED'; userId: string; courseId: string; enrollmentId: string }
  | { type: 'MODULE_PROGRESS_UPDATED'; enrollmentId: string; moduleId: string; progressPercent: number; completed: boolean }
  | { type: 'COURSE_COMPLETED'; userId: string; courseId: string; enrollmentId: string }
  | { type: 'REVIEW_REPORTED'; reviewId: string; courseId: string; reason: string; reportedBy: string }
  | { type: 'INSTRUCTOR_NOTIFICATION'; courseId: string; reviewId: string; message: string }
  | { type: 'CEU_NOTIFICATION'; userId: string; requirementId: string; requirementName: string; creditHoursCompleted: number; creditHoursRequired: number; daysUntilDeadline: number; progressPercent: number; isMet: boolean };

export function emitEvent(e: DomainEvent) {
  bus.emit(e.type, e);
}

export type ApplicationStatus = 
  | 'draft'
  | 'submitted'
  | 'viewed'
  | 'in_review'
  | 'credentialing'
  | 'collecting_docs'
  | 'verification'
  | 'waiting_on_source'
  | 'ready_for_review'
  | 'committee_review'
  | 'approved'
  | 'rejected'
  | 'started';

export type ApplicationTimelineEvent = {
  event: ApplicationStatus;
  at: Date;
};

export type ApplicationAuditLog = {
  entity_type: 'application';
  action: 'status_change';
  from: ApplicationStatus | null;
  to: ApplicationStatus;
  timestamp: Date;
};

export type LaneProgress = 'complete' | 'pending' | 'missing' | 'in_progress';

export interface CredentialingProgress {
  identity: LaneProgress;
  sanctions: LaneProgress;
  licensure: LaneProgress;
  enrollment: LaneProgress;
}

export type ApplicationBlocker = {
  type: string;
  severity: 'high' | 'medium' | 'low';
};

export type VCVApplication = {
  npi: string;
  identity: any;
  lanes: {
    identity: string;
    sanctions: string;
    licensure: string;
    enrollment: string;
  };
  claims: any[];
  completeness: number;
  generatedAt: Date;
  status: ApplicationStatus;
  timeline: ApplicationTimelineEvent[];
  audit_logs: ApplicationAuditLog[];
  progress: CredentialingProgress;
  blockers: ApplicationBlocker[];
  eta: string;
};

export function nextAction(application: Partial<VCVApplication>): string {
  if (application.status === 'collecting_docs') {
    return 'Upload required documents';
  }
  if (application.status === 'waiting_on_source') {
    return 'Waiting on source response';
  }
  if (application.status === 'ready_for_review') {
    return 'Ready for credentialing review';
  }
  if (application.blockers && application.blockers.length > 0) {
    if (application.blockers.some(b => b.type === 'missing_license' && b.severity === 'high')) {
      return 'Upload required documents';
    }
  }
  if (application.progress && application.progress.sanctions === 'pending' && !application.blockers?.some(b => b.severity === 'high')) {
    // If sanctions are pending but there are no HIGH severity blockers, it's ready for review (Macie case)
    return 'Ready for review';
  }
  if (application.progress && application.progress.sanctions === 'pending') {
    return 'Waiting on source response';
  }
  return 'Ready for review';
}

export function estimateTimeToStart(progress: CredentialingProgress): string {
  if (progress.enrollment === 'missing' || progress.enrollment === 'in_progress' || progress.enrollment === 'pending') {
    return '45–90 days';
  }
  if (progress.sanctions === 'missing' || progress.sanctions === 'in_progress' || progress.sanctions === 'pending') {
    return 'monthly';
  }
  if (progress.identity === 'missing' || progress.identity === 'in_progress' || progress.identity === 'pending') {
    return 'instant';
  }
  return 'Ready';
}

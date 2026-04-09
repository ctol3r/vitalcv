export type ApplicationStatus = 
  | 'draft'
  | 'submitted'
  | 'viewed'
  | 'in_review'
  | 'credentialing'
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
  eta: string;
};

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

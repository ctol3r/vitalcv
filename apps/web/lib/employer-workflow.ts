export type EmployerWorkflowState =
  | 'NEW'
  | 'UNDER_REVIEW'
  | 'WAITING_FOR_DOCUMENTS'
  | 'APPROVED'
  | 'REJECTED';

export type MissingRequestStatus = 'OPEN' | 'CLOSED';

export type MissingRequest = {
  requestId: string;
  applicationId: string;
  field: string;
  message: string;
  status: MissingRequestStatus;
  taskId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EmployerWorkflowApplication = {
  id: string;
  opportunityId: string;
  clerkUserId: string;
  npi: string | null;
  coverNote: string | null;
  status: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
  queue: 'applications' | 'hire_to_start' | 'closed';
  workflowState: EmployerWorkflowState;
  missingRequests: MissingRequest[];
  provider: {
    npi: string | null;
    fullName: string | null;
    firstName?: string | null;
    lastName?: string | null;
    specialty: string | null;
    stateOfPractice: string | null;
  } | null;
  employer: {
    organizationId: string;
    name: string | null;
  };
  readiness: {
    readinessScore: number;
    readinessLevel: 'L0' | 'L1' | 'L2' | 'L3';
    readinessStatus: string;
    gapSummary: string[];
    keyCredentials: string[];
    trustSignals: string[];
  } | null;
  latestRecommendation: {
    actionType: string | null;
    label: string | null;
    explanation: string | null;
  } | null;
  timeline: Array<{
    stage: string;
    occurredAt: string | null;
    description: string;
  }>;
  systemBehavesAutonomously: boolean;
  opportunity: {
    id: string;
    organizationId: string;
    organizationName: string | null;
    title: string;
    specialty: string;
    hiringType: string;
    state: string;
    payRange: string | null;
    status: string;
  };
};

export type EmployerWorkflowDashboardPayload = {
  applications: EmployerWorkflowApplication[];
  byState: Record<EmployerWorkflowState, EmployerWorkflowApplication[]>;
  bottlenecks: {
    waitingForDocumentsCount: number;
    underReviewOver48HoursCount: number;
    newApplicationsCount: number;
    acceptedHeadStartCount: number;
  };
  missingData: MissingRequest[];
};

export function employerWorkflowStateLabel(state: EmployerWorkflowState): string {
  switch (state) {
    case 'NEW':
      return 'New applications';
    case 'UNDER_REVIEW':
      return 'Under review';
    case 'WAITING_FOR_DOCUMENTS':
      return 'Waiting for documents';
    case 'APPROVED':
      return 'Approved';
    case 'REJECTED':
      return 'Rejected';
  }
}

export function employerWorkflowStateTone(state: EmployerWorkflowState): string {
  switch (state) {
    case 'NEW':
      return 'border-amber-500/25 bg-amber-500/10 text-amber-100';
    case 'UNDER_REVIEW':
      return 'border-sky-500/25 bg-sky-500/10 text-sky-100';
    case 'WAITING_FOR_DOCUMENTS':
      return 'border-orange-500/25 bg-orange-500/10 text-orange-100';
    case 'APPROVED':
      return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100';
    case 'REJECTED':
      return 'border-rose-500/25 bg-rose-500/10 text-rose-100';
  }
}

export function relativeTimestamp(iso: string | null): string {
  if (!iso) {
    return 'Unavailable';
  }

  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return 'Unavailable';
  }

  return parsed.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

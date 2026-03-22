export type OutcomeObjectType = 'user' | 'application' | 'provider' | 'case';

export type OutcomeType =
  | 'onboarding_completed'
  | 'blocker_resolved'
  | 'readiness_improved'
  | 'trust_state_changed'
  | 'application_submitted'
  | 'application_status_moved'
  | 'employer_reviewed'
  | 'employer_action_generated'
  | 'finding_surfaced'
  | 'storyline_created';

export interface OutcomeStateChange {
  id: string;
  objectType: OutcomeObjectType;
  objectId: string;
  outcomeType: OutcomeType;
  summary: string;
  occurredAt: string;
  href: string | null;
}

export interface ClinicianProofPayload {
  generatedAt: string;
  userSummary: string | null;
  metrics: {
    onboardingCompletionMinutes: number | null;
    blockersResolved: number;
    applicationsSubmitted: number;
    applicationsMoving: number;
    readinessDelta: number | null;
    readinessFromScore: number | null;
    readinessToScore: number | null;
    readinessFromLevel: 'L0' | 'L1' | 'L2' | 'L3' | null;
    readinessToLevel: 'L0' | 'L1' | 'L2' | 'L3' | null;
  };
  completedBecauseOfVCV: string[];
  recentChanges: OutcomeStateChange[];
  applicationSummaries: Array<{
    applicationId: string;
    status: string;
    summary: string;
    occurredAt: string;
  }>;
}

export interface EmployerValueSignalMetric {
  id: string;
  label: string;
  value: number;
  detail: string;
}

export interface EmployerValueSignals {
  generatedAt: string;
  metrics: {
    activeApplications: number;
    candidatesReadyVisible: number;
    issuesFlaggedBeforeReview: number;
    preparedContexts: number;
    reviewActions: number;
    actionQueueGenerated: number;
  };
  signals: EmployerValueSignalMetric[];
  candidateSummaries: Array<{
    applicationId: string;
    clinicianLabel: string;
    status: string;
    summary: string;
    occurredAt: string;
    preparedContext: string[];
    issueCount: number;
    actionCount: number;
  }>;
  recentChanges: OutcomeStateChange[];
}

export interface PilotProofGap {
  id: string;
  title: string;
  detail: string;
  status: 'fixed' | 'remaining';
}

export interface PilotProofSummary {
  generatedAt: string;
  lookbackHours: number;
  counts: {
    usersOnboarded: number;
    readinessCompleted: number;
    blockersResolved: number;
    appliedUsers: number;
    applicationsSubmitted: number;
    applicationsMoving: number;
    trustChangesSurfaced: number;
    findingsSurfaced: number;
    storylinesSurfaced: number;
    employerReviews: number;
    employerActionsGenerated: number;
  };
  onboardingCompletion: {
    sampleSize: number;
    averageMinutes: number | null;
    medianMinutes: number | null;
  };
  readinessProgress: {
    improvedUsers: number;
    averageDelta: number | null;
    readyUsers: number;
  };
  systemActivity: {
    pilotEvents: number;
    supportIssues: number;
    routeFailures: number;
  };
  baselineComparison: {
    baselineAt: string | null;
    currentAt: string;
    baseline: {
      applications: number;
      readinessCompleted: number;
      findings: number;
      storylines: number;
      employerActionsGenerated: number;
    };
    current: {
      applications: number;
      readinessCompleted: number;
      findings: number;
      storylines: number;
      employerActionsGenerated: number;
    };
    delta: {
      applications: number;
      readinessCompleted: number;
      findings: number;
      storylines: number;
      employerActionsGenerated: number;
    };
  };
  dropOff: Array<{
    stage: string;
    count: number;
    detail: string;
  }>;
  recentProgress: OutcomeStateChange[];
  topProofGaps: PilotProofGap[];
  remainingGaps: PilotProofGap[];
}

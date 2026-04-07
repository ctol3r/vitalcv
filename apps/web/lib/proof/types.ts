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
  livePilot: {
    windowDays: number;
    measuredDelta: {
      medianDaysFirstReviewToDecision: number | null;
      medianDaysFirstReviewToReady: number | null;
      medianDaysFirstReviewToStart: number | null;
      medianDaysShareToDecision: number | null;
      sampleSizes: {
        reviewToDecision: number;
        reviewToReady: number;
        reviewToStart: number;
        shareToDecision: number;
      };
    };
    conversion: {
      shareToReviewRatePct: number | null;
      reviewToDecisionRatePct: number | null;
      reviewToProceedRatePct: number | null;
      proceedToStartRatePct: number | null;
    };
    decisionOutcomes: {
      total: number;
      byType: Record<string, number>;
      proceedCount: number;
      refreshCount: number;
      routeCount: number;
      rejectCount: number;
      holdCount: number;
    };
    blockerTiming: Array<{
      code: string;
      openCount: number;
      resolvedCount: number;
      avgResolutionDays: number | null;
      medianResolutionDays: number | null;
    }>;
    startOutcomes: {
      totalStarts: number;
      totalOutcomeRecords: number;
      didNotStartCount: number;
      nonStartReasons: Array<{
        reason: string;
        count: number;
      }>;
    };
    eventChain: {
      bundleShareEvents: number;
      advisoryOutcomeEvents: number;
      employerDecisionEvents: number;
      blockerResolutionEvents: number;
      blockerResolvedMetricEvents: number;
      readinessChangeEvents: number;
      startOutcomeEvents: number;
      nonStartOutcomeEvents: number;
      employerAcceptances: number;
      startAttestations: number;
    };
    proofChain: {
      totalEvents: number;
      totalCases: number;
      replayableCases: number;
      partialCases: number;
      cases: Array<{
        caseKey: string;
        entityId: string | null;
        npi: string | null;
        organizationContextId: string | null;
        organizationId: string | null;
        eventNames: Array<'packet_shared' | 'employer_review_opened' | 'employer_decision_recorded' | 'readiness_changed' | 'blocker_resolved' | 'start_outcome_recorded'>;
        missingCoreEvents: Array<'packet_shared' | 'employer_review_opened' | 'employer_decision_recorded' | 'start_outcome_recorded'>;
        replayable: boolean;
        lastOccurredAt: string;
        nonStartReason: string | null;
      }>;
      events: Array<{
        eventName: 'packet_shared' | 'employer_review_opened' | 'employer_decision_recorded' | 'readiness_changed' | 'blocker_resolved' | 'start_outcome_recorded';
        occurredAt: string;
        caseKey: string;
        entityId: string | null;
        npi: string | null;
        organizationContextId: string | null;
        organizationId: string | null;
        pilotId: string | null;
        workflowLane: string | null;
        geographyTag: string | null;
        sourceRecordType: string;
        sourceRecordId: string;
        outcomeStatus: string | null;
        detail: string | null;
      }>;
    };
    gaps: string[];
    exports: {
      json: true;
      csv: true;
    };
  };
}

/**
 * pilotKpiTypes.ts — Frontend type mirror for PilotKpiSnapshot
 *
 * Kept in sync with apps/api/backend/src/services/pilot/pilotKpiService.ts.
 * These types are used only for display — no business logic lives here.
 */

export interface PacketShareStats {
  total:              number;
  distinctEntities:   number;
  distinctOrgs:       number;
  byDeliveryStatus:   Record<string, number>;
  earliestSharedAt:   string | null;
  latestSharedAt:     string | null;
}

export interface ReviewOpenedStats {
  total:            number;
  distinctEntities: number;
  byOrgContext:     Array<{ orgContextId: string | null; count: number }>;
  earliestAt:       string | null;
  latestAt:         string | null;
}

export interface DecisionStats {
  total:          number;
  byType:         Record<string, number>;
  proceedCount:   number;
  refreshCount:   number;
  routeCount:     number;
  rejectCount:    number;
  holdCount:      number;
}

export interface VelocityStats {
  medianDaysFirstReviewToDecision: number | null;
  medianDaysFirstReviewToReady:    number | null;
  medianDaysFirstReviewToStart:    number | null;
  medianDaysShareToDecision:       number | null;
  sampleSizes: {
    reviewToDecision: number;
    reviewToReady:    number;
    reviewToStart:    number;
    shareToDecision:  number;
  };
}

export interface BlockerKpi {
  code:                 string;
  openCount:            number;
  resolvedCount:        number;
  avgResolutionDays:    number | null;
  medianResolutionDays: number | null;
  byResolutionMethod:   Record<string, number>;
}

export interface StartOutcomeStats {
  totalStarts:      number;
  distinctEntities: number;
  readinessAtStart: {
    avgScore:    number | null;
    medianScore: number | null;
    withBlockers: number;
  };
}

export type StartOutcomeStatus = 'started' | 'not_started' | 'pending';

export interface PilotOutcomeProofCase {
  entityId: string;
  organizationContextId: string | null;
  baselineProcessDurationDays: number | null;
  firstSharedAt: string | null;
  firstReviewAt: string | null;
  employerDecisionAt: string | null;
  actualStartDate: string | null;
  outcomeRecordedAt: string | null;
  outcomeStatus: StartOutcomeStatus;
  started: boolean;
  nonStartReason: string | null;
  daysFromFirstShare: number | null;
  daysFromFirstReview: number | null;
  daysFromReady: number | null;
  measuredProcessDurationDays: number | null;
  measuredDeltaDays: number | null;
  blockerResolution: {
    resolvedCount: number;
    avgDays: number | null;
    medianDays: number | null;
  };
  manualCorrection: boolean;
  note: string | null;
}

export interface PilotOutcomeProofSummary {
  totalCases: number;
  startedCases: number;
  notStartedCases: number;
  pendingCases: number;
  casesWithBaseline: number;
  casesWithMeasuredDelta: number;
  usableProofCases: number;
  avgMeasuredDeltaDays: number | null;
  medianMeasuredDeltaDays: number | null;
  automaticProofArtifactReady: boolean;
}

export interface ReadinessDistribution {
  ready:   number;
  partial: number;
  blocked: number;
  total:   number;
  noScore: number;
}

export interface PilotFilter {
  pilotId?: string | null;
  workflowLane?: string | null;
  orgContextId?: string | null;
  geographyTag?: string | null;
}

export interface PilotKpiSnapshot {
  generatedAt:   string;
  windowDays:    number;
  since:         string;
  appliedFilter: PilotFilter;
  isFiltered:    boolean;
  packetShares:  PacketShareStats;
  reviewsOpened: ReviewOpenedStats;
  decisions:     DecisionStats;
  velocity:      VelocityStats;
  blockers:      BlockerKpi[];
  startOutcomes: StartOutcomeStats;
  proofCases:    PilotOutcomeProofCase[];
  proofSummary:  PilotOutcomeProofSummary;
  eventChain: {
    bundleShareEvents:       number;
    advisoryOutcomeEvents:   number;
    employerDecisionEvents:  number;
    blockerResolutionEvents: number;
    startOutcomeEvents:      number;
    employerAcceptances:     number;
    startAttestations:       number;
  };
  readinessDistribution: ReadinessDistribution;
  gaps: string[];
}

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
  totalOutcomeRecords: number;
  didNotStartCount: number;
  nonStartReasons: Array<{ reason: string; count: number }>;
  distinctEntities: number;
  readinessAtStart: {
    avgScore:    number | null;
    medianScore: number | null;
    withBlockers: number;
  };
}

export interface ReadinessDistribution {
  ready:   number;
  partial: number;
  blocked: number;
  total:   number;
  noScore: number;
}

export type PilotProofChainEventName =
  | 'packet_shared'
  | 'employer_review_opened'
  | 'employer_decision_recorded'
  | 'readiness_changed'
  | 'blocker_resolved'
  | 'start_outcome_recorded';

export interface PilotProofChainEvent {
  eventName: PilotProofChainEventName;
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
}

export interface PilotProofChainCase {
  caseKey: string;
  entityId: string | null;
  npi: string | null;
  organizationContextId: string | null;
  organizationId: string | null;
  eventNames: PilotProofChainEventName[];
  missingCoreEvents: Array<'packet_shared' | 'employer_review_opened' | 'employer_decision_recorded' | 'start_outcome_recorded'>;
  replayable: boolean;
  lastOccurredAt: string;
  nonStartReason: string | null;
}

export interface PilotProofChainSummary {
  totalEvents: number;
  totalCases: number;
  replayableCases: number;
  partialCases: number;
  cases: PilotProofChainCase[];
  events: PilotProofChainEvent[];
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
  eventChain: {
    bundleShareEvents:       number;
    advisoryOutcomeEvents:   number;
    employerDecisionEvents:  number;
    blockerResolutionEvents: number;
    blockerResolvedMetricEvents: number;
    readinessChangeEvents: number;
    startOutcomeEvents:      number;
    nonStartOutcomeEvents: number;
    employerAcceptances:     number;
    startAttestations:       number;
  };
  readinessDistribution: ReadinessDistribution;
  proofChain: PilotProofChainSummary;
  gaps: string[];
}

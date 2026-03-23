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

export interface PilotKpiSnapshot {
  generatedAt:   string;
  windowDays:    number;
  since:         string;
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
    startOutcomeEvents:      number;
    employerAcceptances:     number;
    startAttestations:       number;
  };
  gaps: string[];
}

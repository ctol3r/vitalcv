/**
 * ROI Console v2 — shared types.
 *
 * Per-pilot ROI surface, sibling to the FY-aggregate executive ROI dashboard
 * at apps/web/app/roi (Wave E). Both ship; they answer different questions.
 *
 * Truth contract carry-overs:
 *   - Every projected number must render with a qualifier from
 *     LABEL_QUALIFIER_V2. Numbers that look like guarantees aren't.
 *   - Dollar lines render only when defaultWageUsd is non-null. Hours-only
 *     is a first-class state, not a degraded one.
 *   - Comparisons are always "vs. your baseline of Nd" — the employer-entered
 *     baseline from Activation Step 3 — never an industry average.
 *   - "Confirmed" is the column label for receipt confirmations. The bare
 *     word "Verified" is reserved for PSV claims and never used as a row state.
 */

/** Pilot status — drives header pill + progress-bar color + export availability. */
export type RoiV2Status = 'on-track' | 'trailing' | 'blocked' | 'complete';

export interface RoiV2Pilot {
  orgId: string;
  orgName: string;
  pilotId: string;
  /** ISO datetime string with " UTC" suffix to match the bundle convention. */
  pilotStartedAt: string;
  pilotWindowDays: number;
  daysElapsed: number;
  /**
   * Default wage in USD/hr. When `null`, the surface renders in hours-only
   * mode. Both render paths are first-class; null is not degraded.
   */
  defaultWageUsd: number | null;
  /** Employer-entered baseline (days). Used as the comparison point — never industry. */
  baselineDays: number;
  /** Owner contact (informational). */
  ownerContact: string;
  /** Marketing tier (informational; comes from Wave 30 Plans + Billing once shipped). */
  tier: 'Pilot' | 'Team' | 'Enterprise';
}

export interface RoiV2StatusBlock {
  state: RoiV2Status;
  summary: string;
  asOf: string;
}

/** Decision-flow counters — observed from the receipt log, never projected. */
export interface RoiV2Decisions {
  staged: number;
  decided: number;
  acceptedFirstPass: number;
  disputed: number;
  refreshedAndAccepted: number;
  dailyDecisionRate: number;
  dailyRateLast3: number;
  windowStart: string;
  windowEnd: string;
}

export interface RoiV2TimelineEntry {
  day: number;
  date: string;
  observed: number | null;
  projected: number | null;
  isToday: boolean;
}

export interface RoiV2Hours {
  observedSavedHours: number;
  projectedTotalHoursAt30d: number;
  hoursPerDecisionLegacy: number;
  hoursPerDecisionVitalcv: number;
  hoursSavedPerDecision: number;
}

export interface RoiV2Ttfd {
  baselineDays: number;
  pilotMedianHours: number;
  pilotP10Hours: number;
  pilotP90Hours: number;
  speedupVsBaselineX: number;
  hourSamplesByDay: number[];
}

export interface RoiV2LaneRow {
  laneId: string;
  laneName: string;
  decided: number;
  /** Receipts where the lane fact was confirmed. Column header is "Confirmed",
   *  not "Verified" — keeps tier vocabulary and pipeline state separate. */
  confirmed: number;
  contradicted: number;
  refreshed: number;
  hoursSaved: number;
  /** Fraction of total pilot value attributable to this lane. */
  pctOfTotal: number;
}

export interface RoiV2CostDrilldown {
  baselineMinutesPerDecision: number;
  pilotMinutesPerDecision: number;
}

export interface RoiV2MethodologyRow {
  k: string;
  v: string;
  note: string;
}

export type RoiV2ExportKind = 'csv' | 'pdf' | 'snapshot';

export interface RoiV2ExportOption {
  id: RoiV2ExportKind;
  label: string;
  sub: string;
}

export interface RoiV2Snapshot {
  pilot: RoiV2Pilot;
  status: RoiV2StatusBlock;
  decisions: RoiV2Decisions;
  timeline: RoiV2TimelineEntry[];
  hours: RoiV2Hours;
  ttfd: RoiV2Ttfd;
  laneBreakdown: RoiV2LaneRow[];
  costDrilldown: RoiV2CostDrilldown;
  methodology: RoiV2MethodologyRow[];
  exports: readonly RoiV2ExportOption[];
}

/**
 * ISV Tracking Pipeline — wave-119
 *
 * Independent Software Vendor measurement:
 * Tracks the complete proof loop from NPI entry to employer action.
 *
 * ISV = the wedge loop:
 *   NPI → readiness → passport → employer review → action → measurement
 *
 * Every step produces a typed, timestamped event.
 * The pipeline computes time deltas between steps.
 */

import { ReadinessPosture, SourceStatus } from './index';
import { ProofPackTier } from './gating-rules';

// ─── ISV Loop Events ──────────────────────────────────────────────

export type ISVEventType =
  | 'npi_entered'
  | 'readiness_computed'
  | 'passport_generated'
  | 'employer_review_opened'
  | 'employer_action_taken'
  | 'measurement_captured';

export interface ISVEvent {
  eventId: string;
  loopId: string;      // groups all events in one complete loop
  eventType: ISVEventType;
  timestamp: number;
  npi: string;
  payload: Record<string, unknown>;
}

// ─── ISV Loop State ───────────────────────────────────────────────

export interface ISVLoopState {
  loopId: string;
  npi: string;
  startedAt: number;
  events: ISVEvent[];
  completed: boolean;
  timings: ISVTimings | null;
}

export interface ISVTimings {
  npiToReadinessMs: number | null;
  readinessToPassportMs: number | null;
  passportToReviewMs: number | null;
  reviewToActionMs: number | null;
  totalLoopMs: number | null;
  // Derived
  totalLoopSeconds: number | null;
  totalLoopMinutes: number | null;
}

// ─── ISV Loop Factory ─────────────────────────────────────────────

let loopCounter = 0;

export function createISVLoop(npi: string): ISVLoopState {
  loopCounter++;
  return {
    loopId: `isv-loop-${Date.now()}-${loopCounter}`,
    npi,
    startedAt: Date.now(),
    events: [],
    completed: false,
    timings: null,
  };
}

export function recordISVEvent(
  loop: ISVLoopState,
  eventType: ISVEventType,
  payload: Record<string, unknown> = {}
): ISVEvent {
  const event: ISVEvent = {
    eventId: `isv-evt-${eventType}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    loopId: loop.loopId,
    eventType,
    timestamp: Date.now(),
    npi: loop.npi,
    payload,
  };
  loop.events.push(event);

  // Auto-complete if measurement captured
  if (eventType === 'measurement_captured') {
    loop.completed = true;
    loop.timings = computeISVTimings(loop.events);
  }

  return event;
}

// ─── Timing Computation ───────────────────────────────────────────

function computeISVTimings(events: ISVEvent[]): ISVTimings {
  const byType = new Map(events.map(e => [e.eventType, e.timestamp]));

  const npiEntered = byType.get('npi_entered');
  const readinessComputed = byType.get('readiness_computed');
  const passportGenerated = byType.get('passport_generated');
  const reviewOpened = byType.get('employer_review_opened');
  const actionTaken = byType.get('employer_action_taken');

  const npiToReadinessMs = npiEntered && readinessComputed
    ? readinessComputed - npiEntered : null;
  const readinessToPassportMs = readinessComputed && passportGenerated
    ? passportGenerated - readinessComputed : null;
  const passportToReviewMs = passportGenerated && reviewOpened
    ? reviewOpened - passportGenerated : null;
  const reviewToActionMs = reviewOpened && actionTaken
    ? actionTaken - reviewOpened : null;
  const totalLoopMs = npiEntered && actionTaken
    ? actionTaken - npiEntered : null;

  return {
    npiToReadinessMs,
    readinessToPassportMs,
    passportToReviewMs,
    reviewToActionMs,
    totalLoopMs,
    totalLoopSeconds: totalLoopMs !== null ? Math.round(totalLoopMs / 1000) : null,
    totalLoopMinutes: totalLoopMs !== null ? Math.round(totalLoopMs / 60000 * 10) / 10 : null,
  };
}

// ─── ISV Loop Summary (for pilot reporting) ───────────────────────

export interface ISVLoopSummary {
  loopId: string;
  npi: string;
  completed: boolean;
  eventCount: number;
  missingSteps: ISVEventType[];
  timings: ISVTimings | null;
  proofPackTier: ProofPackTier | null;
  readinessPosture: ReadinessPosture | null;
  employerAction: string | null;
}

export function summarizeISVLoop(loop: ISVLoopState): ISVLoopSummary {
  const allSteps: ISVEventType[] = [
    'npi_entered', 'readiness_computed', 'passport_generated',
    'employer_review_opened', 'employer_action_taken', 'measurement_captured',
  ];
  const seenSteps = new Set(loop.events.map(e => e.eventType));
  const missingSteps = allSteps.filter(s => !seenSteps.has(s));

  const readinessEvent = loop.events.find(e => e.eventType === 'readiness_computed');
  const actionEvent = loop.events.find(e => e.eventType === 'employer_action_taken');

  return {
    loopId: loop.loopId,
    npi: loop.npi,
    completed: loop.completed,
    eventCount: loop.events.length,
    missingSteps,
    timings: loop.timings ?? (loop.events.length > 0 ? computeISVTimings(loop.events) : null),
    proofPackTier: readinessEvent?.payload?.tier as ProofPackTier ?? null,
    readinessPosture: readinessEvent?.payload?.posture as ReadinessPosture ?? null,
    employerAction: actionEvent?.payload?.action as string ?? null,
  };
}

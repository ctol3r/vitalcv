// ── Pilot Simulation Engine ────────────────────────────────────────

import { AuditEventType, createAuditEvent, type AuditEvent } from './audit-events';
import { ReadinessPosture } from '../../trust-contract/dist/index';

// ── Baseline Config ──────────────────────────────────────────────

const BASELINE_DAYS = 83; // Industry average credentialing time
const TOTAL_CLINICIANS = 30;

// Distribution of states
const DISTRIBUTION = {
  DECISION_GRADE: 20, // Clean, fast path
  PARTIAL: 5,         // Missing data, requires refresh
  BLOCKED: 3,         // Exclusions found, immediate rejection
  DEGRADED: 2,        // Stale data, requires refresh then approval
};

// ── Helper: Random Time Offsets (ms) ─────────────────────────────

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function randomOffset(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ── Simulator ────────────────────────────────────────────────────

export interface SimulationResult {
  total_clinicians: number;
  avg_time_to_decision_hours: number;
  avg_time_to_start_ready_hours: number;
  avg_days_saved: number;
  blocked_cases: number;
  degraded_cases: number;
  events: AuditEvent[];
}

export function runSimulation(): SimulationResult {
  const events: AuditEvent[] = [];
  const metrics = {
    decisionTimes: [] as number[],
    startReadyTimes: [] as number[],
    blockedCount: 0,
    degradedCount: 0,
  };

  const nowMs = Date.now();
  let clinicianCounter = 1;

  function simulateClinician(state: ReadinessPosture) {
    const npi = `9000000${clinicianCounter.toString().padStart(3, '0')}`;
    clinicianCounter++;
    
    const employerId = 'pilot-employer-1';
    const manifestId = `manifest-${npi}`;
    
    // T0: Ingest Started (Clinician claims profile)
    const t0 = nowMs - randomOffset(7 * DAY, 14 * DAY);
    events.push(createAuditEvent({
      eventType: AuditEventType.INGEST_STARTED,
      subjectNpi: npi,
      actor: npi,
    }));

    // T1: Readiness Computed & Manifest Generated (seconds later)
    const t1 = t0 + randomOffset(2 * 1000, 10 * 1000);
    events.push(createAuditEvent({
      eventType: AuditEventType.READINESS_COMPUTED,
      subjectNpi: npi,
      metadata: { posture: state },
    }));
    events.push(createAuditEvent({
      eventType: AuditEventType.MANIFEST_GENERATED,
      subjectNpi: npi,
      manifestId,
    }));

    // T2: Application Submitted (minutes/hours later)
    const t2 = t1 + randomOffset(10 * MINUTE, 12 * HOUR);
    events.push(createAuditEvent({
      eventType: AuditEventType.APPLICATION_SUBMITTED,
      subjectNpi: npi,
      actor: npi,
      manifestId,
    }));

    // T3: Review Opened (employer opens link — hours/days later)
    const t3 = t2 + randomOffset(1 * HOUR, 48 * HOUR);
    events.push(createAuditEvent({
      eventType: AuditEventType.REVIEW_OPENED,
      subjectNpi: npi,
      actor: employerId,
      manifestId,
    }));

    // T4: Decision Time
    if (state === ReadinessPosture.DECISION_GRADE) {
      // Fast path: review -> approve -> employment started (minutes)
      const t4 = t3 + randomOffset(1 * MINUTE, 15 * MINUTE);
      events.push(createAuditEvent({
        eventType: AuditEventType.EMPLOYER_ACCEPTED,
        subjectNpi: npi,
        actor: employerId,
        manifestId,
      }));
      
      const t5 = t4 + randomOffset(1 * DAY, 5 * DAY);
      events.push(createAuditEvent({
        eventType: AuditEventType.EMPLOYMENT_STARTED,
        subjectNpi: npi,
        actor: employerId,
        manifestId,
      }));

      metrics.decisionTimes.push(t4 - t2);
      metrics.startReadyTimes.push(t5 - t2);

    } else if (state === ReadinessPosture.BLOCKED) {
      // Fast path: review -> reject (minutes)
      metrics.blockedCount++;
      const t4 = t3 + randomOffset(1 * MINUTE, 5 * MINUTE);
      events.push(createAuditEvent({
        eventType: AuditEventType.EMPLOYER_REJECTED,
        subjectNpi: npi,
        actor: employerId,
        manifestId,
      }));

      metrics.decisionTimes.push(t4 - t2);

    } else if (state === ReadinessPosture.PARTIAL || state === ReadinessPosture.DEGRADED) {
      // Slow path: review -> request refresh -> re-review -> approve
      if (state === ReadinessPosture.DEGRADED) metrics.degradedCount++;
      
      const t4 = t3 + randomOffset(2 * MINUTE, 30 * MINUTE);
      events.push(createAuditEvent({
        eventType: AuditEventType.EMPLOYER_REQUESTED_REFRESH,
        subjectNpi: npi,
        actor: employerId,
        manifestId,
      }));

      // Clinician updates data (days later)
      const t5 = t4 + randomOffset(1 * DAY, 4 * DAY);
      events.push(createAuditEvent({
        eventType: AuditEventType.MANIFEST_GENERATED, // New manifest
        subjectNpi: npi,
        manifestId: `${manifestId}-v2`,
      }));

      // Employer re-reviews and approves
      const t6 = t5 + randomOffset(2 * HOUR, 24 * HOUR);
      events.push(createAuditEvent({
        eventType: AuditEventType.EMPLOYER_ACCEPTED,
        subjectNpi: npi,
        actor: employerId,
        manifestId: `${manifestId}-v2`,
      }));

      const t7 = t6 + randomOffset(1 * DAY, 5 * DAY);
      events.push(createAuditEvent({
        eventType: AuditEventType.EMPLOYMENT_STARTED,
        subjectNpi: npi,
        actor: employerId,
        manifestId: `${manifestId}-v2`,
      }));

      metrics.decisionTimes.push(t6 - t2);
      metrics.startReadyTimes.push(t7 - t2);
    }
  }

  // Run the batch
  for (let i = 0; i < DISTRIBUTION.DECISION_GRADE; i++) simulateClinician(ReadinessPosture.DECISION_GRADE);
  for (let i = 0; i < DISTRIBUTION.PARTIAL; i++) simulateClinician(ReadinessPosture.PARTIAL);
  for (let i = 0; i < DISTRIBUTION.BLOCKED; i++) simulateClinician(ReadinessPosture.BLOCKED);
  for (let i = 0; i < DISTRIBUTION.DEGRADED; i++) simulateClinician(ReadinessPosture.DEGRADED);

  // Compute averages
  const avgDecisionMs = metrics.decisionTimes.reduce((a, b) => a + b, 0) / metrics.decisionTimes.length;
  const avgStartReadyMs = metrics.startReadyTimes.reduce((a, b) => a + b, 0) / metrics.startReadyTimes.length;

  const avgDecisionHours = avgDecisionMs / HOUR;
  const avgStartReadyHours = avgStartReadyMs / HOUR;
  
  // Calculate ROI (Baseline 83 days vs VitalCV time to start)
  const avgStartReadyDays = avgStartReadyHours / 24;
  const avgDaysSaved = BASELINE_DAYS - avgStartReadyDays;

  return {
    total_clinicians: TOTAL_CLINICIANS,
    avg_time_to_decision_hours: Math.round(avgDecisionHours * 10) / 10,
    avg_time_to_start_ready_hours: Math.round(avgStartReadyHours * 10) / 10,
    avg_days_saved: Math.round(avgDaysSaved * 10) / 10,
    blocked_cases: metrics.blockedCount,
    degraded_cases: metrics.degradedCount,
    events,
  };
}

const result = runSimulation();
console.log(JSON.stringify({
  total_clinicians: result.total_clinicians,
  avg_time_to_decision_hours: result.avg_time_to_decision_hours,
  avg_time_to_start_ready_hours: result.avg_time_to_start_ready_hours,
  avg_days_saved: result.avg_days_saved,
  blocked_cases: result.blocked_cases,
  degraded_cases: result.degraded_cases,
}, null, 2));

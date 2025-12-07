/**
 * B207A-LIFE-003: LifecycleEventSeries builder
 *
 * Turns all historical events (timeline, drift, OPPE, EHR sync, privileges, enrollment)
 * into chronological series.
 */

import type { LifecycleState } from '../models/LifecycleState.js';

/**
 * Event type enumeration
 */
export type LifecycleEventType =
  | 'timeline'
  | 'drift'
  | 'oppe'
  | 'ehr_sync'
  | 'privileges'
  | 'enrollment'
  | 'fppe'
  | 'safety_signal'
  | 'renewal'
  | 'credential_update';

/**
 * Base event structure
 */
export interface LifecycleEvent {
  id: string;
  type: LifecycleEventType;
  timestamp: Date;
  clinicianId: string;
  orgId?: string;
  department?: string;
  summary: string;
  metadata?: Record<string, unknown>;
}

/**
 * Timeline event
 */
export interface TimelineEvent extends LifecycleEvent {
  type: 'timeline';
  phase: string;
  status: string;
}

/**
 * Drift event
 */
export interface DriftEvent extends LifecycleEvent {
  type: 'drift';
  severity: 'LOW' | 'MED' | 'HIGH' | 'CRITICAL';
  eventId: string;
  resolvedAt?: Date;
}

/**
 * OPPE event
 */
export interface OppeEvent extends LifecycleEvent {
  type: 'oppe';
  reviewDate: Date;
  nextReviewDue?: Date;
  trend?: number;
  metrics?: Record<string, unknown>;
}

/**
 * EHR sync event
 */
export interface EhrSyncEvent extends LifecycleEvent {
  type: 'ehr_sync';
  syncType: 'full' | 'incremental';
  recordCount?: number;
  mismatches?: number;
}

/**
 * Privileges event
 */
export interface PrivilegesEvent extends LifecycleEvent {
  type: 'privileges';
  action: 'granted' | 'revoked' | 'suspended' | 'renewed';
  privilegeCodes: string[];
}

/**
 * Enrollment event
 */
export interface EnrollmentEvent extends LifecycleEvent {
  type: 'enrollment';
  payerId?: string;
  payerName?: string;
  status: string;
}

/**
 * FPPE event
 */
export interface FppeEvent extends LifecycleEvent {
  type: 'fppe';
  status: string;
  startDate?: Date;
  endDate?: Date;
  outcomes?: number;
}

/**
 * Safety signal event
 */
export interface SafetySignalEvent extends LifecycleEvent {
  type: 'safety_signal';
  signalType: string;
  severity: 'LOW' | 'MED' | 'HIGH' | 'CRITICAL';
  resolvedAt?: Date;
}

/**
 * Renewal event
 */
export interface RenewalEvent extends LifecycleEvent {
  type: 'renewal';
  credentialType: 'license' | 'board' | 'dea' | 'pecos';
  renewalDate: Date;
  expiryDate?: Date;
}

/**
 * Credential update event
 */
export interface CredentialUpdateEvent extends LifecycleEvent {
  type: 'credential_update';
  credentialType: string;
  changeType: 'added' | 'updated' | 'expired' | 'revoked';
}

/**
 * Union type of all event types
 */
export type LifecycleEventUnion =
  | TimelineEvent
  | DriftEvent
  | OppeEvent
  | EhrSyncEvent
  | PrivilegesEvent
  | EnrollmentEvent
  | FppeEvent
  | SafetySignalEvent
  | RenewalEvent
  | CredentialUpdateEvent;

/**
 * Event series (chronologically ordered events)
 */
export interface LifecycleEventSeries {
  clinicianId: string;
  orgId?: string;
  department?: string;
  events: LifecycleEventUnion[];
  startDate: Date;
  endDate: Date;
  eventCounts: Record<LifecycleEventType, number>;
}

/**
 * Build event series from lifecycle states
 */
function buildEventSeriesFromStates(states: LifecycleState[]): LifecycleEventUnion[] {
  const events: LifecycleEventUnion[] = [];

  for (const state of states) {
    // Extract drift events
    if (state.drift && state.drift.recentEvents) {
      for (const driftEvent of state.drift.recentEvents) {
        events.push({
          id: driftEvent.eventId,
          type: 'drift',
          timestamp: driftEvent.detectedAt,
          clinicianId: state.clinicianId,
          orgId: state.orgId,
          department: state.department,
          summary: `Drift event: ${driftEvent.type}`,
          severity: state.drift.severity || 'MED',
          eventId: driftEvent.eventId,
          resolvedAt: driftEvent.resolvedAt,
          metadata: { type: driftEvent.type },
        });
      }
    }

    // Extract OPPE events
    if (state.oppeFppe?.oppe) {
      const oppe = state.oppeFppe.oppe;
      events.push({
        id: `oppe-${state.timestamp.getTime()}`,
        type: 'oppe',
        timestamp: state.timestamp,
        clinicianId: state.clinicianId,
        orgId: state.orgId,
        department: state.department,
        summary: `OPPE review: ${oppe.status}`,
        reviewDate: oppe.lastReviewDate || state.timestamp,
        nextReviewDue: oppe.nextReviewDue,
        trend: oppe.trend,
        metrics: oppe.metrics,
      });
    }

    // Extract FPPE events
    if (state.oppeFppe?.fppe) {
      const fppe = state.oppeFppe.fppe;
      events.push({
        id: `fppe-${state.timestamp.getTime()}`,
        type: 'fppe',
        timestamp: state.timestamp,
        clinicianId: state.clinicianId,
        orgId: state.orgId,
        department: state.department,
        summary: `FPPE: ${fppe.status}`,
        status: fppe.status,
        startDate: fppe.startDate,
        endDate: fppe.endDate,
        outcomes: fppe.outcomes,
      });
    }

    // Extract privilege events
    if (state.privileges) {
      const priv = state.privileges;
      if (priv.privilegeCodes && priv.privilegeCodes.length > 0) {
        events.push({
          id: `privileges-${state.timestamp.getTime()}`,
          type: 'privileges',
          timestamp: state.timestamp,
          clinicianId: state.clinicianId,
          orgId: state.orgId,
          department: state.department,
          summary: `Privileges: ${priv.status || 'ACTIVE'}`,
          action: priv.status === 'ACTIVE' ? 'granted' : priv.status === 'REVOKED' ? 'revoked' : 'suspended',
          privilegeCodes: priv.privilegeCodes,
        });
      }
    }

    // Extract enrollment events
    if (state.enrollmentMap?.payerEnrollments) {
      for (const enrollment of state.enrollmentMap.payerEnrollments) {
        events.push({
          id: `enrollment-${enrollment.payerId}-${state.timestamp.getTime()}`,
          type: 'enrollment',
          timestamp: enrollment.enrolledAt || state.timestamp,
          clinicianId: state.clinicianId,
          orgId: state.orgId,
          department: state.department,
          summary: `Enrollment: ${enrollment.payerName || enrollment.payerId} - ${enrollment.status}`,
          payerId: enrollment.payerId,
          payerName: enrollment.payerName,
          status: enrollment.status,
        });
      }
    }

    // Extract safety signal events
    if (state.safetySignals?.signals) {
      for (const signal of state.safetySignals.signals) {
        events.push({
          id: `safety-${signal.type}-${signal.detectedAt.getTime()}`,
          type: 'safety_signal',
          timestamp: signal.detectedAt,
          clinicianId: state.clinicianId,
          orgId: state.orgId,
          department: state.department,
          summary: `Safety signal: ${signal.type} (${signal.severity})`,
          signalType: signal.type,
          severity: signal.severity,
          resolvedAt: signal.resolvedAt,
        });
      }
    }

    // Extract credential renewal events from freshness
    if (state.credentialFreshness) {
      const cf = state.credentialFreshness;
      const now = new Date();

      if (cf.licenseExpiryDays !== undefined && cf.licenseExpiryDays > 0 && cf.licenseExpiryDays < 90) {
        const expiryDate = new Date(now);
        expiryDate.setDate(expiryDate.getDate() + cf.licenseExpiryDays);
        events.push({
          id: `renewal-license-${state.timestamp.getTime()}`,
          type: 'renewal',
          timestamp: state.timestamp,
          clinicianId: state.clinicianId,
          orgId: state.orgId,
          department: state.department,
          summary: `License renewal due in ${cf.licenseExpiryDays} days`,
          credentialType: 'license',
          renewalDate: expiryDate,
          expiryDate,
        });
      }

      if (cf.boardExpiryDays !== undefined && cf.boardExpiryDays > 0 && cf.boardExpiryDays < 90) {
        const expiryDate = new Date(now);
        expiryDate.setDate(expiryDate.getDate() + cf.boardExpiryDays);
        events.push({
          id: `renewal-board-${state.timestamp.getTime()}`,
          type: 'renewal',
          timestamp: state.timestamp,
          clinicianId: state.clinicianId,
          orgId: state.orgId,
          department: state.department,
          summary: `Board certification renewal due in ${cf.boardExpiryDays} days`,
          credentialType: 'board',
          renewalDate: expiryDate,
          expiryDate,
        });
      }

      if (cf.deaExpiryDays !== undefined && cf.deaExpiryDays > 0 && cf.deaExpiryDays < 90) {
        const expiryDate = new Date(now);
        expiryDate.setDate(expiryDate.getDate() + cf.deaExpiryDays);
        events.push({
          id: `renewal-dea-${state.timestamp.getTime()}`,
          type: 'renewal',
          timestamp: state.timestamp,
          clinicianId: state.clinicianId,
          orgId: state.orgId,
          department: state.department,
          summary: `DEA registration renewal due in ${cf.deaExpiryDays} days`,
          credentialType: 'dea',
          renewalDate: expiryDate,
          expiryDate,
        });
      }
    }
  }

  return events;
}

/**
 * LifecycleEventSeriesBuilder class
 */
export class LifecycleEventSeriesBuilder {
  /**
   * Build event series from lifecycle states
   */
  buildFromStates(states: LifecycleState[]): LifecycleEventSeries {
    if (states.length === 0) {
      throw new Error('Cannot build event series from empty states array');
    }

    // Sort states by timestamp
    const sortedStates = [...states].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Extract events
    const events = buildEventSeriesFromStates(sortedStates);

    // Sort events chronologically
    events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Count events by type
    const eventCounts: Record<LifecycleEventType, number> = {
      timeline: 0,
      drift: 0,
      oppe: 0,
      ehr_sync: 0,
      privileges: 0,
      enrollment: 0,
      fppe: 0,
      safety_signal: 0,
      renewal: 0,
      credential_update: 0,
    };

    for (const event of events) {
      eventCounts[event.type]++;
    }

    const firstState = sortedStates[0];
    const lastState = sortedStates[sortedStates.length - 1];

    return {
      clinicianId: firstState.clinicianId,
      orgId: firstState.orgId,
      department: firstState.department,
      events,
      startDate: firstState.timestamp,
      endDate: lastState.timestamp,
      eventCounts,
    };
  }

  /**
   * Filter events by type
   */
  filterByType(series: LifecycleEventSeries, type: LifecycleEventType): LifecycleEventUnion[] {
    return series.events.filter((e) => e.type === type);
  }

  /**
   * Filter events by date range
   */
  filterByDateRange(series: LifecycleEventSeries, startDate: Date, endDate: Date): LifecycleEventUnion[] {
    return series.events.filter(
      (e) => e.timestamp >= startDate && e.timestamp <= endDate
    );
  }

  /**
   * Get events grouped by type
   */
  groupByType(series: LifecycleEventSeries): Record<LifecycleEventType, LifecycleEventUnion[]> {
    const grouped: Record<LifecycleEventType, LifecycleEventUnion[]> = {
      timeline: [],
      drift: [],
      oppe: [],
      ehr_sync: [],
      privileges: [],
      enrollment: [],
      fppe: [],
      safety_signal: [],
      renewal: [],
      credential_update: [],
    };

    for (const event of series.events) {
      grouped[event.type].push(event);
    }

    return grouped;
  }
}

/**
 * Default event series builder instance
 */
export const lifecycleEventSeriesBuilder = new LifecycleEventSeriesBuilder();


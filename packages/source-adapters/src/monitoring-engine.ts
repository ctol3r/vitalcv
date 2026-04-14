// ── VitalCV Monitoring Engine ──────────────────────────────────────
// Converts continuous drift detection into actionable employer workflows.

import { DriftSeverity, type DriftEvent } from './drift-engine';
import { AuditEventType, createAuditEvent, type AuditEvent } from './audit-events';

// ── Subscription Model ───────────────────────────────────────────

export enum SubscriptionStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  CANCELLED = 'cancelled',
}

export interface MonitoringSubscription {
  /** UUID v4 */
  subscriptionId: string;
  /** NPI of the clinician being monitored */
  subjectNpi: string;
  /** ID of the employer subscribing */
  employerId: string;
  /** When the subscription was created */
  createdAt: string;
  /** Current state of the subscription */
  status: SubscriptionStatus;
}

// ── Alert Model ──────────────────────────────────────────────────

export enum AlertAction {
  TRIGGER_ALERT = 'trigger_alert',
  MARK_DEGRADED = 'mark_degraded',
  LOG_ONLY = 'log_only',
}

export interface MonitoringAlert {
  alertId: string;
  subscriptionId: string;
  subjectNpi: string;
  employerId: string;
  action: AlertAction;
  triggeringDrifts: DriftEvent[];
  generatedAt: string;
}

// ── Monitoring Engine ────────────────────────────────────────────

export function createSubscription(subjectNpi: string, employerId: string): { subscription: MonitoringSubscription; event: AuditEvent } {
  const subscription: MonitoringSubscription = {
    subscriptionId: crypto.randomUUID(),
    subjectNpi,
    employerId,
    createdAt: new Date().toISOString(),
    status: SubscriptionStatus.ACTIVE,
  };

  const event = createAuditEvent({
    eventType: AuditEventType.EMPLOYMENT_STARTED, // Subscribing usually implies employment started or active roster
    subjectNpi,
    actor: employerId,
    metadata: {
      action: 'monitoring_subscribed',
      subscriptionId: subscription.subscriptionId,
    },
  });

  return { subscription, event };
}

export function evaluateDrift(
  subscriptions: MonitoringSubscription[],
  drifts: DriftEvent[]
): { alerts: MonitoringAlert[]; events: AuditEvent[] } {
  const alerts: MonitoringAlert[] = [];
  const events: AuditEvent[] = [];
  
  if (drifts.length === 0) return { alerts, events };

  // Group drifts by NPI
  const driftsByNpi = new Map<string, DriftEvent[]>();
  for (const drift of drifts) {
    if (!driftsByNpi.has(drift.subjectNpi)) {
      driftsByNpi.set(drift.subjectNpi, []);
    }
    driftsByNpi.get(drift.subjectNpi)!.push(drift);
  }

  // Evaluate against active subscriptions
  for (const sub of subscriptions) {
    if (sub.status !== SubscriptionStatus.ACTIVE) continue;

    const npiDrifts = driftsByNpi.get(sub.subjectNpi);
    if (!npiDrifts || npiDrifts.length === 0) continue;

    // Determine highest severity among drifts for this subject
    const hasHigh = npiDrifts.some(d => d.severity === DriftSeverity.HIGH);
    const hasMedium = npiDrifts.some(d => d.severity === DriftSeverity.MEDIUM);

    let action = AlertAction.LOG_ONLY;
    if (hasHigh) {
      action = AlertAction.TRIGGER_ALERT;
    } else if (hasMedium) {
      action = AlertAction.MARK_DEGRADED;
    }

    const alert: MonitoringAlert = {
      alertId: crypto.randomUUID(),
      subscriptionId: sub.subscriptionId,
      subjectNpi: sub.subjectNpi,
      employerId: sub.employerId,
      action,
      triggeringDrifts: npiDrifts,
      generatedAt: new Date().toISOString(),
    };

    alerts.push(alert);

    events.push(createAuditEvent({
      eventType: AuditEventType.DRIFT_DETECTED, // Use drift.detected to capture the routing outcome
      subjectNpi: sub.subjectNpi,
      actor: 'monitoring_engine',
      metadata: {
        alertId: alert.alertId,
        action: alert.action,
        employerId: sub.employerId,
        driftCount: npiDrifts.length,
      },
    }));
  }

  return { alerts, events };
}

/**
 * B239B-COM-017: AuditAlertService
 *
 * Detects anomalies in audit logs:
 * - Unexpected event spikes
 * - Failed access attempts
 * - Unusual patterns
 * Alerts admins with configurable thresholds.
 * Logs all alerts and responses.
 */

import { PrismaClient } from '@prisma/client';
import { getServiceLogger } from '../../logging/serviceLogger.js';
import { queryAuditLogs, getAuditStatistics } from '../../compliance/audit/auditLogQueryService.js';
import { createNotification } from '../../notifications/notificationService.js';

const prisma = new PrismaClient();
const log = getServiceLogger('compliance/alerts/audit');

export interface AlertThresholds {
  eventSpikeMultiplier?: number; // e.g., 2.0 = 2x normal rate
  failedAccessAttempts?: number; // Absolute count
  unusualActionThreshold?: number; // Percentage of total
  timeWindowMinutes?: number; // Window for anomaly detection
}

export interface AuditAlert {
  id: string;
  type: 'event_spike' | 'failed_access' | 'unusual_pattern' | 'threshold_exceeded';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  detectedAt: Date;
  metadata: Record<string, unknown>;
  acknowledged: boolean;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
}

const DEFAULT_THRESHOLDS: Required<AlertThresholds> = {
  eventSpikeMultiplier: 2.0,
  failedAccessAttempts: 10,
  unusualActionThreshold: 5, // 5% of total events
  timeWindowMinutes: 60,
};

/**
 * Detect anomalies and generate alerts
 */
export async function detectAnomalies(
  orgId?: string,
  thresholds: AlertThresholds = {}
): Promise<AuditAlert[]> {
  try {
    const config = { ...DEFAULT_THRESHOLDS, ...thresholds };
    const alerts: AuditAlert[] = [];

    // Get recent audit events for analysis
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - config.timeWindowMinutes * 60 * 1000);

    const recentLogs = await queryAuditLogs(
      {
        startDate,
        endDate,
      },
      { orgId, requireAccessRights: !!orgId }
    );

    // Detect event spikes
    const spikeAlerts = await detectEventSpikes(recentLogs.data, config, orgId);
    alerts.push(...spikeAlerts);

    // Detect failed access attempts
    const failedAccessAlerts = await detectFailedAccessAttempts(recentLogs.data, config, orgId);
    alerts.push(...failedAccessAlerts);

    // Detect unusual patterns
    const unusualPatternAlerts = await detectUnusualPatterns(recentLogs.data, config, orgId);
    alerts.push(...unusualPatternAlerts);

    // Store alerts
    for (const alert of alerts) {
      await storeAlert(alert, orgId);
    }

    // Send notifications for high-severity alerts
    const highSeverityAlerts = alerts.filter(
      (a) => a.severity === 'high' || a.severity === 'critical'
    );
    for (const alert of highSeverityAlerts) {
      await notifyAdmins(alert, orgId);
    }

    log.info('[detectAnomalies] Anomaly detection completed', {
      orgId,
      totalAlerts: alerts.length,
      highSeverity: highSeverityAlerts.length,
    });

    return alerts;
  } catch (error) {
    log.error('[detectAnomalies] Failed to detect anomalies', { error, orgId });
    throw error;
  }
}

async function detectEventSpikes(
  events: Array<{ timestamp: Date; action: string }>,
  config: Required<AlertThresholds>,
  orgId?: string
): Promise<AuditAlert[]> {
  const alerts: AuditAlert[] = [];

  // Group events by action and time window (e.g., per hour)
  const actionCounts: Record<string, number[]> = {};
  const timeWindows: Date[] = [];

  // Create time windows
  const windowSize = config.timeWindowMinutes / 6; // 6 windows per time period
  const startTime = events.length > 0 ? events[0].timestamp : new Date();
  for (let i = 0; i < 6; i++) {
    timeWindows.push(
      new Date(startTime.getTime() + i * windowSize * 60 * 1000)
    );
  }

  // Count events per action per window
  for (const event of events) {
    const action = event.action;
    if (!actionCounts[action]) {
      actionCounts[action] = new Array(6).fill(0);
    }
    const windowIndex = Math.min(
      5,
      Math.floor(
        (event.timestamp.getTime() - startTime.getTime()) / (windowSize * 60 * 1000)
      )
    );
    actionCounts[action][windowIndex]++;
  }

  // Detect spikes
  for (const [action, counts] of Object.entries(actionCounts)) {
    const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
    const max = Math.max(...counts);

    if (avg > 0 && max > avg * config.eventSpikeMultiplier) {
      alerts.push({
        id: `spike-${Date.now()}-${action}`,
        type: 'event_spike',
        severity: max > avg * 3 ? 'critical' : max > avg * 2 ? 'high' : 'medium',
        title: `Event spike detected for action: ${action}`,
        description: `Action "${action}" showed ${max} events in a time window, ${(max / avg).toFixed(1)}x the average (${avg.toFixed(1)})`,
        detectedAt: new Date(),
        metadata: {
          action,
          maxCount: max,
          averageCount: avg,
          multiplier: max / avg,
        },
        acknowledged: false,
        resolved: false,
      });
    }
  }

  return alerts;
}

async function detectFailedAccessAttempts(
  events: Array<{ action: string; details: unknown }>,
  config: Required<AlertThresholds>,
  orgId?: string
): Promise<AuditAlert[]> {
  const alerts: AuditAlert[] = [];

  const failedAttempts = events.filter((event) => {
    if (event.action !== 'access') return false;
    const details = event.details as Record<string, unknown> | null;
    return (
      details?.success === false ||
      details?.accessDenied === true ||
      details?.unauthorized === true
    );
  });

  if (failedAttempts.length >= config.failedAccessAttempts) {
    const uniqueActors = new Set(
      failedAttempts
        .map((e) => {
          const details = e.details as Record<string, unknown> | null;
          return details?.actorId || details?.userId;
        })
        .filter(Boolean)
    );

    alerts.push({
      id: `failed-access-${Date.now()}`,
      type: 'failed_access',
      severity:
        failedAttempts.length > 50
          ? 'critical'
          : failedAttempts.length > 20
          ? 'high'
          : 'medium',
      title: `Multiple failed access attempts detected`,
      description: `${failedAttempts.length} failed access attempts from ${uniqueActors.size} unique actor(s)`,
      detectedAt: new Date(),
      metadata: {
        failedAttempts: failedAttempts.length,
        uniqueActors: uniqueActors.size,
        threshold: config.failedAccessAttempts,
      },
      acknowledged: false,
      resolved: false,
    });
  }

  return alerts;
}

async function detectUnusualPatterns(
  events: Array<{ action: string; entityType: string }>,
  config: Required<AlertThresholds>,
  orgId?: string
): Promise<AuditAlert[]> {
  const alerts: AuditAlert[] = [];

  // Count actions
  const actionCounts: Record<string, number> = {};
  for (const event of events) {
    actionCounts[event.action] = (actionCounts[event.action] || 0) + 1;
  }

  const totalEvents = events.length;
  if (totalEvents === 0) return alerts;

  // Find unusual actions (low frequency but present)
  for (const [action, count] of Object.entries(actionCounts)) {
    const percentage = (count / totalEvents) * 100;
    if (percentage < config.unusualActionThreshold && count > 0) {
      // Unusual action detected
      alerts.push({
        id: `unusual-pattern-${Date.now()}-${action}`,
        type: 'unusual_pattern',
        severity: 'low',
        title: `Unusual action pattern detected: ${action}`,
        description: `Action "${action}" represents ${percentage.toFixed(2)}% of events, which is below the normal threshold`,
        detectedAt: new Date(),
        metadata: {
          action,
          count,
          percentage,
          totalEvents,
        },
        acknowledged: false,
        resolved: false,
      });
    }
  }

  return alerts;
}

async function storeAlert(alert: AuditAlert, orgId?: string): Promise<void> {
  try {
    // In a real implementation, this would store to a database table
    // For now, we'll log it and could extend to use a proper alerts table
    log.warn('[storeAlert] Alert detected', {
      alertId: alert.id,
      type: alert.type,
      severity: alert.severity,
      orgId,
    });

    // TODO: Store in database if Alert model exists
    // await prisma.auditAlert.create({ data: { ...alert, orgId } });
  } catch (error) {
    log.error('[storeAlert] Failed to store alert', { error, alert });
  }
}

async function notifyAdmins(alert: AuditAlert, orgId?: string): Promise<void> {
  try {
    if (!orgId) {
      // Notify system admins
      log.warn('[notifyAdmins] Alert (no org context)', {
        alertId: alert.id,
        type: alert.type,
        severity: alert.severity,
      });
      return;
    }

    // Get org admins
    const admins = await prisma.orgMembership.findMany({
      where: {
        orgId,
        role: 'ADMIN', // Assuming this enum exists
      },
      select: { userId: true },
    });

    for (const admin of admins) {
      await createNotification(admin.userId, 'compliance.audit.alert', {
        alertId: alert.id,
        type: alert.type,
        severity: alert.severity,
        title: alert.title,
        description: alert.description,
        metadata: alert.metadata,
      });
    }

    log.info('[notifyAdmins] Notifications sent', {
      alertId: alert.id,
      orgId,
      adminCount: admins.length,
    });
  } catch (error) {
    log.error('[notifyAdmins] Failed to notify admins', { error, alert, orgId });
  }
}

/**
 * Acknowledge an alert
 */
export async function acknowledgeAlert(
  alertId: string,
  userId: string
): Promise<void> {
  try {
    log.info('[acknowledgeAlert] Alert acknowledged', { alertId, userId });
    // TODO: Update alert in database
    // await prisma.auditAlert.update({
    //   where: { id: alertId },
    //   data: {
    //     acknowledged: true,
    //     acknowledgedAt: new Date(),
    //     acknowledgedBy: userId,
    //   },
    // });
  } catch (error) {
    log.error('[acknowledgeAlert] Failed to acknowledge alert', { error, alertId, userId });
    throw error;
  }
}

/**
 * Resolve an alert
 */
export async function resolveAlert(
  alertId: string,
  userId: string
): Promise<void> {
  try {
    log.info('[resolveAlert] Alert resolved', { alertId, userId });
    // TODO: Update alert in database
    // await prisma.auditAlert.update({
    //   where: { id: alertId },
    //   data: {
    //     resolved: true,
    //     resolvedAt: new Date(),
    //     resolvedBy: userId,
    //   },
    // });
  } catch (error) {
    log.error('[resolveAlert] Failed to resolve alert', { error, alertId, userId });
    throw error;
  }
}

/**
 * Get active alerts
 */
export async function getActiveAlerts(
  orgId?: string
): Promise<AuditAlert[]> {
  try {
    // TODO: Query from database
    // return await prisma.auditAlert.findMany({
    //   where: {
    //     orgId,
    //     resolved: false,
    //   },
    //   orderBy: {
    //     detectedAt: 'desc',
    //   },
    // });
    return [];
  } catch (error) {
    log.error('[getActiveAlerts] Failed to get active alerts', { error, orgId });
    throw error;
  }
}


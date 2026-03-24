/**
 * connectorHealthTracker.ts — Wave 127+: Connector Reliability Tracking
 *
 * Wraps the shared connector reliability controls used by provider
 * connectors so health routes, mission ops, and system sweep can
 * consume a single report shape.
 */

import {
  buildConnectorDiagnostics,
  getConnectorAlerts as getSharedConnectorAlerts,
  type ConnectorDiagnosticsReport,
} from '../../../../../../../core/connectors/diagnostics';
import {
  connectorHealthMonitor,
  type ConnectorAlert,
} from '../../../../../../../core/connectors/healthMonitor';
import {
  connectorQuotaManager,
  type ConnectorQuotaSnapshot,
} from '../../../../../../../core/connectors/quotaManager';
import {
  connectorSchemaDriftDetector,
  type ConnectorSchemaState,
} from '../../../../../../../core/connectors/schemaDrift';
import { log } from '../../../obs/logger';
import { emitAlert } from '../../alerts/trustAlerts';
import type { ConnectorMode, ConnectorName } from './connectorFactory';
import { getConnectorMode } from './connectorFactory';

export interface ConnectorHealthEntry {
  connector: ConnectorName;
  mode: ConnectorMode;
  status: 'HEALTHY' | 'DEGRADED' | 'UNREACHABLE';
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastError: string | null;
  successCount: number;
  errorCount: number;
  consecutiveErrors: number;
  quarantined: boolean;
  quarantinedUntil: string | null;
  quarantineReason: string | null;
  latestStatusChangeAt: string | null;
  latestStatusChangeReason: string | null;
  alertCount: number;
  totalRequests: number;
  totalRetries: number;
  rateLimitHits: number;
  remainingQuota: number;
  quotaResetAt: string | null;
  quotaWindowRemainingMs: number;
  quotaUtilizationRatio: number;
  nearQuotaLimit: boolean;
  quotaAlertThreshold: number;
  lastRetryAfterMs: number | null;
  lastLatencyMs: number | null;
  averageLatencyMs: number | null;
  schemaDriftDetected: boolean;
  schemaDriftSeverity: ConnectorSchemaState['severity'];
  schemaBaselineState: ConnectorSchemaState['baselineState'];
  schemaCandidateSamples: number;
}

export interface ConnectorHealthReport {
  connectors: ConnectorHealthEntry[];
  overall: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
  reportedAt: string;
}

export interface ConnectorCallMetrics {
  latencyMs?: number;
  retries?: number;
  details?: Record<string, unknown>;
}

export interface ConnectorQuarantineState {
  active: boolean;
  until: string | null;
  reason: string | null;
}

export const ALL_CONNECTORS: ConnectorName[] = ['NPPES', 'STATE_BOARD', 'OIG', 'ABMS', 'CAQH', 'NPDB'];

function isQuotaBlocked(snapshot: ConnectorQuotaSnapshot): boolean {
  return Boolean(snapshot.blockedUntil && Date.parse(snapshot.blockedUntil) > Date.now());
}

function computeEntryStatus(
  baseStatus: 'HEALTHY' | 'DEGRADED' | 'UNREACHABLE' | 'QUARANTINED',
  quota: ConnectorQuotaSnapshot,
  schema: ConnectorSchemaState,
): ConnectorHealthEntry['status'] {
  if (baseStatus === 'QUARANTINED' || baseStatus === 'UNREACHABLE' || schema.severity === 'CRITICAL') {
    return 'UNREACHABLE';
  }

  if (baseStatus === 'DEGRADED' || isQuotaBlocked(quota) || schema.severity === 'WARN') {
    return 'DEGRADED';
  }

  return 'HEALTHY';
}

function mapAlertSeverity(alert: ConnectorAlert): 'INFO' | 'WARNING' | 'CRITICAL' {
  if (alert.severity === 'CRITICAL') {
    return 'CRITICAL';
  }
  if (alert.severity === 'WARN') {
    return 'WARNING';
  }
  return 'INFO';
}

function buildAlertTitle(alert: ConnectorAlert): string {
  switch (alert.type) {
    case 'RATE_LIMIT':
      return `${alert.connector} connector rate limited`;
    case 'SCHEMA_DRIFT':
      return `${alert.connector} connector schema drift`;
    case 'QUARANTINE':
      return `${alert.connector} connector quarantined`;
    case 'FAILURE':
      return `${alert.connector} connector failure`;
    case 'RECOVERY':
      return `${alert.connector} connector recovered`;
    default:
      return `${alert.connector} connector alert`;
  }
}

function buildRecommendedAction(alert: ConnectorAlert): string {
  switch (alert.type) {
    case 'RATE_LIMIT':
      return 'Honor Retry-After, reduce connector traffic, and confirm upstream quota settings.';
    case 'SCHEMA_DRIFT':
      return 'Review connector contract changes and update mappings before restoring normal traffic.';
    case 'QUARANTINE':
      return 'Run a successful probe or clear the quarantine explicitly before re-enabling connector traffic.';
    case 'FAILURE':
      return 'Inspect upstream reachability, credentials, and recent connector changes.';
    case 'RECOVERY':
      return 'Monitor the connector to confirm stability after recovery.';
    default:
      return 'Review connector diagnostics and operator recommendations.';
  }
}

function emitConnectorTrustAlert(alert: ConnectorAlert): void {
  if (alert.type === 'RECOVERY') {
    return;
  }

  void emitAlert({
    type: 'verification_failure',
    severity: mapAlertSeverity(alert),
    title: buildAlertTitle(alert),
    description: alert.message,
    subject: `connector:${alert.connector}`,
    recommendedAction: buildRecommendedAction(alert),
  }).catch((error) => {
    log('error', 'connector_trust_alert_emit_failed', {
      connector: alert.connector,
      error: error instanceof Error ? error.message : String(error),
    });
  });
}

function captureNewAlerts<T>(connector: ConnectorName, action: () => T): T {
  const before = connectorHealthMonitor.getHealth(connector).alertCount;
  const result = action();
  const after = connectorHealthMonitor.getHealth(connector).alertCount;
  const newAlerts = connectorHealthMonitor
    .getAlerts(connector, Math.max(0, after - before))
    .reverse();

  for (const alert of newAlerts) {
    emitConnectorTrustAlert(alert);
  }

  return result;
}

export function recordConnectorSuccess(connector: ConnectorName, metrics: ConnectorCallMetrics = {}): void {
  captureNewAlerts(connector, () => connectorHealthMonitor.recordSuccess({
    connector,
    latencyMs: metrics.latencyMs,
    retries: metrics.retries,
  }));
}

export function recordConnectorFailure(
  connector: ConnectorName,
  error: string,
  metrics: ConnectorCallMetrics = {},
): void {
  captureNewAlerts(connector, () => connectorHealthMonitor.recordFailure({
    connector,
    error,
    latencyMs: metrics.latencyMs,
    retries: metrics.retries,
    details: metrics.details,
  }));
}

export function recordConnectorRetry(
  connector: ConnectorName,
  attempt: number,
  delayMs: number,
  reason?: string,
  details: {
    classification?: 'retry-after' | 'backoff';
    retryAfterMs?: number | null;
    totalDelayMs?: number;
  } = {},
): void {
  captureNewAlerts(connector, () => connectorHealthMonitor.recordRetry({
    connector,
    attempt,
    delayMs,
    reason,
    classification: details.classification,
    retryAfterMs: details.retryAfterMs,
    totalDelayMs: details.totalDelayMs,
  }));
}

export function recordConnectorRateLimit(
  connector: ConnectorName,
  retryAfterMs?: number | null,
  message?: string,
): void {
  captureNewAlerts(connector, () => connectorHealthMonitor.recordRateLimit({
    connector,
    retryAfterMs: retryAfterMs ?? undefined,
    message,
  }));
}

export function recordConnectorSchemaDrift(connector: ConnectorName, state: ConnectorSchemaState): void {
  if (!state.detected) {
    return;
  }

  const detailParts = [
    state.missingRequiredFields.length > 0 ? `missing required: ${state.missingRequiredFields.join(', ')}` : null,
    state.typeChanges.length > 0 ? `type changes: ${state.typeChanges.map((change) => change.field).join(', ')}` : null,
    state.additionalFields.length > 0 ? `additional fields: ${state.additionalFields.join(', ')}` : null,
    state.missingFields.length > 0 ? `missing fields: ${state.missingFields.join(', ')}` : null,
  ].filter(Boolean);

  captureNewAlerts(connector, () => connectorHealthMonitor.recordSchemaDrift({
    connector,
    severity: state.severity === 'CRITICAL' ? 'CRITICAL' : 'WARN',
    message:
      detailParts.length > 0
        ? `${connector} schema drift detected (${detailParts.join('; ')})`
        : `${connector} schema drift detected`,
    details: {
      baselineFingerprint: state.baselineFingerprint,
      currentFingerprint: state.currentFingerprint,
      baselineState: state.baselineState,
    },
  }));
}

export function quarantineConnector(
  connector: ConnectorName,
  reason: string,
  durationMs: number,
): void {
  captureNewAlerts(connector, () => connectorHealthMonitor.quarantine({
    connector,
    reason,
    durationMs,
  }));
}

export function clearConnectorQuarantine(connector: ConnectorName): void {
  connectorHealthMonitor.clearQuarantine(connector);
}

export function getConnectorQuarantineState(connector: ConnectorName): ConnectorQuarantineState {
  const snapshot = connectorHealthMonitor.getHealth(connector);
  return {
    active: snapshot.status === 'QUARANTINED',
    until: snapshot.quarantinedUntil,
    reason: snapshot.quarantineReason,
  };
}

export function getConnectorHealth(): ConnectorHealthReport {
  const connectors: ConnectorHealthEntry[] = ALL_CONNECTORS.map((connector) => {
    const snapshot = connectorHealthMonitor.getHealth(connector);
    const quota = connectorQuotaManager.getSnapshot(connector);
    const schema = connectorSchemaDriftDetector.getState(connector);

    return {
      connector,
      mode: getConnectorMode(connector),
      status: computeEntryStatus(snapshot.status, quota, schema),
      lastSuccessAt: snapshot.lastSuccessAt,
      lastErrorAt: snapshot.lastFailureAt,
      lastError: snapshot.lastError,
      successCount: snapshot.successCount,
      errorCount: snapshot.failureCount,
      consecutiveErrors: snapshot.consecutiveFailures,
      quarantined: snapshot.status === 'QUARANTINED',
      quarantinedUntil: snapshot.quarantinedUntil,
      quarantineReason: snapshot.quarantineReason,
      latestStatusChangeAt: snapshot.latestStatusChangeAt,
      latestStatusChangeReason: snapshot.latestStatusChangeReason,
      alertCount: snapshot.alertCount,
      totalRequests: snapshot.telemetry.totalRequests,
      totalRetries: snapshot.telemetry.totalRetries,
      rateLimitHits: quota.rateLimitHits,
      remainingQuota: quota.remaining,
      quotaResetAt: quota.resetAt,
      quotaWindowRemainingMs: quota.windowRemainingMs,
      quotaUtilizationRatio: quota.utilizationRatio,
      nearQuotaLimit: quota.nearLimit,
      quotaAlertThreshold: quota.alertThreshold,
      lastRetryAfterMs: quota.lastRetryAfterMs,
      lastLatencyMs: snapshot.telemetry.lastLatencyMs,
      averageLatencyMs: snapshot.telemetry.averageLatencyMs,
      schemaDriftDetected: schema.detected || schema.additionalFields.length > 0,
      schemaDriftSeverity: schema.severity,
      schemaBaselineState: schema.baselineState,
      schemaCandidateSamples: schema.candidateSamples,
    };
  });

  const unreachable = connectors.filter((entry) => entry.status === 'UNREACHABLE').length;
  const degraded = connectors.filter((entry) => entry.status === 'DEGRADED').length;
  const overall: ConnectorHealthReport['overall'] =
    unreachable >= 3 ? 'CRITICAL'
    : unreachable >= 1 || degraded >= 2 ? 'DEGRADED'
    : 'HEALTHY';

  return {
    connectors,
    overall,
    reportedAt: new Date().toISOString(),
  };
}

export function getConnectorDiagnostics(): ConnectorDiagnosticsReport {
  return buildConnectorDiagnostics({
    connectors: ALL_CONNECTORS,
    alertsLimit: 10,
  });
}

export function getConnectorAlerts(limit = 50): ConnectorAlert[] {
  return getSharedConnectorAlerts(ALL_CONNECTORS, connectorHealthMonitor, limit);
}

export function resetConnectorHealth(): void {
  connectorHealthMonitor.reset();
  connectorQuotaManager.reset();
  connectorSchemaDriftDetector.reset();
}

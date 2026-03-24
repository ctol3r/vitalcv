import {
  ConnectorHealthMonitor,
  connectorHealthMonitor,
  type ConnectorAlert,
  type ConnectorHealthSnapshot,
} from './healthMonitor';
import {
  ConnectorQuotaManager,
  connectorQuotaManager,
  type ConnectorQuotaSnapshot,
} from './quotaManager';
import {
  ConnectorSchemaDriftDetector,
  connectorSchemaDriftDetector,
  type ConnectorSchemaState,
} from './schemaDrift';

export interface ConnectorRecommendation {
  severity: 'INFO' | 'WARN' | 'CRITICAL';
  message: string;
}

export interface ConnectorDiagnosticsEntry {
  connector: string;
  status: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
  statusReasons: string[];
  nextAction: string | null;
  health: ConnectorHealthSnapshot;
  quota: ConnectorQuotaSnapshot;
  schema: ConnectorSchemaState;
  recentAlerts: ConnectorAlert[];
  recommendations: ConnectorRecommendation[];
}

export interface ConnectorDiagnosticsReport {
  connectors: ConnectorDiagnosticsEntry[];
  overall: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
  generatedAt: string;
}

export interface BuildConnectorDiagnosticsOptions {
  connectors: readonly string[];
  healthMonitor?: ConnectorHealthMonitor;
  quotaManager?: ConnectorQuotaManager;
  schemaDriftDetector?: ConnectorSchemaDriftDetector;
  alertsLimit?: number;
}

function isQuotaBlocked(quota: ConnectorQuotaSnapshot): boolean {
  return Boolean(quota.blockedUntil && Date.parse(quota.blockedUntil) > Date.now());
}

function computeEntryStatus(
  health: ConnectorHealthSnapshot,
  quota: ConnectorQuotaSnapshot,
  schema: ConnectorSchemaState,
): ConnectorDiagnosticsEntry['status'] {
  if (health.status === 'QUARANTINED' || health.status === 'UNREACHABLE' || schema.severity === 'CRITICAL') {
    return 'CRITICAL';
  }

  if (health.status === 'DEGRADED' || isQuotaBlocked(quota) || schema.severity === 'WARN') {
    return 'DEGRADED';
  }

  return 'HEALTHY';
}

function buildStatusReasons(
  health: ConnectorHealthSnapshot,
  quota: ConnectorQuotaSnapshot,
  schema: ConnectorSchemaState,
): string[] {
  const reasons: string[] = [];

  if (health.status === 'QUARANTINED' && health.quarantineReason) {
    reasons.push(`Connector is quarantined: ${health.quarantineReason}`);
  } else if (health.status === 'UNREACHABLE') {
    reasons.push(`Connector is unreachable after ${health.consecutiveFailures} consecutive failures.`);
  } else if (health.status === 'DEGRADED') {
    reasons.push(`Connector is degraded after ${health.consecutiveFailures} consecutive failures.`);
  }

  if (isQuotaBlocked(quota) && quota.blockedUntil) {
    reasons.push(`Connector quota is blocked until ${quota.blockedUntil}.`);
  } else if (quota.nearLimit) {
    reasons.push(`Connector is near its quota limit (${Math.round(quota.utilizationRatio * 100)}% used).`);
  }

  if (schema.severity === 'CRITICAL') {
    reasons.push('Schema drift changed required fields or field types.');
  } else if (schema.severity === 'WARN') {
    reasons.push('Schema drift changed optional fields or introduced disallowed additive fields.');
  } else if (schema.additionalFields.length > 0) {
    reasons.push(`Schema added ${schema.additionalFields.length} additive field(s) that should be reviewed before use.`);
  } else if (schema.baselineState === 'LEARNING') {
    reasons.push(`Schema baseline is still learning (${schema.candidateSamples}/${2} stable samples).`);
  }

  if (reasons.length === 0) {
    reasons.push('Connector is operating within configured reliability controls.');
  }

  return reasons;
}

function buildRecommendations(
  health: ConnectorHealthSnapshot,
  quota: ConnectorQuotaSnapshot,
  schema: ConnectorSchemaState,
): ConnectorRecommendation[] {
  const recommendations: ConnectorRecommendation[] = [];

  if (health.status === 'QUARANTINED' && health.quarantinedUntil) {
    recommendations.push({
      severity: 'CRITICAL',
      message: `Connector is fail-closed quarantined until at least ${health.quarantinedUntil}; investigate and run a successful probe before re-enabling traffic.`,
    });
  }

  if (health.consecutiveFailures >= 2) {
    recommendations.push({
      severity: health.consecutiveFailures >= 5 ? 'CRITICAL' : 'WARN',
      message: `Connector has ${health.consecutiveFailures} consecutive failures; inspect upstream reachability, credentials, and recent deployment changes.`,
    });
  }

  if (isQuotaBlocked(quota) && quota.blockedUntil) {
    recommendations.push({
      severity: 'WARN',
      message: `Connector is rate limited until ${quota.blockedUntil}; honor Retry-After before retrying.`,
    });
  } else if (quota.nearLimit) {
    recommendations.push({
      severity: 'INFO',
      message: `Connector quota is ${Math.round(quota.utilizationRatio * 100)}% utilized; slow polling or spread traffic before hard blocking begins.`,
    });
  }

  if (schema.severity === 'CRITICAL') {
    recommendations.push({
      severity: 'CRITICAL',
      message: 'Schema drift is affecting required fields or types; review mappings before promoting additional traffic.',
    });
  } else if (schema.severity === 'WARN') {
    recommendations.push({
      severity: 'WARN',
      message: 'Schema drift is affecting optional baseline fields or violating additive-field policy; review the connector contract.',
    });
  } else if (schema.additionalFields.length > 0) {
    recommendations.push({
      severity: 'INFO',
      message: 'Schema added new optional fields; confirm downstream mappings before consuming the new payload shape.',
    });
  } else if (schema.baselineState === 'LEARNING') {
    recommendations.push({
      severity: 'INFO',
      message: 'Schema baseline is still learning; avoid treating additive differences as production drift until the baseline stabilizes.',
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      severity: 'INFO',
      message: 'Connector is operating within configured reliability controls.',
    });
  }

  return recommendations;
}

export function buildConnectorDiagnostics(
  options: BuildConnectorDiagnosticsOptions,
): ConnectorDiagnosticsReport {
  const healthMonitor = options.healthMonitor ?? connectorHealthMonitor;
  const quotaManager = options.quotaManager ?? connectorQuotaManager;
  const schemaDriftDetector = options.schemaDriftDetector ?? connectorSchemaDriftDetector;

  const connectors = options.connectors.map((connector) => {
    const health = healthMonitor.getHealth(connector);
    const quota = quotaManager.getSnapshot(connector);
    const schema = schemaDriftDetector.getState(connector);
    const recentAlerts = healthMonitor.getAlerts(connector, options.alertsLimit ?? 10);
    const status = computeEntryStatus(health, quota, schema);
    const statusReasons = buildStatusReasons(health, quota, schema);
    const recommendations = buildRecommendations(health, quota, schema);

    return {
      connector,
      status,
      statusReasons,
      nextAction: recommendations[0]?.message ?? null,
      health,
      quota,
      schema,
      recentAlerts,
      recommendations,
    };
  });

  const overall =
    connectors.some((entry) => entry.status === 'CRITICAL') ? 'CRITICAL'
    : connectors.some((entry) => entry.status === 'DEGRADED') ? 'DEGRADED'
    : 'HEALTHY';

  return {
    connectors,
    overall,
    generatedAt: new Date().toISOString(),
  };
}

export function getConnectorAlerts(
  connectors: readonly string[],
  healthMonitor: ConnectorHealthMonitor = connectorHealthMonitor,
  limit = 50,
): ConnectorAlert[] {
  return connectors
    .flatMap((connector) => healthMonitor.getAlerts(connector, limit))
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
    .slice(0, limit);
}

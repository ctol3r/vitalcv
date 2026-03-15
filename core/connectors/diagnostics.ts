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

function computeEntryStatus(
  health: ConnectorHealthSnapshot,
  quota: ConnectorQuotaSnapshot,
  schema: ConnectorSchemaState,
): ConnectorDiagnosticsEntry['status'] {
  const quotaBlocked = Boolean(quota.blockedUntil && Date.parse(quota.blockedUntil) > Date.now());

  if (health.status === 'QUARANTINED' || health.status === 'UNREACHABLE' || schema.severity === 'CRITICAL') {
    return 'CRITICAL';
  }

  if (health.status === 'DEGRADED' || quotaBlocked || schema.detected) {
    return 'DEGRADED';
  }

  return 'HEALTHY';
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
      message: `Connector is quarantined until ${health.quarantinedUntil}; investigate before re-enabling traffic.`,
    });
  }

  if (health.consecutiveFailures >= 2) {
    recommendations.push({
      severity: health.consecutiveFailures >= 5 ? 'CRITICAL' : 'WARN',
      message: `Connector has ${health.consecutiveFailures} consecutive failures; inspect upstream reachability and auth.`,
    });
  }

  if (quota.blockedUntil && Date.parse(quota.blockedUntil) > Date.now()) {
    recommendations.push({
      severity: 'WARN',
      message: `Connector is rate limited until ${quota.blockedUntil}; honor Retry-After before retrying.`,
    });
  }

  if (schema.detected) {
    recommendations.push({
      severity: schema.severity === 'CRITICAL' ? 'CRITICAL' : 'WARN',
      message:
        schema.severity === 'CRITICAL'
          ? 'Schema drift is affecting required fields or types; quarantine live traffic until the mapping is reviewed.'
          : 'Schema drift introduced additive changes; review mappings before promoting new fields.',
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

    return {
      connector,
      status,
      health,
      quota,
      schema,
      recentAlerts,
      recommendations: buildRecommendations(health, quota, schema),
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

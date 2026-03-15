export type ConnectorHealthStatus = 'HEALTHY' | 'DEGRADED' | 'UNREACHABLE' | 'QUARANTINED';
export type ConnectorAlertType = 'FAILURE' | 'RATE_LIMIT' | 'SCHEMA_DRIFT' | 'QUARANTINE' | 'RECOVERY';
export type ConnectorAlertSeverity = 'INFO' | 'WARN' | 'CRITICAL';

export interface ConnectorTelemetrySnapshot {
  totalRequests: number;
  totalSuccesses: number;
  totalFailures: number;
  totalRetries: number;
  totalRateLimitHits: number;
  totalSchemaDriftEvents: number;
  totalQuarantines: number;
  lastLatencyMs: number | null;
  averageLatencyMs: number | null;
  lastAttemptAt: string | null;
}

export interface ConnectorAlert {
  id: string;
  connector: string;
  type: ConnectorAlertType;
  severity: ConnectorAlertSeverity;
  message: string;
  createdAt: string;
  details?: Record<string, unknown>;
}

export interface ConnectorHealthSnapshot {
  connector: string;
  status: ConnectorHealthStatus;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastError: string | null;
  successCount: number;
  failureCount: number;
  consecutiveFailures: number;
  quarantinedUntil: string | null;
  quarantineReason: string | null;
  telemetry: ConnectorTelemetrySnapshot;
  alertCount: number;
}

export interface ConnectorHealthReport {
  connectors: ConnectorHealthSnapshot[];
  overall: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
  reportedAt: string;
}

export interface RecordConnectorSuccessInput {
  connector: string;
  latencyMs?: number;
  retries?: number;
  recordedAt?: string;
}

export interface RecordConnectorFailureInput {
  connector: string;
  error: string;
  latencyMs?: number;
  retries?: number;
  recordedAt?: string;
  severity?: ConnectorAlertSeverity;
  details?: Record<string, unknown>;
}

export interface RecordConnectorRetryInput {
  connector: string;
  attempt: number;
  delayMs: number;
  reason?: string;
  recordedAt?: string;
}

export interface RecordConnectorRateLimitInput {
  connector: string;
  message?: string;
  retryAfterMs?: number;
  recordedAt?: string;
  details?: Record<string, unknown>;
}

export interface RecordConnectorSchemaDriftInput {
  connector: string;
  message: string;
  severity: Exclude<ConnectorAlertSeverity, 'INFO'>;
  recordedAt?: string;
  details?: Record<string, unknown>;
}

export interface ConnectorQuarantineInput {
  connector: string;
  reason: string;
  durationMs: number;
  recordedAt?: string;
  details?: Record<string, unknown>;
}

interface MutableConnectorState {
  successCount: number;
  failureCount: number;
  consecutiveFailures: number;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastError: string | null;
  quarantinedUntil: string | null;
  quarantineReason: string | null;
  telemetry: {
    totalRequests: number;
    totalSuccesses: number;
    totalFailures: number;
    totalRetries: number;
    totalRateLimitHits: number;
    totalSchemaDriftEvents: number;
    totalQuarantines: number;
    lastLatencyMs: number | null;
    latencySamples: number;
    latencyTotalMs: number;
    lastAttemptAt: string | null;
  };
  alerts: ConnectorAlert[];
}

export interface ConnectorHealthMonitorOptions {
  degradedThreshold?: number;
  unreachableThreshold?: number;
  quarantineThreshold?: number;
  defaultQuarantineMs?: number;
  maxAlertsPerConnector?: number;
}

const DEFAULT_OPTIONS: Required<ConnectorHealthMonitorOptions> = {
  degradedThreshold: 2,
  unreachableThreshold: 5,
  quarantineThreshold: 7,
  defaultQuarantineMs: 15 * 60_000,
  maxAlertsPerConnector: 50,
};

function nowIso(value?: string): string {
  return value ?? new Date().toISOString();
}

function toFutureIso(recordedAtIso: string, durationMs: number): string {
  return new Date(Date.parse(recordedAtIso) + Math.max(0, durationMs)).toISOString();
}

export class ConnectorHealthMonitor {
  private readonly states = new Map<string, MutableConnectorState>();
  private readonly options: Required<ConnectorHealthMonitorOptions>;

  constructor(options: ConnectorHealthMonitorOptions = {}) {
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
    };
  }

  recordSuccess(input: RecordConnectorSuccessInput): ConnectorHealthSnapshot {
    const state = this.getState(input.connector);
    const recordedAt = nowIso(input.recordedAt);
    const previouslyDegraded = state.consecutiveFailures >= this.options.degradedThreshold;
    const wasQuarantined = this.isQuarantineActive(state, recordedAt);

    state.successCount += 1;
    state.consecutiveFailures = 0;
    state.lastSuccessAt = recordedAt;
    state.lastError = null;
    state.quarantinedUntil = null;
    state.quarantineReason = null;
    state.telemetry.totalRequests += 1;
    state.telemetry.totalSuccesses += 1;
    state.telemetry.lastAttemptAt = recordedAt;

    if (typeof input.retries === 'number' && input.retries > 0) {
      state.telemetry.totalRetries += input.retries;
    }

    if (typeof input.latencyMs === 'number' && Number.isFinite(input.latencyMs) && input.latencyMs >= 0) {
      state.telemetry.lastLatencyMs = input.latencyMs;
      state.telemetry.latencySamples += 1;
      state.telemetry.latencyTotalMs += input.latencyMs;
    }

    if (previouslyDegraded || wasQuarantined) {
      this.pushAlert(input.connector, {
        type: 'RECOVERY',
        severity: 'INFO',
        message: `${input.connector} recovered after connector failures`,
        createdAt: recordedAt,
      });
    }

    return this.getHealth(input.connector, recordedAt);
  }

  recordFailure(input: RecordConnectorFailureInput): ConnectorHealthSnapshot {
    const state = this.getState(input.connector);
    const recordedAt = nowIso(input.recordedAt);

    state.failureCount += 1;
    state.consecutiveFailures += 1;
    state.lastFailureAt = recordedAt;
    state.lastError = input.error;
    state.telemetry.totalRequests += 1;
    state.telemetry.totalFailures += 1;
    state.telemetry.lastAttemptAt = recordedAt;

    if (typeof input.retries === 'number' && input.retries > 0) {
      state.telemetry.totalRetries += input.retries;
    }

    if (typeof input.latencyMs === 'number' && Number.isFinite(input.latencyMs) && input.latencyMs >= 0) {
      state.telemetry.lastLatencyMs = input.latencyMs;
      state.telemetry.latencySamples += 1;
      state.telemetry.latencyTotalMs += input.latencyMs;
    }

    const severity =
      input.severity
      ?? (state.consecutiveFailures >= this.options.unreachableThreshold ? 'CRITICAL' : 'WARN');

    this.pushAlert(input.connector, {
      type: 'FAILURE',
      severity,
      message: input.error,
      createdAt: recordedAt,
      details: {
        consecutiveFailures: state.consecutiveFailures,
        ...(input.details ?? {}),
      },
    });

    if (
      state.consecutiveFailures >= this.options.quarantineThreshold
      && !this.isQuarantineActive(state, recordedAt)
    ) {
      this.quarantine({
        connector: input.connector,
        reason: `Automatic quarantine after ${state.consecutiveFailures} consecutive failures`,
        durationMs: this.options.defaultQuarantineMs,
        recordedAt,
        details: {
          lastError: input.error,
        },
      });
    }

    return this.getHealth(input.connector, recordedAt);
  }

  recordRetry(input: RecordConnectorRetryInput): ConnectorHealthSnapshot {
    const state = this.getState(input.connector);
    const recordedAt = nowIso(input.recordedAt);

    state.telemetry.totalRetries += 1;
    state.telemetry.lastAttemptAt = recordedAt;

    this.pushAlert(input.connector, {
      type: 'FAILURE',
      severity: 'INFO',
      message: `Retry ${input.attempt} scheduled for ${input.connector}`,
      createdAt: recordedAt,
      details: {
        attempt: input.attempt,
        delayMs: input.delayMs,
        ...(input.reason ? { reason: input.reason } : {}),
      },
    });

    return this.getHealth(input.connector, recordedAt);
  }

  recordRateLimit(input: RecordConnectorRateLimitInput): ConnectorHealthSnapshot {
    const state = this.getState(input.connector);
    const recordedAt = nowIso(input.recordedAt);
    state.telemetry.totalRateLimitHits += 1;
    state.telemetry.lastAttemptAt = recordedAt;

    this.pushAlert(input.connector, {
      type: 'RATE_LIMIT',
      severity: 'WARN',
      message: input.message ?? `${input.connector} hit a connector quota or upstream rate limit`,
      createdAt: recordedAt,
      details: {
        ...(typeof input.retryAfterMs === 'number' ? { retryAfterMs: input.retryAfterMs } : {}),
        ...(input.details ?? {}),
      },
    });

    return this.getHealth(input.connector, recordedAt);
  }

  recordSchemaDrift(input: RecordConnectorSchemaDriftInput): ConnectorHealthSnapshot {
    const state = this.getState(input.connector);
    const recordedAt = nowIso(input.recordedAt);
    state.telemetry.totalSchemaDriftEvents += 1;
    state.telemetry.lastAttemptAt = recordedAt;

    this.pushAlert(input.connector, {
      type: 'SCHEMA_DRIFT',
      severity: input.severity,
      message: input.message,
      createdAt: recordedAt,
      details: input.details,
    });

    return this.getHealth(input.connector, recordedAt);
  }

  quarantine(input: ConnectorQuarantineInput): ConnectorHealthSnapshot {
    const state = this.getState(input.connector);
    const recordedAt = nowIso(input.recordedAt);

    state.quarantinedUntil = toFutureIso(recordedAt, input.durationMs);
    state.quarantineReason = input.reason;
    state.telemetry.totalQuarantines += 1;

    this.pushAlert(input.connector, {
      type: 'QUARANTINE',
      severity: 'CRITICAL',
      message: input.reason,
      createdAt: recordedAt,
      details: {
        durationMs: input.durationMs,
        quarantinedUntil: state.quarantinedUntil,
        ...(input.details ?? {}),
      },
    });

    return this.getHealth(input.connector, recordedAt);
  }

  clearQuarantine(connector: string): ConnectorHealthSnapshot {
    const state = this.getState(connector);
    state.quarantinedUntil = null;
    state.quarantineReason = null;
    return this.getHealth(connector);
  }

  isQuarantined(connector: string, atIso?: string): boolean {
    const state = this.getState(connector);
    return this.isQuarantineActive(state, nowIso(atIso));
  }

  getHealth(connector: string, atIso?: string): ConnectorHealthSnapshot {
    const state = this.getState(connector);
    const recordedAt = nowIso(atIso);
    const status =
      this.isQuarantineActive(state, recordedAt) ? 'QUARANTINED'
      : state.consecutiveFailures >= this.options.unreachableThreshold ? 'UNREACHABLE'
      : state.consecutiveFailures >= this.options.degradedThreshold ? 'DEGRADED'
      : 'HEALTHY';

    return {
      connector,
      status,
      lastSuccessAt: state.lastSuccessAt,
      lastFailureAt: state.lastFailureAt,
      lastError: state.lastError,
      successCount: state.successCount,
      failureCount: state.failureCount,
      consecutiveFailures: state.consecutiveFailures,
      quarantinedUntil: this.isQuarantineActive(state, recordedAt) ? state.quarantinedUntil : null,
      quarantineReason: this.isQuarantineActive(state, recordedAt) ? state.quarantineReason : null,
      telemetry: {
        totalRequests: state.telemetry.totalRequests,
        totalSuccesses: state.telemetry.totalSuccesses,
        totalFailures: state.telemetry.totalFailures,
        totalRetries: state.telemetry.totalRetries,
        totalRateLimitHits: state.telemetry.totalRateLimitHits,
        totalSchemaDriftEvents: state.telemetry.totalSchemaDriftEvents,
        totalQuarantines: state.telemetry.totalQuarantines,
        lastLatencyMs: state.telemetry.lastLatencyMs,
        averageLatencyMs:
          state.telemetry.latencySamples > 0
            ? Math.round((state.telemetry.latencyTotalMs / state.telemetry.latencySamples) * 100) / 100
            : null,
        lastAttemptAt: state.telemetry.lastAttemptAt,
      },
      alertCount: state.alerts.length,
    };
  }

  getHealthReport(connectors?: readonly string[]): ConnectorHealthReport {
    const selected = connectors && connectors.length > 0
      ? [...connectors]
      : [...this.states.keys()].sort((left, right) => left.localeCompare(right));

    const snapshots = selected.map((connector) => this.getHealth(connector));
    const overall =
      snapshots.some((snapshot) => snapshot.status === 'QUARANTINED') ? 'CRITICAL'
      : snapshots.filter((snapshot) => snapshot.status === 'UNREACHABLE').length >= 2 ? 'CRITICAL'
      : snapshots.some((snapshot) => snapshot.status === 'UNREACHABLE' || snapshot.status === 'DEGRADED')
        ? 'DEGRADED'
        : 'HEALTHY';

    return {
      connectors: snapshots,
      overall,
      reportedAt: new Date().toISOString(),
    };
  }

  getAlerts(connector?: string, limit?: number): ConnectorAlert[] {
    const alerts =
      connector
        ? [...this.getState(connector).alerts]
        : [...this.states.entries()]
            .flatMap(([name, state]) => state.alerts.map((alert) => ({ ...alert, connector: name })));

    alerts.sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));

    if (typeof limit === 'number' && limit >= 0) {
      return alerts.slice(0, limit);
    }

    return alerts;
  }

  reset(): void {
    this.states.clear();
  }

  private getState(connector: string): MutableConnectorState {
    if (!this.states.has(connector)) {
      this.states.set(connector, {
        successCount: 0,
        failureCount: 0,
        consecutiveFailures: 0,
        lastSuccessAt: null,
        lastFailureAt: null,
        lastError: null,
        quarantinedUntil: null,
        quarantineReason: null,
        telemetry: {
          totalRequests: 0,
          totalSuccesses: 0,
          totalFailures: 0,
          totalRetries: 0,
          totalRateLimitHits: 0,
          totalSchemaDriftEvents: 0,
          totalQuarantines: 0,
          lastLatencyMs: null,
          latencySamples: 0,
          latencyTotalMs: 0,
          lastAttemptAt: null,
        },
        alerts: [],
      });
    }

    return this.states.get(connector)!;
  }

  private isQuarantineActive(state: MutableConnectorState, atIso: string): boolean {
    return Boolean(state.quarantinedUntil && Date.parse(state.quarantinedUntil) > Date.parse(atIso));
  }

  private pushAlert(
    connector: string,
    input: Omit<ConnectorAlert, 'id' | 'connector'>,
  ): void {
    const state = this.getState(connector);
    const alert: ConnectorAlert = {
      id: `${connector}-${Date.now()}-${state.alerts.length + 1}`,
      connector,
      ...input,
    };

    state.alerts.unshift(alert);
    if (state.alerts.length > this.options.maxAlertsPerConnector) {
      state.alerts.length = this.options.maxAlertsPerConnector;
    }
  }
}

export const connectorHealthMonitor = new ConnectorHealthMonitor();

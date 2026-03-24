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
  latestStatusChangeAt: string | null;
  latestStatusChangeFrom: ConnectorHealthStatus | null;
  latestStatusChangeTo: ConnectorHealthStatus | null;
  latestStatusChangeReason: string | null;
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

export type RetryDelayClassification = 'retry-after' | 'backoff';

export interface RecordConnectorRetryInput {
  connector: string;
  attempt: number;
  delayMs: number;
  reason?: string;
  recordedAt?: string;
  classification?: RetryDelayClassification;
  retryAfterMs?: number | null;
  totalDelayMs?: number;
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

interface ConnectorStatusTransition {
  at: string | null;
  from: ConnectorHealthStatus | null;
  to: ConnectorHealthStatus | null;
  reason: string | null;
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
  currentStatus: ConnectorHealthStatus;
  latestStatusTransition: ConnectorStatusTransition;
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
  alertCooldowns: Map<string, string>;
}

export interface ConnectorHealthMonitorOptions {
  degradedThreshold?: number;
  unreachableThreshold?: number;
  quarantineThreshold?: number;
  defaultQuarantineMs?: number;
  maxAlertsPerConnector?: number;
  alertCooldownMs?: number;
}

const DEFAULT_OPTIONS: Required<ConnectorHealthMonitorOptions> = {
  degradedThreshold: 2,
  unreachableThreshold: 5,
  quarantineThreshold: 7,
  defaultQuarantineMs: 15 * 60_000,
  maxAlertsPerConnector: 50,
  alertCooldownMs: 5 * 60_000,
};

interface PushAlertOptions {
  dedupeKey?: string;
  bypassCooldown?: boolean;
}

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
    const previousStatus = state.currentStatus;

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

    this.recordLatency(state, input.latencyMs);
    this.updateStatusTransition(
      state,
      recordedAt,
      previousStatus === 'QUARANTINED'
        ? `${input.connector} recovered after a successful probe cleared quarantine`
        : `${input.connector} recovered after connector failures`,
    );

    if (previousStatus !== 'HEALTHY') {
      this.pushAlert(
        input.connector,
        {
          type: 'RECOVERY',
          severity: 'INFO',
          message:
            previousStatus === 'QUARANTINED'
              ? `${input.connector} recovered and cleared quarantine`
              : `${input.connector} recovered after connector failures`,
          createdAt: recordedAt,
          details: {
            previousStatus,
          },
        },
        { bypassCooldown: true },
      );
    }

    return this.getHealth(input.connector);
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

    this.recordLatency(state, input.latencyMs);

    const severity =
      input.severity
      ?? (state.consecutiveFailures >= this.options.unreachableThreshold ? 'CRITICAL' : 'WARN');

    this.updateStatusTransition(state, recordedAt, input.error);
    this.pushAlert(input.connector, {
      type: 'FAILURE',
      severity,
      message: input.error,
      createdAt: recordedAt,
      details: {
        consecutiveFailures: state.consecutiveFailures,
        status: state.currentStatus,
        ...(input.details ?? {}),
      },
    });

    if (
      state.consecutiveFailures >= this.options.quarantineThreshold
      && !this.isQuarantineActive(state)
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

    return this.getHealth(input.connector);
  }

  recordRetry(input: RecordConnectorRetryInput): ConnectorHealthSnapshot {
    const state = this.getState(input.connector);
    const recordedAt = nowIso(input.recordedAt);

    state.telemetry.totalRetries += 1;
    state.telemetry.lastAttemptAt = recordedAt;

    this.pushAlert(
      input.connector,
      {
        type: 'FAILURE',
        severity: 'INFO',
        message: `Retry ${input.attempt} scheduled for ${input.connector}`,
        createdAt: recordedAt,
        details: {
          attempt: input.attempt,
          delayMs: input.delayMs,
          classification: input.classification ?? 'backoff',
          ...(typeof input.retryAfterMs === 'number' ? { retryAfterMs: input.retryAfterMs } : {}),
          ...(typeof input.totalDelayMs === 'number' ? { totalDelayMs: input.totalDelayMs } : {}),
          ...(input.reason ? { reason: input.reason } : {}),
        },
      },
      {
        dedupeKey: [
          'RETRY',
          input.classification ?? 'backoff',
          input.reason ?? 'scheduled',
        ].join(':'),
      },
    );

    return this.getHealth(input.connector);
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

    return this.getHealth(input.connector);
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

    return this.getHealth(input.connector);
  }

  quarantine(input: ConnectorQuarantineInput): ConnectorHealthSnapshot {
    const state = this.getState(input.connector);
    const recordedAt = nowIso(input.recordedAt);

    state.quarantinedUntil = toFutureIso(recordedAt, input.durationMs);
    state.quarantineReason = input.reason;
    state.telemetry.totalQuarantines += 1;

    this.updateStatusTransition(state, recordedAt, input.reason);
    this.pushAlert(
      input.connector,
      {
        type: 'QUARANTINE',
        severity: 'CRITICAL',
        message: input.reason,
        createdAt: recordedAt,
        details: {
          durationMs: input.durationMs,
          quarantinedUntil: state.quarantinedUntil,
          ...(input.details ?? {}),
        },
      },
      { bypassCooldown: true },
    );

    return this.getHealth(input.connector);
  }

  clearQuarantine(connector: string, recordedAt?: string, reason?: string): ConnectorHealthSnapshot {
    const state = this.getState(connector);
    const clearedAt = nowIso(recordedAt);
    state.quarantinedUntil = null;
    state.quarantineReason = null;
    this.updateStatusTransition(
      state,
      clearedAt,
      reason ?? `${connector} quarantine cleared manually`,
    );
    return this.getHealth(connector);
  }

  isQuarantined(connector: string): boolean {
    const state = this.getState(connector);
    return this.isQuarantineActive(state);
  }

  getHealth(connector: string): ConnectorHealthSnapshot {
    const state = this.getState(connector);
    const averageLatencyMs =
      state.telemetry.latencySamples > 0
        ? Math.round((state.telemetry.latencyTotalMs / state.telemetry.latencySamples) * 100) / 100
        : null;

    return {
      connector,
      status: this.computeStatus(state),
      lastSuccessAt: state.lastSuccessAt,
      lastFailureAt: state.lastFailureAt,
      lastError: state.lastError,
      successCount: state.successCount,
      failureCount: state.failureCount,
      consecutiveFailures: state.consecutiveFailures,
      quarantinedUntil: this.isQuarantineActive(state) ? state.quarantinedUntil : null,
      quarantineReason: this.isQuarantineActive(state) ? state.quarantineReason : null,
      latestStatusChangeAt: state.latestStatusTransition.at,
      latestStatusChangeFrom: state.latestStatusTransition.from,
      latestStatusChangeTo: state.latestStatusTransition.to,
      latestStatusChangeReason: state.latestStatusTransition.reason,
      telemetry: {
        totalRequests: state.telemetry.totalRequests,
        totalSuccesses: state.telemetry.totalSuccesses,
        totalFailures: state.telemetry.totalFailures,
        totalRetries: state.telemetry.totalRetries,
        totalRateLimitHits: state.telemetry.totalRateLimitHits,
        totalSchemaDriftEvents: state.telemetry.totalSchemaDriftEvents,
        totalQuarantines: state.telemetry.totalQuarantines,
        lastLatencyMs: state.telemetry.lastLatencyMs,
        averageLatencyMs,
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
        currentStatus: 'HEALTHY',
        latestStatusTransition: {
          at: null,
          from: null,
          to: null,
          reason: null,
        },
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
        alertCooldowns: new Map<string, string>(),
      });
    }

    return this.states.get(connector)!;
  }

  private computeStatus(state: MutableConnectorState): ConnectorHealthStatus {
    if (this.isQuarantineActive(state)) {
      return 'QUARANTINED';
    }
    if (state.consecutiveFailures >= this.options.unreachableThreshold) {
      return 'UNREACHABLE';
    }
    if (state.consecutiveFailures >= this.options.degradedThreshold) {
      return 'DEGRADED';
    }
    return 'HEALTHY';
  }

  private isQuarantineActive(state: MutableConnectorState): boolean {
    return Boolean(state.quarantineReason);
  }

  private updateStatusTransition(
    state: MutableConnectorState,
    recordedAt: string,
    reason: string,
  ): void {
    const nextStatus = this.computeStatus(state);
    if (nextStatus === state.currentStatus) {
      return;
    }

    state.latestStatusTransition = {
      at: recordedAt,
      from: state.currentStatus,
      to: nextStatus,
      reason,
    };
    state.currentStatus = nextStatus;
  }

  private recordLatency(state: MutableConnectorState, latencyMs?: number): void {
    if (typeof latencyMs !== 'number' || !Number.isFinite(latencyMs) || latencyMs < 0) {
      return;
    }

    state.telemetry.lastLatencyMs = latencyMs;
    state.telemetry.latencySamples += 1;
    state.telemetry.latencyTotalMs += latencyMs;
  }

  private pushAlert(
    connector: string,
    input: Omit<ConnectorAlert, 'id' | 'connector'>,
    options: PushAlertOptions = {},
  ): boolean {
    const state = this.getState(connector);
    const dedupeKey = options.dedupeKey ?? `${input.type}:${input.severity}:${input.message}`;
    const lastEmittedAt = state.alertCooldowns.get(dedupeKey);

    if (
      !options.bypassCooldown
      && lastEmittedAt
      && Date.parse(input.createdAt) - Date.parse(lastEmittedAt) < this.options.alertCooldownMs
    ) {
      return false;
    }

    const alert: ConnectorAlert = {
      id: `${connector}-${Date.now()}-${state.alerts.length + 1}`,
      connector,
      ...input,
    };

    state.alertCooldowns.set(dedupeKey, input.createdAt);
    state.alerts.unshift(alert);
    if (state.alerts.length > this.options.maxAlertsPerConnector) {
      state.alerts.length = this.options.maxAlertsPerConnector;
    }

    return true;
  }
}

export const connectorHealthMonitor = new ConnectorHealthMonitor();

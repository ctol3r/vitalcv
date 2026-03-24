import { createHash } from 'node:crypto';
import { metrics, SpanStatusCode, trace } from '@opentelemetry/api';
import {
  ConnectorRateLimitError,
  executeWithRetry,
  isRetryableConnectorError,
  type ConnectorRetryPolicy,
} from '../../../../../../../core/connectors/retryPolicy';
import {
  ConnectorQuotaExceededError,
  connectorQuotaManager,
  type ConnectorQuotaPolicy,
} from '../../../../../../../core/connectors/quotaManager';
import {
  connectorSchemaDriftDetector,
  type ConnectorSchemaPolicy,
} from '../../../../../../../core/connectors/schemaDrift';
import type { ConnectorName } from './connectorFactory';
import {
  getConnectorQuarantineState,
  quarantineConnector,
  recordConnectorFailure,
  recordConnectorRateLimit,
  recordConnectorRetry,
  recordConnectorSchemaDrift,
  recordConnectorSuccess,
} from './connectorHealthTracker';

export interface ConnectorFallbackContext {
  connector: ConnectorName;
  stage: 'quarantine' | 'quota' | 'schema' | 'execution';
  reason: string;
  retryAfterMs?: number | null;
  error?: Error;
}

export interface RunConnectorWithReliabilityOptions<T> {
  connector: ConnectorName;
  quotaPolicy: ConnectorQuotaPolicy;
  schemaPolicy?: ConnectorSchemaPolicy;
  retryPolicy?: Partial<ConnectorRetryPolicy>;
  execute: () => Promise<T>;
  fallback: (context: ConnectorFallbackContext) => T;
  afterSuccess?: (result: T) => Promise<void> | void;
  onFailure?: (context: ConnectorFallbackContext) => void;
  quarantineOnCriticalSchemaDrift?: boolean;
  schemaDriftQuarantineMs?: number;
}

const DEFAULT_SCHEMA_DRIFT_QUARANTINE_MS = 15 * 60_000;
const DEFAULT_RATE_LIMIT_QUARANTINE_MS = 60_000;

const connectorTracer = trace.getTracer('vitalcv.connectors');
const connectorMeter = metrics.getMeter('vitalcv.connectors');
const connectorRequestCounter = connectorMeter.createCounter('vitalcv.connector.requests', {
  description: 'Connector reliability invocations.',
});
const connectorRetryCounter = connectorMeter.createCounter('vitalcv.connector.retries', {
  description: 'Connector retry attempts.',
});
const connectorFailureCounter = connectorMeter.createCounter('vitalcv.connector.failures', {
  description: 'Connector failures that resulted in fallback.',
});
const connectorRateLimitCounter = connectorMeter.createCounter('vitalcv.connector.rate_limit_hits', {
  description: 'Connector quota or upstream rate-limit hits.',
});
const connectorSchemaDriftCounter = connectorMeter.createCounter('vitalcv.connector.schema_drift_events', {
  description: 'Connector schema drift observations.',
});
const connectorQuarantineCounter = connectorMeter.createCounter('vitalcv.connector.quarantines', {
  description: 'Connector quarantine events.',
});
const connectorLatencyHistogram = connectorMeter.createHistogram('vitalcv.connector.latency_ms', {
  description: 'Connector end-to-end latency in milliseconds.',
  unit: 'ms',
});

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function hashConnectorRequestId(connector: ConnectorName, startedAtMs: number): string {
  return createHash('sha256')
    .update(`${connector}:${startedAtMs}`)
    .digest('hex');
}

function baseAttributes(connector: ConnectorName): Record<string, string> {
  return {
    'vitalcv.connector.name': connector,
  };
}

function failureAttributes(connector: ConnectorName, stage: ConnectorFallbackContext['stage']): Record<string, string> {
  return {
    ...baseAttributes(connector),
    'vitalcv.connector.stage': stage,
  };
}

export async function runConnectorWithReliability<T>(
  options: RunConnectorWithReliabilityOptions<T>,
): Promise<T> {
  const start = Date.now();
  const requestHash = hashConnectorRequestId(options.connector, start);

  connectorRequestCounter.add(1, baseAttributes(options.connector));

  return connectorTracer.startActiveSpan(`connector ${options.connector}`, async (span) => {
    span.setAttribute('vitalcv.connector.name', options.connector);
    span.setAttribute('vitalcv.connector.request.sha256', requestHash);

    try {
      const quarantine = getConnectorQuarantineState(options.connector);
      if (quarantine.active) {
        const context: ConnectorFallbackContext = {
          connector: options.connector,
          stage: 'quarantine',
          reason: quarantine.reason ?? `${options.connector} is quarantined`,
          retryAfterMs: quarantine.until ? Math.max(0, Date.parse(quarantine.until) - Date.now()) : null,
        };
        span.setAttribute('vitalcv.connector.fallback_stage', context.stage);
        span.setStatus({ code: SpanStatusCode.ERROR, message: context.stage });
        options.onFailure?.(context);
        return options.fallback(context);
      }

      const quotaSnapshot = connectorQuotaManager.consume({
        connector: options.connector,
        policy: options.quotaPolicy,
      });
      span.setAttribute('vitalcv.connector.quota.utilization_ratio', quotaSnapshot.utilizationRatio);
      span.setAttribute('vitalcv.connector.quota.near_limit', quotaSnapshot.nearLimit);

      const attemptResult = await executeWithRetry({
        connector: options.connector,
        policy: options.retryPolicy,
        operation: async () => options.execute(),
        shouldRetry: (error) => isRetryableConnectorError(error),
        onRetry: async ({ attempt, delayMs, error, reason, retryAfterMs, totalDelayMs }) => {
          connectorRetryCounter.add(1, {
            ...baseAttributes(options.connector),
            'vitalcv.connector.retry_reason': reason,
          });
          recordConnectorRetry(options.connector, attempt, delayMs, error.message, {
            classification: reason,
            retryAfterMs,
            totalDelayMs,
          });
        },
      });

      span.setAttribute('vitalcv.connector.attempts', attemptResult.attempts);
      span.setAttribute('vitalcv.connector.total_retry_delay_ms', attemptResult.totalDelayMs);

      const schemaState = options.schemaPolicy
        ? connectorSchemaDriftDetector.observe(options.connector, attemptResult.result, options.schemaPolicy)
        : null;

      if (schemaState?.detected) {
        connectorSchemaDriftCounter.add(1, {
          ...baseAttributes(options.connector),
          'vitalcv.connector.schema_severity': schemaState.severity,
        });
        recordConnectorSchemaDrift(options.connector, schemaState);

        if (schemaState.severity === 'CRITICAL' && options.quarantineOnCriticalSchemaDrift !== false) {
          const reason = `${options.connector} quarantined after critical schema drift`;
          connectorQuarantineCounter.add(1, failureAttributes(options.connector, 'schema'));
          quarantineConnector(
            options.connector,
            reason,
            options.schemaDriftQuarantineMs ?? DEFAULT_SCHEMA_DRIFT_QUARANTINE_MS,
          );
          const context: ConnectorFallbackContext = {
            connector: options.connector,
            stage: 'schema',
            reason,
          };
          span.setAttribute('vitalcv.connector.fallback_stage', context.stage);
          span.setStatus({ code: SpanStatusCode.ERROR, message: context.stage });
          options.onFailure?.(context);
          return options.fallback(context);
        }
      }

      if (options.afterSuccess) {
        await options.afterSuccess(attemptResult.result);
      }

      recordConnectorSuccess(options.connector, {
        latencyMs: Date.now() - start,
        retries: attemptResult.attempts - 1,
      });

      span.setStatus({ code: SpanStatusCode.OK });
      return attemptResult.result;
    } catch (error) {
      const normalizedError = toError(error);
      span.recordException(normalizedError);

      if (normalizedError instanceof ConnectorQuotaExceededError) {
        const retryAfterMs = normalizedError.retryAfterMs;
        connectorFailureCounter.add(1, failureAttributes(options.connector, 'quota'));
        connectorRateLimitCounter.add(1, failureAttributes(options.connector, 'quota'));
        connectorQuarantineCounter.add(1, failureAttributes(options.connector, 'quota'));
        connectorQuotaManager.recordRateLimit(
          options.connector,
          retryAfterMs,
          undefined,
          options.quotaPolicy,
        );
        recordConnectorRateLimit(options.connector, retryAfterMs, normalizedError.message);
        quarantineConnector(
          options.connector,
          normalizedError.message,
          retryAfterMs ?? DEFAULT_RATE_LIMIT_QUARANTINE_MS,
        );

        const context: ConnectorFallbackContext = {
          connector: options.connector,
          stage: 'quota',
          reason: normalizedError.message,
          retryAfterMs,
          error: normalizedError,
        };
        span.setAttribute('vitalcv.connector.fallback_stage', context.stage);
        span.setStatus({ code: SpanStatusCode.ERROR, message: context.stage });
        options.onFailure?.(context);
        return options.fallback(context);
      }

      if (normalizedError instanceof ConnectorRateLimitError) {
        const retryAfterMs = normalizedError.retryAfterMs ?? DEFAULT_RATE_LIMIT_QUARANTINE_MS;
        connectorFailureCounter.add(1, failureAttributes(options.connector, 'quota'));
        connectorRateLimitCounter.add(1, failureAttributes(options.connector, 'quota'));
        connectorQuarantineCounter.add(1, failureAttributes(options.connector, 'quota'));
        connectorQuotaManager.recordRateLimit(options.connector, retryAfterMs, undefined, options.quotaPolicy);
        recordConnectorRateLimit(options.connector, retryAfterMs, normalizedError.message);
        quarantineConnector(options.connector, normalizedError.message, retryAfterMs);

        const context: ConnectorFallbackContext = {
          connector: options.connector,
          stage: 'quota',
          reason: normalizedError.message,
          retryAfterMs,
          error: normalizedError,
        };
        span.setAttribute('vitalcv.connector.fallback_stage', context.stage);
        span.setStatus({ code: SpanStatusCode.ERROR, message: context.stage });
        options.onFailure?.(context);
        return options.fallback(context);
      }

      connectorFailureCounter.add(1, failureAttributes(options.connector, 'execution'));
      recordConnectorFailure(options.connector, normalizedError.message, {
        latencyMs: Date.now() - start,
        details: {
          name: normalizedError.name,
        },
      });

      const context: ConnectorFallbackContext = {
        connector: options.connector,
        stage: 'execution',
        reason: normalizedError.message,
        error: normalizedError,
      };
      span.setAttribute('vitalcv.connector.fallback_stage', context.stage);
      span.setStatus({ code: SpanStatusCode.ERROR, message: context.stage });
      options.onFailure?.(context);
      return options.fallback(context);
    } finally {
      connectorLatencyHistogram.record(Date.now() - start, baseAttributes(options.connector));
      span.end();
    }
  });
}

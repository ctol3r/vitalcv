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

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export async function runConnectorWithReliability<T>(
  options: RunConnectorWithReliabilityOptions<T>,
): Promise<T> {
  const start = Date.now();
  const quarantine = getConnectorQuarantineState(options.connector);
  if (quarantine.active) {
    const context: ConnectorFallbackContext = {
      connector: options.connector,
      stage: 'quarantine',
      reason: quarantine.reason ?? `${options.connector} is quarantined`,
      retryAfterMs: quarantine.until ? Date.parse(quarantine.until) - Date.now() : null,
    };
    options.onFailure?.(context);
    return options.fallback(context);
  }

  try {
    connectorQuotaManager.consume({
      connector: options.connector,
      policy: options.quotaPolicy,
    });

    const attemptResult = await executeWithRetry({
      connector: options.connector,
      policy: options.retryPolicy,
      operation: async () => options.execute(),
      shouldRetry: (error) => isRetryableConnectorError(error),
      onRetry: async ({ attempt, delayMs, error }) => {
        recordConnectorRetry(options.connector, attempt, delayMs, error.message);
      },
    });

    const schemaState = options.schemaPolicy
      ? connectorSchemaDriftDetector.observe(options.connector, attemptResult.result, options.schemaPolicy)
      : null;

    if (schemaState?.detected) {
      recordConnectorSchemaDrift(options.connector, schemaState);
      if (schemaState.severity === 'CRITICAL' && options.quarantineOnCriticalSchemaDrift !== false) {
        const reason = `${options.connector} quarantined after critical schema drift`;
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

    return attemptResult.result;
  } catch (error) {
    const normalizedError = toError(error);

    if (normalizedError instanceof ConnectorQuotaExceededError) {
      const retryAfterMs = normalizedError.retryAfterMs;
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
      options.onFailure?.(context);
      return options.fallback(context);
    }

    if (normalizedError instanceof ConnectorRateLimitError) {
      const retryAfterMs = normalizedError.retryAfterMs ?? DEFAULT_RATE_LIMIT_QUARANTINE_MS;
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
      options.onFailure?.(context);
      return options.fallback(context);
    }

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
    options.onFailure?.(context);
    return options.fallback(context);
  }
}

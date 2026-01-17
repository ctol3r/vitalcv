import type { Instrumentation } from '@opentelemetry/instrumentation';
import type { NodeSDK } from '@opentelemetry/sdk-node';
import { initializeOpenTelemetry, OpenTelemetryConfig } from './otelConfig';

export interface NodeTracingOptions {
  serviceName: string;
  serviceVersion?: string;
  environment?: string;
  instrumentations?: Instrumentation[];
  otlpEndpoint?: string;
}

const startedSdks = new Map<string, NodeSDK>();

function isTracingDisabled(): boolean {
  if (process.env.OTEL_SDK_DISABLED === '1') {
    return true;
  }
  if (process.env.OTEL_TRACING_DISABLED === '1') {
    return true;
  }
  if (process.env.NODE_ENV === 'test') {
    return true;
  }
  return false;
}

export function startNodeTracing(options: NodeTracingOptions): NodeSDK | null {
  if (isTracingDisabled()) {
    return null;
  }

  if (startedSdks.has(options.serviceName)) {
    return startedSdks.get(options.serviceName)!;
  }

  const tracingConfig: OpenTelemetryConfig = {
    serviceName: options.serviceName,
    serviceVersion:
      options.serviceVersion ||
      process.env.RELEASE ||
      process.env.GIT_SHA ||
      process.env.COMMIT_SHA ||
      'unknown',
    environment: options.environment || process.env.NODE_ENV || 'development',
    otlpEndpoint: options.otlpEndpoint || process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    additionalInstrumentations: options.instrumentations,
  };

  const sdk = initializeOpenTelemetry(tracingConfig);
  startedSdks.set(options.serviceName, sdk);
  return sdk;
}

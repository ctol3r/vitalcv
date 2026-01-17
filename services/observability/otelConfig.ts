/**
 * OpenTelemetry Configuration
 * Sets up comprehensive instrumentation across services (HTTP, gRPC, database)
 * Exports traces and metrics to Prometheus and Jaeger
 */

import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import type { Instrumentation } from '@opentelemetry/instrumentation';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { GrpcInstrumentation } from '@opentelemetry/instrumentation-grpc';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { KafkaJsInstrumentation } from '@opentelemetry/instrumentation-kafkajs';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { RedisInstrumentation } from '@opentelemetry/instrumentation-redis';
import { defaultResource, resourceFromAttributes } from '@opentelemetry/resources';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { BatchSpanProcessor, TraceIdRatioBasedSampler } from '@opentelemetry/sdk-trace-base';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { PrismaInstrumentation } from '@prisma/instrumentation';
// Optional exporters - will gracefully degrade if not installed
let PrometheusExporter: any;
let JaegerExporter: any;

try {
  PrometheusExporter = require('@opentelemetry/exporter-prometheus').PrometheusExporter;
} catch (e) {
  console.warn('[OpenTelemetry] Prometheus exporter not available');
}

try {
  JaegerExporter = require('@opentelemetry/exporter-jaeger').JaegerExporter;
} catch (e) {
  console.warn('[OpenTelemetry] Jaeger exporter not available');
}

export interface OpenTelemetryConfig {
  serviceName: string;
  serviceVersion?: string;
  environment?: string;

  // Exporters
  prometheusEnabled?: boolean;
  prometheusPort?: number;
  jaegerEnabled?: boolean;
  jaegerEndpoint?: string;
  otlpEnabled?: boolean;
  otlpEndpoint?: string;

  // Sampling
  traceSampleRate?: number;

  // Instrumentation options
  enableHttp?: boolean;
  enableGrpc?: boolean;
  enableDatabase?: boolean;
  enableRedis?: boolean;
  enableKafka?: boolean;
  enablePrisma?: boolean;

  // Additional instrumentations
  additionalInstrumentations?: Instrumentation[];

  // Resource attributes
  resourceAttributes?: Record<string, string>;
}

const DEFAULT_CONFIG: Partial<OpenTelemetryConfig> = {
  prometheusEnabled: true,
  prometheusPort: 9464,
  jaegerEnabled: true,
  jaegerEndpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces',
  otlpEnabled: true,
  otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318',
  traceSampleRate: parseFloat(process.env.OTEL_TRACES_SAMPLER_ARG || '1.0'),
  enableHttp: true,
  enableGrpc: true,
  enableDatabase: true,
  enableRedis: true,
  enableKafka: true,
  enablePrisma: true,
};

/**
 * Initialize OpenTelemetry SDK with comprehensive instrumentation
 */
export function initializeOpenTelemetry(config: OpenTelemetryConfig): NodeSDK {
  const finalConfig = { ...DEFAULT_CONFIG, ...config } as Required<OpenTelemetryConfig>;

  // Build resource attributes
  const resourceAttributes: Record<string, string> = {
    [SemanticResourceAttributes.SERVICE_NAME]: finalConfig.serviceName,
    [SemanticResourceAttributes.SERVICE_VERSION]: finalConfig.serviceVersion || '1.0.0',
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]:
      finalConfig.environment || process.env.NODE_ENV || 'development',
    ...finalConfig.resourceAttributes,
  };

  // Add deployment attributes if available
  if (process.env.KUBERNETES_NAMESPACE) {
    resourceAttributes[SemanticResourceAttributes.K8S_NAMESPACE_NAME] =
      process.env.KUBERNETES_NAMESPACE;
  }
  if (process.env.KUBERNETES_POD_NAME) {
    resourceAttributes[SemanticResourceAttributes.K8S_POD_NAME] = process.env.KUBERNETES_POD_NAME;
  }
  if (process.env.HOSTNAME) {
    resourceAttributes[SemanticResourceAttributes.HOST_NAME] = process.env.HOSTNAME;
  }

  const resource = defaultResource().merge(resourceFromAttributes(resourceAttributes));

  // Build instrumentations array
  const instrumentations: Instrumentation[] = [];

  // HTTP instrumentation
  if (finalConfig.enableHttp) {
    instrumentations.push(
      new HttpInstrumentation({
        enabled: true,
        ignoreIncomingRequestHook: (req) => {
          // Ignore health checks and metrics endpoints
          const path = req.url || '';
          return path === '/health' || path === '/metrics' || path === '/ready' || path === '/live';
        },
        requestHook: (span, request) => {
          const userAgent = (() => {
            if ('headers' in request) {
              const headerValue = request.headers?.['user-agent'];
              return Array.isArray(headerValue) ? headerValue.join(',') : headerValue;
            }
            if ('getHeader' in request && typeof request.getHeader === 'function') {
              const headerValue = request.getHeader('user-agent');
              if (Array.isArray(headerValue)) {
                return headerValue.join(',');
              }
              if (headerValue != null) {
                return String(headerValue);
              }
            }
            return undefined;
          })();

          span.setAttribute('http.user_agent', userAgent || 'unknown');
        },
      }),
      new ExpressInstrumentation({
        enabled: true,
      }),
    );
  }

  // gRPC instrumentation
  if (finalConfig.enableGrpc) {
    instrumentations.push(
      new GrpcInstrumentation({
        enabled: true,
      }),
    );
  }

  // Database instrumentation
  if (finalConfig.enableDatabase) {
    instrumentations.push(
      new PgInstrumentation({
        enabled: true,
        addSqlCommenterCommentToQueries: true,
      }),
    );
  }

  // Redis instrumentation
  if (finalConfig.enableRedis) {
    instrumentations.push(
      new RedisInstrumentation({
        enabled: true,
      }),
    );
  }

  // Kafka instrumentation
  if (finalConfig.enableKafka) {
    instrumentations.push(
      new KafkaJsInstrumentation({
        enabled: true,
      }),
    );
  }

  // Prisma instrumentation
  if (finalConfig.enablePrisma) {
    instrumentations.push(
      new PrismaInstrumentation({
        enabled: true,
      }),
    );
  }

  // Add additional instrumentations
  if (finalConfig.additionalInstrumentations) {
    instrumentations.push(...finalConfig.additionalInstrumentations);
  }

  // Build span processors - use first available or OTLP as default
  let spanProcessor;

  // Prefer Jaeger if enabled
  if (finalConfig.jaegerEnabled && JaegerExporter) {
    try {
      const jaegerExporter = new JaegerExporter({
        endpoint: finalConfig.jaegerEndpoint,
      });
      spanProcessor = new BatchSpanProcessor(jaegerExporter);
    } catch (error) {
      console.warn('[OpenTelemetry] Failed to initialize Jaeger exporter:', error);
    }
  }

  // Fallback to OTLP exporter (for traces)
  if (!spanProcessor && finalConfig.otlpEnabled) {
    const otlpTraceExporter = new OTLPTraceExporter({
      url: `${finalConfig.otlpEndpoint}/v1/traces`,
    });
    spanProcessor = new BatchSpanProcessor(otlpTraceExporter);
  }

  // Build metric readers - use first available or Prometheus as default
  let metricReader;

  // Prefer Prometheus if enabled
  if (finalConfig.prometheusEnabled && PrometheusExporter) {
    try {
      const prometheusExporter = new PrometheusExporter({
        port: finalConfig.prometheusPort,
      });
      metricReader = new PeriodicExportingMetricReader({
        exporter: prometheusExporter,
        exportIntervalMillis: 10000, // Export every 10 seconds
      });
    } catch (error) {
      console.warn('[OpenTelemetry] Failed to initialize Prometheus exporter:', error);
    }
  }

  // Fallback to OTLP exporter (for metrics)
  if (!metricReader && finalConfig.otlpEnabled) {
    try {
      const otlpMetricExporter = new OTLPMetricExporter({
        url: `${finalConfig.otlpEndpoint}/v1/metrics`,
      });
      metricReader = new PeriodicExportingMetricReader({
        exporter: otlpMetricExporter,
        exportIntervalMillis: 10000,
      });
    } catch (error) {
      console.warn('[OpenTelemetry] Failed to initialize OTLP metric exporter:', error);
    }
  }

  // Initialize SDK
  const sdk = new NodeSDK({
    resource,
    spanProcessor,
    instrumentations,
    metricReader,
    // Sampling configuration
    sampler:
      finalConfig.traceSampleRate < 1.0
        ? new TraceIdRatioBasedSampler(finalConfig.traceSampleRate)
        : undefined,
  });

  // Start SDK
  sdk.start();

  // Graceful shutdown
  const shutdown = async () => {
    try {
      await sdk.shutdown();
      console.log('[OpenTelemetry] SDK shutdown complete');
    } catch (error) {
      console.error('[OpenTelemetry] Error during shutdown:', error);
    } finally {
      process.exit(0);
    }
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return sdk;
}

/**
 * Get default OpenTelemetry configuration from environment variables
 */
export function getDefaultConfig(serviceName: string): OpenTelemetryConfig {
  return {
    serviceName,
    serviceVersion:
      process.env.SERVICE_VERSION || process.env.RELEASE || process.env.GIT_SHA || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    prometheusEnabled: process.env.OTEL_PROMETHEUS_ENABLED !== 'false',
    prometheusPort: parseInt(process.env.OTEL_PROMETHEUS_PORT || '9464', 10),
    jaegerEnabled: process.env.OTEL_JAEGER_ENABLED !== 'false',
    jaegerEndpoint:
      process.env.JAEGER_ENDPOINT ||
      process.env.OTEL_EXPORTER_JAEGER_ENDPOINT ||
      'http://localhost:14268/api/traces',
    otlpEnabled: process.env.OTEL_EXPORTER_OTLP_ENABLED !== 'false',
    otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318',
    traceSampleRate: parseFloat(process.env.OTEL_TRACES_SAMPLER_ARG || '1.0'),
  };
}

/**
 * Initialize OpenTelemetry with default configuration
 */
export function initializeOpenTelemetryDefault(serviceName: string): NodeSDK {
  const config = getDefaultConfig(serviceName);
  return initializeOpenTelemetry(config);
}

export default {
  initializeOpenTelemetry,
  initializeOpenTelemetryDefault,
  getDefaultConfig,
};

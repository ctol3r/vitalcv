# Observability Services

Comprehensive observability infrastructure for the Chai VC Platform, including OpenTelemetry instrumentation, metrics collection, distributed tracing, and enhanced logging.

## Components

### 1. OpenTelemetry Configuration (`otelConfig.ts`)

Sets up comprehensive OpenTelemetry instrumentation across services:
- **HTTP instrumentation**: Express and HTTP client requests
- **gRPC instrumentation**: gRPC service calls
- **Database instrumentation**: PostgreSQL queries
- **Redis instrumentation**: Redis operations
- **Kafka instrumentation**: Kafka message processing
- **Prisma instrumentation**: Prisma ORM queries

**Exporters:**
- Prometheus (metrics)
- Jaeger (traces)
- OTLP (traces and metrics)

**Usage:**

```typescript
import { initializeOpenTelemetryDefault } from './services/observability/otelConfig';

// Initialize with default configuration
const sdk = initializeOpenTelemetryDefault('my-service');

// Or with custom configuration
import { initializeOpenTelemetry } from './services/observability/otelConfig';

const sdk = initializeOpenTelemetry({
  serviceName: 'my-service',
  serviceVersion: '1.0.0',
  environment: 'production',
  prometheusEnabled: true,
  prometheusPort: 9464,
  jaegerEnabled: true,
  jaegerEndpoint: 'http://jaeger:14268/api/traces',
  otlpEnabled: true,
  otlpEndpoint: 'http://otel-collector:4318',
});
```

### 2. Metrics Collector (`metricsCollector.ts`)

Captures custom metrics for:
- **Queue metrics**: Queue lengths, processing counts, failed items
- **Job metrics**: Job durations, success rates, counts by type
- **Error metrics**: Error counts and rates by type and service
- **Resource metrics**: CPU, memory, disk usage
- **HTTP metrics**: Request rates, latencies, status codes

**Usage:**

```typescript
import { MetricsCollector, metricsHandler, metricsMiddleware } from './services/observability/metricsCollector';

// Create collector
const collector = new MetricsCollector('my-service');

// Use in Express app
app.use(metricsMiddleware(collector));
app.get('/metrics', metricsHandler(collector));

// Record custom metrics
collector.recordQueueMetrics({
  queueName: 'job-queue',
  length: 10,
  processing: 2,
  failed: 0,
});

collector.recordJobMetrics({
  jobType: 'process-document',
  duration: 1500, // milliseconds
  status: 'success',
});

collector.recordError('my-service', 'ValidationError', 1);

// Use decorator for automatic tracking
import { TrackMetrics } from './services/observability/metricsCollector';

class MyService {
  @TrackMetrics('my_service_process', { service: 'my-service' })
  async processData(data: any) {
    // Your code here
  }
}
```

### 3. Distributed Tracing Middleware (`tracingMiddleware.ts`)

Adds trace IDs and spans to all incoming/outgoing requests:
- **W3C Trace Context**: Supports W3C Trace Context propagation
- **Log correlation**: Automatically adds trace IDs to logs
- **Span management**: Creates and manages spans for requests
- **Child spans**: Helper functions for creating child spans

**Usage:**

```typescript
import { distributedTracingMiddleware } from './services/observability/tracingMiddleware';

// Add to Express app
app.use(distributedTracingMiddleware('my-service'));

// Use in code
import { withTrace, traceHttpCall, traceDatabaseQuery } from './services/observability/tracingMiddleware';

// Trace async function
const result = await withTrace('process-data', async (span) => {
  span.setAttribute('data.size', data.length);
  return processData(data);
});

// Trace HTTP call
const response = await traceHttpCall('GET', 'https://api.example.com/data', async () => {
  return fetch('https://api.example.com/data');
});

// Trace database query
const users = await traceDatabaseQuery('getUsers', 'SELECT * FROM users', async () => {
  return db.query('SELECT * FROM users');
});
```

### 4. Enhanced Logging (`logging.ts`)

Standardized log format with trace correlation:
- **JSON format**: Structured JSON logs with traceId, spanId, level, timestamp, service
- **Trace correlation**: Automatically includes trace IDs from active spans
- **ELK integration**: Compatible with ELK stack
- **Datadog integration**: Compatible with Datadog
- **Error logging**: Enhanced error logging with stack traces
- **Event logging**: Structured event logging

**Usage:**

```typescript
import { EnhancedLogger, loggingMiddleware } from './services/observability/logging';

// Create logger
const logger = new EnhancedLogger('my-service', {
  logFormat: 'json', // or 'plain'
  minLevel: 'info',
  enableTraceCorrelation: true,
  enableDatadog: true,
  enableELK: true,
});

// Add to Express app
app.use(loggingMiddleware(logger));

// Use in code
logger.info('User authenticated', { userId: '123' }, req);
logger.error('Database connection failed', error, { db: 'postgres' }, req);
logger.event('user_login', 'authentication', { userId: '123' }, req);

// Create child logger with context
const childLogger = logger.child({ requestId: 'req-123', userId: '456' });
childLogger.info('Processing request');
```

## Integration Example

Complete integration example:

```typescript
import express from 'express';
import { initializeOpenTelemetryDefault } from './services/observability/otelConfig';
import { MetricsCollector, metricsHandler, metricsMiddleware } from './services/observability/metricsCollector';
import { distributedTracingMiddleware } from './services/observability/tracingMiddleware';
import { EnhancedLogger, loggingMiddleware } from './services/observability/logging';

// Initialize OpenTelemetry
const sdk = initializeOpenTelemetryDefault('my-service');

// Create metrics collector
const metricsCollector = new MetricsCollector('my-service');

// Create logger
const logger = new EnhancedLogger('my-service');

// Create Express app
const app = express();

// Add middleware (order matters!)
app.use(loggingMiddleware(logger));
app.use(distributedTracingMiddleware('my-service'));
app.use(metricsMiddleware(metricsCollector));

// Add metrics endpoint
app.get('/metrics', metricsHandler(metricsCollector));

// Your routes
app.get('/health', (req, res) => {
  logger.info('Health check', {}, req);
  res.json({ status: 'ok' });
});

app.listen(3000, () => {
  logger.info('Server started', { port: 3000 });
});
```

## Environment Variables

```bash
# OpenTelemetry
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
OTEL_TRACES_SAMPLER_ARG=1.0
OTEL_PROMETHEUS_ENABLED=true
OTEL_PROMETHEUS_PORT=9464
OTEL_JAEGER_ENABLED=true
JAEGER_ENDPOINT=http://jaeger:14268/api/traces

# Logging
LOG_FORMAT=json
LOG_LEVEL=info
SERVICE_NAME=my-service
SERVICE_VERSION=1.0.0

# Datadog (optional)
DATADOG_ENABLED=true

# ELK (optional)
ELK_ENABLED=true
```

## Grafana Dashboards

See `infra/observability/provisioning/observabilityDashboard.tf` for Terraform configuration to provision Grafana dashboards.

The dashboards include:
- HTTP request rates and latencies
- Error rates and types
- Queue depths and processing metrics
- Job durations and success rates
- Resource usage (CPU, memory, disk)
- Distributed traces
- Application logs

## Testing

All components are designed to gracefully degrade if optional dependencies are not available. The code will log warnings but continue to function.

## Dependencies

Required:
- `@opentelemetry/api`
- `@opentelemetry/sdk-node`
- `@opentelemetry/auto-instrumentations-node`
- `@opentelemetry/exporter-trace-otlp-http`
- `@opentelemetry/exporter-metrics-otlp-http`
- `prom-client`

Optional:
- `@opentelemetry/exporter-prometheus` (for Prometheus metrics)
- `@opentelemetry/exporter-jaeger` (for Jaeger traces)
- `@opentelemetry/instrumentation-grpc` (for gRPC)
- `@opentelemetry/instrumentation-kafkajs` (for Kafka)
- `@prisma/instrumentation` (for Prisma)


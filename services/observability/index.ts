/**
 * Observability Service - Main Export
 * B245A-OBS: Complete observability system for metrics, logs, and traces
 */

// Models
export { MetricEventModel, MetricEventInput, MetricEventQuery } from './models/MetricEvent.js';
export { LogEventModel, LogEventInput, LogEventQuery } from './models/LogEvent.js';
export { TraceSpanModel, TraceSpanInput, TraceSpanQuery } from './models/TraceSpan.js';

// Services
export { MetricsCollectorService } from './services/metricsCollectorService.js';
export { LogService } from './services/logService.js';
export { DistributedTracingService } from './services/distributedTracingService.js';
export { ObservabilityConfigService } from './services/observabilityConfigService.js';

// Middleware
export { createObservabilityMiddleware } from './middleware/observabilityMiddleware.js';

// Exporters
export { MetricExporter } from './exporters/metricExporter.js';
export { LogExportService } from './exporters/logExportService.js';


/**
 * Monitoring and Observability System
 *
 * Purpose:
 * - Error logging with context
 * - Performance metrics tracking
 * - Request tracing
 * - Alerting hooks
 *
 * Usage:
 * 1. Log errors with logError()
 * 2. Track metrics with trackMetric()
 * 3. Time operations with trackOperation()
 */

export interface ErrorContext {
  userId?: string;
  requestId?: string;
  endpoint?: string;
  method?: string;
  statusCode?: number;
  additional?: Record<string, any>;
}

export interface Metric {
  name: string;
  value: number;
  timestamp: Date;
  tags?: Record<string, string>;
}

export interface MetricAlert {
  metric: string;
  threshold: number;
  condition: "gt" | "lt" | "eq";
  duration: number; // milliseconds
}

/**
 * Log an error with full context
 *
 * @param error - Error object or message
 * @param context - Additional context
 */
export function logError(error: Error | string, context: ErrorContext = {}): void {
  const errorMessage = typeof error === "string" ? error : error.message;
  const errorStack = typeof error === "string" ? undefined : error.stack;

  const logEntry = {
    level: "ERROR",
    message: errorMessage,
    stack: errorStack,
    timestamp: new Date().toISOString(),
    context,
  };

  // In production, send to monitoring service
  // For now, console.log
  console.error(JSON.stringify(logEntry));

  // TODO: Send to external monitoring service (e.g., Sentry, Datadog)
  // monitorService.logError(logEntry);
}

/**
 * Track a metric value
 *
 * @param name - Metric name
 * @param value - Metric value
 * @param tags - Additional tags
 */
export function trackMetric(name: string, value: number, tags: Record<string, string> = {}): void {
  const metric: Metric = {
    name,
    value,
    timestamp: new Date(),
    tags,
  };

  console.log(`[METRIC] ${name}: ${value}`, tags);

  // TODO: Send to metrics service
  // metricsService.track(metric);
}

/**
 * Time an operation and record the duration
 *
 * @param name - Operation name
 * @param fn - Function to time
 * @returns Function result
 */
export async function trackOperation<T>(
  name: string,
  fn: () => Promise<T>,
  tags: Record<string, string> = {}
): Promise<T> {
  const startTime = Date.now();

  try {
    const result = await fn();
    const duration = Date.now() - startTime;

    trackMetric(`${name}.duration`, duration, { ...tags, status: "success" });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;

    trackMetric(`${name}.duration`, duration, { ...tags, status: "error" });
    logError(error as Error, { operation: name, ...tags });

    throw error;
  }
}

/**
 * Middleware for Express-style route tracking
 *
 * @param req - Request object
 * @param res - Response object
 * @param next - Next function
 */
export function requestTrackingMiddleware(req: any, res: any, next: any): void {
  const startTime = Date.now();
  const requestId = req.headers["x-request-id"] || generateRequestId();

  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);

  res.on("finish", () => {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;

    trackMetric("http.request.duration", duration, {
      method: req.method,
      path: req.path,
      status: statusCode.toString(),
      requestId,
    });

    if (statusCode >= 500) {
      logError(
        new Error(`HTTP ${statusCode} ${req.method} ${req.path}`),
        {
          requestId,
          endpoint: req.path,
          method: req.method,
          statusCode,
        }
      );
    } else if (statusCode >= 400 && statusCode < 500) {
      trackMetric("http.request.4xx", 1, {
        method: req.method,
        path: req.path,
        status: statusCode.toString(),
      });
    }
  });

  next();
}

/**
 * Generate a unique request ID
 *
 * @returns Request ID string
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Alerting thresholds
 *
 * Adjust these based on monitoring needs
 */
export const ALERT_THRESHOLDS = {
  errorRate: {
    critical: 5.0, // 5% error rate for 5 minutes
    warning: 1.0, // 1% error rate for 15 minutes
  },
  responseTime: {
    critical: {
      p99: 5000, // 5s
      p95: 3000, // 3s
    },
    warning: {
      p99: 3000, // 3s
      p95: 2000, // 2s
    },
  },
  apiFailure: {
    critical: 10.0, // 10% failure rate
    warning: 5.0, // 5% failure rate
  },
} as const;

/**
 * Check if metric exceeds alert threshold
 *
 * @param metric - Metric name
 * @param value - Metric value
 * @returns Alert level or null
 */
export function checkAlertThreshold(metric: string, value: number): "critical" | "warning" | null {
  // Error rate alerts
  if (metric === "error_rate") {
    if (value >= ALERT_THRESHOLDS.errorRate.critical) return "critical";
    if (value >= ALERT_THRESHOLDS.errorRate.warning) return "warning";
  }

  // Response time alerts
  if (metric === "http.request.duration.p99") {
    if (value >= ALERT_THRESHOLDS.responseTime.critical.p99) return "critical";
    if (value >= ALERT_THRESHOLDS.responseTime.warning.p99) return "warning";
  }

  if (metric === "http.request.duration.p95") {
    if (value >= ALERT_THRESHOLDS.responseTime.critical.p95) return "critical";
    if (value >= ALERT_THRESHOLDS.responseTime.warning.p95) return "warning";
  }

  return null;
}

/**
 * Trigger an alert
 *
 * @param level - Alert level (critical or warning)
 * @param metric - Metric name
 * @param value - Metric value
 */
export function triggerAlert(
  level: "critical" | "warning",
  metric: string,
  value: number
): void {
  const alert = {
    level,
    metric,
    value,
    timestamp: new Date().toISOString(),
  };

  console.warn(`[ALERT] ${level.toUpperCase()}: ${metric} = ${value}`);

  // TODO: Send to alerting service (e.g., PagerDuty)
  // alertingService.send(alert);
}

/**
 * Health check endpoint handler
 *
 * @returns Health status
 */
export async function healthCheck(): Promise<{
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  checks: Record<string, boolean>;
}> {
  // TODO: Add actual health checks
  // - Database connectivity
  // - External API availability
  // - Disk space
  // - Memory usage

  return {
    status: "healthy",
    timestamp: new Date().toISOString(),
    checks: {
      database: true,
      cache: true,
      external_apis: true,
    },
  };
}

/**
 * Ready check endpoint handler
 *
 * @returns Ready status
 */
export async function readyCheck(): Promise<{
  ready: boolean;
  timestamp: string;
}> {
  // TODO: Add actual readiness checks
  // - All services initialized
  // - Database migrations run
  // - Cache warmed up

  return {
    ready: true,
    timestamp: new Date().toISOString(),
  };
}

/**
 * B245A-OBS-006: ObservabilityMiddleware
 * Express/Koa middleware that injects correlation IDs, collects request duration, logs request/response details, captures errors; integrates with MetricsCollectorService and LogService; tested with sample requests
 */

import { Request, Response, NextFunction } from 'express';
import { MetricsCollectorService } from '../services/metricsCollectorService.js';
import { LogService } from '../services/logService.js';
import { DistributedTracingService } from '../services/distributedTracingService.js';
import { ObservabilityConfigService } from '../services/observabilityConfigService.js';
import { v4 as uuidv4 } from 'uuid';

export interface ObservabilityContext {
  correlationId: string;
  traceId?: string;
  spanId?: string;
  startTime: Date;
}

declare global {
  namespace Express {
    interface Request {
      observability?: ObservabilityContext;
    }
  }
}

export function createObservabilityMiddleware(
  metricsCollector: MetricsCollectorService,
  logService: LogService,
  tracingService: DistributedTracingService,
  configService: ObservabilityConfigService,
  serviceName: string = 'http-service'
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Generate correlation ID from header or create new one
    const correlationId = (req.headers['x-correlation-id'] as string) || uuidv4();

    // Set correlation ID in log service
    logService.setCorrelationId(correlationId);

    // Start trace span if tracing is enabled
    let spanContext;
    if (configService.getConfig().enableTracing && configService.shouldSample()) {
      const traceId = (req.headers['x-trace-id'] as string) || tracingService.generateTraceId();
      const parentSpanId = req.headers['x-span-id'] as string | undefined;

      spanContext = await tracingService.startSpan(
        `${req.method} ${req.path}`,
        traceId,
        parentSpanId,
        {
          'http.method': req.method,
          'http.path': req.path,
          'http.url': req.url,
          'http.user_agent': req.headers['user-agent'] || '',
        }
      );

      // Set trace headers in response
      res.setHeader('X-Trace-Id', spanContext.traceId);
      res.setHeader('X-Span-Id', spanContext.spanId);
    }

    // Set correlation ID in response
    res.setHeader('X-Correlation-Id', correlationId);

    // Store observability context in request
    req.observability = {
      correlationId,
      traceId: spanContext?.traceId,
      spanId: spanContext?.spanId,
      startTime: new Date(),
    };

    // Log request
    if (configService.getConfig().enableLogging) {
      await logService.info('HTTP Request', {
        method: req.method,
        path: req.path,
        url: req.url,
        headers: req.headers,
        ip: req.ip,
      }, correlationId);
    }

    // Record request start metric
    if (configService.getConfig().enableMetrics) {
      await metricsCollector.increment('http_requests_total', 1, {
        method: req.method,
        path: req.path,
      });
    }

    // Capture response finish
    const originalSend = res.send;
    res.send = function (body: any) {
      const duration = Date.now() - req.observability!.startTime.getTime();

      // Log response
      if (configService.getConfig().enableLogging) {
        logService.info('HTTP Response', {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration,
        }, correlationId).catch(() => {
          // Silently fail if logging fails
        });
      }

      // Record response metrics
      if (configService.getConfig().enableMetrics) {
        metricsCollector.observe('http_request_duration_ms', duration, {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode.toString(),
        }).catch(() => {
          // Silently fail if metrics fail
        });

        metricsCollector.increment('http_responses_total', 1, {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode.toString(),
        }).catch(() => {
          // Silently fail if metrics fail
        });
      }

      // End trace span
      if (spanContext && configService.getConfig().enableTracing) {
        const status = res.statusCode >= 400 ? 'ERROR' : 'OK';
        tracingService.endSpan(
          spanContext.spanId,
          status as any,
          res.statusCode >= 400 ? `HTTP ${res.statusCode}` : undefined,
          {
            'http.status_code': res.statusCode,
            'http.duration_ms': duration,
          }
        ).catch(() => {
          // Silently fail if tracing fails
        });
      }

      return originalSend.call(this, body);
    };

    // Error handler
    const originalNext = next;
    next = function (err?: any) {
      if (err) {
        const duration = Date.now() - req.observability!.startTime.getTime();

        // Log error
        if (configService.getConfig().enableLogging) {
          logService.error('HTTP Request Error', {
            method: req.method,
            path: req.path,
            error: err.message,
            stack: err.stack,
            duration,
          }, correlationId).catch(() => {
            // Silently fail if logging fails
          });
        }

        // Record error metric
        if (configService.getConfig().enableMetrics) {
          metricsCollector.increment('http_errors_total', 1, {
            method: req.method,
            path: req.path,
            errorType: err.constructor?.name || 'Error',
          }).catch(() => {
            // Silently fail if metrics fail
          });
        }

        // End trace span with error
        if (spanContext && configService.getConfig().enableTracing) {
          tracingService.endSpan(
            spanContext.spanId,
            'ERROR',
            err.message,
            {
              'http.status_code': res.statusCode || 500,
              'http.duration_ms': duration,
              'error.type': err.constructor?.name || 'Error',
            }
          ).catch(() => {
            // Silently fail if tracing fails
          });
        }
      }

      return originalNext(err);
    };

    next();
  };
}

export default createObservabilityMiddleware;


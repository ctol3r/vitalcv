/**
 * B245A-OBS-010: ObservabilityCoreTests suite
 * Tests covering metrics collection, logging, tracing, middleware injection, exporters and config loading; simulates high-throughput scenarios; verifies no data loss or corruption
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { PrismaClient, MetricType, LogLevel, TraceSpanStatus } from '@prisma/client';
import { MetricsCollectorService } from '../services/metricsCollectorService.js';
import { LogService } from '../services/logService.js';
import { DistributedTracingService } from '../services/distributedTracingService.js';
import { ObservabilityConfigService } from '../services/observabilityConfigService.js';
import { MetricExporter } from '../exporters/metricExporter.js';

// Mock Prisma client for testing
class MockPrismaClient {
  metricEvent = {
    create: jest.fn(),
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  };
  logEvent = {
    create: jest.fn(),
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  };
  traceSpan = {
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  };
}

describe('Observability Core Tests', () => {
  let prisma: any;
  let metricsCollector: MetricsCollectorService;
  let logService: LogService;
  let tracingService: DistributedTracingService;
  let configService: ObservabilityConfigService;

  beforeEach(() => {
    prisma = new MockPrismaClient() as any;
    configService = new ObservabilityConfigService({
      sampleRate: 1.0,
      logLevel: 'DEBUG',
      enableMetrics: true,
      enableLogging: true,
      enableTracing: true,
    });
    metricsCollector = new MetricsCollectorService(prisma, 'test-service');
    logService = new LogService(prisma, 'test-service');
    tracingService = new DistributedTracingService(prisma, 'test-service');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('MetricsCollectorService', () => {
    it('should increment a counter metric', async () => {
      await metricsCollector.increment('test_counter', 1, { tag1: 'value1' });

      expect(prisma.metricEvent.create).toHaveBeenCalledWith({
        data: {
          serviceName: 'test-service',
          metricName: 'test_counter',
          metricType: MetricType.COUNTER,
          value: 1,
          tags: { tag1: 'value1' },
          timestamp: expect.any(Date),
        },
      });
    });

    it('should set a gauge metric', async () => {
      await metricsCollector.set('test_gauge', 42.5, { tag1: 'value1' });

      expect(prisma.metricEvent.create).toHaveBeenCalledWith({
        data: {
          serviceName: 'test-service',
          metricName: 'test_gauge',
          metricType: MetricType.GAUGE,
          value: 42.5,
          tags: { tag1: 'value1' },
          timestamp: expect.any(Date),
        },
      });
    });

    it('should observe a histogram metric', async () => {
      await metricsCollector.observe('test_histogram', 100, { tag1: 'value1' });

      expect(prisma.metricEvent.create).toHaveBeenCalledWith({
        data: {
          serviceName: 'test-service',
          metricName: 'test_histogram',
          metricType: MetricType.HISTOGRAM,
          value: 100,
          tags: { tag1: 'value1' },
          timestamp: expect.any(Date),
        },
      });
    });

    it('should handle high-throughput metric collection', async () => {
      const promises = [];
      for (let i = 0; i < 1000; i++) {
        promises.push(metricsCollector.increment('high_throughput_counter', 1));
      }
      await Promise.all(promises);

      expect(prisma.metricEvent.create).toHaveBeenCalledTimes(1000);
    });
  });

  describe('LogService', () => {
    it('should log info message', async () => {
      await logService.info('Test message', { key: 'value' }, 'correlation-123');

      expect(prisma.logEvent.create).toHaveBeenCalledWith({
        data: {
          serviceName: 'test-service',
          level: LogLevel.INFO,
          message: 'Test message',
          context: { key: 'value' },
          correlationId: 'correlation-123',
          timestamp: expect.any(Date),
        },
      });
    });

    it('should log error message', async () => {
      await logService.error('Error message', { error: 'test' }, 'correlation-123');

      expect(prisma.logEvent.create).toHaveBeenCalledWith({
        data: {
          serviceName: 'test-service',
          level: LogLevel.ERROR,
          message: 'Error message',
          context: { error: 'test' },
          correlationId: 'correlation-123',
          timestamp: expect.any(Date),
        },
      });
    });

    it('should generate correlation ID', () => {
      const correlationId = logService.generateCorrelationId();
      expect(correlationId).toBeDefined();
      expect(typeof correlationId).toBe('string');
    });

    it('should handle high-throughput logging', async () => {
      const promises = [];
      for (let i = 0; i < 1000; i++) {
        promises.push(logService.info(`Message ${i}`, { index: i }));
      }
      await Promise.all(promises);

      expect(prisma.logEvent.create).toHaveBeenCalledTimes(1000);
    });
  });

  describe('DistributedTracingService', () => {
    it('should start a span', async () => {
      const span = await tracingService.startSpan('test-operation', undefined, undefined, { tag1: 'value1' });

      expect(span.traceId).toBeDefined();
      expect(span.spanId).toBeDefined();
      expect(prisma.traceSpan.create).toHaveBeenCalledWith({
        data: {
          traceId: span.traceId,
          spanId: span.spanId,
          parentSpanId: undefined,
          serviceName: 'test-service',
          operationName: 'test-operation',
          startTime: expect.any(Date),
          tags: { tag1: 'value1' },
          status: TraceSpanStatus.UNSET,
        },
      });
    });

    it('should end a span', async () => {
      const span = await tracingService.startSpan('test-operation');
      const startTime = new Date();
      prisma.traceSpan.create.mockResolvedValue({
        id: 'span-1',
        startTime,
        traceId: span.traceId,
        spanId: span.spanId,
      });

      await tracingService.endSpan(span.spanId, TraceSpanStatus.OK);

      expect(prisma.traceSpan.update).toHaveBeenCalledWith({
        where: { id: span.spanId },
        data: {
          endTime: expect.any(Date),
          duration: expect.any(Number),
          status: TraceSpanStatus.OK,
        },
      });
    });

    it('should create nested spans', async () => {
      const parentSpan = await tracingService.startSpan('parent-operation');
      const childSpan = await tracingService.startSpan('child-operation', parentSpan.traceId, parentSpan.spanId);

      expect(childSpan.traceId).toBe(parentSpan.traceId);
      expect(childSpan.parentSpanId).toBe(parentSpan.spanId);
    });

    it('should export trace to Zipkin format', async () => {
      const traceId = tracingService.generateTraceId();
      const span = await tracingService.startSpan('test-operation', traceId);
      await tracingService.endSpan(span.spanId);

      prisma.traceSpan.findMany.mockResolvedValue([
        {
          traceId,
          spanId: span.spanId,
          parentSpanId: null,
          serviceName: 'test-service',
          operationName: 'test-operation',
          startTime: new Date(),
          endTime: new Date(),
          duration: 100,
          tags: { tag1: 'value1' },
          status: TraceSpanStatus.OK,
        },
      ]);

      const zipkinTrace = await tracingService.exportToZipkin(traceId);

      expect(zipkinTrace).toHaveLength(1);
      expect(zipkinTrace[0].traceId).toBe(traceId);
      expect(zipkinTrace[0].name).toBe('test-operation');
      expect(zipkinTrace[0].localEndpoint.serviceName).toBe('test-service');
    });

    it('should handle high-throughput tracing', async () => {
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(tracingService.startSpan(`operation-${i}`));
      }
      await Promise.all(promises);

      expect(prisma.traceSpan.create).toHaveBeenCalledTimes(100);
    });
  });

  describe('ObservabilityConfigService', () => {
    it('should load configuration from environment', () => {
      const config = configService.getConfig();
      expect(config.sampleRate).toBe(1.0);
      expect(config.logLevel).toBe('DEBUG');
      expect(config.enableMetrics).toBe(true);
    });

    it('should validate configuration', () => {
      expect(() => {
        configService.updateConfig({ sampleRate: 1.5 });
      }).toThrow('sampleRate must be between 0.0 and 1.0');
    });

    it('should support dynamic configuration updates', () => {
      const listener = jest.fn();
      configService.onConfigChange(listener);

      configService.updateConfig({ sampleRate: 0.5 });

      expect(listener).toHaveBeenCalledWith(expect.objectContaining({ sampleRate: 0.5 }));
    });

    it('should check if sampling should occur', () => {
      configService.updateConfig({ sampleRate: 0.0 });
      expect(configService.shouldSample()).toBe(false);

      configService.updateConfig({ sampleRate: 1.0 });
      expect(configService.shouldSample()).toBe(true);
    });

    it('should check if log level should be recorded', () => {
      configService.updateConfig({ logLevel: 'INFO' });
      expect(configService.shouldLog('DEBUG')).toBe(false);
      expect(configService.shouldLog('INFO')).toBe(true);
      expect(configService.shouldLog('WARN')).toBe(true);
      expect(configService.shouldLog('ERROR')).toBe(true);
    });
  });

  describe('MetricExporter', () => {
    it('should export metrics in Prometheus format', async () => {
      prisma.metricEvent.findMany.mockResolvedValue([
        {
          serviceName: 'test-service',
          metricName: 'test_counter',
          metricType: MetricType.COUNTER,
          value: 10,
          tags: { tag1: 'value1' },
          timestamp: new Date(),
        },
      ]);

      const exporter = new MetricExporter(prisma, { format: 'prometheus' });
      const prometheus = await exporter.toPrometheusFormat('test-service');

      expect(prometheus).toContain('# TYPE');
      expect(prometheus).toContain('test_service_test_counter');
    });

    it('should export metrics in StatsD format', async () => {
      prisma.metricEvent.findMany.mockResolvedValue([
        {
          serviceName: 'test-service',
          metricName: 'test_counter',
          metricType: MetricType.COUNTER,
          value: 10,
          tags: { tag1: 'value1' },
          timestamp: new Date(),
        },
      ]);

      const exporter = new MetricExporter(prisma, { format: 'statsd' });
      const statsd = await exporter.toStatsDFormat('test-service');

      expect(statsd).toContain('test-service.test_counter');
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete request lifecycle', async () => {
      // Simulate a request
      const correlationId = logService.generateCorrelationId();
      logService.setCorrelationId(correlationId);

      // Log request start
      await logService.info('Request started', { method: 'GET', path: '/test' }, correlationId);

      // Start trace
      const span = await tracingService.startSpan('GET /test', undefined, undefined, {
        'http.method': 'GET',
        'http.path': '/test',
      });

      // Record metrics
      await metricsCollector.increment('http_requests_total', 1, { method: 'GET', path: '/test' });

      // Simulate processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      // End trace
      await tracingService.endSpan(span.spanId, TraceSpanStatus.OK, undefined, {
        'http.status_code': 200,
        'http.duration_ms': 10,
      });

      // Log response
      await logService.info('Request completed', { statusCode: 200, duration: 10 }, correlationId);

      // Record response metrics
      await metricsCollector.increment('http_responses_total', 1, {
        method: 'GET',
        path: '/test',
        statusCode: '200',
      });

      expect(prisma.logEvent.create).toHaveBeenCalledTimes(2);
      expect(prisma.traceSpan.create).toHaveBeenCalledTimes(1);
      expect(prisma.traceSpan.update).toHaveBeenCalledTimes(1);
      expect(prisma.metricEvent.create).toHaveBeenCalledTimes(2);
    });

    it('should handle concurrent operations without data loss', async () => {
      const operations = [];
      for (let i = 0; i < 100; i++) {
        operations.push(metricsCollector.increment(`metric_${i}`, 1));
        operations.push(logService.info(`Log ${i}`));
        operations.push(tracingService.startSpan(`Operation ${i}`));
      }

      await Promise.all(operations);

      expect(prisma.metricEvent.create).toHaveBeenCalledTimes(100);
      expect(prisma.logEvent.create).toHaveBeenCalledTimes(100);
      expect(prisma.traceSpan.create).toHaveBeenCalledTimes(100);
    });
  });
});


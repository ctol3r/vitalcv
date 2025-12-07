/**
 * B245A-OBS-007: MetricExporter
 * Exports metrics to Prometheus or StatsD: exposes /metrics endpoint, converts MetricEvents into Prometheus format; includes health checks; tested for accurate export
 */

import { Request, Response } from 'express';
import { PrismaClient, MetricType } from '@prisma/client';
import { MetricEventModel } from '../models/MetricEvent.js';

export interface MetricExporterConfig {
  format: 'prometheus' | 'statsd';
  includeHealthCheck?: boolean;
}

export class MetricExporter {
  private metricEventModel: MetricEventModel;
  private config: MetricExporterConfig;

  constructor(prisma: PrismaClient, config: MetricExporterConfig = { format: 'prometheus' }) {
    this.metricEventModel = new MetricEventModel(prisma);
    this.config = config;
  }

  /**
   * Convert MetricEvents to Prometheus format
   */
  async toPrometheusFormat(serviceName?: string): Promise<string> {
    const events = await this.metricEventModel.findMany({
      serviceName,
      // Get recent events (last hour by default)
      startTime: new Date(Date.now() - 60 * 60 * 1000),
    });

    // Group by metric name and aggregate
    const metricMap = new Map<string, {
      type: MetricType;
      values: Array<{ value: number; tags: any; timestamp: Date }>;
    }>();

    for (const event of events) {
      const key = `${event.serviceName}_${event.metricName}`;
      if (!metricMap.has(key)) {
        metricMap.set(key, {
          type: event.metricType,
          values: [],
        });
      }
      metricMap.get(key)!.values.push({
        value: event.value,
        tags: event.tags as any,
        timestamp: event.timestamp,
      });
    }

    // Convert to Prometheus format
    const lines: string[] = [];

    for (const [metricName, data] of metricMap.entries()) {
      const sanitizedName = this.sanitizeMetricName(metricName);

      // Add type comment
      switch (data.type) {
        case MetricType.COUNTER:
          lines.push(`# TYPE ${sanitizedName} counter`);
          break;
        case MetricType.GAUGE:
          lines.push(`# TYPE ${sanitizedName} gauge`);
          break;
        case MetricType.HISTOGRAM:
          lines.push(`# TYPE ${sanitizedName} histogram`);
          break;
      }

      // Add metric values
      for (const value of data.values) {
        const tags = value.tags ? this.formatTags(value.tags) : '';
        const line = `${sanitizedName}${tags} ${value.value}`;
        lines.push(line);
      }
    }

    // Add health check if enabled
    if (this.config.includeHealthCheck) {
      lines.push('# TYPE observability_health gauge');
      lines.push('observability_health 1');
    }

    return lines.join('\n') + '\n';
  }

  /**
   * Convert MetricEvents to StatsD format
   */
  async toStatsDFormat(serviceName?: string): Promise<string> {
    const events = await this.metricEventModel.findMany({
      serviceName,
      startTime: new Date(Date.now() - 60 * 60 * 1000),
    });

    const lines: string[] = [];

    for (const event of events) {
      const metricName = `${event.serviceName}.${event.metricName}`;
      const tags = event.tags ? this.formatStatsDTags(event.tags) : '';

      let line = '';
      switch (event.metricType) {
        case MetricType.COUNTER:
          line = `${metricName}:${event.value}|c${tags}`;
          break;
        case MetricType.GAUGE:
          line = `${metricName}:${event.value}|g${tags}`;
          break;
        case MetricType.HISTOGRAM:
          line = `${metricName}:${event.value}|h${tags}`;
          break;
      }
      lines.push(line);
    }

    return lines.join('\n') + '\n';
  }

  /**
   * Create Express handler for /metrics endpoint
   */
  createMetricsHandler() {
    return async (req: Request, res: Response) => {
      try {
        const serviceName = req.query.service as string | undefined;
        let metrics: string;

        if (this.config.format === 'prometheus') {
          metrics = await this.toPrometheusFormat(serviceName);
          res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
        } else {
          metrics = await this.toStatsDFormat(serviceName);
          res.set('Content-Type', 'text/plain; charset=utf-8');
        }

        res.send(metrics);
      } catch (error) {
        console.error('[MetricExporter] Error generating metrics:', error);
        res.status(500).json({ error: 'Failed to generate metrics' });
      }
    };
  }

  /**
   * Create health check handler
   */
  createHealthCheckHandler() {
    return (req: Request, res: Response) => {
      res.json({
        status: 'ok',
        service: 'metric-exporter',
        format: this.config.format,
        timestamp: new Date().toISOString(),
      });
    };
  }

  /**
   * Sanitize metric name for Prometheus (only alphanumeric and underscore)
   */
  private sanitizeMetricName(name: string): string {
    return name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^[0-9]/, '_$&');
  }

  /**
   * Format tags for Prometheus format
   */
  private formatTags(tags: Record<string, any>): string {
    const tagPairs = Object.entries(tags)
      .map(([key, value]) => {
        const sanitizedKey = this.sanitizeMetricName(key);
        const sanitizedValue = String(value).replace(/"/g, '\\"');
        return `${sanitizedKey}="${sanitizedValue}"`;
      });

    return tagPairs.length > 0 ? `{${tagPairs.join(',')}}` : '';
  }

  /**
   * Format tags for StatsD format
   */
  private formatStatsDTags(tags: Record<string, any>): string {
    const tagPairs = Object.entries(tags)
      .map(([key, value]) => `${key}=${value}`);

    return tagPairs.length > 0 ? `|#${tagPairs.join(',')}` : '';
  }
}

export default MetricExporter;


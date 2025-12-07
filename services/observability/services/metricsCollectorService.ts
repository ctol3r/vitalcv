/**
 * B245A-OBS-002: MetricsCollectorService
 * Provides APIs to record metrics (increment, set, observe values); writes MetricEvents to database; supports automatic timestamps
 */

import { PrismaClient, MetricType } from '@prisma/client';
import { MetricEventModel, MetricEventInput } from '../models/MetricEvent.js';

export interface MetricTags {
  [key: string]: string | number | boolean;
}

export class MetricsCollectorService {
  private metricEventModel: MetricEventModel;
  private serviceName: string;

  constructor(prisma: PrismaClient, serviceName: string = 'default-service') {
    this.metricEventModel = new MetricEventModel(prisma);
    this.serviceName = serviceName;
  }

  /**
   * Increment a counter metric
   */
  async increment(metricName: string, value: number = 1, tags?: MetricTags): Promise<void> {
    await this.metricEventModel.create({
      serviceName: this.serviceName,
      metricName,
      metricType: MetricType.COUNTER,
      value,
      tags,
      timestamp: new Date(),
    });
  }

  /**
   * Set a gauge metric (absolute value)
   */
  async set(metricName: string, value: number, tags?: MetricTags): Promise<void> {
    await this.metricEventModel.create({
      serviceName: this.serviceName,
      metricName,
      metricType: MetricType.GAUGE,
      value,
      tags,
      timestamp: new Date(),
    });
  }

  /**
   * Observe a histogram metric (for distribution analysis)
   */
  async observe(metricName: string, value: number, tags?: MetricTags): Promise<void> {
    await this.metricEventModel.create({
      serviceName: this.serviceName,
      metricName,
      metricType: MetricType.HISTOGRAM,
      value,
      tags,
      timestamp: new Date(),
    });
  }

  /**
   * Record a custom metric event
   */
  async record(input: Omit<MetricEventInput, 'serviceName' | 'timestamp'>): Promise<void> {
    await this.metricEventModel.create({
      ...input,
      serviceName: this.serviceName,
      timestamp: new Date(),
    });
  }

  /**
   * Get aggregated metrics for a metric name
   */
  async getAggregated(
    metricName: string,
    startTime?: Date,
    endTime?: Date
  ): Promise<{
    count: number;
    sum: number;
    avg: number;
    min: number;
    max: number;
  }> {
    return this.metricEventModel.getAggregated(
      this.serviceName,
      metricName,
      startTime,
      endTime
    );
  }

  /**
   * Query metric events
   */
  async query(metricName?: string, startTime?: Date, endTime?: Date) {
    return this.metricEventModel.findMany({
      serviceName: this.serviceName,
      metricName,
      startTime,
      endTime,
    });
  }
}

export default MetricsCollectorService;


/**
 * B235B-API-019: PublicAPIIncidentAlerts
 *
 * Integrates with Observability to send alerts to the on-call rotation
 * when error rates or latency exceed thresholds.
 * Logs incidents and follow-up actions.
 */

import { PublicAPIUsageTracker } from './usageTracker';
import { PrismaClient } from '@prisma/client';

export interface AlertThresholds {
  errorRateThreshold: number; // 0.05 = 5% error rate
  latencyP95Threshold: number; // milliseconds
  latencyP99Threshold: number; // milliseconds
  consecutiveErrorsThreshold: number; // number of consecutive errors
}

const DEFAULT_THRESHOLDS: AlertThresholds = {
  errorRateThreshold: 0.05, // 5%
  latencyP95Threshold: 1000, // 1 second
  latencyP99Threshold: 2000, // 2 seconds
  consecutiveErrorsThreshold: 10,
};

export interface Incident {
  id: string;
  type: 'ERROR_RATE' | 'LATENCY' | 'CONSECUTIVE_ERRORS' | 'QUOTA_EXCEEDED';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  details: Record<string, any>;
  detectedAt: Date;
  resolvedAt?: Date;
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
}

export class PublicAPIIncidentAlerts {
  private activeIncidents: Map<string, Incident> = new Map();
  private consecutiveErrorCounts: Map<string, number> = new Map();

  constructor(
    private prisma: PrismaClient,
    private usageTracker: PublicAPIUsageTracker,
    private thresholds: AlertThresholds = DEFAULT_THRESHOLDS
  ) {}

  /**
   * Check for incidents and send alerts
   */
  async checkAndAlert(): Promise<Incident[]> {
    const incidents: Incident[] = [];

    // Check error rates
    const errorRateIncidents = await this.checkErrorRates();
    incidents.push(...errorRateIncidents);

    // Check latency
    const latencyIncidents = await this.checkLatency();
    incidents.push(...latencyIncidents);

    // Process incidents
    for (const incident of incidents) {
      await this.processIncident(incident);
    }

    return incidents;
  }

  /**
   * Check error rates across endpoints
   */
  private async checkErrorRates(): Promise<Incident[]> {
    const incidents: Incident[] = [];
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const now = new Date();

    // Get error rate trends
    const trends = await this.usageTracker.getErrorRateTrends(
      oneHourAgo,
      now,
      1 // 1 hour intervals
    );

    for (const trend of trends) {
      if (trend.errorRate > this.thresholds.errorRateThreshold) {
        const incidentId = `error-rate-${trend.timestamp.getTime()}`;
        const existingIncident = this.activeIncidents.get(incidentId);

        if (!existingIncident) {
          const severity =
            trend.errorRate > 0.2
              ? 'CRITICAL'
              : trend.errorRate > 0.1
              ? 'HIGH'
              : trend.errorRate > 0.05
              ? 'MEDIUM'
              : 'LOW';

          const incident: Incident = {
            id: incidentId,
            type: 'ERROR_RATE',
            severity,
            message: `High error rate detected: ${(trend.errorRate * 100).toFixed(2)}%`,
            details: {
              errorRate: trend.errorRate,
              requestCount: trend.requestCount,
              timestamp: trend.timestamp,
            },
            detectedAt: new Date(),
            status: 'OPEN',
          };

          incidents.push(incident);
          this.activeIncidents.set(incidentId, incident);
        }
      }
    }

    return incidents;
  }

  /**
   * Check latency metrics
   */
  private async checkLatency(): Promise<Incident[]> {
    const incidents: Incident[] = [];
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const now = new Date();

    // Get top endpoints by request count
    const topConsumers = await this.usageTracker.getTopConsumers(10, oneHourAgo, now);

    for (const consumer of topConsumers) {
      // Get endpoint stats for this API key's most used endpoints
      // For simplicity, check overall latency
      const metrics = await this.usageTracker.getUsageMetrics(
        oneHourAgo,
        now,
        { apiKeyId: consumer.apiKeyId }
      );

      for (const metric of metrics) {
        if (metric.averageLatency > this.thresholds.latencyP95Threshold) {
          const incidentId = `latency-${consumer.apiKeyId}-${metric.endpoint}`;
          const existingIncident = this.activeIncidents.get(incidentId);

          if (!existingIncident) {
            const severity =
              metric.averageLatency > this.thresholds.latencyP99Threshold
                ? 'HIGH'
                : metric.averageLatency > this.thresholds.latencyP95Threshold
                ? 'MEDIUM'
                : 'LOW';

            const incident: Incident = {
              id: incidentId,
              type: 'LATENCY',
              severity,
              message: `High latency detected: ${metric.averageLatency.toFixed(2)}ms`,
              details: {
                endpoint: metric.endpoint,
                averageLatency: metric.averageLatency,
                requestCount: metric.requestCount,
                apiKeyId: consumer.apiKeyId,
              },
              detectedAt: new Date(),
              status: 'OPEN',
            };

            incidents.push(incident);
            this.activeIncidents.set(incidentId, incident);
          }
        }
      }
    }

    return incidents;
  }

  /**
   * Record API error and check for consecutive errors
   */
  async recordError(apiKeyId: string, endpoint: string): Promise<void> {
    const key = `${apiKeyId}:${endpoint}`;
    const currentCount = this.consecutiveErrorCounts.get(key) || 0;
    const newCount = currentCount + 1;

    this.consecutiveErrorCounts.set(key, newCount);

    if (newCount >= this.thresholds.consecutiveErrorsThreshold) {
      const incidentId = `consecutive-errors-${key}`;
      const existingIncident = this.activeIncidents.get(incidentId);

      if (!existingIncident) {
        const incident: Incident = {
          id: incidentId,
          type: 'CONSECUTIVE_ERRORS',
          severity: 'HIGH',
          message: `Consecutive errors detected: ${newCount} errors`,
          details: {
            apiKeyId,
            endpoint,
            consecutiveErrors: newCount,
          },
          detectedAt: new Date(),
          status: 'OPEN',
        };

        await this.processIncident(incident);
      }
    }
  }

  /**
   * Reset consecutive error count on successful request
   */
  resetConsecutiveErrors(apiKeyId: string, endpoint: string): void {
    const key = `${apiKeyId}:${endpoint}`;
    this.consecutiveErrorCounts.delete(key);
  }

  /**
   * Process incident: log and send alert
   */
  private async processIncident(incident: Incident): Promise<void> {
    // Log incident
    await this.logIncident(incident);

    // Send alert to on-call rotation
    await this.sendAlert(incident);

    // Store incident
    this.activeIncidents.set(incident.id, incident);
  }

  /**
   * Log incident
   */
  private async logIncident(incident: Incident): Promise<void> {
    console.log('[API_INCIDENT]', {
      id: incident.id,
      type: incident.type,
      severity: incident.severity,
      message: incident.message,
      details: incident.details,
      detectedAt: incident.detectedAt,
    });

    // TODO: Store in database (create IncidentLog table)
    // await this.prisma.incidentLog.create({
    //   data: {
    //     type: incident.type,
    //     severity: incident.severity,
    //     message: incident.message,
    //     details: incident.details,
    //     detectedAt: incident.detectedAt,
    //   },
    // });
  }

  /**
   * Send alert to on-call rotation
   */
  private async sendAlert(incident: Incident): Promise<void> {
    // TODO: Integrate with observability/alerting system
    // This could be PagerDuty, Opsgenie, Slack, etc.

    console.log('[API_ALERT]', {
      incidentId: incident.id,
      severity: incident.severity,
      message: incident.message,
      details: incident.details,
    });

    // Example integration:
    // if (incident.severity === 'CRITICAL' || incident.severity === 'HIGH') {
    //   await pagerDutyClient.triggerIncident({
    //     title: incident.message,
    //     severity: incident.severity,
    //     details: incident.details,
    //   });
    // }
  }

  /**
   * Resolve incident
   */
  async resolveIncident(incidentId: string, resolution?: string): Promise<void> {
    const incident = this.activeIncidents.get(incidentId);
    if (!incident) {
      throw new Error('Incident not found');
    }

    incident.status = 'RESOLVED';
    incident.resolvedAt = new Date();

    // Log resolution
    console.log('[API_INCIDENT_RESOLVED]', {
      incidentId,
      resolution,
      resolvedAt: incident.resolvedAt,
    });

    // Remove from active incidents
    this.activeIncidents.delete(incidentId);
  }

  /**
   * Get active incidents
   */
  getActiveIncidents(): Incident[] {
    return Array.from(this.activeIncidents.values());
  }
}


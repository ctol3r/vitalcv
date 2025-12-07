// B235B-API-019: PublicAPIIncidentAlerts - Integrates with Observability

import { PublicAPIUsageTracker, EndpointStats } from './usageTracker';
import { PrismaClient } from '@prisma/client';

export interface AlertThresholds {
  errorRatePercent: number; // Alert if error rate exceeds this
  latencyMsP95: number; // Alert if P95 latency exceeds this
  latencyMsP99: number; // Alert if P99 latency exceeds this
}

export interface IncidentAlert {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: 'error_rate' | 'latency' | 'quota_exceeded';
  endpoint?: string;
  message: string;
  metrics: Record<string, any>;
  timestamp: Date;
  resolvedAt?: Date;
}

const DEFAULT_THRESHOLDS: AlertThresholds = {
  errorRatePercent: 5, // 5% error rate
  latencyMsP95: 1000, // 1 second P95
  latencyMsP99: 2000, // 2 seconds P99
};

export class PublicAPIIncidentAlerts {
  private alerts: Map<string, IncidentAlert> = new Map();
  private lastCheckTime: Date = new Date();

  constructor(
    private usageTracker: PublicAPIUsageTracker,
    private prisma: PrismaClient,
    private thresholds: AlertThresholds = DEFAULT_THRESHOLDS
  ) {}

  /**
   * Check for incidents and send alerts
   */
  async checkAndAlert(): Promise<IncidentAlert[]> {
    const now = new Date();
    const checkWindow = new Date(now.getTime() - 5 * 60 * 1000); // Last 5 minutes

    const newAlerts: IncidentAlert[] = [];

    // Check error rates
    const errorRateAlerts = await this.checkErrorRates(checkWindow, now);
    newAlerts.push(...errorRateAlerts);

    // Check latency
    const latencyAlerts = await this.checkLatency(checkWindow, now);
    newAlerts.push(...latencyAlerts);

    // Send alerts to observability system
    for (const alert of newAlerts) {
      await this.sendAlert(alert);
    }

    this.lastCheckTime = now;
    return newAlerts;
  }

  /**
   * Check error rates per endpoint
   */
  private async checkErrorRates(
    startDate: Date,
    endDate: Date
  ): Promise<IncidentAlert[]> {
    const errorRates = await this.usageTracker.getErrorRates(
      startDate,
      endDate
    );

    const alerts: IncidentAlert[] = [];

    for (const [endpoint, rate] of errorRates.entries()) {
      if (rate > this.thresholds.errorRatePercent) {
        const severity = this.getSeverityForErrorRate(rate);
        const alertId = `error_rate_${endpoint}_${endDate.getTime()}`;

        // Check if we've already alerted for this recently
        if (this.alerts.has(alertId)) {
          continue;
        }

        const alert: IncidentAlert = {
          id: alertId,
          severity,
          type: 'error_rate',
          endpoint,
          message: `Error rate for ${endpoint} is ${rate.toFixed(2)}% (threshold: ${this.thresholds.errorRatePercent}%)`,
          metrics: {
            errorRate: rate,
            threshold: this.thresholds.errorRatePercent,
          },
          timestamp: endDate,
        };

        alerts.push(alert);
        this.alerts.set(alertId, alert);
      }
    }

    return alerts;
  }

  /**
   * Check latency percentiles
   */
  private async checkLatency(
    startDate: Date,
    endDate: Date
  ): Promise<IncidentAlert[]> {
    // Get endpoint stats
    const stats = await this.usageTracker.getEndpointStats(
      startDate,
      endDate
    );

    const alerts: IncidentAlert[] = [];

    for (const stat of stats) {
      // Check P95 latency
      const p95Latencies = await this.usageTracker.getLatencyPercentiles(
        stat.endpoint,
        startDate,
        endDate,
        [95]
      );

      const p95 = p95Latencies.get(95);
      if (p95 && p95 > this.thresholds.latencyMsP95) {
        const severity = this.getSeverityForLatency(p95);
        const alertId = `latency_p95_${stat.endpoint}_${endDate.getTime()}`;

        if (this.alerts.has(alertId)) {
          continue;
        }

        const alert: IncidentAlert = {
          id: alertId,
          severity,
          type: 'latency',
          endpoint: stat.endpoint,
          message: `P95 latency for ${stat.endpoint} is ${p95}ms (threshold: ${this.thresholds.latencyMsP95}ms)`,
          metrics: {
            p95Latency: p95,
            avgLatency: stat.avgLatencyMs,
            threshold: this.thresholds.latencyMsP95,
          },
          timestamp: endDate,
        };

        alerts.push(alert);
        this.alerts.set(alertId, alert);
      }
    }

    return alerts;
  }

  /**
   * Send alert to observability system
   */
  private async sendAlert(alert: IncidentAlert): Promise<void> {
    // TODO: Integrate with observability system (e.g., Sentry, PagerDuty, etc.)
    console.log('API Incident Alert:', {
      id: alert.id,
      severity: alert.severity,
      type: alert.type,
      endpoint: alert.endpoint,
      message: alert.message,
      metrics: alert.metrics,
      timestamp: alert.timestamp,
    });

    // Log to database for tracking
    try {
      // In production, store in an incidents table
      // await this.prisma.incident.create({ data: { ... } });
    } catch (error) {
      console.error('Failed to log incident:', error);
    }

    // Send to on-call rotation if critical
    if (alert.severity === 'critical') {
      await this.notifyOnCall(alert);
    }
  }

  /**
   * Notify on-call rotation
   */
  private async notifyOnCall(alert: IncidentAlert): Promise<void> {
    // TODO: Integrate with on-call system (PagerDuty, Opsgenie, etc.)
    console.log('On-Call Notification:', {
      alert: alert.id,
      severity: alert.severity,
      message: alert.message,
    });
  }

  /**
   * Get severity level for error rate
   */
  private getSeverityForErrorRate(rate: number): IncidentAlert['severity'] {
    if (rate > 50) return 'critical';
    if (rate > 20) return 'high';
    if (rate > 10) return 'medium';
    return 'low';
  }

  /**
   * Get severity level for latency
   */
  private getSeverityForLatency(latencyMs: number): IncidentAlert['severity'] {
    if (latencyMs > 5000) return 'critical';
    if (latencyMs > 3000) return 'high';
    if (latencyMs > 2000) return 'medium';
    return 'low';
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string): Promise<void> {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.resolvedAt = new Date();
      console.log('Alert resolved:', alertId);
    }
  }
}


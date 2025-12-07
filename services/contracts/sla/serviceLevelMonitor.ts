/**
 * B231B-CON-007: ServiceLevelMonitor
 *
 * Monitors uptime, latency, error rates against SLA terms defined in contracts;
 * sends alerts and SLA breach events to ObservabilityDashboard.
 */

import { PrismaClient } from '@prisma/client';
import { MetricsCollector, getDefaultMetricsCollector } from '../../observability/metricsCollector';

export interface SLATerms {
  uptime?: number; // percentage (0-100)
  maxLatency?: number; // milliseconds
  maxErrorRate?: number; // percentage (0-100)
  measurementWindow?: 'hourly' | 'daily' | 'weekly' | 'monthly';
}

export interface SLAMetrics {
  contractId: string;
  period: string;
  periodStart: Date;
  periodEnd: Date;
  uptime: number; // percentage
  avgLatency: number; // milliseconds
  p95Latency?: number; // milliseconds
  p99Latency?: number; // milliseconds
  errorRate: number; // percentage
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  measuredAt: Date;
}

export interface SLABreachEvent {
  contractId: string;
  breachType: 'uptime' | 'latency' | 'error_rate';
  severity: 'low' | 'medium' | 'high' | 'critical';
  slaTerm: string;
  threshold: number;
  actual: number;
  breachDuration?: number; // milliseconds
  occurredAt: Date;
  metrics: SLAMetrics;
}

export interface SLAAlert {
  contractId: string;
  alertType: 'breach' | 'warning' | 'recovery';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  metrics: SLAMetrics;
  occurredAt: Date;
}

/**
 * ServiceLevelMonitor - Monitors SLA compliance for contracts
 */
export class ServiceLevelMonitor {
  private metricsCollector: MetricsCollector;
  private breachHistory: Map<string, SLABreachEvent[]> = new Map();

  constructor(
    private prisma: PrismaClient,
    metricsCollector?: MetricsCollector
  ) {
    this.metricsCollector = metricsCollector || getDefaultMetricsCollector();
  }

  /**
   * Monitor SLA for a specific contract
   */
  async monitorContract(contractId: string): Promise<SLAMetrics | null> {
    const contract = await this.prisma.partnerContract.findUnique({
      where: { id: contractId },
    });

    if (!contract || contract.status !== 'signed') {
      return null;
    }

    const terms = (contract.terms || {}) as { slaRequirements?: SLATerms };
    if (!terms.slaRequirements) {
      return null;
    }

    const slaTerms = terms.slaRequirements;
    const measurementWindow = slaTerms.measurementWindow || 'hourly';
    const period = this.getCurrentPeriod(measurementWindow);

    // Collect metrics from observability system
    const metrics = await this.collectSLAMetrics(contractId, period, measurementWindow);

    // Evaluate SLA compliance
    const breaches = this.evaluateSLACompliance(slaTerms, metrics);

    // Record breaches and send alerts
    for (const breach of breaches) {
      await this.recordBreach(breach);
      await this.sendAlert({
        contractId,
        alertType: 'breach',
        severity: breach.severity,
        message: `SLA breach detected: ${breach.breachType} - ${breach.actual} exceeds threshold ${breach.threshold}`,
        metrics,
        occurredAt: breach.occurredAt,
      });
    }

    // Check for recovery (if there was a previous breach)
    const previousBreaches = this.breachHistory.get(contractId) || [];
    if (previousBreaches.length > 0 && breaches.length === 0) {
      await this.sendAlert({
        contractId,
        alertType: 'recovery',
        severity: 'low',
        message: `SLA compliance recovered for contract ${contractId}`,
        metrics,
        occurredAt: new Date(),
      });
    }

    return metrics;
  }

  /**
   * Collect SLA metrics from observability system
   */
  private async collectSLAMetrics(
    contractId: string,
    period: string,
    window: string
  ): Promise<SLAMetrics> {
    const periodStart = this.getPeriodStart(window);
    const periodEnd = new Date();

    // In a real implementation, this would query Prometheus/metrics store
    // For now, we'll use mock data structure that would be populated from actual metrics
    // The metricsCollector would provide these values in production

    // Get metrics from the metrics collector (would need to be extended to support contract-specific metrics)
    const totalRequests = await this.getMetricValue(`contract_${contractId}_requests_total`, periodStart, periodEnd) || 0;
    const successfulRequests = await this.getMetricValue(`contract_${contractId}_requests_success_total`, periodStart, periodEnd) || 0;
    const failedRequests = totalRequests - successfulRequests;
    const errorRate = totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 0;

    const avgLatency = await this.getMetricValue(`contract_${contractId}_request_latency_avg`, periodStart, periodEnd) || 0;
    const p95Latency = await this.getMetricValue(`contract_${contractId}_request_latency_p95`, periodStart, periodEnd);
    const p99Latency = await this.getMetricValue(`contract_${contractId}_request_latency_p99`, periodStart, periodEnd);

    // Calculate uptime (simplified - would need more sophisticated calculation)
    const uptime = totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 100;

    return {
      contractId,
      period,
      periodStart,
      periodEnd,
      uptime,
      avgLatency,
      p95Latency,
      p99Latency,
      errorRate,
      totalRequests,
      successfulRequests,
      failedRequests,
      measuredAt: new Date(),
    };
  }

  /**
   * Get metric value from observability system (mock implementation)
   */
  private async getMetricValue(
    metricName: string,
    start: Date,
    end: Date
  ): Promise<number | null> {
    // In production, this would query Prometheus or another metrics store
    // For now, return null to indicate metrics need to be collected from actual observability system
    return null;
  }

  /**
   * Evaluate SLA compliance against terms
   */
  private evaluateSLACompliance(
    terms: SLATerms,
    metrics: SLAMetrics
  ): SLABreachEvent[] {
    const breaches: SLABreachEvent[] = [];

    if (terms.uptime !== undefined && metrics.uptime < terms.uptime) {
      const severity = this.determineSeverity(
        metrics.uptime,
        terms.uptime,
        'below'
      );
      breaches.push({
        contractId: metrics.contractId,
        breachType: 'uptime',
        severity,
        slaTerm: 'uptime',
        threshold: terms.uptime,
        actual: metrics.uptime,
        occurredAt: metrics.measuredAt,
        metrics,
      });
    }

    if (terms.maxLatency !== undefined && metrics.avgLatency > terms.maxLatency) {
      const severity = this.determineSeverity(
        metrics.avgLatency,
        terms.maxLatency,
        'above'
      );
      breaches.push({
        contractId: metrics.contractId,
        breachType: 'latency',
        severity,
        slaTerm: 'maxLatency',
        threshold: terms.maxLatency,
        actual: metrics.avgLatency,
        occurredAt: metrics.measuredAt,
        metrics,
      });
    }

    if (terms.maxErrorRate !== undefined && metrics.errorRate > terms.maxErrorRate) {
      const severity = this.determineSeverity(
        metrics.errorRate,
        terms.maxErrorRate,
        'above'
      );
      breaches.push({
        contractId: metrics.contractId,
        breachType: 'error_rate',
        severity,
        slaTerm: 'maxErrorRate',
        threshold: terms.maxErrorRate,
        actual: metrics.errorRate,
        occurredAt: metrics.measuredAt,
        metrics,
      });
    }

    return breaches;
  }

  /**
   * Determine severity based on deviation from threshold
   */
  private determineSeverity(
    actual: number,
    threshold: number,
    direction: 'above' | 'below'
  ): 'low' | 'medium' | 'high' | 'critical' {
    const deviation = direction === 'above'
      ? (actual - threshold) / threshold
      : (threshold - actual) / threshold;

    if (deviation >= 0.5) return 'critical';
    if (deviation >= 0.3) return 'high';
    if (deviation >= 0.1) return 'medium';
    return 'low';
  }

  /**
   * Record SLA breach event
   */
  private async recordBreach(breach: SLABreachEvent): Promise<void> {
    const history = this.breachHistory.get(breach.contractId) || [];
    history.push(breach);
    this.breachHistory.set(breach.contractId, history);

    // Record in observability system
    this.metricsCollector.recordError(
      'contracts',
      `sla_breach_${breach.breachType}`,
      1
    );

    // Record custom metric for SLA breaches
    const breachCounter = this.metricsCollector.getCounter(
      'contract_sla_breaches_total',
      'Total SLA breaches by contract',
      ['contract_id', 'breach_type', 'severity']
    );
    breachCounter.inc({
      contract_id: breach.contractId,
      breach_type: breach.breachType,
      severity: breach.severity,
    });
  }

  /**
   * Send alert to ObservabilityDashboard
   */
  private async sendAlert(alert: SLAAlert): Promise<void> {
    // In production, this would send to ObservabilityDashboard service
    // For now, we'll log and record metrics
    console.log('[ServiceLevelMonitor] SLA Alert:', JSON.stringify(alert, null, 2));

    // Record alert metric
    const alertCounter = this.metricsCollector.getCounter(
      'contract_sla_alerts_total',
      'Total SLA alerts',
      ['contract_id', 'alert_type', 'severity']
    );
    alertCounter.inc({
      contract_id: alert.contractId,
      alert_type: alert.alertType,
      severity: alert.severity,
    });

    // TODO: Integrate with ObservabilityDashboard service
    // await observabilityDashboard.sendAlert(alert);
  }

  /**
   * Get current period identifier
   */
  private getCurrentPeriod(window: string): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');

    switch (window) {
      case 'hourly':
        return `${year}-${month}-${day}-${hour}`;
      case 'daily':
        return `${year}-${month}-${day}`;
      case 'weekly':
        const week = Math.ceil(now.getDate() / 7);
        return `${year}-W${week}`;
      case 'monthly':
        return `${year}-${month}`;
      default:
        return `${year}-${month}-${day}`;
    }
  }

  /**
   * Get period start date based on window
   */
  private getPeriodStart(window: string): Date {
    const now = new Date();
    const start = new Date(now);

    switch (window) {
      case 'hourly':
        start.setMinutes(0, 0, 0);
        break;
      case 'daily':
        start.setHours(0, 0, 0, 0);
        break;
      case 'weekly':
        const day = start.getDay();
        start.setDate(start.getDate() - day);
        start.setHours(0, 0, 0, 0);
        break;
      case 'monthly':
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        break;
    }

    return start;
  }

  /**
   * Monitor all active contracts with SLA terms
   */
  async monitorAllContracts(): Promise<SLAMetrics[]> {
    const contracts = await this.prisma.partnerContract.findMany({
      where: {
        status: 'signed',
        effectiveDate: { lte: new Date() },
        OR: [
          { expiryDate: null },
          { expiryDate: { gte: new Date() } },
        ],
        terms: {
          path: ['slaRequirements'],
          isNot: null,
        },
      },
    });

    const results: SLAMetrics[] = [];

    for (const contract of contracts) {
      try {
        const metrics = await this.monitorContract(contract.id);
        if (metrics) {
          results.push(metrics);
        }
      } catch (error) {
        console.error(`Error monitoring contract ${contract.id}:`, error);
      }
    }

    return results;
  }

  /**
   * Get breach history for a contract
   */
  getBreachHistory(contractId: string): SLABreachEvent[] {
    return this.breachHistory.get(contractId) || [];
  }
}


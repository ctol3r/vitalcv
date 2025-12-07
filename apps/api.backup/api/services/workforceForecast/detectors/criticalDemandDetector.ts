/**
 * B206A-WF-005: CriticalDemandForecastDetector
 *
 * Flags 'critical shortages' when demand > supplyReadiness by threshold.
 * Integrates with WorkforceSupplyGraph to compare demand forecasts
 * against available supply.
 */

import { PrismaClient } from '@prisma/client';
import { DemandForecastEngine, ForecastRequest } from '../demandEngine.js';
import { WorkforceSupplyGraph, SupplyReadinessRequest } from '../graph/workforceSupplyGraph.js';

export interface CriticalShortageConfig {
  threshold: number; // Threshold ratio (demand / supply) that triggers alert
  minSeverity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  horizons?: number[]; // Which forecast horizons to check (default: all)
  orgId?: string;
}

export interface CriticalShortageAlert {
  forecastId: string;
  orgId?: string;
  department?: string;
  specialty?: string;
  role?: string;
  alertDate: Date;
  demandValue: number;
  supplyReadiness: number;
  shortageAmount: number;
  threshold: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  acknowledged: boolean;
  resolved: boolean;
  alertId?: string; // Database record ID
}

export interface DetectionResult {
  alerts: CriticalShortageAlert[];
  checkedForecasts: number;
  alertsGenerated: number;
}

export class CriticalDemandForecastDetector {
  constructor(
    private prisma: PrismaClient,
    private forecastEngine: DemandForecastEngine,
    private supplyGraph: WorkforceSupplyGraph
  ) {}

  /**
   * Detect critical shortages for a given context
   */
  async detectCriticalShortages(
    request: ForecastRequest,
    config: CriticalShortageConfig
  ): Promise<DetectionResult> {
    const {
      threshold,
      minSeverity = 'LOW',
      horizons,
      orgId,
    } = config;

    // Generate forecasts if not already done
    const forecastResponse = await this.forecastEngine.forecast({
      ...request,
      orgId: orgId || request.orgId,
      horizonDays: horizons,
    });

    const alerts: CriticalShortageAlert[] = [];
    let checkedForecasts = 0;

    // Check each forecast for critical shortages
    for (const forecast of forecastResponse.forecasts) {
      if (!forecast.forecastId) continue;

      checkedForecasts++;

      // Get supply readiness for this forecast date
      const supplyReadiness = await this.supplyGraph.calculateSupplyReadiness({
        orgId: orgId || request.orgId || undefined,
        department: request.department,
        specialty: request.specialty,
        role: request.role,
        targetDate: forecast.forecastDate,
      });

      // Calculate shortage
      const demandValue = forecast.predictedDemand;
      const supplyCapacity = supplyReadiness.availableCapacity;
      const supplyReadinessValue = supplyReadiness.readiness;
      const ratio = supplyCapacity > 0 ? demandValue / supplyCapacity : Infinity;
      const shortageAmount = Math.max(0, demandValue - supplyCapacity);

      // Check if threshold is exceeded
      if (ratio > threshold) {
        // Determine severity
        const severity = this.calculateSeverity(ratio, threshold, shortageAmount);

        // Skip if below minimum severity
        if (this.isSeverityBelow(severity, minSeverity)) {
          continue;
        }

        // Check if alert already exists
        const existingAlert = await this.prisma.criticalDemandAlert.findFirst({
          where: {
            forecastId: forecast.forecastId,
            acknowledged: false,
            resolved: false,
          },
        });

        if (existingAlert) {
          // Update existing alert
          const updated = await this.prisma.criticalDemandAlert.update({
            where: { id: existingAlert.id },
            data: {
              demandValue,
              supplyReadiness: supplyReadiness.readiness,
              shortageAmount,
              severity,
              updatedAt: new Date(),
            },
          });

          alerts.push({
            forecastId: forecast.forecastId,
            orgId: request.orgId,
            department: request.department,
            specialty: request.specialty,
            role: request.role,
            alertDate: new Date(),
            demandValue,
            supplyReadiness: supplyReadinessValue,
            shortageAmount,
            threshold,
            severity,
            acknowledged: false,
            resolved: false,
            alertId: updated.id,
          });
        } else {
          // Create new alert
          const alertRecord = await this.prisma.criticalDemandAlert.create({
            data: {
              forecastId: forecast.forecastId,
              orgId: request.orgId || null,
              department: request.department || null,
              specialty: request.specialty || null,
              role: request.role || null,
              alertDate: new Date(),
              demandValue,
              supplyReadiness: supplyReadinessValue,
              shortageAmount,
              threshold,
              severity,
              metadata: {
                ratio,
                supplyCapacity,
                forecastDate: forecast.forecastDate,
                horizonDays: forecast.horizonDays,
              },
            },
          });

          alerts.push({
            forecastId: forecast.forecastId,
            orgId: request.orgId,
            department: request.department,
            specialty: request.specialty,
            role: request.role,
            alertDate: new Date(),
            demandValue,
            supplyReadiness: supplyReadinessValue,
            shortageAmount,
            threshold,
            severity,
            acknowledged: false,
            resolved: false,
            alertId: alertRecord.id,
          });
        }
      }
    }

    return {
      alerts,
      checkedForecasts,
      alertsGenerated: alerts.length,
    };
  }

  /**
   * Calculate severity based on ratio and shortage amount
   */
  private calculateSeverity(
    ratio: number,
    threshold: number,
    shortageAmount: number
  ): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    // Severity levels:
    // LOW: Ratio 1.0-1.2x threshold
    // MEDIUM: Ratio 1.2-1.5x threshold
    // HIGH: Ratio 1.5-2.0x threshold
    // CRITICAL: Ratio > 2.0x threshold or severe absolute shortage

    const normalizedRatio = ratio / threshold;

    if (normalizedRatio >= 2.0 || shortageAmount > 50) {
      return 'CRITICAL';
    } else if (normalizedRatio >= 1.5 || shortageAmount > 20) {
      return 'HIGH';
    } else if (normalizedRatio >= 1.2 || shortageAmount > 10) {
      return 'MEDIUM';
    } else {
      return 'LOW';
    }
  }

  /**
   * Check if severity is below minimum required
   */
  private isSeverityBelow(
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    minSeverity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  ): boolean {
    const levels: Record<string, number> = {
      LOW: 1,
      MEDIUM: 2,
      HIGH: 3,
      CRITICAL: 4,
    };

    return levels[severity] < levels[minSeverity];
  }

  /**
   * Get active critical alerts
   */
  async getActiveAlerts(options: {
    orgId?: string;
    department?: string;
    specialty?: string;
    role?: string;
    severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    limit?: number;
  }): Promise<CriticalShortageAlert[]> {
    const where: any = {
      acknowledged: false,
      resolved: false,
    };

    if (options.orgId) where.orgId = options.orgId;
    if (options.department) where.department = options.department;
    if (options.specialty) where.specialty = options.specialty;
    if (options.role) where.role = options.role;
    if (options.severity) where.severity = options.severity;

    const alerts = await this.prisma.criticalDemandAlert.findMany({
      where,
      orderBy: [
        { severity: 'desc' },
        { alertDate: 'desc' },
      ],
      take: options.limit || 100,
    });

    return alerts.map(a => ({
      forecastId: a.forecastId,
      orgId: a.orgId || undefined,
      department: a.department || undefined,
      specialty: a.specialty || undefined,
      role: a.role || undefined,
      alertDate: a.alertDate,
      demandValue: a.demandValue,
      supplyReadiness: a.supplyReadiness,
      shortageAmount: a.shortageAmount,
      threshold: a.threshold,
      severity: a.severity as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
      acknowledged: a.acknowledged,
      resolved: a.resolved,
      alertId: a.id,
    }));
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(
    alertId: string,
    acknowledgedBy: string
  ): Promise<void> {
    await this.prisma.criticalDemandAlert.update({
      where: { id: alertId },
      data: {
        acknowledged: true,
        acknowledgedAt: new Date(),
        acknowledgedBy,
      },
    });
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(
    alertId: string,
    resolvedBy: string
  ): Promise<void> {
    await this.prisma.criticalDemandAlert.update({
      where: { id: alertId },
      data: {
        resolved: true,
        resolvedAt: new Date(),
        resolvedBy,
      },
    });
  }
}


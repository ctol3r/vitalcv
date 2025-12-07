/**
 * B206B-WF-009: SupplyShockDetector
 *
 * Detects sudden predicted supply drops:
 * - Mass license expirations
 * - Overlapping renewal cycles
 * - Predicted privilege holds
 */

import type { AggregateSupplyForecast } from '../supplyEngine.js';
import type { SupplyReadinessPrediction } from '../model/supplyModel.js';

export interface SupplyShock {
  id: string;
  type: 'MASS_EXPIRATION' | 'RENEWAL_OVERLAP' | 'PRIVILEGE_HOLD' | 'SAFETY_HOLD' | 'ENROLLMENT_CRISIS';
  severity: 'LOW' | 'MED' | 'HIGH' | 'CRITICAL';
  detectedAt: Date;
  predictedStartDate: Date;
  predictedEndDate: Date;
  affectedClinicians: number;
  affectedOrgIds?: string[];
  affectedDepartmentIds?: string[];
  description: string;
  factors: {
    baselineReadiness: number;
    shockReadiness: number;
    readinessDrop: number;
    gapCount: number;
  };
  recommendations: string[];
}

export interface ShockDetectionConfig {
  massExpirationThreshold?: number; // Min clinicians with expiring credentials
  massExpirationPercent?: number; // Min percentage of total
  renewalOverlapWindow?: number; // Days to consider for overlap
  privilegeHoldThreshold?: number; // Min clinicians with privilege holds
  safetyHoldThreshold?: number; // Min clinicians with safety holds
  enrollmentCrisisThreshold?: number; // Min clinicians with enrollment issues
  readinessDropThreshold?: number; // Min drop in readiness to trigger shock
}

const DEFAULT_CONFIG: Required<ShockDetectionConfig> = {
  massExpirationThreshold: 5,
  massExpirationPercent: 0.1, // 10%
  renewalOverlapWindow: 30,
  privilegeHoldThreshold: 3,
  safetyHoldThreshold: 3,
  enrollmentCrisisThreshold: 5,
  readinessDropThreshold: 0.2, // 20% drop
};

export class SupplyShockDetector {
  constructor(private config: ShockDetectionConfig = {}) {}

  /**
   * Detect supply shocks from forecast
   */
  async detectShocks(
    forecast: AggregateSupplyForecast,
    previousForecast?: AggregateSupplyForecast | null
  ): Promise<SupplyShock[]> {
    const shocks: SupplyShock[] = [];
    const effectiveConfig = { ...DEFAULT_CONFIG, ...this.config };

    // Detect mass license expirations
    const massExpirationShock = this.detectMassExpiration(
      forecast,
      effectiveConfig
    );
    if (massExpirationShock) {
      shocks.push(massExpirationShock);
    }

    // Detect overlapping renewal cycles
    const renewalOverlapShock = this.detectRenewalOverlap(
      forecast,
      effectiveConfig
    );
    if (renewalOverlapShock) {
      shocks.push(renewalOverlapShock);
    }

    // Detect privilege holds
    const privilegeHoldShock = this.detectPrivilegeHolds(
      forecast,
      effectiveConfig
    );
    if (privilegeHoldShock) {
      shocks.push(privilegeHoldShock);
    }

    // Detect safety holds
    const safetyHoldShock = this.detectSafetyHolds(
      forecast,
      effectiveConfig
    );
    if (safetyHoldShock) {
      shocks.push(safetyHoldShock);
    }

    // Detect enrollment crises
    const enrollmentCrisisShock = this.detectEnrollmentCrisis(
      forecast,
      effectiveConfig
    );
    if (enrollmentCrisisShock) {
      shocks.push(enrollmentCrisisShock);
    }

    // Detect sudden readiness drops (if previous forecast available)
    if (previousForecast) {
      const readinessDropShock = this.detectReadinessDrop(
        forecast,
        previousForecast,
        effectiveConfig
      );
      if (readinessDropShock) {
        shocks.push(readinessDropShock);
      }
    }

    return shocks;
  }

  /**
   * Detect mass license expirations
   */
  private detectMassExpiration(
    forecast: AggregateSupplyForecast,
    config: Required<ShockDetectionConfig>
  ): SupplyShock | null {
    // Count clinicians with license expiration gaps
    const licenseExpirationGaps = forecast.predictedGaps.filter(
      (gap) => gap.reason.includes('License expiration')
    );

    if (licenseExpirationGaps.length === 0) {
      return null;
    }

    const affectedCount = licenseExpirationGaps.reduce(
      (sum, gap) => sum + gap.affectedClinicians,
      0
    );

    const meetsThreshold =
      affectedCount >= config.massExpirationThreshold ||
      affectedCount / forecast.totalClinicians >= config.massExpirationPercent;

    if (!meetsThreshold) {
      return null;
    }

    const severity = this.determineSeverity(
      affectedCount,
      forecast.totalClinicians
    );

    return {
      id: `mass-expiration-${forecast.timestamp.getTime()}`,
      type: 'MASS_EXPIRATION',
      severity,
      detectedAt: new Date(),
      predictedStartDate: forecast.timeWindowStart,
      predictedEndDate: forecast.timeWindowEnd,
      affectedClinicians: affectedCount,
      affectedOrgIds: forecast.orgId ? [forecast.orgId] : undefined,
      affectedDepartmentIds: forecast.departmentId
        ? [forecast.departmentId]
        : undefined,
      description: `${affectedCount} clinicians have license expirations in the forecast window`,
      factors: {
        baselineReadiness: forecast.averageReadiness,
        shockReadiness: this.calculateShockReadiness(forecast, affectedCount),
        readinessDrop:
          forecast.averageReadiness -
          this.calculateShockReadiness(forecast, affectedCount),
        gapCount: licenseExpirationGaps.length,
      },
      recommendations: [
        'Initiate proactive license renewal campaigns',
        'Identify backup clinicians for affected areas',
        'Consider temporary credentialing for replacements',
      ],
    };
  }

  /**
   * Detect overlapping renewal cycles
   */
  private detectRenewalOverlap(
    forecast: AggregateSupplyForecast,
    config: Required<ShockDetectionConfig>
  ): SupplyShock | null {
    // Count clinicians with multiple renewal gaps in the same window
    const renewalGaps = forecast.predictedGaps.filter(
      (gap) =>
        gap.reason.includes('renewal') || gap.reason.includes('Renewal')
    );

    if (renewalGaps.length < 2) {
      return null;
    }

    // Check for overlapping time windows
    const overlappingGaps = this.findOverlappingGaps(
      renewalGaps,
      config.renewalOverlapWindow
    );

    if (overlappingGaps.length === 0) {
      return null;
    }

    const affectedCount = new Set(
      overlappingGaps.flatMap((gap) => {
        // Estimate affected clinicians from gap data
        // In practice, this would be more precise
        return Array.from({ length: gap.affectedClinicians }, (_, i) => `clinician-${i}`);
      })
    ).size;

    const severity = this.determineSeverity(
      affectedCount,
      forecast.totalClinicians
    );

    return {
      id: `renewal-overlap-${forecast.timestamp.getTime()}`,
      type: 'RENEWAL_OVERLAP',
      severity,
      detectedAt: new Date(),
      predictedStartDate: forecast.timeWindowStart,
      predictedEndDate: forecast.timeWindowEnd,
      affectedClinicians: affectedCount,
      affectedOrgIds: forecast.orgId ? [forecast.orgId] : undefined,
      affectedDepartmentIds: forecast.departmentId
        ? [forecast.departmentId]
        : undefined,
      description: `Overlapping renewal cycles detected for ${affectedCount} clinicians`,
      factors: {
        baselineReadiness: forecast.averageReadiness,
        shockReadiness: this.calculateShockReadiness(forecast, affectedCount),
        readinessDrop:
          forecast.averageReadiness -
          this.calculateShockReadiness(forecast, affectedCount),
        gapCount: overlappingGaps.length,
      },
      recommendations: [
        'Stagger renewal deadlines where possible',
        'Allocate additional administrative resources',
        'Prioritize high-impact renewals',
      ],
    };
  }

  /**
   * Detect privilege holds
   */
  private detectPrivilegeHolds(
    forecast: AggregateSupplyForecast,
    config: Required<ShockDetectionConfig>
  ): SupplyShock | null {
    const privilegeGaps = forecast.predictedGaps.filter(
      (gap) => gap.reason.includes('privilege') || gap.reason.includes('Privilege')
    );

    if (privilegeGaps.length === 0) {
      return null;
    }

    const affectedCount = privilegeGaps.reduce(
      (sum, gap) => sum + gap.affectedClinicians,
      0
    );

    if (affectedCount < config.privilegeHoldThreshold) {
      return null;
    }

    const severity = this.determineSeverity(
      affectedCount,
      forecast.totalClinicians
    );

    return {
      id: `privilege-hold-${forecast.timestamp.getTime()}`,
      type: 'PRIVILEGE_HOLD',
      severity,
      detectedAt: new Date(),
      predictedStartDate: forecast.timeWindowStart,
      predictedEndDate: forecast.timeWindowEnd,
      affectedClinicians: affectedCount,
      affectedOrgIds: forecast.orgId ? [forecast.orgId] : undefined,
      affectedDepartmentIds: forecast.departmentId
        ? [forecast.departmentId]
        : undefined,
      description: `${affectedCount} clinicians have predicted privilege holds`,
      factors: {
        baselineReadiness: forecast.averageReadiness,
        shockReadiness: this.calculateShockReadiness(forecast, affectedCount),
        readinessDrop:
          forecast.averageReadiness -
          this.calculateShockReadiness(forecast, affectedCount),
        gapCount: privilegeGaps.length,
      },
      recommendations: [
        'Review privilege renewal processes',
        'Identify root causes of privilege holds',
        'Expedite privilege reviews for affected clinicians',
      ],
    };
  }

  /**
   * Detect safety holds
   */
  private detectSafetyHolds(
    forecast: AggregateSupplyForecast,
    config: Required<ShockDetectionConfig>
  ): SupplyShock | null {
    const safetyGaps = forecast.predictedGaps.filter(
      (gap) => gap.reason.includes('safety') || gap.reason.includes('Safety')
    );

    if (safetyGaps.length === 0) {
      return null;
    }

    const affectedCount = safetyGaps.reduce(
      (sum, gap) => sum + gap.affectedClinicians,
      0
    );

    if (affectedCount < config.safetyHoldThreshold) {
      return null;
    }

    const severity = this.determineSeverity(
      affectedCount,
      forecast.totalClinicians
    );

    return {
      id: `safety-hold-${forecast.timestamp.getTime()}`,
      type: 'SAFETY_HOLD',
      severity,
      detectedAt: new Date(),
      predictedStartDate: forecast.timeWindowStart,
      predictedEndDate: forecast.timeWindowEnd,
      affectedClinicians: affectedCount,
      affectedOrgIds: forecast.orgId ? [forecast.orgId] : undefined,
      affectedDepartmentIds: forecast.departmentId
        ? [forecast.departmentId]
        : undefined,
      description: `${affectedCount} clinicians have predicted safety holds`,
      factors: {
        baselineReadiness: forecast.averageReadiness,
        shockReadiness: this.calculateShockReadiness(forecast, affectedCount),
        readinessDrop:
          forecast.averageReadiness -
          this.calculateShockReadiness(forecast, affectedCount),
        gapCount: safetyGaps.length,
      },
      recommendations: [
        'Conduct safety reviews for affected clinicians',
        'Implement targeted safety interventions',
        'Consider temporary practice restrictions',
      ],
    };
  }

  /**
   * Detect enrollment crises
   */
  private detectEnrollmentCrisis(
    forecast: AggregateSupplyForecast,
    config: Required<ShockDetectionConfig>
  ): SupplyShock | null {
    const enrollmentGaps = forecast.predictedGaps.filter(
      (gap) =>
        gap.reason.includes('enrollment') || gap.reason.includes('Enrollment')
    );

    if (enrollmentGaps.length === 0) {
      return null;
    }

    const affectedCount = enrollmentGaps.reduce(
      (sum, gap) => sum + gap.affectedClinicians,
      0
    );

    if (affectedCount < config.enrollmentCrisisThreshold) {
      return null;
    }

    const severity = this.determineSeverity(
      affectedCount,
      forecast.totalClinicians
    );

    return {
      id: `enrollment-crisis-${forecast.timestamp.getTime()}`,
      type: 'ENROLLMENT_CRISIS',
      severity,
      detectedAt: new Date(),
      predictedStartDate: forecast.timeWindowStart,
      predictedEndDate: forecast.timeWindowEnd,
      affectedClinicians: affectedCount,
      affectedOrgIds: forecast.orgId ? [forecast.orgId] : undefined,
      affectedDepartmentIds: forecast.departmentId
        ? [forecast.departmentId]
        : undefined,
      description: `${affectedCount} clinicians have enrollment renewal issues`,
      factors: {
        baselineReadiness: forecast.averageReadiness,
        shockReadiness: this.calculateShockReadiness(forecast, affectedCount),
        readinessDrop:
          forecast.averageReadiness -
          this.calculateShockReadiness(forecast, affectedCount),
        gapCount: enrollmentGaps.length,
      },
      recommendations: [
        'Prioritize enrollment renewals',
        'Coordinate with payer enrollment teams',
        'Identify alternative coverage options',
      ],
    };
  }

  /**
   * Detect sudden readiness drops
   */
  private detectReadinessDrop(
    forecast: AggregateSupplyForecast,
    previousForecast: AggregateSupplyForecast,
    config: Required<ShockDetectionConfig>
  ): SupplyShock | null {
    const readinessDrop =
      previousForecast.averageReadiness - forecast.averageReadiness;

    if (readinessDrop < config.readinessDropThreshold) {
      return null;
    }

    const severity = this.determineSeverityFromDrop(readinessDrop);

    return {
      id: `readiness-drop-${forecast.timestamp.getTime()}`,
      type: 'MASS_EXPIRATION', // Generic type for readiness drops
      severity,
      detectedAt: new Date(),
      predictedStartDate: forecast.timeWindowStart,
      predictedEndDate: forecast.timeWindowEnd,
      affectedClinicians: forecast.atRiskClinicians,
      affectedOrgIds: forecast.orgId ? [forecast.orgId] : undefined,
      affectedDepartmentIds: forecast.departmentId
        ? [forecast.departmentId]
        : undefined,
      description: `Supply readiness dropped by ${Math.round(readinessDrop * 100)}%`,
      factors: {
        baselineReadiness: previousForecast.averageReadiness,
        shockReadiness: forecast.averageReadiness,
        readinessDrop,
        gapCount: forecast.predictedGaps.length,
      },
      recommendations: [
        'Investigate root causes of readiness drop',
        'Implement immediate mitigation strategies',
        'Review credentialing and renewal processes',
      ],
    };
  }

  /**
   * Determine severity based on affected count
   */
  private determineSeverity(
    affectedCount: number,
    totalCount: number
  ): 'LOW' | 'MED' | 'HIGH' | 'CRITICAL' {
    const percent = totalCount > 0 ? affectedCount / totalCount : 0;

    if (percent >= 0.3 || affectedCount >= 20) {
      return 'CRITICAL';
    }
    if (percent >= 0.15 || affectedCount >= 10) {
      return 'HIGH';
    }
    if (percent >= 0.05 || affectedCount >= 5) {
      return 'MED';
    }
    return 'LOW';
  }

  /**
   * Determine severity from readiness drop
   */
  private determineSeverityFromDrop(
    drop: number
  ): 'LOW' | 'MED' | 'HIGH' | 'CRITICAL' {
    if (drop >= 0.4) {
      return 'CRITICAL';
    }
    if (drop >= 0.3) {
      return 'HIGH';
    }
    if (drop >= 0.2) {
      return 'MED';
    }
    return 'LOW';
  }

  /**
   * Calculate shock readiness (readiness after shock)
   */
  private calculateShockReadiness(
    forecast: AggregateSupplyForecast,
    affectedCount: number
  ): number {
    // Simplified: assume affected clinicians have 0 readiness
    const unaffectedCount = forecast.totalClinicians - affectedCount;
    if (unaffectedCount === 0) {
      return 0;
    }

    // Weighted average: unaffected clinicians maintain readiness
    const unaffectedReadiness =
      (forecast.averageReadiness * forecast.totalClinicians) /
      unaffectedCount;
    return Math.max(0, Math.min(1, unaffectedReadiness * (unaffectedCount / forecast.totalClinicians)));
  }

  /**
   * Find overlapping gaps
   */
  private findOverlappingGaps(
    gaps: Array<{
      startDate: Date;
      endDate: Date;
      reason: string;
      severity: 'LOW' | 'MED' | 'HIGH' | 'CRITICAL';
      affectedClinicians: number;
    }>,
    windowDays: number
  ): Array<{
    startDate: Date;
    endDate: Date;
    reason: string;
    severity: 'LOW' | 'MED' | 'HIGH' | 'CRITICAL';
    affectedClinicians: number;
  }> {
    const overlapping: typeof gaps = [];

    for (let i = 0; i < gaps.length; i++) {
      for (let j = i + 1; j < gaps.length; j++) {
        const gap1 = gaps[i];
        const gap2 = gaps[j];

        // Check if gaps overlap within window
        const overlapStart = new Date(
          Math.max(gap1.startDate.getTime(), gap2.startDate.getTime())
        );
        const overlapEnd = new Date(
          Math.min(gap1.endDate.getTime(), gap2.endDate.getTime())
        );

        if (overlapStart < overlapEnd) {
          const overlapDays =
            (overlapEnd.getTime() - overlapStart.getTime()) /
            (24 * 60 * 60 * 1000);

          if (overlapDays <= windowDays) {
            overlapping.push(gap1, gap2);
          }
        }
      }
    }

    // Remove duplicates
    return Array.from(
      new Map(overlapping.map((gap) => [gap.reason, gap])).values()
    );
  }
}

/**
 * Default detector instance
 */
export const supplyShockDetector = new SupplyShockDetector();


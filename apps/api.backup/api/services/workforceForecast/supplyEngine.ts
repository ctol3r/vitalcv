/**
 * B206B-WF-008: SupplyForecastEngine
 *
 * Produces supply forecast for department/org/system.
 * Integrated with MobilityEngine.
 */

import { PrismaClient } from '@prisma/client';
import { MobilityEngine } from '../mobility/mobilityEngine.js';
import { SupplyForecastFeatureExtractor } from './extractors/supplyFeatures.js';
import { SupplyForecastModel } from './model/supplyModel.js';
import type {
  SupplyReadinessPrediction,
  SupplyForecastInput,
} from './model/supplyModel.js';

export interface SupplyForecastRequest {
  orgId?: string;
  departmentId?: string;
  systemId?: string;
  clinicianIds?: string[]; // Optional: specific clinicians
  timeWindowDays?: number; // Default 30
  timestamp?: Date;
}

export interface ClinicianSupplyForecast {
  clinicianId: string;
  prediction: SupplyReadinessPrediction;
}

export interface AggregateSupplyForecast {
  orgId?: string;
  departmentId?: string;
  systemId?: string;
  timeWindowStart: Date;
  timeWindowEnd: Date;
  totalClinicians: number;
  availableClinicians: number; // Readiness >= 0.7
  atRiskClinicians: number; // Readiness < 0.5
  averageReadiness: number; // 0-1
  predictedGaps: Array<{
    startDate: Date;
    endDate: Date;
    reason: string;
    severity: 'LOW' | 'MED' | 'HIGH' | 'CRITICAL';
    affectedClinicians: number;
  }>;
  clinicianForecasts: ClinicianSupplyForecast[];
  timestamp: Date;
}

export class SupplyForecastEngine {
  constructor(
    private readonly prisma: PrismaClient = new PrismaClient(),
    private readonly mobilityEngine?: MobilityEngine,
    private readonly featureExtractor: SupplyForecastFeatureExtractor = new SupplyForecastFeatureExtractor(),
    private readonly model: SupplyForecastModel = new SupplyForecastModel()
  ) {}

  /**
   * Generate supply forecast for an organization, department, or system
   */
  async generateForecast(
    request: SupplyForecastRequest
  ): Promise<AggregateSupplyForecast> {
    const timestamp = request.timestamp || new Date();
    const timeWindowDays = request.timeWindowDays || 30;

    // Get clinician IDs based on scope
    const clinicianIds = await this.getClinicianIds(request);

    // Generate forecasts for each clinician
    const clinicianForecasts: ClinicianSupplyForecast[] = [];

    for (const clinicianId of clinicianIds) {
      try {
        const prediction = await this.forecastClinician(
          clinicianId,
          timestamp,
          timeWindowDays
        );
        clinicianForecasts.push({
          clinicianId,
          prediction,
        });
      } catch (error) {
        console.error(
          `[SupplyForecastEngine] Error forecasting clinician ${clinicianId}:`,
          error
        );
        // Continue with other clinicians
      }
    }

    // Aggregate results
    const aggregate = this.aggregateForecasts(
      clinicianForecasts,
      request,
      timestamp,
      timeWindowDays
    );

    return aggregate;
  }

  /**
   * Forecast supply readiness for a single clinician
   */
  private async forecastClinician(
    clinicianId: string,
    timestamp: Date,
    timeWindowDays: number
  ): Promise<SupplyReadinessPrediction> {
    // Extract features
    const features = await this.extractClinicianFeatures(clinicianId, timestamp);

    // Get safety features if available
    // Note: This would integrate with predictiveSafety service
    const safetyFeatures = null; // TODO: Integrate with predictiveSafety

    // Get mobility readiness if MobilityEngine is available
    let mobilityStatus = null;
    if (this.mobilityEngine) {
      // Note: This would require org context, simplified here
      // In practice, you'd need to know the target org
      mobilityStatus = null; // TODO: Integrate with MobilityEngine
    }

    // Create forecast input
    const forecastInput: SupplyForecastInput = {
      clinicianId,
      features,
      safetyFeatures,
      timestamp,
      timeWindowDays,
    };

    // Predict
    return this.model.predict(forecastInput);
  }

  /**
   * Extract features for a clinician
   */
  private async extractClinicianFeatures(
    clinicianId: string,
    timestamp: Date
  ) {
    // Fetch credential data from database
    const [licenses, boards, dea, privileges, enrollments, compacts] =
      await Promise.all([
        this.fetchLicenseExpirations(clinicianId),
        this.fetchBoardExpirations(clinicianId),
        this.fetchDEAExpirations(clinicianId),
        this.fetchPrivilegeRenewals(clinicianId),
        this.fetchEnrollmentCycles(clinicianId),
        this.fetchCompactEligibility(clinicianId),
      ]);

    // Extract features
    return this.featureExtractor.extractFeatures(
      { clinicianId, timestamp },
      {
        licenses,
        boards,
        dea,
        privileges,
        safetyFeatures: null, // TODO: Integrate with predictiveSafety
        mobilityStatus: null, // TODO: Integrate with MobilityEngine
        enrollments,
        compacts,
      }
    );
  }

  /**
   * Get clinician IDs based on request scope
   */
  private async getClinicianIds(
    request: SupplyForecastRequest
  ): Promise<string[]> {
    if (request.clinicianIds && request.clinicianIds.length > 0) {
      return request.clinicianIds;
    }

    // Build query based on scope
    const where: any = {};

    if (request.orgId) {
      where.orgId = request.orgId;
    }

    if (request.departmentId) {
      where.departmentId = request.departmentId;
    }

    if (request.systemId) {
      // System-level query would need system-to-org mapping
      // Simplified for now
      where.systemId = request.systemId;
    }

    // Fetch clinicians from database
    // TODO: Adjust based on your actual schema
    // This is a placeholder - the actual query will depend on your data model
    // Options:
    // - If clinicians are Users with a role: prisma.user.findMany({ where: { roles: { has: 'clinician' }, ...where } })
    // - If there's a separate Clinician model: prisma.clinician.findMany({ where, select: { id: true } })
    // - If using org relationships: prisma.orgMember.findMany({ where, select: { clinicianId: true } })

    // Placeholder implementation - replace with actual query
    const clinicians: Array<{ id: string }> = [];
    return clinicians.map((c) => c.id);
  }

  /**
   * Fetch license expirations
   */
  private async fetchLicenseExpirations(clinicianId: string) {
    // TODO: Implement based on your schema
    // This is a placeholder
    const licenses = await this.prisma.stateLicenseVerification.findMany({
      where: {
        clinicianId,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        state: true,
        expirationDate: true,
      },
    });

    const now = new Date();
    return licenses.map((license) => ({
      licenseId: license.id,
      state: license.state || 'UNKNOWN',
      expiryDate: license.expirationDate || new Date(),
      daysUntilExpiry: Math.floor(
        ((license.expirationDate?.getTime() || now.getTime()) - now.getTime()) /
          (24 * 60 * 60 * 1000)
      ),
      renewalRequired: (license.expirationDate?.getTime() || 0) <= now.getTime() + 90 * 24 * 60 * 60 * 1000,
    }));
  }

  /**
   * Fetch board expirations
   */
  private async fetchBoardExpirations(clinicianId: string) {
    // TODO: Implement based on your schema
    return [];
  }

  /**
   * Fetch DEA expirations
   */
  private async fetchDEAExpirations(clinicianId: string) {
    // TODO: Implement based on your schema
    return [];
  }

  /**
   * Fetch privilege renewals
   */
  private async fetchPrivilegeRenewals(clinicianId: string) {
    // TODO: Implement based on your schema
    return [];
  }

  /**
   * Fetch enrollment cycles
   */
  private async fetchEnrollmentCycles(clinicianId: string) {
    // TODO: Implement based on your schema
    return [];
  }

  /**
   * Fetch compact eligibility
   */
  private async fetchCompactEligibility(clinicianId: string) {
    // TODO: Implement based on your schema
    return [];
  }

  /**
   * Aggregate individual forecasts into summary
   */
  private aggregateForecasts(
    forecasts: ClinicianSupplyForecast[],
    request: SupplyForecastRequest,
    timestamp: Date,
    timeWindowDays: number
  ): AggregateSupplyForecast {
    const timeWindowStart = timestamp;
    const timeWindowEnd = new Date(
      timestamp.getTime() + timeWindowDays * 24 * 60 * 60 * 1000
    );

    const totalClinicians = forecasts.length;
    const availableClinicians = forecasts.filter(
      (f) => f.prediction.supplyReadiness >= 0.7
    ).length;
    const atRiskClinicians = forecasts.filter(
      (f) => f.prediction.supplyReadiness < 0.5
    ).length;

    const averageReadiness =
      forecasts.length > 0
        ? forecasts.reduce(
            (sum, f) => sum + f.prediction.supplyReadiness,
            0
          ) / forecasts.length
        : 0;

    // Aggregate gaps
    const gapMap = new Map<
      string,
      {
        startDate: Date;
        endDate: Date;
        reason: string;
        severity: 'LOW' | 'MED' | 'HIGH' | 'CRITICAL';
        affectedClinicians: Set<string>;
      }
    >();

    for (const forecast of forecasts) {
      for (const gap of forecast.prediction.predictedGaps) {
        const key = `${gap.reason}-${gap.severity}`;
        const existing = gapMap.get(key);
        if (existing) {
          existing.affectedClinicians.add(forecast.clinicianId);
        } else {
          gapMap.set(key, {
            startDate: gap.startDate,
            endDate: gap.endDate,
            reason: gap.reason,
            severity: gap.severity,
            affectedClinicians: new Set([forecast.clinicianId]),
          });
        }
      }
    }

    const predictedGaps = Array.from(gapMap.values()).map((gap) => ({
      startDate: gap.startDate,
      endDate: gap.endDate,
      reason: gap.reason,
      severity: gap.severity,
      affectedClinicians: gap.affectedClinicians.size,
    }));

    return {
      orgId: request.orgId,
      departmentId: request.departmentId,
      systemId: request.systemId,
      timeWindowStart,
      timeWindowEnd,
      totalClinicians,
      availableClinicians,
      atRiskClinicians,
      averageReadiness,
      predictedGaps,
      clinicianForecasts: forecasts,
      timestamp,
    };
  }
}

/**
 * Default engine instance
 */
export const supplyForecastEngine = new SupplyForecastEngine();


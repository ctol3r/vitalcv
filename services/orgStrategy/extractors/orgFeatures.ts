/**
 * B209A-STRAT-002: OrgFeatureExtractor
 *
 * Extracts org-level features:
 * - Cumulative credential expiration windows
 * - Privilege gaps
 * - OPPE trends
 * - Cross-org mobility
 * - Supply shock risk
 */

import type { PrismaClient } from '@prisma/client';

/**
 * Org-level features extracted from various data sources
 */
export interface OrgFeatures {
  // Cumulative credential expiration windows: Credential expirations aggregated by time windows
  credentialExpirationWindows: Record<string, number>; // Map of time windows (e.g., "0-30d", "30-60d") to counts

  // Privilege gaps: Gaps between required and available privileges
  privilegeGaps: {
    totalGaps: number;
    criticalGaps: number; // High-priority gaps
    gapDetails: Array<{
      privilegeCode: string;
      department?: string;
      gapAmount: number; // Required - Available
      severity: 'LOW' | 'MED' | 'HIGH' | 'CRITICAL';
    }>;
  };

  // OPPE trends: Ongoing Professional Practice Evaluation trends across org
  oppeTrends: {
    avgTrend: number; // -1 to 1: declining to improving
    departments: Record<string, number>; // Department-level trends
    specialties: Record<string, number>; // Specialty-level trends
  };

  // Cross-org mobility: Clinician mobility patterns across organizations
  crossOrgMobility: {
    mobilityRate: number; // 0-1: percentage of clinicians with cross-org activity
    avgTenure: number; // Average tenure in months
    turnoverRate: number; // 0-1: annual turnover rate
    mobilityEvents: number; // Number of cross-org moves in period
  };

  // Supply shock risk: Risk of sudden supply disruption
  supplyShockRisk: {
    riskScore: number; // 0-1: overall supply shock risk
    factors: {
      credentialExpirationRisk: number; // 0-1
      singleOrgDependency: number; // 0-1: reliance on single org
      specialtyConcentration: number; // 0-1: concentration in few specialties
      geographicConcentration: number; // 0-1: geographic concentration risk
    };
  };
}

/**
 * Extract org-level features from database and related services
 */
export class OrgFeatureExtractor {
  constructor(private prisma: PrismaClient) {}

  /**
   * Extract all org-level features
   */
  async extractFeatures(orgId: string, periodDays: number = 365): Promise<OrgFeatures> {
    const [
      credentialWindows,
      privilegeGaps,
      oppeTrends,
      crossOrgMobility,
      supplyShockRisk,
    ] = await Promise.all([
      this.extractCredentialExpirationWindows(orgId, periodDays),
      this.extractPrivilegeGaps(orgId),
      this.extractOPPETrends(orgId, periodDays),
      this.extractCrossOrgMobility(orgId, periodDays),
      this.extractSupplyShockRisk(orgId, periodDays),
    ]);

    return {
      credentialExpirationWindows: credentialWindows,
      privilegeGaps,
      oppeTrends,
      crossOrgMobility,
      supplyShockRisk,
    };
  }

  /**
   * Extract cumulative credential expiration windows
   * Groups expiring credentials by time windows
   */
  private async extractCredentialExpirationWindows(
    orgId: string,
    periodDays: number
  ): Promise<Record<string, number>> {
    const now = new Date();
    const futureDate = new Date(now.getTime() + periodDays * 24 * 60 * 60 * 1000);

    // Query credential expirations from PrivilegeGranted and related credential data
    // This is a simplified version - adjust based on your actual schema
    const expiringPrivileges = await this.prisma.privilegeGranted.findMany({
      where: {
        orgId,
        expiresAt: {
          gte: now,
          lte: futureDate,
        },
      },
      select: {
        expiresAt: true,
      },
    });

    const windows: Record<string, number> = {
      '0-30d': 0,
      '30-60d': 0,
      '60-90d': 0,
      '90-180d': 0,
      '180-365d': 0,
      '365d+': 0,
    };

    for (const privilege of expiringPrivileges) {
      if (!privilege.expiresAt) continue;

      const daysUntilExpiry = Math.floor(
        (privilege.expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
      );

      if (daysUntilExpiry <= 30) {
        windows['0-30d']++;
      } else if (daysUntilExpiry <= 60) {
        windows['30-60d']++;
      } else if (daysUntilExpiry <= 90) {
        windows['60-90d']++;
      } else if (daysUntilExpiry <= 180) {
        windows['90-180d']++;
      } else if (daysUntilExpiry <= 365) {
        windows['180-365d']++;
      } else {
        windows['365d+']++;
      }
    }

    return windows;
  }

  /**
   * Extract privilege gaps
   * Compares required privileges to available ones
   */
  private async extractPrivilegeGaps(orgId: string): Promise<OrgFeatures['privilegeGaps']> {
    // Query privilege sets (required) vs granted privileges (available)
    const privilegeSets = await this.prisma.privilegeSetV2.findMany({
      where: { orgId, isActive: true },
      include: {
        privileges: {
          include: {
            privilegeMatrix: true,
          },
        },
      },
    });

    const grantedPrivileges = await this.prisma.privilegeGranted.findMany({
      where: {
        orgId,
        status: 'ACTIVE',
      },
      include: {
        privilegeRequest: {
          include: {
            privilegeSet: {
              include: {
                privileges: {
                  include: {
                    privilegeMatrix: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Count required vs available privileges
    const requiredByCode: Record<string, number> = {};
    const availableByCode: Record<string, number> = {};

    // Count required
    for (const set of privilegeSets) {
      for (const priv of set.privileges) {
        requiredByCode[priv.privilegeCode] =
          (requiredByCode[priv.privilegeCode] || 0) + 1;
      }
    }

    // Count available
    for (const granted of grantedPrivileges) {
      const set = granted.privilegeRequest?.privilegeSet;
      if (set?.privileges) {
        for (const priv of set.privileges) {
          availableByCode[priv.privilegeCode] =
            (availableByCode[priv.privilegeCode] || 0) + 1;
        }
      }
    }

    // Calculate gaps
    const gapDetails: OrgFeatures['privilegeGaps']['gapDetails'] = [];
    let totalGaps = 0;
    let criticalGaps = 0;

    for (const [code, required] of Object.entries(requiredByCode)) {
      const available = availableByCode[code] || 0;
      const gapAmount = required - available;

      if (gapAmount > 0) {
        totalGaps += gapAmount;

        // Determine severity based on gap amount and privilege type
        let severity: 'LOW' | 'MED' | 'HIGH' | 'CRITICAL' = 'LOW';
        if (gapAmount >= 5) {
          severity = 'CRITICAL';
          criticalGaps += gapAmount;
        } else if (gapAmount >= 3) {
          severity = 'HIGH';
          criticalGaps += gapAmount;
        } else if (gapAmount >= 2) {
          severity = 'MED';
        }

        gapDetails.push({
          privilegeCode: code,
          gapAmount,
          severity,
        });
      }
    }

    return {
      totalGaps,
      criticalGaps,
      gapDetails,
    };
  }

  /**
   * Extract OPPE trends
   * Analyzes Ongoing Professional Practice Evaluation trends
   */
  private async extractOPPETrends(
    orgId: string,
    periodDays: number
  ): Promise<OrgFeatures['oppeTrends']> {
    const startDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

    // Query FPPE/OPPE records
    const oppeRecords = await this.prisma.fppeOppe.findMany({
      where: {
        orgId,
        createdAt: {
          gte: startDate,
        },
      },
      select: {
        oppeMetrics: true,
        privilegeRequest: {
          include: {
            privilegeSet: true,
          },
        },
      },
    });

    // Calculate trends from OPPE metrics
    const trends: number[] = [];
    const departmentTrends: Record<string, number[]> = {};
    const specialtyTrends: Record<string, number[]> = {};

    for (const record of oppeRecords) {
      if (!record.oppeMetrics || typeof record.oppeMetrics !== 'object') continue;

      const metrics = record.oppeMetrics as Record<string, unknown>;
      const trend = this.calculateOPPETrend(metrics);
      trends.push(trend);

      // Group by department/specialty if available
      const department = record.privilegeRequest?.privilegeSet?.department;
      const specialty = record.privilegeRequest?.privilegeSet?.specialty;

      if (department) {
        if (!departmentTrends[department]) departmentTrends[department] = [];
        departmentTrends[department].push(trend);
      }

      if (specialty) {
        if (!specialtyTrends[specialty]) specialtyTrends[specialty] = [];
        specialtyTrends[specialty].push(trend);
      }
    }

    // Calculate averages
    const avgTrend =
      trends.length > 0 ? trends.reduce((sum, t) => sum + t, 0) / trends.length : 0;

    const departments: Record<string, number> = {};
    for (const [dept, deptTrends] of Object.entries(departmentTrends)) {
      departments[dept] =
        deptTrends.reduce((sum, t) => sum + t, 0) / deptTrends.length;
    }

    const specialties: Record<string, number> = {};
    for (const [spec, specTrends] of Object.entries(specialtyTrends)) {
      specialties[spec] =
        specTrends.reduce((sum, t) => sum + t, 0) / specTrends.length;
    }

    return {
      avgTrend,
      departments,
      specialties,
    };
  }

  /**
   * Calculate OPPE trend from metrics
   * Returns -1 (declining) to 1 (improving)
   */
  private calculateOPPETrend(metrics: Record<string, unknown>): number {
    // Simplified trend calculation based on metrics
    // Adjust based on actual OPPE metric structure
    const trend = (metrics.trend as number) || 0;
    return Math.max(-1, Math.min(1, trend));
  }

  /**
   * Extract cross-org mobility
   * Analyzes clinician mobility patterns
   */
  private async extractCrossOrgMobility(
    orgId: string,
    periodDays: number
  ): Promise<OrgFeatures['crossOrgMobility']> {
    const startDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
    const now = new Date();

    // Query privilege grants and org memberships to track mobility
    const privilegeGrants = await this.prisma.privilegeGranted.findMany({
      where: {
        orgId,
        createdAt: {
          gte: startDate,
        },
      },
      select: {
        clinicianDid: true,
        createdAt: true,
      },
    });

    // Query for clinicians with multiple org memberships
    const clinicianOrgs = new Map<string, Set<string>>();
    for (const grant of privilegeGrants) {
      if (!clinicianOrgs.has(grant.clinicianDid)) {
        clinicianOrgs.set(grant.clinicianDid, new Set());
      }
      clinicianOrgs.get(grant.clinicianDid)!.add(orgId);
    }

    // Query other orgs for same clinicians
    const allClinicianIds = Array.from(clinicianOrgs.keys());
    if (allClinicianIds.length > 0) {
      const otherGrants = await this.prisma.privilegeGranted.findMany({
        where: {
          clinicianDid: {
            in: allClinicianIds,
          },
          orgId: {
            not: orgId,
          },
          createdAt: {
            gte: startDate,
          },
        },
        select: {
          clinicianDid: true,
          orgId: true,
        },
      });

      for (const grant of otherGrants) {
        if (clinicianOrgs.has(grant.clinicianDid)) {
          clinicianOrgs.get(grant.clinicianDid)!.add(grant.orgId);
        }
      }
    }

    // Calculate mobility metrics
    let mobileCount = 0;
    let totalTenure = 0;
    const mobilityEvents: Array<{ clinicianDid: string; orgCount: number }> = [];

    for (const [clinicianDid, orgSet] of clinicianOrgs.entries()) {
      const orgCount = orgSet.size;
      if (orgCount > 1) {
        mobileCount++;
      }

      mobilityEvents.push({ clinicianDid, orgCount });

      // Estimate tenure (simplified - use average grant age)
      const grants = privilegeGrants.filter((g) => g.clinicianDid === clinicianDid);
      if (grants.length > 0) {
        const avgAge =
          grants.reduce(
            (sum, g) => sum + (now.getTime() - g.createdAt.getTime()),
            0
          ) / grants.length;
        const months = avgAge / (1000 * 60 * 60 * 24 * 30);
        totalTenure += months;
      }
    }

    const totalClinicians = clinicianOrgs.size;
    const mobilityRate = totalClinicians > 0 ? mobileCount / totalClinicians : 0;
    const avgTenure = totalClinicians > 0 ? totalTenure / totalClinicians : 0;

    // Estimate turnover rate (simplified)
    const turnoverRate = Math.min(1, mobilityRate * 0.3); // Rough estimate

    return {
      mobilityRate,
      avgTenure,
      turnoverRate,
      mobilityEvents: mobilityEvents.filter((e) => e.orgCount > 1).length,
    };
  }

  /**
   * Extract supply shock risk
   * Evaluates risk of sudden supply disruption
   */
  private async extractSupplyShockRisk(
    orgId: string,
    periodDays: number
  ): Promise<OrgFeatures['supplyShockRisk']> {
    const [credentialRisk, dependencyRisk, concentrationRisks] = await Promise.all([
      this.calculateCredentialExpirationRisk(orgId, periodDays),
      this.calculateSingleOrgDependency(orgId),
      this.calculateConcentrationRisks(orgId),
    ]);

    // Combine risk factors
    const riskScore =
      credentialRisk * 0.4 +
      dependencyRisk * 0.3 +
      concentrationRisks.specialty * 0.15 +
      concentrationRisks.geographic * 0.15;

    return {
      riskScore: Math.min(1, riskScore),
      factors: {
        credentialExpirationRisk: credentialRisk,
        singleOrgDependency: dependencyRisk,
        specialtyConcentration: concentrationRisks.specialty,
        geographicConcentration: concentrationRisks.geographic,
      },
    };
  }

  /**
   * Calculate credential expiration risk
   */
  private async calculateCredentialExpirationRisk(
    orgId: string,
    periodDays: number
  ): Promise<number> {
    const windows = await this.extractCredentialExpirationWindows(orgId, periodDays);
    const nearTermExpirations = windows['0-30d'] + windows['30-60d'];
    const totalExpirations = Object.values(windows).reduce((sum, val) => sum + val, 0);

    if (totalExpirations === 0) return 0;

    // Risk increases with near-term expirations
    return Math.min(1, nearTermExpirations / totalExpirations);
  }

  /**
   * Calculate single org dependency risk
   */
  private async calculateSingleOrgDependency(orgId: string): Promise<number> {
    // Simplified: check if clinicians have other org options
    const grants = await this.prisma.privilegeGranted.findMany({
      where: { orgId, status: 'ACTIVE' },
      select: { clinicianDid: true },
      distinct: ['clinicianDid'],
    });

    if (grants.length === 0) return 0;

    // Check how many have other org grants
    const clinicianIds = grants.map((g) => g.clinicianDid);
    const multiOrgGrants = await this.prisma.privilegeGranted.findMany({
      where: {
        clinicianDid: { in: clinicianIds },
        orgId: { not: orgId },
        status: 'ACTIVE',
      },
      select: { clinicianDid: true },
      distinct: ['clinicianDid'],
    });

    const dependencyRate = 1 - multiOrgGrants.length / grants.length;
    return Math.max(0, dependencyRate);
  }

  /**
   * Calculate concentration risks (specialty and geographic)
   */
  private async calculateConcentrationRisks(orgId: string): Promise<{
    specialty: number;
    geographic: number;
  }> {
    // Query privilege sets to analyze specialty distribution
    const privilegeSets = await this.prisma.privilegeSetV2.findMany({
      where: { orgId, isActive: true },
      select: { specialty: true },
    });

    // Count specialty distribution
    const specialtyCounts: Record<string, number> = {};
    for (const set of privilegeSets) {
      specialtyCounts[set.specialty] = (specialtyCounts[set.specialty] || 0) + 1;
    }

    // Calculate HHI (Herfindahl-Hirschman Index) for specialty concentration
    const total = Object.values(specialtyCounts).reduce((sum, val) => sum + val, 0);
    let specialtyHHI = 0;
    if (total > 0) {
      for (const count of Object.values(specialtyCounts)) {
        const share = count / total;
        specialtyHHI += share * share;
      }
    }

    // Geographic concentration (simplified - would need location data)
    // For now, return moderate risk
    const geographicConcentration = 0.5;

    return {
      specialty: specialtyHHI, // 0-1, higher = more concentrated
      geographic: geographicConcentration,
    };
  }
}


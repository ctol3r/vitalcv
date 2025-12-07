/**
 * B209B-STRAT-007: OrgStrategicOrchestrator job
 *
 * Runs monthly and on major org events; stores updated OrgStrategicState
 */

import { PrismaClient } from '@prisma/client';
import { getServiceLogger } from '../../services/logging/serviceLogger.js';
import type { OrgStrategicState } from '../../services/orgStrategy/models/OrgStrategicState.js';
import { orgStrategicModel } from '../../services/orgStrategy/model/strategicModel.js';
import { orgStrategicReasoner } from '../../services/orgStrategy/reasoner.js';
import { OrgFeatureExtractor } from '../../services/orgStrategy/extractors/orgFeatures.js';
import { supplyForecastEngine } from '../../services/workforceForecast/supplyEngine.js';

const prisma = new PrismaClient();
const log = getServiceLogger('jobs/orgStrategy/orchestrator');

export interface OrgStrategyJobResult {
  orgsProcessed: number;
  statesUpdated: number;
  actionsGenerated: number;
  insightsGenerated: number;
  errors: string[];
  startedAt: Date;
  finishedAt: Date;
}

export interface OrchestratorRunOptions {
  orgId?: string; // If provided, only process this org
  triggerEvent?: 'MONTHLY' | 'ORG_EVENT' | 'MANUAL';
  eventMetadata?: Record<string, unknown>;
}

/**
 * OrgStrategicOrchestrator runs monthly and on major org events to update strategic state
 */
export class OrgStrategicOrchestrator {
  /**
   * Run orchestrator for all orgs or a specific org
   */
  async run(options: OrchestratorRunOptions = {}): Promise<OrgStrategyJobResult> {
    const startedAt = new Date();
    const errors: string[] = [];
    let orgsProcessed = 0;
    let statesUpdated = 0;
    let totalActionsGenerated = 0;
    let totalInsightsGenerated = 0;

    log.info('Starting org strategy orchestrator', {
      orgId: options.orgId,
      triggerEvent: options.triggerEvent || 'MONTHLY',
    });

    try {
      // Get orgs to process
      const orgIds = await this.getOrgIds(options.orgId);

      // Process each org
      for (const orgId of orgIds) {
        try {
          const result = await this.processOrg(orgId, options);
          orgsProcessed++;

          if (result.stateUpdated) {
            statesUpdated++;
          }

          totalActionsGenerated += result.actionsGenerated;
          totalInsightsGenerated += result.insightsGenerated;
        } catch (error) {
          const errorMsg = `Failed to process org ${orgId}: ${error instanceof Error ? error.message : String(error)}`;
          log.error('Error processing org', { orgId, error });
          errors.push(errorMsg);
        }
      }

      log.info('Org strategy orchestrator complete', {
        orgsProcessed,
        statesUpdated,
        totalActionsGenerated,
        totalInsightsGenerated,
        errors: errors.length,
      });
    } catch (error) {
      log.error('Fatal error in org strategy orchestrator', { error });
      errors.push(`Fatal error: ${error instanceof Error ? error.message : String(error)}`);
    }

    const finishedAt = new Date();

    return {
      orgsProcessed,
      statesUpdated,
      actionsGenerated: totalActionsGenerated,
      insightsGenerated: totalInsightsGenerated,
      errors,
      startedAt,
      finishedAt,
    };
  }

  /**
   * Get org IDs to process
   */
  private async getOrgIds(specificOrgId?: string): Promise<string[]> {
    if (specificOrgId) {
      // Verify org exists
      const org = await prisma.org.findUnique({
        where: { id: specificOrgId },
        select: { id: true },
      });

      if (!org) {
        throw new Error(`Org ${specificOrgId} not found`);
      }

      return [specificOrgId];
    }

    // Get all active orgs
    const orgs = await prisma.org.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
      },
      take: 100, // Limit to avoid overwhelming the system
    });

    return orgs.map(org => org.id);
  }

  /**
   * Process a single org
   */
  private async processOrg(
    orgId: string,
    options: OrchestratorRunOptions
  ): Promise<{
    stateUpdated: boolean;
    actionsGenerated: number;
    insightsGenerated: number;
  }> {
    log.info('Processing org', { orgId });

    // Extract org features
    const featureExtractor = new OrgFeatureExtractor(prisma);
    const features = await featureExtractor.extractFeatures(orgId, 365);

    // Generate forecast
    const forecast = await this.generateForecast(orgId);

    // Extract mobility data
    const mobility = await this.extractMobility(orgId);

    // Extract risk data
    const risk = await this.extractRisk(orgId);

    // Extract competency data
    const competency = await this.extractCompetency(orgId);

    // Extract safety data
    const safety = await this.extractSafety(orgId);

    // Extract payer alignment
    const payerAlignment = await this.extractPayerAlignment(orgId);

    // Extract privilege coverage
    const privilegeCoverage = await this.extractPrivilegeCoverage(orgId, features);

    // Build current strategic state
    const currentState = await this.buildStrategicState(
      orgId,
      features,
      forecast,
      mobility,
      risk,
      competency,
      safety,
      payerAlignment,
      privilegeCoverage
    );

    // Generate strategic actions
    const actionsResult = await orgStrategicModel.generateActions({
      state: currentState,
      forecast,
      mobility,
      risk,
      competency,
      safety,
    });

    // Generate strategic insights
    const insightsResult = await orgStrategicReasoner.generateInsights({
      state: currentState,
      forecast,
      mobility,
      risk,
      competency,
      safety,
      payerAlignment,
      privilegeCoverage,
    });

    // Store updated state (in a hypothetical OrgStrategicState table or JSON field)
    await this.storeStrategicState(orgId, currentState, {
      triggerEvent: options.triggerEvent || 'MONTHLY',
      eventMetadata: options.eventMetadata,
      actionsGenerated: actionsResult.actions.length,
      insightsGenerated: insightsResult.insights.length,
    });

    log.info('Org processing complete', {
      orgId,
      actionsGenerated: actionsResult.actions.length,
      insightsGenerated: insightsResult.insights.length,
    });

    return {
      stateUpdated: true,
      actionsGenerated: actionsResult.actions.length,
      insightsGenerated: insightsResult.insights.length,
    };
  }

  /**
   * Generate forecast for org
   */
  private async generateForecast(orgId: string): Promise<OrgStrategicState['forecast'] | undefined> {
    try {
      const forecastResult = await supplyForecastEngine.generateForecast({
        orgId,
        timeWindowStart: new Date(),
        timeWindowEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        clinicianIds: [], // Empty = all clinicians
      });

      return {
        timeWindowStart: forecastResult.timeWindowStart,
        timeWindowEnd: forecastResult.timeWindowEnd,
        predictedGaps: forecastResult.predictedGaps.map(gap => ({
          startDate: gap.startDate,
          endDate: gap.endDate,
          reason: gap.reason || 'Unknown',
          severity: this.mapSeverity(gap.severity),
          affectedClinicians: gap.affectedClinicians.size,
          departmentId: gap.affectedDepartmentIds?.[0],
        })),
        averageReadiness: forecastResult.averageReadiness,
      };
    } catch (error) {
      log.warn('Failed to generate forecast', { orgId, error });
      return undefined;
    }
  }

  /**
   * Extract mobility data
   */
  private async extractMobility(orgId: string): Promise<OrgStrategicState['mobility'] | undefined> {
    try {
      // Query privilege requests for pending onboarding
      const pendingRequests = await prisma.privilegeRequest.count({
        where: {
          orgId,
          status: 'PENDING',
        },
      });

      // Query privilege grants for average readiness
      const grants = await prisma.privilegeGranted.findMany({
        where: {
          orgId,
          status: 'ACTIVE',
        },
        select: {
          readinessScore: true,
        },
        take: 100,
      });

      const averageReadiness = grants.length > 0
        ? grants.reduce((sum, g) => sum + (g.readinessScore || 0.75), 0) / grants.length
        : 0.75;

      // Analyze mobility blockers (simplified)
      const mobilityBlockers: OrgStrategicState['mobility']['mobilityBlockers'] = [];

      // Check for missing privileges
      const privilegeGaps = await prisma.privilegeSetV2.count({
        where: {
          orgId,
          isActive: true,
        },
      });

      if (privilegeGaps > 0) {
        mobilityBlockers.push({
          type: 'MISSING_PRIVILEGES',
          count: privilegeGaps,
          severity: privilegeGaps > 10 ? 'HIGH' : 'MED',
        });
      }

      return {
        pendingOnboardingRequests: pendingRequests,
        averageReadinessScore: averageReadiness,
        mobilityBlockers,
      };
    } catch (error) {
      log.warn('Failed to extract mobility data', { orgId, error });
      return undefined;
    }
  }

  /**
   * Extract risk data
   */
  private async extractRisk(orgId: string): Promise<OrgStrategicState['risk'] | undefined> {
    try {
      // Query risk signals
      const riskSignals = await prisma.privilegeSafetySignal.findMany({
        where: {
          orgId,
          severity: {
            in: ['HIGH', 'CRITICAL'],
          },
        },
        },
        select: {
          severity: true,
          signalType: true,
        },
      });

      const criticalCount = riskSignals.filter(s => s.severity === 'CRITICAL').length;
      const highCount = riskSignals.filter(s => s.severity === 'HIGH').length;

      // Group by signal type
      const riskFactors: Record<string, number> = {};
      for (const signal of riskSignals) {
        const factor = signal.signalType || 'UNKNOWN';
        riskFactors[factor] = (riskFactors[factor] || 0) + 1;
      }

      const topRiskFactors = Object.entries(riskFactors)
        .map(([factor, count]) => ({
          factor,
          count,
          severity: count > 10 ? 'HIGH' as const : count > 5 ? 'MED' as const : 'LOW' as const,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return {
        highRiskClinicians: highCount,
        criticalRiskClinicians: criticalCount,
        riskDistribution: {
          LOW: 0, // Would need full risk data
          MED: highCount,
          HIGH: highCount,
          CRITICAL: criticalCount,
        },
        topRiskFactors,
      };
    } catch (error) {
      log.warn('Failed to extract risk data', { orgId, error });
      return undefined;
    }
  }

  /**
   * Extract competency data
   */
  private async extractCompetency(orgId: string): Promise<OrgStrategicState['competency'] | undefined> {
    try {
      // Query competency scores (would need CCI data)
      // This is a simplified version - adjust based on actual schema
      const cciData = await prisma.$queryRaw<Array<{ avg: number; min: number; count: number }>>`
        SELECT
          AVG(cci_score) as avg,
          MIN(cci_score) as min,
          COUNT(*) as count
        FROM clinician_profile
        WHERE org_id = ${orgId}
        AND cci_score IS NOT NULL
      `.catch(() => null);

      if (!cciData || cciData.length === 0) {
        return undefined;
      }

      const avg = cciData[0]?.avg || 70;
      const min = cciData[0]?.min || 60;
      const count = cciData[0]?.count || 0;

      // Simplified distribution (would need full data)
      return {
        averageCCI: Math.round(avg),
        lowCompetencyCount: Math.max(0, count - Math.round(count * 0.7)), // Estimate
        competencyDistribution: {
          EXCELLENT: Math.round(count * 0.3),
          GOOD: Math.round(count * 0.4),
          FAIR: Math.round(count * 0.2),
          POOR: Math.round(count * 0.1),
        },
      };
    } catch (error) {
      log.warn('Failed to extract competency data', { orgId, error });
      return undefined;
    }
  }

  /**
   * Extract safety data
   */
  private async extractSafety(orgId: string): Promise<OrgStrategicState['safety'] | undefined> {
    try {
      // Query safety holds
      const safetyHolds = await prisma.privilegeSafetySignal.count({
        where: {
          orgId,
          severity: {
            in: ['HIGH', 'CRITICAL'],
          },
        },
      });

      const criticalSignals = await prisma.privilegeSafetySignal.count({
        where: {
          orgId,
          severity: 'CRITICAL',
        },
      });

      // Calculate average safety score (simplified)
      const safetyScore = await prisma.privilegeGranted.aggregate({
        where: {
          orgId,
          status: 'ACTIVE',
        },
        _avg: {
          safetyScore: true,
        },
      });

      const averageSafetyScore = safetyScore._avg.safetyScore || 0.85;

      // Determine trend (simplified - would need historical data)
      const safetyTrend: 'IMPROVING' | 'STABLE' | 'DECLINING' =
        criticalSignals > 5 ? 'DECLINING' :
        criticalSignals > 0 ? 'STABLE' : 'IMPROVING';

      return {
        activeSafetyHolds: safetyHolds,
        criticalSafetySignals: criticalSignals,
        averageSafetyScore,
        safetyTrend,
      };
    } catch (error) {
      log.warn('Failed to extract safety data', { orgId, error });
      return undefined;
    }
  }

  /**
   * Extract payer alignment data
   */
  private async extractPayerAlignment(orgId: string): Promise<OrgStrategicState['payerAlignment'] | undefined> {
    try {
      // Query payer enrollments
      const payerEnrollments = await prisma.payerEnrollment.findMany({
        where: {
          orgId,
        },
        select: {
          payerId: true,
          status: true,
        },
      });

      // Group by payer
      const payerStatuses: Record<string, { active: number; inactive: number }> = {};
      for (const enrollment of payerEnrollments) {
        if (!payerStatuses[enrollment.payerId]) {
          payerStatuses[enrollment.payerId] = { active: 0, inactive: 0 };
        }
        if (enrollment.status === 'ACTIVE') {
          payerStatuses[enrollment.payerId].active++;
        } else {
          payerStatuses[enrollment.payerId].inactive++;
        }
      }

      // Identify misaligned payers (with inactive enrollments)
      const payerGaps: OrgStrategicState['payerAlignment']['payerGaps'] = [];
      for (const [payerId, status] of Object.entries(payerStatuses)) {
        if (status.inactive > 0) {
          payerGaps.push({
            payerId,
            payerName: payerId, // Would need payer name lookup
            missingEnrollments: status.inactive,
            affectedStates: [], // Would need state data
            severity: status.inactive > 10 ? 'HIGH' : 'MED',
          });
        }
      }

      return {
        misalignedPayerCount: payerGaps.length,
        payerGaps,
      };
    } catch (error) {
      log.warn('Failed to extract payer alignment data', { orgId, error });
      return undefined;
    }
  }

  /**
   * Extract privilege coverage data
   */
  private async extractPrivilegeCoverage(
    orgId: string,
    features: Awaited<ReturnType<OrgFeatureExtractor['extractFeatures']>>
  ): Promise<OrgStrategicState['privilegeCoverage'] | undefined> {
    try {
      const underprivilegedDepartments: OrgStrategicState['privilegeCoverage']['underprivilegedDepartments'] = [];
      const expansionOpportunities: OrgStrategicState['privilegeCoverage']['expansionOpportunities'] = [];

      // Use privilege gaps from features
      for (const gap of features.privilegeGaps.gapDetails) {
        if (gap.severity === 'HIGH' || gap.severity === 'CRITICAL') {
          underprivilegedDepartments.push({
            departmentId: gap.department || 'unknown',
            missingPrivileges: [gap.privilegeCode],
            affectedClinicians: Math.round(gap.gapAmount * 1.5), // Estimate
          });
        }
      }

      return {
        underprivilegedDepartments,
        expansionOpportunities,
      };
    } catch (error) {
      log.warn('Failed to extract privilege coverage data', { orgId, error });
      return undefined;
    }
  }

  /**
   * Build strategic state from extracted data
   */
  private async buildStrategicState(
    orgId: string,
    features: Awaited<ReturnType<OrgFeatureExtractor['extractFeatures']>>,
    forecast?: OrgStrategicState['forecast'],
    mobility?: OrgStrategicState['mobility'],
    risk?: OrgStrategicState['risk'],
    competency?: OrgStrategicState['competency'],
    safety?: OrgStrategicState['safety'],
    payerAlignment?: OrgStrategicState['payerAlignment'],
    privilegeCoverage?: OrgStrategicState['privilegeCoverage']
  ): Promise<OrgStrategicState> {
    // Get org basic info
    const org = await prisma.org.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        name: true,
      },
    });

    // Get department info
    const departments = await prisma.privilegeSetV2.findMany({
      where: {
        orgId,
        isActive: true,
      },
      select: {
        department: true,
        specialty: true,
      },
      distinct: ['department'],
    });

    // Get clinician counts
    const totalClinicians = await prisma.privilegeGranted.count({
      where: {
        orgId,
        status: 'ACTIVE',
      },
      distinct: ['clinicianDid'],
    });

    const activeClinicians = await prisma.privilegeGranted.count({
      where: {
        orgId,
        status: 'ACTIVE',
        expiresAt: {
          gt: new Date(),
        },
      },
      distinct: ['clinicianDid'],
    });

    const atRiskClinicians = risk
      ? risk.highRiskClinicians + risk.criticalRiskClinicians
      : Math.round(totalClinicians * 0.1); // Estimate

    // Build department breakdown
    const departmentBreakdown: OrgStrategicState['departments'] = [];
    for (const dept of departments) {
      const deptId = dept.department || 'unknown';

      const deptClinicianCount = await prisma.privilegeGranted.count({
        where: {
          orgId,
          privilegeRequest: {
            privilegeSet: {
              department: deptId,
            },
          },
          status: 'ACTIVE',
        },
        distinct: ['clinicianDid'],
      });

      // Calculate renewal cliff from credential expirations
      const renewalCliffMonths = this.calculateRenewalCliff(orgId, deptId, features);

      departmentBreakdown.push({
        departmentId: deptId,
        name: deptId,
        clinicianCount: deptClinicianCount,
        averageReadiness: forecast?.averageReadiness ?? 0.75,
        renewalCliffMonths,
      });
    }

    return {
      orgId,
      timestamp: new Date(),
      totalClinicians,
      activeClinicians,
      atRiskClinicians,
      departments: departmentBreakdown,
      forecast,
      mobility,
      risk,
      competency,
      safety,
      payerAlignment,
      privilegeCoverage,
    };
  }

  /**
   * Calculate renewal cliff for a department
   */
  private calculateRenewalCliff(
    orgId: string,
    departmentId: string,
    features: Awaited<ReturnType<OrgFeatureExtractor['extractFeatures']>>
  ): number | undefined {
    // Use credential expiration windows to estimate renewal cliff
    const windows = features.credentialExpirationWindows;

    // Find the window with the most expirations
    let maxWindow = '';
    let maxCount = 0;

    for (const [window, count] of Object.entries(windows)) {
      if (count > maxCount) {
        maxCount = count;
        maxWindow = window;
      }
    }

    // Map window to months
    if (maxWindow === '0-30d') return 1;
    if (maxWindow === '30-60d') return 2;
    if (maxWindow === '60-90d') return 3;
    if (maxWindow === '90-180d') return 6;
    if (maxWindow === '180-365d') return 12;

    return undefined;
  }

  /**
   * Store strategic state
   */
  private async storeStrategicState(
    orgId: string,
    state: OrgStrategicState,
    metadata: Record<string, unknown>
  ): Promise<void> {
    try {
      // Store in org metadata or dedicated table
      // This is a simplified version - adjust based on actual schema
      await prisma.org.update({
        where: { id: orgId },
        data: {
          metadata: {
            ...((await prisma.org.findUnique({ where: { id: orgId }, select: { metadata: true } }))?.metadata as Record<string, unknown> || {}),
            orgStrategicState: state,
            orgStrategicStateUpdatedAt: new Date().toISOString(),
            orgStrategicStateMetadata: metadata,
          },
        },
      });

      log.info('Stored strategic state', { orgId });
    } catch (error) {
      log.error('Failed to store strategic state', { orgId, error });
      throw error;
    }
  }

  /**
   * Map severity string to StrategicState severity
   */
  private mapSeverity(severity: string): 'LOW' | 'MED' | 'HIGH' | 'CRITICAL' {
    const upper = severity.toUpperCase();
    if (upper === 'CRITICAL' || upper === 'CRIT') return 'CRITICAL';
    if (upper === 'HIGH') return 'HIGH';
    if (upper === 'MEDIUM' || upper === 'MED') return 'MED';
    return 'LOW';
  }
}

/**
 * Default instance
 */
export const orgStrategyOrchestrator = new OrgStrategicOrchestrator();

/**
 * Run orchestrator (can be called from cron job or event handler)
 */
export async function runOrgStrategyOrchestrator(options?: OrchestratorRunOptions): Promise<OrgStrategyJobResult> {
  return orgStrategyOrchestrator.run(options || { triggerEvent: 'MONTHLY' });
}

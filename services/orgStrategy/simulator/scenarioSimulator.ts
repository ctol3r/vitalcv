/**
 * B209B-STRAT-006: StrategicScenarioSimulator
 *
 * Simulates scenarios:
 * - Add new privileges
 * - Add new payer contract
 * - Retirements
 * - Onboarding surge
 * - Specialty expansion
 *
 * Outputs changes in KPIs
 */

import type { OrgStrategicState } from '../models/OrgStrategicState.js';
import { createLogger } from '@chai-vc/logging-core';

const logger = createLogger({ service: 'orgStrategy-simulator' });

export type ScenarioType =
  | 'ADD_PRIVILEGES'
  | 'ADD_PAYER_CONTRACT'
  | 'RETIREMENTS'
  | 'ONBOARDING_SURGE'
  | 'SPECIALTY_EXPANSION';

export interface ScenarioInput {
  type: ScenarioType;
  orgId: string;
  departmentId?: string;

  // Scenario-specific parameters
  privileges?: string[]; // For ADD_PRIVILEGES
  payerId?: string; // For ADD_PAYER_CONTRACT
  payerName?: string;
  affectedStates?: string[];
  retirementCount?: number; // For RETIREMENTS
  retirementClinicianIds?: string[];
  onboardingCount?: number; // For ONBOARDING_SURGE
  onboardingReadiness?: number; // 0-1, average readiness of onboarding clinicians
  specialty?: string; // For SPECIALTY_EXPANSION
  specialtyClinicianCount?: number;
  specialtyReadiness?: number; // 0-1, average readiness

  // Simulation parameters
  timeHorizonMonths?: number; // Default: 12
}

export interface KPIChange {
  kpi: string;
  baseline: number;
  projected: number;
  change: number; // Absolute change
  changePercent: number; // Percentage change
  timeframe: string;
}

export interface ScenarioResult {
  scenarioType: ScenarioType;
  scenarioId: string;
  orgId: string;
  departmentId?: string;
  description: string;
  kpiChanges: KPIChange[];
  summary: {
    totalKPIs: number;
    positiveChanges: number;
    negativeChanges: number;
    netImpact: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  };
  timeframe: string;
  metadata?: Record<string, unknown>;
}

/**
 * StrategicScenarioSimulator simulates organizational changes and their KPI impacts
 */
export class StrategicScenarioSimulator {
  /**
   * Simulate a scenario and calculate KPI changes
   */
  async simulateScenario(
    baselineState: OrgStrategicState,
    input: ScenarioInput
  ): Promise<ScenarioResult> {
    const timeHorizonMonths = input.timeHorizonMonths || 12;
    const scenarioId = `${input.type}-${input.orgId}-${Date.now()}`;

    logger.info('Simulating scenario', {
      scenarioType: input.type,
      orgId: input.orgId,
      departmentId: input.departmentId,
      timeHorizonMonths,
    });

    let kpiChanges: KPIChange[] = [];
    let description = '';

    switch (input.type) {
      case 'ADD_PRIVILEGES':
        ({ kpiChanges, description } = this.simulatePrivilegeAddition(
          baselineState,
          input,
          timeHorizonMonths
        ));
        break;

      case 'ADD_PAYER_CONTRACT':
        ({ kpiChanges, description } = this.simulatePayerContractAddition(
          baselineState,
          input,
          timeHorizonMonths
        ));
        break;

      case 'RETIREMENTS':
        ({ kpiChanges, description } = this.simulateRetirements(
          baselineState,
          input,
          timeHorizonMonths
        ));
        break;

      case 'ONBOARDING_SURGE':
        ({ kpiChanges, description } = this.simulateOnboardingSurge(
          baselineState,
          input,
          timeHorizonMonths
        ));
        break;

      case 'SPECIALTY_EXPANSION':
        ({ kpiChanges, description } = this.simulateSpecialtyExpansion(
          baselineState,
          input,
          timeHorizonMonths
        ));
        break;

      default:
        throw new Error(`Unknown scenario type: ${input.type}`);
    }

    // Calculate summary
    const positiveChanges = kpiChanges.filter(k => k.change > 0).length;
    const negativeChanges = kpiChanges.filter(k => k.change < 0).length;
    const neutralChanges = kpiChanges.filter(k => k.change === 0).length;

    // Determine net impact (weighted by change magnitude)
    const weightedSum = kpiChanges.reduce((sum, k) => {
      const weight = Math.abs(k.changePercent);
      return sum + (k.change > 0 ? weight : k.change < 0 ? -weight : 0);
    }, 0);

    const netImpact: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' =
      weightedSum > 5 ? 'POSITIVE' :
      weightedSum < -5 ? 'NEGATIVE' : 'NEUTRAL';

    logger.info('Scenario simulation complete', {
      scenarioId,
      totalKPIs: kpiChanges.length,
      positiveChanges,
      negativeChanges,
      netImpact,
    });

    return {
      scenarioType: input.type,
      scenarioId,
      orgId: input.orgId,
      departmentId: input.departmentId,
      description,
      kpiChanges,
      summary: {
        totalKPIs: kpiChanges.length,
        positiveChanges,
        negativeChanges,
      },
      netImpact,
      timeframe: `${timeHorizonMonths} months`,
      metadata: {
        timeHorizonMonths,
        inputParameters: input,
      },
    };
  }

  /**
   * Simulate adding new privileges
   */
  private simulatePrivilegeAddition(
    state: OrgStrategicState,
    input: ScenarioInput,
    timeHorizonMonths: number
  ): { kpiChanges: KPIChange[]; description: string } {
    const privileges = input.privileges || [];
    const deptId = input.departmentId || 'global';
    const dept = state.departments.find(d => d.departmentId === deptId);

    if (!dept && deptId !== 'global') {
      throw new Error(`Department ${deptId} not found`);
    }

    const affectedClinicians = dept?.clinicianCount || state.totalClinicians;
    const privilegeCount = privileges.length;

    // Calculate baseline KPIs
    const baselineReadiness = dept?.averageReadiness ||
      (state.forecast?.averageReadiness ?? 0.75);
    const baselinePrivilegeCoverage = this.estimatePrivilegeCoverage(state, deptId);

    // Simulate KPI changes
    const kpiChanges: KPIChange[] = [];

    // Privilege coverage increases
    const privilegeCoverageIncrease = Math.min(0.15, privilegeCount * 0.03); // Max 15% increase
    kpiChanges.push({
      kpi: 'privilege_coverage',
      baseline: baselinePrivilegeCoverage,
      projected: baselinePrivilegeCoverage + privilegeCoverageIncrease,
      change: privilegeCoverageIncrease,
      changePercent: (privilegeCoverageIncrease / baselinePrivilegeCoverage) * 100,
      timeframe: `${timeHorizonMonths} months`,
    });

    // Readiness improves (more capabilities)
    const readinessIncrease = Math.min(0.1, privilegeCount * 0.02); // Max 10% increase
    kpiChanges.push({
      kpi: 'readiness_score',
      baseline: baselineReadiness,
      projected: baselineReadiness + readinessIncrease,
      change: readinessIncrease,
      changePercent: (readinessIncrease / baselineReadiness) * 100,
      timeframe: `${timeHorizonMonths} months`,
    });

    // Service line coverage increases
    const serviceLineIncrease = Math.min(0.2, privilegeCount * 0.04);
    kpiChanges.push({
      kpi: 'service_line_coverage',
      baseline: 0.7, // Estimated baseline
      projected: 0.7 + serviceLineIncrease,
      change: serviceLineIncrease,
      changePercent: (serviceLineIncrease / 0.7) * 100,
      timeframe: `${timeHorizonMonths} months`,
    });

    // Mobility rate improves (fewer blockers)
    if (state.mobility) {
      const mobilityIncrease = Math.min(0.1, privilegeCount * 0.02);
      const baselineMobility = state.mobility.averageReadinessScore;
      kpiChanges.push({
        kpi: 'mobility_rate',
        baseline: baselineMobility,
        projected: baselineMobility + mobilityIncrease,
        change: mobilityIncrease,
        changePercent: (mobilityIncrease / baselineMobility) * 100,
        timeframe: `${timeHorizonMonths} months`,
      });
    }

    const description = `Add ${privilegeCount} privilege${privilegeCount !== 1 ? 's' : ''} (${privileges.slice(0, 3).join(', ')}${privileges.length > 3 ? '...' : ''}) to ${deptId === 'global' ? 'organization' : dept?.name || deptId}, affecting ${affectedClinicians} clinician${affectedClinicians !== 1 ? 's' : ''}`;

    return { kpiChanges, description };
  }

  /**
   * Simulate adding new payer contract
   */
  private simulatePayerContractAddition(
    state: OrgStrategicState,
    input: ScenarioInput,
    timeHorizonMonths: number
  ): { kpiChanges: KPIChange[]; description: string } {
    const payerId = input.payerId || 'unknown';
    const payerName = input.payerName || payerId;
    const affectedStates = input.affectedStates || [];
    const stateCount = affectedStates.length;

    // Calculate baseline KPIs
    const baselinePayerAlignment = state.payerAlignment
      ? 1 - (state.payerAlignment.misalignedPayerCount / (state.payerAlignment.misalignedPayerCount + 5)) // Estimate
      : 0.8;

    const baselineMobility = state.mobility?.averageReadinessScore ?? 0.75;

    const kpiChanges: KPIChange[] = [];

    // Payer alignment improves
    const alignmentIncrease = Math.min(0.15, stateCount * 0.03); // More states = more impact
    kpiChanges.push({
      kpi: 'payer_alignment_rate',
      baseline: baselinePayerAlignment,
      projected: baselinePayerAlignment + alignmentIncrease,
      change: alignmentIncrease,
      changePercent: (alignmentIncrease / baselinePayerAlignment) * 100,
      timeframe: `${timeHorizonMonths} months`,
    });

    // Mobility rate improves (fewer payer blockers)
    const mobilityIncrease = Math.min(0.12, stateCount * 0.025);
    kpiChanges.push({
      kpi: 'mobility_rate',
      baseline: baselineMobility,
      projected: baselineMobility + mobilityIncrease,
      change: mobilityIncrease,
      changePercent: (mobilityIncrease / baselineMobility) * 100,
      timeframe: `${timeHorizonMonths} months`,
    });

    // Onboarding capacity increases
    const onboardingIncrease = Math.min(0.1, stateCount * 0.02);
    kpiChanges.push({
      kpi: 'onboarding_capacity',
      baseline: 0.8, // Estimated baseline
      projected: 0.8 + onboardingIncrease,
      change: onboardingIncrease,
      changePercent: (onboardingIncrease / 0.8) * 100,
      timeframe: `${timeHorizonMonths} months`,
    });

    // Revenue potential increases (payer contracts enable billing)
    const revenueIncrease = Math.min(0.2, stateCount * 0.04);
    kpiChanges.push({
      kpi: 'revenue_potential',
      baseline: 0.75, // Estimated baseline
      projected: 0.75 + revenueIncrease,
      change: revenueIncrease,
      changePercent: (revenueIncrease / 0.75) * 100,
      timeframe: `${timeHorizonMonths} months`,
    });

    const description = `Add payer contract with ${payerName} covering ${stateCount} state${stateCount !== 1 ? 's' : ''} (${affectedStates.slice(0, 3).join(', ')}${affectedStates.length > 3 ? '...' : ''})`;

    return { kpiChanges, description };
  }

  /**
   * Simulate retirements
   */
  private simulateRetirements(
    state: OrgStrategicState,
    input: ScenarioInput,
    timeHorizonMonths: number
  ): { kpiChanges: KPIChange[]; description: string } {
    const retirementCount = input.retirementCount || 0;
    const deptId = input.departmentId;
    const dept = deptId ? state.departments.find(d => d.departmentId === deptId) : undefined;

    if (deptId && !dept) {
      throw new Error(`Department ${deptId} not found`);
    }

    const affectedClinicians = dept?.clinicianCount || state.totalClinicians;
    const retirementPercent = (retirementCount / affectedClinicians) * 100;

    // Calculate baseline KPIs
    const baselineReadiness = dept?.averageReadiness ||
      (state.forecast?.averageReadiness ?? 0.75);
    const baselineTotalClinicians = state.totalClinicians;

    const kpiChanges: KPIChange[] = [];

    // Total clinicians decreases
    kpiChanges.push({
      kpi: 'total_clinicians',
      baseline: baselineTotalClinicians,
      projected: baselineTotalClinicians - retirementCount,
      change: -retirementCount,
      changePercent: -(retirementPercent),
      timeframe: `${timeHorizonMonths} months`,
    });

    // Readiness decreases (capacity loss)
    const readinessDecrease = Math.min(0.15, retirementPercent / 100 * 0.3); // Up to 15% decrease
    kpiChanges.push({
      kpi: 'readiness_score',
      baseline: baselineReadiness,
      projected: Math.max(0.3, baselineReadiness - readinessDecrease),
      change: -readinessDecrease,
      changePercent: -(readinessDecrease / baselineReadiness) * 100,
      timeframe: `${timeHorizonMonths} months`,
    });

    // Available clinicians decreases
    const baselineAvailable = state.forecast?.predictedGaps
      .reduce((sum, gap) => sum + gap.affectedClinicians, 0) || baselineTotalClinicians * 0.8;
    kpiChanges.push({
      kpi: 'available_clinicians',
      baseline: baselineAvailable,
      projected: Math.max(0, baselineAvailable - retirementCount * 0.9), // Assume 90% were available
      change: -retirementCount * 0.9,
      changePercent: -((retirementCount * 0.9) / baselineAvailable) * 100,
      timeframe: `${timeHorizonMonths} months`,
    });

    // Risk may increase if critical clinicians retire
    if (retirementPercent > 10) {
      kpiChanges.push({
        kpi: 'organizational_risk',
        baseline: 0.3, // Estimated baseline
        projected: 0.3 + Math.min(0.1, retirementPercent / 100 * 0.5),
        change: Math.min(0.1, retirementPercent / 100 * 0.5),
        changePercent: (Math.min(0.1, retirementPercent / 100 * 0.5) / 0.3) * 100,
        timeframe: `${timeHorizonMonths} months`,
      });
    }

    const description = `${retirementCount} clinician${retirementCount !== 1 ? 's' : ''} retirement${retirementCount !== 1 ? 's' : ''}${deptId ? ` in ${dept?.name || deptId}` : ''} (${retirementPercent.toFixed(0)}% of ${deptId ? 'department' : 'organization'} workforce)`;

    return { kpiChanges, description };
  }

  /**
   * Simulate onboarding surge
   */
  private simulateOnboardingSurge(
    state: OrgStrategicState,
    input: ScenarioInput,
    timeHorizonMonths: number
  ): { kpiChanges: KPIChange[]; description: string } {
    const onboardingCount = input.onboardingCount || 0;
    const onboardingReadiness = input.onboardingReadiness ?? 0.75;
    const deptId = input.departmentId;

    const kpiChanges: KPIChange[] = [];

    // Total clinicians increases
    const baselineTotal = state.totalClinicians;
    kpiChanges.push({
      kpi: 'total_clinicians',
      baseline: baselineTotal,
      projected: baselineTotal + onboardingCount,
      change: onboardingCount,
      changePercent: (onboardingCount / baselineTotal) * 100,
      timeframe: `${timeHorizonMonths} months`,
    });

    // Readiness improves (weighted by onboarding readiness)
    const baselineReadiness = state.forecast?.averageReadiness ?? 0.75;
    const newReadiness = (baselineReadiness * baselineTotal + onboardingReadiness * onboardingCount) /
      (baselineTotal + onboardingCount);
    kpiChanges.push({
      kpi: 'readiness_score',
      baseline: baselineReadiness,
      projected: newReadiness,
      change: newReadiness - baselineReadiness,
      changePercent: ((newReadiness - baselineReadiness) / baselineReadiness) * 100,
      timeframe: `${timeHorizonMonths} months`,
    });

    // Available clinicians increases
    const baselineAvailable = state.forecast?.predictedGaps
      .reduce((sum, gap) => sum + gap.affectedClinicians, 0) || baselineTotal * 0.8;
    const availableIncrease = onboardingCount * onboardingReadiness;
    kpiChanges.push({
      kpi: 'available_clinicians',
      baseline: baselineAvailable,
      projected: baselineAvailable + availableIncrease,
      change: availableIncrease,
      changePercent: (availableIncrease / baselineAvailable) * 100,
      timeframe: `${timeHorizonMonths} months`,
    });

    // Mobility rate may improve if onboarding is high-readiness
    if (state.mobility && onboardingReadiness > 0.8) {
      const mobilityIncrease = Math.min(0.1, onboardingCount / baselineTotal * 0.5);
      kpiChanges.push({
        kpi: 'mobility_rate',
        baseline: state.mobility.averageReadinessScore,
        projected: state.mobility.averageReadinessScore + mobilityIncrease,
        change: mobilityIncrease,
        changePercent: (mobilityIncrease / state.mobility.averageReadinessScore) * 100,
        timeframe: `${timeHorizonMonths} months`,
      });
    }

    const description = `Onboarding surge: ${onboardingCount} clinician${onboardingCount !== 1 ? 's' : ''} onboarding${deptId ? ` to ${deptId}` : ''} with average readiness ${(onboardingReadiness * 100).toFixed(0)}%`;

    return { kpiChanges, description };
  }

  /**
   * Simulate specialty expansion
   */
  private simulateSpecialtyExpansion(
    state: OrgStrategicState,
    input: ScenarioInput,
    timeHorizonMonths: number
  ): { kpiChanges: KPIChange[]; description: string } {
    const specialty = input.specialty || 'unknown';
    const clinicianCount = input.specialtyClinicianCount || 0;
    const specialtyReadiness = input.specialtyReadiness ?? 0.8;
    const deptId = input.departmentId;

    const kpiChanges: KPIChange[] = [];

    // Total clinicians increases
    const baselineTotal = state.totalClinicians;
    kpiChanges.push({
      kpi: 'total_clinicians',
      baseline: baselineTotal,
      projected: baselineTotal + clinicianCount,
      change: clinicianCount,
      changePercent: (clinicianCount / baselineTotal) * 100,
      timeframe: `${timeHorizonMonths} months`,
    });

    // Service line coverage increases
    const serviceLineIncrease = Math.min(0.25, clinicianCount / baselineTotal * 0.8);
    kpiChanges.push({
      kpi: 'service_line_coverage',
      baseline: 0.7, // Estimated baseline
      projected: 0.7 + serviceLineIncrease,
      change: serviceLineIncrease,
      changePercent: (serviceLineIncrease / 0.7) * 100,
      timeframe: `${timeHorizonMonths} months`,
    });

    // Specialty diversity increases
    const specialtyIncrease = Math.min(0.2, clinicianCount / baselineTotal * 0.6);
    kpiChanges.push({
      kpi: 'specialty_diversity',
      baseline: 0.65, // Estimated baseline
      projected: 0.65 + specialtyIncrease,
      change: specialtyIncrease,
      changePercent: (specialtyIncrease / 0.65) * 100,
      timeframe: `${timeHorizonMonths} months`,
    });

    // Readiness improves if specialty clinicians have high readiness
    if (specialtyReadiness > 0.75) {
      const baselineReadiness = state.forecast?.averageReadiness ?? 0.75;
      const newReadiness = (baselineReadiness * baselineTotal + specialtyReadiness * clinicianCount) /
        (baselineTotal + clinicianCount);
      kpiChanges.push({
        kpi: 'readiness_score',
        baseline: baselineReadiness,
        projected: newReadiness,
        change: newReadiness - baselineReadiness,
        changePercent: ((newReadiness - baselineReadiness) / baselineReadiness) * 100,
        timeframe: `${timeHorizonMonths} months`,
      });
    }

    // Revenue potential increases (new specialty enables new service lines)
    const revenueIncrease = Math.min(0.25, clinicianCount / baselineTotal * 0.7);
    kpiChanges.push({
      kpi: 'revenue_potential',
      baseline: 0.75, // Estimated baseline
      projected: 0.75 + revenueIncrease,
      change: revenueIncrease,
      changePercent: (revenueIncrease / 0.75) * 100,
      timeframe: `${timeHorizonMonths} months`,
    });

    const description = `Specialty expansion: ${clinicianCount} ${specialty} clinician${clinicianCount !== 1 ? 's' : ''}${deptId ? ` in ${deptId}` : ''} with average readiness ${(specialtyReadiness * 100).toFixed(0)}%`;

    return { kpiChanges, description };
  }

  /**
   * Estimate current privilege coverage
   */
  private estimatePrivilegeCoverage(state: OrgStrategicState, departmentId?: string): number {
    if (state.privilegeCoverage) {
      if (departmentId) {
        const dept = state.privilegeCoverage.underprivilegedDepartments.find(
          d => d.departmentId === departmentId
        );
        if (dept) {
          // Lower coverage = more underprivileged
          return Math.max(0.6, 0.9 - (dept.missingPrivileges.length / 10));
        }
      }
      // Global coverage estimate
      const totalGaps = state.privilegeCoverage.underprivilegedDepartments.reduce(
        (sum, d) => sum + d.missingPrivileges.length,
        0
      );
      return Math.max(0.65, 0.9 - (totalGaps / 50));
    }
    return 0.8; // Default estimate
  }
}

/**
 * Default instance
 */
export const strategicScenarioSimulator = new StrategicScenarioSimulator();

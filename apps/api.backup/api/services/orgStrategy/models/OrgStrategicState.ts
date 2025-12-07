/**
 * B209A-STRAT-001: OrgStrategicState model
 *
 * Represents the current strategic state of an organization,
 * including workforce readiness index, credential risk index,
 * privilege capacity index, safety index, enrollment stability index,
 * demand forecast index, competency distribution, and department stability.
 */

import { z } from 'zod';

/**
 * Strategic state schema matching Prisma model
 */
export const OrgStrategicStateSchema = z.object({
  orgId: z.string().min(1, 'orgId is required'),

  // Workforce readiness index: 0-1, overall workforce readiness
  workforceReadinessIndex: z.number().min(0).max(1).optional(),

  // Credential risk index: 0-1, risk of credential expiration/gaps
  credentialRiskIndex: z.number().min(0).max(1).optional(),

  // Privilege capacity index: 0-1, available privilege capacity vs demand
  privilegeCapacityIndex: z.number().min(0).max(1).optional(),

  // Safety index: 0-1, overall safety performance
  safetyIndex: z.number().min(0).max(1).optional(),

  // Enrollment stability index: 0-1, stability of payer enrollments
  enrollmentStabilityIndex: z.number().min(0).max(1).optional(),

  // Demand forecast index: 0-1, forecasted demand vs supply
  demandForecastIndex: z.number().min(0).max(1).optional(),

  // Competency distribution: Distribution of competencies across org
  competencyDistribution: z.record(z.unknown()).optional(),

  // Department stability: Stability metrics by department
  departmentStability: z.record(z.unknown()).optional(),

  // Metadata for additional context
  metadata: z.record(z.unknown()).optional(),

  timestamp: z.coerce.date().default(() => new Date()),
  createdAt: z.coerce.date().default(() => new Date()),
  updatedAt: z.coerce.date().default(() => new Date()),
});

export type OrgStrategicState = z.infer<typeof OrgStrategicStateSchema>;
export type CreateOrgStrategicStateInput = z.input<typeof OrgStrategicStateSchema>;

/**
 * Strategic index names in order
 */
export const ORG_STRATEGIC_INDEX_NAMES = [
  'workforceReadinessIndex',
  'credentialRiskIndex',
  'privilegeCapacityIndex',
  'safetyIndex',
  'enrollmentStabilityIndex',
  'demandForecastIndex',
] as const;

/**
 * Create an org strategic state
 */
export function createOrgStrategicState(
  input: CreateOrgStrategicStateInput
): OrgStrategicState {
  return OrgStrategicStateSchema.parse(input);
}

/**
 * Validate strategic state
 */
export function validateOrgStrategicState(
  state: unknown
): OrgStrategicState {
  return OrgStrategicStateSchema.parse(state);
}

/**
 * Convert strategic state to array of index values
 * Returns [workforceReadinessIndex, credentialRiskIndex, privilegeCapacityIndex,
 *          safetyIndex, enrollmentStabilityIndex, demandForecastIndex]
 * Missing values default to 0
 */
export function orgStrategicStateToArray(
  state: OrgStrategicState
): number[] {
  return ORG_STRATEGIC_INDEX_NAMES.map(
    (key) => state[key] ?? 0
  );
}

/**
 * Get all index values as a record
 */
export function getIndexValues(
  state: OrgStrategicState
): Record<string, number> {
  const values: Record<string, number> = {};
  for (const key of ORG_STRATEGIC_INDEX_NAMES) {
    values[key] = state[key] ?? 0;
  }
  return values;
}

/**
 * Calculate overall strategic health score (weighted average of indices)
 * Workforce readiness and safety are weighted more heavily
 */
export function calculateStrategicHealthScore(
  state: OrgStrategicState
): number {
  const weights: Record<string, number> = {
    workforceReadinessIndex: 0.25,
    credentialRiskIndex: 0.15,
    privilegeCapacityIndex: 0.15,
    safetyIndex: 0.25,
    enrollmentStabilityIndex: 0.10,
    demandForecastIndex: 0.10,
  };

  let totalWeight = 0;
  let weightedSum = 0;

  for (const key of ORG_STRATEGIC_INDEX_NAMES) {
    const value = state[key];
    if (value !== undefined && value !== null) {
      const weight = weights[key] || 0;
      weightedSum += value * weight;
      totalWeight += weight;
    }
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

/**
 * Extended OrgStrategicState with detailed data structures
 * Used by strategic model and reasoner
 */
export interface ExtendedOrgStrategicState extends OrgStrategicState {
  totalClinicians?: number;
  activeClinicians?: number;
  atRiskClinicians?: number;
  departments?: Array<{
    departmentId: string;
    name: string;
    clinicianCount: number;
    averageReadiness: number;
    renewalCliffMonths?: number;
  }>;
  forecast?: {
    timeWindowStart: Date;
    timeWindowEnd: Date;
    predictedGaps: Array<{
      startDate: Date;
      endDate: Date;
      reason: string;
      severity: 'LOW' | 'MED' | 'HIGH' | 'CRITICAL';
      affectedClinicians: number;
      departmentId?: string;
    }>;
    averageReadiness: number;
  };
  mobility?: {
    pendingOnboardingRequests: number;
    averageReadinessScore: number;
    mobilityBlockers: Array<{
      type: 'MISSING_PRIVILEGES' | 'SAFETY_RESTRICTION' | 'LICENSE_GAP' | 'PAYER_MISALIGNMENT';
      count: number;
      severity: 'LOW' | 'MED' | 'HIGH' | 'CRITICAL';
    }>;
  };
  risk?: {
    highRiskClinicians: number;
    criticalRiskClinicians: number;
    riskDistribution: {
      LOW: number;
      MED: number;
      HIGH: number;
      CRITICAL: number;
    };
    topRiskFactors: Array<{
      factor: string;
      count: number;
      severity: 'LOW' | 'MED' | 'HIGH' | 'CRITICAL';
    }>;
  };
  competency?: {
    averageCCI: number;
    lowCompetencyCount: number;
    competencyDistribution: {
      EXCELLENT: number;
      GOOD: number;
      FAIR: number;
      POOR: number;
    };
  };
  safety?: {
    activeSafetyHolds: number;
    criticalSafetySignals: number;
    averageSafetyScore: number;
    safetyTrend: 'IMPROVING' | 'STABLE' | 'DECLINING';
  };
  payerAlignment?: {
    misalignedPayerCount: number;
    payerGaps: Array<{
      payerId: string;
      payerName: string;
      missingEnrollments: number;
      affectedStates: string[];
      severity: 'LOW' | 'MED' | 'HIGH' | 'CRITICAL';
    }>;
  };
  privilegeCoverage?: {
    underprivilegedDepartments: Array<{
      departmentId: string;
      missingPrivileges: string[];
      affectedClinicians: number;
    }>;
    expansionOpportunities: Array<{
      departmentId: string;
      newPrivilegeSet: string;
      potentialClinicians: number;
    }>;
  };
}

/**
 * Strategic action recommended by the strategic model
 */
export interface StrategicAction {
  id: string;
  type:
    | 'PREVENTIVE_PSV'
    | 'EARLY_RENEWAL'
    | 'PRIVILEGE_EXPANSION'
    | 'HIRING_TRIGGER'
    | 'PAYER_CONTRACT_NEGOTIATION'
    | 'DEPARTMENT_INTERVENTION'
    | 'SAFETY_REVIEW'
    | 'COMPETENCY_TRAINING';
  priority: 'LOW' | 'MED' | 'HIGH' | 'CRITICAL';
  targetOrgId: string;
  targetDepartmentId?: string;
  targetClinicianIds?: string[];
  description: string;
  rationale: string;
  expectedImpact: {
    kpi: string;
    expectedChange: number;
    timeframe: string;
  };
  estimatedCost?: number;
  estimatedEffort?: 'LOW' | 'MED' | 'HIGH';
  metadata?: Record<string, unknown>;
}

/**
 * Strategic insight generated by the reasoner
 */
export interface StrategicInsight {
  id: string;
  type: 'RENEWAL_CLIFF' | 'PAYER_MISALIGNMENT' | 'PRIVILEGE_GAP' | 'RISK_CLUSTER' | 'SAFETY_TREND' | 'COMPETENCY_GAP';
  severity: 'LOW' | 'MED' | 'HIGH' | 'CRITICAL';
  title: string;
  description: string;
  affectedEntities: {
    departments?: string[];
    clinicians?: string[];
    payers?: string[];
    states?: string[];
  };
  timeframe: string;
  recommendedActions: string[];
  metadata?: Record<string, unknown>;
}

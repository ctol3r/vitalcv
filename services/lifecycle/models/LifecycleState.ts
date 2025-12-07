/**
 * B207A-LIFE-001: LifecycleState model
 *
 * Stores snapshot for: privileges, credential freshness, CCI, risk, safety signals,
 * enrollment map, compact eligibility, OPPE/FPPE, drift, forecastRisk.
 */

import { z } from 'zod';

/**
 * Privileges snapshot schema
 */
export const PrivilegesSnapshotSchema = z.object({
  privilegeCodes: z.array(z.string()),
  grantedAt: z.coerce.date().optional(),
  expiresAt: z.coerce.date().optional(),
  status: z.enum(['ACTIVE', 'HOLD', 'SUSPENDED', 'EXPIRED', 'REVOKED']).optional(),
  orgId: z.string().optional(),
  department: z.string().optional(),
});

export type PrivilegesSnapshot = z.infer<typeof PrivilegesSnapshotSchema>;

/**
 * Credential freshness snapshot schema
 */
export const CredentialFreshnessSnapshotSchema = z.object({
  licenseExpiryDays: z.number().optional(), // Days until expiry (negative if expired)
  boardExpiryDays: z.number().optional(),
  deaExpiryDays: z.number().optional(),
  pecosExpiryDays: z.number().optional(),
  lastVerifiedAt: z.coerce.date().optional(),
});

export type CredentialFreshnessSnapshot = z.infer<typeof CredentialFreshnessSnapshotSchema>;

/**
 * CCI (Competency Composite Index) snapshot schema
 */
export const CCISnapshotSchema = z.object({
  cciScore: z.number().min(0).max(100),
  computedAt: z.coerce.date(),
  modelType: z.string().optional(),
  modelVersion: z.string().optional(),
  contributionMap: z.record(z.number()).optional(),
});

export type CCISnapshot = z.infer<typeof CCISnapshotSchema>;

/**
 * Risk snapshot schema
 */
export const RiskSnapshotSchema = z.object({
  riskScore: z.number().min(0).max(1),
  riskLevel: z.enum(['LOW', 'MED', 'HIGH', 'CRITICAL']).optional(),
  factors: z.array(z.string()).optional(),
  computedAt: z.coerce.date().optional(),
});

export type RiskSnapshot = z.infer<typeof RiskSnapshotSchema>;

/**
 * Safety signals snapshot schema
 */
export const SafetySignalsSnapshotSchema = z.object({
  signals: z.array(
    z.object({
      type: z.string(),
      severity: z.enum(['LOW', 'MED', 'HIGH', 'CRITICAL']),
      detectedAt: z.coerce.date(),
      resolvedAt: z.coerce.date().optional(),
    })
  ),
  activeCount: z.number().default(0),
  criticalCount: z.number().default(0),
});

export type SafetySignalsSnapshot = z.infer<typeof SafetySignalsSnapshotSchema>;

/**
 * Enrollment map snapshot schema
 */
export const EnrollmentMapSnapshotSchema = z.object({
  payerEnrollments: z.array(
    z.object({
      payerId: z.string(),
      payerName: z.string().optional(),
      status: z.string(),
      enrolledAt: z.coerce.date().optional(),
    })
  ),
  pecosStatus: z.string().optional(),
  caqhId: z.string().optional(),
});

export type EnrollmentMapSnapshot = z.infer<typeof EnrollmentMapSnapshotSchema>;

/**
 * Compact eligibility snapshot schema
 */
export const CompactEligibilitySnapshotSchema = z.object({
  imlc: z
    .object({
      status: z.string(),
      homeState: z.string().optional(),
      compactStates: z.array(z.string()).default([]),
    })
    .optional(),
  psypact: z
    .object({
      status: z.string(),
      ePassportId: z.string().optional(),
      participatingStates: z.array(z.string()).default([]),
    })
    .optional(),
  counseling: z
    .object({
      status: z.string(),
      homeState: z.string().optional(),
      compactStates: z.array(z.string()).default([]),
    })
    .optional(),
});

export type CompactEligibilitySnapshot = z.infer<typeof CompactEligibilitySnapshotSchema>;

/**
 * OPPE/FPPE snapshot schema
 */
export const OppeFppeSnapshotSchema = z.object({
  oppe: z
    .object({
      status: z.string(),
      lastReviewDate: z.coerce.date().optional(),
      nextReviewDue: z.coerce.date().optional(),
      trend: z.number().min(-1).max(1).optional(), // -1 = declining, 1 = improving
      metrics: z.record(z.unknown()).optional(),
    })
    .optional(),
  fppe: z
    .object({
      status: z.string(),
      startDate: z.coerce.date().optional(),
      endDate: z.coerce.date().optional(),
      outcomes: z.number().min(0).max(1).optional(), // 0 = poor, 1 = excellent
      metrics: z.record(z.unknown()).optional(),
    })
    .optional(),
});

export type OppeFppeSnapshot = z.infer<typeof OppeFppeSnapshotSchema>;

/**
 * Drift snapshot schema
 */
export const DriftSnapshotSchema = z.object({
  eventCount: z.number().default(0),
  lastEventAt: z.coerce.date().optional(),
  severity: z.enum(['LOW', 'MED', 'HIGH', 'CRITICAL']).optional(),
  recentEvents: z
    .array(
      z.object({
        eventId: z.string(),
        type: z.string(),
        detectedAt: z.coerce.date(),
        resolvedAt: z.coerce.date().optional(),
      })
    )
    .default([]),
});

export type DriftSnapshot = z.infer<typeof DriftSnapshotSchema>;

/**
 * Forecast risk snapshot schema
 */
export const ForecastRiskSnapshotSchema = z.object({
  riskScore: z.number().min(0).max(1),
  horizon: z.enum(['3mo', '6mo', '12mo', '24mo', '36mo']),
  factors: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(1).optional(),
  computedAt: z.coerce.date(),
});

export type ForecastRiskSnapshot = z.infer<typeof ForecastRiskSnapshotSchema>;

/**
 * Complete lifecycle state snapshot schema
 */
export const LifecycleStateSchema = z.object({
  clinicianId: z.string().min(1, 'clinicianId is required'),
  orgId: z.string().optional(),
  department: z.string().optional(),
  timestamp: z.coerce.date(),
  privileges: PrivilegesSnapshotSchema.optional(),
  credentialFreshness: CredentialFreshnessSnapshotSchema.optional(),
  cci: CCISnapshotSchema.optional(),
  risk: RiskSnapshotSchema.optional(),
  safetySignals: SafetySignalsSnapshotSchema.optional(),
  enrollmentMap: EnrollmentMapSnapshotSchema.optional(),
  compactEligibility: CompactEligibilitySnapshotSchema.optional(),
  oppeFppe: OppeFppeSnapshotSchema.optional(),
  drift: DriftSnapshotSchema.optional(),
  forecastRisk: ForecastRiskSnapshotSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type LifecycleState = z.infer<typeof LifecycleStateSchema>;

export type CreateLifecycleStateInput = z.input<typeof LifecycleStateSchema>;

/**
 * Create a lifecycle state snapshot
 */
export function createLifecycleState(input: CreateLifecycleStateInput): LifecycleState {
  return LifecycleStateSchema.parse(input);
}

/**
 * Validate lifecycle state
 */
export function validateLifecycleState(state: unknown): LifecycleState {
  return LifecycleStateSchema.parse(state);
}

/**
 * Get all snapshot keys that are present in a lifecycle state
 */
export function getSnapshotKeys(state: LifecycleState): string[] {
  const keys: string[] = [];
  if (state.privileges) keys.push('privileges');
  if (state.credentialFreshness) keys.push('credentialFreshness');
  if (state.cci) keys.push('cci');
  if (state.risk) keys.push('risk');
  if (state.safetySignals) keys.push('safetySignals');
  if (state.enrollmentMap) keys.push('enrollmentMap');
  if (state.compactEligibility) keys.push('compactEligibility');
  if (state.oppeFppe) keys.push('oppeFppe');
  if (state.drift) keys.push('drift');
  if (state.forecastRisk) keys.push('forecastRisk');
  return keys;
}


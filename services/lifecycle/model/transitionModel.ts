/**
 * B207B-LIFE-006: LifecycleTransitionModel
 *
 * Maps current state → future probabilities for:
 * - Risk (license expiry, credential lapses, safety signals)
 * - Privilege readiness (FPPE/OPPE status, competency requirements)
 * - Enrollment stability (payer enrollments, PECOS status)
 * - Compact eligibility (IMLC, PSYPACT, Counseling Compact)
 * - Safety events (predicted safety signals, quality issues)
 */

import { PrismaClient } from '@prisma/client';
import { getServiceLogger } from '../../logging/serviceLogger.js';

const prisma = new PrismaClient();
const log = getServiceLogger('services/lifecycle/transitionModel');

export interface ClinicianCurrentState {
  clinicianId: string;
  licenses: Array<{
    state: string;
    expiryDate: Date;
    status: string;
  }>;
  boardCerts: Array<{
    type: string;
    expiryDate: Date | null;
    status: string;
  }>;
  deaRegistrations: Array<{
    expiryDate: Date | null;
    status: string;
  }>;
  privileges: Array<{
    privilegeGrantedId: string;
    status: string;
    expiresAt: Date;
    renewalDue: Date | null;
    oppeStatus: string;
    fppeStatus: string;
  }>;
  payerEnrollments: Array<{
    payerId: string;
    status: string;
    revalidationDueAt: Date | null;
  }>;
  pecosEnrollments: Array<{
    status: string;
    revalidationDueAt: Date | null;
  }>;
  compactEligibility: {
    imlcStatus: string;
    psypactStatus: string;
    counselingStatus: string;
  };
  oppeTrend: number; // -1 to 1 (declining to improving)
  safetyScore: number; // 0-100
  recentDriftEvents: number;
  recentSafetySignals: number;
}

export interface FutureStateProbabilities {
  // Risk probabilities (0-1)
  risk: {
    licenseExpiryRisk: number; // Probability of license expiring in next 90/180/365 days
    credentialLapseRisk: number; // Probability of credential lapsing
    safetySignalRisk: number; // Probability of safety signal in next 90 days
    qualityRisk: number; // Probability of quality issue
    enrollmentDisruptionRisk: number; // Probability of enrollment disruption
  };
  // Privilege readiness (0-1, higher = more ready)
  privilegeReadiness: {
    currentPrivilegeStability: number; // Probability of maintaining current privileges
    privilegeExpansionReadiness: number; // Readiness for new privileges
    fppeCompletionLikelihood: number; // Likelihood of completing FPPE successfully
    oppeSustainedSuccess: number; // Probability of sustained OPPE success
  };
  // Enrollment stability (0-1)
  enrollmentStability: {
    payerEnrollmentStability: number; // Probability of maintaining payer enrollments
    pecosRevalidationSuccess: number; // Probability of successful PECOS revalidation
    enrollmentDisruptionProbability: number; // Probability of enrollment disruption
  };
  // Compact eligibility (0-1)
  compactEligibility: {
    imlcMaintenanceProbability: number; // Probability of maintaining IMLC eligibility
    psypactMaintenanceProbability: number; // Probability of maintaining PSYPACT
    counselingMaintenanceProbability: number; // Probability of maintaining Counseling Compact
    compactLossRisk: number; // Overall probability of losing compact eligibility
  };
  // Safety event probabilities (0-1)
  safetyEvents: {
    safetySignalProbability30d: number;
    safetySignalProbability90d: number;
    qualityIssueProbability30d: number;
    qualityIssueProbability90d: number;
    driftEventProbability30d: number;
    driftEventProbability90d: number;
  };
  // Horizon timestamps
  projectedAt: Date;
  horizons: {
    days30: Date;
    days90: Date;
    days180: Date;
    days365: Date;
  };
}

/**
 * Calculate future state probabilities from current state
 */
export async function calculateTransitionProbabilities(
  currentState: ClinicianCurrentState
): Promise<FutureStateProbabilities> {
  const now = new Date();
  const projectedAt = now;
  const horizons = {
    days30: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
    days90: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000),
    days180: new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000),
    days365: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
  };

  // Calculate risk probabilities
  const risk = calculateRiskProbabilities(currentState, horizons);

  // Calculate privilege readiness
  const privilegeReadiness = calculatePrivilegeReadiness(currentState);

  // Calculate enrollment stability
  const enrollmentStability = calculateEnrollmentStability(currentState, horizons);

  // Calculate compact eligibility
  const compactEligibility = calculateCompactEligibility(currentState, horizons);

  // Calculate safety event probabilities
  const safetyEvents = calculateSafetyEventProbabilities(currentState, horizons);

  return {
    risk,
    privilegeReadiness,
    enrollmentStability,
    compactEligibility,
    safetyEvents,
    projectedAt,
    horizons,
  };
}

/**
 * Calculate risk probabilities based on current state
 */
function calculateRiskProbabilities(
  state: ClinicianCurrentState,
  horizons: FutureStateProbabilities['horizons']
): FutureStateProbabilities['risk'] {
  // License expiry risk
  const nearestLicenseExpiry = state.licenses
    .map((l) => l.expiryDate)
    .sort((a, b) => a.getTime() - b.getTime())[0];

  const licenseExpiryRisk = nearestLicenseExpiry
    ? calculateExpiryRisk(nearestLicenseExpiry, horizons.days365)
    : 0;

  // Credential lapse risk (board certs, DEA)
  const nearestCredentialExpiry = [
    ...state.boardCerts.map((c) => c.expiryDate).filter((d): d is Date => d !== null),
    ...state.deaRegistrations.map((d) => d.expiryDate).filter((d): d is Date => d !== null),
  ]
    .sort((a, b) => a.getTime() - b.getTime())[0];

  const credentialLapseRisk = nearestCredentialExpiry
    ? calculateExpiryRisk(nearestCredentialExpiry, horizons.days365)
    : 0;

  // Safety signal risk (based on current safety score and recent signals)
  const safetySignalRisk = calculateSafetySignalRisk(
    state.safetyScore,
    state.recentSafetySignals
  );

  // Quality risk (based on OPPE trend and recent drift events)
  const qualityRisk = calculateQualityRisk(state.oppeTrend, state.recentDriftEvents);

  // Enrollment disruption risk
  const enrollmentDisruptionRisk = calculateEnrollmentDisruptionRisk(
    state.payerEnrollments,
    state.pecosEnrollments,
    horizons.days365
  );

  return {
    licenseExpiryRisk,
    credentialLapseRisk,
    safetySignalRisk,
    qualityRisk,
    enrollmentDisruptionRisk,
  };
}

/**
 * Calculate privilege readiness probabilities
 */
function calculatePrivilegeReadiness(
  state: ClinicianCurrentState
): FutureStateProbabilities['privilegeReadiness'] {
  // Current privilege stability (based on status, expiry, OPPE status)
  const privilegeStabilities = state.privileges.map((priv) => {
    const daysUntilExpiry = (priv.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    const expiryFactor = daysUntilExpiry > 365 ? 1 : Math.max(0, daysUntilExpiry / 365);
    const statusFactor = priv.status === 'ACTIVE' ? 1 : priv.status === 'HOLD' ? 0.5 : 0;
    const oppeFactor = priv.oppeStatus === 'ACTIVE' ? 1 : 0.7;
    return (expiryFactor + statusFactor + oppeFactor) / 3;
  });

  const currentPrivilegeStability = privilegeStabilities.length > 0
    ? privilegeStabilities.reduce((a, b) => a + b, 0) / privilegeStabilities.length
    : 0.5;

  // Privilege expansion readiness (based on FPPE completion, OPPE success, safety score)
  const fppeCompletedCount = state.privileges.filter((p) => p.fppeStatus === 'COMPLETED').length;
  const fppeFactor = fppeCompletedCount / Math.max(1, state.privileges.length);
  const oppeSuccessFactor = state.oppeTrend > 0 ? 0.8 : state.oppeTrend > -0.5 ? 0.6 : 0.4;
  const safetyFactor = state.safetyScore > 80 ? 1 : state.safetyScore > 60 ? 0.7 : 0.4;

  const privilegeExpansionReadiness = (fppeFactor + oppeSuccessFactor + safetyFactor) / 3;

  // FPPE completion likelihood
  const fppeCompletionLikelihood = state.safetyScore > 70 && state.recentSafetySignals === 0
    ? 0.9
    : state.safetyScore > 60 && state.recentSafetySignals < 2
    ? 0.7
    : 0.5;

  // OPPE sustained success
  const oppeSustainedSuccess = state.oppeTrend > 0 && state.safetyScore > 75
    ? 0.9
    : state.oppeTrend > -0.3 && state.safetyScore > 65
    ? 0.7
    : 0.5;

  return {
    currentPrivilegeStability,
    privilegeExpansionReadiness,
    fppeCompletionLikelihood,
    oppeSustainedSuccess,
  };
}

/**
 * Calculate enrollment stability probabilities
 */
function calculateEnrollmentStability(
  state: ClinicianCurrentState,
  horizons: FutureStateProbabilities['horizons']
): FutureStateProbabilities['enrollmentStability'] {
  // Payer enrollment stability
  const payerStabilities = state.payerEnrollments.map((enrollment) => {
    if (enrollment.status !== 'APPROVED') return 0.3;
    if (!enrollment.revalidationDueAt) return 0.9;
    const daysUntilRevalidation = (enrollment.revalidationDueAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return daysUntilRevalidation > 180 ? 0.9 : daysUntilRevalidation > 90 ? 0.7 : 0.5;
  });

  const payerEnrollmentStability = payerStabilities.length > 0
    ? payerStabilities.reduce((a, b) => a + b, 0) / payerStabilities.length
    : 0.7;

  // PECOS revalidation success
  const pecosStabilities = state.pecosEnrollments.map((enrollment) => {
    if (enrollment.status !== 'ENROLLED') return 0.2;
    if (!enrollment.revalidationDueAt) return 0.9;
    const daysUntilRevalidation = (enrollment.revalidationDueAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return daysUntilRevalidation > 365 ? 0.95 : daysUntilRevalidation > 180 ? 0.85 : 0.7;
  });

  const pecosRevalidationSuccess = pecosStabilities.length > 0
    ? pecosStabilities.reduce((a, b) => a + b, 0) / pecosStabilities.length
    : 0.8;

  // Enrollment disruption probability
  const enrollmentDisruptionProbability = 1 - Math.min(payerEnrollmentStability, pecosRevalidationSuccess);

  return {
    payerEnrollmentStability,
    pecosRevalidationSuccess,
    enrollmentDisruptionProbability,
  };
}

/**
 * Calculate compact eligibility probabilities
 */
function calculateCompactEligibility(
  state: ClinicianCurrentState,
  horizons: FutureStateProbabilities['horizons']
): FutureStateProbabilities['compactEligibility'] {
  // IMLC maintenance (requires active home state license)
  const imlcMaintenanceProbability = state.licenses.some((l) => l.status === 'ACTIVE')
    ? 0.9
    : 0.3;

  // PSYPACT maintenance (requires active psychology license)
  const psypactMaintenanceProbability = state.compactEligibility.psypactStatus === 'ACTIVE'
    ? 0.9
    : state.compactEligibility.psypactStatus === 'ELIGIBLE'
    ? 0.7
    : 0.1;

  // Counseling Compact maintenance
  const counselingMaintenanceProbability = state.compactEligibility.counselingStatus === 'ACTIVE'
    ? 0.9
    : state.compactEligibility.counselingStatus === 'ELIGIBLE'
    ? 0.7
    : 0.1;

  // Overall compact loss risk
  const compactLossRisk = Math.min(
    1 - imlcMaintenanceProbability,
    1 - psypactMaintenanceProbability,
    1 - counselingMaintenanceProbability
  );

  return {
    imlcMaintenanceProbability,
    psypactMaintenanceProbability,
    counselingMaintenanceProbability,
    compactLossRisk,
  };
}

/**
 * Calculate safety event probabilities
 */
function calculateSafetyEventProbabilities(
  state: ClinicianCurrentState,
  horizons: FutureStateProbabilities['horizons']
): FutureStateProbabilities['safetyEvents'] {
  // Base probabilities based on safety score
  const baseSafetySignalProb30d = state.safetyScore < 60 ? 0.3 : state.safetyScore < 75 ? 0.15 : 0.05;
  const baseSafetySignalProb90d = state.safetyScore < 60 ? 0.6 : state.safetyScore < 75 ? 0.35 : 0.15;

  // Adjust based on recent signals
  const recentSignalAdjustment = Math.min(0.2, state.recentSafetySignals * 0.05);
  const safetySignalProbability30d = Math.min(1, baseSafetySignalProb30d + recentSignalAdjustment);
  const safetySignalProbability90d = Math.min(1, baseSafetySignalProb90d + recentSignalAdjustment);

  // Quality issue probabilities (based on OPPE trend and drift events)
  const baseQualityProb30d = state.oppeTrend < -0.5 ? 0.25 : state.oppeTrend < 0 ? 0.15 : 0.05;
  const baseQualityProb90d = state.oppeTrend < -0.5 ? 0.5 : state.oppeTrend < 0 ? 0.3 : 0.15;

  const driftAdjustment = Math.min(0.15, state.recentDriftEvents * 0.03);
  const qualityIssueProbability30d = Math.min(1, baseQualityProb30d + driftAdjustment);
  const qualityIssueProbability90d = Math.min(1, baseQualityProb90d + driftAdjustment);

  // Drift event probabilities
  const baseDriftProb30d = state.recentDriftEvents > 3 ? 0.4 : state.recentDriftEvents > 1 ? 0.2 : 0.1;
  const baseDriftProb90d = state.recentDriftEvents > 3 ? 0.7 : state.recentDriftEvents > 1 ? 0.5 : 0.3;
  const driftEventProbability30d = Math.min(1, baseDriftProb30d);
  const driftEventProbability90d = Math.min(1, baseDriftProb90d);

  return {
    safetySignalProbability30d,
    safetySignalProbability90d,
    qualityIssueProbability30d,
    qualityIssueProbability90d,
    driftEventProbability30d,
    driftEventProbability90d,
  };
}

/**
 * Helper: Calculate expiry risk (probability of expiring within horizon)
 */
function calculateExpiryRisk(expiryDate: Date, horizon: Date): number {
  const daysUntilExpiry = (expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  const horizonDays = (horizon.getTime() - Date.now()) / (1000 * 60 * 60 * 24);

  if (daysUntilExpiry <= 0) return 1; // Already expired
  if (daysUntilExpiry > horizonDays) return 0; // Expires after horizon

  // Risk increases as expiry approaches
  const riskFactor = 1 - (daysUntilExpiry / horizonDays);

  // Add urgency factor for expiries within 90 days
  if (daysUntilExpiry < 90) {
    return Math.min(1, riskFactor * 1.5);
  }

  return riskFactor;
}

/**
 * Helper: Calculate safety signal risk
 */
function calculateSafetySignalRisk(safetyScore: number, recentSignals: number): number {
  const scoreFactor = safetyScore < 60 ? 0.4 : safetyScore < 75 ? 0.2 : 0.05;
  const signalFactor = Math.min(0.3, recentSignals * 0.1);
  return Math.min(1, scoreFactor + signalFactor);
}

/**
 * Helper: Calculate quality risk
 */
function calculateQualityRisk(oppeTrend: number, recentDriftEvents: number): number {
  const trendFactor = oppeTrend < -0.5 ? 0.4 : oppeTrend < 0 ? 0.2 : 0.05;
  const driftFactor = Math.min(0.3, recentDriftEvents * 0.08);
  return Math.min(1, trendFactor + driftFactor);
}

/**
 * Helper: Calculate enrollment disruption risk
 */
function calculateEnrollmentDisruptionRisk(
  payerEnrollments: ClinicianCurrentState['payerEnrollments'],
  pecosEnrollments: ClinicianCurrentState['pecosEnrollments'],
  horizon: Date
): number {
  const disruptionRisks: number[] = [];

  // Check payer enrollments
  for (const enrollment of payerEnrollments) {
    if (enrollment.status !== 'APPROVED') {
      disruptionRisks.push(0.5);
      continue;
    }
    if (enrollment.revalidationDueAt && enrollment.revalidationDueAt <= horizon) {
      const daysUntilRevalidation = (enrollment.revalidationDueAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      disruptionRisks.push(daysUntilRevalidation < 90 ? 0.4 : 0.2);
    }
  }

  // Check PECOS enrollments
  for (const enrollment of pecosEnrollments) {
    if (enrollment.status !== 'ENROLLED') {
      disruptionRisks.push(0.5);
      continue;
    }
    if (enrollment.revalidationDueAt && enrollment.revalidationDueAt <= horizon) {
      const daysUntilRevalidation = (enrollment.revalidationDueAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      disruptionRisks.push(daysUntilRevalidation < 180 ? 0.3 : 0.15);
    }
  }

  return disruptionRisks.length > 0
    ? disruptionRisks.reduce((a, b) => Math.max(a, b), 0)
    : 0.1;
}


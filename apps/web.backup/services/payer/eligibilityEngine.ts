/**
 * B185C-PAYER-002: Payer eligibility rules engine
 *
 * Evaluates a clinician's readiness for a payer enrollment using rule-based
 * checks derived from CAQH, board certification, DEA registration, PECOS and
 * Medicaid alignment signals.
 */

import { differenceInCalendarDays } from 'date-fns';

export type RuleStatus = 'PASS' | 'FAIL' | 'WARNING';

export interface EligibilityRuleResult {
  ruleId: 'CAQH_COMPLETENESS' | 'BOARD_CERTIFICATION' | 'DEA_SCHEDULE' | 'PECOS_MEDICAID_ALIGNMENT';
  status: RuleStatus;
  message: string;
  blocker?: boolean;
  context?: Record<string, unknown>;
}

export interface EligibilityReport {
  clinicianId: string;
  payerId: string;
  overallStatus: RuleStatus;
  blockers: string[];
  warnings: string[];
  results: EligibilityRuleResult[];
  evaluatedAt: Date;
}

export interface CaqhSnapshot {
  completeness: number; // 0 - 1 range
  attestedAt?: string | Date | null;
  missingSections?: string[];
}

export interface BoardCertificationSnapshot {
  specialty: string;
  status: 'ACTIVE' | 'EXPIRED' | 'PENDING';
  expiresOn?: string | Date | null;
}

export type DeaSchedule = 'II' | 'II-N' | 'III' | 'III-N' | 'IV' | 'V';

export interface DeaSnapshot {
  registrationNumber: string;
  schedules: DeaSchedule[];
  expiresOn: string | Date;
}

export type PecosStatusCode = 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'DENIED' | 'REVALIDATION_DUE';

export interface PecosSnapshot {
  status: PecosStatusCode;
  effectiveDate?: string | Date | null;
  revalidationDueDate?: string | Date | null;
}

export interface MedicaidSnapshot {
  status: 'ACTIVE' | 'PENDING' | 'SUSPENDED';
  state: string;
  requiresPecosAlignment?: boolean;
}

export interface PayerEligibilityInput {
  clinicianId: string;
  payerId: string;
  specialty: string;
  caqh?: CaqhSnapshot;
  boardCertification?: BoardCertificationSnapshot;
  dea?: DeaSnapshot;
  pecos?: PecosSnapshot;
  medicaid?: MedicaidSnapshot;
}

export interface PayerEligibilityRuleConfig {
  minCaqhCompleteness: number;
  maxAttestationAgeDays: number;
  requiresBoardCertification: boolean;
  requiredDeaSchedules: DeaSchedule[];
  requiresPecosApprovalForMedicaid: boolean;
  warnOnMedicaidSuspension: boolean;
}

const DEFAULT_RULE_CONFIG: PayerEligibilityRuleConfig = {
  minCaqhCompleteness: 0.9,
  maxAttestationAgeDays: 120,
  requiresBoardCertification: true,
  requiredDeaSchedules: ['II', 'III'],
  requiresPecosApprovalForMedicaid: true,
  warnOnMedicaidSuspension: true,
};

export function evaluatePayerEligibility(
  input: PayerEligibilityInput,
  overrides: Partial<PayerEligibilityRuleConfig> = {}
): EligibilityReport {
  const config = { ...DEFAULT_RULE_CONFIG, ...overrides };
  const results: EligibilityRuleResult[] = [];

  results.push(evaluateCaqhCompleteness(input, config));
  results.push(evaluateBoardCertification(input, config));
  results.push(evaluateDeaSchedules(input, config));
  results.push(evaluatePecosMedicaidAlignment(input, config));

  const blockers = results.filter((r) => r.blocker || r.status === 'FAIL').map((r) => r.message);
  const warnings = results.filter((r) => r.status === 'WARNING').map((r) => r.message);

  const overallStatus: RuleStatus =
    blockers.length > 0 ? 'FAIL' : warnings.length > 0 ? 'WARNING' : 'PASS';

  return {
    clinicianId: input.clinicianId,
    payerId: input.payerId,
    overallStatus,
    blockers,
    warnings,
    results,
    evaluatedAt: new Date(),
  };
}

function evaluateCaqhCompleteness(
  input: PayerEligibilityInput,
  config: PayerEligibilityRuleConfig
): EligibilityRuleResult {
  if (!input.caqh) {
    return {
      ruleId: 'CAQH_COMPLETENESS',
      status: 'FAIL',
      blocker: true,
      message: 'CAQH profile missing — sync required before submission',
    };
  }

  const completeness = clamp(input.caqh.completeness, 0, 1);
  if (completeness < config.minCaqhCompleteness) {
    return {
      ruleId: 'CAQH_COMPLETENESS',
      status: 'FAIL',
      blocker: true,
      message: `CAQH completeness ${Math.round(completeness * 100)}% < ${
        config.minCaqhCompleteness * 100
      }% threshold`,
      context: { missingSections: input.caqh.missingSections ?? [] },
    };
  }

  if (input.caqh.attestedAt) {
    const attestationDate = toDate(input.caqh.attestedAt);
    const ageDays = differenceInCalendarDays(new Date(), attestationDate);
    if (ageDays > config.maxAttestationAgeDays) {
      return {
        ruleId: 'CAQH_COMPLETENESS',
        status: 'WARNING',
        message: `CAQH attestation is ${ageDays} days old, re-attest to stay under ${config.maxAttestationAgeDays} days`,
      };
    }
  }

  return {
    ruleId: 'CAQH_COMPLETENESS',
    status: 'PASS',
    message: 'CAQH profile is complete and current',
  };
}

function evaluateBoardCertification(
  input: PayerEligibilityInput,
  config: PayerEligibilityRuleConfig
): EligibilityRuleResult {
  if (!config.requiresBoardCertification) {
    return {
      ruleId: 'BOARD_CERTIFICATION',
      status: 'PASS',
      message: 'Board certification not required for this payer',
    };
  }

  const board = input.boardCertification;
  if (!board) {
    return {
      ruleId: 'BOARD_CERTIFICATION',
      status: 'FAIL',
      blocker: true,
      message: 'No board certification on file for required specialty',
    };
  }

  const matchesSpecialty =
    board.specialty.trim().toLowerCase() === input.specialty.trim().toLowerCase();

  if (!matchesSpecialty) {
    return {
      ruleId: 'BOARD_CERTIFICATION',
      status: 'FAIL',
      blocker: true,
      message: `Board certification specialty (${board.specialty}) does not match payer specialty (${input.specialty})`,
    };
  }

  if (board.status !== 'ACTIVE') {
    return {
      ruleId: 'BOARD_CERTIFICATION',
      status: 'FAIL',
      blocker: true,
      message: `Board certification status is ${board.status}`,
    };
  }

  if (board.expiresOn && toDate(board.expiresOn) < new Date()) {
    return {
      ruleId: 'BOARD_CERTIFICATION',
      status: 'FAIL',
      blocker: true,
      message: 'Board certification has expired',
    };
  }

  return {
    ruleId: 'BOARD_CERTIFICATION',
    status: 'PASS',
    message: 'Board certification verified for specialty',
  };
}

function evaluateDeaSchedules(
  input: PayerEligibilityInput,
  config: PayerEligibilityRuleConfig
): EligibilityRuleResult {
  if (config.requiredDeaSchedules.length === 0) {
    return {
      ruleId: 'DEA_SCHEDULE',
      status: 'PASS',
      message: 'DEA schedules not required',
    };
  }

  if (!input.dea) {
    return {
      ruleId: 'DEA_SCHEDULE',
      status: 'FAIL',
      blocker: true,
      message: 'DEA registration missing',
    };
  }

  if (toDate(input.dea.expiresOn) < new Date()) {
    return {
      ruleId: 'DEA_SCHEDULE',
      status: 'FAIL',
      blocker: true,
      message: 'DEA registration expired',
    };
  }

  const missingSchedules = config.requiredDeaSchedules.filter(
    (schedule) => !input.dea!.schedules.includes(schedule)
  );

  if (missingSchedules.length > 0) {
    return {
      ruleId: 'DEA_SCHEDULE',
      status: 'FAIL',
      blocker: true,
      message: `DEA registration missing schedules: ${missingSchedules.join(', ')}`,
      context: { required: config.requiredDeaSchedules, present: input.dea.schedules },
    };
  }

  return {
    ruleId: 'DEA_SCHEDULE',
    status: 'PASS',
    message: 'DEA registration covers required schedules',
  };
}

function evaluatePecosMedicaidAlignment(
  input: PayerEligibilityInput,
  config: PayerEligibilityRuleConfig
): EligibilityRuleResult {
  const medicaid = input.medicaid;
  const pecos = input.pecos;

  if (!medicaid && !pecos) {
    return {
      ruleId: 'PECOS_MEDICAID_ALIGNMENT',
      status: 'WARNING',
      message: 'No PECOS or Medicaid data provided',
    };
  }

  if (medicaid?.status === 'ACTIVE') {
    if (config.requiresPecosApprovalForMedicaid && (!pecos || pecos.status !== 'APPROVED')) {
      return {
        ruleId: 'PECOS_MEDICAID_ALIGNMENT',
        status: 'FAIL',
        blocker: true,
        message: 'Medicaid active but PECOS approval missing',
      };
    }

    if (pecos?.status === 'REVALIDATION_DUE') {
      return {
        ruleId: 'PECOS_MEDICAID_ALIGNMENT',
        status: 'WARNING',
        message: 'PECOS revalidation due while Medicaid remains active',
      };
    }
  }

  if (medicaid?.status === 'SUSPENDED' && config.warnOnMedicaidSuspension) {
    return {
      ruleId: 'PECOS_MEDICAID_ALIGNMENT',
      status: 'WARNING',
      message: `Medicaid suspended in ${medicaid.state}`,
    };
  }

  if (pecos && pecos.status === 'DENIED' && medicaid?.status === 'PENDING') {
    return {
      ruleId: 'PECOS_MEDICAID_ALIGNMENT',
      status: 'FAIL',
      blocker: true,
      message: 'PECOS denied while Medicaid still pending — resolve PECOS outcome first',
    };
  }

  return {
    ruleId: 'PECOS_MEDICAID_ALIGNMENT',
    status: 'PASS',
    message: 'PECOS and Medicaid signals aligned',
  };
}

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}


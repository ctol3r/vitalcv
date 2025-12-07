/**
 * B185C-PAYER-002: Payer eligibility rules engine
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
  completeness: number;
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
  const overallStatus: RuleStatus = blockers.length ? 'FAIL' : warnings.length ? 'WARNING' : 'PASS';

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
      message: 'CAQH profile missing — sync before submission',
    };
  }

  const completeness = clamp(input.caqh.completeness, 0, 1);
  if (completeness < config.minCaqhCompleteness) {
    return {
      ruleId: 'CAQH_COMPLETENESS',
      status: 'FAIL',
      blocker: true,
      message: `CAQH completeness ${Math.round(completeness * 100)}% below ${
        config.minCaqhCompleteness * 100
      }% threshold`,
      context: { missingSections: input.caqh.missingSections ?? [] },
    };
  }

  if (input.caqh.attestedAt) {
    const attestedAt = toDate(input.caqh.attestedAt);
    const age = differenceInCalendarDays(new Date(), attestedAt);
    if (age > config.maxAttestationAgeDays) {
      return {
        ruleId: 'CAQH_COMPLETENESS',
        status: 'WARNING',
        message: `CAQH attestation ${age} days old (> ${config.maxAttestationAgeDays})`,
      };
    }
  }

  return {
    ruleId: 'CAQH_COMPLETENESS',
    status: 'PASS',
    message: 'CAQH profile complete',
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
      message: 'Board certification not required',
    };
  }

  const cert = input.boardCertification;
  if (!cert) {
    return {
      ruleId: 'BOARD_CERTIFICATION',
      status: 'FAIL',
      blocker: true,
      message: 'Board certification missing',
    };
  }

  const matches =
    cert.specialty.trim().toLowerCase() === input.specialty.trim().toLowerCase() &&
    cert.status === 'ACTIVE';

  if (!matches) {
    return {
      ruleId: 'BOARD_CERTIFICATION',
      status: 'FAIL',
      blocker: true,
      message: `Board certification mismatch (${cert.specialty} vs ${input.specialty})`,
    };
  }

  if (cert.expiresOn && toDate(cert.expiresOn) < new Date()) {
    return {
      ruleId: 'BOARD_CERTIFICATION',
      status: 'FAIL',
      blocker: true,
      message: 'Board certification expired',
    };
  }

  return {
    ruleId: 'BOARD_CERTIFICATION',
    status: 'PASS',
    message: 'Board certification verified',
  };
}

function evaluateDeaSchedules(
  input: PayerEligibilityInput,
  config: PayerEligibilityRuleConfig
): EligibilityRuleResult {
  if (!config.requiredDeaSchedules.length) {
    return { ruleId: 'DEA_SCHEDULE', status: 'PASS', message: 'DEA not required' };
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

  const missing = config.requiredDeaSchedules.filter(
    (schedule) => !input.dea!.schedules.includes(schedule)
  );

  if (missing.length) {
    return {
      ruleId: 'DEA_SCHEDULE',
      status: 'FAIL',
      blocker: true,
      message: `DEA missing schedules: ${missing.join(', ')}`,
    };
  }

  return {
    ruleId: 'DEA_SCHEDULE',
    status: 'PASS',
    message: 'DEA covers required schedules',
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
      message: 'No PECOS / Medicaid data provided',
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
        message: 'PECOS revalidation due while Medicaid active',
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

  if (pecos?.status === 'DENIED' && medicaid?.status === 'PENDING') {
    return {
      ruleId: 'PECOS_MEDICAID_ALIGNMENT',
      status: 'FAIL',
      blocker: true,
      message: 'PECOS denied while Medicaid pending',
    };
  }

  return {
    ruleId: 'PECOS_MEDICAID_ALIGNMENT',
    status: 'PASS',
    message: 'PECOS and Medicaid aligned',
  };
}

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}


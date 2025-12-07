import type { ClinicianProfile, DemandSignal } from './types';

export type NegativeConstraint =
  | 'PRIVILEGE_RESTRICTED'
  | 'COMPLIANCE_FAIL'
  | 'HIGH_DRIFT'
  | 'QUALITY_HAZARD'
  | 'PAYER_MISALIGNMENT';

export interface ConstraintResult {
  allowed: boolean;
  violated: NegativeConstraint[];
  messages: string[];
}

export interface NegativeConstraintConfig {
  enforceComplianceFail: boolean;
  driftBlockLevel: 'MEDIUM' | 'HIGH';
  blockQualityHazards: boolean;
  requirePayerAlignment: boolean;
}

const DRIFT_ORDER: Record<'LOW' | 'MEDIUM' | 'HIGH', number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
};

export const DEFAULT_NEGATIVE_CONSTRAINT_CONFIG: NegativeConstraintConfig = {
  enforceComplianceFail: true,
  driftBlockLevel: 'HIGH',
  blockQualityHazards: true,
  requirePayerAlignment: true,
};

export class NegativeConstraintEngine {
  constructor(private readonly config: NegativeConstraintConfig = DEFAULT_NEGATIVE_CONSTRAINT_CONFIG) {}

  evaluate(clinician: ClinicianProfile, demand: DemandSignal): ConstraintResult {
    const violated: NegativeConstraint[] = [];
    const messages: string[] = [];

    const restrictedPrivileges = this.findRestrictedPrivileges(clinician, demand);
    if (restrictedPrivileges.length > 0) {
      violated.push('PRIVILEGE_RESTRICTED');
      messages.push(
        `Privilege restriction: ${restrictedPrivileges
          .map((entry) => `${entry.code} (${entry.status})`)
          .join(', ')}`
      );
    }

    if (this.config.enforceComplianceFail && clinician.risk.complianceStatus === 'FAIL') {
      violated.push('COMPLIANCE_FAIL');
      messages.push('Compliance status FAIL blocks matching.');
    }

    if (
      clinician.risk.driftSignal &&
      DRIFT_ORDER[clinician.risk.driftSignal] >= DRIFT_ORDER[this.config.driftBlockLevel]
    ) {
      violated.push('HIGH_DRIFT');
      messages.push(`Drift signal ${clinician.risk.driftSignal} exceeds accepted threshold.`);
    }

    if (this.config.blockQualityHazards && clinician.risk.qualityHazard) {
      violated.push('QUALITY_HAZARD');
      messages.push('Active quality hazard risk requires remediation.');
    }

    const preferredPayers = demand.preferredPayers ?? [];
    if (this.config.requirePayerAlignment && preferredPayers.length > 0) {
      const aligned = this.countAlignedPayers(clinician, preferredPayers);
      if (aligned === 0) {
        violated.push('PAYER_MISALIGNMENT');
        messages.push('No payer enrollment overlaps the demand payer mix.');
      }
    }

    return {
      allowed: violated.length === 0,
      violated,
      messages,
    };
  }

  private findRestrictedPrivileges(clinician: ClinicianProfile, demand: DemandSignal) {
    const required = new Set(demand.requiredPrivileges ?? []);
    return clinician.privileges.filter(
      (priv) =>
        required.has(priv.code) &&
        (priv.status === 'RESTRICTED' || priv.status === 'SUSPENDED' || priv.status === 'PENDING')
    );
  }

  private countAlignedPayers(clinician: ClinicianProfile, preferredPayers: string[]): number {
    const preferred = new Set(preferredPayers);
    return clinician.payerCoverage.filter(
      (payer) => payer.status === 'ENROLLED' && preferred.has(payer.payerId)
    ).length;
  }
}

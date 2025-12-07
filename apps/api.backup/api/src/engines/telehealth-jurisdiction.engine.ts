/**
 * Telehealth Jurisdiction Engine
 *
 * Computes authorization for cross-state telehealth based on:
 * - Provider licenses
 * - Compact memberships (IMLC, NLC, PSYPACT, etc.)
 * - State-specific telehealth registrations
 * - Patient location = practice location rule
 */

export interface TelehealthAuthzInput {
  patientState: string;
  providerLicenses: ProviderLicense[];
  compactMemberships: CompactMembership[];
  telehealthRegistrations?: TelehealthRegistration[];
}

export interface ProviderLicense {
  state: string;
  licenseType: string;
  status: 'active' | 'inactive' | 'expired';
  expirationDate?: Date;
}

export interface CompactMembership {
  compact: 'IMLC' | 'NLC' | 'PSYPACT' | 'APRN' | 'PT' | 'OT';
  homeState: string;
  memberStates: string[];
  status: 'active' | 'pending' | 'inactive';
  specialRules?: Record<string, any>;
}

export interface TelehealthRegistration {
  state: string;
  registrationType: string;
  status: 'active' | 'pending' | 'expired';
}

export interface TelehealthAuthzResult {
  authorized: boolean;
  rationale: string[];
  evidence: EvidenceRecord[];
  warnings?: string[];
}

export interface EvidenceRecord {
  type: 'license' | 'compact' | 'registration' | 'rule';
  source: string;
  timestamp: Date;
  data: Record<string, any>;
}

export class TelehealthJurisdictionEngine {
  /**
   * Compute telehealth authorization for a given patient state
   */
  async computeTelehealthAuthz(
    input: TelehealthAuthzInput
  ): Promise<TelehealthAuthzResult> {
    const rationale: string[] = [];
    const evidence: EvidenceRecord[] = [];
    const warnings: string[] = [];

    // Rule 1: Direct license in patient state
    const directLicense = input.providerLicenses.find(
      (lic) => lic.state === input.patientState && lic.status === 'active'
    );

    if (directLicense) {
      rationale.push(`Active license in patient state (${input.patientState})`);
      evidence.push({
        type: 'license',
        source: 'direct_license',
        timestamp: new Date(),
        data: { license: directLicense },
      });
      return { authorized: true, rationale, evidence };
    }

    // Rule 2: Compact membership allows practice in patient state
    const applicableCompact = this.checkCompactAuthorization(
      input.patientState,
      input.compactMemberships
    );

    if (applicableCompact) {
      rationale.push(
        `Authorized via ${applicableCompact.compact} compact membership`
      );
      evidence.push({
        type: 'compact',
        source: applicableCompact.compact,
        timestamp: new Date(),
        data: { compact: applicableCompact },
      });
      return { authorized: true, rationale, evidence };
    }

    // Rule 3: State-specific telehealth registration
    const telehealthReg = input.telehealthRegistrations?.find(
      (reg) => reg.state === input.patientState && reg.status === 'active'
    );

    if (telehealthReg) {
      rationale.push(
        `Active telehealth registration in ${input.patientState}`
      );
      evidence.push({
        type: 'registration',
        source: 'telehealth_registration',
        timestamp: new Date(),
        data: { registration: telehealthReg },
      });
      return { authorized: true, rationale, evidence };
    }

    // Not authorized
    rationale.push(
      `No valid authorization for telehealth in ${input.patientState}`
    );
    rationale.push(
      'Missing: direct license, compact privilege, or telehealth registration'
    );

    return {
      authorized: false,
      rationale,
      evidence,
      warnings,
    };
  }

  /**
   * Check if any compact membership grants practice privileges in target state
   */
  private checkCompactAuthorization(
    targetState: string,
    compacts: CompactMembership[]
  ): CompactMembership | null {
    for (const compact of compacts) {
      if (
        compact.status === 'active' &&
        compact.memberStates.includes(targetState)
      ) {
        // Check special rules (e.g., NLC 60-day residency)
        if (this.validateSpecialRules(compact, targetState)) {
          return compact;
        }
      }
    }
    return null;
  }

  /**
   * Validate compact-specific special rules
   */
  private validateSpecialRules(
    compact: CompactMembership,
    targetState: string
  ): boolean {
    // TODO: Implement special rule validation
    // - NLC: 60-day residency requirement
    // - PSYPACT: APIT/TAP distinctions
    // - etc.
    return true;
  }

  /**
   * Persist evidence records for audit trail
   */
  async persistEvidence(
    providerId: string,
    patientId: string,
    result: TelehealthAuthzResult
  ): Promise<void> {
    // TODO: Store in database with provider/patient context
    console.log('Persisting telehealth authz evidence:', {
      providerId,
      patientId,
      result,
    });
  }
}

export const telehealthEngine = new TelehealthJurisdictionEngine();


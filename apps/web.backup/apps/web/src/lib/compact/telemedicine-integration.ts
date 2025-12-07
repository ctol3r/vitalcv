/**
 * Telemedicine Integration
 *
 * Phase 4: Combine interstate compacts with telemedicine & practice-location rules
 */

import type { CompactRuleInput, CompactRuleOutput } from './CompactEngine';
import { CompactEngine, STATE_COMPACT_MEMBERSHIP } from './CompactEngine';
import type { PracticeMapData } from './eligibility-algorithms';
import { getWhereYouCanPracticeToday } from './eligibility-algorithms';

/**
 * Telemedicine rule engine interface
 */
export interface TelemedicineRule {
  patientState: string;
  clinicianState: string;
  compactCoverage: boolean;
  requiresStateLicense: boolean;
  allowed: boolean;
  restrictions: string[];
}

/**
 * Tele-practice eligibility result
 */
export interface TelePracticeEligibility {
  patientState: string;
  allowed: boolean;
  viaCompact: boolean;
  compactType?: string;
  restrictions: string[];
  riskScore: number;
  notes: string[];
}

/**
 * Integrate CompactEngine with TelemedicineRuleEngine
 */
export class TelemedicineCompactEngine {
  /**
   * Evaluate telemedicine eligibility combining compact and state rules
   */
  static evaluateTelemedicineEligibility(
    input: CompactRuleInput,
    patientState: string,
    clinicianState?: string
  ): TelePracticeEligibility {
    const clinician = clinicianState || input.clinicianState;
    const compactEvaluation = CompactEngine.evaluate(input, patientState);

    // Check if compact covers this patient state
    const viaCompact = compactEvaluation.status === 'eligible' ||
                       compactEvaluation.status === 'conditional';

    // Determine if state license is required
    const requiresStateLicense = !viaCompact &&
                                 !compactEvaluation.authorizedStates.includes(patientState);

    // Calculate risk score (lower is better)
    let riskScore = 0.5; // Base risk

    if (viaCompact) {
      riskScore -= 0.3; // Compact reduces risk
    }

    if (requiresStateLicense) {
      riskScore += 0.4; // No license increases risk
    }

    if (compactEvaluation.status === 'conditional') {
      riskScore += 0.2; // Conditional increases risk
    }

    riskScore = Math.max(0, Math.min(1, riskScore)); // Clamp to 0-1

    const allowed = viaCompact || !requiresStateLicense;
    const restrictions: string[] = [];

    if (!allowed) {
      restrictions.push(`State license required in ${patientState}`);
    }

    if (compactEvaluation.status === 'conditional') {
      restrictions.push(...compactEvaluation.requiredSteps);
    }

    return {
      patientState,
      allowed,
      viaCompact,
      compactType: viaCompact ? compactEvaluation.notes[0] : undefined,
      restrictions,
      riskScore,
      notes: compactEvaluation.notes,
    };
  }

  /**
   * Get telemedicine eligibility map
   */
  static getTelemedicineEligibilityMap(
    input: CompactRuleInput
  ): Map<string, TelePracticeEligibility> {
    const map = new Map<string, TelePracticeEligibility>();
    const allStates = Object.keys(STATE_COMPACT_MEMBERSHIP);

    allStates.forEach(patientState => {
      const eligibility = this.evaluateTelemedicineEligibility(input, patientState);
      map.set(patientState, eligibility);
    });

    return map;
  }

  /**
   * Get count of states where clinician can legally see patients
   */
  static getTelemedicineCoverageCount(
    input: CompactRuleInput
  ): { total: number; viaCompact: number; viaLicense: number } {
    const map = this.getTelemedicineEligibilityMap(input);
    let total = 0;
    let viaCompact = 0;
    let viaLicense = 0;

    map.forEach(eligibility => {
      if (eligibility.allowed) {
        total++;
        if (eligibility.viaCompact) {
          viaCompact++;
        } else {
          viaLicense++;
        }
      }
    });

    return { total, viaCompact, viaLicense };
  }

  /**
   * Tele-prescribing rules by compact
   */
  static getTelePrescribingRules(
    compactType: string,
    patientState: string
  ): {
    allowed: boolean;
    requirements: string[];
    restrictions: string[];
  } {
    const rules = {
      allowed: false,
      requirements: [] as string[],
      restrictions: [] as string[],
    };

    // IMLC tele-prescribing
    if (compactType.includes('IMLC')) {
      rules.allowed = true;
      rules.requirements.push('Valid physician-patient relationship');
      rules.requirements.push('DEA registration in home state');
      rules.restrictions.push('Controlled substances may require additional state registration');
    }

    // NLC tele-prescribing (NPs)
    if (compactType.includes('NLC') || compactType.includes('APRN')) {
      rules.allowed = true;
      rules.requirements.push('Prescriptive authority in home state');
      rules.requirements.push('Valid APRN license');
      rules.restrictions.push('State-specific prescribing limitations may apply');
    }

    // PSYPACT (typically no prescribing)
    if (compactType.includes('PSYPACT')) {
      rules.allowed = false;
      rules.restrictions.push('PSYPACT does not authorize prescribing');
    }

    return rules;
  }

  /**
   * Adjust risk score for cross-state practice
   */
  static adjustRiskScoreForCrossStatePractice(
    baseRiskScore: number,
    compactCoverage: boolean,
    stateLicenseHeld: boolean,
    disciplinaryHistory: boolean
  ): number {
    let adjusted = baseRiskScore;

    if (compactCoverage) {
      adjusted -= 0.15; // Compact reduces risk
    }

    if (!stateLicenseHeld) {
      adjusted += 0.25; // No license increases risk
    }

    if (disciplinaryHistory) {
      adjusted += 0.30; // Disciplinary history increases risk
    }

    return Math.max(0, Math.min(1, adjusted));
  }

  /**
   * DEA telemedicine compliance check
   */
  static checkDEATelemedicineCompliance(
    input: CompactRuleInput,
    patientState: string
  ): {
    compliant: boolean;
    requirements: string[];
    warnings: string[];
  } {
    const requirements: string[] = [];
    const warnings: string[] = [];

    // Check if compact covers prescribing
    const compactEvaluation = CompactEngine.evaluate(input, patientState);
    const prescribingRules = this.getTelePrescribingRules(
      compactEvaluation.notes[0] || '',
      patientState
    );

    if (!prescribingRules.allowed) {
      return {
        compliant: false,
        requirements: ['Obtain state-specific DEA registration'],
        warnings: ['Prescribing not authorized via compact'],
      };
    }

    // DEA requirements
    requirements.push('DEA registration in home state');
    requirements.push('Valid physician-patient relationship');

    // State-specific warnings
    if (patientState === 'CA' || patientState === 'NY') {
      warnings.push('Additional state registration may be required for controlled substances');
    }

    return {
      compliant: true,
      requirements,
      warnings,
    };
  }

  /**
   * Generate smart suggestion for expanding tele coverage
   */
  static generateTeleCoverageSuggestion(
    input: CompactRuleInput
  ): {
    targetState: string;
    benefit: string;
    estimatedTime: number;
    requirements: string[];
    priority: 'high' | 'medium' | 'low';
  } | null {
    const coverage = this.getTelemedicineCoverageCount(input);
    const map = this.getTelemedicineEligibilityMap(input);

    // Find states with high patient population that aren't covered
    const highValueStates = ['CA', 'TX', 'FL', 'NY', 'WA'];

    for (const state of highValueStates) {
      const eligibility = map.get(state);
      if (eligibility && !eligibility.allowed) {
        const compactEvaluation = CompactEngine.evaluate(input, state);

        return {
          targetState: state,
          benefit: `Add ${state} license to expand tele coverage by ${compactEvaluation.authorizedStates.length} states`,
          estimatedTime: compactEvaluation.estimatedTime,
          requirements: compactEvaluation.requiredSteps,
          priority: 'high',
        };
      }
    }

    return null;
  }
}


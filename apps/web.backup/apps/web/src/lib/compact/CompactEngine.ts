/**
 * Interstate Compact Crosswalk Engine
 *
 * Regulatory-grade mobility-aware chain-backed compact rule engine
 * for the entire platform.
 *
 * @module CompactEngine
 */

import type {
  CompactType,
  ClinicianCompactProfile,
  PracticeEligibilityResult,
} from '../../../../services/compacts/eligibilityEngine.js';
import { evaluatePracticeEligibility, listAuthorizedStatesForCompact } from '../../../../services/compacts/eligibilityEngine.js';

/**
 * All supported compact types
 */
export enum CompactTypeEnum {
  IMLC = 'IMLC', // Interstate Medical Licensure Compact (physicians)
  NLC = 'NLC', // Nurse Licensure Compact
  PSYPACT = 'PSYPACT', // Psychology Interjurisdictional Compact
  APRN = 'APRN', // Advanced Practice Registered Nurse Compact
  PT = 'PT', // Physical Therapy Compact
  OT = 'OT', // Occupational Therapy Compact
  ASLP = 'ASLP', // Audiology and Speech-Language Pathology Compact
  COUNSELING = 'COUNSELING', // Counseling Compact
}

/**
 * Input parameters for compact rule evaluation
 */
export interface CompactRuleInput {
  /** State where clinician currently practices */
  clinicianState: string;
  /** Primary state of residence */
  homeState: string;
  /** Compact memberships the clinician holds */
  compactMembership: CompactTypeEnum[];
  /** Type of license (MD, DO, RN, NP, etc.) */
  licenseType: string;
  /** Medical specialty */
  specialty?: string;
  /** Additional profile data */
  profile?: ClinicianCompactProfile;
}

/**
 * Output from compact rule evaluation
 */
export interface CompactRuleOutput {
  /** Eligibility status */
  status: 'eligible' | 'conditional' | 'ineligible';
  /** Required steps to achieve eligibility */
  requiredSteps: string[];
  /** Estimated time to complete requirements (in days) */
  estimatedTime: number;
  /** Detailed eligibility result */
  eligibilityResult?: PracticeEligibilityResult;
  /** Authorized states for practice */
  authorizedStates: string[];
  /** Blockers preventing eligibility */
  blockers: string[];
  /** Notes and recommendations */
  notes: string[];
}

/**
 * 50-state compact membership table
 * Maps each state to the compacts it participates in
 */
export const STATE_COMPACT_MEMBERSHIP: Record<string, CompactTypeEnum[]> = {
  // IMLC States (38+)
  AL: [CompactTypeEnum.IMLC, CompactTypeEnum.NLC, CompactTypeEnum.PT],
  AK: [CompactTypeEnum.NLC, CompactTypeEnum.PT],
  AZ: [CompactTypeEnum.IMLC, CompactTypeEnum.NLC, CompactTypeEnum.PSYPACT, CompactTypeEnum.PT],
  AR: [CompactTypeEnum.IMLC, CompactTypeEnum.NLC, CompactTypeEnum.PT],
  CA: [CompactTypeEnum.NLC, CompactTypeEnum.PSYPACT],
  CO: [CompactTypeEnum.IMLC, CompactTypeEnum.NLC, CompactTypeEnum.PSYPACT, CompactTypeEnum.PT],
  CT: [CompactTypeEnum.IMLC, CompactTypeEnum.NLC, CompactTypeEnum.PSYPACT],
  DE: [CompactTypeEnum.IMLC, CompactTypeEnum.NLC, CompactTypeEnum.PSYPACT],
  FL: [CompactTypeEnum.IMLC, CompactTypeEnum.NLC, CompactTypeEnum.PSYPACT, CompactTypeEnum.PT],
  GA: [CompactTypeEnum.IMLC, CompactTypeEnum.NLC, CompactTypeEnum.PT],
  HI: [CompactTypeEnum.NLC],
  ID: [CompactTypeEnum.IMLC, CompactTypeEnum.NLC, CompactTypeEnum.PT],
  IL: [CompactTypeEnum.IMLC, CompactTypeEnum.NLC, CompactTypeEnum.PSYPACT, CompactTypeEnum.PT],
  IN: [CompactTypeEnum.IMLC, CompactTypeEnum.NLC, CompactTypeEnum.PT],
  IA: [CompactTypeEnum.IMLC, CompactTypeEnum.NLC, CompactTypeEnum.PSYPACT, CompactTypeEnum.PT],
  KS: [CompactTypeEnum.IMLC, CompactTypeEnum.NLC, CompactTypeEnum.PT],
  KY: [CompactTypeEnum.IMLC, CompactTypeEnum.NLC, CompactTypeEnum.PT],
  LA: [CompactTypeEnum.IMLC, CompactTypeEnum.NLC, CompactTypeEnum.PT],
  ME: [CompactTypeEnum.IMLC, CompactTypeEnum.NLC, CompactTypeEnum.PSYPACT],
  MD: [CompactTypeEnum.IMLC, CompactTypeEnum.NLC, CompactTypeEnum.PSYPACT, CompactTypeEnum.PT],
  MA: [CompactTypeEnum.IMLC, CompactTypeEnum.NLC, CompactTypeEnum.PSYPACT],
  MI: [CompactTypeEnum.IMLC, CompactTypeEnum.NLC, CompactTypeEnum.PSYPACT, CompactTypeEnum.PT],
  MN: [CompactTypeEnum.IMLC, CompactTypeEnum.NLC, CompactTypeEnum.PSYPACT, CompactTypeEnum.PT],
  MS: [CompactTypeEnum.IMLC, CompactTypeEnum.NLC, CompactTypeEnum.PT],
  MO: [CompactTypeEnum.IMLC, CompactTypeEnum.NLC, CompactTypeEnum.PSYPACT, CompactTypeEnum.PT],
  MT: [CompactTypeEnum.IMLC, CompactTypeEnum.NLC, CompactTypeEnum.PT],
  NE: [CompactTypeEnum.IMLC, CompactTypeEnum.NLC, CompactTypeEnum.PT],
  NV: [CompactTypeEnum.IMLC, CompactTypeEnum.NLC, CompactTypeEnum.PSYPACT, CompactTypeEnum.PT],
  NH: [CompactTypeEnum.IMLC, CompactTypeEnum.NLC, CompactTypeEnum.PSYPACT],
  NJ: [CompactTypeEnum.IMLC, CompactTypeEnum.NLC, CompactTypeEnum.PSYPACT],
  NM: [CompactTypeEnum.IMLC, CompactTypeEnum.NLC, CompactTypeEnum.PSYPACT, CompactTypeEnum.PT],
  NY: [CompactTypeEnum.NLC, CompactTypeEnum.PSYPACT],
  NC: [CompactTypeEnum.IMLC, CompactTypeEnum.NLC, CompactTypeEnum.PSYPACT, CompactTypeEnum.PT],
  ND: [CompactTypeEnum.IMLC, CompactTypeEnum.NLC, CompactTypeEnum.PT],
  OH: [CompactTypeEnum.IMLC, CompactTypeEnum.NLC, CompactTypeEnum.PSYPACT, CompactTypeEnum.PT],
  OK: [CompactTypeEnum.IMLC, CompactTypeEnum.NLC, CompactTypeEnum.PT],
  OR: [CompactTypeEnum.IMLC, CompactTypeEnum.NLC, CompactTypeEnum.PSYPACT, CompactTypeEnum.PT],
  PA: [CompactTypeEnum.IMLC, CompactTypeEnum.NLC, CompactTypeEnum.PSYPACT, CompactTypeEnum.PT],
  RI: [CompactTypeEnum.IMLC, CompactTypeEnum.NLC, CompactTypeEnum.PSYPACT],
  SC: [CompactTypeEnum.IMLC, CompactTypeEnum.NLC, CompactTypeEnum.PT],
  SD: [CompactTypeEnum.IMLC, CompactTypeEnum.NLC, CompactTypeEnum.PT],
  TN: [CompactTypeEnum.IMLC, CompactTypeEnum.NLC, CompactTypeEnum.PT],
  TX: [CompactTypeEnum.IMLC, CompactTypeEnum.NLC, CompactTypeEnum.PSYPACT, CompactTypeEnum.PT],
  UT: [CompactTypeEnum.IMLC, CompactTypeEnum.NLC, CompactTypeEnum.PSYPACT, CompactTypeEnum.PT],
  VT: [CompactTypeEnum.IMLC, CompactTypeEnum.NLC, CompactTypeEnum.PSYPACT],
  VA: [CompactTypeEnum.IMLC, CompactTypeEnum.NLC, CompactTypeEnum.PSYPACT, CompactTypeEnum.PT],
  WA: [CompactTypeEnum.IMLC, CompactTypeEnum.NLC, CompactTypeEnum.PSYPACT, CompactTypeEnum.PT],
  WV: [CompactTypeEnum.IMLC, CompactTypeEnum.NLC, CompactTypeEnum.PT],
  WI: [CompactTypeEnum.IMLC, CompactTypeEnum.NLC, CompactTypeEnum.PSYPACT, CompactTypeEnum.PT],
  WY: [CompactTypeEnum.IMLC, CompactTypeEnum.NLC, CompactTypeEnum.PT],
  DC: [CompactTypeEnum.IMLC, CompactTypeEnum.NLC, CompactTypeEnum.PSYPACT],
  // Territories
  PR: [CompactTypeEnum.NLC],
  GU: [CompactTypeEnum.NLC],
  VI: [CompactTypeEnum.NLC],
};

/**
 * Cross-compact compatibility matrix
 * Maps license types to compatible compact combinations
 */
export const CROSS_COMPACT_COMPATIBILITY: Record<string, CompactTypeEnum[][]> = {
  'NP': [
    [CompactTypeEnum.NLC, CompactTypeEnum.APRN], // Nurse Practitioner can use both
  ],
  'APRN': [
    [CompactTypeEnum.NLC, CompactTypeEnum.APRN],
  ],
  'RN': [
    [CompactTypeEnum.NLC],
  ],
  'MD': [
    [CompactTypeEnum.IMLC],
  ],
  'DO': [
    [CompactTypeEnum.IMLC],
  ],
  'PSY': [
    [CompactTypeEnum.PSYPACT],
  ],
  'PT': [
    [CompactTypeEnum.PT],
  ],
  'OT': [
    [CompactTypeEnum.OT],
  ],
};

/**
 * Main Compact Engine class
 */
export class CompactEngine {
  /**
   * Evaluate compact eligibility for a clinician
   */
  static evaluate(input: CompactRuleInput, targetState?: string): CompactRuleOutput {
    const target = targetState || input.clinicianState;
    const profile = input.profile || this.buildProfileFromInput(input);

    // Determine which compacts apply
    const applicableCompacts = this.getApplicableCompacts(input);

    if (applicableCompacts.length === 0) {
      return {
        status: 'ineligible',
        requiredSteps: ['Obtain a license in a compact-participating state'],
        estimatedTime: 90,
        authorizedStates: [],
        blockers: ['No applicable compact memberships found'],
        notes: ['Your license type may not be covered by any interstate compact'],
      };
    }

    // Evaluate each applicable compact
    const evaluations = applicableCompacts.map(compact => {
      const eligibility = evaluatePracticeEligibility(
        compact as CompactType,
        profile,
        target
      );
      const authorizedStates = listAuthorizedStatesForCompact(
        compact as CompactType,
        profile
      );

      return {
        compact,
        eligibility,
        authorizedStates,
      };
    });

    // Find best match
    const bestMatch = evaluations.find(e => e.eligibility.eligible);
    const allAuthorizedStates = new Set<string>();
    evaluations.forEach(e => {
      e.authorizedStates.forEach(state => allAuthorizedStates.add(state));
    });

    if (bestMatch) {
      return {
        status: 'eligible',
        requiredSteps: [],
        estimatedTime: 0,
        eligibilityResult: bestMatch.eligibility,
        authorizedStates: Array.from(allAuthorizedStates),
        blockers: [],
        notes: [
          `Eligible via ${bestMatch.compact} compact`,
          `Can practice in ${allAuthorizedStates.size} states`,
        ],
      };
    }

    // Check for conditional eligibility
    const conditional = evaluations.find(e =>
      e.eligibility.conditions?.some(c => !c.passed && c.code !== 'BLOCKED')
    );

    if (conditional) {
      const requiredSteps = conditional.eligibility.conditions
        ?.filter(c => !c.passed)
        .map(c => c.detail) || [];

      return {
        status: 'conditional',
        requiredSteps,
        estimatedTime: this.estimateTime(requiredSteps),
        eligibilityResult: conditional.eligibility,
        authorizedStates: Array.from(allAuthorizedStates),
        blockers: conditional.eligibility.conditions
          ?.filter(c => !c.passed && c.code === 'BLOCKED')
          .map(c => c.detail) || [],
        notes: [
          `Conditional eligibility via ${conditional.compact} compact`,
          'Additional requirements must be met',
        ],
      };
    }

    // Ineligible
    const blockers = evaluations.flatMap(e =>
      e.eligibility.conditions?.filter(c => !c.passed).map(c => c.detail) || []
    );

    return {
      status: 'ineligible',
      requiredSteps: CompactEngine.generateRequiredSteps(input, evaluations),
      estimatedTime: CompactEngine.estimateTime(CompactEngine.generateRequiredSteps(input, evaluations)),
      authorizedStates: [],
      blockers: Array.from(new Set(blockers)),
      notes: [
        'Not currently eligible for interstate compact practice',
        'Review blockers and required steps to become eligible',
      ],
    };
  }

  /**
   * Get applicable compacts for a license type
   */
  static getApplicableCompacts(input: CompactRuleInput): CompactTypeEnum[] {
    const compacts = new Set<CompactTypeEnum>();

    // Use provided compact memberships
    if (input.compactMembership.length > 0) {
      input.compactMembership.forEach(c => compacts.add(c));
      return Array.from(compacts);
    }

    // Infer from license type
    const licenseType = input.licenseType.toUpperCase();

    if (licenseType.includes('MD') || licenseType.includes('DO')) {
      compacts.add(CompactTypeEnum.IMLC);
    }
    if (licenseType.includes('RN') || licenseType.includes('NURSE')) {
      compacts.add(CompactTypeEnum.NLC);
    }
    if (licenseType.includes('NP') || licenseType.includes('APRN')) {
      compacts.add(CompactTypeEnum.NLC);
      compacts.add(CompactTypeEnum.APRN);
    }
    if (licenseType.includes('PSY') || licenseType.includes('PSYCH')) {
      compacts.add(CompactTypeEnum.PSYPACT);
    }
    if (licenseType.includes('PT') || licenseType.includes('PHYSICAL')) {
      compacts.add(CompactTypeEnum.PT);
    }
    if (licenseType.includes('OT') || licenseType.includes('OCCUPATIONAL')) {
      compacts.add(CompactTypeEnum.OT);
    }

    return Array.from(compacts);
  }

  /**
   * Build a profile from input data
   */
  static buildProfileFromInput(input: CompactRuleInput): ClinicianCompactProfile {
    return {
      did: `temp_${Date.now()}`,
      homeState: input.homeState,
      profession: input.specialty,
      licenses: [{
        state: input.clinicianState,
        type: input.licenseType,
        status: 'active',
      }],
      compacts: {},
    };
  }

  /**
   * Generate required steps for eligibility
   */
  static generateRequiredSteps(
    input: CompactRuleInput,
    evaluations: Array<{ compact: CompactTypeEnum; eligibility: PracticeEligibilityResult }>
  ): string[] {
    const steps: string[] = [];

    evaluations.forEach(eval => {
      if (!eval.eligibility.eligible) {
        eval.eligibility.conditions?.forEach(condition => {
          if (!condition.passed) {
            steps.push(condition.detail);
          }
        });
      }
    });

    return Array.from(new Set(steps));
  }

  /**
   * Estimate time to complete requirements (in days)
   */
  static estimateTime(steps: string[]): number {
    // Rough estimates based on step types
    let days = 0;

    steps.forEach(step => {
      const stepLower = step.toLowerCase();
      if (stepLower.includes('license') || stepLower.includes('application')) {
        days += 30; // License application
      } else if (stepLower.includes('verification') || stepLower.includes('document')) {
        days += 14; // Document verification
      } else if (stepLower.includes('residency') || stepLower.includes('reside')) {
        days += 90; // Residency requirement
      } else if (stepLower.includes('exam') || stepLower.includes('test')) {
        days += 60; // Exam requirement
      } else {
        days += 7; // Other requirements
      }
    });

    return Math.max(days, 0);
  }

  /**
   * Get all states where clinician can practice via compacts
   */
  static getAuthorizedStates(input: CompactRuleInput): string[] {
    const profile = input.profile || this.buildProfileFromInput(input);
    const applicableCompacts = this.getApplicableCompacts(input);
    const authorizedStates = new Set<string>();

    applicableCompacts.forEach(compact => {
      const states = listAuthorizedStatesForCompact(
        compact as CompactType,
        profile
      );
      states.forEach(state => authorizedStates.add(state));
    });

    return Array.from(authorizedStates);
  }

  /**
   * Check cross-compact compatibility
   */
  static checkCrossCompactCompatibility(licenseType: string): CompactTypeEnum[][] {
    return CROSS_COMPACT_COMPATIBILITY[licenseType.toUpperCase()] || [];
  }
}


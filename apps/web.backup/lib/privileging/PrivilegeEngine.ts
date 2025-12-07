/**
 * Facility Privileging Engine - Core Engine
 * Phase 1: Privilege Model + Core Logic
 */

import type {
  ClinicianProfile,
  FacilityPrivilegeSet,
  Privilege,
  PrivilegeEligibilityResult,
  PrivilegeRequirementResult,
  PrivilegeStatus,
} from './models';

export class PrivilegeEngine {
  private facilityPrivilegeSets: Map<string, FacilityPrivilegeSet> = new Map();
  private clinicianProfiles: Map<string, ClinicianProfile> = new Map();

  /**
   * Register a facility privilege set
   */
  registerFacilityPrivilegeSet(set: FacilityPrivilegeSet): void {
    const key = `${set.facilityId}:${set.unit}`;
    this.facilityPrivilegeSets.set(key, set);
  }

  /**
   * Register a clinician profile
   */
  registerClinicianProfile(profile: ClinicianProfile): void {
    this.clinicianProfiles.set(profile.clinicianId, profile);
  }

  /**
   * Get privilege set for a clinician based on their profile
   */
  getPrivilegeSetForClinician(clinicianId: string): Privilege[] {
    const profile = this.clinicianProfiles.get(clinicianId);
    if (!profile) return [];

    const privileges: Privilege[] = [];

    // Match privileges based on specialty
    for (const [, set] of this.facilityPrivilegeSets) {
      for (const privilege of set.privileges) {
        if (profile.specialties.includes(privilege.specialty)) {
          privileges.push(privilege);
        }
      }
    }

    return privileges;
  }

  /**
   * Calculate privilege confidence score (0-100)
   */
  calculateConfidenceScore(
    privilege: Privilege,
    profile: ClinicianProfile,
    requirementResults: PrivilegeRequirementResult[]
  ): number {
    if (requirementResults.length === 0) return 0;

    const verifiedCount = requirementResults.filter((r) => r.verified).length;
    const totalCount = requirementResults.length;
    const baseScore = (verifiedCount / totalCount) * 100;

    // Weight by confidence of individual requirements
    const avgConfidence = requirementResults
      .filter((r) => r.verified)
      .reduce((sum, r) => sum + r.confidence, 0) / verifiedCount || 0;

    // Combine base score with confidence average
    return Math.round((baseScore * 0.7) + (avgConfidence * 0.3));
  }

  /**
   * Determine privilege status from requirements
   */
  determineStatus(
    requirementResults: PrivilegeRequirementResult[],
    confidenceScore: number,
    blockers: string[]
  ): PrivilegeStatus {
    if (blockers.length > 0) {
      return PrivilegeStatus.Denied;
    }

    const allVerified = requirementResults.every((r) => r.verified);
    const criticalVerified = requirementResults
      .filter((r) => r.type === 'credential' || r.type === 'skill')
      .every((r) => r.verified);

    if (allVerified && confidenceScore >= 90) {
      return PrivilegeStatus.Eligible;
    }

    if (criticalVerified && confidenceScore >= 70) {
      return PrivilegeStatus.Conditional;
    }

    return PrivilegeStatus.Denied;
  }

  /**
   * Generate next steps to become eligible (AI suggestions)
   */
  generateNextSteps(
    privilege: Privilege,
    requirementResults: PrivilegeRequirementResult[]
  ): string[] {
    const steps: string[] = [];
    const missing = requirementResults.filter((r) => !r.verified);

    for (const req of missing) {
      switch (req.type) {
        case 'credential':
          steps.push(`Obtain required credential: ${req.identifier}`);
          break;
        case 'skill':
          steps.push(`Complete skill verification for: ${req.identifier}`);
          if (req.blockers) {
            steps.push(...req.blockers.map((b) => `  - ${b}`));
          }
          break;
        case 'attestation':
          steps.push(`Request supervisor attestation for: ${req.identifier}`);
          break;
        case 'dea':
          steps.push(`Obtain DEA registration covering required schedules`);
          break;
        case 'mate':
          steps.push(`Obtain MATE registration for controlled substances`);
          break;
        case 'chain':
          steps.push(`Ensure credential chain anchors are valid`);
          break;
        case 'compliance':
          steps.push(`Resolve compliance issues: ${req.identifier}`);
          break;
      }
    }

    return steps;
  }
}

